import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';

let io: SocketIOServer | null = null;

function getAllowedOrigins(): string[] {
  const origins: string[] = ['http://localhost:3000'];
  const frontendUrl = process.env.FRONTEND_URL;
  if (frontendUrl && !origins.includes(frontendUrl)) {
    origins.push(frontendUrl);
  }
  const corsOrigin = process.env.CORS_ORIGIN;
  if (corsOrigin) {
    corsOrigin.split(',').forEach((o) => {
      const trimmed = o.trim();
      if (trimmed && !origins.includes(trimmed)) {
        origins.push(trimmed);
      }
    });
  }
  return origins;
}

export function initializeSocketIO(httpServer: HTTPServer): SocketIOServer {
  const allowedOrigins = getAllowedOrigins();
  console.log('Socket.IO allowed origins:', allowedOrigins);

  io = new SocketIOServer(httpServer, {
    cors: {
      origin: allowedOrigins,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
    transports: ['polling', 'websocket'],
    allowUpgrades: true,
    path: '/socket.io/',
  });

  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    socket.on('join:event', (eventId: string) => {
      socket.join(`event:${eventId}`);
    });

    socket.on('leave:event', (eventId: string) => {
      socket.leave(`event:${eventId}`);
    });

    socket.on('join:crash', () => {
      socket.join('crash-game');
    });

    socket.on('leave:crash', () => {
      socket.leave('crash-game');
    });

    socket.on('join:user', (userId: string) => {
      socket.join(`user:${userId}`);
    });

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });

  return io;
}

export function getIO(): SocketIOServer {
  if (!io) {
    throw new Error('Socket.IO not initialized. Call initializeSocketIO first.');
  }
  return io;
}

export function emitToEvent(eventId: string, event: string, data: unknown): void {
  getIO().to(`event:${eventId}`).emit(event, data);
}

export function emitToUser(userId: string, event: string, data: unknown): void {
  getIO().to(`user:${userId}`).emit(event, data);
}

export function emitToCrash(event: string, data: unknown): void {
  getIO().to('crash-game').emit(event, data);
}

export function emitGlobal(event: string, data: unknown): void {
  getIO().emit(event, data);
}
