import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { getTierConfig } from '../vip/vip.service.js';
import * as turboService from './turbo.service.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SlotStatus = 'LOCKED' | 'CLAIMABLE' | 'CLAIMED' | 'EXPIRED';

interface CalendarSlot {
  slot: number;
  status: SlotStatus;
  windowStartUtc: string;
  windowEndUtc: string;
  amount: string | null;
  claimedAt: string | null;
}

interface CalendarResponse {
  date: string;
  slots: CalendarSlot[];
  totalClaimedToday: string;
  dailyBonusMax: string;
}

interface ClaimResult {
  slot: number;
  amount: string;
  turboActivated: boolean;
  turboStatus: {
    isActive: boolean;
    boostPercent: string;
    timeRemainingSeconds: number;
    endsAt: string | null;
  };
}

// ---------------------------------------------------------------------------
// Slot windows: 3 slots per day (00:00, 08:00, 16:00 UTC), 8-hour claim window
// ---------------------------------------------------------------------------

function getSlotWindows(date: Date): Array<{ slot: number; start: Date; end: Date }> {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();

  return [
    {
      slot: 1,
      start: new Date(Date.UTC(year, month, day, 0, 0, 0)),
      end: new Date(Date.UTC(year, month, day, 12, 0, 0)), // 12-hour window
    },
    {
      slot: 2,
      start: new Date(Date.UTC(year, month, day, 8, 0, 0)),
      end: new Date(Date.UTC(year, month, day, 20, 0, 0)), // 12-hour window
    },
    {
      slot: 3,
      start: new Date(Date.UTC(year, month, day, 16, 0, 0)),
      end: new Date(Date.UTC(year, month, day + 1, 4, 0, 0)), // 12-hour window, extends to next day
    },
  ];
}

// ---------------------------------------------------------------------------
// getCurrentSlot
// ---------------------------------------------------------------------------

export function getCurrentSlot(): number {
  const hour = new Date().getUTCHours();

  // Slot 1: 00:00 - 07:59
  if (hour >= 0 && hour < 8) return 1;
  // Slot 2: 08:00 - 15:59
  if (hour >= 8 && hour < 16) return 2;
  // Slot 3: 16:00 - 23:59
  return 3;
}

// ---------------------------------------------------------------------------
// getCalendar
// ---------------------------------------------------------------------------

export async function getCalendar(userId: string): Promise<CalendarResponse> {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

  // Get user's VIP tier config
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { vipTier: true },
  });

  const tierConfig = await getTierConfig(user.vipTier);
  const dailyBonusMax = tierConfig ? tierConfig.dailyBonusMax : '0';

  // Get today's claimed rewards for this user
  const todayRewards = await prisma.reward.findMany({
    where: {
      userId,
      type: 'DAILY',
      createdAt: { gte: startOfDay, lt: endOfDay },
      calendarSlot: { not: null },
    },
  });

  const claimedSlots = new Map<number, { amount: Prisma.Decimal; claimedAt: Date }>();
  for (const r of todayRewards) {
    if (r.calendarSlot !== null && (r.status === 'CLAIMED' || r.status === 'CLAIMABLE')) {
      claimedSlots.set(r.calendarSlot, { amount: r.amount, claimedAt: r.claimedAt ?? r.createdAt });
    }
  }

  const windows = getSlotWindows(now);
  const slots: CalendarSlot[] = windows.map((w) => {
    const claimed = claimedSlots.get(w.slot);

    let status: SlotStatus;
    if (claimed) {
      status = 'CLAIMED';
    } else if (now >= w.end) {
      status = 'EXPIRED';
    } else if (now >= w.start && now < w.end) {
      status = 'CLAIMABLE';
    } else {
      status = 'LOCKED';
    }

    return {
      slot: w.slot,
      status,
      windowStartUtc: w.start.toISOString(),
      windowEndUtc: w.end.toISOString(),
      amount: claimed ? claimed.amount.toString() : null,
      claimedAt: claimed ? claimed.claimedAt.toISOString() : null,
    };
  });

  const totalClaimedToday = todayRewards.reduce(
    (sum, r) => sum.add(r.amount),
    new Prisma.Decimal(0),
  );

  return {
    date: todayStr,
    slots,
    totalClaimedToday: totalClaimedToday.toString(),
    dailyBonusMax,
  };
}

// ---------------------------------------------------------------------------
// claimSlot
// ---------------------------------------------------------------------------

