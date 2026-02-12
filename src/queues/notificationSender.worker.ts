import { Job } from 'bullmq';
import { Prisma } from '@prisma/client';
import prisma from '../lib/prisma';
import { emitToUser } from '../lib/socket';

export interface NotificationData {
  userId: string;
  type: string;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  channels?: string[];
}

export async function sendNotification(job: Job<NotificationData>): Promise<void> {
  const { userId, type, title, message, data, channels = ['IN_APP'] } = job.data;

  for (const channel of channels) {
    switch (channel) {
      case 'IN_APP':
        await sendInAppNotification(userId, type, title, message, data);
        break;
      case 'EMAIL':
        await sendEmailNotification(userId, title, message);
        break;
      case 'PUSH':
        await sendPushNotification(userId, title, message);
        break;
    }
  }
}

async function sendInAppNotification(
  userId: string,
  type: string,
  title: string,
  message: string,
  data?: Record<string, unknown>
): Promise<void> {
  const notification = await prisma.notification.create({
    data: {
      userId,
      type: type as any,
      title,
      message,
      data: (data as Prisma.InputJsonValue) || undefined,
      channel: 'IN_APP',
    },
  });

  // Emit via Socket.IO
  try {
    emitToUser(userId, 'notification', {
      id: notification.id,
      type,
      title,
      message,
      data,
      createdAt: notification.createdAt,
    });
  } catch {
    // Socket may not be available
  }
}

async function sendEmailNotification(
  _userId: string,
  _title: string,
  _message: string
): Promise<void> {
  // In production, use nodemailer with templates
  // const user = await prisma.user.findUnique({ where: { id: userId } });
  // await transporter.sendMail({ to: user.email, subject: title, html: message });
  console.log('Email notification stub');
}

async function sendPushNotification(
  _userId: string,
  _title: string,
  _message: string
): Promise<void> {
  // In production, use Firebase FCM
  // const token = await getDeviceToken(userId);
  // await admin.messaging().send({ token, notification: { title, body: message } });
  console.log('Push notification stub');
}
