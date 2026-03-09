import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const events = await prisma.event.findMany({
    where: { status: 'LIVE' },
    select: {
      id: true,
      homeTeam: true,
      awayTeam: true,
      externalId: true,
      name: true,
      updatedAt: true,
      startTime: true,
      competition: { select: { name: true, sport: { select: { slug: true } } } },
    },
    orderBy: { updatedAt: 'desc' },
  });

  console.log('Total LIVE events:', events.length);

  // Check for duplicates
  const seen = new Map<string, typeof events>();
  for (const e of events) {
    const key = e.externalId || e.id;
    if (!seen.has(key)) seen.set(key, []);
    seen.get(key)!.push(e);
  }

  const dupes = [...seen.entries()].filter(([, v]) => v.length > 1);
  console.log('Duplicate betsapiIds:', dupes.length);
  for (const [id, evts] of dupes) {
    console.log(`  externalId=${id}: ${evts.length} copies - ${evts[0].homeTeam} vs ${evts[0].awayTeam}`);
  }

  // Show by competition
  const byComp = new Map<string, number>();
  for (const e of events) {
    const comp = e.competition?.name || 'Unknown';
    byComp.set(comp, (byComp.get(comp) || 0) + 1);
  }
  console.log('\nEvents by competition:');
  for (const [comp, count] of [...byComp.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${comp}: ${count}`);
  }

  // Show events with age
  const now = Date.now();
  console.log('\nAll live events with age:');
  for (const e of events) {
    const ageMins = Math.round((now - new Date(e.updatedAt).getTime()) / 60000);
    const sport = e.competition?.sport?.slug || '?';
    const comp = e.competition?.name || '?';
    console.log(`  [${ageMins}m] [${sport}] ${comp} | ${e.homeTeam} vs ${e.awayTeam} | ext=${e.externalId}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
