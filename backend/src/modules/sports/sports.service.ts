import { Prisma, type EventStatus, type MarketStatus, type SelectionStatus, type SelectionResult } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { redis } from '../../lib/redis.js';
import { betSettlementQueue } from '../../queues/index.js';
import type {
  CreateSportInput,
  UpdateSportInput,
  CreateCompetitionInput,
  UpdateCompetitionInput,
  CreateEventInput,
  UpdateEventInput,
  CreateMarketInput,
  UpdateMarketInput,
  CreateSelectionInput,
  UpdateSelectionInput,
  EventsQuery,
  SearchEventsQuery,
  CompetitionEventsQuery,
  SettleMarketInput,
} from './sports.schemas.js';

// ---------------------------------------------------------------------------
// Public reads
// ---------------------------------------------------------------------------

/**
 * List all active sports with counts of live events.
 */
export async function getSports() {
  const cacheKey = 'sports:list';
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const sports = await prisma.sport.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    include: {
      _count: {
        select: {
          competitions: { where: { isActive: true } },
        },
      },
    },
  });

  // Get live event counts per sport
  const liveCountsRaw = await prisma.event.groupBy({
    by: ['competitionId'],
    where: { status: 'LIVE', isLive: true },
    _count: { id: true },
  });

  // Map competition -> sport
  const compToSport = new Map<string, string>();
  const competitionIds = liveCountsRaw.map((c) => c.competitionId);
  if (competitionIds.length > 0) {
    const comps = await prisma.competition.findMany({
      where: { id: { in: competitionIds } },
      select: { id: true, sportId: true },
    });
    for (const c of comps) {
      compToSport.set(c.id, c.sportId);
    }
  }

  const sportLiveCounts = new Map<string, number>();
  for (const lc of liveCountsRaw) {
    const sportId = compToSport.get(lc.competitionId);
    if (sportId) {
      sportLiveCounts.set(sportId, (sportLiveCounts.get(sportId) ?? 0) + lc._count.id);
    }
  }

  // Count total upcoming + live events per sport
  const upcomingCountsRaw = await prisma.event.groupBy({
    by: ['competitionId'],
    where: { status: { in: ['UPCOMING', 'LIVE'] } },
    _count: { id: true },
  });

  const sportEventCounts = new Map<string, number>();
  const upcomingCompIds = upcomingCountsRaw.map((c) => c.competitionId);
  if (upcomingCompIds.length > 0) {
    const comps2 = await prisma.competition.findMany({
      where: { id: { in: upcomingCompIds } },
      select: { id: true, sportId: true },
    });
    for (const c of comps2) {
      compToSport.set(c.id, c.sportId);
    }
  }
  for (const uc of upcomingCountsRaw) {
    const sportId = compToSport.get(uc.competitionId);
    if (sportId) {
      sportEventCounts.set(sportId, (sportEventCounts.get(sportId) ?? 0) + uc._count.id);
    }
  }

  const result = sports.map((s) => ({
    id: s.id,
    name: s.name,
    slug: s.slug,
    icon: s.icon,
    isActive: s.isActive,
    sortOrder: s.sortOrder,
    competitionCount: s._count.competitions,
    eventCount: sportEventCounts.get(s.id) ?? 0,
    liveEventCount: sportLiveCounts.get(s.id) ?? 0,
  }));

  await redis.set(cacheKey, JSON.stringify(result), 'EX', 60); // cache 60s
  return result;
}

/**
 * Get a single sport with its competitions.
 */
export async function getSport(slug: string) {
  const sport = await prisma.sport.findUnique({
    where: { slug },
    include: {
      competitions: {
        where: { isActive: true },
        orderBy: { name: 'asc' },
        include: {
          _count: {
            select: {
              events: { where: { status: { in: ['UPCOMING', 'LIVE'] } } },
            },
          },
        },
      },
    },
  });

  if (!sport) return null;

  return {
    id: sport.id,
    name: sport.name,
    slug: sport.slug,
    icon: sport.icon,
    isActive: sport.isActive,
    sortOrder: sport.sortOrder,
    competitions: sport.competitions.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      country: c.country,
      logo: c.logo ?? null,
      eventCount: c._count.events,
    })),
  };
}

/**
 * List competitions for a sport.
 */
export async function getCompetitions(sportSlug: string) {
  const sport = await prisma.sport.findUnique({
    where: { slug: sportSlug },
    select: { id: true },
  });

  if (!sport) return null;

  const competitions = await prisma.competition.findMany({
    where: { sportId: sport.id, isActive: true },
    orderBy: { name: 'asc' },
    include: {
      _count: {
        select: {
          events: { where: { status: { in: ['UPCOMING', 'LIVE'] } } },
        },
      },
    },
  });

  return competitions.map((c) => ({
    id: c.id,
    sportId: c.sportId,
    name: c.name,
    slug: c.slug,
    country: c.country,
    logo: c.logo ?? null,
    eventCount: c._count.events,
  }));
}

/**
 * List events for a specific competition.
 */
