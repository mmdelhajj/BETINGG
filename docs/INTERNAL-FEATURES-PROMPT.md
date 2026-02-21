# INTERNAL FEATURES — Complete Implementation Guide

You are implementing ALL internal website features for CryptoBet. Every feature below must be FULLY FUNCTIONAL — not just UI, but real working backend + frontend integration.

Read the existing codebase first to understand what's already built, then implement/fix everything below.

---

## FEATURE 1: USER REGISTRATION & LOGIN

### Email/Password Registration
**Backend** (`src/modules/auth/`):
- POST `/api/v1/auth/register` — accepts: email, password, nickname, dateOfBirth, promoCode (optional)
- Password requirements: minimum 8 chars, must contain uppercase, lowercase, number
- Hash password with bcrypt (12 rounds)
- Generate unique userId (UUID)
- Create user record in database
- Send verification email with activation link (token in URL)
- Return: `{ success: true, data: { message: "Check your email to activate account" } }`

**Frontend**:
- Registration form with fields: Email, Password, Confirm Password, Nickname, Date of Birth
- Password strength indicator (weak/medium/strong) with colored bar
- "I have a promo code" toggle → reveals promo code input
- "I agree to Terms & Conditions" checkbox (required)
- "Create Account" button (purple)
- Loading spinner on submit
- Success → redirect to "Check your email" page
- Error handling: show inline errors per field (email already exists, password too weak, etc.)

### Email/Password Login
**Backend**:
- POST `/api/v1/auth/login` — accepts: email, password
- Verify password against hash
- If 2FA is enabled → return `{ requires2FA: true, tempToken: "..." }` instead of full login
- If no 2FA → return access token + refresh token
- Track failed login attempts (lock account after 5 failures for 15 minutes)
- Log login in audit_logs table (IP, user agent, timestamp)

