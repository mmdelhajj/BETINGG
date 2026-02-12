import { Queue, Worker, Job } from 'bullmq';
import { queueConfig, QUEUE_NAMES } from '../config';

const queues: Record<string, Queue> = {};
const workers: Record<string, Worker> = {};

export function getQueue(name: string): Queue {
  if (!queues[name]) {
    queues[name] = new Queue(name, {
      connection: queueConfig.connection,
      defaultJobOptions: queueConfig.defaultJobOptions,
    });
  }
  return queues[name];
}

export function createWorker(
  name: string,
  processor: (job: Job) => Promise<void>,
  concurrency = 1
): Worker {
  const worker = new Worker(name, processor, {
    connection: queueConfig.connection,
    concurrency,
  });

  worker.on('failed', (job, err) => {
    console.error(`Job ${job?.id} in queue ${name} failed:`, err.message);
  });

  worker.on('completed', (job) => {
    console.log(`Job ${job.id} in queue ${name} completed`);
  });

  workers[name] = worker;
  return worker;
}

// Initialize all queues
export function initQueues(): void {
  Object.values(QUEUE_NAMES).forEach((name) => {
    getQueue(name);
  });
  console.log('All BullMQ queues initialized');
}

// Queue helper functions
export async function addBetProcessingJob(data: Record<string, unknown>): Promise<void> {
  await getQueue(QUEUE_NAMES.BET_PROCESSING).add('process-bet', data, { priority: 1 });
}

export async function addBetSettlementJob(data: Record<string, unknown>): Promise<void> {
  await getQueue(QUEUE_NAMES.BET_SETTLEMENT).add('settle-bet', data, { priority: 1 });
}

export async function addRewardCalculationJob(data: Record<string, unknown>): Promise<void> {
  await getQueue(QUEUE_NAMES.REWARD_CALCULATION).add('calculate-reward', data);
}

export async function addWithdrawalProcessingJob(data: Record<string, unknown>): Promise<void> {
  await getQueue(QUEUE_NAMES.WITHDRAWAL_PROCESSING).add('process-withdrawal', data, {
    priority: 1,
    attempts: 5,
  });
}

export const addWithdrawalJob = addWithdrawalProcessingJob;

export async function addDepositDetectionJob(data: Record<string, unknown>): Promise<void> {
  await getQueue(QUEUE_NAMES.DEPOSIT_DETECTION).add('detect-deposit', data);
}

export async function addNotificationJob(data: Record<string, unknown>): Promise<void> {
  await getQueue(QUEUE_NAMES.NOTIFICATION_SENDER).add('send-notification', data);
}

export async function closeQueues(): Promise<void> {
  for (const worker of Object.values(workers)) {
    await worker.close();
  }
  for (const queue of Object.values(queues)) {
    await queue.close();
  }
}
