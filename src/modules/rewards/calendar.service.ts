import prisma from '../../lib/prisma';
import Decimal from 'decimal.js';
import { REWARDS } from '../../config/constants';
import { AppError } from '../../utils/errors';
import { addNotificationJob } from '../../queues';

export class CalendarService {
  /**
   * Get the rewards calendar for a user (current day/slots)
   */
  async getCalendar(userId: string) {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Get today's rewards
    const todayRewards = await prisma.reward.findMany({
      where: {
        userId,
        type: { in: ['DAILY', 'WEEKLY', 'MONTHLY'] },
        createdAt: { gte: startOfDay },
      },
      orderBy: { calendarSlot: 'asc' },
    });

    // Calculate what slots should be available
    const hoursSinceStartOfDay = (now.getTime() - startOfDay.getTime()) / (1000 * 60 * 60);
    const availableSlots: number[] = [];
    for (let i = 0; i < REWARDS.CALENDAR_SLOTS_PER_DAY; i++) {
      const slotHour = i * REWARDS.CALENDAR_SLOT_INTERVAL_HOURS;
      if (hoursSinceStartOfDay >= slotHour) {
        availableSlots.push(i + 1);
      }
    }

    // Build slot status
    const slots = [];
    for (let slot = 1; slot <= REWARDS.CALENDAR_SLOTS_PER_DAY; slot++) {
      const reward = todayRewards.find((r) => r.calendarSlot === slot);
      const isAvailable = availableSlots.includes(slot);
      const slotUnlockTime = new Date(startOfDay.getTime() + (slot - 1) * REWARDS.CALENDAR_SLOT_INTERVAL_HOURS * 60 * 60 * 1000);
      const claimDeadline = new Date(slotUnlockTime.getTime() + REWARDS.CALENDAR_CLAIM_WINDOW_HOURS * 60 * 60 * 1000);

      let status: 'locked' | 'claimable' | 'claimed' | 'expired' = 'locked';
      if (reward?.status === 'CLAIMED') {
        status = 'claimed';
      } else if (isAvailable && now < claimDeadline) {
        status = 'claimable';
      } else if (isAvailable && now >= claimDeadline) {
        status = 'expired';
      }

      slots.push({
        slot,
        status,
        amount: reward?.amount.toString() || null,
        claimedAt: reward?.claimedAt || null,
        unlocksAt: slotUnlockTime.toISOString(),
        expiresAt: claimDeadline.toISOString(),
      });
    }

    // Get pending calendar rewards
    const pendingCalendarRewards = await prisma.reward.aggregate({
      where: { userId, type: 'DAILY', status: 'PENDING' },
      _sum: { amount: true },
    });

    return {
      date: startOfDay.toISOString(),
      slots,
      pendingCalendarRewards: pendingCalendarRewards._sum.amount?.toString() || '0',
    };
  }

