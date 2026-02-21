# COMPLETE FRONTEND REDESIGN — Cloudbet-Style Professional UI

You are redesigning the ENTIRE frontend of CryptoBet to look and feel like a premium, professional crypto sportsbook + casino platform inspired by Cloudbet.com. This is a COMPLETE rebuild of every page, component, and interaction.

**Do NOT change any backend code. Only rebuild frontend files.**

Read the existing frontend code first to understand the API endpoints and data structures, then rebuild every single page with the design system below.

---

## PART 1: DESIGN SYSTEM & TOKENS

### Color Palette
```css
:root {
  /* Backgrounds */
  --bg-primary: #0F0F12;         /* Main background - very dark */
  --bg-secondary: #1A1B1F;       /* Cards, header, sidebar, nav */
  --bg-tertiary: #22232A;        /* Hover states, elevated cards */
  --bg-input: #2A2B33;           /* Input fields, search bars */
  --bg-modal: #1E1F25;           /* Modals, bottom sheets */

  /* Accent Colors */
  --accent-purple: #8D52DA;      /* Primary brand color */
  --accent-purple-light: #A66DE8; /* Hover state */
  --accent-purple-dark: #6B3AAF;  /* Active/pressed state */
  --accent-purple-glow: rgba(141, 82, 218, 0.15); /* Glow effects */
  --accent-green: #BFFF00;       /* CTA buttons, "Add funds", win indicators */
  --accent-green-dark: #9ACC00;  /* Green hover */

  /* Status Colors */
  --status-win: #00E676;         /* Win, profit, success */
  --status-lose: #FF5252;        /* Loss, error, danger */
  --status-live: #FF4444;        /* LIVE badge - pulsing red */
  --status-warning: #FFB300;     /* Warnings, pending */
  --status-info: #29B6F6;        /* Info, links */

  /* Text Colors */
  --text-primary: #FFFFFF;
  --text-secondary: rgba(255, 255, 255, 0.60);
  --text-tertiary: rgba(255, 255, 255, 0.40);
  --text-disabled: rgba(255, 255, 255, 0.20);
  --text-on-green: #000000;      /* Text on lime green buttons */

  /* Borders */
  --border-default: rgba(255, 255, 255, 0.08);
  --border-hover: rgba(255, 255, 255, 0.15);
  --border-active: rgba(141, 82, 218, 0.50);
  --border-card: rgba(255, 255, 255, 0.06);

  /* Odds-specific colors */
  --odds-up: #00E676;            /* Odds increased - green flash */
  --odds-down: #FF5252;          /* Odds decreased - red flash */
  --odds-bg: #2A2B33;            /* Odds button background */
  --odds-bg-hover: #353640;      /* Odds button hover */
  --odds-bg-selected: rgba(141, 82, 218, 0.25); /* Selected odds */
  --odds-border-selected: #8D52DA;

  /* Shadows */
  --shadow-card: 0 2px 8px rgba(0, 0, 0, 0.3);
  --shadow-elevated: 0 8px 32px rgba(0, 0, 0, 0.5);
  --shadow-purple-glow: 0 0 20px rgba(141, 82, 218, 0.3);

  /* Border Radius */
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-full: 9999px;

  /* Transitions */
  --transition-fast: 150ms ease;
  --transition-normal: 250ms ease;
  --transition-slow: 400ms ease;
}
```

### Typography
```css
/* Font Stack — Use system fonts optimized for dark UI */
font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;

/* Scale */
--font-xs: 11px;      /* Badges, micro text */
--font-sm: 12px;      /* Captions, labels */
--font-base: 14px;    /* Body text, odds, markets */
--font-md: 16px;      /* Inputs (prevent zoom on iOS), section titles */
--font-lg: 18px;      /* Page titles */
--font-xl: 24px;      /* Hero numbers, big stats */
--font-2xl: 32px;     /* Feature numbers */
--font-3xl: 48px;     /* Crash game multiplier */

/* Weights */
--weight-normal: 400;
--weight-medium: 500;
--weight-semibold: 600;
--weight-bold: 700;
--weight-black: 900;  /* Crash multiplier only */
```

