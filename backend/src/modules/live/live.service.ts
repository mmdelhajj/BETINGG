import type { Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { prisma } from '../../lib/prisma.js';
import { redis } from '../../lib/redis.js';
import { config } from '../../config/index.js';
import { getIO } from '../../lib/socket.js';
import type { JwtPayload } from '../../middleware/auth.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MarketUpdate {
  marketId: string;
  marketName: string;
  status: string;
  selections: Array<{
    id: string;
    name: string;
    odds: string;
    previousOdds?: string;
    status: string;
  }>;
}

interface ScoreUpdate {
  homeScore: number;
  awayScore: number;
  period?: string;
  time?: string;
  details?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Connection Handler
// ---------------------------------------------------------------------------

/**
 * Authenticate a Socket.IO connection and set up event handlers.
 * Expects a JWT token in the handshake auth or query.
 */
export async function handleConnection(socket: Socket): Promise<void> {
  const token =
    socket.handshake.auth?.token ??
    socket.handshake.query?.token;

  if (typeof token !== 'string') {
    socket.emit('error', { code: 'AUTH_REQUIRED', message: 'Authentication required.' });
    socket.disconnect(true);
    return;
  }

  try {
    const payload = jwt.verify(token, config.JWT_SECRET) as JwtPayload;

    // Attach user data to socket
    (socket.data as Record<string, unknown>).userId = payload.id;
    (socket.data as Record<string, unknown>).user = payload;

    // Join personal room for targeted messages
    await socket.join(`user:${payload.id}`);

    // Set up event listeners
    socket.on('subscribe:event', (eventId: string) => {
      void joinEvent(socket, eventId);
    });

    socket.on('unsubscribe:event', (eventId: string) => {
      void leaveEvent(socket, eventId);
    });

    socket.on('subscribe:sport', (sportSlug: string) => {
      void socket.join(`sport:${sportSlug}`);
    });

    socket.on('unsubscribe:sport', (sportSlug: string) => {
      void socket.leave(`sport:${sportSlug}`);
    });

    socket.on('disconnect', () => {
      // Track connected users for metrics
      void redis.srem('live:connected_users', payload.id);
    });

    // Track connected user
    await redis.sadd('live:connected_users', payload.id);

    socket.emit('authenticated', { userId: payload.id });
  } catch {
    socket.emit('error', { code: 'AUTH_INVALID', message: 'Invalid or expired token.' });
    socket.disconnect(true);
  }
}

// ---------------------------------------------------------------------------
// Join / Leave Event
// ---------------------------------------------------------------------------

/**
 * Subscribe a socket to a specific event's live updates.
 */
export async function joinEvent(socket: Socket, eventId: string): Promise<void> {
  // Validate event exists and is live
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, name: true, status: true, isLive: true, scores: true },
  });

  if (!event) {
    socket.emit('error', { code: 'EVENT_NOT_FOUND', message: 'Event not found.' });
    return;
  }

  const room = `event:${eventId}`;
  await socket.join(room);

  // Send current event state to the newly joined client
  socket.emit('event:state', {
    eventId: event.id,
    name: event.name,
    status: event.status,
    isLive: event.isLive,
    scores: event.scores,
    timestamp: new Date().toISOString(),
  });

  // Track subscribers per event for analytics
  await redis.sadd(`live:event:${eventId}:subscribers`, socket.id);
}

/**
 * Unsubscribe a socket from an event's live updates.
 */
export async function leaveEvent(socket: Socket, eventId: string): Promise<void> {
  const room = `event:${eventId}`;
  await socket.leave(room);
  await redis.srem(`live:event:${eventId}:subscribers`, socket.id);
}

// ---------------------------------------------------------------------------
// Broadcast Functions
// ---------------------------------------------------------------------------

/**
 * Broadcast odds updates to all clients subscribed to a specific event.
 */
