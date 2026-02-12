import { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import { JWT } from '../config/constants';
import { UnauthorizedError, ForbiddenError } from '../utils/errors';

export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: JwtPayload;
  }
}

export async function authMiddleware(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    throw new UnauthorizedError('Missing or invalid authorization header');
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, JWT.ACCESS_TOKEN_SECRET) as JwtPayload;
    request.user = decoded;
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw new UnauthorizedError('Token expired');
    }
    throw new UnauthorizedError('Invalid token');
  }
}

export async function optionalAuthMiddleware(request: FastifyRequest): Promise<void> {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return;

  const token = authHeader.substring(7);
  try {
    request.user = jwt.verify(token, JWT.ACCESS_TOKEN_SECRET) as JwtPayload;
  } catch {
    // Silently ignore invalid tokens for optional auth
  }
}

export async function adminGuard(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  await authMiddleware(request, reply);
  if (!request.user || (request.user.role !== 'ADMIN' && request.user.role !== 'SUPER_ADMIN')) {
    throw new ForbiddenError('Admin access required');
  }
}

export async function superAdminGuard(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  await authMiddleware(request, reply);
  if (!request.user || request.user.role !== 'SUPER_ADMIN') {
    throw new ForbiddenError('Super admin access required');
  }
}

export function generateAccessToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, JWT.ACCESS_TOKEN_SECRET, { expiresIn: JWT.ACCESS_TOKEN_EXPIRY });
}

export function generateRefreshToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, JWT.REFRESH_TOKEN_SECRET, { expiresIn: JWT.REFRESH_TOKEN_EXPIRY });
}

export function verifyRefreshToken(token: string): JwtPayload {
  return jwt.verify(token, JWT.REFRESH_TOKEN_SECRET) as JwtPayload;
}
