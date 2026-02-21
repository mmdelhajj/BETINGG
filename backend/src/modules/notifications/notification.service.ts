import { prisma } from '../../lib/prisma.js';
import type { NotifType } from '@prisma/client';

// ---------------------------------------------------------------------------
// Socket.IO helper - lazy import to avoid circular dependency
// ---------------------------------------------------------------------------

async function emitToUser(userId: string, event: string, data: unknown): Promise<void> {
  try {
    const { getIO } = await import('../../lib/socket.js');
    const io = getIO();
    io.of('/notifications').to(`user:${userId}`).emit(event, data);
  } catch {
    // Socket.IO not initialized (e.g. during tests) - silently skip
  }
}

// ---------------------------------------------------------------------------
// getNotifications
// ---------------------------------------------------------------------------

export async function getNotifications(
  userId: string,
  page: number,
  limit: number,
  unreadOnly: boolean,
) {
  const where = {
    userId,
    ...(unreadOnly ? { isRead: false } : {}),
  };

  const [notifications, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.notification.count({ where }),
  ]);

  return {
    notifications,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

// ---------------------------------------------------------------------------
// markAsRead
// ---------------------------------------------------------------------------

export async function markAsRead(userId: string, notifId: string) {
  const notification = await prisma.notification.findFirst({
    where: { id: notifId, userId },
  });

  if (!notification) {
    return null;
  }

  const updated = await prisma.notification.update({
    where: { id: notifId },
    data: { isRead: true },
  });

  return updated;
}

// ---------------------------------------------------------------------------
// markAllAsRead
// ---------------------------------------------------------------------------

export async function markAllAsRead(userId: string) {
  const result = await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  });

  return { updatedCount: result.count };
}

// ---------------------------------------------------------------------------
// getUnreadCount
// ---------------------------------------------------------------------------

export async function getUnreadCount(userId: string) {
  const count = await prisma.notification.count({
    where: { userId, isRead: false },
  });

  return { count };
}

// ---------------------------------------------------------------------------
// deleteNotification
// ---------------------------------------------------------------------------

export async function deleteNotification(userId: string, notifId: string) {
  const notification = await prisma.notification.findFirst({
    where: { id: notifId, userId },
  });

  if (!notification) {
    return null;
  }

  await prisma.notification.delete({ where: { id: notifId } });

  return { deleted: true };
}

// ---------------------------------------------------------------------------
// createNotification
// ---------------------------------------------------------------------------

export async function createNotification(
  userId: string,
  type: NotifType,
  title: string,
  message: string,
  data?: Record<string, unknown>,
) {
  const notification = await prisma.notification.create({
    data: {
      userId,
      type,
      title,
      message,
      data: data ?? undefined,
      channel: 'IN_APP',
    },
  });

  // Emit real-time event
  await emitToUser(userId, 'notification', {
    id: notification.id,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    data: notification.data,
    isRead: notification.isRead,
    createdAt: notification.createdAt,
  });

  // Also emit updated unread count
  const unreadCount = await prisma.notification.count({
    where: { userId, isRead: false },
  });
  await emitToUser(userId, 'unread-count', { count: unreadCount });

  return notification;
}

// ---------------------------------------------------------------------------
// createBulkNotifications
// ---------------------------------------------------------------------------

export async function createBulkNotifications(
  userIds: string[],
  type: NotifType,
  title: string,
  message: string,
  data?: Record<string, unknown>,
) {
  const notifications = await prisma.notification.createMany({
    data: userIds.map((userId) => ({
      userId,
      type,
      title,
      message,
      data: data ?? undefined,
      channel: 'IN_APP',
    })),
  });

  // Emit real-time events to each user
  for (const userId of userIds) {
    await emitToUser(userId, 'notification', {
      type,
      title,
      message,
      data,
      isRead: false,
      createdAt: new Date(),
    });
  }

  return { createdCount: notifications.count };
}

// ---------------------------------------------------------------------------
// Helper: Specific notification creators
// ---------------------------------------------------------------------------

export async function notifyBetWon(
  userId: string,
  betId: string,
  amount: string,
  currency: string,
) {
  return createNotification(userId, 'BET_WON', 'Bet Won!', `Your bet has won ${amount} ${currency}!`, {
    betId,
    amount,
    currency,
  });
}

export async function notifyBetLost(userId: string, betId: string) {
  return createNotification(userId, 'BET_LOST', 'Bet Lost', 'Unfortunately, your bet did not win this time.', {
    betId,
  });
}

export async function notifyDepositConfirmed(
  userId: string,
  amount: string,
  currency: string,
  txHash?: string,
) {
  return createNotification(
    userId,
    'DEPOSIT_CONFIRMED',
    'Deposit Confirmed',
    `Your deposit of ${amount} ${currency} has been confirmed.`,
    { amount, currency, txHash },
  );
}

export async function notifyWithdrawalApproved(
  userId: string,
  amount: string,
  currency: string,
) {
  return createNotification(
    userId,
    'WITHDRAWAL_APPROVED',
    'Withdrawal Approved',
    `Your withdrawal of ${amount} ${currency} has been approved and is being processed.`,
    { amount, currency },
  );
}

export async function notifyVipLevelUp(userId: string, newTier: string) {
  return createNotification(
    userId,
    'VIP_LEVEL_UP',
    'VIP Level Up!',
    `Congratulations! You have been promoted to ${newTier} tier!`,
    { tier: newTier },
  );
}

export async function notifyPromoAvailable(userId: string, promoTitle: string, promoId: string) {
  return createNotification(
    userId,
    'PROMO_AVAILABLE',
    'New Promotion Available',
    `A new promotion is available: ${promoTitle}`,
    { promoId, promoTitle },
  );
}

export async function notifyKycApproved(userId: string, docType: string, newLevel: string) {
  return createNotification(
    userId,
    'SYSTEM',
    'KYC Document Approved',
    `Your ${docType} document has been approved. Your KYC level is now ${newLevel}.`,
    { docType, kycLevel: newLevel },
  );
}

export async function notifyKycRejected(userId: string, docType: string, reason: string) {
  return createNotification(
    userId,
    'SYSTEM',
    'KYC Document Rejected',
    `Your ${docType} document has been rejected. Reason: ${reason}`,
    { docType, reason },
  );
}
