import { prisma } from '../../lib/prisma';
import { redis } from '../../lib/redis';
import { AppError } from '../../utils/errors';
import crypto from 'crypto';
import { Decimal } from '@prisma/client/runtime/library';

export class VirtualSportsService {
  // ─── Sport Management ─────────────────────────────────────
  async listSports() {
    return prisma.virtualSport.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async getSport(slug: string) {
    const sport = await prisma.virtualSport.findUnique({ where: { slug } });
    if (!sport || !sport.isActive) throw new AppError('SPORT_NOT_FOUND', 'Virtual sport not found', 404);
    return sport;
  }

  // ─── Events ───────────────────────────────────────────────
  async getUpcomingEvents(sportSlug: string, limit = 10) {
    const sport = await prisma.virtualSport.findUnique({ where: { slug: sportSlug } });
    if (!sport) throw new AppError('SPORT_NOT_FOUND', 'Virtual sport not found', 404);

    return prisma.virtualEvent.findMany({
      where: { virtualSportId: sport.id, status: 'UPCOMING' },
      orderBy: { startsAt: 'asc' },
      take: limit,
    });
  }

  async getRecentResults(sportSlug: string, limit = 20) {
    const sport = await prisma.virtualSport.findUnique({ where: { slug: sportSlug } });
    if (!sport) throw new AppError('SPORT_NOT_FOUND', 'Virtual sport not found', 404);

    return prisma.virtualEvent.findMany({
      where: { virtualSportId: sport.id, status: 'ENDED' },
      orderBy: { settledAt: 'desc' },
      take: limit,
    });
  }

  async getEvent(eventId: string) {
    const event = await prisma.virtualEvent.findUnique({
      where: { id: eventId },
      include: { virtualSport: true },
    });
    if (!event) throw new AppError('EVENT_NOT_FOUND', 'Virtual event not found', 404);
    return event;
  }

  // ─── Event Generation (called by scheduler) ───────────────
  async generateNextEvent(sportId: string) {
    const sport = await prisma.virtualSport.findUnique({ where: { id: sportId } });
    if (!sport || !sport.isActive) return null;

    const lastEvent = await prisma.virtualEvent.findFirst({
      where: { virtualSportId: sportId },
      orderBy: { roundNumber: 'desc' },
    });

    const roundNumber = (lastEvent?.roundNumber || 0) + 1;
    const serverSeed = crypto.randomBytes(32).toString('hex');
    const startsAt = new Date(Date.now() + sport.intervalSec * 1000);

    const participants = this.generateParticipants(sport.slug, sport.markets as any);

    return prisma.virtualEvent.create({
      data: {
        virtualSportId: sportId,
        roundNumber,
        participants,
        serverSeed,
        clientSeed: 'cryptobet',
        status: 'UPCOMING',
        startsAt,
      },
    });
  }

  // ─── Settlement ───────────────────────────────────────────
  async settleEvent(eventId: string) {
    const event = await prisma.virtualEvent.findUnique({
      where: { id: eventId },
      include: { virtualSport: true },
    });
    if (!event) throw new AppError('EVENT_NOT_FOUND', 'Event not found', 404);
    if (event.status !== 'LIVE') throw new AppError('NOT_LIVE', 'Event is not live', 400);

    // Generate deterministic result from server seed
    const hash = crypto.createHmac('sha256', event.serverSeed)
      .update(event.clientSeed)
      .digest('hex');

    const result = this.calculateResult(
      event.virtualSport.slug,
      event.participants as any,
      hash
    );

    return prisma.virtualEvent.update({
      where: { id: eventId },
      data: {
        result,
        status: 'ENDED',
        settledAt: new Date(),
      },
    });
  }

  async startEvent(eventId: string) {
    return prisma.virtualEvent.update({
      where: { id: eventId },
      data: { status: 'LIVE' },
    });
  }

  // ─── Provably Fair Verification ───────────────────────────
  async verifyResult(eventId: string) {
    const event = await prisma.virtualEvent.findUnique({
      where: { id: eventId },
      include: { virtualSport: true },
    });
    if (!event || event.status !== 'ENDED') throw new AppError('EVENT_NOT_SETTLED', 'Event not settled yet', 400);

    const hash = crypto.createHmac('sha256', event.serverSeed)
      .update(event.clientSeed)
      .digest('hex');

    const recalculatedResult = this.calculateResult(
      event.virtualSport.slug,
      event.participants as any,
      hash
    );

    return {
      serverSeed: event.serverSeed,
      clientSeed: event.clientSeed,
      hash,
      storedResult: event.result,
      recalculatedResult,
      isValid: JSON.stringify(event.result) === JSON.stringify(recalculatedResult),
    };
  }

  // ─── Private Helpers ──────────────────────────────────────
  private generateParticipants(sportSlug: string, _markets: any) {
    const teamNames: Record<string, string[][]> = {
      'virtual-football': [
        ['Barcelona FC', 'Real Madrid'], ['Bayern Munich', 'PSG'],
        ['Liverpool', 'Man City'], ['Juventus', 'AC Milan'],
        ['Ajax', 'Dortmund'], ['Chelsea', 'Arsenal'],
      ],
      'virtual-basketball': [
        ['Lakers', 'Celtics'], ['Warriors', 'Nets'],
        ['Bulls', 'Heat'], ['Bucks', 'Sixers'],
      ],
      'virtual-horse-racing': [
        ['Thunder', 'Lightning', 'Storm', 'Blaze', 'Shadow', 'Rocket', 'Comet', 'Flash'],
      ],
      'virtual-tennis': [
        ['Player A', 'Player B'], ['Player C', 'Player D'],
      ],
    };

    const options = teamNames[sportSlug] || teamNames['virtual-football']!;
    const pick = options[Math.floor(Math.random() * options.length)]!;

    if (sportSlug === 'virtual-horse-racing') {
      return { type: 'race', runners: pick.map((name, i) => ({ number: i + 1, name })) };
    }

    return { type: 'match', home: pick[0], away: pick[1] };
  }

  private calculateResult(sportSlug: string, participants: any, hash: string) {
    // Use hash bytes for deterministic random
    const bytes = Buffer.from(hash, 'hex');

    if (participants.type === 'race') {
      // Horse racing: shuffle runners based on hash
      const runners = [...participants.runners];
      for (let i = runners.length - 1; i > 0; i--) {
        const j = bytes[i % 32]! % (i + 1);
        [runners[i], runners[j]] = [runners[j], runners[i]];
      }
      return { positions: runners.map((r: any, i: number) => ({ ...r, position: i + 1 })) };
    }

    // Match sports: generate scores
    const homeScore = bytes[0]! % 5;
    const awayScore = bytes[1]! % 5;

    return {
      home: participants.home,
      away: participants.away,
      homeScore,
      awayScore,
      winner: homeScore > awayScore ? 'home' : homeScore < awayScore ? 'away' : 'draw',
    };
  }

  // ─── Admin ────────────────────────────────────────────────
  async adminCreateSport(data: {
    name: string; slug: string; intervalSec: number; markets: any;
  }) {
    return prisma.virtualSport.create({ data });
  }

  async adminUpdateSport(id: string, data: Partial<{
    name: string; intervalSec: number; isActive: boolean; markets: any;
  }>) {
    return prisma.virtualSport.update({ where: { id }, data });
  }
}

export const virtualSportsService = new VirtualSportsService();
