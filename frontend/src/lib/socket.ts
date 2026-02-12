import { io, Socket } from 'socket.io-client';

// Derive the WS URL from the API URL if WS_URL is not explicitly set.
// NEXT_PUBLIC_WS_URL should be an http(s):// URL; socket.io handles the
// protocol upgrade internally.
function getWsUrl(): string {
  if (process.env.NEXT_PUBLIC_WS_URL) {
    // Convert ws:// to http:// since socket.io client expects http(s)
    return process.env.NEXT_PUBLIC_WS_URL
      .replace(/^ws:\/\//, 'http://')
      .replace(/^wss:\/\//, 'https://');
  }
  if (process.env.NEXT_PUBLIC_API_URL) {
    // Strip any path like /api/v1 to get the base server URL
    try {
      const url = new URL(process.env.NEXT_PUBLIC_API_URL);
      return `${url.protocol}//${url.host}`;
    } catch {
      // fallback
    }
  }
  return 'http://localhost:4000';
}

const WS_URL = getWsUrl();

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(WS_URL, {
      autoConnect: false,
      // Start with polling (always works), then upgrade to websocket
      transports: ['polling', 'websocket'],
      upgrade: true,
      // Reconnection settings to avoid spamming errors
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 30000,
      randomizationFactor: 0.5,
      // Timeouts
      timeout: 20000,
      // Path must match server
      path: '/socket.io/',
    });

    // Suppress noisy connection errors in the console during development
    socket.on('connect_error', (err) => {
      console.warn(`[Socket.IO] Connection error: ${err.message}`);
    });
  }
  return socket;
}

export function connectSocket(token?: string) {
  const s = getSocket();
  if (token) s.auth = { token };
  if (!s.connected) s.connect();
  return s;
}

export function disconnectSocket() {
  if (socket?.connected) socket.disconnect();
}

export function joinRoom(room: string) {
  getSocket().emit('join', room);
}

export function leaveRoom(room: string) {
  getSocket().emit('leave', room);
}
