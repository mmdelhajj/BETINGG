import { Queue, Worker, type Job, type ConnectionOptions } from 'bullmq';
import { config } from '../config/index.js';
import { logger } from '../middleware/logger.js';
import { autoSettleEvent } from '../services/auto-settlement.js';

// Parse Redis URL into connection options for BullMQ
function parseRedisUrl(url: string): ConnectionOptions {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parseInt(parsed.port || '6379', 10),
    password: parsed.password || undefined,
    db: parsed.pathname ? parseInt(parsed.pathname.slice(1), 10) || 0 : 0,
    maxRetriesPerRequest: null,
  };
}

const connection: ConnectionOptions = parseRedisUrl(config.REDIS_URL);

// --- Queue Definitions ---

export const betProcessingQueue = new Queue('bet-processing', {
  connection,
  defaultJobOptions: {
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 5000 },
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
  },
});

export const betSettlementQueue = new Queue('bet-settlement', {
  connection,
  defaultJobOptions: {
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 5000 },
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
  },
});

export const rewardCalculationQueue = new Queue('reward-calculation', {
  connection,
  defaultJobOptions: {
    removeOnComplete: { count: 500 },
    removeOnFail: { count: 2000 },
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
  },
});

export const withdrawalProcessingQueue = new Queue('withdrawal-processing', {
  connection,
  defaultJobOptions: {
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 5000 },
    attempts: 5,
    backoff: { type: 'exponential', delay: 5000 },
  },
});

export const depositDetectionQueue = new Queue('deposit-detection', {
  connection,
  defaultJobOptions: {
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 5000 },
    attempts: 5,
    backoff: { type: 'exponential', delay: 3000 },
  },
});

export const notificationSenderQueue = new Queue('notification-sender', {
  connection,
  defaultJobOptions: {
    removeOnComplete: { count: 2000 },
    removeOnFail: { count: 5000 },
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
  },
});

export const oddsSyncQueue = new Queue('odds-sync', {
  connection,
  defaultJobOptions: {
    removeOnComplete: { count: 500 },
    removeOnFail: { count: 2000 },
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
  },
});

// --- Worker Definitions ---

let workers: Worker[] = [];

