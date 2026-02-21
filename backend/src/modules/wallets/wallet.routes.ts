import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Prisma } from '@prisma/client';
import { authenticate, adminGuard } from '../../middleware/auth.js';
import { prisma } from '../../lib/prisma.js';
import {
  generateAddressSchema,
  withdrawSchema,
  swapSchema,
  swapRateSchema,
  transactionFilterSchema,
  createCurrencySchema,
  updateCurrencySchema,
  createNetworkSchema,
  updateNetworkSchema,
  rejectWithdrawalSchema,
  adminTransactionFilterSchema,
} from './wallet.schemas.js';
import * as walletService from './wallet.service.js';
import * as withdrawalService from './withdrawal.service.js';
import * as swapService from './swap.service.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ok(data: unknown) {
  return { success: true as const, data };
}

function fail(code: string, message: string) {
  return { success: false as const, error: { code, message } };
}

function getUserId(request: FastifyRequest): string {
  if (!request.user?.id) {
    throw new Error('User not authenticated');
  }
  return request.user.id;
}

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

export default async function walletRoutes(fastify: FastifyInstance): Promise<void> {
  // =========================================================================
  // USER ROUTES — /api/v1/wallets
  // =========================================================================

  // ---- GET /api/v1/wallets — list all wallets with balances ----
  fastify.get(
    '/api/v1/wallets',
    { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = getUserId(request);
        const wallets = await walletService.getUserWallets(userId);
        return ok({ wallets });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to fetch wallets';
        return reply.status(500).send(fail('WALLET_FETCH_ERROR', message));
      }
    },
  );

  // ---- GET /api/v1/wallets/transactions — transaction history ----
  // NOTE: Registered BEFORE the :currency param route to avoid collision
  fastify.get(
    '/api/v1/wallets/transactions',
    { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = getUserId(request);
        const parsed = transactionFilterSchema.safeParse(request.query);

        if (!parsed.success) {
          return reply.status(400).send(fail('VALIDATION_ERROR', parsed.error.issues[0].message));
        }

        const result = await walletService.getTransactions(userId, parsed.data);
        return ok(result);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to fetch transactions';
        return reply.status(500).send(fail('TRANSACTION_FETCH_ERROR', message));
      }
    },
  );

  // ---- GET /api/v1/wallets/swap/rate — get swap rate ----
  fastify.get(
    '/api/v1/wallets/swap/rate',
    { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const parsed = swapRateSchema.safeParse(request.query);

        if (!parsed.success) {
          return reply.status(400).send(fail('VALIDATION_ERROR', parsed.error.issues[0].message));
        }

        const rate = await swapService.getSwapRate(
          parsed.data.fromCurrency,
          parsed.data.toCurrency,
          parsed.data.amount,
        );
        return ok({ rate });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to get swap rate';
        return reply.status(400).send(fail('SWAP_RATE_ERROR', message));
      }
    },
  );

  // ---- POST /api/v1/wallets/swap — execute currency swap ----
  fastify.post(
    '/api/v1/wallets/swap',
    { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = getUserId(request);
        const parsed = swapSchema.safeParse(request.body);

        if (!parsed.success) {
          return reply.status(400).send(fail('VALIDATION_ERROR', parsed.error.issues[0].message));
        }

        const result = await swapService.executeSwap(
          userId,
          parsed.data.fromCurrency,
          parsed.data.toCurrency,
          parsed.data.amount,
        );
        return ok({ swap: result });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Swap failed';
        return reply.status(400).send(fail('SWAP_ERROR', message));
      }
    },
  );

  // ---- POST /api/v1/wallets/withdraw — request withdrawal ----
  fastify.post(
    '/api/v1/wallets/withdraw',
    { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = getUserId(request);
        const parsed = withdrawSchema.safeParse(request.body);

        if (!parsed.success) {
          return reply.status(400).send(fail('VALIDATION_ERROR', parsed.error.issues[0].message));
        }

        const result = await withdrawalService.requestWithdrawal(
          userId,
          parsed.data.currency,
          parsed.data.amount,
          parsed.data.toAddress,
          parsed.data.networkId,
          parsed.data.twoFactorToken,
        );
        return ok({ withdrawal: result });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Withdrawal request failed';
        return reply.status(400).send(fail('WITHDRAWAL_ERROR', message));
      }
    },
  );

  // ---- GET /api/v1/wallets/:currency — get specific wallet ----
  fastify.get(
    '/api/v1/wallets/:currency',
    { preHandler: [authenticate] },
    async (
      request: FastifyRequest<{ Params: { currency: string } }>,
      reply: FastifyReply,
    ) => {
      try {
        const userId = getUserId(request);
        const { currency } = request.params;
        const wallet = await walletService.getWallet(userId, currency);

        if (!wallet) {
          return reply.status(404).send(fail('NOT_FOUND', `Wallet for ${currency} not found`));
        }

        return ok({ wallet });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to fetch wallet';
        return reply.status(500).send(fail('WALLET_FETCH_ERROR', message));
      }
    },
  );

  // ---- POST /api/v1/wallets/:currency/address — generate deposit address ----
  fastify.post(
    '/api/v1/wallets/:currency/address',
    { preHandler: [authenticate] },
    async (
      request: FastifyRequest<{ Params: { currency: string } }>,
      reply: FastifyReply,
    ) => {
      try {
        const userId = getUserId(request);
        const { currency } = request.params;
        const parsed = generateAddressSchema.safeParse(request.body);

        if (!parsed.success) {
          return reply.status(400).send(fail('VALIDATION_ERROR', parsed.error.issues[0].message));
        }

        const result = await walletService.generateDepositAddress(
          userId,
          currency,
          parsed.data.networkId,
        );
        return ok({ deposit: result });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to generate address';
        return reply.status(400).send(fail('ADDRESS_ERROR', message));
      }
    },
  );

}
