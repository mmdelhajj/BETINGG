# Cryptocurrency Wallet & Payment Integration Report
## For CryptoBet Betting/Casino Platform

**Date:** February 2026
**Research Scope:** Wallet infrastructure, payment processing, deposit/withdrawal flows, multi-network support

---

## Table of Contents

1. [Wallet Infrastructure Options](#1-wallet-infrastructure-options)
   - [Option A: Run Your Own Nodes](#option-a-run-your-own-nodes)
   - [Option B: Wallet-as-a-Service APIs](#option-b-wallet-as-a-service-apis)
   - [Option C: Hybrid Approach](#option-c-hybrid-approach)
2. [Deposit Flow](#2-deposit-flow)
3. [Withdrawal Flow](#3-withdrawal-flow)
4. [Multi-Network Support](#4-multi-network-support)
5. [Practical Recommendations](#5-practical-recommendations)

---

## 1. WALLET INFRASTRUCTURE OPTIONS

### Option A: Run Your Own Nodes

#### Server Requirements Per Blockchain

| Blockchain | CPU | RAM | Storage | Bandwidth | Monthly Cloud Cost (OVH) |
|-----------|-----|-----|---------|-----------|-------------------------|
| **Bitcoin (BTC)** | 4+ cores | 8-16 GB | 1-2 TB NVMe SSD | 50+ Mbps | ~$60-100/mo |
| **Ethereum (ETH)** | 8+ cores | 32-64 GB | 4-8 TB NVMe SSD | 300-500 Mbps | ~$200-400/mo |
| **Litecoin (LTC)** | 2-4 cores | 2-4 GB | 100 GB SSD | 25+ Mbps | ~$40-60/mo |
| **Dogecoin (DOGE)** | 2-4 cores | 2-4 GB | 100 GB SSD | 50+ Mbps (unmetered preferred) | ~$40-60/mo |
| **TRON (TRX)** | 16-64 cores | 16-64 GB | 1.5-10 TB SSD | 100 Mbps-1 Gbps | ~$150-300/mo |
| **Solana (SOL)** | 24+ cores (AMD EPYC) | 256 GB DDR5 ECC | 2x 3.84 TB NVMe | 1-10 Gbps | ~$400-1,200/mo |

**Key Notes:**
- **Bitcoin** blockchain is ~500-700 GB as of late 2025, growing ~100-150 GB/year. A pruned node can reduce storage to ~10 GB but limits historical query capability.
- **Ethereum** state data doubles every 12-18 months. An archive node requires 18-20 TB. A snap-synced full node is ~650 GB but grows ~14 GB/week. Pruning is essential.
- **Solana** is by far the most expensive to run, requiring enterprise-grade hardware with 256 GB RAM minimum and high-speed NVMe SSDs. Monthly costs start at $400-600 for bare minimum.
- **TRON** recommended spec is 64+ cores and 64 GB RAM for production use, though minimum is 16 cores/16 GB.
- **LTC/DOGE** are the cheapest to run, with modest requirements similar to a small VPS.

**CRITICAL: Hetzner prohibits cryptocurrency-related operations** (mining, nodes, blockchain storage). Use OVH, Vultr, DigitalOcean, or bare-metal providers instead. OVH actively offers blockchain-specific server hosting.

#### Total Monthly Cost Estimate (Running All 6 Nodes)

| Setup | Monthly Cost |
|-------|-------------|
| Minimum viable (BTC + ETH + LTC + DOGE + TRX) without Solana | ~$490-920/mo |
| Full setup including Solana | ~$890-2,120/mo |
| DevOps engineer time to maintain | ~$2,000-5,000/mo (part-time) |
| **Total with labor** | **~$2,890-7,120/mo** |

#### How to Detect Incoming Deposits on Your Own Node

**For UTXO chains (BTC, LTC, DOGE):**
1. Generate unique deposit addresses per user using HD wallet (BIP32/BIP44) derivation paths
2. Import watch-only addresses into the node's wallet
3. Use `listunspent` or `listtransactions` RPC calls, or subscribe to `walletnotify` callback
4. Poll `getblock` + `getrawtransaction` for new blocks and scan for transactions to your addresses

**For EVM chains (ETH + ERC-20 tokens like USDT/USDC):**
1. Generate addresses using BIP44 derivation path `m/44'/60'/0'/0/N` where N = user index
2. Subscribe to new blocks via WebSocket (`eth_subscribe("newHeads")`)
3. For native ETH: scan each block's transactions for matching `to` addresses
4. For ERC-20 tokens: filter `Transfer(address,address,uint256)` event logs using `eth_getLogs` with the token contract address and your deposit addresses as the `to` topic
5. Decode event data using the ERC-20 ABI to extract sender, receiver, and amount (accounting for decimals)

**For TRC-20 tokens on TRON:**
1. Generate addresses from HD wallet seed
2. Monitor blocks via TRON HTTP API (`/wallet/getnowblock`)
3. For TRC-20 USDT: filter Transfer events on contract `TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t`
4. Use `getTransactionInfoById` API to verify transfer success
5. Real-time mempool monitoring available for pending TRC-20 transfers

**For Solana (SOL + SPL tokens):**
1. Generate keypairs from seed
2. Use WebSocket `accountSubscribe` for real-time notifications
3. For SPL tokens (USDT): monitor associated token accounts

#### HD Wallet System (BIP32/BIP44)

The standard derivation path is: `m / purpose' / coin_type' / account' / change / address_index`

| Coin | BIP44 Path | Example for User #42 |
|------|-----------|---------------------|
| BTC | `m/44'/0'/0'/0/N` | `m/44'/0'/0'/0/42` |
| ETH | `m/44'/60'/0'/0/N` | `m/44'/60'/0'/0/42` |
| LTC | `m/44'/2'/0'/0/N` | `m/44'/2'/0'/0/42` |
| DOGE | `m/44'/3'/0'/0/N` | `m/44'/3'/0'/0/42` |
| TRX | `m/44'/195'/0'/0/N` | `m/44'/195'/0'/0/42` |
| SOL | `m/44'/501'/N'/0'` | `m/44'/501'/42'/0'` |

**Key Principle:** You can derive unlimited child public keys from the master extended public key (xpub) on a hot server without exposing the master private key. The master private key stays in cold storage and is only needed to sign withdrawal transactions.

#### Pros/Cons of Running Your Own Infrastructure

**Pros:**
- Zero per-transaction fees (only blockchain network fees)
- Full control over data and operations
- No third-party dependency or rate limits
- No risk of service provider blocking your gambling business
- Can process unlimited transactions

**Cons:**
- High upfront engineering effort (3-6 months to build properly)
- Ongoing DevOps maintenance burden
- Must handle chain upgrades, forks, and reorgs
- Security is 100% your responsibility (key management, hot wallet hacks)
- Solana node alone costs $400-1,200/mo
- Need 24/7 monitoring and alerting

---

### Option B: Wallet-as-a-Service APIs

#### Category 1: Node/RPC API Providers (Infrastructure Layer)

These give you blockchain access without running your own nodes. You still need to build wallet management, deposit detection, and withdrawal logic on top.

| Service | Pricing | Chains | Gambling-Friendly? | Best For |
|---------|---------|--------|-------------------|----------|
| **NOWNodes** | Free: 100K req/mo; Pro: EUR20/mo (1M req); Business: EUR200/mo (30M req); Enterprise: EUR500/mo (100M req) | 100+ blockchains | Yes (infrastructure only, no restrictions) | Budget-friendly node access across many chains |
| **Alchemy** | Free: 30M CU/mo; PAYG: $0.40-0.45/1M CU; Enterprise: custom | 50+ chains (ETH, Polygon, Solana, Arbitrum, Base, etc.) | Yes (infrastructure only) | Ethereum/EVM ecosystem, best docs and tooling |
| **Infura** | Free: 6M credits/day; Enterprise: custom | ETH, Polygon, Optimism, Arbitrum, Avalanche, Starknet | Yes (infrastructure only) | Ethereum-focused, MetaMask backend |
| **QuickNode** | Free: 10M credits; Build: $49/mo (80M); Accelerate: $249/mo (450M); Scale: $499/mo (950M) | 79+ chains, 130+ networks | Yes (infrastructure only) | Multi-chain with excellent performance |
| **Moralis** | Free: ~40K CU/day; Starter: ~$49/mo; Pro: ~$199/mo | EVM chains + Solana | Yes (infrastructure only) | Enhanced APIs (token balances, NFTs, webhooks) |

**Important:** These services are chain-agnostic infrastructure providers. They generally do not restrict gambling use since they are just providing RPC access, not handling payments. However, you must build all wallet logic yourself.

#### Category 2: Multi-Chain Wallet APIs (Wallet Management Layer)

These provide higher-level wallet operations: address generation, transaction broadcasting, balance queries, webhooks for deposit detection.

| Service | Pricing | Chains | Features | Gambling-Friendly? |
|---------|---------|--------|----------|-------------------|
| **Tatum** | Free: 100K lifetime credits, 2 keys; Pro: ~4M credits/mo (price not public); Enterprise: custom | 130+ blockchains | HD wallet generation, address management, webhooks, tx broadcasting, fee estimation, virtual accounts | Not explicitly restricted, but unclear. Use with caution. |
| **BlockCypher** | Free tier available; Paid from $100/mo | BTC, ETH, LTC, DOGE, DASH | HD wallets, webhooks, multi-sig, confidence factor for 0-conf, address watching | Not explicitly restricted for infrastructure use |

**Tatum** is the most feature-rich option for building a wallet backend. It provides:
- Custodial and non-custodial wallet creation via API
- Automatic webhook notifications for deposits
- Virtual account ledger system for off-chain balances
- Multi-chain support in a single API
- Fee estimation across chains

**BlockCypher** is older and more limited (only 5 chains) but battle-tested with a unique "confidence factor" that predicts transaction finality before full confirmation -- useful for 0-conf deposits at a casino.

#### Category 3: Institutional Custody Solutions

These are enterprise-grade custody platforms with multi-sig, insurance, and compliance features.

| Service | Pricing | Chains | Features | Gambling-Friendly? |
|---------|---------|--------|----------|-------------------|
| **Fireblocks** | Essentials: ~$699/mo (first 6 months); Pro: higher; Enterprise: custom. Per-wallet fees: $0.40-0.90. Tx overage: 0.16-0.23% | 100+ blockchains, 300M+ wallets | MPC (multi-party computation), policy engine, DeFi access, embedded wallets, insurance | Likely requires compliance review. Used by major institutions. Contact sales. |
| **BitGo** | Custom pricing (enterprise) | Wide multi-chain support | Multi-sig (2-of-3), $250M Lloyd's insurance, qualified custody, staking | Unknown for gambling. Focus is institutional finance. Contact sales. |

**Assessment:** Fireblocks and BitGo are overkill for a startup. Fireblocks minimum is ~$699/mo with per-wallet and per-transaction fees on top. BitGo is even more enterprise-focused. These make sense at scale (10,000+ users, $10M+ in custody) or if you need regulatory compliance (e.g., for a licensed operation).

#### Category 4: Crypto Payment Gateways (Full Solution)

These handle the entire payment flow: address generation, deposit detection, balance management, and payouts. You integrate their API and they handle the blockchain complexity.

| Service | Tx Fee | Supported Cryptos | Gambling Support | Key Features |
|---------|--------|-------------------|-----------------|-------------|
| **NOWPayments** | 0.5-1% | 350+ cryptos, 40+ fiat | **YES - Explicitly supports gambling/iGaming** | Non-custodial, mass payouts, stablecoin support, no KYC for merchants, avg 3-5 min tx time |
| **CoinPayments** | 1% flat | 2,000+ cryptos | **YES - Widely used by crypto casinos** | Mass payouts, instant notifications, stablecoin withdrawals, dedicated case managers |
| **CoinGate** | 1% flat | 50+ cryptos | **YES - Has dedicated casino/betting solutions** | Auto crypto-to-fiat conversion, white-label, AML/KYC built-in, EU-regulated |
| **Plisio** | 0.5% (Gateway); 1.5% (White Label) | 50+ cryptos (BTC, ETH, LTC, DOGE, USDT, USDC, etc.) | **YES - Actively supports gambling merchants** | Free account, batch transactions (save 80%), no chargebacks |
| **CryptoCloud** | 1.9% standard (0.4% for large projects) | BTC, ETH, LTC, USDT, USDC, TRX, BNB, TON, DOGE, SOL, SHIB | **YES - Explicitly gambling-friendly** | Auto-conversion to USDT, Telegram bot notifications, white-label |
| **OxaPay** | 0.4% | BTC, USDT, ETH, and more | **Likely yes - no KYC gateway, gambling-tolerant** | Lowest fees, white-label, no KYC, full API |
| **B2BinPay** | 0.25-0.50% (volume-based) | 76+ cryptos | **YES - Has dedicated casino/iGaming solution** | Sandbox for testing, auto conversion, $5.1B processed. Not available in USA. |
| **Coinbase Commerce** | 1% | Limited (major cryptos) | **NO - Gambling is PROHIBITED** in their terms | Do NOT use for gambling. Explicitly bans lotteries, odds making, games of chance. |

**CRITICAL WARNING:** Coinbase Commerce explicitly prohibits gambling businesses. Using it for a betting platform will result in account termination and potential fund freezing.

#### Payment Gateway Comparison Summary

**Best value for a startup:** OxaPay (0.4%) or Plisio (0.5%)
**Best gambling-specific features:** NOWPayments or CoinGate
**Most crypto support:** CoinPayments (2,000+)
**Best for high volume:** B2BinPay (0.25% at $5M+/mo)
**Avoid for gambling:** Coinbase Commerce

---

### Option C: Hybrid Approach (RECOMMENDED)

The hybrid approach combines a node API provider for blockchain access with custom wallet management logic. This gives you the control of running your own infrastructure without the operational burden.

#### Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Your Backend                          │
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ Wallet       │  │ Deposit      │  │ Withdrawal   │  │
│  │ Service      │  │ Monitor      │  │ Processor    │  │
│  │ (HD keys,    │  │ (webhooks,   │  │ (tx signing, │  │
│  │  addresses)  │  │  scanning)   │  │  batching)   │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  │
│         │                 │                  │          │
│  ┌──────┴─────────────────┴──────────────────┴───────┐  │
│  │           Blockchain Abstraction Layer             │  │
│  │  (Unified interface for all supported chains)      │  │
│  └──────────────────────┬────────────────────────────┘  │
│                         │                               │
└─────────────────────────┼───────────────────────────────┘
                          │
        ┌─────────────────┼──────────────────┐
        │                 │                  │
   ┌────┴────┐     ┌─────┴─────┐     ┌─────┴─────┐
   │ Alchemy │     │ QuickNode │     │ NOWNodes  │
   │ (ETH,   │     │ (SOL,     │     │ (BTC, LTC,│
   │  EVM)   │     │  multi)   │     │  DOGE,TRX)│
   └─────────┘     └───────────┘     └───────────┘
```

#### How to Build It

1. **Master Seed Management:**
   - Generate one BIP39 mnemonic (24 words) as the master seed
   - Store it in an HSM or hardware wallet (Ledger, Trezor) for cold storage
   - Derive the extended public key (xpub) for each supported chain
   - Deploy xpubs to your hot server for address generation (no private keys on server)

2. **Address Generation:**
   - For each user + currency combination, derive a unique address using BIP44 path
   - Store the derivation index in your database alongside the user ID
   - Generate addresses on-demand when user first requests a deposit address

3. **Deposit Detection (via Node API):**
   - **Alchemy/QuickNode webhooks:** Configure address activity webhooks to get push notifications when deposits arrive
   - **Fallback polling:** Every 30 seconds, query recent blocks for transactions to your addresses
   - **Event log filtering:** For ERC-20/TRC-20 tokens, filter Transfer events targeting your deposit addresses

4. **Hot/Cold Wallet Separation:**
   - **Hot wallet:** Holds 5-15% of total funds for instant withdrawals. Private keys encrypted on server.
   - **Warm wallet:** Holds 15-30% with multi-sig (2-of-3). Used to refill hot wallet.
   - **Cold wallet:** Holds 55-80% in hardware wallet / multi-sig. Only accessed manually for large refills.
   - Automated alerts when hot wallet balance drops below threshold

5. **Cost Estimate for Hybrid:**

| Component | Monthly Cost |
|-----------|-------------|
| Alchemy (ETH/EVM, Pay-as-you-go) | $5-50/mo |
| QuickNode (Solana, Build plan) | $49/mo |
| NOWNodes (BTC/LTC/DOGE/TRX, Pro) | EUR20/mo |
| Cloud server for wallet service | $20-50/mo |
| **Total** | **~$100-170/mo** |

This is dramatically cheaper than running your own nodes ($2,890-7,120/mo) and gives you full control unlike payment gateways.

---

## 2. DEPOSIT FLOW

### Step-by-Step Deposit Process

```
User clicks "Deposit BTC"
        │
        ▼
Backend derives unique BTC address for user
(BIP44: m/44'/0'/0'/0/{user_index})
        │
        ▼
Display address + QR code to user
        │
        ▼
User sends BTC from their wallet
        │
        ▼
Blockchain broadcasts transaction (0 confirmations)
        │
        ▼
Webhook/polling detects pending transaction
        │
        ▼
Show "Pending Deposit" in user's account
(optionally credit balance at 0-conf for small amounts)
        │
        ▼
Wait for N confirmations
        │
        ▼
Credit user's internal balance
        │
        ▼
Sweep funds to hot/cold wallet (for UTXO chains)
or leave in deposit address (for account-based chains)
```

### Confirmation Requirements Per Chain

| Blockchain | Recommended Confirmations | Approximate Wait Time | 0-Conf Safe? |
|-----------|--------------------------|----------------------|-------------|
| **BTC** | 3-4 confirmations | 30-40 minutes | Risky, but BlockCypher confidence factor can help. Acceptable for small amounts (<$50). |
| **ETH** | 12-35 confirmations | 3-7 minutes | Relatively safe after 1 block for small amounts |
| **LTC** | 6 confirmations | ~15 minutes | Moderate risk at 0-conf |
| **DOGE** | 60 confirmations | ~60 minutes | High risk at 0-conf (1-min blocks, low hash rate) |
| **TRX** | 19 confirmations | ~1 minute | Fast enough that waiting is fine |
| **SOL** | 1-2 confirmations | <1 second | Near-instant finality, safe at 1 conf |

**Casino-Specific Strategy:**
- For amounts < $50: Credit at 1 confirmation (or 0-conf for BTC/LTC with risk assessment)
- For amounts $50-$500: Wait for standard confirmations
- For amounts > $500: Wait for full confirmations + manual review
- For Solana and TRON: Credit almost immediately (fast finality)

### Webhooks vs. Polling

| Method | Pros | Cons | Recommended? |
|--------|------|------|-------------|
| **Webhooks** (Alchemy, QuickNode, Tatum) | Real-time, efficient, low resource usage | Dependent on provider uptime, may miss events | Primary method |
| **Polling** (query every 15-60 sec) | Reliable fallback, no missed events | Higher API usage, slight delay | Always run as backup |
| **WebSocket subscriptions** | Real-time, persistent connection | Connection can drop, need reconnection logic | Use for Solana (near-instant) |

**Best Practice:** Use webhooks as primary notification + polling every 30-60 seconds as safety net. Never rely solely on webhooks.

### Handling Deposit Delays

- Store all detected transactions in a `pending_deposits` table
- Run a cron job every minute to check confirmation count for pending deposits
- Implement exponential backoff for re-checking stale pending deposits
- Alert operations team if a deposit has been pending for >2 hours (likely stuck/low fee)
- For UTXO chains: detect Replace-By-Fee (RBF) transactions that might invalidate a pending deposit

---

## 3. WITHDRAWAL FLOW

### Withdrawal Process Design

```
User requests withdrawal (amount, currency, destination address)
        │
        ▼
Validate destination address format per chain
        │
        ▼
Check user balance >= amount + estimated network fee
        │
        ▼
Apply withdrawal limits and cooldowns
        │
        ▼
┌───────────────────────────────────┐
│ Risk Assessment                    │
│ - Amount threshold check           │
│ - Velocity check (too many in 24h) │
│ - AML screening (address check)    │
│ - Wagering requirement met?        │
│ - Account age/verification level   │
└──────────┬────────────────────────┘
           │
     ┌─────┴──────┐
     │             │
  Auto-approve  Manual review
  (< threshold)  (> threshold)
     │             │
     ▼             ▼
Sign transaction with hot wallet private key
     │
     ▼
Broadcast to blockchain
     │
     ▼
Monitor for confirmation
     │
     ▼
Mark withdrawal as complete, notify user
```

### Hot Wallet Management

**Recommended Fund Distribution:**

| Wallet Type | % of Total | Access | Security |
|------------|-----------|--------|----------|
| Hot wallet | 5-10% | Automated, instant | Encrypted private keys on server |
| Warm wallet | 15-25% | Semi-automated, multi-sig (2-of-3) | 1 key on server, 1 key with team member, 1 key in safe |
| Cold wallet | 65-80% | Manual only | Hardware wallet or air-gapped machine |

**Hot Wallet Refill Process:**
1. Monitor hot wallet balance per currency
2. When balance drops below `MIN_HOT_THRESHOLD`, trigger alert
3. Operations team initiates warm-to-hot transfer (multi-sig approval)
4. If warm wallet runs low, schedule cold-to-warm transfer (requires physical hardware wallet access)

### Transaction Fee Management

**Bitcoin Fee Estimation:**
```
fee = fee_rate_per_byte * transaction_size_bytes
```
- Use `estimatesmartfee` RPC or API fee estimation (Tatum, Alchemy)
- Offer users "fast" (next block), "medium" (3 blocks), "slow" (6 blocks) options
- Absorb fees for VIP users, charge regular users the network fee

**Ethereum Gas Management:**
```
fee = gasUsed * (baseFee + priorityFee)
```
- Use EIP-1559 fee estimation APIs
- Set `maxFeePerGas` at 2x current `baseFee` as ceiling
- Batch multiple withdrawals into one transaction where possible (saves gas)
- Time withdrawals during low-congestion periods (weekends, off-peak hours)

**Fee Optimization Strategies:**
- **UTXO batching:** Combine multiple BTC/LTC/DOGE withdrawals into a single transaction with multiple outputs. Can reduce total fees by 50-80%.
- **ERC-20 batching:** Use a custom smart contract to batch multiple USDT/USDC transfers in one transaction.
- **Dynamic timing:** Queue non-urgent withdrawals and process them during low-fee periods.
- **Layer 2:** Offer Lightning Network for BTC withdrawals (near-zero fees).

### Anti-Money Laundering (AML) Considerations

**Must-Have Controls:**
1. **KYC tiered verification:** Allow small deposits/withdrawals without KYC; require ID verification above thresholds (e.g., $2,000 cumulative)
2. **Transaction monitoring:** Flag unusual patterns (rapid deposit-withdraw cycles without wagering, structured deposits just below thresholds)
3. **Address screening:** Check withdrawal addresses against known blacklists (OFAC SDN list, Chainalysis/Elliptic sanctioned addresses)
4. **Wagering requirements:** Require 1x wagering before withdrawal to prevent simple pass-through laundering
5. **Suspicious Activity Reports (SARs):** Have a process for filing SARs if operating in regulated jurisdictions
6. **Travel Rule compliance:** For transfers > $1,000, collect originator/beneficiary information per FATF guidelines
7. **Address reuse detection:** Flag when multiple accounts withdraw to the same external address

---

## 4. MULTI-NETWORK SUPPORT

### USDT on Multiple Networks

USDT is available on 20+ networks. The most relevant for a casino:

| Network | Contract Address | Avg Tx Fee | Tx Speed | Market Share |
|---------|-----------------|-----------|----------|-------------|
| **Ethereum (ERC-20)** | `0xdAC17F958D2ee523a2206206994597C13D831ec7` | $1-10 | 3-7 min | ~35% |
| **TRON (TRC-20)** | `TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t` | $0.50-1.00 | <1 min | ~50% |
| **BSC (BEP-20)** | `0x55d398326f99059fF775485246999027B3197955` | $0.05-0.20 | 3-5 sec | ~8% |
| **Solana (SPL)** | `Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB` | $0.001-0.01 | <1 sec | ~3% |
| **Polygon** | `0xc2132D05D31c914a87C6611C10748AEb04B58e8F` | $0.01-0.05 | 2-3 sec | ~2% |
| **Arbitrum** | `0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9` | $0.01-0.10 | <1 sec | ~2% |

**CRITICAL:** Tokens sent on the wrong network are PERMANENTLY LOST. Your UI must:
1. Show clear network selection before displaying deposit address
2. Generate separate deposit addresses per network
3. Validate that the displayed address format matches the selected network
4. Show prominent warnings about network mismatch

### How Stake.com and Cloudbet Handle Network Selection

**Stake.com:**
- Users select their cryptocurrency, then choose the specific network (e.g., "USDT (ERC-20)" vs "USDT (TRC-20)")
- Each network shows a distinct deposit address
- Custodial wallet system -- users don't manage external wallets
- Supports 20+ cryptocurrencies across multiple networks
- Partners with MoonPay for fiat-to-crypto on-ramp

**Cloudbet:**
- Supports 40+ cryptocurrencies
- Uses offline cold wallets for ALL deposits (security-first approach)
- SSL + TLS 1.3 encryption (QUIC protocol)
- Supports network selection for multi-chain tokens
- No minimum deposit

### Lightning Network for BTC

**Why It Matters for Casinos:**
- Deposits appear in <3 seconds (vs 30-60 minutes on-chain)
- Fees under 0.1% (vs 1-3% on-chain)
- Enables micro-transactions (100 satoshis minimum)
- Perfect for live betting where speed matters

**Integration Options:**
1. **Voltage** (voltage.cloud) -- Managed Lightning node hosting, specifically targets gambling businesses
2. **LND** (Lightning Network Daemon) -- Self-hosted, requires running a BTC full node
3. **Core Lightning** (CLN) -- Alternative implementation
4. **Strike API / Lightspark** -- Third-party Lightning payment APIs

**Implementation Complexity:** Medium-High. Lightning requires:
- Running or connecting to a Lightning node
- Managing payment channels and liquidity
- Generating invoices for deposits (BOLT11 invoices)
- Handling channel capacity and routing

**Recommendation:** Add Lightning Network support in Phase 2 (after basic on-chain deposits work). Use a managed provider like Voltage to reduce complexity.

---

## 5. PRACTICAL RECOMMENDATIONS

### Phase 1: Startup (10-50 Users) -- CHEAPEST VIABLE OPTION

**Recommended: Payment Gateway (NOWPayments or Plisio)**

| Component | Choice | Monthly Cost |
|-----------|--------|-------------|
| Payment processing | NOWPayments or Plisio | $0/mo base + 0.5% per tx |
| Supported coins | BTC, ETH, USDT (ERC-20 + TRC-20), LTC, DOGE, TRX, SOL | Included |
| Address generation | Handled by gateway | Included |
| Deposit detection | Webhook notifications from gateway | Included |
| Withdrawals | Mass payout API | Included |
| **Total fixed cost** | | **$0/mo** |
| **Per $10,000 in deposits** | | **$50 in fees** |

**Why this works for 10-50 users:**
- Zero infrastructure to build or maintain
- Integration takes 1-2 days (REST API + webhooks)
- No DevOps overhead
- Gambling-friendly (both NOWPayments and Plisio explicitly support iGaming)
- Non-custodial (you control funds)
- Scale seamlessly as user base grows

**What you give up:**
- 0.5% per transaction (vs ~$0 with own nodes)
- Less control over deposit detection speed
- Dependent on third-party uptime
- Limited customization of user deposit experience

### Phase 2: Growth (50-1,000 Users) -- HYBRID APPROACH

Switch to the hybrid approach when transaction volume makes the 0.5% fee significant (e.g., at $100K/mo volume, you're paying $500/mo in gateway fees).

| Component | Choice | Monthly Cost |
|-----------|--------|-------------|
| ETH/EVM node access | Alchemy (Pay-as-you-go) | $5-100/mo |
| BTC/LTC/DOGE/TRX access | NOWNodes (Pro) | EUR20/mo |
| Solana access | QuickNode (Build) | $49/mo |
| Wallet service (custom) | Your own microservice | Development time |
| Cloud server | DigitalOcean/Vultr | $40-80/mo |
| **Total infrastructure** | | **~$120-250/mo** |

**What you build:**
- HD wallet service for address generation
- Deposit monitor (webhooks + polling)
- Withdrawal processor with hot/warm/cold wallet management
- Internal balance ledger (off-chain)

**Development estimate:** 4-8 weeks for a senior backend engineer

### Phase 3: Scale (1,000-10,000+ Users) -- FULL INFRASTRUCTURE

| Component | Choice | Monthly Cost |
|-----------|--------|-------------|
| BTC node (own) | OVH dedicated server | ~$80/mo |
| ETH node (own) | OVH dedicated server | ~$300/mo |
| TRON node (own) | OVH dedicated server | ~$200/mo |
| LTC + DOGE nodes | Shared OVH server | ~$60/mo |
| Solana access | QuickNode (Scale) | $499/mo |
| Warm/cold custody | Fireblocks Essentials or custom multi-sig | ~$700-2,000/mo |
| DevOps/SRE | Part-time or full-time | $3,000-8,000/mo |
| Monitoring/alerting | Datadog/Grafana | $100-300/mo |
| **Total** | | **~$4,940-11,440/mo** |

At this scale, the savings from zero per-transaction fees (vs 0.5%) on $1M+/mo volume far outweigh infrastructure costs.

### What Real Crypto Casinos Use

**Stake.com ($3B+ annual revenue):**
- Custom-built wallet infrastructure
- Runs own nodes for all supported chains
- Custodial wallet system (users deposit to Stake-managed addresses)
- Partners with MoonPay for fiat on-ramp
- Cold wallet storage for majority of funds
- Licensed in Curacao

**Cloudbet (established 2013):**
- Custom infrastructure
- ALL deposits stored in offline cold wallets
- Supports 40+ cryptocurrencies
- QUIC/TLS 1.3 encryption
- Licensed in Curacao

**BC.Game:**
- Supports 80+ cryptocurrencies + fiat
- Region-specific e-wallet integrations
- Licensed in Anjouan, Comoros
- Likely uses a combination of own infrastructure + third-party APIs

**Common Pattern:** All major crypto casinos eventually build their own wallet infrastructure. They start with third-party solutions and migrate to custom systems as they scale.

### Final Architecture Recommendation

```
PHASE 1 (Launch, 0-50 users):
  NOWPayments API → Your Backend → PostgreSQL → Frontend
  Cost: ~$0/mo + 0.5% per tx
  Timeline: 1-2 weeks integration

PHASE 2 (Growth, 50-1,000 users):
  Alchemy + NOWNodes + QuickNode → Custom Wallet Service → PostgreSQL → Frontend
  Cost: ~$150-250/mo + network fees only
  Timeline: 4-8 weeks development

PHASE 3 (Scale, 1,000-10,000+ users):
  Own BTC/ETH/TRX Nodes + QuickNode(SOL) → Wallet Service → Hot/Warm/Cold Wallets → PostgreSQL → Frontend
  + Fireblocks or custom multi-sig for cold storage
  + Lightning Network for instant BTC
  Cost: ~$5,000-11,000/mo
  Timeline: 3-6 months development
```

---

## Appendix A: Service-by-Service Detailed Breakdown

### NOWNodes (nownodes.io)
- **Type:** Node RPC API provider
- **Pricing:** Free (100K req/mo) | Pro EUR20/mo (1M req) | Business EUR200/mo (30M req) | Enterprise EUR500/mo (100M req)
- **Chains:** 100+ blockchains including BTC, ETH, LTC, DOGE, TRX, SOL, and many more
- **Features:** REST + WebSocket, Blockbook/Tendermint APIs, shared and dedicated nodes, 99.95% uptime, ~0.6s response time
- **Gambling:** No restrictions (infrastructure-only service)
- **API Quality:** Good documentation, 24/7 support
- **Best For:** Budget-friendly access to many chains, especially non-EVM chains

### BlockCypher (blockcypher.com)
- **Type:** Blockchain API with wallet features
- **Pricing:** Free tier available | Paid from $100/mo | 10% discount for BTC payment
- **Chains:** BTC, ETH, LTC, DOGE, DASH only (limited)
- **Features:** HD wallets, webhooks, WebSockets, multi-sig, metadata API, unique confidence factor for 0-conf
- **Gambling:** Not explicitly restricted
- **API Quality:** Excellent documentation, battle-tested since 2014, 99.99% uptime
- **Best For:** BTC/LTC/DOGE wallet operations with 0-conf confidence scoring

### Alchemy (alchemy.com)
- **Type:** Web3 infrastructure (RPC + enhanced APIs)
- **Pricing:** Free (30M CU/mo) | PAYG ($0.40-0.45/1M CU) | Enterprise (custom)
- **Chains:** 50+ (ETH, Polygon, Arbitrum, Optimism, Base, Solana, etc.)
- **Features:** Webhooks (Alchemy Notify), enhanced token/NFT APIs, Gas Manager, simulation tooling
- **Gambling:** No restrictions (infrastructure service)
- **API Quality:** Industry-leading documentation and developer experience
- **Best For:** EVM ecosystem, Ethereum and L2s

### Infura (infura.io)
- **Type:** Ethereum-focused RPC provider (owned by Consensys/MetaMask)
- **Pricing:** Free (6M credits/day) | Enterprise (custom)
- **Chains:** ETH, Polygon, Optimism, Arbitrum, Avalanche, Starknet, IPFS
- **Features:** JSON-RPC over HTTPS/WSS, Gas API, archive data access
- **Gambling:** No restrictions (infrastructure service)
- **API Quality:** Mature, reliable, 99.9% uptime SLA
- **Best For:** Ethereum-only use cases, MetaMask compatibility

### QuickNode (quicknode.com)
- **Type:** Multi-chain RPC provider
- **Pricing:** Free (10M credits) | Build $49/mo | Accelerate $249/mo | Scale $499/mo | Business $999/mo
- **Chains:** 79+ chains, 130+ networks (broadest coverage)
- **Features:** Streams, webhooks, IPFS, QuickAlerts, crypto payment option
- **Gambling:** No restrictions (infrastructure service)
- **API Quality:** Good documentation, responsive support
- **Best For:** Multi-chain support including Solana, broadest network coverage

### Moralis (moralis.io)
- **Type:** Web3 data APIs + Streams
- **Pricing:** Free (~40K CU/day) | Starter ~$49/mo | Pro ~$199/mo | Business/Enterprise custom
- **Chains:** EVM chains + Solana
- **Features:** Wallet API, Token API, NFT API, Price API, Streams (real-time webhooks), Datashare
- **Gambling:** No restrictions (data service)
- **API Quality:** Good documentation, active community
- **Best For:** Enhanced data APIs on top of basic RPC (token balances, transaction history, webhooks)

### Tatum (tatum.io)
- **Type:** Multi-chain wallet and blockchain API
- **Pricing:** Free (100K lifetime credits, 2 keys, 3 RPS) | Pro (4M credits/mo, 200 RPS) | Enterprise (custom, unlimited)
- **Chains:** 130+ blockchains
- **Features:** HD wallet creation, address management, virtual accounts (off-chain ledger), webhook notifications, tx broadcasting, fee estimation, NFT minting
- **Gambling:** Not explicitly restricted, but terms may apply. Verify before committing.
- **API Quality:** Comprehensive documentation, TypeScript SDK
- **Best For:** Building a complete wallet backend with minimal custom code. Virtual accounts feature is particularly useful for casino internal balances.

### Fireblocks (fireblocks.com)
- **Type:** Institutional digital asset custody and infrastructure
- **Pricing:** Essentials ~$699/mo (first 6 months, price increases after) + $0.40-0.90/embedded wallet + 0.16-0.23% tx overage | Pro: higher | Enterprise: custom
- **Chains:** 100+ blockchains
- **Features:** MPC (multi-party computation) key management, policy engine, AML screening, embedded wallets, DeFi access, insurance
- **Gambling:** Requires compliance review. Major institutions use it (BNY, Revolut, Galaxy). May require gambling license.
- **API Quality:** Enterprise-grade, dedicated support
- **Best For:** Regulated operations handling $10M+ in assets, needing institutional-grade security and compliance

### BitGo (bitgo.com)
- **Type:** Institutional custody and wallet infrastructure
- **Pricing:** Custom (enterprise sales only)
- **Chains:** Wide multi-chain support
- **Features:** Multi-sig (2-of-3), $250M Lloyd's insurance, qualified custody, staking, custom fee profiles, transaction bundling
- **Gambling:** Unknown -- likely requires compliance review and gambling license
- **API Quality:** Mature, well-documented
- **Best For:** Large-scale operations needing regulated qualified custody with insurance

### CoinPayments (coinpayments.net)
- **Type:** Crypto payment gateway
- **Pricing:** 1% flat fee per transaction, no monthly fees, volume discounts available
- **Chains:** 2,000+ cryptocurrencies (widest support)
- **Features:** Mass payouts, instant notifications, stablecoin withdrawals, auto-conversion, shopping cart plugins
- **Gambling:** **YES -- widely used by crypto casinos**
- **API Quality:** Adequate, established since 2013
- **Best For:** Maximum crypto variety, established gambling merchant support

### CoinGate (coingate.com)
- **Type:** Crypto payment gateway
- **Pricing:** 1% flat fee, no setup/monthly fees, custom pricing for high volume
- **Chains:** 50+ cryptocurrencies
- **Features:** Auto crypto-to-fiat conversion, white-label solution, refund support, AML/KYC built-in, EU-regulated
- **Gambling:** **YES -- dedicated casino and sports betting solutions**
- **API Quality:** Good documentation, responsive support
- **Best For:** EU-regulated gambling operations needing compliance and fiat settlement

### NOWPayments (nowpayments.io)
- **Type:** Crypto payment gateway
- **Pricing:** 0.5-1% per transaction, no setup/monthly fees
- **Chains:** 350+ cryptocurrencies, 40+ fiat currencies
- **Features:** Non-custodial, mass payouts via API, stablecoin support (35+), crypto-to-crypto conversion
- **Gambling:** **YES -- explicitly supports gambling/iGaming with dedicated solutions page**
- **API Quality:** Simple integration, good documentation, REST API
- **Best For:** Gambling platforms wanting widest crypto support with lowest gateway fees

### Plisio (plisio.net)
- **Type:** Crypto payment gateway
- **Pricing:** Gateway: 0.5% | White Label: 1.5% | Free account, no monthly fees
- **Chains:** 50+ (BTC, ETH, LTC, DOGE, USDT, USDC, XMR, DASH, ZEC, etc.)
- **Features:** Automatic gateway, batch transactions (up to 1000, saving 80%), no chargebacks, 160+ fiat conversion
- **Gambling:** **YES -- actively supports gambling merchants with case studies**
- **API Quality:** Good, plugins for WooCommerce/Magento/PrestaShop
- **Best For:** Low-cost gateway with batch transaction savings

### CryptoCloud (cryptocloud.plus)
- **Type:** Crypto payment gateway
- **Pricing:** Standard: 1.9% | Large projects: from 0.4% (negotiable)
- **Chains:** BTC, ETH, LTC, USDT, USDC, TRX, BNB, TON, DOGE, SHIB, SOL
- **Features:** Auto-conversion to USDT, white-label checkout page (7 languages), Telegram bot notifications, scheduled auto-payouts
- **Gambling:** **YES -- explicitly gambling-friendly, supports high-risk industries**
- **API Quality:** Adequate documentation
- **Best For:** Gambling platforms wanting USDT auto-conversion and Telegram integration

### OxaPay (oxapay.com)
- **Type:** Crypto payment gateway
- **Pricing:** 0.4% flat fee (one of the lowest), zero fee for internal transfers
- **Chains:** BTC, USDT, ETH, and more
- **Features:** No KYC required for merchants, white-label, full API, analytics, invoicing
- **Gambling:** **Likely yes -- no KYC and gambling-tolerant based on positioning**
- **API Quality:** Good API documentation
- **Best For:** Absolute lowest fees (0.4%), no-KYC merchant setup

### Coinbase Commerce
- **Type:** Crypto payment gateway
- **Pricing:** 1% fee per transaction
- **Chains:** Major cryptocurrencies (BTC, ETH, USDC, etc.)
- **Features:** Simple integration, Coinbase ecosystem
- **Gambling:** **ABSOLUTELY NOT -- Gambling is PROHIBITED. Their terms explicitly ban "lotteries, bidding fee auctions, sports forecasting or odds making, fantasy sports leagues with cash prizes, internet gaming, contests, sweepstakes, or games of chance."**
- **DO NOT USE for any gambling/betting platform**

### B2BinPay (b2binpay.com)
- **Type:** Crypto payment processor
- **Pricing:** Incoming: 0.25-0.50% (volume-based); Outgoing: 0% (free payouts); Fiat withdrawal: 0.50% (SWIFT/SEPA)
- **Chains:** 76+ cryptocurrencies
- **Features:** Sandbox environment, auto-conversion, real-time settlement, dedicated casino/gaming solution
- **Gambling:** **YES -- has dedicated casino and iGaming solutions**
- **Restrictions:** Not available in USA, Iran, North Korea, Myanmar
- **API Quality:** Professional, sandbox for testing
- **Best For:** High-volume operations ($1M+/mo) wanting lowest processing fees with dedicated gambling support

---

## Appendix B: Key Technical Implementation Notes

### Database Schema for Wallet Management

```sql
-- User deposit addresses
CREATE TABLE deposit_addresses (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    currency VARCHAR(10) NOT NULL,      -- 'BTC', 'ETH', 'USDT', etc.
    network VARCHAR(20) NOT NULL,       -- 'bitcoin', 'ethereum', 'tron', 'bsc', 'solana'
    address VARCHAR(128) NOT NULL,
    derivation_index INTEGER NOT NULL,  -- BIP44 index
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(currency, network, address),
    UNIQUE(user_id, currency, network)
);

-- Detected deposits
CREATE TABLE deposits (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    deposit_address_id INTEGER REFERENCES deposit_addresses(id),
    tx_hash VARCHAR(128) NOT NULL,
    currency VARCHAR(10) NOT NULL,
    network VARCHAR(20) NOT NULL,
    amount DECIMAL(28, 18) NOT NULL,
    confirmations INTEGER DEFAULT 0,
    required_confirmations INTEGER NOT NULL,
    status VARCHAR(20) DEFAULT 'pending', -- pending, confirming, credited, failed
    credited_at TIMESTAMP,
    detected_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(tx_hash, network)
);

-- Withdrawal requests
CREATE TABLE withdrawals (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    currency VARCHAR(10) NOT NULL,
    network VARCHAR(20) NOT NULL,
    amount DECIMAL(28, 18) NOT NULL,
    fee DECIMAL(28, 18),
    destination_address VARCHAR(128) NOT NULL,
    tx_hash VARCHAR(128),
    status VARCHAR(20) DEFAULT 'pending', -- pending, approved, processing, broadcast, confirmed, failed, rejected
    reviewed_by INTEGER REFERENCES users(id),
    reviewed_at TIMESTAMP,
    broadcast_at TIMESTAMP,
    confirmed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Hot wallet balances (cached, reconciled periodically)
CREATE TABLE hot_wallet_balances (
    currency VARCHAR(10) NOT NULL,
    network VARCHAR(20) NOT NULL,
    balance DECIMAL(28, 18) NOT NULL,
    min_threshold DECIMAL(28, 18) NOT NULL,
    max_threshold DECIMAL(28, 18) NOT NULL,
    last_reconciled_at TIMESTAMP,
    PRIMARY KEY(currency, network)
);
```

### Environment Variables / Configuration

```
# Node API providers
ALCHEMY_API_KEY=xxx
QUICKNODE_ENDPOINT=https://xxx.quiknode.pro/xxx/
NOWNODES_API_KEY=xxx

# Or Payment Gateway
NOWPAYMENTS_API_KEY=xxx
NOWPAYMENTS_IPN_SECRET=xxx

# HD Wallet (NEVER store mnemonic in env vars in production!)
# Instead, derive xpubs offline and store only xpubs
BTC_XPUB=xpub6xxx...
ETH_XPUB=xpub6xxx...
LTC_XPUB=xpub6xxx...
DOGE_XPUB=xpub6xxx...
TRX_XPUB=xpub6xxx...
SOL_XPUB=xxx...

# Hot wallet private keys (encrypted at rest)
HOT_WALLET_ENCRYPTION_KEY=xxx

# Confirmation thresholds
BTC_CONFIRMATIONS=3
ETH_CONFIRMATIONS=12
LTC_CONFIRMATIONS=6
DOGE_CONFIRMATIONS=60
TRX_CONFIRMATIONS=19
SOL_CONFIRMATIONS=1
```

---

## Sources

- [Bitcoin Core Requirements](https://bitcoin.org/en/bitcoin-core/features/requirements)
- [How to Run a Bitcoin Node - Coin Bureau](https://coinbureau.com/guides/how-to-run-a-bitcoin-node)
- [Ethereum Node Hardware Requirements - Cherry Servers](https://www.cherryservers.com/blog/ethereum-node-requirements)
- [Geth Hardware Requirements](https://geth.ethereum.org/docs/getting-started/hardware-requirements)
- [Solana Validator Requirements](https://docs.solanalabs.com/operations/requirements)
- [Solana Node Cost - Cherry Servers](https://www.cherryservers.com/blog/solana-node-cost)
- [TRON Deploy Node Documentation](https://developers.tron.network/docs/deploy-the-fullnode-or-supernode)
- [Alchemy Pricing](https://www.alchemy.com/pricing)
- [QuickNode Pricing](https://www.quicknode.com/pricing)
- [NOWNodes Pricing](https://nownodes.io/pricing)
- [Infura Pricing](https://www.infura.io/pricing)
- [Moralis Pricing](https://moralis.com/pricing/)
- [Tatum Pricing](https://tatum.io/pricing)
- [Fireblocks Pricing](https://www.fireblocks.com/pricing)
- [BlockCypher Pricing](https://www.blockcypher.com/pricing.html)
- [NOWPayments - Gambling Solutions](https://nowpayments.io/all-solutions/casinos)
- [NOWPayments Pricing](https://nowpayments.io/pricing)
- [CoinPayments - Crypto Payment Gateway](https://www.coinpayments.net/)
- [CoinGate - Casino Payment Gateway](https://coingate.com/solutions/casinos)
- [Plisio Pricing](https://plisio.net/pricing)
- [CryptoCloud - Gambling Solutions](https://cryptocloud.plus/en/solutions/gambling)
- [OxaPay Pricing](https://oxapay.com/pricing)
- [Coinbase Commerce Terms](https://www.coinbase.com/legal/commerce/terms-of-service)
- [Coinbase Prohibited Use Policy](https://www.coinbase.com/legal/prohibited_use)
- [B2BinPay Fees](https://b2binpay.com/en/fees-crypto-payment-processing)
- [B2BinPay Casino Solution](https://b2binpay.com/en/solutions/casinos)
- [Kraken Deposit Confirmations](https://support.kraken.com/articles/203325283-cryptocurrency-deposit-processing-times)
- [Blockchain Confirmations - Circle](https://developers.circle.com/circle-mint/blockchain-confirmations)
- [USDT Networks Guide - Cryptomus](https://cryptomus.com/blog/everything-you-need-to-know-about-usdt-networks)
- [HD Wallets - Learn Me A Bitcoin](https://learnmeabitcoin.com/technical/keys/hd-wallets/)
- [BIP44 Wallet Address Generation](https://medium.com/geekculture/generate-bitcoin-wallet-address-using-bitcoin-improvement-proposal-44-4672e5057bb)
- [ERC-20 Event Log Reading](https://goethereumbook.org/en/event-read-erc20/)
- [TRC-20 Contract Interaction - TRON](https://developers.tron.network/docs/trc20-contract-interaction)
- [Lightning Network Casino Guide](https://www.cryptowisser.com/guides/bitcoin-lightning-network-gambling-guide-2025/)
- [Lightning for Casinos - Voltage](https://www.voltage.cloud/blog/fixing-bitcoin-payments-for-casinos-how-lightning-eliminates-fraud-for-digital-and-in-person-betting)
- [Casino AML Compliance Guide 2025](https://www.sanctions.io/blog/casino-aml-compliance-2025)
- [Crypto AML Guide 2026 - Sumsub](https://sumsub.com/blog/crypto-aml-guide/)
- [OVH Blockchain Server Hosting](https://www.ovhcloud.com/en/bare-metal/blockchain-server/)
- [Best Crypto Payment Gateways for iGaming 2025](https://playtoday.co/blog/guides/crypto-payment-gateways/)
- [Crypto Payment Gateways - PayRam](https://payram.com/blog/best-crypto-payment-gateway-for-casinos-and-igaming)
- [Fireblocks vs Competitors - Bitbond](https://www.bitbond.com/resources/fireblocks-competitors-the-complete-guide-to-digital-asset-custody/)
- [Hot vs Cold Wallets - Fireblocks](https://www.fireblocks.com/blog/hot-vs-warm-vs-cold-which-crypto-wallet-is-right-for-me)
- [Stake.com Wikipedia](https://en.wikipedia.org/wiki/Stake_(online_casino))
- [Cloudbet Review - CoinCodeCap](https://coincodecap.com/cloudbet-casino-review)
