import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { config } from '../config/index.js';

let io: SocketIOServer | null = null;

/**
 * Initializes the Socket.IO server, attaches it to the given HTTP server,
 * and sets up the four application namespaces:
 *
 *  /live           - live sports betting odds, scores, match updates
 *  /casino         - casino game state (crash multiplier, round results, etc.)
 *  /notifications  - per-user notification delivery
 *  /chat           - live chat between users and support
 */
export function setupSocketIO(httpServer: HttpServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: config.FRONTEND_URL,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
    pingInterval: 25_000,
    pingTimeout: 20_000,
    maxHttpBufferSize: 1e6, // 1 MB
  });

  // ─── Default namespace (/) ─────────────────────────────────────────────
  io.on('connection', (socket: Socket) => {
    console.log(`[Socket.IO /] Client connected: ${socket.id}`);

    socket.on('join:room', (room: string) => {
      void socket.join(room);
      console.log(`[Socket.IO /] ${socket.id} joined room: ${room}`);
    });

    socket.on('leave:room', (room: string) => {
      void socket.leave(room);
      console.log(`[Socket.IO /] ${socket.id} left room: ${room}`);
    });

    socket.on('disconnect', (reason: string) => {
      console.log(`[Socket.IO /] Client disconnected: ${socket.id} - ${reason}`);
    });
  });

  // ─── /live namespace ───────────────────────────────────────────────────
  const liveNsp = io.of('/live');
  liveNsp.on('connection', (socket: Socket) => {
    console.log(`[Socket.IO /live] Client connected: ${socket.id}`);

    // Subscribe to a specific event's live updates
    socket.on('subscribe:event', (eventId: string) => {
      void socket.join(`event:${eventId}`);
      console.log(`[Socket.IO /live] ${socket.id} subscribed to event:${eventId}`);
    });

    socket.on('unsubscribe:event', (eventId: string) => {
      void socket.leave(`event:${eventId}`);
      console.log(`[Socket.IO /live] ${socket.id} unsubscribed from event:${eventId}`);
    });

    // Subscribe to a sport's live feed
    socket.on('subscribe:sport', (sportSlug: string) => {
      void socket.join(`sport:${sportSlug}`);
    });

    socket.on('unsubscribe:sport', (sportSlug: string) => {
      void socket.leave(`sport:${sportSlug}`);
    });

    socket.on('disconnect', (reason: string) => {
      console.log(`[Socket.IO /live] Client disconnected: ${socket.id} - ${reason}`);
    });
  });

  // ─── /casino namespace ─────────────────────────────────────────────────
  const casinoNsp = io.of('/casino');
  casinoNsp.on('connection', (socket: Socket) => {
    console.log(`[Socket.IO /casino] Client connected: ${socket.id}`);

    // Join a specific game room (e.g., crash, dice, roulette)
    socket.on('join:game', (gameSlug: string) => {
      void socket.join(`game:${gameSlug}`);
      console.log(`[Socket.IO /casino] ${socket.id} joined game:${gameSlug}`);
    });

    socket.on('leave:game', (gameSlug: string) => {
      void socket.leave(`game:${gameSlug}`);
      console.log(`[Socket.IO /casino] ${socket.id} left game:${gameSlug}`);
    });

    socket.on('disconnect', (reason: string) => {
      console.log(`[Socket.IO /casino] Client disconnected: ${socket.id} - ${reason}`);
    });
  });

  // ─── /notifications namespace ──────────────────────────────────────────
  const notificationsNsp = io.of('/notifications');
  notificationsNsp.on('connection', (socket: Socket) => {
    console.log(`[Socket.IO /notifications] Client connected: ${socket.id}`);

    // Authenticate and join user-specific room for private notifications
    socket.on('authenticate', (userId: string) => {
      void socket.join(`user:${userId}`);
      console.log(`[Socket.IO /notifications] ${socket.id} authenticated as user:${userId}`);
    });

    socket.on('disconnect', (reason: string) => {
      console.log(`[Socket.IO /notifications] Client disconnected: ${socket.id} - ${reason}`);
    });
  });

  // ─── /chat namespace ───────────────────────────────────────────────────
  const chatNsp = io.of('/chat');
  chatNsp.on('connection', (socket: Socket) => {
    console.log(`[Socket.IO /chat] Client connected: ${socket.id}`);

    // Join a chat room (global lobby, support ticket, etc.)
    socket.on('join:channel', (channelId: string) => {
      void socket.join(`channel:${channelId}`);
      console.log(`[Socket.IO /chat] ${socket.id} joined channel:${channelId}`);
    });

    socket.on('leave:channel', (channelId: string) => {
      void socket.leave(`channel:${channelId}`);
      console.log(`[Socket.IO /chat] ${socket.id} left channel:${channelId}`);
    });

    // Relay a chat message to the channel
    socket.on('message', (data: { channelId: string; content: string; userId: string }) => {
      chatNsp.to(`channel:${data.channelId}`).emit('message', {
        userId: data.userId,
        content: data.content,
        timestamp: new Date().toISOString(),
      });
    });

    // Typing indicator
    socket.on('typing:start', (data: { channelId: string; userId: string }) => {
      socket.to(`channel:${data.channelId}`).emit('typing:start', {
        userId: data.userId,
      });
    });

    socket.on('typing:stop', (data: { channelId: string; userId: string }) => {
      socket.to(`channel:${data.channelId}`).emit('typing:stop', {
        userId: data.userId,
      });
    });

    socket.on('disconnect', (reason: string) => {
      console.log(`[Socket.IO /chat] Client disconnected: ${socket.id} - ${reason}`);
    });
  });

  console.log('[Socket.IO] Server initialized with namespaces: /, /live, /casino, /notifications, /chat');
  return io;
}

/**
 * Returns the singleton Socket.IO server instance.
 * Throws if `setupSocketIO()` has not been called yet.
 */
export function getIO(): SocketIOServer {
  if (!io) {
    throw new Error('Socket.IO has not been initialized. Call setupSocketIO() first.');
  }
  return io;
}

export default { setupSocketIO, getIO };