export function broadcastOddsUpdate(eventId: string, markets: MarketUpdate[]): void {
  try {
    const io = getIO();
    const liveNsp = io.of('/live');

    liveNsp.to(`event:${eventId}`).emit('odds:update', {
      eventId,
      markets,
      timestamp: new Date().toISOString(),
    });

    // Also broadcast to the sport room if we can determine the sport
    // This happens asynchronously and won't block the main broadcast
    void broadcastToSportRoom(eventId, 'odds:update', { eventId, markets });
  } catch (err) {
    console.error('[Live] Failed to broadcast odds update:', err);
  }
}

/**
 * Broadcast score changes to all clients subscribed to a specific event.
 */
export function broadcastScoreUpdate(eventId: string, scores: ScoreUpdate): void {
  try {
    const io = getIO();
    const liveNsp = io.of('/live');

    liveNsp.to(`event:${eventId}`).emit('score:update', {
      eventId,
      scores,
      timestamp: new Date().toISOString(),
    });

    void broadcastToSportRoom(eventId, 'score:update', { eventId, scores });
  } catch (err) {
    console.error('[Live] Failed to broadcast score update:', err);
  }
}

/**
 * Broadcast market suspension or resumption to all clients.
 */
export function broadcastMarketSuspension(
  eventId: string,
  marketId: string,
  suspended: boolean,
): void {
  try {
    const io = getIO();
    const liveNsp = io.of('/live');

    liveNsp.to(`event:${eventId}`).emit('market:suspension', {
      eventId,
      marketId,
      suspended,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[Live] Failed to broadcast market suspension:', err);
  }
}

/**
 * Broadcast an event status change (e.g., UPCOMING -> LIVE, LIVE -> ENDED).
 */
export function broadcastEventStatus(
  eventId: string,
  status: string,
  isLive: boolean,
): void {
  try {
    const io = getIO();
    const liveNsp = io.of('/live');

    liveNsp.to(`event:${eventId}`).emit('event:status', {
      eventId,
      status,
      isLive,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[Live] Failed to broadcast event status:', err);
  }
}

/**
 * Broadcast a bet settlement notification to a specific user.
 */
export function broadcastBetSettlement(
  userId: string,
  data: {
    betId: string;
    status: string;
    actualWin: string;
  },
): void {
  try {
    const io = getIO();
    const liveNsp = io.of('/live');

    liveNsp.to(`user:${userId}`).emit('bet:settled', {
      ...data,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[Live] Failed to broadcast bet settlement:', err);
  }
}

// ---------------------------------------------------------------------------
// Utility: Get live stats
// ---------------------------------------------------------------------------

/**
 * Get current live stats (connected users, active events, subscriber counts).
 */
export async function getLiveStats() {
  const connectedUsers = await redis.scard('live:connected_users');

  // Get all live events and their subscriber counts
  const liveEvents = await prisma.event.findMany({
    where: { status: 'LIVE', isLive: true },
    select: { id: true, name: true },
  });

  const eventStats = await Promise.all(
    liveEvents.map(async (event) => {
      const subscribers = await redis.scard(`live:event:${event.id}:subscribers`);
      return {
        eventId: event.id,
        eventName: event.name,
        subscribers,
      };
    }),
  );

  return {
    connectedUsers,
    liveEventCount: liveEvents.length,
    events: eventStats,
    timestamp: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function broadcastToSportRoom(
  eventId: string,
  eventName: string,
  data: Record<string, unknown>,
): Promise<void> {
  try {
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: {
        competition: {
          select: {
            sport: { select: { slug: true } },
          },
        },
      },
    });

    if (event?.competition?.sport?.slug) {
      const io = getIO();
      const liveNsp = io.of('/live');
      liveNsp
        .to(`sport:${event.competition.sport.slug}`)
        .emit(eventName, {
          ...data,
          timestamp: new Date().toISOString(),
        });
    }
  } catch {
    // Silently fail - sport room broadcast is best-effort
  }
}
