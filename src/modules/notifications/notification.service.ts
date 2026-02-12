import prisma from '../../lib/prisma';
import { NotFoundError } from '../../utils/errors';
import { emitToUser } from '../../lib/socket';

export class NotificationService {
  async getNotifications(userId: string, options: { page: number; limit: number; unreadOnly?: boolean }) {
    const { page, limit, unreadOnly } = options;
    const where: any = { userId };
    if (unreadOnly) where.isRead = false;

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { userId, isRead: false } }),
    ]);

    return {
      notifications: notifications.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        message: n.message,
        data: n.data,
        read: n.isRead,
        createdAt: n.createdAt.toISOString(),
      })),
      unreadCount,
      meta: { page, total, hasMore: page * limit < total },
    };
  }

  async markAsRead(userId: string, notificationId: string) {
    const notification = await prisma.notification.findUnique({ where: { id: notificationId } });
    if (!notification) throw new NotFoundError('Notification', notificationId);
    if (notification.userId !== userId) throw new NotFoundError('Notification', notificationId);

    await prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true },
    });

    return { id: notificationId, read: true };
  }

  async markAllAsRead(userId: string) {
    const result = await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });

    return { marked: result.count };
  }

  async getUnreadCount(userId: string) {
    const count = await prisma.notification.count({ where: { userId, isRead: false } });
    return { unreadCount: count };
  }

  async createNotification(data: {
    userId: string;
    type: string;
    title: string;
    message: string;
    data?: any;
  }) {
    const notification = await prisma.notification.create({
      data: {
        userId: data.userId,
        type: data.type as any,
        title: data.title,
        message: data.message,
        data: data.data || {},
      },
    });

    // Push via WebSocket
    emitToUser(data.userId, 'notification', {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      data: notification.data,
      createdAt: notification.createdAt.toISOString(),
    });

    return notification;
  }

  async deleteNotification(userId: string, notificationId: string) {
    const notification = await prisma.notification.findUnique({ where: { id: notificationId } });
    if (!notification || notification.userId !== userId) {
      throw new NotFoundError('Notification', notificationId);
    }

    await prisma.notification.delete({ where: { id: notificationId } });
    return { deleted: true };
  }

  async getPreferences(userId: string) {
    // Notification preferences are stored as site-level defaults
    // since User model doesn't have a notificationPreferences field
    return {
      email: true,
      push: true,
      inApp: true,
      betSettlement: true,
      promotions: true,
      deposits: true,
      withdrawals: true,
    };
  }

  async updatePreferences(_userId: string, prefs: Record<string, boolean>) {
    // Notification preferences are handled at application level
    // since User model doesn't have a notificationPreferences field
    return prefs;
  }
}

export const notificationService = new NotificationService();
