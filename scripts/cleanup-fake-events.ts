/**
 * Cleanup script: Remove seeded fake events from the database.
 *
 * Fake events from seed.ts have NO `metadata.externalId` field.
 * Real events synced from The Odds API always store
 * `{ externalId: "...", sportKey: "...", lastSyncedAt: "..." }` in the metadata JSON column.
 *
 * This script deletes:
 *  - Events where metadata IS NULL (seeded events created without metadata)
 *  - Events where metadata does NOT contain an externalId key
 *
 * It cascades the deletion to related Markets, Selections, EventStreams.
 * It also handles BetLegs/Bets that may reference selections on those events.
 *
 * Usage:
 *   cd /root/cryptobet && npx tsx scripts/cleanup-fake-events.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== Cleanup: Removing fake seeded events ===\n');

  // Step 1: Find all events that are NOT from The Odds API.
  // Real API events have metadata JSON with an "externalId" key.
  // Seeded events have either null metadata or metadata without externalId.

  const allEvents = await prisma.event.findMany({
    select: {
      id: true,
      name: true,
      status: true,
      isLive: true,
      metadata: true,
      homeScore: true,
      awayScore: true,
    },
  });

  const fakeEventIds: string[] = [];
  const realEventIds: string[] = [];

  for (const event of allEvents) {
    const metadata = event.metadata as Record<string, unknown> | null;
    const hasExternalId = metadata && typeof metadata === 'object' && 'externalId' in metadata && metadata.externalId;

    if (hasExternalId) {
      realEventIds.push(event.id);
    } else {
      fakeEventIds.push(event.id);
      console.log(
        `  [FAKE] ${event.name} | status=${event.status} isLive=${event.isLive} ` +
        `score=${event.homeScore ?? '-'} - ${event.awayScore ?? '-'}`
      );
    }
  }

  console.log(`\nFound ${fakeEventIds.length} fake event(s) to remove.`);
  console.log(`Found ${realEventIds.length} real Odds API event(s) to preserve.\n`);

  if (fakeEventIds.length === 0) {
    console.log('Nothing to clean up. Exiting.');
    return;
  }

  // Step 2: Delete BetLegs that reference selections on fake events,
  // then delete orphaned Bets.
  const affectedSelections = await prisma.selection.findMany({
    where: { market: { eventId: { in: fakeEventIds } } },
    select: { id: true },
  });
  const affectedSelectionIds = affectedSelections.map((s) => s.id);

  if (affectedSelectionIds.length > 0) {
    // Find bets that have legs referencing these selections
    const affectedBetLegs = await prisma.betLeg.findMany({
      where: { selectionId: { in: affectedSelectionIds } },
      select: { id: true, betId: true },
    });

    if (affectedBetLegs.length > 0) {
      const affectedBetIds = [...new Set(affectedBetLegs.map((bl) => bl.betId))];

      // Delete bet legs first
      const deletedBetLegs = await prisma.betLeg.deleteMany({
        where: { selectionId: { in: affectedSelectionIds } },
      });
      console.log(`Deleted ${deletedBetLegs.count} bet leg(s) referencing fake events.`);

      // Delete bets that now have zero legs (orphaned by our cleanup)
      for (const betId of affectedBetIds) {
        const remainingLegs = await prisma.betLeg.count({ where: { betId } });
        if (remainingLegs === 0) {
          await prisma.bet.delete({ where: { id: betId } });
        }
      }
      console.log(`Cleaned up orphaned bets.`);
    }
  }

  // Step 3: Delete selections on fake events
  const deletedSelections = await prisma.selection.deleteMany({
    where: { market: { eventId: { in: fakeEventIds } } },
  });
  console.log(`Deleted ${deletedSelections.count} selection(s).`);

  // Step 4: Delete markets on fake events
  const deletedMarkets = await prisma.market.deleteMany({
    where: { eventId: { in: fakeEventIds } },
  });
  console.log(`Deleted ${deletedMarkets.count} market(s).`);

  // Step 5: Delete event streams on fake events
  const deletedStreams = await prisma.eventStream.deleteMany({
    where: { eventId: { in: fakeEventIds } },
  });
  console.log(`Deleted ${deletedStreams.count} event stream(s).`);

  // Step 6: Delete the fake events themselves
  const deletedEvents = await prisma.event.deleteMany({
    where: { id: { in: fakeEventIds } },
  });
  console.log(`Deleted ${deletedEvents.count} fake event(s).`);

  // Step 7: Verify
  const remainingEvents = await prisma.event.count();
  const remainingLive = await prisma.event.count({ where: { isLive: true } });
  console.log(`\n=== Done! ${remainingEvents} event(s) remain in database (${remainingLive} live). ===`);
}

main()
  .catch((e) => {
    console.error('Cleanup error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
