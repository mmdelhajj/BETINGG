import { Trophy } from 'lucide-react';

/** Colour per sport slug -- used as the SVG fill */
const SPORT_COLORS: Record<string, string> = {
  football: '#22c55e',
  basketball: '#f97316',
  tennis: '#eab308',
  'american-football': '#8b5cf6',
  baseball: '#ef4444',
  'ice-hockey': '#06b6d4',
  mma: '#dc2626',
  boxing: '#b91c1c',
  cricket: '#3b82f6',
  'rugby-union': '#a855f7',
  'rugby-league': '#7c3aed',
  golf: '#16a34a',
  esports: '#8b5cf6',
  'table-tennis': '#f59e0b',
  volleyball: '#ec4899',
  darts: '#f43f5e',
  cycling: '#f59e0b',
  f1: '#e11d48',
  handball: '#fb923c',
  snooker: '#15803d',
  badminton: '#38bdf8',
  'horse-racing': '#a16207',
  'greyhound-racing': '#78716c',
  futsal: '#4ade80',
  'water-polo': '#0ea5e9',
  'aussie-rules': '#facc15',
  surfing: '#06b6d4',
  skiing: '#7dd3fc',
  cs2: '#f97316',
  'dota-2': '#dc2626',
  'league-of-legends': '#c084fc',
  valorant: '#f43f5e',
  'rainbow-six': '#6366f1',
  'starcraft-2': '#22d3ee',
  'call-of-duty': '#84cc16',
  'ea-sports-fc': '#10b981',
  'rocket-league': '#3b82f6',
  politics: '#6366f1',
  entertainment: '#f472b6',
};

/**
 * Inline SVG path data keyed by sport slug.
 * All paths are drawn on a 24x24 viewBox.
 */