export async function getCompetitionEvents(competitionId: string, filters: CompetitionEventsQuery) {
  const { page, limit, status } = filters;

  const where: Prisma.EventWhereInput = {
    competitionId,
    homeTeam: { not: null }, // Exclude outright/special events
    ...(status ? { status: status as EventStatus } : { status: { in: ['UPCOMING', 'LIVE'] } }),
  };

  const [events, total] = await Promise.all([
    prisma.event.findMany({
      where,
      orderBy: { startTime: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        competition: {
          select: { name: true, slug: true, country: true, logo: true, sport: { select: { name: true, slug: true, icon: true } } },
        },
        markets: {
          where: { status: 'OPEN' },
          orderBy: { sortOrder: 'asc' as const },
          take: 5,
          include: {
            selections: {
              where: { status: 'ACTIVE' },
              orderBy: { name: 'asc' },
            },
          },
        },
      },
    }),
    prisma.event.count({ where }),
  ]);

  return {
    events: events.map(formatEventSummary),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * Paginated, filterable event listing.
 */
export async function getEvents(filters: EventsQuery) {
  const { page, limit, sportSlug, status, featured, live, search, competitionId } = filters;

  const where: Prisma.EventWhereInput = {
    homeTeam: { not: null }, // Exclude outright/special events from match listings
  };

  if (status) {
    where.status = status as EventStatus;
  } else {
    // Default to only showing bettable events (exclude ENDED/CANCELLED)
    where.status = { in: ['UPCOMING', 'LIVE'] };
  }
  if (featured) {
    where.isFeatured = true;
  }
  if (live) {
    where.isLive = true;
    where.status = 'LIVE';
  }
  if (competitionId) {
    where.competitionId = competitionId;
  }
  if (sportSlug) {
    where.competition = {
      sport: { slug: sportSlug },
    };
  }
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { homeTeam: { contains: search, mode: 'insensitive' } },
      { awayTeam: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [events, total] = await Promise.all([
    prisma.event.findMany({
      where,
      orderBy: [{ startTime: 'asc' }],
      skip: (page - 1) * limit,
      take: limit,
      include: {
        competition: {
          select: { name: true, slug: true, country: true, logo: true, sport: { select: { name: true, slug: true, icon: true } } },
        },
        markets: {
          where: { status: 'OPEN' },
          orderBy: { sortOrder: 'asc' as const },
          take: 5,
          include: {
            selections: {
              where: { status: 'ACTIVE' },
              orderBy: { name: 'asc' },
            },
          },
        },
      },
    }),
    prisma.event.count({ where }),
  ]);

  return {
    events: events.map(formatEventSummary),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * Get all live events grouped by sport.
 */
export async function getLiveEvents() {
  const cacheKey = 'events:live:grouped';
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const events = await prisma.event.findMany({
    where: { status: 'LIVE', isLive: true, homeTeam: { not: null } },
    orderBy: { startTime: 'asc' },
    include: {
      competition: {
        select: { name: true, slug: true, country: true, logo: true, sport: { select: { id: true, name: true, slug: true, icon: true } } },
      },
      markets: {
        where: { status: 'OPEN' },
        orderBy: { sortOrder: 'asc' as const },
        take: 5,
        include: {
          selections: {
            where: { status: 'ACTIVE' },
            orderBy: { name: 'asc' },
          },
        },
      },
    },
  });

  // Group by sport
  const grouped = new Map<string, { sport: { id: string; name: string; slug: string; icon: string | null }; events: unknown[] }>();

  for (const event of events) {
    const sport = event.competition.sport;
    if (!grouped.has(sport.id)) {
      grouped.set(sport.id, {
        sport: { id: sport.id, name: sport.name, slug: sport.slug, icon: sport.icon },
        events: [],
      });
    }
    grouped.get(sport.id)!.events.push(formatEventSummary(event));
  }

  const result = Array.from(grouped.values());

  await redis.set(cacheKey, JSON.stringify(result), 'EX', 5); // 5s cache for live data
  return result;
}

/**
 * Featured events with main market odds.
 * Falls back to next upcoming events with markets if no featured events exist.
 */
export async function getFeaturedEvents() {
  const cacheKey = 'events:featured';
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached);

  // First try featured events
  let events = await prisma.event.findMany({
    where: {
      isFeatured: true,
      status: { in: ['UPCOMING', 'LIVE'] },
      homeTeam: { not: null },
    },
    orderBy: { startTime: 'asc' },
    take: 20,
    include: {
      competition: {
        select: { name: true, slug: true, country: true, logo: true, sport: { select: { name: true, slug: true, icon: true } } },
      },
      markets: {
        where: { status: 'OPEN' },
        orderBy: { sortOrder: 'asc' as const },
        take: 5,
        include: {
          selections: {
            where: { status: 'ACTIVE' },
            orderBy: { name: 'asc' },
          },
        },
      },
    },
  });

  // If no featured events, get next upcoming events with markets
  if (events.length === 0) {
    events = await prisma.event.findMany({
      where: {
        status: { in: ['UPCOMING', 'LIVE'] },
        homeTeam: { not: null },
        markets: { some: { status: 'OPEN' } },
      },
      orderBy: { startTime: 'asc' },
      take: 12,
      include: {
        competition: {
          select: { name: true, slug: true, country: true, logo: true, sport: { select: { name: true, slug: true, icon: true } } },
        },
        markets: {
          where: { status: 'OPEN' },
          orderBy: { sortOrder: 'asc' as const },
          take: 5,
          include: {
            selections: {
              where: { status: 'ACTIVE' },
              orderBy: { name: 'asc' },
            },
          },
        },
      },
    });
  }

  const result = events.map(formatEventSummary);

  await redis.set(cacheKey, JSON.stringify(result), 'EX', 30);
  return result;
}

/**
 * Full event detail with all markets and selections.
 */
export async function getEvent(id: string) {
  const event = await prisma.event.findUnique({
    where: { id },
    include: {
      competition: {
        select: {
          id: true,
          name: true,
          slug: true,
          country: true,
          logo: true,
          sport: { select: { id: true, name: true, slug: true, icon: true } },
        },
      },
      markets: {
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        include: {
          selections: {
            where: { status: 'ACTIVE' },
            orderBy: [{ name: 'asc' }],
          },
        },
      },
    },
  });

  if (!event) return null;

  return {
    id: event.id,
    name: event.name,
    homeTeam: event.homeTeam,
    awayTeam: event.awayTeam,
    homeTeamLogo: event.homeTeamLogo,
    awayTeamLogo: event.awayTeamLogo,
    homeTeamCountry: (event.metadata as Record<string, unknown> | null)?.homeTeamCountry ?? null,
    awayTeamCountry: (event.metadata as Record<string, unknown> | null)?.awayTeamCountry ?? null,
    startTime: event.startTime.toISOString(),
    status: event.status,
    scores: event.scores,
    metadata: event.metadata,
    isLive: event.isLive,
    isFeatured: event.isFeatured,
    streamUrl: event.streamUrl,
    createdAt: event.createdAt.toISOString(),
    updatedAt: event.updatedAt.toISOString(),
    competition: {
      id: event.competition.id,
      name: event.competition.name,
      slug: event.competition.slug,
      country: event.competition.country,
      logo: event.competition.logo ?? null,
    },
    sport: {
      id: event.competition.sport.id,
      name: event.competition.sport.name,
      slug: event.competition.sport.slug,
      icon: event.competition.sport.icon,
    },
    markets: event.markets.map((m) => ({
      id: m.id,
      name: m.name,
      marketKey: m.marketKey,
      type: m.type,
      period: m.period,
      status: m.status,
      sortOrder: m.sortOrder,
      selections: m.selections.map((s) => ({
        id: s.id,
        name: s.name,
        outcome: s.outcome,
        odds: s.odds.toString(),
        probability: s.probability?.toString() ?? null,
        maxStake: s.maxStake?.toString() ?? null,
        handicap: s.handicap?.toString() ?? null,
        params: s.params,
        status: s.status,
        result: s.result,
      })),
    })),
    marketCount: event.markets.length,
  };
}

/**
 * Get all markets for an event.
 */
export async function getMarkets(eventId: string) {
  const markets = await prisma.market.findMany({
    where: { eventId },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    include: {
      selections: {
        where: { status: 'ACTIVE' },
        orderBy: [{ name: 'asc' }],
      },
    },
  });

  return markets.map((m) => ({
    id: m.id,
    eventId: m.eventId,
    name: m.name,
    marketKey: m.marketKey,
    type: m.type,
    period: m.period,
    status: m.status,
    sortOrder: m.sortOrder,
    selections: m.selections.map((s) => ({
      id: s.id,
      name: s.name,
      outcome: s.outcome,
      odds: s.odds.toString(),
      probability: s.probability?.toString() ?? null,
      maxStake: s.maxStake?.toString() ?? null,
      handicap: s.handicap?.toString() ?? null,
      params: s.params,
      status: s.status,
      result: s.result,
    })),
  }));
}

/**
 * Search events by name, homeTeam, awayTeam.
 */
export async function searchEvents(query: SearchEventsQuery) {
  const { q, page, limit } = query;

  const where: Prisma.EventWhereInput = {
    status: { in: ['UPCOMING', 'LIVE'] },
    OR: [
      { name: { contains: q, mode: 'insensitive' } },
      { homeTeam: { contains: q, mode: 'insensitive' } },
      { awayTeam: { contains: q, mode: 'insensitive' } },
    ],
  };

  const [events, total] = await Promise.all([
    prisma.event.findMany({
      where,
      orderBy: { startTime: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        competition: {
          select: { name: true, slug: true, country: true, logo: true, sport: { select: { name: true, slug: true, icon: true } } },
        },
        markets: {
          where: { status: 'OPEN' },
          orderBy: { sortOrder: 'asc' as const },
          take: 5,
          include: {
            selections: {
              where: { status: 'ACTIVE' },
              orderBy: { name: 'asc' },
            },
          },
        },
      },
    }),
    prisma.event.count({ where }),
  ]);

  return {
    events: events.map(formatEventSummary),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * Get popular competitions ordered by event count (upcoming + live events).
 * Returns top 10 competitions with their sport info.
 */
export async function getPopularCompetitions() {
  const cacheKey = 'competitions:popular';
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const competitions = await prisma.competition.findMany({
    where: { isActive: true },
    include: {
      sport: {
        select: { id: true, name: true, slug: true, icon: true },
      },
      _count: {
        select: {
          events: { where: { status: { in: ['UPCOMING', 'LIVE'] } } },
        },
      },
    },
  });

  // Sort by event count descending and take top 10
  const sorted = competitions
    .map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      country: c.country,
      logo: c.logo ?? null,
      eventCount: c._count.events,
      sport: {
        id: c.sport.id,
        name: c.sport.name,
        slug: c.sport.slug,
        icon: c.sport.icon,
      },
    }))
    .sort((a, b) => b.eventCount - a.eventCount)
    .slice(0, 10);

  await redis.set(cacheKey, JSON.stringify(sorted), 'EX', 60);
  return sorted;
}

/**
 * List competitions for a sport, including upcoming events per competition.
 */
export async function getCompetitionsWithEvents(sportSlug: string) {
  // Cache for 10 seconds (live data changes frequently but this is a heavy query)
  const cacheKey = `competitions:${sportSlug}`;
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const sport = await prisma.sport.findUnique({
    where: { slug: sportSlug },
    select: { id: true },
  });

  if (!sport) return null;

  const competitions = await prisma.competition.findMany({
    where: { sportId: sport.id, isActive: true },
    orderBy: { name: 'asc' },
    include: {
      _count: {
        select: {
          events: { where: { status: { in: ['UPCOMING', 'LIVE'] } } },
        },
      },
      events: {
        where: {
          status: { in: ['UPCOMING', 'LIVE', 'ENDED'] },
          homeTeam: { not: null }, // Exclude outright/special events — they have their own tab
          startTime: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // include events from past 24h (live/ended)
          },
        },
        orderBy: { startTime: 'asc' },
        take: 50,
        include: {
          competition: {
            select: { name: true, slug: true, country: true, logo: true, sport: { select: { name: true, slug: true, icon: true } } },
          },
          markets: {
            where: { status: 'OPEN' },
            orderBy: { sortOrder: 'asc' },
            take: 5,
            include: {
              selections: {
                where: { status: 'ACTIVE' },
                orderBy: { name: 'asc' },
              },
            },
          },
        },
      },
    },
  });

  const result = competitions
    .map((c) => {
      // Format events and filter out those without any odds
      const formattedEvents = c.events
        .map(formatEventSummary)
        .filter((e) => e.mainMarket !== null || e.status === 'ENDED' || e.isLive);
      return {
        id: c.id,
        sportId: c.sportId,
        name: c.name,
        slug: c.slug,
        country: c.country,
        logo: c.logo ?? null,
        eventCount: c._count.events,
        events: formattedEvents,
      };
    })
    .filter((c) => c.events.length > 0 || c.eventCount > 0);

  // Cache for 10 seconds (live data, but heavy query)
  await redis.set(cacheKey, JSON.stringify(result), 'EX', 10);
  return result;
}


/**
 * List finished (ENDED) events for a sport, grouped by competition.
 * Returns events from the last 3 days with final scores.
 */
export async function getResultsWithEvents(sportSlug: string) {
  const cacheKey = `results:${sportSlug}`;
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const sport = await prisma.sport.findUnique({
    where: { slug: sportSlug },
    select: { id: true },
  });

  if (!sport) return null;

  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

  const competitions = await prisma.competition.findMany({
    where: {
      sportId: sport.id,
      isActive: true,
      events: {
        some: {
          status: 'ENDED',
          startTime: { gte: threeDaysAgo },
        },
      },
    },
    orderBy: { name: 'asc' },
    include: {
      events: {
        where: {
          status: 'ENDED',
          startTime: { gte: threeDaysAgo },
        },
        orderBy: { startTime: 'desc' },
        take: 50,
        include: {
          competition: {
            select: {
              name: true,
              slug: true,
              country: true,
              logo: true,
              sport: { select: { name: true, slug: true, icon: true } },
            },
          },
          markets: {
            where: { status: 'OPEN' },
            orderBy: { sortOrder: 'asc' as const },
            take: 3,
            include: {
              selections: {
                where: { status: 'ACTIVE' },
                orderBy: { name: 'asc' },
              },
            },
          },
        },
      },
    },
  });

  const result = competitions
    .map((c) => ({
      id: c.id,
      sportId: c.sportId,
      name: c.name,
      slug: c.slug,
      country: c.country,
      logo: c.logo ?? null,
      eventCount: c.events.length,
      events: c.events.map(formatEventSummary),
    }))
    .filter((c) => c.events.length > 0)
    .sort((a, b) => b.eventCount - a.eventCount);

  await redis.set(cacheKey, JSON.stringify(result), 'EX', 120);
  return result;
}

// ---------------------------------------------------------------------------
// Outrights
// ---------------------------------------------------------------------------

/**
 * Get outright / futures markets for a sport, grouped by competition.
 * First attempts to read OUTRIGHT markets from the database.
 * If none exist, falls back to the generated definitions from betsapi service.
 * Results are cached in Redis for 5 minutes.
 */
export async function getOutrightsBySport(sportSlug: string) {
  const cacheKey = `outrights:${sportSlug}`;
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached);

  // Validate sport exists
  const sport = await prisma.sport.findUnique({
    where: { slug: sportSlug },
    select: { id: true, name: true, slug: true, icon: true },
  });

  if (!sport) return null;

  // Query OUTRIGHT markets for events belonging to this sport
  const outrightMarkets = await prisma.market.findMany({
    where: {
      type: 'OUTRIGHT',
      status: 'OPEN',
      event: {
        competition: { sportId: sport.id },
        status: { in: ['UPCOMING', 'LIVE'] },
      },
    },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    include: {
      selections: {
        where: { status: 'ACTIVE' },
        orderBy: { odds: 'asc' },
      },
      event: {
        select: {
          id: true,
          name: true,
          competition: {
            select: {
              id: true,
              name: true,
              slug: true,
              country: true,
              logo: true,
            },
          },
        },
      },
    },
  });

  // If we found DB-backed outright markets, group them by competition
  if (outrightMarkets.length > 0) {
    const grouped = new Map<
      string,
      {
        competition: {
          id: string;
          name: string;
          slug: string;
          country: string | null;
          logo: string | null;
        };
        markets: Array<{
          id: string;
          name: string;
          marketKey: string;
          eventId: string;
          eventName: string;
          selections: Array<{
            id: string;
            name: string;
            outcome: string;
            odds: string;
          }>;
        }>;
      }
    >();

    for (const mkt of outrightMarkets) {
      const comp = mkt.event.competition;
      if (!grouped.has(comp.id)) {
        grouped.set(comp.id, {
          competition: {
            id: comp.id,
            name: comp.name,
            slug: comp.slug,
            country: comp.country,
            logo: comp.logo ?? null,
          },
          markets: [],
        });
      }

      grouped.get(comp.id)!.markets.push({
        id: mkt.id,
        name: mkt.name,
        marketKey: mkt.marketKey,
        eventId: mkt.event.id,
        eventName: mkt.event.name,
        selections: mkt.selections.map((s) => ({
          id: s.id,
          name: s.name,
          outcome: s.outcome,
          odds: s.odds.toString(),
        })),
      });
    }

    const result = {
      sport: {
        id: sport.id,
        name: sport.name,
        slug: sport.slug,
        icon: sport.icon,
      },
      competitions: Array.from(grouped.values()),
    };

    await redis.set(cacheKey, JSON.stringify(result), 'EX', 300); // 5-minute cache
    return result;
  }

  // Fallback: generate from seed data (no DB persistence here — just return definitions)
  const { generateOutrightMarkets } = await import('../../services/betsapi.js');
  const defs = generateOutrightMarkets(sportSlug);

  if (defs.length === 0) {
    const emptyResult = {
      sport: {
        id: sport.id,
        name: sport.name,
        slug: sport.slug,
        icon: sport.icon,
      },
      competitions: [],
    };
    await redis.set(cacheKey, JSON.stringify(emptyResult), 'EX', 300);
    return emptyResult;
  }

  // Group generated definitions by competition
  const genGrouped = new Map<
    string,
    {
      competition: {
        id: string;
        name: string;
        slug: string;
        country: string | null;
        logo: string | null;
      };
      markets: Array<{
        id: string;
        name: string;
        marketKey: string;
        eventId: string;
        eventName: string;
        selections: Array<{
          id: string;
          name: string;
          outcome: string;
          odds: string;
        }>;
      }>;
    }
  >();

  for (const def of defs) {
    if (!genGrouped.has(def.competitionSlug)) {
      genGrouped.set(def.competitionSlug, {
        competition: {
          id: `gen-${def.competitionSlug}`,
          name: def.competitionName,
          slug: def.competitionSlug,
          country: null,
          logo: null,
        },
        markets: [],
      });
    }

    genGrouped.get(def.competitionSlug)!.markets.push({
      id: `gen-${def.marketKey}-${def.competitionSlug}`,
      name: def.marketName,
      marketKey: def.marketKey,
      eventId: `gen-event-${def.competitionSlug}`,
      eventName: `${def.competitionName} - Outrights`,
      selections: def.selections.map((sel, idx) => ({
        id: `gen-sel-${def.competitionSlug}-${def.marketKey}-${idx}`,
        name: sel.name,
        outcome: sel.name,
        odds: sel.odds.toFixed(2),
      })),
    });
  }

  const fallbackResult = {
    sport: {
      id: sport.id,
      name: sport.name,
      slug: sport.slug,
      icon: sport.icon,
    },
    competitions: Array.from(genGrouped.values()),
  };

  await redis.set(cacheKey, JSON.stringify(fallbackResult), 'EX', 300); // 5-minute cache
  return fallbackResult;
}

// ---------------------------------------------------------------------------
// Admin CRUD
// ---------------------------------------------------------------------------

export async function adminCreateSport(data: CreateSportInput) {
  const sport = await prisma.sport.create({ data });
  await redis.del('sports:list');
  return sport;
}

export async function adminUpdateSport(id: string, data: UpdateSportInput) {
  const sport = await prisma.sport.update({ where: { id }, data });
  await redis.del('sports:list');
  return sport;
}

export async function adminCreateCompetition(data: CreateCompetitionInput) {
  const competition = await prisma.competition.create({
    data,
    include: { sport: { select: { name: true, slug: true } } },
  });
  await redis.del('sports:list');
  return competition;
}

export async function adminUpdateCompetition(id: string, data: UpdateCompetitionInput) {
  const competition = await prisma.competition.update({
    where: { id },
    data,
    include: { sport: { select: { name: true, slug: true } } },
  });
  await redis.del('sports:list');
  return competition;
}

export async function adminCreateEvent(data: CreateEventInput) {
  const event = await prisma.event.create({
    data: {
      competitionId: data.competitionId,
      name: data.name,
      homeTeam: data.homeTeam,
      awayTeam: data.awayTeam,
      startTime: new Date(data.startTime),
      isFeatured: data.isFeatured,
      streamUrl: data.streamUrl,
      metadata: data.metadata ?? Prisma.JsonNull,
    },
    include: {
      competition: {
        select: { name: true, slug: true, sport: { select: { name: true, slug: true } } },
      },
    },
  });
  await invalidateEventCaches();
  return event;
}

export async function adminUpdateEvent(id: string, data: UpdateEventInput) {
  const updateData: Prisma.EventUpdateInput = {};

  if (data.name !== undefined) updateData.name = data.name;
  if (data.homeTeam !== undefined) updateData.homeTeam = data.homeTeam;
  if (data.awayTeam !== undefined) updateData.awayTeam = data.awayTeam;
  if (data.startTime !== undefined) updateData.startTime = new Date(data.startTime);
  if (data.status !== undefined) updateData.status = data.status as EventStatus;
  if (data.scores !== undefined) updateData.scores = data.scores ?? Prisma.JsonNull;
  if (data.metadata !== undefined) updateData.metadata = data.metadata ?? Prisma.JsonNull;
  if (data.isFeatured !== undefined) updateData.isFeatured = data.isFeatured;
  if (data.isLive !== undefined) updateData.isLive = data.isLive;
  if (data.streamUrl !== undefined) updateData.streamUrl = data.streamUrl;

  const event = await prisma.event.update({
    where: { id },
    data: updateData,
    include: {
      competition: {
        select: { name: true, slug: true, sport: { select: { name: true, slug: true } } },
      },
    },
  });
  await invalidateEventCaches();
  return event;
}

export async function adminGoLive(eventId: string) {
  const event = await prisma.event.update({
    where: { id: eventId },
    data: {
      status: 'LIVE',
      isLive: true,
    },
    include: {
      competition: {
        select: { name: true, slug: true, sport: { select: { name: true, slug: true } } },
      },
    },
  });
  await invalidateEventCaches();
  return event;
}

export async function adminEndEvent(eventId: string) {
  // End event and suspend all open markets
  const event = await prisma.$transaction(async (tx) => {
    const updated = await tx.event.update({
      where: { id: eventId },
      data: {
        status: 'ENDED',
        isLive: false,
      },
      include: {
        competition: {
          select: { name: true, slug: true, sport: { select: { name: true, slug: true } } },
        },
      },
    });

    // Suspend any markets still open
    await tx.market.updateMany({
      where: { eventId, status: 'OPEN' },
      data: { status: 'SUSPENDED' },
    });

    return updated;
  });
  await invalidateEventCaches();
  return event;
}

export async function adminCreateMarket(data: CreateMarketInput) {
  const market = await prisma.market.create({
    data,
    include: {
      event: { select: { name: true } },
      selections: true,
    },
  });
  return market;
}

export async function adminUpdateMarket(id: string, data: UpdateMarketInput) {
  const updateData: Prisma.MarketUpdateInput = {};

  if (data.name !== undefined) updateData.name = data.name;
  if (data.marketKey !== undefined) updateData.marketKey = data.marketKey;
  if (data.type !== undefined) updateData.type = data.type;
  if (data.status !== undefined) updateData.status = data.status as MarketStatus;
  if (data.period !== undefined) updateData.period = data.period;
  if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;

  const market = await prisma.market.update({
    where: { id },
    data: updateData,
    include: {
      event: { select: { name: true } },
      selections: true,
    },
  });
  return market;
}

export async function adminCreateSelection(data: CreateSelectionInput) {
  const selection = await prisma.selection.create({
    data: {
      marketId: data.marketId,
      name: data.name,
      outcome: data.outcome,
      odds: new Prisma.Decimal(data.odds),
      probability: data.probability != null ? new Prisma.Decimal(data.probability) : null,
      maxStake: data.maxStake != null ? new Prisma.Decimal(data.maxStake) : null,
      handicap: data.handicap != null ? new Prisma.Decimal(data.handicap) : null,
      params: data.params,
    },
    include: {
      market: { select: { name: true, eventId: true } },
    },
  });
  return selection;
}

export async function adminUpdateSelection(id: string, data: UpdateSelectionInput) {
  const updateData: Prisma.SelectionUpdateInput = {};

  if (data.name !== undefined) updateData.name = data.name;
  if (data.outcome !== undefined) updateData.outcome = data.outcome;
  if (data.odds !== undefined) updateData.odds = new Prisma.Decimal(data.odds);
  if (data.probability !== undefined) {
    updateData.probability = data.probability != null ? new Prisma.Decimal(data.probability) : null;
  }
  if (data.maxStake !== undefined) {
    updateData.maxStake = data.maxStake != null ? new Prisma.Decimal(data.maxStake) : null;
  }
  if (data.handicap !== undefined) {
    updateData.handicap = data.handicap != null ? new Prisma.Decimal(data.handicap) : null;
  }
  if (data.params !== undefined) updateData.params = data.params;
  if (data.status !== undefined) updateData.status = data.status as SelectionStatus;

  const selection = await prisma.selection.update({
    where: { id },
    data: updateData,
    include: {
      market: { select: { name: true, eventId: true } },
    },
  });
  return selection;
}

/**
 * Settle a market: set each selection result, then trigger bet settlement.
 */
export async function settleMarket(marketId: string, input: SettleMarketInput) {
  const market = await prisma.$transaction(async (tx) => {
    // Validate market exists and is not already settled
    const existing = await tx.market.findUniqueOrThrow({
      where: { id: marketId },
      include: { selections: true },
    });

    if (existing.status === 'SETTLED') {
      throw new Error('Market is already settled');
    }

    // Map selectionId -> result
    const resultMap = new Map<string, SelectionResult>();
    for (const r of input.results) {
      resultMap.set(r.selectionId, r.result as SelectionResult);
    }

    // Update each selection
    for (const sel of existing.selections) {
      const result = resultMap.get(sel.id);
      if (result) {
        const selectionStatus: SelectionStatus =
          result === 'WIN'
            ? 'WON'
            : result === 'LOSE'
              ? 'LOST'
              : result === 'VOID'
                ? 'VOID'
                : result === 'PUSH'
                  ? 'PUSH'
                  : result === 'HALF_WIN'
                    ? 'WON'
                    : 'LOST';

        await tx.selection.update({
          where: { id: sel.id },
          data: {
            result: result as SelectionResult,
            status: selectionStatus,
          },
        });
      }
    }

    // Mark market as settled
    const updated = await tx.market.update({
      where: { id: marketId },
      data: { status: 'SETTLED' },
      include: {
        selections: true,
        event: { select: { id: true, name: true } },
      },
    });

    return updated;
  });

  // Dispatch bet settlement job
  await betSettlementQueue.add('settle-market', {
    marketId,
    eventId: market.event.id,
    timestamp: new Date().toISOString(),
  });

  return market;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatEventSummary(event: {
  id: string;
  name: string;
  homeTeam: string | null;
  awayTeam: string | null;
  homeTeamLogo?: string | null;
  awayTeamLogo?: string | null;
  startTime: Date;
  status: string;
  scores: unknown;
  metadata?: unknown;
  isLive: boolean;
  isFeatured: boolean;
  streamUrl: string | null;
  competition: {
    name: string;
    slug: string;
    country?: string | null;
    logo?: string | null;
    sport: { name: string; slug: string; icon?: string | null };
  };
  markets: Array<{
    id: string;
    name: string;
    type: string;
    marketKey: string;
    selections: Array<{
      id: string;
      name: string;
      outcome: string;
      odds: Prisma.Decimal;
      handicap: Prisma.Decimal | null;
      params: string | null;
      status: string;
    }>;
  }>;
}) {
  const sportSlug = event.competition.sport.slug;

  // Helper to format a selection
  const fmtSel = (s: typeof event.markets[0]['selections'][0]) => ({
    id: s.id,
    name: s.name,
    outcome: s.outcome,
    odds: s.odds.toString(),
    handicap: s.handicap?.toString() ?? null,
    params: s.params ?? null,
    status: s.status,
  });

  // Helper to format a market
  const fmtMarket = (m: typeof event.markets[0], overrideSelections?: ReturnType<typeof fmtSel>[]) => ({
    id: m.id,
    name: m.name,
    type: m.type,
    marketKey: m.marketKey,
    selections: overrideSelections ?? m.selections.map(fmtSel),
  });

  // Prefer MONEYLINE market, then first NON-OUTRIGHT market with active selections
  const mainMarket =
    event.markets.find((m) => m.type === 'MONEYLINE' && m.selections.length > 0) ??
    event.markets.find((m) => m.type !== 'OUTRIGHT' && m.selections.length > 0) ??
    null;

  // Build structured markets for sport-specific display (Cloudbet-style)
  // Basketball/Ice Hockey/American Football/Baseball: Spread + Total + MoneyLine columns
  const MULTI_MARKET_SPORTS = new Set([
    'basketball', 'ice-hockey', 'american-football', 'baseball',
    'handball', 'rugby', 'rugby-league',
  ]);

  let spreadMarket = null;
  let totalMarket = null;
  let moneylineMarket = mainMarket ? fmtMarket(mainMarket) : null;

  // Limit and order mainMarket selections: HOME (1), DRAW (X), AWAY (2)
  if (moneylineMarket) {
    const homeOutcome = moneylineMarket.selections.find((s) => s.outcome === 'HOME');
    const drawOutcome = moneylineMarket.selections.find((s) => s.outcome === 'DRAW');
    const awayOutcome = moneylineMarket.selections.find((s) => s.outcome === 'AWAY');
    if (homeOutcome && awayOutcome) {
      moneylineMarket.selections = drawOutcome
        ? [homeOutcome, drawOutcome, awayOutcome]
        : [homeOutcome, awayOutcome];
    } else if (moneylineMarket.selections.length > 3) {
      moneylineMarket.selections = moneylineMarket.selections.slice(0, 3);
    }
  }

  if (MULTI_MARKET_SPORTS.has(sportSlug)) {
    // Find best spread market (full game, not quarter/half)
    const spreadCandidates = event.markets.filter(
      (m) => m.type === 'SPREAD' && m.selections.length >= 2
    );
    const fullGameSpread = spreadCandidates.find((m) => {
      const lk = m.marketKey.toLowerCase();
      return (lk.includes('handicap') || lk.includes('spread')) &&
        !lk.includes('quarter') && !lk.includes('period') &&
        !lk.includes('half') && !lk.includes('corner') && !lk.includes('booking');
    }) ?? spreadCandidates[0];
    if (fullGameSpread) {
      // Group selections by their params handicap value to find the PRIMARY line
      const byLine = new Map<string, typeof fullGameSpread.selections>();
      for (const s of fullGameSpread.selections) {
        const hMatch = s.params?.match(/handicap=(-?[\d.]+)/);
        const key = hMatch ? hMatch[1] : (s.handicap?.toString() ?? '0');
        if (!byLine.has(key)) byLine.set(key, []);
        byLine.get(key)!.push(s);
      }
      // Pick the line closest to even money (both sides near 1.90)
      let bestLine: typeof fullGameSpread.selections = [];
      let bestScore = Infinity;
      for (const [, sels] of byLine) {
        if (sels.length === 2) {
          const o1 = parseFloat(sels[0].odds.toString());
          const o2 = parseFloat(sels[1].odds.toString());
          // Score = how far both odds are from 1.90 (ideal balanced line)
          const score = Math.abs(o1 - 1.90) + Math.abs(o2 - 1.90);
          if (score < bestScore) {
            bestScore = score;
            bestLine = sels;
          }
        }
      }
      if (bestLine.length === 0) {
        // Fallback: take first 2 selections
        bestLine = fullGameSpread.selections.slice(0, 2);
      }
      // Format the primary line selections with proper handicap values
      // params has the line value (e.g., "handicap=-13") for both selections
      // Home gets the raw value (-13), Away gets the opposite (+13)
      const lineParams = bestLine[0]?.params;
      const lineMatch = lineParams?.match(/handicap=(-?[\d.]+)/);
      const lineVal = lineMatch ? parseFloat(lineMatch[1]) : null;
      const primarySels = bestLine.map((s) => {
        const sel = fmtSel(s);
        if (lineVal !== null) {
          if (s.outcome === 'home' || s.name === '1') {
            sel.handicap = (lineVal >= 0 ? '+' : '') + lineVal.toString();
          } else {
            const opp = lineVal * -1;
            sel.handicap = (opp >= 0 ? '+' : '') + opp.toString();
          }
        }
        return sel;
      });
      spreadMarket = fmtMarket(fullGameSpread, primarySels);
    }

    // Find best total market (full game over/under)
    const totalCandidates = event.markets.filter(
      (m) => m.type === 'TOTAL' && m.selections.length >= 2
    );
    const fullGameTotal = totalCandidates.find((m) => {
      const lk = m.marketKey.toLowerCase();
      return !lk.includes('quarter') && !lk.includes('period') &&
        !lk.includes('half') && !lk.includes('team') &&
        !lk.includes('corner') && !lk.includes('booking') &&
        !lk.includes('exact');
    }) ?? totalCandidates[0];
    if (fullGameTotal) {
      // Group over/under pairs by their total line value
      const overSels = fullGameTotal.selections.filter((s) =>
        s.name.toLowerCase().startsWith('over')
      );
      const underSels = fullGameTotal.selections.filter((s) =>
        s.name.toLowerCase().startsWith('under')
      );
      // Find the primary line: the over/under pair closest to even money
      let bestOver = overSels[0];
      let bestUnder = underSels[0];
      let bestScore = Infinity;
      for (const ov of overSels) {
        const lineMatch = ov.name.match(/([\d.]+)/);
        if (!lineMatch) continue;
        const line = lineMatch[1];
        const un = underSels.find((u) => u.name.includes(line));
        if (un) {
          const o1 = parseFloat(ov.odds.toString());
          const o2 = parseFloat(un.odds.toString());
          const score = Math.abs(o1 - 1.90) + Math.abs(o2 - 1.90);
          if (score < bestScore) {
            bestScore = score;
            bestOver = ov;
            bestUnder = un;
          }
        }
      }
      if (bestOver && bestUnder) {
        const lineMatch = bestOver.name.match(/([\d.]+)/);
        const line = lineMatch ? lineMatch[1] : null;
        const primarySels = [bestOver, bestUnder].map((s) => {
          const sel = fmtSel(s);
          if (line) sel.handicap = line;
          return sel;
        });
        totalMarket = fmtMarket(fullGameTotal, primarySels);
      } else {
        totalMarket = fmtMarket(fullGameTotal);
        // Limit to first 2 selections
        totalMarket.selections = totalMarket.selections.slice(0, 2);
      }
    }
  }

  const meta = event.metadata as Record<string, unknown> | null;

  // Derive time and period from metadata for live events
  let time: string | null = null;
  let period: string | null = null;
  if (event.isLive) {
    const timer = (meta?.timer ?? null) as { q?: string | number; tm?: string | number; ts?: string | number; ta?: string | number; tt?: string | number } | null;
    const statusShort = (meta?.statusShort as string) || '';
    const elapsed = meta?.elapsed as number | undefined;

    // If we have BetsAPI timer data, use it precisely
    if (timer?.tm != null || timer?.q != null) {
      if (sportSlug === 'football' || sportSlug === 'soccer') {
        if (statusShort === 'HT') { time = 'HT'; period = 'Half Time'; }
        else if (statusShort === 'FT') { time = 'FT'; period = 'Full Time'; }
        else {
          const tm = parseInt(String(timer.tm), 10) || 0;
          const ta = timer.ta != null ? parseInt(String(timer.ta), 10) : 0;
          if (tm >= 90 && ta > 0) time = `90+${ta}'`;
          else if (tm >= 45 && tm < 46 && ta > 0) time = `45+${ta}'`;
          else time = `${tm}'`;
          period = statusShort === '1H' ? '1st Half' : statusShort === '2H' ? '2nd Half' : statusShort === 'ET' ? 'Extra Time' : null;
        }
      } else if (sportSlug === 'basketball') {
        const q = timer.q != null ? parseInt(String(timer.q), 10) : null;
        const tm = parseInt(String(timer.tm), 10) || 0;
        const ts = parseInt(String(timer.ts), 10) || 0;
        const label = q != null ? (q <= 4 ? `Q${q}` : 'OT') : 'LIVE';
        time = `${label} ${tm}:${String(ts).padStart(2, '0')}`;
        period = q != null ? (q <= 4 ? `Quarter ${q}` : 'Overtime') : null;
      } else if (sportSlug === 'ice-hockey') {
        const p = timer.q != null ? parseInt(String(timer.q), 10) : null;
        const tm = parseInt(String(timer.tm), 10) || 0;
        const ts = parseInt(String(timer.ts), 10) || 0;
        const label = p != null ? (p <= 3 ? `P${p}` : 'OT') : 'LIVE';
        time = `${label} ${tm}:${String(ts).padStart(2, '0')}`;
        period = p != null ? (p <= 3 ? `Period ${p}` : 'Overtime') : null;
      } else if (elapsed) {
        time = `${elapsed}'`;
        period = statusShort || null;
      }
    }
    // Fallback: estimate time from startTime for live events without timer data
    else {
      const elapsedMinutes = Math.floor((Date.now() - event.startTime.getTime()) / 60000);
      if (sportSlug === 'football' || sportSlug === 'soccer') {
        const m = Math.min(elapsedMinutes, 90);
        time = `${m}'`;
        period = m <= 45 ? '1st Half' : '2nd Half';
      } else if (sportSlug === 'basketball') {
        // NBA: 4 x 12min quarters = 48min game, ~2.5h total with breaks
        const quarterLen = 12;
        const breakLen = 5;
        const q = Math.min(Math.floor(elapsedMinutes / (quarterLen + breakLen)) + 1, 4);
        const inQuarterMin = elapsedMinutes % (quarterLen + breakLen);
        const gameMin = Math.min(inQuarterMin, quarterLen);
        time = `Q${q} ${gameMin}:00`;
        period = `Quarter ${q}`;
      } else if (sportSlug === 'ice-hockey') {
        // 3 x 20min periods = 60min game, ~2.5h total with breaks
        const periodLen = 20;
        const breakLen = 10;
        const p = Math.min(Math.floor(elapsedMinutes / (periodLen + breakLen)) + 1, 3);
        const inPeriodMin = elapsedMinutes % (periodLen + breakLen);
        const gameMin = Math.min(inPeriodMin, periodLen);
        time = `P${p} ${gameMin}:00`;
        period = `Period ${p}`;
      } else if (sportSlug === 'tennis' || sportSlug === 'table-tennis') {
        time = 'LIVE';
        period = statusShort || null;
      } else {
        time = elapsed ? `${elapsed}'` : `${Math.min(elapsedMinutes, 90)}'`;
        period = statusShort || null;
      }
    }
  }

  return {
    id: event.id,
    name: event.name,
    homeTeam: event.homeTeam,
    awayTeam: event.awayTeam,
    homeTeamLogo: event.homeTeamLogo ?? null,
    awayTeamLogo: event.awayTeamLogo ?? null,
    homeTeamCountry: (meta?.homeTeamCountry as string) ?? null,
    awayTeamCountry: (meta?.awayTeamCountry as string) ?? null,
    startTime: event.startTime.toISOString(),
    status: event.status,
    scores: event.scores,
    metadata: event.metadata ?? null,
    time,
    period,
    isLive: event.isLive,
    isFeatured: event.isFeatured,
    streamUrl: event.streamUrl,
    competition: event.competition.name,
    competitionSlug: event.competition.slug,
    competitionCountry: event.competition.country ?? null,
    competitionLogo: event.competition.logo ?? null,
    sport: event.competition.sport.name,
    sportSlug: event.competition.sport.slug,
    sportIcon: event.competition.sport.icon ?? null,
    mainMarket: moneylineMarket,
    spreadMarket,
    totalMarket,
  };
}

async function invalidateEventCaches() {
  const keys = await redis.keys('events:*');
  if (keys.length > 0) {
    await redis.del(...keys);
  }
  await redis.del('sports:list');
}