**Frontend**:
- Login form: Email, Password
- "Remember me" checkbox (stores refresh token longer)
- "Forgot password?" link → opens password reset flow
- "Sign In" button
- If `requires2FA` response → redirect to 2FA verification page
- Error: "Invalid email or password" (don't reveal which is wrong)

### Password Reset
**Backend**:
- POST `/api/v1/auth/forgot-password` — accepts: email
- Generate reset token (expires in 1 hour)
- Send email with reset link
- POST `/api/v1/auth/reset-password` — accepts: token, newPassword
- Invalidate all existing sessions after password change

**Frontend**:
- "Forgot Password" page: email input + "Send Reset Link" button
- "Reset Password" page (from email link): new password + confirm + "Reset" button
- Success → redirect to login with "Password reset successfully" toast

---

## FEATURE 2: GOOGLE OAUTH LOGIN

### Setup Required
You need Google OAuth 2.0 credentials. The implementation should work with environment variables:
```env
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/callback/google
```

### Backend Implementation
```
GET /api/v1/auth/google — redirects to Google OAuth consent screen
GET /api/v1/auth/google/callback — handles the callback from Google
```

**Flow**:
1. User clicks "Sign in with Google"
2. Frontend redirects to `/api/v1/auth/google`
3. Backend constructs Google OAuth URL with scopes: `openid email profile`
4. Google shows consent screen
5. User authorizes → Google redirects to callback URL with `code`
6. Backend exchanges `code` for Google access token
7. Backend fetches user profile from Google (email, name, avatar)
8. Check if user exists with this Google email:
   - EXISTS → log them in, return JWT tokens
   - NEW → create account with Google email, set `authProvider: 'google'`, return JWT tokens
9. Redirect to frontend with tokens in URL params (or use httpOnly cookies)

**Implementation** (use `googleapis` or manual OAuth2):
```typescript
// src/modules/auth/google.service.ts
import { OAuth2Client } from 'google-auth-library';

const client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

export function getGoogleAuthUrl(): string {
  return client.generateAuthUrl({
    access_type: 'offline',
    scope: ['openid', 'email', 'profile'],
    prompt: 'consent',
  });
}

export async function getGoogleUser(code: string) {
  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);
  const ticket = await client.verifyIdToken({
    idToken: tokens.id_token!,
    audience: process.env.GOOGLE_CLIENT_ID,
  });
  const payload = ticket.getPayload()!;
  return {
    email: payload.email!,
    name: payload.name,
    avatar: payload.picture,
    googleId: payload.sub,
  };
}
```

### Frontend Implementation
- "Sign in with Google" button with Google "G" logo icon
- On click: `window.location.href = '/api/v1/auth/google'`
- Callback page (`/auth/callback/google`): extracts tokens from URL, saves to store, redirects to home
- Also add "Sign up with Google" on registration page (same flow, creates account if new)

---

## FEATURE 3: GITHUB OAUTH LOGIN

### Setup
```env
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
GITHUB_REDIRECT_URI=http://localhost:3000/auth/callback/github
```

### Backend
```
GET /api/v1/auth/github — redirects to GitHub OAuth
GET /api/v1/auth/github/callback — handles callback
```

**Flow** (similar to Google):
1. Redirect to `https://github.com/login/oauth/authorize?client_id=X&scope=user:email`
2. GitHub redirects back with `code`
3. Exchange code for access token via POST to `https://github.com/login/oauth/access_token`
4. Fetch user profile from `https://api.github.com/user` and emails from `https://api.github.com/user/emails`
5. Create or login user

### Frontend
- "Sign in with GitHub" button with GitHub icon (black octocat on white/gray)
- Same callback flow as Google

---

## FEATURE 4: TWO-FACTOR AUTHENTICATION (2FA / TOTP)

### Backend Implementation
Install: `npm install speakeasy qrcode`

```typescript
// src/modules/auth/twoFactor.service.ts

// ENABLE 2FA — Step 1: Generate secret
POST /api/v1/auth/2fa/setup
// Returns: { secret, qrCodeUrl, backupCodes: string[] }
// - Generate TOTP secret using speakeasy
// - Generate QR code as data URL
// - Generate 10 backup codes (random 8-char alphanumeric)
// - Store secret temporarily (not yet confirmed)

// ENABLE 2FA — Step 2: Verify and activate
POST /api/v1/auth/2fa/verify-setup
// Accepts: { token: "123456" } — the 6-digit code from authenticator app
// - Verify the token against the temporary secret
// - If valid: save secret to user record, mark 2FA as enabled
// - Store hashed backup codes
// - Return: { success: true, message: "2FA enabled" }

// DISABLE 2FA
POST /api/v1/auth/2fa/disable
// Accepts: { token: "123456", password: "currentPassword" }
// - Verify both the TOTP token AND password
// - Remove 2FA secret from user
// - Return: { success: true }

// VERIFY 2FA (during login)
POST /api/v1/auth/2fa/verify
// Accepts: { tempToken: "...", token: "123456" }
// - Verify the 6-digit code against user's stored secret
// - Also accept backup codes (mark as used after successful use)
// - If valid: return full JWT access + refresh tokens
// - If invalid: return error (max 5 attempts, then lock for 15 min)
```

**Speakeasy implementation**:
```typescript
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';

// Generate secret
const secret = speakeasy.generateSecret({
  name: 'CryptoBet',
  issuer: 'CryptoBet',
  length: 32,
});

// Generate QR code
const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url!);

// Verify token
const isValid = speakeasy.totp.verify({
  secret: secret.base32,
  encoding: 'base32',
  token: userInputCode,
  window: 1, // Allow 1 step tolerance (30 seconds before/after)
});
```

### Frontend Implementation

**2FA Setup page** (in Account → Security):
1. User clicks "Enable 2FA"
2. Show step-by-step wizard:
   - **Step 1**: "Download an authenticator app" — show logos for Google Authenticator, Authy, 1Password
   - **Step 2**: "Scan this QR code" — large QR code display + manual secret key (copyable) for manual entry
   - **Step 3**: "Enter the 6-digit code" — 6 individual input boxes (auto-advance, auto-focus)
   - **Step 4**: "Save your backup codes" — show 10 backup codes in a grid, "Download" button to save as text file, "Copy All" button, checkbox "I have saved my backup codes"
3. "Verify & Enable" button

**2FA Login verification page**:
- Clean centered card: "Enter your authentication code"
- 6-digit input boxes (large, auto-advance between digits)
- "Use backup code" link → switches to single text input for backup code
- Auto-submit when 6 digits entered
- Error shake animation on wrong code
- "Resend not available — codes are time-based" info text

**2FA Disable** (in Account → Security):
- "Disable 2FA" button (red/danger style)
- Confirmation modal: "Enter your current 2FA code and password to disable"
- Password + 6-digit code inputs
- "Disable" button

---

## FEATURE 5: CRYPTO WALLET SYSTEM

### Add/Manage Cryptocurrencies (Admin)
**Admin Dashboard → Payments → Currencies**:

**Backend**:
```
GET    /api/v1/admin/currencies         — list all currencies
POST   /api/v1/admin/currencies         — add new currency
PUT    /api/v1/admin/currencies/:id     — update currency
DELETE /api/v1/admin/currencies/:id     — disable/remove currency

GET    /api/v1/admin/currencies/:id/networks    — list networks for currency
POST   /api/v1/admin/currencies/:id/networks    — add network
PUT    /api/v1/admin/networks/:id               — update network
DELETE /api/v1/admin/networks/:id               — disable network
```

**Currency fields**:
```typescript
{
  symbol: "BTC",
  name: "Bitcoin",
  icon: "btc.svg",           // Icon filename
  type: "NATIVE",            // NATIVE | ERC20 | BEP20 | TRC20 | SPL
  decimals: 8,
  minDeposit: "0",           // No minimum
  minWithdrawal: "0.0001",
  maxWithdrawal: "10",
  withdrawalFee: "0.00005",
  exchangeRateUSD: "65000",  // Current USD rate
  isEnabled: true,
  sortOrder: 1,
}
```

**Network fields**:
```typescript
{
  currencyId: "uuid",
  networkName: "Bitcoin",          // e.g., "Ethereum", "BNB Smart Chain", "Tron"
  chainId: null,                   // For EVM chains
  contractAddress: null,           // For tokens
  confirmationsRequired: 3,
  explorerUrl: "https://blockchair.com/bitcoin/transaction/",
  rpcUrl: "...",
  isEnabled: true,
}
```

**Admin Frontend**:
- Table listing all currencies with: icon, symbol, name, type, rate, status toggle
- "Add Currency" button → modal form with all fields
- Edit button per currency → same modal pre-filled
- Networks sub-table per currency: network name, chain ID, contract, confirmations, status toggle
- "Add Network" button per currency
- Bulk enable/disable toggle
- Exchange rate update (manual + auto-fetch from CoinGecko API)

### User Wallet — Deposit Flow
**Backend**:
```
GET  /api/v1/wallets                    — get all user wallets with balances
GET  /api/v1/wallets/:currency          — get specific wallet
POST /api/v1/wallets/:currency/address  — generate deposit address for currency+network
GET  /api/v1/wallets/transactions       — transaction history with filters
```

**Address generation**:
```typescript
// For EVM chains (ETH, BNB, MATIC, etc.)
// Use HD wallet derivation: master key + user index
import { ethers } from 'ethers';
const hdNode = ethers.HDNodeWallet.fromMnemonic(
  ethers.Mnemonic.fromPhrase(process.env.EVM_MNEMONIC!),
  "m/44'/60'/0'/0"
);
const userWallet = hdNode.deriveChild(user.walletIndex);
const address = userWallet.address;

// For Bitcoin
import * as bitcoin from 'bitcoinjs-lib';
// Similar HD derivation for BTC addresses

// For Solana
import { Keypair } from '@solana/web3.js';
// Derive from seed
```

**Frontend — Deposit Page**:
1. **Select currency**: Grid of crypto icons (BTC, ETH, USDT, etc.) — each shows icon + symbol
2. After selection, **select network** (if multiple): "Choose Network" buttons (e.g., USDT → Ethereum / BNB Chain / Tron)
3. Show deposit details:
   - Large QR code (generated from address)
   - Wallet address text + "Copy" button (with checkmark feedback)
   - Warning: "Send only [CURRENCY] on [NETWORK] network. Sending other assets may result in permanent loss."
   - "Minimum deposit: None"
   - "Confirmations required: X"
   - "Expected arrival: ~X minutes"
4. **"Buy with Card" tab**: Opens MoonPay widget (iframe) for fiat → crypto purchase
5. **"Connect Wallet" tab**: WalletConnect/MetaMask buttons (see Feature 7)

### User Wallet — Withdrawal Flow
**Backend**:
```
POST /api/v1/wallets/:currency/withdraw
// Accepts: { amount, address, networkId, twoFactorCode }
// Validation:
// - Check sufficient balance
// - Check KYC level vs withdrawal limits
// - Validate address format for the network
// - Verify 2FA code
// - Check address against whitelist (if enabled)
// - Calculate network fee
// - Create pending withdrawal transaction
// - Add to withdrawal processing queue
// - If amount > threshold → require admin approval
// Return: { transactionId, status: "PENDING", estimatedTime }
```

**Frontend — Withdraw Page**:
1. Select currency (same grid)
2. Select network
3. Enter destination address (input with paste button + address format validation)
4. Enter amount (with "Max" button that fills available balance minus fee)
5. Show fee breakdown: "Amount: X | Network Fee: Y | You receive: Z"
6. Show KYC limit info: "Daily limit: $2,200 (unverified) / Unlimited (verified)"
7. "Withdraw" button
8. 2FA verification modal (6-digit code input)
9. Success: "Withdrawal submitted" with transaction ID
10. Error handling: insufficient balance, invalid address, KYC limit reached, 2FA failed

### User Wallet — Swap
**Backend**:
```
POST /api/v1/wallets/swap
// Accepts: { fromCurrency, toCurrency, amount }
// - Fetch exchange rates (from Redis cache or CoinGecko)
// - Calculate conversion with spread (e.g., 0.5% fee)
// - Deduct from source wallet, credit to destination wallet
// - Create two transaction records (SWAP_OUT and SWAP_IN)
// Return: { fromAmount, toAmount, exchangeRate, fee }

GET /api/v1/wallets/swap/rate?from=BTC&to=ETH&amount=0.1
// Preview swap rate without executing
```

**Frontend — Swap Page**:
- "From" section: currency selector + amount input + current balance shown
- Swap arrow button (⇄) in middle — click to reverse direction
- "To" section: currency selector + estimated amount (auto-calculated)
- Exchange rate display: "1 BTC = X ETH"
- Fee display: "Swap fee: 0.5%"
- "Swap" button (purple)
- Success animation: coins flying from one side to other

---

## FEATURE 6: KYC VERIFICATION SYSTEM

### Three Levels
1. **UNVERIFIED** — Default on signup. Limits: $2,200/day withdrawal
2. **BASIC** — Email verified + phone verified. Limits: $10,000/day
3. **FULL** — ID document + proof of address + selfie verified. Limits: Unlimited

### Backend
```
GET  /api/v1/kyc/status              — get current KYC level + documents status
POST /api/v1/kyc/documents           — upload document (multipart/form-data)
GET  /api/v1/kyc/documents           — list submitted documents
GET  /api/v1/admin/kyc/pending       — admin: list pending verifications
PUT  /api/v1/admin/kyc/:id/approve   — admin: approve document
PUT  /api/v1/admin/kyc/:id/reject    — admin: reject with reason
```

**Document types**:
```typescript
enum DocumentType {
  NATIONAL_ID = 'NATIONAL_ID',
  PASSPORT = 'PASSPORT',
  DRIVERS_LICENSE = 'DRIVERS_LICENSE',
  PROOF_OF_ADDRESS = 'PROOF_OF_ADDRESS',  // Utility bill, bank statement
  SELFIE = 'SELFIE',                       // Selfie holding ID
}

enum DocumentStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}
```

**File upload**: Store in local filesystem or S3-compatible storage. Accept: JPG, PNG, PDF. Max size: 10MB.

### Frontend — KYC Page (Account → Verification)

**Level display at top**: Show 3 steps with current status
```
[1. Email ✅] → [2. Identity 🔄] → [3. Address ⏳]
```

**Identity Verification section**:
1. "Select document type" — Radio buttons: National ID | Passport | Driver's License
2. "Upload front of document" — Drag-and-drop zone or click to upload
   - Show thumbnail preview after upload
   - File validation: check type (JPG/PNG/PDF) and size (<10MB)
3. "Upload back of document" (for ID/license, not passport)
4. "Upload selfie holding your document" — instructions: "Take a clear photo of yourself holding your ID next to your face"
5. "Submit for Review" button

**Status display after submission**:
- PENDING: Yellow badge "Under Review — Usually takes 24-48 hours"
- APPROVED: Green badge "Verified ✓"
- REJECTED: Red badge "Rejected — Reason: [admin reason]" + "Resubmit" button

**Proof of Address section**:
- Upload utility bill, bank statement, or government letter (less than 3 months old)
- Same upload flow

**Admin KYC Panel**:
- Queue of pending documents with user info
- Document viewer (inline image/PDF preview)
- "Approve" button (green) + "Reject" button (red) with reason text input
- User's submitted documents side by side
- Verification history log

---

## FEATURE 7: WALLETCONNECT — MetaMask, Ledger, Trust Wallet

### Setup
Install: `npm install @walletconnect/modal @walletconnect/ethereum-provider ethers`

You need a WalletConnect Project ID from https://cloud.walletconnect.com

```env
WALLETCONNECT_PROJECT_ID=your-project-id
```

### Backend
```
POST /api/v1/auth/wallet/nonce    — generate nonce for wallet signature
// Returns: { nonce: "Sign this message to login to CryptoBet: [random-nonce]" }

POST /api/v1/auth/wallet/verify   — verify signed message
// Accepts: { address, signature, nonce }
// - Recover address from signature using ethers.verifyMessage()
// - If address matches, create/login user with wallet address
// - Return JWT tokens

POST /api/v1/wallets/connect/deposit
// Accepts: { txHash, address, amount, currency, networkId }
// - Verify transaction on-chain
// - Credit user wallet after confirmations
```

### Frontend Implementation
```typescript
// frontend/src/lib/walletConnect.ts
import { createWeb3Modal, defaultConfig } from '@web3modal/ethers5';

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID!;

const chains = [
  { chainId: 1, name: 'Ethereum', currency: 'ETH', rpcUrl: '...' },
  { chainId: 56, name: 'BNB Smart Chain', currency: 'BNB', rpcUrl: '...' },
  { chainId: 137, name: 'Polygon', currency: 'MATIC', rpcUrl: '...' },
  { chainId: 43114, name: 'Avalanche', currency: 'AVAX', rpcUrl: '...' },
];

const web3Modal = createWeb3Modal({
  ethersConfig: defaultConfig({ metadata: { name: 'CryptoBet', ... } }),
  chains,
  projectId,
});
```

**Connect Wallet Button** (in Deposit page + Header):
1. User clicks "Connect Wallet"
2. Web3Modal opens showing: MetaMask, Ledger, Trust Wallet, Coinbase Wallet, WalletConnect QR
3. User selects wallet and approves connection
4. Frontend gets user's wallet address
5. Two use cases:
   - **Login with wallet**: Sign a message → verify on backend → get JWT
   - **Deposit from wallet**: Send crypto directly from connected wallet to platform deposit address
   - **Withdraw to wallet**: Auto-fill withdrawal address from connected wallet

**One-Click Deposit** (connected wallet):
1. User has MetaMask connected
2. On deposit page, show "Deposit from Connected Wallet" section
3. User enters amount
4. Click "Deposit" → triggers MetaMask transaction popup
5. User confirms in MetaMask
6. Frontend sends tx hash to backend
7. Backend monitors tx confirmation
8. Balance credited

---

## FEATURE 8: ACCOUNT SETTINGS — COMPLETE

### Profile Settings
**Backend**: `PUT /api/v1/users/profile`
**Fields**: nickname, avatar (upload), dateOfBirth, timezone

**Frontend**:
- Nickname input (with availability check — debounced API call)
- Avatar upload with crop/preview
- Date of birth (date picker)
- "Save Changes" button

### Security Settings
**Backend**:
```
PUT  /api/v1/users/password          — change password (requires current password)
GET  /api/v1/users/sessions          — list active sessions
DELETE /api/v1/users/sessions/:id    — revoke specific session
DELETE /api/v1/users/sessions        — revoke all other sessions
```

**Frontend Security page**:
- **Change Password**: Current password + New password + Confirm → "Update" button
- **2FA Section**: Enable/Disable 2FA (full flow from Feature 4)
- **Active Sessions**: Table showing: Device, Browser, IP, Location (GeoIP), Last active, "Revoke" button
  - Current session highlighted
  - "Revoke All Other Sessions" button
- **Connected Accounts**: Show linked Google/GitHub with "Disconnect" option

### Preferences
**Backend**: `PUT /api/v1/users/preferences`

**Frontend**:
- **Theme**: Dark / Light toggle (or Dark / Light / System)
- **Language**: Dropdown with 19 languages (flags + names)
- **Odds Format**: Decimal (1.85) / Fractional (17/20) / American (-118) — radio buttons with example
- **Default Currency**: Dropdown of user's wallet currencies
- **Notifications**: Toggle switches for: Email notifications, In-app notifications, Marketing emails, Bet settlement alerts, Deposit confirmation alerts, Promotional offers
- "Save Preferences" button

### Responsible Gambling
**Backend**:
```
GET  /api/v1/users/limits             — get current limits
PUT  /api/v1/users/limits             — set/update limits
POST /api/v1/users/cooling-off        — activate cooling off period
POST /api/v1/users/self-exclude       — activate self-exclusion
GET  /api/v1/users/gambling-assessment — get assessment quiz
POST /api/v1/users/gambling-assessment — submit assessment answers
```

**Frontend — Responsible Gambling page**:

**Deposit Limits**:
- Three rows: Daily | Weekly | Monthly
- Each: current limit (editable input) + "Set" button
- Decreasing limits take effect immediately
- Increasing limits have 24-hour cooling period (show countdown)

**Loss Limits**: Same layout as deposit limits

**Wager Limits**: Same layout

**Session Time Limit**:
- Dropdown: 30 min | 1 hour | 2 hours | 4 hours | 8 hours | No limit
- Auto-logout + notification when time reached
- Reality check popup every X minutes with: "You've been playing for X hours. Your session P&L is: +$X / -$X"

**Cooling-Off Period**:
- Options: 24 hours | 1 week | 1 month
- BIG warning: "During cooling off, you cannot place bets or play games. Withdrawals remain available."
- Require password confirmation
- Double confirmation modal: "Are you sure? This cannot be undone early."

**Self-Exclusion**:
- Options: 6 months | 1 year | Permanent
- RED warning box: "Self-exclusion will lock your account completely. You will NOT be able to log in, place bets, or play games."
- Permanent: "This action is IRREVERSIBLE."
- Require password + 2FA (if enabled) confirmation
- Triple confirmation for permanent

**Gambling Assessment Quiz**:
- 10 multiple-choice questions (standard PGSI — Problem Gambling Severity Index)
- Questions like: "How often have you bet more than you could afford to lose?" → Never / Sometimes / Often / Almost always
- Score calculation at end
- Results: Low risk / Moderate risk / Problem gambling
- Show appropriate resources based on score
- Link to GambleAware, GA, Betblocker

### API Key Management
**Backend**:
```
GET    /api/v1/users/api-keys          — list user's API keys
POST   /api/v1/users/api-keys          — create new key (returns key ONCE)
DELETE /api/v1/users/api-keys/:id      — revoke key
```

**Frontend**:
- Table of API keys: Name, Key (masked: `sk_live_...XXXX`), Created date, Last used, "Revoke" button
- "Create New API Key" button → modal: key name input → shows full key ONCE with "Copy" button + warning "Save this key now. You won't be able to see it again."
- Rate limit info displayed: "Rate limit: 100 requests/minute"

---

## FEATURE 9: NOTIFICATION SYSTEM

### Backend
```
GET  /api/v1/notifications              — list user notifications (paginated)
PUT  /api/v1/notifications/:id/read     — mark as read
PUT  /api/v1/notifications/read-all     — mark all as read
GET  /api/v1/notifications/unread-count — get unread count
```

**WebSocket**: Push new notifications via Socket.IO event `notification:new`

**Notification types**:
- BET_SETTLED: "Your bet on Liverpool vs Arsenal was settled. You won $45.00!"
- DEPOSIT_CONFIRMED: "Your deposit of 0.05 BTC has been confirmed."
- WITHDRAWAL_PROCESSED: "Your withdrawal of 100 USDT has been sent."
- PROMO_AVAILABLE: "New promotion available: Weekend Bet Builder!"
- KYC_UPDATE: "Your identity verification has been approved."
- VIP_LEVEL_UP: "Congratulations! You've reached Gold VIP tier!"
- SECURITY_ALERT: "New login detected from [location]."

### Frontend
- **Bell icon** in header with red unread count badge
- Click → opens notification dropdown/panel (slide from right on mobile)
- Each notification: icon (by type) + message + time ago + unread dot
- Click notification → navigate to relevant page (e.g., bet detail, wallet)
- "Mark all as read" button at top
- Real-time: new notifications push in via WebSocket with subtle animation + sound (optional)

---

## FEATURE 10: LIVE CHAT WIDGET

### Implementation
Use a floating chat button (bottom-right corner) that opens a chat panel.

**Simple built-in implementation**:
```
// WebSocket-based chat with support team
POST /api/v1/support/chat           — create chat session
GET  /api/v1/support/chat/:id       — get chat messages
POST /api/v1/support/chat/:id/message — send message

// Admin side
GET  /api/v1/admin/support/chats          — list active chats
GET  /api/v1/admin/support/chats/:id      — get chat details
POST /api/v1/admin/support/chats/:id/message — admin reply
PUT  /api/v1/admin/support/chats/:id/close   — close chat
```

**Frontend**:
- Floating button: purple circle with chat icon, bottom-right, always visible
- Click → opens chat panel (350px wide on desktop, full-screen on mobile)
- Chat panel: header ("Live Support — Online"), message list (scrollable), input bar with send button
- Auto-message on open: "Hi! How can we help you today?"
- File attachment support (images)
- "Typing..." indicator
- Chat history persists across page navigation

---

## FEATURE 11: ADMIN DASHBOARD — CRITICAL PANELS

### Admin User Management
- Search users by email/nickname/ID
- User detail view: profile, KYC status, wallet balances, bet history, login history
- Actions: ban, suspend (with duration), adjust balance (manual credit/debit with reason), force password reset, toggle 2FA

### Admin Withdrawal Approvals
- Queue of pending withdrawals above threshold
- Each: user info, amount, currency, address, KYC level
- "Approve" (green) and "Reject" (red with reason) buttons
- Batch approve option

### Admin Currency & Network Management
- Full CRUD for currencies and networks (as described in Feature 5)
- Enable/disable currencies with one toggle
- Update exchange rates manually or enable auto-fetch

### Admin Site Configuration
```
GET  /api/v1/admin/config           — get all site configs
PUT  /api/v1/admin/config/:key      — update config value
```
- Key-value pairs: minBetAmount, maxBetAmount, maxParleyLegs, defaultOddsMargin, liveBetDelay, cashoutEnabled, maintenanceMode, registrationEnabled
- Toggle switches for boolean configs
- Input fields for numeric configs
- Changes take effect immediately

---

## EXECUTION ORDER

1. Fix/verify auth system (register, login, JWT tokens, refresh)
2. Implement Google OAuth
3. Implement GitHub OAuth  
4. Implement full 2FA (TOTP with speakeasy)
5. Implement wallet deposit flow (address generation, QR, copy)
6. Implement wallet withdrawal flow (validation, 2FA, queue)
7. Implement wallet swap
8. Implement KYC upload + admin review
9. Implement WalletConnect integration
10. Implement all account settings pages
11. Implement notification system
12. Implement live chat
13. Implement admin panels (users, withdrawals, currencies, config)
14. Test every flow end-to-end

## RULES
1. Every feature must work END TO END — backend + frontend connected
2. All forms must have proper validation (Zod on backend, client-side on frontend)
3. All sensitive endpoints must require authentication
4. All admin endpoints must require admin role
5. 2FA must be checked on sensitive operations (withdrawal, password change, 2FA disable)
6. Use environment variables for ALL secrets and API keys
7. Create a complete .env.example with every variable documented
8. Handle all error cases gracefully with user-friendly messages
9. Do NOT ask questions — make reasonable decisions and keep building
10. Test each feature as you build it

## START NOW
Begin with Feature 1 (auth system — verify it works), then proceed through each feature in order. Do not stop until all 11 features are fully functional.
