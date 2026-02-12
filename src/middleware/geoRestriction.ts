import { FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../lib/prisma';
import { GeoRestrictedError } from '../utils/errors';
import { getCache, setCache } from '../lib/redis';

const GEO_CACHE_KEY = 'geo:blocked-countries';
const GEO_CACHE_TTL = 300; // 5 minutes

async function getBlockedCountries(): Promise<Set<string>> {
  const cached = await getCache<string[]>(GEO_CACHE_KEY);
  if (cached) return new Set(cached);

  const restrictions = await prisma.geoRestriction.findMany({
    where: { isBlocked: true },
    select: { countryCode: true },
  });

  const codes = restrictions.map((r) => r.countryCode);
  await setCache(GEO_CACHE_KEY, codes, GEO_CACHE_TTL);
  return new Set(codes);
}

function getCountryFromIP(_ip: string): string | null {
  // In production, use MaxMind GeoIP2 database
  // For now, return null (no restriction)
  // const reader = await maxmind.open('/path/to/GeoLite2-Country.mmdb');
  // const result = reader.get(ip);
  // return result?.country?.iso_code || null;
  return null;
}

export async function geoRestrictionMiddleware(
  request: FastifyRequest,
  _reply: FastifyReply
): Promise<void> {
  const ip = request.ip || request.headers['x-forwarded-for']?.toString() || '';
  const countryCode = getCountryFromIP(ip);

  if (!countryCode) return; // Cannot determine country, allow access

  const blockedCountries = await getBlockedCountries();
  if (blockedCountries.has(countryCode)) {
    throw new GeoRestrictedError(countryCode);
  }
}
