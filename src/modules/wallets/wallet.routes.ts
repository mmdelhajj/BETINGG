import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { walletService } from './wallet.service';
import { depositService } from './deposit.service';
import { withdrawalService } from './withdrawal.service';
import { swapService } from './swap.service';
import { fiatOnRampService } from './fiatOnRamp.service';
import { walletConnectService } from './walletConnect.service';
import { adminWalletService } from './adminWallet.service';
import { currencyManagerService } from './currencyManager.service';
import { authMiddleware, adminGuard } from '../../middleware/auth';
import { sendSuccess, sendCreated } from '../../utils/response';
import { paginationSchema } from '../../utils/validation';

export default async function walletRoutes(app: FastifyInstance): Promise<void> {
  // ─── WALLETS ──────────────────────────────────────────────────────
  app.get('/', { preHandler: [authMiddleware] }, async (request, reply) => {
    const wallets = await walletService.getWallets(request.user!.userId);
    sendSuccess(reply, wallets);
  });

  app.get('/:currency', { preHandler: [authMiddleware] }, async (request, reply) => {
    const { currency } = z.object({ currency: z.string() }).parse(request.params);
    const wallet = await walletService.getWallet(request.user!.userId, currency);
    sendSuccess(reply, wallet);
  });

  app.post('/', { preHandler: [authMiddleware] }, async (request, reply) => {
    const { currency } = z.object({ currency: z.string() }).parse(request.body);
    const wallet = await walletService.createWallet(request.user!.userId, currency);
    sendCreated(reply, wallet);
  });

  app.get('/balance/total', { preHandler: [authMiddleware] }, async (request, reply) => {
    const total = await walletService.getTotalBalanceUSD(request.user!.userId);
    sendSuccess(reply, { totalUSD: total });
  });

  app.get('/transactions', { preHandler: [authMiddleware] }, async (request, reply) => {
    const query = z.object({
      currency: z.string().optional(),
      type: z.string().optional(),
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(20),
    }).parse(request.query);
    const result = await walletService.getTransactionHistory(request.user!.userId, query);
    sendSuccess(reply, result.transactions, result.meta);
  });

  // ─── DEPOSITS ─────────────────────────────────────────────────────
  app.get('/deposit/:currency/address', { preHandler: [authMiddleware] }, async (request, reply) => {
    const { currency } = z.object({ currency: z.string() }).parse(request.params);
    const result = await depositService.getDepositAddress(request.user!.userId, currency);
    sendSuccess(reply, result);
  });

  app.get('/deposits', { preHandler: [authMiddleware] }, async (request, reply) => {
    const query = z.object({
      currency: z.string().optional(),
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(20),
    }).parse(request.query);
    const result = await depositService.getDepositHistory(request.user!.userId, query);
    sendSuccess(reply, result.deposits, result.meta);
  });

  // ─── WITHDRAWALS ──────────────────────────────────────────────────
  app.post('/withdraw', { preHandler: [authMiddleware] }, async (request, reply) => {
    const body = z.object({
      currency: z.string(),
      amount: z.string(),
      address: z.string(),
      network: z.string(),
    }).parse(request.body);
    const result = await withdrawalService.requestWithdrawal(
      request.user!.userId, body.currency, body.amount, body.address, body.network
    );
    sendCreated(reply, result);
  });

  app.post('/withdraw/:id/cancel', { preHandler: [authMiddleware] }, async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const result = await withdrawalService.cancelWithdrawal(request.user!.userId, id);
    sendSuccess(reply, result);
  });

  // ─── SWAP ─────────────────────────────────────────────────────────
  app.get('/swap/quote', { preHandler: [authMiddleware] }, async (request, reply) => {
    const query = z.object({
      from: z.string(),
      to: z.string(),
      amount: z.string(),
    }).parse(request.query);
    const quote = await swapService.getSwapQuote(query.from, query.to, query.amount);
    sendSuccess(reply, quote);
  });

  app.post('/swap', { preHandler: [authMiddleware] }, async (request, reply) => {
    const body = z.object({
      from: z.string(),
      to: z.string(),
      amount: z.string(),
    }).parse(request.body);
    const result = await swapService.executeSwap(request.user!.userId, body.from, body.to, body.amount);
    sendSuccess(reply, result);
  });

  // ─── FIAT ON-RAMP ────────────────────────────────────────────────
  app.get('/fiat/providers', async (request, reply) => {
    const providers = await fiatOnRampService.getProviders();
    sendSuccess(reply, providers);
  });

  app.post('/fiat/order', { preHandler: [authMiddleware] }, async (request, reply) => {
    const body = z.object({
      providerId: z.string(),
      fiatCurrency: z.string(),
      cryptoCurrency: z.string(),
      fiatAmount: z.string(),
    }).parse(request.body);
    const order = await fiatOnRampService.createOrder(
      request.user!.userId, body.providerId, body.fiatCurrency, body.cryptoCurrency, body.fiatAmount
    );
    sendCreated(reply, order);
  });

  // ─── WALLET CONNECT ──────────────────────────────────────────────
  app.get('/connect/nonce', async (request, reply) => {
    const { address } = z.object({ address: z.string() }).parse(request.query);
    const nonce = await walletConnectService.getNonce(address);
    sendSuccess(reply, { nonce });
  });

  app.post('/connect', { preHandler: [authMiddleware] }, async (request, reply) => {
    const body = z.object({
      address: z.string(),
      chain: z.string(),
      signature: z.string(),
    }).parse(request.body);
    const result = await walletConnectService.connectWallet(
      request.user!.userId, body.address, body.chain, body.signature
    );
    sendSuccess(reply, result);
  });

  app.delete('/connect', { preHandler: [authMiddleware] }, async (request, reply) => {
    const body = z.object({ address: z.string(), chain: z.string() }).parse(request.body);
    const result = await walletConnectService.disconnectWallet(
      request.user!.userId, body.address, body.chain
    );
    sendSuccess(reply, result);
  });

  app.get('/connect/wallets', { preHandler: [authMiddleware] }, async (request, reply) => {
    const wallets = await walletConnectService.getConnectedWallets(request.user!.userId);
    sendSuccess(reply, wallets);
  });

  // ─── CURRENCIES (public) ─────────────────────────────────────────
  app.get('/currencies', async (request, reply) => {
    const query = z.object({
      type: z.string().optional(),
    }).parse(request.query);
    const currencies = await currencyManagerService.getCurrencies({ ...query, active: true });
    sendSuccess(reply, currencies);
  });

  // ─── ADMIN ────────────────────────────────────────────────────────
  app.get('/admin/wallets', { preHandler: [adminGuard] }, async (request, reply) => {
    const wallets = await adminWalletService.getAdminWallets();
    sendSuccess(reply, wallets);
  });

  app.get('/admin/stats', { preHandler: [adminGuard] }, async (request, reply) => {
    const stats = await adminWalletService.getPlatformStats();
    sendSuccess(reply, stats);
  });

  app.get('/admin/revenue', { preHandler: [adminGuard] }, async (request, reply) => {
    const query = z.object({
      startDate: z.string(),
      endDate: z.string(),
    }).parse(request.query);
    const report = await adminWalletService.getRevenueReport(query.startDate, query.endDate);
    sendSuccess(reply, report);
  });

  app.get('/admin/withdrawals/pending', { preHandler: [adminGuard] }, async (request, reply) => {
    const query = paginationSchema.parse(request.query);
    const result = await withdrawalService.getPendingWithdrawals(query);
    sendSuccess(reply, result.withdrawals, result.meta);
  });

  app.post('/admin/withdrawals/:id/approve', { preHandler: [adminGuard] }, async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const result = await withdrawalService.approveWithdrawal(id, request.user!.userId);
    sendSuccess(reply, result);
  });

  app.post('/admin/withdrawals/:id/reject', { preHandler: [adminGuard] }, async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const { reason } = z.object({ reason: z.string() }).parse(request.body);
    const result = await withdrawalService.rejectWithdrawal(id, request.user!.userId, reason);
    sendSuccess(reply, result);
  });

  app.put('/admin/currencies/:symbol', { preHandler: [adminGuard] }, async (request, reply) => {
    const { symbol } = z.object({ symbol: z.string() }).parse(request.params);
    const body = z.object({
      name: z.string().optional(),
      usdRate: z.string().optional(),
      minDeposit: z.string().optional(),
      minWithdrawal: z.string().optional(),
      maxWithdrawal: z.string().optional(),
      isActive: z.boolean().optional(),
      sortOrder: z.number().optional(),
    }).parse(request.body);
    const result = await currencyManagerService.updateCurrency(symbol, body);
    sendSuccess(reply, result);
  });
}
