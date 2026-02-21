import { prisma } from '../../lib/prisma.js';
import { getIO } from '../../lib/socket.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export class ChatError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number = 400,
  ) {
    super(message);
    this.name = 'ChatError';
  }
}

/** FAQ auto-reply patterns */
const FAQ_PATTERNS: Array<{ keywords: string[]; reply: string }> = [
  {
    keywords: ['deposit', 'fund', 'add money', 'top up'],
    reply:
      'To make a deposit, go to your Wallet page, select the currency you want to deposit, and copy the deposit address or scan the QR code. Deposits are credited after the required network confirmations. If you need further help, our team will respond shortly.',
  },
  {
    keywords: ['withdraw', 'withdrawal', 'cash out', 'send funds'],
    reply:
      'To withdraw funds, go to your Wallet page, click the Withdraw tab, enter the destination address, amount, and confirm with your 2FA code. Withdrawals are processed within 1-24 hours. If you need more assistance, our team will respond shortly.',
  },
  {
    keywords: ['bonus', 'promo', 'promotion', 'free bet'],
    reply:
      'Check our Promotions page for active bonuses and promotions. You can enter a promo code on the deposit page or claim offers directly from the Promotions tab. A team member will follow up with more details shortly.',
  },
  {
    keywords: ['kyc', 'verify', 'verification', 'identity', 'document'],
    reply:
      'KYC verification is required for higher withdrawal limits. Go to Account Settings > KYC to upload your ID and proof of address. Review typically takes 24-48 hours. Our team will assist you further shortly.',
  },
  {
    keywords: ['password', 'reset', 'forgot', 'locked out'],
    reply:
      'You can reset your password by clicking "Forgot Password" on the login page. A reset link will be sent to your email. If you are still having trouble, our support team will help you shortly.',
  },
  {
    keywords: ['2fa', 'two-factor', 'authenticator', 'google auth'],
    reply:
      'For 2FA issues, go to Account Settings > Security. If you lost access to your authenticator, please provide your backup codes. Our security team will follow up with you shortly.',
  },
  {
    keywords: ['vip', 'tier', 'level', 'rewards', 'rakeback'],
    reply:
      'Your VIP tier is based on your total wagering. Check the VIP & Rewards page for your current tier, benefits, and progress to the next level. A team member will respond with more details shortly.',
  },
];

function detectAutoReply(message: string): string | null {
  const lower = message.toLowerCase();
  for (const faq of FAQ_PATTERNS) {
    if (faq.keywords.some((kw) => lower.includes(kw))) {
      return faq.reply;
    }
  }
  return null;
}

function emitToRoom(roomId: string, event: string, data: unknown) {
  try {
    const io = getIO();
    io.of('/chat').to(`channel:${roomId}`).emit(event, data);
  } catch {
    // Socket.IO may not be initialized in tests
  }
}

// ---------------------------------------------------------------------------
// User: Chat Rooms
// ---------------------------------------------------------------------------

export async function getUserRooms(userId: string) {
  const rooms = await prisma.chatRoom.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
    include: {
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: {
          id: true,
          message: true,
          senderType: true,
          createdAt: true,
        },
      },
      assignee: {
        select: { id: true, username: true },
      },
    },
  });

  return rooms.map((room) => ({
    id: room.id,
    subject: room.subject,
    status: room.status,
    assignedTo: room.assignee,
    lastMessage: room.messages[0] ?? null,
    createdAt: room.createdAt,
    updatedAt: room.updatedAt,
  }));
}