### Spacing System
```
4px — micro gap (icon to text)
8px — tight gap (within components)
12px — standard gap (between elements, mobile padding)
16px — section gap
20px — card padding
24px — desktop content padding
32px — section margin
48px — large section gap
```

---

## PART 2: GLOBAL LAYOUT

### Desktop Layout (≥1024px)
```
┌─────────────────────────────── FULL WIDTH ────────────────────────────────┐
│ [HEADER: 60px fixed top]                                                  │
│ Logo | Sports Casino Esports Promos | Search | Balance+Currency | Add     │
│ Funds | Rewards | Notifications(bell) | Chat | Avatar                     │
├──────────┬──────────────────────────────────────┬─────────────────────────┤
│ LEFT     │ MAIN CONTENT                          │ RIGHT SIDEBAR           │
│ SIDEBAR  │ (scrollable)                          │ BET SLIP                │
│ 240px    │                                        │ 320px                   │
│          │                                        │                         │
│ Sports   │                                        │ [Bet slip content]      │
│ list     │                                        │ [My Bets tab]           │
│ with     │                                        │                         │
│ icons    │                                        │                         │
│ + count  │                                        │                         │
│          │                                        │                         │
│ Casino   │                                        │                         │
│ categories                                        │                         │
│          │                                        │                         │
├──────────┴──────────────────────────────────────┴─────────────────────────┤
│ [FOOTER with links, licenses, responsible gambling, languages]             │
└───────────────────────────────────────────────────────────────────────────┘
```

### Mobile Layout (<1024px)
```
┌──────────────────────────┐
│ [HEADER: 60px fixed]     │
│ Logo | Balance | Add | ☰ │
├──────────────────────────┤
│ [STICKY TABS below header│
│ Sports|Casino|Esports|Live│
├──────────────────────────┤
│                          │
│ MAIN CONTENT             │
│ (full width, scrollable) │
│ padding: 12px            │
│                          │
│                          │
├──────────────────────────┤
│ [BOTTOM NAV: 56px fixed] │
│ 🏠Home 🎰Casino ⚽Sports│
│  📋MyBets 👤Account     │
└──────────────────────────┘
```