export async function claimSlot(userId: string, slot: 1 | 2 | 3): Promise<ClaimResult> {
  if (![1, 2, 3].includes(slot)) {
    throw new Error('Invalid slot number. Must be 1, 2, or 3.');
  }

  const now = new Date();
  const windows = getSlotWindows(now);
  const window = windows.find((w) => w.slot === slot);

  if (!window) {
    throw new Error('Slot configuration not found.');
  }

  // Validate the slot is within its claim window
  if (now < window.start) {
    throw new Error('This slot is not yet available. Please wait for the claim window to open.');
  }

  if (now >= window.end) {
    throw new Error('This slot has expired. The claim window has closed.');
  }

  // Check if already claimed today
  const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

  const existing = await prisma.reward.findFirst({
    where: {
      userId,
      type: 'DAILY',
      calendarSlot: slot,
      createdAt: { gte: startOfDay, lt: endOfDay },
    },
  });

  if (existing) {
    throw new Error('You have already claimed this slot today.');
  }

  // Get user tier config to determine reward amount
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { vipTier: true },
  });

  const tierConfig = await getTierConfig(user.vipTier);
  if (!tierConfig) {
    throw new Error('VIP tier configuration not found.');
  }

  // Calculate amount: dailyBonusMax divided by 3 (for 3 slots)
  const dailyMax = new Prisma.Decimal(tierConfig.dailyBonusMax);
  const slotAmount = dailyMax.div(3).toDecimalPlaces(8, Prisma.Decimal.ROUND_DOWN);

  if (slotAmount.lte(0)) {
    throw new Error('No calendar bonus available for your current VIP tier.');
  }

  // Check daily cap
  const todayRewards = await prisma.reward.findMany({
    where: {
      userId,
      type: 'DAILY',
      createdAt: { gte: startOfDay, lt: endOfDay },
      status: { in: ['CLAIMED', 'CLAIMABLE'] },
    },
  });

  const todayClaimed = todayRewards.reduce(
    (sum, r) => sum.add(r.amount),
    new Prisma.Decimal(0),
  );

  if (todayClaimed.add(slotAmount).gt(dailyMax)) {
    throw new Error('Daily bonus cap reached.');
  }

  // Create the reward and credit bonus wallet in a transaction
  await prisma.$transaction(async (tx) => {
    // Create reward record
    await tx.reward.create({
      data: {
        userId,
        type: 'DAILY',
        amount: slotAmount,
        currency: 'USDT',
        source: 'CALENDAR',
        status: 'CLAIMED',
        calendarSlot: slot,
        calendarDay: now.getUTCDate(),
        claimedAt: now,
        claimableAt: window.start,
        expiresAt: window.end,
      },
    });

    // Credit bonus wallet
    const usdtCurrency = await tx.currency.findUnique({
      where: { symbol: 'USDT' },
      select: { id: true },
    });

    if (usdtCurrency) {
      await tx.wallet.upsert({
        where: { userId_currencyId: { userId, currencyId: usdtCurrency.id } },
        create: {
          userId,
          currencyId: usdtCurrency.id,
          bonusBalance: slotAmount,
        },
        update: {
          bonusBalance: { increment: slotAmount },
        },
      });

      // Record transaction
      const wallet = await tx.wallet.findUnique({
        where: { userId_currencyId: { userId, currencyId: usdtCurrency.id } },
        select: { id: true },
      });

      if (wallet) {
        await tx.transaction.create({
          data: {
            walletId: wallet.id,
            type: 'REWARD',
            amount: slotAmount,
            status: 'COMPLETED',
            metadata: {
              source: 'CALENDAR',
              slot,
              date: now.toISOString().split('T')[0],
            },
          },
        });
      }
    }
  });

  // Activate TURBO mode upon claim
  let turboStatus;
  try {
    turboStatus = await turboService.activate(userId);
  } catch {
    // Turbo not available for this tier (e.g. Bronze) — continue without
    turboStatus = await turboService.getStatus(userId);
  }

  return {
    slot,
    amount: slotAmount.toString(),
    turboActivated: turboStatus.isActive,
    turboStatus: {
      isActive: turboStatus.isActive,
      boostPercent: turboStatus.boostPercent,
      timeRemainingSeconds: turboStatus.timeRemainingSeconds,
      endsAt: turboStatus.endsAt,
    },
  };
}