  /**
   * Claim a calendar reward slot
   */
  async claimSlot(userId: string, slot: number): Promise<{ amount: string; turboActivated: boolean }> {
    if (slot < 1 || slot > REWARDS.CALENDAR_SLOTS_PER_DAY) {
      throw new AppError('INVALID_SLOT', 'Invalid calendar slot', 400);
    }

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const slotUnlockTime = new Date(startOfDay.getTime() + (slot - 1) * REWARDS.CALENDAR_SLOT_INTERVAL_HOURS * 60 * 60 * 1000);
    const claimDeadline = new Date(slotUnlockTime.getTime() + REWARDS.CALENDAR_CLAIM_WINDOW_HOURS * 60 * 60 * 1000);

    if (now < slotUnlockTime) {
      throw new AppError('SLOT_LOCKED', 'This slot is not yet available', 400);
    }
    if (now > claimDeadline) {
      throw new AppError('SLOT_EXPIRED', 'This slot has expired', 400);
    }

    // Check if already claimed
    const existing = await prisma.reward.findFirst({
      where: {
        userId,
        type: 'DAILY',
        calendarSlot: slot,
        createdAt: { gte: startOfDay },
        status: 'CLAIMED',
      },
    });
    if (existing) {
      throw new AppError('ALREADY_CLAIMED', 'This slot has already been claimed', 400);
    }

    // Calculate reward amount from pending calendar rewards
    const pending = await prisma.reward.findMany({
      where: { userId, type: 'DAILY', status: 'PENDING' },
    });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { vipTier: true },
    });

    const tierConfig = await prisma.vipTierConfig.findUnique({
      where: { tier: user?.vipTier || 'BRONZE' },
    });

    // Base amount from pending + tier daily bonus
    let amount = pending.reduce(
      (sum, r) => sum.plus(new Decimal(r.amount.toString())),
      new Decimal(0)
    );

    // Add base daily bonus from tier
    const dailyBonus = new Decimal(tierConfig?.dailyBonusMax.toString() || '0').div(REWARDS.CALENDAR_SLOTS_PER_DAY);
    amount = amount.plus(dailyBonus);

    // Cap at daily max
    if (tierConfig) {
      const maxPerSlot = new Decimal(tierConfig.dailyBonusMax.toString());
      if (amount.gt(maxPerSlot)) amount = maxPerSlot;
    }

    if (amount.lte(0)) amount = new Decimal('0.01'); // Minimum reward

    // Create the claimed reward
    const reward = await prisma.reward.create({
      data: {
        userId,
        type: 'DAILY',
        amount: amount.toNumber(),
        currency: 'USDT',
        status: 'CLAIMED',
        claimedAt: new Date(),
        calendarDay: now.getDate(),
        calendarSlot: slot,
      },
    });

    // Mark pending rewards as claimed
    if (pending.length > 0) {
      await prisma.reward.updateMany({
        where: { id: { in: pending.map((p) => p.id) } },
        data: { status: 'CLAIMED', claimedAt: new Date() },
      });
    }

    // Credit to wallet
    const wallet = await prisma.wallet.findFirst({
      where: { userId, currency: { symbol: 'USDT' } },
    });

    if (wallet) {
      await prisma.$transaction([
        prisma.wallet.update({
          where: { id: wallet.id },
          data: { balance: { increment: amount.toNumber() } },
        }),
        prisma.transaction.create({
          data: {
            walletId: wallet.id,
            type: 'REWARD',
            amount: amount.toNumber(),
            status: 'COMPLETED',
            metadata: { rewardId: reward.id, calendarSlot: slot },
          },
        }),
      ]);
    }

    // Activate TURBO mode
    const turboActivated = await this.activateTurbo(userId);

    return { amount: amount.toString(), turboActivated };
  }

  /**
   * Activate TURBO mode on calendar claim
   */
  private async activateTurbo(userId: string): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { vipTier: true },
    });

    const tierConfig = await prisma.vipTierConfig.findUnique({
      where: { tier: user?.vipTier || 'BRONZE' },
    });

    if (!tierConfig || tierConfig.turboBoostPercent.toNumber() <= 0) return false;

    const now = new Date();
    const endsAt = new Date(now.getTime() + tierConfig.turboDurationMin * 60 * 1000);

    // Deactivate any existing turbo
    await prisma.turboSession.updateMany({
      where: { userId, isActive: true },
      data: { isActive: false },
    });

    // Create new turbo session
    await prisma.turboSession.create({
      data: {
        userId,
        boostPercent: tierConfig.turboBoostPercent.toNumber(),
        endsAt,
      },
    });

    await addNotificationJob({
      userId,
      type: 'REWARD',
      title: 'TURBO Mode Activated!',
      message: `Your casino rakeback is boosted by ${tierConfig.turboBoostPercent}% for ${tierConfig.turboDurationMin} minutes!`,
      data: { boostPercent: tierConfig.turboBoostPercent.toString(), durationMin: tierConfig.turboDurationMin },
    });

    return true;
  }

  /**
   * Get weekly rewards (Silver+ tier)
   */
  async getWeeklyReward(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { vipTier: true },
    });

    const tierConfig = await prisma.vipTierConfig.findUnique({
      where: { tier: user?.vipTier || 'BRONZE' },
    });

    if (!tierConfig?.weeklyBonusMax) return null;

    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const existingWeekly = await prisma.reward.findFirst({
      where: {
        userId,
        type: 'WEEKLY',
        createdAt: { gte: startOfWeek },
      },
    });

    return {
      available: !existingWeekly,
      maxAmount: tierConfig.weeklyBonusMax.toString(),
      claimed: existingWeekly?.status === 'CLAIMED',
    };
  }
}

export const calendarService = new CalendarService();
