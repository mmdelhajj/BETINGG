// ---------------------------------------------------------------------------
// CryptoBet Backend — Entrypoint
// ---------------------------------------------------------------------------
// Load environment variables first, then start the server.

import 'dotenv/config';

// Re-export everything from server so consumers can import from index
export { app, io, httpServer } from './server.js';

// server.ts calls `void start()` on import, so importing it boots the app.
import './server.js';
