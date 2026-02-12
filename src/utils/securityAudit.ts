// ─── CryptoBet Security Audit Utilities ─────────────────
// Tools for validating security posture across the platform

import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';

export class SecurityAudit {
  // ─── Password Strength Validation ─────────────────────
  static validatePasswordStrength(password: string): { valid: boolean; issues: string[] } {
    const issues: string[] = [];

    if (password.length < 8) issues.push('Password must be at least 8 characters');
    if (password.length > 128) issues.push('Password must not exceed 128 characters');
    if (!/[A-Z]/.test(password)) issues.push('Password must contain an uppercase letter');
    if (!/[a-z]/.test(password)) issues.push('Password must contain a lowercase letter');
    if (!/[0-9]/.test(password)) issues.push('Password must contain a number');
    if (!/[^A-Za-z0-9]/.test(password)) issues.push('Password should contain a special character');

    // Check for common passwords
    const commonPasswords = ['password', '12345678', 'qwerty123', 'letmein', 'admin123'];
    if (commonPasswords.includes(password.toLowerCase())) {
      issues.push('Password is too common');
    }

    return { valid: issues.length === 0, issues };
  }

  // ─── Email Validation ────────────────────────────────
  static validateEmail(email: string): boolean {
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    return emailRegex.test(email) && email.length <= 254;
  }

  // ─── Crypto Address Validation ────────────────────────
  static validateCryptoAddress(address: string, currency: string): boolean {
    const patterns: Record<string, RegExp> = {
      BTC: /^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,87}$/,
      ETH: /^0x[a-fA-F0-9]{40}$/,
      USDT: /^(0x[a-fA-F0-9]{40}|T[a-zA-Z0-9]{33})$/, // ERC20 or TRC20
      USDC: /^0x[a-fA-F0-9]{40}$/,
      SOL: /^[1-9A-HJ-NP-Za-km-z]{32,44}$/,
      BNB: /^(bnb1|0x)[a-zA-Z0-9]{38,42}$/,
    };

    const pattern = patterns[currency.toUpperCase()];
    if (!pattern) return true; // Unknown currency, accept
    return pattern.test(address);
  }

  // ─── Amount Validation (prevent overflow/underflow) ───
  static validateAmount(amount: string): { valid: boolean; issue?: string } {
    if (!amount || amount.trim() === '') return { valid: false, issue: 'Amount is required' };

    const num = parseFloat(amount);
    if (isNaN(num)) return { valid: false, issue: 'Invalid number' };
    if (num <= 0) return { valid: false, issue: 'Amount must be positive' };
    if (num > 1e15) return { valid: false, issue: 'Amount exceeds maximum' };

    // Check decimal precision (max 18 for crypto)
    const parts = amount.split('.');
    if (parts[1] && parts[1].length > 18) return { valid: false, issue: 'Too many decimal places' };

    return { valid: true };
  }

  // ─── Session Validation ──────────────────────────────
  static async validateSession(sessionId: string): Promise<boolean> {
    const session = await redis.get(`session:${sessionId}`);
    return session !== null;
  }

  // ─── Audit Trail ─────────────────────────────────────
  static async logSecurityEvent(event: {
    userId?: string;
    adminId?: string;
    action: string;
    resource?: string;
    resourceId?: string;
    details?: any;
    ipAddress?: string;
    userAgent?: string;
  }) {
    await prisma.auditLog.create({
      data: {
        userId: event.userId,
        adminId: event.adminId,
        action: event.action,
        resource: event.resource,
        resourceId: event.resourceId,
        details: event.details,
        ipAddress: event.ipAddress,
        userAgent: event.userAgent,
      },
    });
  }

  // ─── Check for Suspicious Activity ───────────────────
  static async detectSuspiciousActivity(userId: string): Promise<string[]> {
    const alerts: string[] = [];
    const oneHourAgo = new Date(Date.now() - 3600000);

    // Check rapid bet placement
    const recentBets = await prisma.bet.count({
      where: { userId, createdAt: { gte: oneHourAgo } },
    });
    if (recentBets > 100) alerts.push(`High bet volume: ${recentBets} bets in last hour`);

    // Check multiple failed logins
    const failedLogins = await redis.get(`login_attempts:${userId}`);
    if (failedLogins && parseInt(failedLogins) >= 3) {
      alerts.push(`Multiple failed login attempts: ${failedLogins}`);
    }

    // Check for simultaneous sessions from different IPs
    const sessions = await redis.keys(`session:${userId}:*`);
    if (sessions.length > 5) alerts.push(`Excessive active sessions: ${sessions.length}`);

    return alerts;
  }

  // ─── Generate Security Report ────────────────────────
  static async generateReport(): Promise<any> {
    const [
      totalUsers, usersWithout2FA, unverifiedUsers,
      pendingWithdrawals, recentAuditEvents,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { twoFactorEnabled: false } }),
      prisma.user.count({ where: { kycLevel: 'UNVERIFIED' } }),
      prisma.transaction.count({ where: { type: 'WITHDRAWAL', status: 'PENDING' } }),
      prisma.auditLog.count({ where: { createdAt: { gte: new Date(Date.now() - 86400000) } } }),
    ]);

    return {
      timestamp: new Date().toISOString(),
      users: {
        total: totalUsers,
        without2FA: usersWithout2FA,
        without2FAPercent: ((usersWithout2FA / totalUsers) * 100).toFixed(1),
        unverified: unverifiedUsers,
      },
      payments: {
        pendingWithdrawals,
      },
      activity: {
        auditEventsLast24h: recentAuditEvents,
      },
    };
  }
}
