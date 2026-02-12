'use client';

import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface VerificationStep {
  label: string;
  value: string;
  description: string;
}

// ---------- HMAC-SHA256 using Web Crypto API ----------
async function hmacSha256(key: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(key);
  const messageData = encoder.encode(message);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// ---------- Game Result Calculators ----------
function _hashToNumber(hash: string, modulus: number): number {
  // Take first 8 chars of hash, convert to integer, modulus
  const hex = hash.slice(0, 8);
  const num = parseInt(hex, 16);
  return num % modulus;
}

function hashToCrashPoint(hash: string): number {
  // Convert hash to a crash point
  // Using standard algorithm: h = HMAC_SHA256(server_seed, client_seed:nonce)
  // e = first 52 bits as integer / 2^52
  // if e < 0.04 (house edge ~4%), crash at 1.00
  // otherwise: 0.99 / (1 - e), floored to 2 decimals
  const h = parseInt(hash.slice(0, 13), 16);
  const e = h / Math.pow(2, 52);
  if (e < 0.04) return 1.0;
  return Math.max(1.0, Math.floor((0.99 / (1 - e)) * 100) / 100);
}

function hashToDiceRoll(hash: string): number {
  // Convert hash to dice roll 0-99.99
  const h = parseInt(hash.slice(0, 8), 16);
  return (h % 10000) / 100;
}

function hashToMinesPositions(hash: string, mineCount: number): number[] {
  // Generate mine positions from hash
  const positions: number[] = [];
  let remaining = hash;
  while (positions.length < mineCount && remaining.length >= 2) {
    const val = parseInt(remaining.slice(0, 2), 16) % 25;
    if (!positions.includes(val)) {
      positions.push(val);
    }
    remaining = remaining.slice(2);
  }
  return positions.sort((a, b) => a - b);
}

function hashToPlinkoBucket(hash: string, rows: number): number {
  // Generate plinko path from hash
  let position = 0;
  for (let i = 0; i < rows; i++) {
    const charVal = parseInt(hash[i % hash.length], 16);
    if (charVal >= 8) position++;
  }
  return position;
}

type GameType = 'crash' | 'dice' | 'mines' | 'plinko';

export default function VerifyPage() {
  const [serverSeed, setServerSeed] = useState('');
  const [clientSeed, setClientSeed] = useState('');
  const [nonce, setNonce] = useState('0');
  const [gameType, setGameType] = useState<GameType>('crash');
  const [mineCount, setMineCount] = useState(5);
  const [plinkoRows, setPlinkoRows] = useState(12);
  const [isVerifying, setIsVerifying] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [_hash, setHash] = useState<string | null>(null);
  const [steps, setSteps] = useState<VerificationStep[]>([]);

  const handleVerify = useCallback(async () => {
    if (!serverSeed || !clientSeed) return;

    setIsVerifying(true);
    try {
      // Step 1: Combine inputs
      const message = `${clientSeed}:${nonce}`;

      // Step 2: HMAC-SHA256
      const computedHash = await hmacSha256(serverSeed, message);
      setHash(computedHash);

      const verificationSteps: VerificationStep[] = [
        {
          label: 'Input',
          value: `Server Seed: ${serverSeed}\nClient Seed: ${clientSeed}\nNonce: ${nonce}`,
          description: 'The three inputs that determine the game result.',
        },
        {
          label: 'Message',
          value: message,
          description: 'The message is formed by combining client seed and nonce with a colon separator.',
        },
        {
          label: 'HMAC-SHA256',
          value: computedHash,
          description: 'The HMAC-SHA256 of the message using the server seed as the key produces this hash.',
        },
      ];

      // Step 3: Convert to game result
      let gameResult: string;

      switch (gameType) {
        case 'crash': {
          const crashPoint = hashToCrashPoint(computedHash);
          gameResult = `${crashPoint.toFixed(2)}x`;
          verificationSteps.push({
            label: 'Crash Point',
            value: gameResult,
            description: `The first 13 hex characters are converted to a 52-bit integer, divided by 2^52 to get a float e. If e < 0.04 (house edge), the result is 1.00x. Otherwise: floor(0.99 / (1 - e) * 100) / 100.`,
          });
          break;
        }
        case 'dice': {
          const roll = hashToDiceRoll(computedHash);
          gameResult = roll.toFixed(2);
          verificationSteps.push({
            label: 'Dice Roll',
            value: gameResult,
            description: `The first 8 hex characters are converted to an integer, modulo 10000, then divided by 100 to get a value between 0.00 and 99.99.`,
          });
          break;
        }
        case 'mines': {
          const positions = hashToMinesPositions(computedHash, mineCount);
          gameResult = positions.join(', ');
          verificationSteps.push({
            label: 'Mine Positions',
            value: `[${gameResult}]`,
            description: `Sequential pairs of hex characters are converted to integers (mod 25). Duplicates are skipped until ${mineCount} unique positions are found. Grid positions are 0-24 (5x5).`,
          });
          break;
        }
        case 'plinko': {
          const bucket = hashToPlinkoBucket(computedHash, plinkoRows);
          gameResult = `Bucket ${bucket}`;
          verificationSteps.push({
            label: 'Plinko Bucket',
            value: gameResult,
            description: `Each hex character of the hash determines a left (0-7) or right (8-F) bounce at each peg row. The final position after ${plinkoRows} rows determines the bucket.`,
          });
          break;
        }
        default:
          gameResult = 'Unknown game type';
      }

      setResult(gameResult);
      setSteps(verificationSteps);
    } catch (err) {
      console.error('Verification failed:', err);
      setResult('Error computing result');
    } finally {
      setIsVerifying(false);
    }
  }, [serverSeed, clientSeed, nonce, gameType, mineCount, plinkoRows]);

  return (
    <div className="max-w-3xl mx-auto px-2 sm:px-0">
      <h1 className="text-2xl font-bold mb-2">Provably Fair Verification</h1>
      <p className="text-sm text-gray-400 mb-6">
        Verify that any game result was generated fairly using cryptographic hashing.
        Enter the seeds and nonce from a game round to independently compute the result.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Input Form */}
        <div className="lg:col-span-2 space-y-4">
          <div className="card space-y-4">
            <h2 className="text-sm font-semibold text-gray-300">Verification Inputs</h2>

            {/* Game Type */}
            <div>
              <label className="text-xs text-gray-400 mb-1.5 block font-medium">
                Game Type
              </label>
              <div className="grid grid-cols-4 gap-2">
                {(['crash', 'dice', 'mines', 'plinko'] as GameType[]).map((g) => (
                  <button
                    key={g}
                    onClick={() => setGameType(g)}
                    className={cn(
                      'py-2 rounded-lg text-xs font-medium capitalize transition-colors',
                      gameType === g
                        ? 'bg-brand-500 text-white'
                        : 'bg-surface-tertiary text-gray-300 hover:bg-surface-hover'
                    )}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            {/* Server Seed */}
            <div>
              <label className="text-xs text-gray-400 mb-1.5 block font-medium">
                Server Seed (unhashed)
              </label>
              <input
                type="text"
                value={serverSeed}
                onChange={(e) => setServerSeed(e.target.value)}
                placeholder="Enter the revealed server seed"
                className="input font-mono text-sm"
              />
              <p className="text-[10px] text-gray-600 mt-1">
                The server seed is revealed after the seed is rotated or the game ends.
              </p>
            </div>

            {/* Client Seed */}
            <div>
              <label className="text-xs text-gray-400 mb-1.5 block font-medium">
                Client Seed
              </label>
              <input
                type="text"
                value={clientSeed}
                onChange={(e) => setClientSeed(e.target.value)}
                placeholder="Enter your client seed"
                className="input font-mono text-sm"
              />
              <p className="text-[10px] text-gray-600 mt-1">
                The client seed is set by you and can be changed at any time.
              </p>
            </div>

            {/* Nonce */}
            <div>
              <label className="text-xs text-gray-400 mb-1.5 block font-medium">
                Nonce
              </label>
              <input
                type="number"
                value={nonce}
                onChange={(e) => setNonce(e.target.value)}
                placeholder="0"
                className="input font-mono text-sm"
                min={0}
              />
              <p className="text-[10px] text-gray-600 mt-1">
                The nonce increments by 1 for each bet placed with the current seed pair.
              </p>
            </div>

            {/* Game-specific options */}
            {gameType === 'mines' && (
              <div>
                <label className="text-xs text-gray-400 mb-1.5 block font-medium">
                  Mine Count
                </label>
                <input
                  type="number"
                  value={mineCount}
                  onChange={(e) => setMineCount(parseInt(e.target.value) || 1)}
                  className="input font-mono text-sm"
                  min={1}
                  max={24}
                />
              </div>
            )}
            {gameType === 'plinko' && (
              <div>
                <label className="text-xs text-gray-400 mb-1.5 block font-medium">
                  Rows
                </label>
                <div className="flex gap-2">
                  {[8, 12, 16].map((r) => (
                    <button
                      key={r}
                      onClick={() => setPlinkoRows(r)}
                      className={cn(
                        'flex-1 py-2 rounded-lg text-xs font-medium transition-colors',
                        plinkoRows === r
                          ? 'bg-brand-500 text-white'
                          : 'bg-surface-tertiary text-gray-300'
                      )}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Verify Button */}
            <button
              onClick={handleVerify}
              disabled={!serverSeed || !clientSeed || isVerifying}
              className={cn(
                'btn-accent w-full py-3 font-semibold text-base',
                (!serverSeed || !clientSeed) && 'opacity-50 cursor-not-allowed'
              )}
            >
              {isVerifying ? 'Computing...' : 'Verify Result'}
            </button>
          </div>

          {/* Verification Steps */}
          {steps.length > 0 && (
            <div className="card space-y-4 animate-fade-in">
              <h2 className="text-sm font-semibold text-gray-300">
                Step-by-Step Verification
              </h2>

              {steps.map((step, i) => (
                <div key={i} className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-brand-500/20 text-brand-400 text-xs font-bold flex items-center justify-center">
                      {i + 1}
                    </span>
                    <span className="text-sm font-medium text-gray-300">
                      {step.label}
                    </span>
                  </div>
                  <div className="ml-8">
                    <p className="text-xs text-gray-400 mb-1">{step.description}</p>
                    <div className="bg-surface-tertiary rounded-lg p-3 font-mono text-xs text-gray-300 break-all whitespace-pre-wrap">
                      {step.value}
                    </div>
                  </div>
                </div>
              ))}

              {/* Final Result */}
              {result && (
                <div className="border-t border-border pt-4">
                  <div className="bg-brand-500/10 border border-brand-500/20 rounded-lg p-4 text-center">
                    <p className="text-xs text-gray-400 mb-1 uppercase tracking-wider">
                      Computed Result
                    </p>
                    <p className="text-3xl font-bold font-mono text-brand-400">
                      {result}
                    </p>
                    <p className="text-xs text-gray-500 mt-2">
                      Compare this with the game result shown in your bet history.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* How It Works */}
        <div className="space-y-4">
          <div className="card">
            <h3 className="text-sm font-semibold text-gray-300 mb-3">
              How Provably Fair Works
            </h3>
            <div className="space-y-3 text-xs text-gray-400">
              <div>
                <p className="text-gray-300 font-medium mb-1">1. Before the game</p>
                <p>
                  The server generates a random seed and shows you a SHA-256 hash
                  of it. This commits the server to a result without revealing it.
                </p>
              </div>
              <div>
                <p className="text-gray-300 font-medium mb-1">2. Your input</p>
                <p>
                  You provide a client seed (or use a randomly generated one). This
                  ensures the server cannot predict the final result.
                </p>
              </div>
              <div>
                <p className="text-gray-300 font-medium mb-1">3. Result generation</p>
                <p>
                  The game result is computed as{' '}
                  <code className="bg-surface-tertiary px-1 rounded text-gray-300">
                    HMAC_SHA256(server_seed, client_seed:nonce)
                  </code>
                  . The hash output is then mapped to a game-specific result.
                </p>
              </div>
              <div>
                <p className="text-gray-300 font-medium mb-1">4. Verification</p>
                <p>
                  After the game, the server reveals the original seed. You can verify
                  that its SHA-256 hash matches the one shown before the game, and
                  recompute the result yourself.
                </p>
              </div>
            </div>
          </div>

          <div className="card">
            <h3 className="text-sm font-semibold text-gray-300 mb-3">
              Algorithm per Game
            </h3>
            <div className="space-y-3 text-xs text-gray-400">
              <div>
                <p className="text-brand-400 font-medium">Crash</p>
                <p>
                  First 13 hex chars to 52-bit int, divided by 2^52.
                  If result &lt; 0.04, crash at 1.00x. Otherwise:
                  floor(0.99 / (1 - e) * 100) / 100.
                </p>
              </div>
              <div>
                <p className="text-brand-400 font-medium">Dice</p>
                <p>
                  First 8 hex chars to int, modulo 10000, then divided by 100
                  for a value between 0.00 and 99.99.
                </p>
              </div>
              <div>
                <p className="text-brand-400 font-medium">Mines</p>
                <p>
                  Sequential hex char pairs map to grid positions (mod 25).
                  Duplicates are skipped until the required number of mines
                  is placed.
                </p>
              </div>
              <div>
                <p className="text-brand-400 font-medium">Plinko</p>
                <p>
                  Each hex char determines direction at each peg row: 0-7 = left,
                  8-F = right. Final position is the bucket.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
