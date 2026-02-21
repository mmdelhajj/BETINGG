import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import Cookies from 'js-cookie';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SocketEvents {
  // Odds updates
  'odds:update': (data: { eventId: string; marketId: string; odds: Record<string, number> }) => void;
  'odds:suspended': (data: { eventId: string; marketId: string }) => void;

  // Live events
  'live:update': (data: { events: Array<{ id: string; homeTeam: string; awayTeam: string; homeTeamLogo?: string | null; awayTeamLogo?: string | null; startTime: string; status: string; isLive: boolean; scores?: { home?: number; away?: number } | null; sportSlug: string; competitionSlug?: string; mainMarket?: { id: string; name: string; type: string; selections: { id: string; name: string; outcome: string; odds: string | number; status: string }[] } | null }> }) => void;
  'event:scoreUpdate': (data: { eventId: string; homeScore: number; awayScore: number; timer?: string; period?: string; score?: Record<string, number>; time?: string }) => void;
  'event:statusChange': (data: { eventId: string; status: string }) => void;
  'event:status': (data: { eventId: string; status: 'ENDED' | 'LIVE' | string; isLive: boolean; timestamp: string }) => void;
  'event:created': (data: { eventId: string }) => void;

  // Score updates
  'score:update': (data: { eventId: string; scores: { homeScore: number; awayScore: number; period?: string; time?: string }; timestamp: string }) => void;

  // Bet updates
  'bet:settled': (data: { betId: string; status: 'WON' | 'LOST' | 'VOID'; actualWin: string; timestamp: string }) => void;
  'bet:cashoutAvailable': (data: { betId: string; cashoutAmount: number }) => void;

  // User notifications
  'notification': (data: { type: string; title: string; message: string; data?: unknown }) => void;

  // Balance updates
  'balance:update': (data: { currency: string; available: number; locked: number }) => void;

  // Chat
  'chat:message': (data: { userId: string; username: string; message: string; timestamp: string }) => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001';
const TOKEN_COOKIE = 'cryptobet_token';

// ---------------------------------------------------------------------------
// Singleton socket instance
// ---------------------------------------------------------------------------

let socketInstance: Socket | null = null;

export function getSocket(): Socket {
  if (!socketInstance) {
    const token =
      Cookies.get(TOKEN_COOKIE) ||
      (typeof window !== 'undefined' ? localStorage.getItem(TOKEN_COOKIE) : null);

    socketInstance = io(WS_URL, {
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1_000,
      reconnectionDelayMax: 10_000,
      randomizationFactor: 0.5,
      timeout: 20_000,
      transports: ['websocket', 'polling'],
      auth: token ? { token } : {},
    });

    // ---------- lifecycle logging ----------
    socketInstance.on('connect', () => {
      console.log('[Socket] Connected:', socketInstance?.id);
    });

    socketInstance.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason);
    });

    socketInstance.on('connect_error', (err) => {
      console.error('[Socket] Connection error:', err.message);
    });

    socketInstance.on('reconnect', (attemptNumber) => {
      console.log('[Socket] Reconnected after', attemptNumber, 'attempts');
    });

    socketInstance.on('reconnect_attempt', (attemptNumber) => {
      console.log('[Socket] Reconnection attempt', attemptNumber);

      // Refresh auth token on reconnect
      const freshToken =
        Cookies.get(TOKEN_COOKIE) ||
        (typeof window !== 'undefined' ? localStorage.getItem(TOKEN_COOKIE) : null);

      if (freshToken && socketInstance) {
        socketInstance.auth = { token: freshToken };
      }
    });

    socketInstance.on('reconnect_failed', () => {
      console.error('[Socket] Reconnection failed after all attempts');
    });
  }

  return socketInstance;
}

export function connectSocket(): void {
  const socket = getSocket();
  if (!socket.connected) {
    socket.connect();
  }
}

export function disconnectSocket(): void {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }
}

export function updateSocketAuth(token: string): void {
  const socket = getSocket();
  socket.auth = { token };
  if (socket.connected) {
    socket.disconnect().connect();
  }
}

// ---------------------------------------------------------------------------
// React hook: useSocket
// ---------------------------------------------------------------------------

interface UseSocketOptions {
  /** Auto-connect on mount (default true) */
  autoConnect?: boolean;
  /** Rooms to join on connect */
  rooms?: string[];
}

interface UseSocketReturn {
  socket: Socket;
  isConnected: boolean;
  emit: <T = unknown>(event: string, ...args: T[]) => void;
  joinRoom: (room: string) => void;
  leaveRoom: (room: string) => void;
}

export function useSocket(options: UseSocketOptions = {}): UseSocketReturn {
  const { autoConnect = true, rooms = [] } = options;
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket>(getSocket());
  const joinedRooms = useRef<Set<string>>(new Set());

  useEffect(() => {
    const socket = socketRef.current;

    function onConnect() {
      setIsConnected(true);
      // Rejoin rooms after (re)connect
      joinedRooms.current.forEach((room) => {
        socket.emit('join', room);
      });
    }

    function onDisconnect() {
      setIsConnected(false);
    }

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    if (autoConnect && !socket.connected) {
      socket.connect();
    }

    if (socket.connected) {
      setIsConnected(true);
    }

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, [autoConnect]);

  // Join initial rooms
  useEffect(() => {
    const socket = socketRef.current;
    rooms.forEach((room) => {
      if (!joinedRooms.current.has(room)) {
        joinedRooms.current.add(room);
        if (socket.connected) {
          socket.emit('join', room);
        }
      }
    });
  }, [rooms]);

  const emit = useCallback(<T = unknown>(event: string, ...args: T[]) => {
    socketRef.current.emit(event, ...args);
  }, []);

  const joinRoom = useCallback((room: string) => {
    joinedRooms.current.add(room);
    if (socketRef.current.connected) {
      socketRef.current.emit('join', room);
    }
  }, []);

  const leaveRoom = useCallback((room: string) => {
    joinedRooms.current.delete(room);
    if (socketRef.current.connected) {
      socketRef.current.emit('leave', room);
    }
  }, []);

  return {
    socket: socketRef.current,
    isConnected,
    emit,
    joinRoom,
    leaveRoom,
  };
}

// ---------------------------------------------------------------------------
// React hook: useSocketEvent
// ---------------------------------------------------------------------------

export function useSocketEvent<K extends keyof SocketEvents>(
  event: K,
  handler: SocketEvents[K],
): void {
  const savedHandler = useRef(handler);

  useEffect(() => {
    savedHandler.current = handler;
  }, [handler]);

  useEffect(() => {
    const socket = getSocket();

    const eventHandler = (...args: unknown[]) => {
      (savedHandler.current as (...a: unknown[]) => void)(...args);
    };

    socket.on(event as string, eventHandler);

    return () => {
      socket.off(event as string, eventHandler);
    };
  }, [event]);
}

export default getSocket;
