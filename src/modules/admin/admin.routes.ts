import { FastifyInstance } from 'fastify';
import { adminService } from './admin.service';
import { adminGuard } from '../../middleware/auth';
import { sendSuccess, sendError } from '../../utils/response';
import { oddsSyncService, isSchedulerRunning } from '../../services/oddsApi';

export default async function adminRoutes(app: FastifyInstance) {
  // All admin routes require authentication + admin role
  app.addHook('preHandler', adminGuard);

  // ─── Dashboard ────────────────────────────────────────
  app.get('/admin/dashboard', async (request, reply) => {
    const kpis = await adminService.getDashboardKPIs();
    sendSuccess(reply, kpis);
  });

  app.get('/admin/dashboard/chart', async (request, reply) => {
    const { days } = request.query as any;
    const chart = await adminService.getRevenueChart(days ? Number(days) : 30);
    sendSuccess(reply, chart);
  });

  // ─── User Management ─────────────────────────────────
  app.get('/admin/users', async (request, reply) => {
    const { query, page, limit, vipTier } = request.query as any;
    const result = await adminService.searchUsers({
      query, vipTier,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
    sendSuccess(reply, result.users, result.meta);
  });

  app.get('/admin/users/:id', async (request, reply) => {
    const { id } = request.params as any;
    const user = await adminService.getUserDetail(id);
    sendSuccess(reply, user);
  });

  app.post('/admin/users/:id/ban', async (request, reply) => {
    const { id } = request.params as any;
    const { reason } = request.body as any;
    await adminService.banUser(id, reason, (request as any).userId);
    sendSuccess(reply, { banned: true });
  });

  app.post('/admin/users/:id/unban', async (request, reply) => {
    const { id } = request.params as any;
    await adminService.unbanUser(id, (request as any).userId);
    sendSuccess(reply, { unbanned: true });
  });

  app.post('/admin/users/:id/adjust-balance', async (request, reply) => {
    const { id } = request.params as any;
    const { walletId, amount, reason } = request.body as any;
    await adminService.adjustBalance(id, walletId, amount, reason, (request as any).userId);
    sendSuccess(reply, { adjusted: true });
  });

  app.put('/admin/users/:id/vip-tier', async (request, reply) => {
    const { id } = request.params as any;
    const { tier } = request.body as any;
    await adminService.changeVipTier(id, tier, (request as any).userId);
    sendSuccess(reply, { updated: true });
  });

  // ─── Bet Management ───────────────────────────────────
  app.get('/admin/bets', async (request, reply) => {
    const { page, limit, status, userId, minStake } = request.query as any;
    const result = await adminService.searchBets({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      status, userId, minStake,
    });
    sendSuccess(reply, result.bets, result.meta);
  });

  // ─── Financial Reports ────────────────────────────────
  app.get('/admin/reports/financial', async (request, reply) => {
    const { period } = request.query as any;
    const report = await adminService.getFinancialReport(period || 'daily');
    sendSuccess(reply, report);
  });

  // ─── Risk Management ──────────────────────────────────
  app.get('/admin/risk/large-bets', async (request, reply) => {
    const { threshold, limit } = request.query as any;
    const bets = await adminService.getLargeBets(threshold || '1000', limit ? Number(limit) : 50);
    sendSuccess(reply, bets);
  });

  app.get('/admin/risk/win-rate-anomalies', async (request, reply) => {
    const { minBets, threshold } = request.query as any;
    const anomalies = await adminService.getWinRateAnomalies(
      minBets ? Number(minBets) : 50,
      threshold ? Number(threshold) : 0.7
    );
    sendSuccess(reply, anomalies);
  });

  app.get('/admin/risk/duplicate-accounts', async (request, reply) => {
    const duplicates = await adminService.getDuplicateAccounts();
    sendSuccess(reply, duplicates);
  });

  // ─── Site Settings ────────────────────────────────────
  app.get('/admin/settings', async (request, reply) => {
    const config = await adminService.getSiteConfig();
    sendSuccess(reply, config);
  });

  app.put('/admin/settings/:key', async (request, reply) => {
    const { key } = request.params as any;
    const { value } = request.body as any;
    const config = await adminService.updateSiteConfig(key, value, (request as any).userId);
    sendSuccess(reply, config);
  });

  // ─── Audit Log ────────────────────────────────────────
  app.get('/admin/audit-log', async (request, reply) => {
    const { page, limit, action, userId } = request.query as any;
    const result = await adminService.getAuditLog({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      action, userId,
    });
    sendSuccess(reply, result.logs, result.meta);
  });

  // ─── Odds API Management ────────────────────────────
  // Trigger manual odds sync
  app.post('/odds/sync', async (request, reply) => {
    const { priority } = (request.body as any) || {};
    const validPriorities = ['high', 'medium', 'low'] as const;
    const priorityFilter = validPriorities.includes(priority) ? priority : undefined;

    try {
      // First ensure sports list is synced
      await oddsSyncService.syncSportsList();

      // Then sync odds
      const results = await oddsSyncService.syncAllSports(priorityFilter);

      const summary = {
        syncedSports: results.length,
        totalEventsProcessed: results.reduce((sum, r) => sum + r.eventsProcessed, 0),
        totalEventsCreated: results.reduce((sum, r) => sum + r.eventsCreated, 0),
        totalEventsUpdated: results.reduce((sum, r) => sum + r.eventsUpdated, 0),
        totalMarketsUpserted: results.reduce((sum, r) => sum + r.marketsUpserted, 0),
        totalSelectionsUpserted: results.reduce((sum, r) => sum + r.selectionsUpserted, 0),
        totalCreditsUsed: results.reduce((sum, r) => sum + r.creditsUsed, 0),
        totalDuration: results.reduce((sum, r) => sum + r.duration, 0),
        mockMode: oddsSyncService.isMockMode(),
        schedulerRunning: isSchedulerRunning(),
        details: results,
      };

      sendSuccess(reply, summary);
    } catch (error) {
      sendError(reply, 'SYNC_ERROR', `Odds sync failed: ${(error as Error).message}`, 500);
    }
  });

  // Check remaining API credits
  app.get('/odds/credits', async (request, reply) => {
    try {
      const credits = await oddsSyncService.getCreditUsage();
      sendSuccess(reply, {
        ...credits,
        mockMode: oddsSyncService.isMockMode(),
        schedulerRunning: isSchedulerRunning(),
        dailyBudgetEstimate: Math.floor(credits.remaining / 30),
        syncsRemaining: Math.floor(credits.remaining / 3), // 3 credits per full high-priority sync
      });
    } catch (error) {
      sendError(reply, 'CREDITS_ERROR', `Failed to get credit info: ${(error as Error).message}`, 500);
    }
  });

  // Sync sports list only
  app.post('/odds/sync-sports', async (request, reply) => {
    try {
      const result = await oddsSyncService.syncSportsList();
      sendSuccess(reply, {
        ...result,
        mockMode: oddsSyncService.isMockMode(),
      });
    } catch (error) {
      sendError(reply, 'SYNC_ERROR', `Sports list sync failed: ${(error as Error).message}`, 500);
    }
  });
}
