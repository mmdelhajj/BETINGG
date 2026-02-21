import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { config } from '../../config/index.js';
import { prisma } from '../../lib/prisma.js';
import {
  registerSchema,
  loginSchema,
  refreshSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  twoFactorSetupVerifySchema,
  twoFactorVerifySchema,
  twoFactorDisableSchema,
  type RegisterInput,
  type LoginInput,
  type RefreshInput,
  type ForgotPasswordInput,
  type ResetPasswordInput,
  type TwoFactorSetupVerifyInput,
  type TwoFactorVerifyInput,
  type TwoFactorDisableInput,
} from './auth.schemas.js';
import * as authService from './auth.service.js';
import * as googleService from './google.service.js';
import * as githubService from './github.service.js';
import * as twoFactorService from './twoFactor.service.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function success(reply: FastifyReply, data: unknown, statusCode = 200) {
  return reply.status(statusCode).send({ success: true, data });
}

function error(
  reply: FastifyReply,
  code: string,
  message: string,
  statusCode = 400,
) {
  return reply.status(statusCode).send({
    success: false,
    error: { code, message },
  });
}

function getIp(request: FastifyRequest): string {
  return (
    (request.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ??
    request.ip
  );
}

function getUserAgent(request: FastifyRequest): string {
  return (request.headers['user-agent'] as string) ?? 'unknown';
}

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

export default async function authRoutes(fastify: FastifyInstance): Promise<void> {
  // =======================================================================
  // POST /api/v1/auth/register
  // =======================================================================
  fastify.post(
    '/api/v1/auth/register',
    { preHandler: [validate(registerSchema)] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = request.body as RegisterInput;
        const result = await authService.register(body);
        return success(reply, result, 201);
      } catch (err) {
        if (err instanceof authService.AuthError) {
          return error(reply, err.code, err.message, err.statusCode);
        }
        throw err;
      }
    },
  );

  // =======================================================================
  // POST /api/v1/auth/login
  // =======================================================================
  fastify.post(
    '/api/v1/auth/login',
    { preHandler: [validate(loginSchema)] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = request.body as LoginInput;
        const ip = getIp(request);
        const ua = getUserAgent(request);
        const result = await authService.login(body, ip, ua);
        return success(reply, result);
      } catch (err) {
        if (err instanceof authService.AuthError) {
          return error(reply, err.code, err.message, err.statusCode);
        }
        throw err;
      }
    },
  );

  // =======================================================================
  // POST /api/v1/auth/refresh
  // =======================================================================
  fastify.post(
    '/api/v1/auth/refresh',
    { preHandler: [validate(refreshSchema)] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { refreshToken } = request.body as RefreshInput;
        const result = await authService.refreshToken(refreshToken);
        return success(reply, result);
      } catch (err) {
        if (err instanceof authService.AuthError) {
          return error(reply, err.code, err.message, err.statusCode);
        }
        throw err;
      }
    },
  );

  // =======================================================================
  // POST /api/v1/auth/logout
  // =======================================================================
  fastify.post(
    '/api/v1/auth/logout',
    { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        // Look up the active session by the access token
        const authHeader = request.headers.authorization;
        const token = authHeader?.split(' ')[1] ?? '';
        const session = await findSessionByAccessToken(token, request.user!.id);

        if (!session) {
          return error(reply, 'SESSION_NOT_FOUND', 'No active session found', 404);
        }

        const result = await authService.logout(session.id, request.user!.id);
        return success(reply, result);
      } catch (err) {
        if (err instanceof authService.AuthError) {
          return error(reply, err.code, err.message, err.statusCode);
        }
        throw err;
      }
    },
  );

  // =======================================================================
  // POST /api/v1/auth/forgot-password
  // =======================================================================
  fastify.post(
    '/api/v1/auth/forgot-password',
    { preHandler: [validate(forgotPasswordSchema)] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { email } = request.body as ForgotPasswordInput;
        const result = await authService.forgotPassword(email);
        return success(reply, result);
      } catch (err) {
        if (err instanceof authService.AuthError) {
          return error(reply, err.code, err.message, err.statusCode);
        }
        throw err;
      }
    },
  );

  // =======================================================================
  // POST /api/v1/auth/reset-password
  // =======================================================================
  fastify.post(
    '/api/v1/auth/reset-password',
    { preHandler: [validate(resetPasswordSchema)] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { token, newPassword } = request.body as ResetPasswordInput;
        const result = await authService.resetPassword(token, newPassword);
        return success(reply, result);
      } catch (err) {
        if (err instanceof authService.AuthError) {
          return error(reply, err.code, err.message, err.statusCode);
        }
        throw err;
      }
    },
  );

  // =======================================================================
  // GET /api/v1/auth/google - Redirect to Google OAuth
  // =======================================================================
  fastify.get(
    '/api/v1/auth/google',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      try {
        const url = googleService.getGoogleAuthUrl();
        return reply.redirect(302, url);
      } catch (err) {
        if (err instanceof authService.AuthError) {
          return error(reply, err.code, err.message, err.statusCode);
        }
        throw err;
      }
    },
  );

  // =======================================================================
  // GET /api/v1/auth/google/callback
  // =======================================================================
  fastify.get(
    '/api/v1/auth/google/callback',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { code, error: oauthError } = request.query as {
          code?: string;
          error?: string;
        };

        if (oauthError || !code) {
          const redirectUrl = new URL('/auth/login', config.FRONTEND_URL);
          redirectUrl.searchParams.set('error', oauthError ?? 'no_code');
          return reply.redirect(302, redirectUrl.toString());
        }

        const ip = getIp(request);
        const ua = getUserAgent(request);
        const result = await googleService.handleGoogleCallback(code, ip, ua);

        // Redirect to frontend with tokens
        const redirectUrl = new URL('/auth/oauth-callback', config.FRONTEND_URL);
        redirectUrl.searchParams.set('accessToken', result.tokens.accessToken);
        redirectUrl.searchParams.set('refreshToken', result.tokens.refreshToken);
        return reply.redirect(302, redirectUrl.toString());
      } catch (err) {
        console.error('[Google OAuth] Callback error:', err);
        const redirectUrl = new URL('/auth/login', config.FRONTEND_URL);
        redirectUrl.searchParams.set(
          'error',
          err instanceof authService.AuthError ? err.code : 'oauth_error',
        );
        return reply.redirect(302, redirectUrl.toString());
      }
    },
  );

  // =======================================================================
  // GET /api/v1/auth/github - Redirect to GitHub OAuth
  // =======================================================================
  fastify.get(
    '/api/v1/auth/github',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      try {
        const url = githubService.getGithubAuthUrl();
        return reply.redirect(302, url);
      } catch (err) {
        if (err instanceof authService.AuthError) {
          return error(reply, err.code, err.message, err.statusCode);
        }
        throw err;
      }
    },
  );

  // =======================================================================
  // GET /api/v1/auth/github/callback
  // =======================================================================
  fastify.get(
    '/api/v1/auth/github/callback',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { code, error: oauthError } = request.query as {
          code?: string;
          error?: string;
        };

        if (oauthError || !code) {
          const redirectUrl = new URL('/auth/login', config.FRONTEND_URL);
          redirectUrl.searchParams.set('error', oauthError ?? 'no_code');
          return reply.redirect(302, redirectUrl.toString());
        }

        const ip = getIp(request);
        const ua = getUserAgent(request);
        const result = await githubService.handleGithubCallback(code, ip, ua);

        const redirectUrl = new URL('/auth/oauth-callback', config.FRONTEND_URL);
        redirectUrl.searchParams.set('accessToken', result.tokens.accessToken);
        redirectUrl.searchParams.set('refreshToken', result.tokens.refreshToken);
        return reply.redirect(302, redirectUrl.toString());
      } catch (err) {
        console.error('[GitHub OAuth] Callback error:', err);
        const redirectUrl = new URL('/auth/login', config.FRONTEND_URL);
        redirectUrl.searchParams.set(
          'error',
          err instanceof authService.AuthError ? err.code : 'oauth_error',
        );
        return reply.redirect(302, redirectUrl.toString());
      }
    },
  );

  // =======================================================================
  // POST /api/v1/auth/2fa/setup
  // =======================================================================
  fastify.post(
    '/api/v1/auth/2fa/setup',
    { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const result = await twoFactorService.setup(request.user!.id);
        return success(reply, result);
      } catch (err) {
        if (err instanceof authService.AuthError) {
          return error(reply, err.code, err.message, err.statusCode);
        }
        throw err;
      }
    },
  );

  // =======================================================================
  // POST /api/v1/auth/2fa/verify-setup
  // =======================================================================
  fastify.post(
    '/api/v1/auth/2fa/verify-setup',
    { preHandler: [authenticate, validate(twoFactorSetupVerifySchema)] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { token } = request.body as TwoFactorSetupVerifyInput;
        const result = await twoFactorService.verifySetup(
          request.user!.id,
          token,
        );
        return success(reply, result);
      } catch (err) {
        if (err instanceof authService.AuthError) {
          return error(reply, err.code, err.message, err.statusCode);
        }
        throw err;
      }
    },
  );

  // =======================================================================
  // POST /api/v1/auth/2fa/verify (login flow)
  // =======================================================================
  fastify.post(
    '/api/v1/auth/2fa/verify',
    { preHandler: [validate(twoFactorVerifySchema)] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { tempToken, token } = request.body as TwoFactorVerifyInput;
        const ip = getIp(request);
        const ua = getUserAgent(request);
        const result = await twoFactorService.verify(tempToken, token, ip, ua);
        return success(reply, result);
      } catch (err) {
        if (err instanceof authService.AuthError) {
          return error(reply, err.code, err.message, err.statusCode);
        }
        throw err;
      }
    },
  );

  // =======================================================================
  // POST /api/v1/auth/2fa/disable
  // =======================================================================
  fastify.post(
    '/api/v1/auth/2fa/disable',
    { preHandler: [authenticate, validate(twoFactorDisableSchema)] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { token, password } = request.body as TwoFactorDisableInput;
        const result = await twoFactorService.disable(
          request.user!.id,
          token,
          password,
        );
        return success(reply, result);
      } catch (err) {
        if (err instanceof authService.AuthError) {
          return error(reply, err.code, err.message, err.statusCode);
        }
        throw err;
      }
    },
  );

  // =======================================================================
  // GET /api/v1/auth/me
  // =======================================================================
  fastify.get(
    '/api/v1/auth/me',
    { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const result = await authService.getCurrentUser(request.user!.id);
        return success(reply, result);
      } catch (err) {
        if (err instanceof authService.AuthError) {
          return error(reply, err.code, err.message, err.statusCode);
        }
        throw err;
      }
    },
  );

  // =======================================================================
  // GET /api/v1/auth/sessions
  // =======================================================================
  fastify.get(
    '/api/v1/auth/sessions',
    { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const sessions = await authService.getSessions(request.user!.id);
        return success(reply, { sessions });
      } catch (err) {
        if (err instanceof authService.AuthError) {
          return error(reply, err.code, err.message, err.statusCode);
        }
        throw err;
      }
    },
  );

  // =======================================================================
  // DELETE /api/v1/auth/sessions/:id
  // =======================================================================
  fastify.delete(
    '/api/v1/auth/sessions/:id',
    { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };
        const result = await authService.revokeSession(id, request.user!.id);
        return success(reply, result);
      } catch (err) {
        if (err instanceof authService.AuthError) {
          return error(reply, err.code, err.message, err.statusCode);
        }
        throw err;
      }
    },
  );
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function findSessionByAccessToken(accessToken: string, userId: string) {
  return prisma.session.findFirst({
    where: {
      token: accessToken,
      userId,
      isRevoked: false,
    },
    select: { id: true },
  });
}