function createWorkers(): Worker[] {
  const betProcessingWorker = new Worker(
    'bet-processing',
    async (job: Job) => {
      logger.info({ jobId: job.id, data: job.data }, '[bet-processing] Processing job');
      // Bet validation, odds check, balance deduction, bet placement
      logger.info({ jobId: job.id }, '[bet-processing] Job completed');
    },
    { connection, concurrency: 5 },
  );

  const betSettlementWorker = new Worker(
    'bet-settlement',
    async (job: Job) => {
      const { eventId, eventName, score } = job.data;
      logger.info({ jobId: job.id, eventId, eventName, score }, '[bet-settlement] Processing auto-settlement');

      try {
        // Pass score data through to autoSettleEvent so it can write scores if missing
        const scoreData = score && typeof score.home === 'number' && typeof score.away === 'number'
          ? { home: score.home, away: score.away }
          : undefined;

        const result = await autoSettleEvent(eventId, scoreData);
        logger.info({
          jobId: job.id,
          eventId,
          eventName,
          marketsSettled: result.marketsSettled,
          betsSettled: result.betsSettled,
          totalPayout: result.totalPayout,
        }, '[bet-settlement] Auto-settlement complete');
        return result;
      } catch (err) {
        logger.error({ jobId: job.id, eventId, err }, '[bet-settlement] Auto-settlement failed');
        throw err; // BullMQ will retry
      }
    },
    { connection, concurrency: 3 },
  );

  const rewardCalculationWorker = new Worker(
    'reward-calculation',
    async (job: Job) => {
      logger.info({ jobId: job.id, data: job.data }, '[reward-calculation] Processing job');
      // Calculate rakeback, VIP progress, level-up rewards, referral rewards
      logger.info({ jobId: job.id }, '[reward-calculation] Job completed');
    },
    { connection, concurrency: 2 },
  );

  const withdrawalProcessingWorker = new Worker(
    'withdrawal-processing',
    async (job: Job) => {
      logger.info({ jobId: job.id, data: job.data }, '[withdrawal-processing] Processing job');
      // Validate withdrawal, check limits, process on-chain transaction
      logger.info({ jobId: job.id }, '[withdrawal-processing] Job completed');
    },
    { connection, concurrency: 2 },
  );

  const depositDetectionWorker = new Worker(
    'deposit-detection',
    async (job: Job) => {
      logger.info({ jobId: job.id, data: job.data }, '[deposit-detection] Processing job');
      // Monitor blockchain for incoming deposits, confirm transactions, credit balances
      logger.info({ jobId: job.id }, '[deposit-detection] Job completed');
    },
    { connection, concurrency: 3 },
  );

  const notificationSenderWorker = new Worker(
    'notification-sender',
    async (job: Job) => {
      const { userId, betId, status, stake, payout, currency, eventName } = job.data;

      if (job.name === 'bet-settled-notification' && userId) {
        try {
          const { prisma } = await import('../lib/prisma.js');

          // Determine notification type and message
          const notifType = status === 'WON' ? 'BET_WON' : status === 'LOST' ? 'BET_LOST' : 'SYSTEM';
          const payoutNum = parseFloat(payout || '0');
          const stakeNum = parseFloat(stake || '0');

          let title: string;
          let message: string;

          if (status === 'WON') {
            title = 'Bet Won!';
            message = `Your bet on ${eventName || 'a match'} won! Payout: ${payoutNum.toFixed(4)} ${currency || 'BTC'}`;
          } else if (status === 'LOST') {
            title = 'Bet Lost';
            message = `Your bet on ${eventName || 'a match'} lost. Stake: ${stakeNum.toFixed(4)} ${currency || 'BTC'}`;
          } else {
            title = 'Bet Voided';
            message = `Your bet on ${eventName || 'a match'} was voided. Stake returned: ${stakeNum.toFixed(4)} ${currency || 'BTC'}`;
          }

          // Create in-app notification
          await prisma.notification.create({
            data: {
              userId,
              type: notifType,
              title,
              message,
              metadata: { betId, status, payout, stake, currency, eventName },
            },
          });

          logger.info({ userId, betId, status }, '[notification-sender] Bet notification created');
        } catch (err) {
          logger.error({ userId, betId, err }, '[notification-sender] Failed to create notification');
        }
      } else {
        logger.info({ jobId: job.id, jobName: job.name }, '[notification-sender] Job processed');
      }
    },
    { connection, concurrency: 5 },
  );

  const oddsSyncWorker = new Worker(
    'odds-sync',
    async (job: Job) => {
      logger.info({ jobId: job.id, data: job.data }, '[odds-sync] Processing job');
      // Fetch latest odds from providers, update markets, broadcast changes via Socket.IO
      logger.info({ jobId: job.id }, '[odds-sync] Job completed');
    },
    { connection, concurrency: 2 },
  );

  const allWorkers = [
    betProcessingWorker,
    betSettlementWorker,
    rewardCalculationWorker,
    withdrawalProcessingWorker,
    depositDetectionWorker,
    notificationSenderWorker,
    oddsSyncWorker,
  ];

  // Attach error handlers to all workers
  for (const worker of allWorkers) {
    worker.on('failed', (job, err) => {
      logger.error(
        { queue: worker.name, jobId: job?.id, err },
        `[${worker.name}] Job failed`,
      );
    });

    worker.on('error', (err) => {
      logger.error({ queue: worker.name, err }, `[${worker.name}] Worker error`);
    });

    worker.on('completed', (job) => {
      logger.debug({ queue: worker.name, jobId: job.id }, `[${worker.name}] Job completed`);
    });
  }

  return allWorkers;
}

/**
 * Initialize all BullMQ queues and workers.
 * Call this during server startup.
 */
export async function setupQueues(): Promise<void> {
  logger.info('Setting up BullMQ queues and workers...');

  workers = createWorkers();

  logger.info(
    {
      queues: [
        'bet-processing',
        'bet-settlement',
        'reward-calculation',
        'withdrawal-processing',
        'deposit-detection',
        'notification-sender',
        'odds-sync',
      ],
      workerCount: workers.length,
    },
    'BullMQ queues and workers initialized',
  );
}

/**
 * Gracefully close all workers and queues.
 */
export async function closeQueues(): Promise<void> {
  logger.info('Closing BullMQ workers and queues...');

  // Close workers first
  await Promise.all(workers.map((w) => w.close()));

  // Then close queues
  await Promise.all([
    betProcessingQueue.close(),
    betSettlementQueue.close(),
    rewardCalculationQueue.close(),
    withdrawalProcessingQueue.close(),
    depositDetectionQueue.close(),
    notificationSenderQueue.close(),
    oddsSyncQueue.close(),
  ]);

  logger.info('All BullMQ workers and queues closed');
}

export const queues = {
  betProcessing: betProcessingQueue,
  betSettlement: betSettlementQueue,
  rewardCalculation: rewardCalculationQueue,
  withdrawalProcessing: withdrawalProcessingQueue,
  depositDetection: depositDetectionQueue,
  notificationSender: notificationSenderQueue,
  oddsSync: oddsSyncQueue,
};

export default queues;
