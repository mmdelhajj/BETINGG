import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // Create eSoccer sport if it doesn't exist
  const esoccer = await prisma.sport.upsert({
    where: { slug: 'esoccer' },
    update: {},
    create: {
      name: 'eSoccer',
      slug: 'esoccer',
      icon: '🎮',
      isActive: true,
      sortOrder: 36,
    },
  });
  console.log('eSoccer sport:', esoccer.id);

  // Create eBasketball sport if it doesn't exist
  const ebasketball = await prisma.sport.upsert({
    where: { slug: 'ebasketball' },
    update: {},
    create: {
      name: 'eBasketball',
      slug: 'ebasketball',
      icon: '🎮',
      isActive: true,
      sortOrder: 37,
    },
  });
  console.log('eBasketball sport:', ebasketball.id);

  // Now reassign existing eSoccer events from football to esoccer
  // Find competitions that are eSoccer
  const esoccerComps = await prisma.competition.findMany({
    where: {
      OR: [
        { name: { contains: 'Esoccer', mode: 'insensitive' } },
        { name: { contains: 'e-soccer', mode: 'insensitive' } },
        { name: { contains: 'Volta', mode: 'insensitive' } },
        { name: { contains: 'Battle', mode: 'insensitive' } },
        { name: { contains: 'GT Leagues', mode: 'insensitive' } },
        { name: { contains: 'GT Nations', mode: 'insensitive' } },
        { name: { contains: 'H2H GG', mode: 'insensitive' } },
        { name: { contains: 'Adriatic League', mode: 'insensitive' } },
        { name: { contains: 'eAdriatic', mode: 'insensitive' } },
      ],
    },
  });

  console.log(`Found ${esoccerComps.length} eSoccer competitions to reassign`);

  for (const comp of esoccerComps) {
    await prisma.competition.update({
      where: { id: comp.id },
      data: { sportId: esoccer.id },
    });
    console.log(`  Reassigned: ${comp.name}`);
  }

  // Find eBasketball competitions
  const ebasketballComps = await prisma.competition.findMany({
    where: {
      OR: [
        { name: { contains: 'Ebasketball', mode: 'insensitive' } },
        { name: { contains: 'e-basketball', mode: 'insensitive' } },
      ],
    },
  });

  console.log(`Found ${ebasketballComps.length} eBasketball competitions to reassign`);

  for (const comp of ebasketballComps) {
    await prisma.competition.update({
      where: { id: comp.id },
      data: { sportId: ebasketball.id },
    });
    console.log(`  Reassigned: ${comp.name}`);
  }

  console.log('Done!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
