import crypto from 'crypto';

export function generateSecureToken(length = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

export function hashSHA256(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

export function hmacSHA256(key: string, message: string): string {
  return crypto.createHmac('sha256', key).update(message).digest('hex');
}

export function generateProvablyFairSeed(): { serverSeed: string; serverSeedHash: string } {
  const serverSeed = generateSecureToken(32);
  const serverSeedHash = hashSHA256(serverSeed);
  return { serverSeed, serverSeedHash };
}

export function verifyCrashPoint(serverSeed: string, clientSeed: string, nonce: number): number {
  const hash = hmacSHA256(serverSeed, `${clientSeed}:${nonce}`);
  const h = parseInt(hash.slice(0, 8), 16);
  const e = Math.pow(2, 32);
  const houseEdge = 0.03; // 3%
  const result = Math.floor((100 * e - h) / (e - h)) / 100;
  return Math.max(1, result * (1 - houseEdge));
}

export function verifyDiceRoll(serverSeed: string, clientSeed: string, nonce: number): number {
  const hash = hmacSHA256(serverSeed, `${clientSeed}:${nonce}`);
  const h = parseInt(hash.slice(0, 8), 16);
  return (h % 10001) / 100; // 0.00 to 100.00
}

export function verifyCoinFlip(serverSeed: string, clientSeed: string, nonce: number): 'heads' | 'tails' {
  const hash = hmacSHA256(serverSeed, `${clientSeed}:${nonce}`);
  const h = parseInt(hash.slice(0, 8), 16);
  return h % 2 === 0 ? 'heads' : 'tails';
}

export function verifyMinesPositions(
  serverSeed: string,
  clientSeed: string,
  nonce: number,
  mineCount: number,
  gridSize = 25
): number[] {
  const mines: number[] = [];
  let index = 0;
  while (mines.length < mineCount) {
    const hash = hmacSHA256(serverSeed, `${clientSeed}:${nonce}:${index}`);
    const h = parseInt(hash.slice(0, 8), 16);
    const pos = h % gridSize;
    if (!mines.includes(pos)) {
      mines.push(pos);
    }
    index++;
  }
  return mines.sort((a, b) => a - b);
}

export function verifyPlinkoPath(
  serverSeed: string,
  clientSeed: string,
  nonce: number,
  rows: number
): ('L' | 'R')[] {
  const path: ('L' | 'R')[] = [];
  for (let i = 0; i < rows; i++) {
    const hash = hmacSHA256(serverSeed, `${clientSeed}:${nonce}:${i}`);
    const h = parseInt(hash.slice(0, 8), 16);
    path.push(h % 2 === 0 ? 'L' : 'R');
  }
  return path;
}

export function encryptValue(value: string): string {
  const algorithm = 'aes-256-gcm';
  const key = Buffer.from(process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex'), 'hex');
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(value, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

export function decryptValue(encrypted: string): string {
  const algorithm = 'aes-256-gcm';
  const key = Buffer.from(process.env.ENCRYPTION_KEY || '', 'hex');
  const [ivHex, authTagHex, encryptedData] = encrypted.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
