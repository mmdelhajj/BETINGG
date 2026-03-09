import { PrismaClient } from '@prisma/client';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';

const p = new PrismaClient();
const redis = new IORedis({ host: '127.0.0.1', port: 6379, maxRetriesPerRequest: null });
const queue = new Queue('bet-settlement', { connection: redis });

async function main() {
  const legs = await p.betLeg.findMany({
    where: { status: 'PENDING' },
    select: {
      selection: {
        select: {
          market: {
            select: {
              event: { select: { id: true, name: true, status: true, scores: true } }
            }
          }
        }
      }
    },
  });

  const eventMap = new Map<string, { name: string; scores: any }>();
  for (const l of legs) {
    const ev = l.selection.market.event;
    if (ev.status === 'ENDED' && !eventMap.has(ev.id)) {
      eventMap.set(ev.id, { name: ev.name, scores: ev.scores });
    }
  }

  console.log(`Queueing settlement for ${eventMap.size} ENDED events with pending bets`);

  for (const [id, data] of eventMap) {
    await queue.add('auto-settle-event', {
      eventId: id,
      eventName: data.name,
      score: data.scores,
      source: 'force-settle-script',
    }, {
      jobId: `force-${id}-${Date.now()}`,
    });
    console.log(`Queued: ${data.name}`);
  }

  await p.$disconnect();
  await queue.close();
  await redis.quit();
  process.exit(0);
}
main();