const SPORT_PATHS: Record<string, string> = {
  // Football / Soccer -- ball
  football:
    'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 2a8 8 0 0 1 4.9 1.7l-1.6 2.1-3.3-.7-3.3.7-1.6-2.1A8 8 0 0 1 12 4Zm-6.3 4 1.7 2.2-.4 3.3-2.8 1.5A8 8 0 0 1 4 12c0-1.5.4-2.8 1.1-4h.6Zm12.6 0h.6A8 8 0 0 1 20 12c0 1-.2 2-.6 2.9l-2.8-1.5-.4-3.3L17.9 8h-.6ZM12 8.5l2.5.5 1 2.4-1.5 2.1h-4l-1.5-2 1-2.5L12 8.5Zm-5.7 6 2.5-.6 1.6 1.8-.2 2.6-2.4 1A8 8 0 0 1 5.5 15l.8-1.5v1Zm11.4 0 .8-1.5v1a8 8 0 0 1-2.3 4.2l-2.4-1-.2-2.6 1.6-1.8 2.5.7ZM12 18.5l1.8-1.3h.4l1.2 2.3a8 8 0 0 1-6.8 0l1.2-2.3h.4l1.8 1.3Z',
  // Basketball -- ball with lines
  basketball:
    'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2Zm-1 17.93c-3.94-.49-7-3.86-7-7.93 0-.62.08-1.22.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93ZM18.9 17A9.97 9.97 0 0 0 22 12c0-4.97-3.63-9.08-8.38-9.87L13 2.1v2.02A8.003 8.003 0 0 1 19.93 12h-2.04A5.99 5.99 0 0 0 13 7.1V5c-1.1 0-2 .9-2 2v2H7.07A5.99 5.99 0 0 0 6.1 13H4.07A8.003 8.003 0 0 1 11 4.07V2.05A9.97 9.97 0 0 0 2 12c0 2.73 1.1 5.2 2.87 7h.01L6 17.87C7.5 19.24 9.6 20 12 20c1.69 0 3.28-.42 4.67-1.16L18.9 17Z',
  // Tennis -- racket/ball
  tennis:
    'M18.5 2.5a4.25 4.25 0 0 0-6.01 0l-4.24 4.24a4.25 4.25 0 0 0 0 6.01l.35.35-6.25 6.25a1 1 0 0 0 0 1.42l.88.88a1 1 0 0 0 1.42 0l6.25-6.25.35.35a4.25 4.25 0 0 0 6.01 0l4.24-4.24a4.25 4.25 0 0 0 0-6.01l-3-3Zm-1.41 1.41 3 3a2.25 2.25 0 0 1 0 3.18l-4.24 4.24a2.25 2.25 0 0 1-3.18 0l-3-3a2.25 2.25 0 0 1 0-3.18l4.24-4.24a2.25 2.25 0 0 1 3.18 0Z',
  // American football
  'american-football':
    'M20.5 3.5a1 1 0 0 0-1-1C16.1 2 12.76 3.66 10.4 6.02L6.02 10.4A12.28 12.28 0 0 0 2.5 19.5a1 1 0 0 0 1 1c3.4.5 6.74-1.16 9.1-3.52l4.38-4.38A12.28 12.28 0 0 0 20.5 3.5ZM9 15l-2-2 5-5 2 2-5 5Zm5.5-5.5-2-2 1.5-1.5 2 2-1.5 1.5Z',
  // Baseball -- ball with stitches
  baseball:
    'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2ZM7.3 7.7a7.95 7.95 0 0 1 2.35-3.36 8.05 8.05 0 0 1 0 4.72L7.3 7.7Zm0 8.6 2.35-1.36a8.05 8.05 0 0 1 0 4.72 7.95 7.95 0 0 1-2.35-3.36ZM16.7 7.7a7.95 7.95 0 0 1-2.35 3.36 8.05 8.05 0 0 1 0-4.72L16.7 7.7Zm0 8.6-2.35 1.36a8.05 8.05 0 0 1 0-4.72 7.95 7.95 0 0 1 2.35 3.36Z',
  // Ice hockey -- stick & puck
  'ice-hockey':
    'M18 2l-6 6-2.5 1L4 14.5c-.7.7-.7 1.8 0 2.5l3 3c.7.7 1.8.7 2.5 0L15 14.5l1-2.5 6-6V2h-4Zm1 2h1v1l-5 5-1.5.5-1-1L17 4h2v0Zm-8 12a2 2 0 1 1 0 4 2 2 0 0 1 0-4Z',
  // MMA -- fist
  mma:
    'M17 2a3 3 0 0 0-3 3v1h-1a3 3 0 0 0-3 3v1H9a3 3 0 0 0-3 3v4a7 7 0 0 0 14 0v-8a3 3 0 0 0-3-3V5a3 3 0 0 0 0-3Zm1 7a1 1 0 0 1 1 1v7a5 5 0 0 1-10 0v-4a1 1 0 0 1 1-1h1v1a1 1 0 0 0 2 0V9a1 1 0 0 1 1-1h1v2a1 1 0 0 0 2 0V7a1 1 0 0 1 1-1Zm-1-5a1 1 0 0 1 1 1v1h-2V5a1 1 0 0 1 1-1Z',
  // Boxing -- glove
  boxing:
    'M19 4h-1a5 5 0 0 0-4.58 3H11a5 5 0 0 0-5 5v4a5 5 0 0 0 5 5h5a5 5 0 0 0 5-5V7a3 3 0 0 0-2-3Zm0 12a3 3 0 0 1-3 3h-5a3 3 0 0 1-3-3v-4a3 3 0 0 1 3-3h3v3a1 1 0 0 0 2 0V9a3 3 0 0 1 3-3h1v10Z',
  // Cricket -- bat & ball
  cricket:
    'M19.07 3.51a3.42 3.42 0 0 0-4.84 0L8.29 9.45a1 1 0 0 0 0 1.42l4.84 4.84a1 1 0 0 0 1.42 0l5.94-5.94a3.42 3.42 0 0 0 0-4.84l-1.42-1.42ZM6.88 13.71l-3.17 3.17a2 2 0 0 0 0 2.83l.59.59a2 2 0 0 0 2.83 0l3.17-3.17-3.42-3.42ZM5 17a1 1 0 1 1 0 2 1 1 0 0 1 0-2Z',
  // Rugby union
  'rugby-union':
    'M20.49 3.51a1 1 0 0 0-.86-.49 13.6 13.6 0 0 0-9.2 3.52L5.51 11.46A13.6 13.6 0 0 0 2 20.66a1 1 0 0 0 .49.86A1 1 0 0 0 3 22a13.6 13.6 0 0 0 9.54-3.98l4.92-4.92A13.6 13.6 0 0 0 21 3.9a1 1 0 0 0-.51-.39ZM9 15l-2-2 6-6 2 2-6 6Z',
  // Rugby league (same shape, different color)
  'rugby-league':
    'M20.49 3.51a1 1 0 0 0-.86-.49 13.6 13.6 0 0 0-9.2 3.52L5.51 11.46A13.6 13.6 0 0 0 2 20.66a1 1 0 0 0 .49.86A1 1 0 0 0 3 22a13.6 13.6 0 0 0 9.54-3.98l4.92-4.92A13.6 13.6 0 0 0 21 3.9a1 1 0 0 0-.51-.39ZM9 15l-2-2 6-6 2 2-6 6Z',
  // Golf -- flag on green (stroke-based)
  golf:
    'M12 2v20M12 2l6 4-6 4M6 18c0-1.5 2.7-3 6-3s6 1.5 6 3',
  // Esports -- gamepad
  esports:
    'M6.5 6A4.5 4.5 0 0 0 2 10.5v2A4.5 4.5 0 0 0 6.5 17h1.59a2 2 0 0 0 1.66-.89L11 14h2l1.25 2.11a2 2 0 0 0 1.66.89h1.59A4.5 4.5 0 0 0 22 12.5v-2A4.5 4.5 0 0 0 17.5 6h-11ZM8 10v1.5h1.5v1H8V14H7v-1.5H5.5v-1H7V10h1Zm7 0a1 1 0 1 1 0 2 1 1 0 0 1 0-2Zm2 2a1 1 0 1 1 0 2 1 1 0 0 1 0-2Z',
  // Table tennis -- paddle
  'table-tennis':
    'M18.36 2.64a5 5 0 0 0-7.07 0L9.17 4.76A7 7 0 0 0 7 9.73V10l-4.65 4.65a1.5 1.5 0 0 0 0 2.12l4.88 4.88a1.5 1.5 0 0 0 2.12 0L14 17h.27a7 7 0 0 0 4.97-2.17l2.12-2.12a5 5 0 0 0 0-7.07l-3-3Z',
  // Volleyball
  volleyball:
    'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2Zm0 2c1.86 0 3.58.64 4.94 1.71L12 9.47l-4.94-3.76A7.96 7.96 0 0 1 12 4Zm-8 8c0-1.76.57-3.39 1.53-4.71L10 10.76l-1.95 5.97L4.27 14.8A7.96 7.96 0 0 1 4 12Zm8 8a7.96 7.96 0 0 1-5.67-2.35l3.72-1.91H13.95l3.72 1.91A7.96 7.96 0 0 1 12 20Zm7.73-5.2-3.78 1.93L14 10.76l4.47-3.47A7.96 7.96 0 0 1 20 12c0 .97-.18 1.9-.5 2.76l.23.04Z',
  // Darts -- dartboard
  darts:
    'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2Zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16Zm0-14a6 6 0 1 0 0 12 6 6 0 0 0 0-12Zm0 10a4 4 0 1 1 0-8 4 4 0 0 1 0 8Zm0-6a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z',

  // ---------- NEW SPORTS ----------

  // Cycling -- bicycle
  cycling:
    'M5 18a4 4 0 1 1 0-8 4 4 0 0 1 0 8Zm0-2a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm14 2a4 4 0 1 1 0-8 4 4 0 0 1 0 8Zm0-2a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM5 14l4-7h4l1 3h5M9 7l3 7M14 10l-3 4',
  // F1 -- racing car silhouette
  f1:
    'M3 14h1l1-2h3l1-2h5l2 2h4l2 2v2h-2a2 2 0 1 1-4 0H8a2 2 0 1 1-4 0H3v-2Zm4 2a1 1 0 1 0 0 2 1 1 0 0 0 0-2Zm12 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z',
  // Handball -- hand with ball
  handball:
    'M12 2a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm0 2a2 2 0 1 1 0 4 2 2 0 0 1 0-4ZM7 12a1 1 0 0 0-1 1v3l-2 4a1 1 0 0 0 .4 1.4 1 1 0 0 0 1.4-.4l2.2-4.4V13a1 1 0 0 0-1-1Zm10 0a1 1 0 0 0-1 1v3.6l2.2 4.4a1 1 0 0 0 1.4.4 1 1 0 0 0 .4-1.4l-2-4v-3a1 1 0 0 0-1-1Zm-5 0a1 1 0 0 0-1 1v7a1 1 0 0 0 2 0v-7a1 1 0 0 0-1-1Z',
  // Snooker -- pool ball
  snooker:
    'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2Zm0 2a8 8 0 1 1 0 16 8 8 0 0 1 0-16Zm0 5a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm0 1.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Z',
  // Badminton -- shuttlecock
  badminton:
    'M12 2l-2 6 2 2 2-2-2-6Zm-4 7l3 3-5 8a1 1 0 0 0 .8 1.5 1 1 0 0 0 .9-.5l5.3-9 5.3 9a1 1 0 0 0 .9.5 1 1 0 0 0 .8-1.5l-5-8 3-3-2-2-2 2-2-2-2 2Z',
  // Horse racing -- horse head
  'horse-racing':
    'M20 4l-2 1-3-1c-2 0-4 1-5 3l-1 3-4 1v2l3 1 1 5h2l-1-5 2-1 3 6h2l-3-7 2-3 3 1 1-2-1-1 1-3Zm-7 6a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z',
  // Greyhound racing -- dog silhouette
  'greyhound-racing':
    'M21 8l-3 1-2-2h-2l-3 2-4-1-3 2v2l2 1-1 3-2 3h2l2-3 2 1 1 3h2l-1-4 3-1 2 2h2l-1-3 3-1v-2l-2-1 2-1V8Zm-8 3a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z',
  // Futsal -- ball (similar to football but with distinct pattern)
  futsal:
    'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2Zm0 2a8 8 0 1 1 0 16 8 8 0 0 1 0-16Zm-2 4l4 0 2 3-1 4H9l-1-4 2-3Zm2 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z',
  // Water polo -- ball with water
  'water-polo':
    'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2Zm0 2a8 8 0 1 1 0 16 8 8 0 0 1 0-16ZM7 12c1.5 0 1.5 1 3 1s1.5-1 3-1 1.5 1 3 1 1.5-1 3-1M7 15c1.5 0 1.5 1 3 1s1.5-1 3-1 1.5 1 3 1 1.5-1 3-1M12 6a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z',
  // Aussie rules -- oval ball
  'aussie-rules':
    'M12 3C7 3 3 7 3 12s4 9 9 9 9-4 9-9-4-9-9-9Zm0 2c3.87 0 7 3.13 7 7s-3.13 7-7 7-7-3.13-7-7 3.13-7 7-7Zm-3 5v2h6v-2H9Zm0 3v2h6v-2H9Z',
  // Surfing -- wave
  surfing:
    'M2 18c2-2 4-3 6-3s4 1 6 3 4 3 6 3M5 13l4-6 3 4 4-8M5 13l2-1',
  // Skiing -- skier
  skiing:
    'M14 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm-4 6l4 2 3-3 1.5 1.5L15 13l-1 5h-2l1-4-3-2-2 4H6l2-4 2-3Zm-6 9h16',
  // CS2 -- crosshair
  cs2:
    'M12 2v4m0 12v4m8-10h4M2 12h4m6-7a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm0 3a4 4 0 1 1 0 8 4 4 0 0 1 0-8Zm0 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z',
  // Dota 2 -- sword and shield
  'dota-2':
    'M6 2l-4 4v5l5 5 3-3-4-4 1-1 4 4 3-3-5-5V4L6 2Zm12 0l4 4v5l-5 5-3-3 4-4-1-1-4 4-3-3 5-5V4l2-2ZM8 16l-4 4h4v-4Zm8 0v4h4l-4-4Z',
  // League of Legends -- shield/crest
  'league-of-legends':
    'M12 2L4 6v6c0 5.25 3.4 10.15 8 11.35C16.6 22.15 20 17.25 20 12V6l-8-4Zm0 2.2l6 3v4.8c0 4.2-2.7 8.12-6 9.08-3.3-.96-6-4.88-6-9.08V7.2l6-3Zm0 3.8l-3 2v4l3 2 3-2v-4l-3-2Z',
  // Valorant -- angular crosshair
  valorant:
    'M12 2L8 6v4l-4 2 4 2v4l4 4 4-4v-4l4-2-4-2V6l-4-4Zm0 3l2 2v3l3 2-3 2v3l-2 2-2-2v-3l-3-2 3-2V7l2-2Z',
  // Rainbow Six -- shield with cross
  'rainbow-six':
    'M12 2L4 6v5c0 5.55 3.4 10.74 8 12 4.6-1.26 8-6.45 8-12V6l-8-4Zm0 2.18l6 3V11c0 4.52-2.77 8.7-6 9.82-3.23-1.12-6-5.3-6-9.82V7.18l6-3ZM11 9v3H8v2h3v3h2v-3h3v-2h-3V9h-2Z',
  // StarCraft 2 -- star
  'starcraft-2':
    'M12 2l2.9 5.9L21 9.2l-4.5 4.4 1.1 6.3L12 17l-5.6 2.9 1.1-6.3L3 9.2l6.1-1.3L12 2Z',
  // Call of Duty -- rifle crosshair/scope
  'call-of-duty':
    'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 2a8 8 0 1 1 0 16 8 8 0 0 1 0-16Zm0 2v3m0 6v3m-5-7H4m3 0h3m2 0h3m2 0h3M12 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z',
  // EA Sports FC -- game controller
  'ea-sports-fc':
    'M7.5 4A3.5 3.5 0 0 0 4 7.5v2A3.5 3.5 0 0 0 6.06 12.8L4.5 18a1.5 1.5 0 0 0 1.42 1.97h.58A1.5 1.5 0 0 0 8 18.85L9.08 15h5.84L16 18.85a1.5 1.5 0 0 0 1.5 1.12h.58A1.5 1.5 0 0 0 19.5 18l-1.56-5.2A3.5 3.5 0 0 0 20 9.5v-2A3.5 3.5 0 0 0 16.5 4h-9ZM8 7v1.5h1.5V10H8v1.5H6.5V10H5V8.5h1.5V7H8Zm7.25 0a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5Zm2 2a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5Z',
  // Rocket League -- car with rocket boost
  'rocket-league':
    'M3 13h1l1-2h3l2-2h4l2 2h3l1 2h2v3h-2a2 2 0 1 1-4 0H8a2 2 0 1 1-4 0H3v-3Zm3 3a1 1 0 1 0 0 2 1 1 0 0 0 0-2Zm12 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2ZM7 8l-3 2h4l2-2H7Zm10 0h-3l2 2h4l-3-2Z',
  // Politics -- ballot box
  politics:
    'M5 3a2 2 0 0 0-2 2v2h18V5a2 2 0 0 0-2-2H5Zm-2 6v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9H3Zm7 1h4v2h-4v-2Zm-2 4h8v2H8v-2Z',
  // Entertainment -- film/movie
  entertainment:
    'M18 3H6a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3h12a3 3 0 0 0 3-3V6a3 3 0 0 0-3-3ZM5 6a1 1 0 0 1 1-1h1v3H5V6Zm0 4h2v4H5v-4Zm0 6h2v3H6a1 1 0 0 1-1-1v-2Zm14 2a1 1 0 0 1-1 1h-1v-3h2v2Zm0-4h-2v-4h2v4Zm0-6h-2V5h1a1 1 0 0 1 1 1v2Zm-4-3v14H9V5h6Z',
};

