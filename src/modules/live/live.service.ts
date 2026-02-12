import prisma from '../../lib/prisma';
import { emitToEvent, emitGlobal, getIO } from '../../lib/socket';
import { setCache, getCache } from '../../lib/redis';
import { CACHE_TTL } from '../../config/constants';

export class LiveService {
  /**
   * Push live score update via WebSocket
   */
  async pushScoreUpdate(eventId: string, scores: any) {
    await prisma.event.update({
      where: { id: eventId },
      data: { scores, isLive: true, status: 'LIVE' },
    });

    emitToEvent(eventId, 'score:update', {
      eventId,
      scores,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Push odds update via WebSocket
   */
  async pushOddsUpdate(
    eventId: string,
    updates: Array<{ selectionId: string; newOdds: number; oldOdds: number }>
  ) {
    // Update odds in database
    for (const { selectionId, newOdds } of updates) {
      await prisma.selection.update({
        where: { id: selectionId },
        data: { odds: newOdds, probability: 1 / newOdds },
      });
    }

    // Broadcast to all clients watching this event
    emitToEvent(eventId, 'odds:update', {
      eventId,
      selections: updates,
      timestamp: new Date().toISOString(),
    });

    // Cache odds
    await setCache(`odds:${eventId}`, updates, CACHE_TTL.ODDS);
  }

  /**
   * Suspend all markets for an event (e.g., on goal)
   */
  async suspendEventMarkets(eventId: string, reason?: string) {
    await prisma.market.updateMany({
      where: { eventId, status: 'OPEN' },
      data: { status: 'SUSPENDED' },
    });

    emitToEvent(eventId, 'markets:suspended', {
      eventId,
      reason: reason || 'Key moment in play',
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Resume all markets for an event
   */
  async resumeEventMarkets(eventId: string) {
    await prisma.market.updateMany({
      where: { eventId, status: 'SUSPENDED' },
      data: { status: 'OPEN' },
    });

    await prisma.selection.updateMany({
      where: {
        market: { eventId },
        status: 'SUSPENDED',
      },
      data: { status: 'ACTIVE' },
    });

    emitToEvent(eventId, 'markets:resumed', {
      eventId,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Push live statistics
   */
  async pushStats(eventId: string, stats: any) {
    await prisma.event.update({
      where: { id: eventId },
      data: { metadata: stats },
    });

    emitToEvent(eventId, 'stats:update', {
      eventId,
      stats,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Push match timeline event (goal, card, substitution)
   */
  async pushTimelineEvent(
    eventId: string,
    timelineEvent: {
      type: string;
      minute: number;
      team?: string;
      player?: string;
      description: string;
    }
  ) {
    // Get existing metadata and append timeline event
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    const metadata = (event?.metadata as any) || {};
    if (!metadata.timeline) metadata.timeline = [];
    metadata.timeline.push({
      ...timelineEvent,
      timestamp: new Date().toISOString(),
    });

    await prisma.event.update({
      where: { id: eventId },
      data: { metadata },
    });

    emitToEvent(eventId, 'timeline:event', {
      eventId,
      event: timelineEvent,
      timestamp: new Date().toISOString(),
    });

    // Auto-suspend on goals and red cards
    if (timelineEvent.type === 'goal' || timelineEvent.type === 'red_card') {
      await this.suspendEventMarkets(eventId, `${timelineEvent.type}: ${timelineEvent.description}`);

      // Auto-resume after delay
      setTimeout(async () => {
        try {
          await this.resumeEventMarkets(eventId);
        } catch (error) {
          console.error('Failed to auto-resume markets:', error);
        }
      }, 30000); // 30 second delay
    }
  }

  /**
   * Get live event data (cached)
   */
  async getLiveEventData(eventId: string) {
    const cacheKey = `live:event:${eventId}`;
    const cached = await getCache(cacheKey);
    if (cached) return cached;

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: {
        competition: { include: { sport: true } },
        markets: {
          where: { status: { in: ['OPEN', 'SUSPENDED'] } },
          include: { selections: true },
        },
      },
    });

    if (event) {
      await setCache(cacheKey, event, CACHE_TTL.ODDS);
    }
    return event;
  }

  /**
   * Get count of live events per sport
   */
  async getLiveEventCounts() {
    const counts = await prisma.event.groupBy({
      by: ['competitionId'],
      where: { status: 'LIVE' },
      _count: true,
    });

    // Resolve to sport counts
    const sportCounts: Record<string, number> = {};
    for (const count of counts) {
      const comp = await prisma.competition.findUnique({
        where: { id: count.competitionId },
        include: { sport: true },
      });
      if (comp) {
        sportCounts[comp.sport.slug] = (sportCounts[comp.sport.slug] || 0) + count._count;
      }
    }

    return sportCounts;
  }

  /**
   * End an event (move to ENDED status)
   */
  async endEvent(eventId: string, finalScores: any) {
    await prisma.event.update({
      where: { id: eventId },
      data: {
        status: 'ENDED',
        isLive: false,
        scores: finalScores,
      },
    });

    // Suspend any remaining open markets
    await prisma.market.updateMany({
      where: { eventId, status: 'OPEN' },
      data: { status: 'SUSPENDED' },
    });

    emitToEvent(eventId, 'event:ended', {
      eventId,
      finalScores,
      timestamp: new Date().toISOString(),
    });

    emitGlobal('live:event:ended', { eventId });
  }

  /**
   * Get match tracker data for visualization
   */
  async getMatchTracker(eventId: string) {
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        name: true,
        homeTeam: true,
        awayTeam: true,
        scores: true,
        metadata: true,
        status: true,
        competition: {
          include: { sport: true },
        },
      },
    });

    if (!event) return null;

    const metadata = event.metadata as any;
    return {
      ...event,
      timeline: metadata?.timeline || [],
      stats: metadata?.stats || {},
      possession: metadata?.possession || { home: 50, away: 50 },
    };
  }
}

export const liveService = new LiveService();