export async function createRoom(userId: string, subject: string) {
  const room = await prisma.chatRoom.create({
    data: {
      userId,
      subject,
      status: 'OPEN',
    },
  });

  // Create initial system message
  await prisma.chatMessage.create({
    data: {
      roomId: room.id,
      senderId: userId,
      senderType: 'SYSTEM',
      message: `Chat room created: ${subject}. Our team will be with you shortly.`,
    },
  });

  return room;
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

export async function getMessages(
  roomId: string,
  userId: string,
  page: number,
  limit: number,
  isAdmin = false,
) {
  // Verify access
  const room = await prisma.chatRoom.findUnique({ where: { id: roomId } });
  if (!room) {
    throw new ChatError('ROOM_NOT_FOUND', 'Chat room not found', 404);
  }

  if (!isAdmin && room.userId !== userId) {
    throw new ChatError('FORBIDDEN', 'You do not have access to this chat room', 403);
  }

  const skip = (page - 1) * limit;

  const [messages, total] = await Promise.all([
    prisma.chatMessage.findMany({
      where: { roomId },
      orderBy: { createdAt: 'asc' },
      skip,
      take: limit,
      include: {
        sender: {
          select: { id: true, username: true, role: true },
        },
      },
    }),
    prisma.chatMessage.count({ where: { roomId } }),
  ]);

  return {
    messages,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    room: {
      id: room.id,
      subject: room.subject,
      status: room.status,
    },
  };
}

export async function sendMessage(
  roomId: string,
  senderId: string,
  senderType: 'USER' | 'ADMIN',
  messageText: string,
) {
  const room = await prisma.chatRoom.findUnique({ where: { id: roomId } });
  if (!room) {
    throw new ChatError('ROOM_NOT_FOUND', 'Chat room not found', 404);
  }

  if (room.status === 'CLOSED') {
    throw new ChatError('ROOM_CLOSED', 'This chat room is closed', 400);
  }

  // Verify user access
  if (senderType === 'USER' && room.userId !== senderId) {
    throw new ChatError('FORBIDDEN', 'You do not have access to this chat room', 403);
  }

  const message = await prisma.chatMessage.create({
    data: {
      roomId,
      senderId,
      senderType,
      message: messageText,
    },
    include: {
      sender: {
        select: { id: true, username: true, role: true },
      },
    },
  });

  // Update room timestamp
  await prisma.chatRoom.update({
    where: { id: roomId },
    data: { updatedAt: new Date() },
  });

  // Emit via Socket.IO
  emitToRoom(roomId, 'message', {
    id: message.id,
    roomId: message.roomId,
    senderId: message.senderId,
    senderType: message.senderType,
    senderName: message.sender.username,
    message: message.message,
    createdAt: message.createdAt.toISOString(),
  });

  // Auto-reply if user message and no admin assigned
  if (senderType === 'USER' && !room.assignedTo) {
    const autoReply = detectAutoReply(messageText);
    if (autoReply) {
      // Small delay to make it feel natural
      setTimeout(async () => {
        try {
          const botMessage = await prisma.chatMessage.create({
            data: {
              roomId,
              senderId,
              senderType: 'SYSTEM',
              message: autoReply,
            },
          });

          emitToRoom(roomId, 'message', {
            id: botMessage.id,
            roomId: botMessage.roomId,
            senderId: 'system',
            senderType: 'SYSTEM',
            senderName: 'CryptoBet Support',
            message: botMessage.message,
            createdAt: botMessage.createdAt.toISOString(),
          });
        } catch {
          // Silently fail auto-reply
        }
      }, 1500);
    }
  }

  return message;
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

export async function getAllOpenRooms(
  status: string,
  page: number,
  limit: number,
) {
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};
  if (status !== 'all') {
    where.status = status;
  }

  const [rooms, total] = await Promise.all([
    prisma.chatRoom.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      skip,
      take: limit,
      include: {
        user: {
          select: { id: true, username: true, email: true },
        },
        assignee: {
          select: { id: true, username: true },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            message: true,
            senderType: true,
            createdAt: true,
          },
        },
      },
    }),
    prisma.chatRoom.count({ where }),
  ]);

  return {
    rooms: rooms.map((room) => ({
      id: room.id,
      subject: room.subject,
      status: room.status,
      user: room.user,
      assignee: room.assignee,
      lastMessage: room.messages[0] ?? null,
      createdAt: room.createdAt,
      updatedAt: room.updatedAt,
    })),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

export async function assignRoom(roomId: string, adminId: string) {
  const room = await prisma.chatRoom.findUnique({ where: { id: roomId } });
  if (!room) {
    throw new ChatError('ROOM_NOT_FOUND', 'Chat room not found', 404);
  }

  const updated = await prisma.chatRoom.update({
    where: { id: roomId },
    data: {
      assignedTo: adminId,
      status: 'WAITING',
    },
  });

  // Add system message about assignment
  const admin = await prisma.user.findUnique({
    where: { id: adminId },
    select: { username: true },
  });

  await prisma.chatMessage.create({
    data: {
      roomId,
      senderId: adminId,
      senderType: 'SYSTEM',
      message: `${admin?.username ?? 'An agent'} has joined the chat.`,
    },
  });

  emitToRoom(roomId, 'room:assigned', {
    roomId,
    adminId,
    adminName: admin?.username,
  });

  return updated;
}

export async function closeRoom(roomId: string) {
  const room = await prisma.chatRoom.findUnique({ where: { id: roomId } });
  if (!room) {
    throw new ChatError('ROOM_NOT_FOUND', 'Chat room not found', 404);
  }

  if (room.status === 'CLOSED') {
    throw new ChatError('ALREADY_CLOSED', 'This chat room is already closed');
  }

  const updated = await prisma.chatRoom.update({
    where: { id: roomId },
    data: { status: 'CLOSED' },
  });

  // Add closing system message
  await prisma.chatMessage.create({
    data: {
      roomId,
      senderId: room.userId,
      senderType: 'SYSTEM',
      message: 'This chat has been closed. If you need further help, please open a new chat.',
    },
  });

  emitToRoom(roomId, 'room:closed', { roomId });

  return updated;
}

export async function adminReplyMessage(
  roomId: string,
  adminId: string,
  messageText: string,
) {
  return sendMessage(roomId, adminId, 'ADMIN', messageText);
}
