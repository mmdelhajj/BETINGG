import prisma from '../../lib/prisma';
import { getCache, setCache, deleteCachePattern } from '../../lib/redis';
import { CACHE_TTL } from '../../config/constants';
import { NotFoundError } from '../../utils/errors';
import { EventStatus } from '@prisma/client';

export class SportsService {
  async getSports(activeOnly = true) {
    const cacheKey = `sports:list:${activeOnly}`;
    const cached = await getCache(cacheKey);
    if (cached) return cached;

    const sports = await prisma.sport.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      orderBy: { sortOrder: 'asc' },
    });

    // Single query for all live counts instead of N+1
    const liveCounts = await prisma.event.groupBy({
      by: ['competitionId'],
      where: { status: 'LIVE' },
      _count: true,
    });

    // Map competition to sport
    const competitions = await prisma.competition.findMany({
      select: { id: true, sportId: true },
    });
    const compToSport = new Map(competitions.map(c => [c.id, c.sportId]));

    const sportLiveCounts = new Map<string, number>();
    for (const lc of liveCounts) {
      const sportId = compToSport.get(lc.competitionId);
      if (sportId) {
        sportLiveCounts.set(sportId, (sportLiveCounts.get(sportId) || 0) + lc._count);
      }
    }

    const result = sports.map(sport => ({
      ...sport,
      liveEventCount: sportLiveCounts.get(sport.id) || 0,
    }));

    await setCache(cacheKey, result, CACHE_TTL.SPORTS_LIST);
    return result;
  }

  async getSportBySlug(slug: string) {
    const sport = await prisma.sport.findUnique({
      where: { slug },
      include: {
        competitions: {
          where: { isActive: true },
          orderBy: { name: 'asc' },
          include: {
            _count: {
              select: { events: { where: { status: { in: ['UPCOMING', 'LIVE'] } } } },
            },
          },
        },
      },
    });
    if (!sport) throw new NotFoundError('Sport');
    return sport;
  }

  async getCompetitions(sportSlug: string) {
    const cacheKey = `competitions:${sportSlug}`;
    const cached = await getCache(cacheKey);
    if (cached) return cached;

    const sport = await prisma.sport.findUnique({ where: { slug: sportSlug } });
    if (!sport) throw new NotFoundError('Sport');

    const competitions = await prisma.competition.findMany({
      where: { sportId: sport.id, isActive: true },
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { events: { where: { status: { in: ['UPCOMING', 'LIVE'] } } } },
        },
      },
    });

    await setCache(cacheKey, competitions, CACHE_TTL.COMPETITIONS_LIST);
    return competitions;
  }

  async getCompetitionEvents(competitionId: string, status?: EventStatus) {
    const events = await prisma.event.findMany({
      where: {
        competitionId,
        ...(status ? { status } : { status: { in: ['UPCOMING', 'LIVE'] } }),
      },
      orderBy: { startTime: 'asc' },
      include: {
        markets: {
          where: { status: 'OPEN' },
          take: 5,
          orderBy: { sortOrder: 'asc' },
          include: {
            selections: {
              where: { status: 'ACTIVE' },
              orderBy: { outcome: 'asc' },
            },
          },
        },
        competition: { include: { sport: true } },
        _count: { select: { markets: { where: { status: 'OPEN' } } } },
      },
    });
    return events;
  }

  async getEvent(eventId: string) {
    const cacheKey = `event:${eventId}`;
    const cached = await getCache(cacheKey);
    if (cached) return cached;

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: {
        competition: { include: { sport: true } },
        markets: {
          orderBy: [{ type: 'asc' }, { sortOrder: 'asc' }],
          include: {
            selections: {
              orderBy: { outcome: 'asc' },
            },
          },
        },
        streams: { where: { isActive: true } },
        _count: { select: { markets: { where: { status: 'OPEN' } } } },
      },
    });

    if (!event) throw new NotFoundError('Event');

    // Organize markets by type for the detail view
    const marketsByType: Record<string, typeof event.markets> = {};
    for (const market of event.markets) {
      const type = market.type || 'OTHER';
      if (!marketsByType[type]) marketsByType[type] = [];
      marketsByType[type].push(market);
    }

    const result = { ...event, marketsByType };

    await setCache(cacheKey, result, CACHE_TTL.EVENT_DETAIL);
    return result;
  }

  async getLiveEvents(sportSlug?: string) {
    const where: any = { status: 'LIVE', isLive: true };
    if (sportSlug) {
      const sport = await prisma.sport.findUnique({ where: { slug: sportSlug } });
      if (sport) {
        where.competition = { sportId: sport.id };
      }
    }

    return prisma.event.findMany({
      where,
      orderBy: { startTime: 'asc' },
      include: {
        competition: { include: { sport: true } },
        markets: {
          where: { status: 'OPEN' },
          take: 5,
          orderBy: { sortOrder: 'asc' },
          include: {
            selections: { where: { status: 'ACTIVE' }, orderBy: { outcome: 'asc' } },
          },
        },
        _count: { select: { markets: { where: { status: 'OPEN' } } } },
      },
    });
  }

  async getFeaturedEvents() {
    return prisma.event.findMany({
      where: { isFeatured: true, status: { in: ['UPCOMING', 'LIVE'] } },
      orderBy: { startTime: 'asc' },
      take: 10,
      include: {
        competition: { include: { sport: true } },
        markets: {
          where: { status: 'OPEN' },
          take: 5,
          orderBy: { sortOrder: 'asc' },
          include: { selections: { where: { status: 'ACTIVE' }, orderBy: { outcome: 'asc' } } },
        },
        _count: { select: { markets: { where: { status: 'OPEN' } } } },
      },
    });
  }

  async searchEvents(query: string) {
    return prisma.event.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { homeTeam: { contains: query, mode: 'insensitive' } },
          { awayTeam: { contains: query, mode: 'insensitive' } },
          { competition: { name: { contains: query, mode: 'insensitive' } } },
        ],
        status: { in: ['UPCOMING', 'LIVE'] },
      },
      take: 20,
      include: {
        competition: { include: { sport: true } },
        markets: {
          where: { status: 'OPEN' },
          take: 5,
          orderBy: { sortOrder: 'asc' },
          include: { selections: { where: { status: 'ACTIVE' }, orderBy: { outcome: 'asc' } } },
        },
        _count: { select: { markets: { where: { status: 'OPEN' } } } },
      },
    });
  }

  // ─── ADMIN METHODS ─────────────────────────────────────────────

  async createSport(data: { name: string; slug: string; icon?: string; sortOrder?: number }) {
    await deleteCachePattern('sports:*');
    return prisma.sport.create({ data });
  }

  async updateSport(id: string, data: Partial<{ name: string; slug: string; icon: string; isActive: boolean; sortOrder: number }>) {
    await deleteCachePattern('sports:*');
    return prisma.sport.update({ where: { id }, data });
  }

  async createCompetition(data: { sportId: string; name: string; slug: string; country?: string }) {
    await deleteCachePattern('competitions:*');
    return prisma.competition.create({ data });
  }

  async createEvent(data: {
    competitionId: string;
    name: string;
    homeTeam?: string;
    awayTeam?: string;
    startTime: Date;
    isFeatured?: boolean;
  }) {
    return prisma.event.create({ data });
  }

  async updateEvent(id: string, data: Partial<{
    name: string;
    status: EventStatus;
    scores: any;
    isLive: boolean;
    isFeatured: boolean;
    metadata: any;
  }>) {
    await deleteCachePattern(`event:${id}`);
    return prisma.event.update({ where: { id }, data });
  }

  async updateEventStatus(id: string, status: EventStatus) {
    const isLive = status === 'LIVE';
    await deleteCachePattern(`event:${id}`);
    return prisma.event.update({
      where: { id },
      data: { status, isLive },
    });
  }

  async createMarket(data: {
    eventId: string;
    name: string;
    marketKey: string;
    type: string;
    period?: string;
    sortOrder?: number;
    margin?: number;
  }) {
    const { margin, type, ...rest } = data;
    return prisma.market.create({
      data: {
        ...rest,
        type: type as any,
        margin: margin || undefined,
      },
    });
  }

  async createSelection(data: {
    marketId: string;
    name: string;
    outcome: string;
    odds: number;
    probability?: number;
    handicap?: number;
    maxStake?: number;
  }) {
    return prisma.selection.create({ data });
  }

  async updateOdds(selectionId: string, newOdds: number) {
    await prisma.selection.update({
      where: { id: selectionId },
      data: { odds: newOdds, probability: 1 / newOdds },
    });
  }

  async suspendMarket(marketId: string) {
    await prisma.market.update({ where: { id: marketId }, data: { status: 'SUSPENDED' } });
    await prisma.selection.updateMany({ where: { marketId }, data: { status: 'SUSPENDED' } });
  }

  async resumeMarket(marketId: string) {
    await prisma.market.update({ where: { id: marketId }, data: { status: 'OPEN' } });
    await prisma.selection.updateMany({
      where: { marketId, status: 'SUSPENDED' },
      data: { status: 'ACTIVE' },
    });
  }

  async settleMarket(marketId: string, results: Array<{ selectionId: string; result: string }>) {
    for (const { selectionId, result } of results) {
      await prisma.selection.update({
        where: { id: selectionId },
        data: {
          result: result as any,
          status: result === 'WIN' ? 'WON' : result === 'LOSE' ? 'LOST' : (result as any),
        },
      });
    }

    await prisma.market.update({
      where: { id: marketId },
      data: { status: 'SETTLED' },
    });

    // Trigger settlement queue
    const { addBetSettlementJob } = await import('../../queues');
    await addBetSettlementJob({ marketId });

    return { settled: true, marketId };
  }
}

export const sportsService = new SportsService();
