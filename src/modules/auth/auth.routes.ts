import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authService } from './auth.service';
import { authMiddleware } from '../../middleware/auth';
import { sendSuccess, sendError } from '../../utils/response';
import { emailSchema, usernameSchema, passwordSchema } from '../../utils/validation';

const registerSchema = z.object({
  email: emailSchema,
  username: usernameSchema,
  password: passwordSchema,
  referralCode: z.string().optional(),
});

const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1),
  twoFactorCode: z.string().length(6).optional(),
});

export default async function authRoutes(app: FastifyInstance): Promise<void> {
  // Register
  app.post('/register', async (request, reply) => {
    const body = registerSchema.parse(request.body);
    const result = await authService.register(body, request.ip);
    sendSuccess(reply, result, undefined, 201);
  });

  // Login
  app.post('/login', async (request, reply) => {
    const body = loginSchema.parse(request.body);
    const result = await authService.login(body, request.ip, request.headers['user-agent']);
    sendSuccess(reply, result);
  });

  // Refresh token
  app.post('/refresh', async (request, reply) => {
    const { refreshToken } = z.object({ refreshToken: z.string() }).parse(request.body);
    const tokens = await authService.refreshToken(refreshToken);
    sendSuccess(reply, tokens);
  });

  // Logout
  app.post('/logout', { preHandler: [authMiddleware] }, async (request, reply) => {
    const { refreshToken } = z.object({ refreshToken: z.string().optional() }).parse(request.body || {});
    await authService.logout(request.user!.userId, refreshToken);
    sendSuccess(reply, { message: 'Logged out successfully' });
  });

  // Setup 2FA
  app.post('/2fa/setup', { preHandler: [authMiddleware] }, async (request, reply) => {
    const result = await authService.setup2FA(request.user!.userId);
    sendSuccess(reply, result);
  });

  // Confirm 2FA
  app.post('/2fa/confirm', { preHandler: [authMiddleware] }, async (request, reply) => {
    const { code } = z.object({ code: z.string().length(6) }).parse(request.body);
    const result = await authService.confirm2FA(request.user!.userId, code);
    sendSuccess(reply, result);
  });

  // Disable 2FA
  app.post('/2fa/disable', { preHandler: [authMiddleware] }, async (request, reply) => {
    const { code } = z.object({ code: z.string().length(6) }).parse(request.body);
    await authService.disable2FA(request.user!.userId, code);
    sendSuccess(reply, { message: '2FA disabled' });
  });

  // Request password reset
  app.post('/password-reset/request', async (request, reply) => {
    const { email } = z.object({ email: emailSchema }).parse(request.body);
    await authService.requestPasswordReset(email);
    sendSuccess(reply, { message: 'If the email exists, a reset link has been sent.' });
  });

  // Reset password
  app.post('/password-reset/confirm', async (request, reply) => {
    const { token, password } = z
      .object({ token: z.string(), password: passwordSchema })
      .parse(request.body);
    await authService.resetPassword(token, password);
    sendSuccess(reply, { message: 'Password reset successfully' });
  });

  // Change password
  app.post('/password/change', { preHandler: [authMiddleware] }, async (request, reply) => {
    const { currentPassword, newPassword } = z
      .object({ currentPassword: z.string(), newPassword: passwordSchema })
      .parse(request.body);
    await authService.changePassword(request.user!.userId, currentPassword, newPassword);
    sendSuccess(reply, { message: 'Password changed successfully' });
  });

  // OAuth login stubs
  app.post('/oauth/google', async (request, reply) => {
    const { idToken } = z.object({ idToken: z.string() }).parse(request.body);
    // In production, verify Google ID token and extract profile
    sendError(reply, 'NOT_IMPLEMENTED', 'Google OAuth requires frontend SDK integration', 501);
  });

  app.post('/oauth/github', async (request, reply) => {
    const { code } = z.object({ code: z.string() }).parse(request.body);
    // In production, exchange code for access token, then fetch profile
    sendError(reply, 'NOT_IMPLEMENTED', 'GitHub OAuth requires frontend SDK integration', 501);
  });

  // Get active sessions
  app.get('/sessions', { preHandler: [authMiddleware] }, async (request, reply) => {
    const sessions = await authService.getActiveSessions(request.user!.userId);
    sendSuccess(reply, sessions);
  });

  // Revoke session
  app.delete('/sessions/:sessionId', { preHandler: [authMiddleware] }, async (request, reply) => {
    const { sessionId } = z.object({ sessionId: z.string() }).parse(request.params);
    await authService.revokeSession(request.user!.userId, sessionId);
    sendSuccess(reply, { message: 'Session revoked' });
  });

  // Get current user
  app.get('/me', { preHandler: [authMiddleware] }, async (request, reply) => {
    const user = await prismaLookup(request.user!.userId);
    sendSuccess(reply, user);
  });
}

async function prismaLookup(userId: string) {
  const { default: prisma } = await import('../../lib/prisma');
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      username: true,
      role: true,
      avatar: true,
      dateOfBirth: true,
      kycLevel: true,
      vipTier: true,
      totalWagered: true,
      twoFactorEnabled: true,
      preferredCurrency: true,
      preferredOddsFormat: true,
      theme: true,
      language: true,
      referralCode: true,
      lastLoginAt: true,
      createdAt: true,
    },
  });
}
