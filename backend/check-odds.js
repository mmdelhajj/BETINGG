const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  // Find football live events and check their odds
  const events = await prisma.event.findMany({
    where: { status: 'LIVE', competition: { sport: { slug: 'football' } } },
    take: 5,
    include: {
      markets: {
        where: { type: 'MONEYLINE' },
        include: { selections: true },
      },
    },
    orderBy: { startTime: 'asc' },
  });

  for (const e of events) {
    const scores = e.scores || {};
    const meta = e.metadata || {};
    const market = e.markets[0];
    const sels = market ? market.selections : [];
    const oddsMap = {};
    for (const s of sels) oddsMap[s.outcome] = parseFloat(s.odds.toString());

    console.log('---');
    console.log('Event:', e.homeTeam, scores.home, '-', scores.away, e.awayTeam);
    console.log('Elapsed:', meta.elapsed, 'Status:', meta.statusShort);
    console.log('Has preMatchOdds:', meta.preMatchOdds ? 'YES' : 'NO');
    if (meta.preMatchOdds) console.log('Pre-match:', JSON.stringify(meta.preMatchOdds));
    console.log('Current odds:', JSON.stringify(oddsMap));
  }

  // Also check basketball
  const bball = await prisma.event.findMany({
    where: { status: 'LIVE', competition: { sport: { slug: 'basketball' } } },
    take: 3,
    include: {
      markets: { where: { type: 'MONEYLINE' }, include: { selections: true } },
    },
  });

  console.log('\n=== BASKETBALL ===');
  for (const e of bball) {
    const scores = e.scores || {};
    const meta = e.metadata || {};
    const market = e.markets[0];
    const sels = market ? market.selections : [];
    const oddsMap = {};
    for (const s of sels) oddsMap[s.outcome] = parseFloat(s.odds.toString());
    console.log('---');
    console.log('Event:', e.homeTeam, scores.home, '-', scores.away, e.awayTeam);
    console.log('Status:', meta.statusShort, 'Has preMatchOdds:', meta.preMatchOdds ? 'YES' : 'NO');
    console.log('Current odds:', JSON.stringify(oddsMap));
  }

  await prisma.$disconnect();
})();