/**
 * Sport slugs that use stroke-style rendering need their paths listed here
 * so the component switches from fill to stroke rendering.
 */
const STROKE_SPORT_PATHS = new Set([
  'golf',
  'cycling',
  'surfing',
  'skiing',
  'cs2',
  'call-of-duty',
  'water-polo',
  'f1',
  'rocket-league',
]);

interface SportIconProps {
  slug: string;
  size?: number;
  className?: string;
  /** Optional emoji from the database sport record */
  emoji?: string | null;
}

export function SportIcon({ slug, size = 20, className = '', emoji }: SportIconProps) {
  const path = SPORT_PATHS[slug];

  // 1. Custom inline SVG
  if (path) {
    const color = SPORT_COLORS[slug] || '#a78bfa';
    const isStroke = STROKE_SPORT_PATHS.has(slug);
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill={isStroke ? 'none' : color}
        stroke={isStroke ? color : 'none'}
        strokeWidth={isStroke ? 2 : undefined}
        strokeLinecap={isStroke ? 'round' : undefined}
        strokeLinejoin={isStroke ? 'round' : undefined}
        className={`shrink-0 ${className}`}
        aria-hidden="true"
      >
        <path d={path} />
      </svg>
    );
  }

  // 2. DB emoji fallback
  if (emoji) {
    return (
      <span
        className={`shrink-0 leading-none ${className}`}
        style={{ fontSize: size }}
        role="img"
        aria-hidden="true"
      >
        {emoji}
      </span>
    );
  }

  // 3. Generic trophy icon
  return <Trophy size={size} className={`shrink-0 text-gray-500 ${className}`} aria-hidden="true" />;
}