### Header Component (Desktop)
Build a fixed header with:
- **Left**: CryptoBet logo (create an SVG logo — a stylized lightning bolt or abstract "C" shape in purple/lime)
- **Center Nav**: `Sports` | `Casino` | `Esports` | `Promos` — each is a tab, active has purple underline + purple text
- **Search**: Magnifying glass icon that expands into a search input on click (search events, games, markets)
- **Right Section**:
  - Balance display: crypto icon + amount + dropdown arrow (click to switch currency)
  - "Add funds" button — lime green (#BFFF00), black text, rounded, 600 weight
  - Rewards icon (gift/magnet icon) — links to rewards page
  - Notification bell — with unread count badge (red dot)
  - Chat icon — opens live chat widget
  - User avatar circle — opens account dropdown

### Header Component (Mobile)
- **Left**: Hamburger menu (☰) — opens full-screen slide-out menu
- **Center**: CryptoBet logo
- **Right**: Balance display (compact) + "Add funds" button + user avatar
- Below header: Scrollable horizontal tab bar: Sports | Casino | Esports | Live | Virtuals

### Left Sidebar (Desktop only)
**When on Sports section:**
- Collapsible list of all sports with icons and event counts
- Each sport: icon + name + live count badge
- Popular sports at top: ⚽ Football, 🏀 Basketball, 🎾 Tennis, 🏈 American Football, ⚾ Baseball, 🥊 MMA/Boxing
- Esports section: CS2, Dota 2, LoL, Valorant
- Specials: Politics, Entertainment
- "A-Z" toggle to show all sports alphabetically
- Hover: sport row highlights with --bg-tertiary

**When on Casino section:**
- Categories list: Slots, Live Casino, Table Games, Crash, Provably Fair, New Games, Popular, High Roller, Feature Buy, Megaways
- Providers filter: list of game providers with checkboxes
- "Hot" and "Trending" quick filters

### Right Sidebar — Bet Slip (Desktop)
- Two tabs at top: **Bet Slip** | **My Bets**
- When empty: show illustration + "Your bet slip is empty. Browse sports to add selections."
- When has selections:
  - Each selection card shows: Sport icon + Event name + Market + Selection name + Odds button (editable)
  - Remove (X) button per selection
  - Toggle: **Single** | **Parlay** (accumulator)
  - Stake input with currency icon + quick amount buttons ($1, $5, $10, $25, $50, $100)
  - Potential win calculation (auto-updates)
  - "Place Bet" button — full width, lime green, bold
  - Odds change indicator: if odds moved, show old odds crossed out + new odds with green/red flash
- **My Bets tab**:
  - Sub-tabs: Open | Settled
  - Open bets show: selections, current odds, stake, potential win, Cash Out button (green)
  - Settled bets show: result (Won/Lost/Void badge), payout amount

### Bottom Navigation (Mobile)
- 5 items, fixed at bottom, 56px height
- Icons + labels: Home | Sports | Casino | My Bets | Account
- Active item: purple icon + purple text
- Inactive: white/60% opacity
- Each icon should be an SVG, 24px

### Footer
- Dark background (#0F0F12 with top border)
- Sections: About | Sports | Casino | Support | Legal
- Language selector dropdown (19 languages)
- Crypto icons row (BTC, ETH, USDT, LTC, etc.)
- License info: "Licensed by Curaçao eGaming"
- Responsible gambling logos row
- Copyright + links to Terms, Privacy, AML Policy

---

## PART 3: ALL PAGES — COMPLETE SPECIFICATIONS

### PAGE 1: Homepage / Landing
**Desktop**: Hero banner area with:
- Auto-rotating carousel (3-4 slides): Welcome Package ($2,500), Featured match with odds, Casino promotion, Esports highlight
- Each slide: full-width image/gradient background, headline text, CTA button
- Below: "Featured Events" grid — 4-6 cards showing upcoming big events with odds
- Below: "Popular Games" grid — 8 game thumbnails from casino
- Below: "Live Now" section — horizontal scroll of live events with score + odds
- Real-time activity feed at bottom: "Player X won $1,234 on Aviator" ticker

**Mobile**: Same but stacked, single column, smaller cards

### PAGE 2: Sports Lobby
**Left sidebar**: Sport list with icons + live count
**Main area**:
- Top: Featured/highlighted matches in larger cards with team logos and odds buttons
- "Live" tab → shows only live events with red LIVE badge + timer + score
- "Upcoming" tab → grouped by competition/league
- Each event row:
  ```
  [Time/Date]  [Team A]  [Odds A]  [Draw]  [Odds B]  [Team B]  [+37 more markets →]
  ```
- Odds buttons: rectangular, --odds-bg background, clickable
  - On click: odds button gets purple border + purple background tint → adds to bet slip
  - On odds change: flash green (up) or red (down) for 2 seconds
- Competition headers: collapsible sections with league name + flag icon
- Quick filters: "Today" | "Tomorrow" | "This Week" | "Outrights"

### PAGE 3: Event Detail (Single Match)
**Header**: Sport > Competition > Event breadcrumb
- Team A logo + name vs Team B logo + name
- Date/Time or "LIVE" badge with score
- Star icon to favorite
- Live streaming button (if available)
**Score section (if live)**: Large score display, period/set info, time elapsed
**Markets section**:
- Tab navigation: Popular | All | Goals | Handicap | Corners | Cards | Player Props | Specials
- Each market is a collapsible accordion:
  ```
  [▼ Match Result]
  [Team A — 1.85]  [Draw — 3.40]  [Team B — 4.20]

  [▼ Over/Under Goals]
  Over 2.5 — 1.95    Under 2.5 — 1.85
  Over 3.5 — 2.60    Under 3.5 — 1.50
  ```
- Odds buttons: click to add to bet slip with purple highlight
- Market info icon (?) with tooltip explaining the market
**Bet Builder section**: "Build Your Bet" — combine multiple selections from same game
**Stats tab**: Head-to-head, form guide, recent results table

### PAGE 4: Live Betting
- Full screen dedicated live page
- Left panel: list of all live events, grouped by sport with live scores updating via WebSocket
- Center: Selected event details with live odds and markets (auto-updating)
- Right: Bet slip
- Visual indicators:
  - Red pulsing "LIVE" dot badge
  - Odds flash green/red on change (CSS animation, 2s duration)
  - "Danger" overlay when market is suspended (semi-transparent, "Market Suspended" text)
  - Timer showing how long market has been live
- Live score: large, prominent, updating in real-time
- Match tracker/timeline visualization showing key events (goals, cards, etc.)

### PAGE 5: Casino Lobby
**Hero**: Full-width banner — "Play 3,000+ Games" with provider logos
**Category tabs** (horizontal scrollable on mobile):
`All` | `Slots` | `Live Casino` | `Table Games` | `Crash` | `Provably Fair` | `New` | `Popular` | `High Roller`
**Filters bar**:
- Search input (magnifying glass)
- Provider dropdown/filter
- Sort: Popular | New | A-Z
- Grid/List view toggle
**Game grid**:
- Card for each game: thumbnail image (16:9 or 1:1), game name, provider name
- On hover: overlay with "Play" button + "Demo" link
- Badges on thumbnails: "NEW", "HOT", "JACKPOT", provider logo
- Live Casino cards show: live indicator + active players count + dealer name
**Below game grid**:
- Live payout feed: "🎉 Player*** won $X on [Game]" — auto-scrolling ticker
- Provider logos row
**Pagination**: Load more button or infinite scroll

### PAGE 6: Casino Game Page (Slots / Table)
- Full-screen game iframe/embed with controls
- Below: Game info (RTP, volatility, provider, min/max bet)
- Related games carousel

### PAGE 7: Crash Game (Aviator-style)
**This is a KEY page — build it beautifully:**
- **Center**: Large canvas/SVG area showing the multiplier curve graph
  - X-axis: time, Y-axis: multiplier
  - The line draws in real-time, curving up
  - Color: gradient from green to yellow to red as multiplier increases
  - When crash: explosion animation, line turns red, "CRASHED @ X.XXx" text
  - Background: subtle grid lines
- **Multiplier display**: Huge number (48px+, --weight-black), updating in real-time
  - Format: "1.00x" → "1.50x" → "2.34x" etc.
  - Color transitions: white → green → yellow → red
- **Bet panel** (left side or below on mobile):
  - Two bet slots (Bet A and Bet B) — user can place two simultaneous bets
  - Each: stake input + "Auto Cash-Out" toggle with target multiplier input
  - "Place Bet" button (lime green) / "Cash Out" button (when in-flight, pulsing green)
  - "Cancel" button (during waiting phase)
- **Active bets panel** (right side): shows all current players' bets + their cash-out points
- **History panel** (bottom): Previous round results as colored bubbles
  - Green bubbles: high multiplier (>2x)
  - Red bubbles: low multiplier (<2x)
  - Shows last 20-30 rounds
- **Provably fair**: small link "Verify Fairness" → opens modal with server seed hash, client seed, nonce

### PAGE 8: Dice Game
- Large result display with animated dice roll
- Slider to set over/under target (draggable)
- Multiplier and win chance display (auto-calculated)
- Bet input + "Roll" button
- Auto-bet settings panel (expandable)
- History of recent rolls (table)

### PAGE 9: Mines Game
- 5x5 grid of tiles (covered)
- Click to reveal: gem (win) or mine (lose)
- Progressive multiplier increases with each revealed gem
- "Cash Out" button showing current multiplier
- Bet input at bottom
- Mines count selector (1-24)

### PAGE 10: Plinko Game
- Triangular grid of pegs
- Ball drops animation from top
- Multiplier slots at bottom (color-coded: red in center = low, green at edges = high)
- Risk level selector: Low | Medium | High
- Rows selector: 8 | 12 | 16
- Bet input + "Drop" button

### PAGE 11: Coin Flip Game
- Large 3D coin animation (flipping)
- Choose Heads or Tails buttons
- 2x multiplier display
- Result with celebration animation on win

### PAGE 12: Virtual Sports
- Sport selection: Football | Basketball | Horse Racing | Tennis
- Event schedule showing next event countdown timer
- Live event visualization/animation
- Betting markets for upcoming virtual events
- Results of recent events

### PAGE 13: Wallet / Deposit Page
**Tabs**: Deposit | Withdraw | Swap | Transactions
**Deposit tab**:
- Currency selector grid (show crypto icons: BTC, ETH, USDT, LTC, etc.)
- Selected currency details:
  - QR code (large, centered)
  - Wallet address with "Copy" button
  - Network selector (e.g., for USDT: Ethereum, BNB Chain, Tron, Polygon)
  - "Minimum deposit: None" info
  - "Confirmations required: X" info
- **"Buy with Card" section**: MoonPay/Swapped widget integration
- **"Connect Wallet" section**: MetaMask, Ledger, Trust Wallet buttons (WalletConnect)

**Withdraw tab**:
- Currency selector
- Amount input with "Max" button
- Destination address input
- Network selector
- Fee display
- 2FA verification step (modal)
- "Withdraw" button

**Swap tab**:
- From currency + amount
- Arrow icon (⇄) — click to swap direction
- To currency + estimated amount
- Exchange rate display
- "Swap" button

**Transactions tab**:
- Table: Date | Type (deposit/withdraw/swap) | Currency | Amount | Status | TX Hash (linked to explorer)
- Filters: type, currency, date range
- Pagination

### PAGE 14: Account Settings
**Tabs/sections**:
- **Profile**: Nickname, email, date of birth, avatar upload
- **Security**: Change password, 2FA setup (QR code + TOTP), active sessions list
- **KYC Verification**: Upload ID, address proof, selfie — status badges (Unverified → Basic → Full)
- **Preferences**: Theme (Dark/Light), Language (19 options), Odds format (Decimal/Fractional/American), Default currency
- **Responsible Gambling**:
  - Deposit limit (daily/weekly/monthly) — input + "Set" button
  - Loss limit
  - Wager limit
  - Session time limit
  - Cooling-off period (24h / 1 week / 1 month) — big warning before confirming
  - Self-exclusion (6 months / 1 year / Permanent) — red button, double confirmation
  - Gambling assessment quiz (10 questions)
  - Reality check popup settings
- **API Keys**: List of API keys, create new, revoke, rate limit info

### PAGE 15: VIP & Rewards Dashboard
**THE most visually impressive page:**
- **VIP Tier display**:
  - Large badge/shield showing current tier (e.g., "Gold") with tier icon
  - Progress bar to next tier (e.g., "Gold → Emerald: 65% complete")
  - All 8 tiers shown: Bronze, Silver, Gold, Emerald, Sapphire, Ruby, Diamond, Blue Diamond
  - Each tier is a colored gem/shield icon
  - Completed tiers are lit up, future tiers are dimmed/locked
- **Rakeback section**:
  - Current rakeback rate (e.g., "8.5%")
  - "Add to Wallet" button — magnet icon animation
  - Accumulated rakeback amount ready to claim
  - Split display: "X goes to wallet, Y goes to calendar"
- **Rewards Calendar** (3 times daily):
  - Visual calendar grid showing today and upcoming days
  - Each day has slots: Morning | Afternoon | Evening
  - Available rewards show as gift icons — "Claim" button (lime green)
  - Claimed rewards show checkmark
  - Expired/missed show as locked/grayed out
  - Timer countdown to next unlock
- **TURBO section**:
  - Large circular timer/gauge when TURBO is active
  - Shows: "TURBO ACTIVE — 25% RAKEBACK — 47:32 remaining"
  - Purple glow pulsing animation when active
  - When inactive: "Claim a reward to activate TURBO"
- **Welcome Package tracker** (for new users):
  - Day progress (e.g., "Day 12 of 30")
  - Daily cash drop amount
  - Cash Vault: accumulated amount, unlocks on Day 30
  - 10% rakeback indicator
- **Level-Up Rewards**:
  - Milestone checkpoints on a progress bar
  - Cash rewards at each milestone
  - Total earned so far
- **Referral Dashboard**:
  - Unique referral code + "Copy" button
  - Shareable link
  - Share buttons: Twitter, Telegram, WhatsApp, Email
  - Stats: total referrals, active referrals, total earned
  - Referral activity table

### PAGE 16: My Bets Page
**Tabs**: Open Bets | Settled | All
- **Open bets**: Each bet card shows:
  - Bet type badge (Single / Parlay / System)
  - Selections list with odds
  - Stake + Potential win
  - Cash-Out button (green) with current cash-out value
  - Auto cash-out settings
  - Live indicator if event is in-play
- **Settled bets**: Same but with:
  - Result badge: Won (green) / Lost (red) / Void (gray) / Partial (yellow)
  - Actual payout
- **Bet detail modal**: Full breakdown of parlay legs, each leg result
- **Bet sharing**: "Share Bet" button → generates visual bet card image → share to Twitter/Telegram/WhatsApp

### PAGE 17: Promotions Page
- Grid of promotion cards
- Each card: image/banner, title, description, "Claim" or "Learn More" button
- Categories: Welcome | Sports | Casino | Seasonal | VIP
- Active promo code input at top

### PAGE 18: Help Center
- Search bar (prominent, top of page)
- Category grid: Account | Payments | Bonuses & Rewards | Sports Betting | Casino | Responsible Gambling
- Each category opens list of articles
- Article page: title, breadcrumb, content (Markdown rendered), "Was this helpful?" Yes/No buttons
- Live chat widget button (bottom-right, floating)

### PAGE 19: Blog
- Card grid with featured image, title, author, date, category tag
- Blog post page: hero image, title, author + avatar, date, rich content, related posts
- Category filter sidebar/tabs

### PAGE 20: Academy
- Course cards with progress indicators
- Course page: lessons list with checkmarks for completed
- Lesson page: content + quiz at end
- Progress bar for overall course completion

### PAGE 21: Admin Dashboard
**Completely separate layout** — sidebar nav + top bar + content
**Dark theme with data-focused design**
- **Home/KPIs**: Revenue chart, active users, bets placed, deposits/withdrawals (line charts + counters)
- **Users**: Searchable table, user detail panel, ban/suspend actions, KYC status
- **Payments**: Currency management, withdrawal approval queue, admin wallet balances
- **Sportsbook**: Event management, market creation, settlement tools, odds margin config
- **Casino**: Game management, provider status, RTP monitoring
- **Rewards**: VIP tier config, rakeback settings, TURBO config, promotion builder
- **Reports**: P&L, revenue breakdown, deposit/withdrawal charts (use Recharts)
- **Risk**: Large bet alerts, anomaly flags, user pattern detection
- **Content**: Blog CMS, Help center editor, Academy editor
- **Settings**: Site config, geo-restrictions, notification templates

### PAGE 22: Auth Pages
**Sign Up**:
- Clean centered card on dark background
- Email + Password fields
- "Or sign up with" → Google and GitHub OAuth buttons
- Optional promo code toggle/input
- Terms checkbox
- "Create Account" button (purple)

**Login**:
- Email + Password
- "Forgot password?" link
- "Or sign in with" → Google and GitHub
- "Sign In" button (purple)

**2FA Verification**:
- 6-digit code input (auto-focus, auto-advance between digits)
- Countdown timer for code expiry
- "Use backup code" link

---

## PART 4: ICONS & SVG SYSTEM

Create a complete SVG icon set. Do NOT use emoji. Use Lucide React icons where possible, and create custom SVGs for:

### Sport Icons (24x24 SVG, stroke style, 1.5px stroke)
- ⚽ Football/Soccer — ball outline
- 🏀 Basketball — ball with lines
- 🎾 Tennis — ball with arc
- 🏈 American Football — oval ball
- ⚾ Baseball — ball with stitching
- 🏒 Ice Hockey — stick and puck
- 🏐 Volleyball
- 🏓 Table Tennis — paddle and ball
- 🥊 MMA/Boxing — boxing glove
- 🏏 Cricket — bat and ball
- ⛳ Golf — flag on green
- 🏎️ F1/Racing — racing car
- 🎮 Esports — gamepad
- 🏇 Horse Racing — horse silhouette
- 🎯 Darts — dartboard
- ♟️ Chess — chess piece
- 🏉 Rugby — rugby ball
- 🚴 Cycling — bicycle

### Crypto Currency Icons (20x20 SVG, filled style)
- BTC (Bitcoin orange)
- ETH (Ethereum blue/purple)
- USDT (Tether green)
- USDC (blue)
- LTC (Litecoin gray)
- BNB (yellow)
- SOL (purple gradient)
- DOGE (yellow)
- XRP (dark)
- ADA (blue)
- MATIC (purple)
- TRX (red)
- DOT (pink)
- AVAX (red)
- TON (blue)

### UI Icons (using Lucide React)
- Home, Search, Bell, Settings, User, ChevronDown, ChevronRight, X, Plus, Minus
- Copy, ExternalLink, QrCode, Wallet, CreditCard, ArrowUpDown (swap)
- Star, Heart, Share2, Trophy, Gift, Zap (TURBO), Clock, Timer
- TrendingUp, TrendingDown, BarChart2, PieChart
- Shield, Lock, Eye, EyeOff, Key
- MessageCircle (chat), HelpCircle, BookOpen
- Check, AlertTriangle, Info

### Custom Animations
- LIVE badge: pulsing red dot (CSS animation, infinite)
- Odds change: green flash for up, red flash for down (0.5s)
- Bet placement success: confetti burst (canvas or CSS)
- Crash game: multiplier curve growing animation (canvas 2D)
- TURBO active: purple glow pulse around timer
- Cash-out: coin animation (CSS transform)
- Loading: skeleton screens with shimmer effect (CSS gradient animation)
- Page transitions: subtle fade + slide up (Framer Motion)

---

## PART 5: RESPONSIVE BREAKPOINTS

```css
/* Mobile first */
@media (min-width: 480px)  { /* Small tablet */ }
@media (min-width: 768px)  { /* Tablet */ }
@media (min-width: 1024px) { /* Desktop — show sidebar + bet slip */ }
@media (min-width: 1280px) { /* Large desktop */ }
@media (min-width: 1536px) { /* Ultra wide */ }
```

### Mobile-specific rules:
- ALL inputs must be 16px font-size minimum (prevents iOS zoom)
- ALL touch targets minimum 44x44px
- Bet slip becomes a bottom sheet (slide up from bottom)
- Left sidebar becomes hamburger menu
- Game grid: 2 columns on mobile, 3 on tablet, 4-5 on desktop
- Odds buttons: full-width on mobile in stacked layout
- Bottom navigation: always visible on mobile

---

## PART 6: ANIMATIONS & MICRO-INTERACTIONS (Framer Motion)

```tsx
// Page transition wrapper
<motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>

// Odds change flash
<motion.button animate={{ backgroundColor: oddsChanged === 'up' ? '#00E676' : oddsChanged === 'down' ? '#FF5252' : '#2A2B33' }} transition={{ duration: 0.5 }}>

// Bet slip slide up (mobile)
<motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25 }}>

// Crash multiplier counter
<motion.span key={multiplier} initial={{ scale: 1.2 }} animate={{ scale: 1 }} transition={{ type: 'spring' }}>

// Card hover
<motion.div whileHover={{ y: -4, boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>

// Loading skeleton shimmer
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
.skeleton {
  background: linear-gradient(90deg, #1A1B1F 25%, #2A2B33 50%, #1A1B1F 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}
```

---

## PART 7: STATE MANAGEMENT (Zustand Stores)

Ensure these stores exist and are used by the new UI:
- **authStore**: user, tokens, login/logout, isAuthenticated
- **betSlipStore**: selections[], betType (single/parlay), stakes, addSelection, removeSelection, clearSlip, placeBet
- **walletStore**: balances[], activeCurrency, switchCurrency, deposit/withdraw
- **sportsStore**: sports list, events, live events, odds data
- **casinoStore**: games, categories, providers, filters
- **rewardsStore**: vipTier, rakeback, calendar, turbo status
- **uiStore**: theme, sidebarOpen, betSlipOpen, modals, notifications
- **socketStore**: WebSocket connection, live odds updates, live scores, crash game state

---

## PART 8: COMPONENT LIBRARY

Create these reusable components in `frontend/src/components/`:

### Core UI
- `Button` — variants: primary (purple), cta (lime green), ghost, outline, danger
- `Input` — with label, error state, icon prefix
- `Select` — custom dropdown with search
- `Modal` — centered overlay with backdrop blur
- `BottomSheet` — mobile slide-up panel
- `Tabs` — horizontal tab navigation
- `Badge` — status badges (LIVE, NEW, HOT, WON, LOST)
- `Card` — base card with hover effect
- `Tooltip` — on hover info popups
- `Skeleton` — loading placeholder with shimmer
- `Toast` — notification toasts (success, error, info)

### Sportsbook
- `OddsButton` — clickable odds with selection state + flash animation
- `EventRow` — single event with teams + odds + market count
- `LiveBadge` — pulsing red dot + "LIVE" text
- `ScoreBoard` — live score display component
- `MarketAccordion` — collapsible market with odds grid
- `BetSlip` — full bet slip component
- `BetCard` — single bet display (for My Bets)
- `CashOutButton` — green cash-out with value

### Casino
- `GameCard` — thumbnail + name + provider + hover overlay
- `GameGrid` — responsive grid of game cards
- `CrashGraph` — canvas-based multiplier chart
- `ProvablyFairVerifier` — seed verification modal

### Wallet
- `CurrencySelector` — grid of crypto icons
- `QRCodeDisplay` — QR code with copy button
- `BalanceDisplay` — currency icon + formatted amount
- `TransactionRow` — single transaction in history

### Rewards
- `VipTierBadge` — colored tier badge/shield
- `VipProgressBar` — progress to next tier
- `RewardsCalendar` — daily claim grid
- `TurboTimer` — circular countdown gauge
- `RakebackDisplay` — current rate + claim button

---

## PART 9: EXECUTION INSTRUCTIONS

### Build Order:
1. **Design system**: Create global CSS variables, Tailwind config, base styles
2. **Icon system**: Create all SVG sport icons + crypto icons + import Lucide
3. **Component library**: Build all reusable components listed above
4. **Global layout**: Header, Sidebar, Bottom Nav, Footer, Bet Slip shell
5. **Auth pages**: Sign Up, Login, 2FA
6. **Homepage**: Landing with hero, featured events, popular games
7. **Sports pages**: Lobby, Event detail, Live betting
8. **Casino pages**: Lobby, Crash, Dice, Mines, Plinko, Coinflip, Virtual Sports
9. **Wallet pages**: Deposit, Withdraw, Swap, Transactions
10. **Account pages**: Profile, Security, KYC, Preferences, Responsible Gambling
11. **Rewards pages**: VIP dashboard, Calendar, TURBO, Referrals
12. **Content pages**: Promotions, Help Center, Blog, Academy
13. **Admin dashboard**: Complete admin with all panels
14. **Polish**: Animations, loading states, error states, empty states

### RULES:
1. Do NOT modify any backend code
2. Use the EXACT color tokens defined above
3. Every page must have mobile + desktop layout
4. Every loading state must show skeleton shimmer
5. Every empty state must show illustration + helpful text
6. Use Framer Motion for all animations
7. Use Lucide React for standard icons
8. Create custom SVGs for sport and crypto icons
9. All odds buttons must flash on change
10. Bet slip must work as sidebar (desktop) and bottom sheet (mobile)
11. Use shadcn/ui as base for form components, but override colors to match design system
12. All images use next/image with lazy loading
13. Real-time updates via WebSocket (Socket.IO) for live odds, scores, crash game
14. i18n support using next-intl (19 languages already configured)

### START NOW
Begin with the design system and global layout. Then build page by page. After each page, test it visually. Do NOT stop until all 22 pages are rebuilt. Do NOT ask questions — make design decisions and keep building.
