import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { redis } from '../../lib/redis.js';
import type { SendMessageInput, TipUserInput, MessagesQuery } from './chat.schemas.js';

// ---------------------------------------------------------------------------
// Error class
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

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MESSAGE_RATE_LIMIT_KEY = 'chat:rate:';
const MESSAGE_RATE_LIMIT_MAX = 10; // messages per window
const MESSAGE_RATE_LIMIT_WINDOW = 10; // seconds
const ONLINE_USERS_KEY = 'chat:online:';
const TIP_MIN_AMOUNT = 0.01;

// ---------------------------------------------------------------------------
// Chat Rooms
// ---------------------------------------------------------------------------

/**
 * List all active chat rooms, optionally filtered by type.
 */
export async function getRooms(type?: string) {
  const where: Prisma.ChatRoomWhereInput = {
    isActive: true,
  };

  if (type) {
    where.type = type;
  }

  const rooms = await prisma.chatRoom.findMany({
    where,
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      type: true,
      isActive: true,
      sortOrder: true,
      createdAt: true,
      _count: {
        select: {
          messages: true,
        },
      },
    },
  });

  // Get online user counts from Redis
  const roomsWithOnline = await Promise.all(
    rooms.map(async (room) => {
      const onlineCount = await redis.scard(`${ONLINE_USERS_KEY}${room.id}`);
      return {
        id: room.id,
        name: room.name,
        slug: room.slug,
        description: room.description,
        type: room.type,
        isActive: room.isActive,
        sortOrder: room.sortOrder,
        messageCount: room._count.messages,
        onlineCount: Number(onlineCount),
        createdAt: room.createdAt,
      };
    }),
  );

  return roomsWithOnline;
}

/**
 * Get a single chat room by ID.
 */
export async function getRoom(roomId: string) {
  const room = await prisma.chatRoom.findUnique({
    where: { id: roomId },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      type: true,
      isActive: true,
    },
  });

  if (!room) {
    throw new ChatError('ROOM_NOT_FOUND', 'Chat room not found', 404);
  }

  if (!room.isActive) {
    throw new ChatError('ROOM_INACTIVE', 'This chat room is currently inactive', 403);
  }

  return room;
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

/**
 * Get messages for a chat room with cursor-based or offset pagination.
 */
export async function getMessages(roomId: string, query: MessagesQuery) {
  const { page, limit, before } = query;

  // Verify room exists
  const room = await prisma.chatRoom.findUnique({
    where: { id: roomId },
    select: { id: true, isActive: true },
  });

  if (!room) {
    throw new ChatError('ROOM_NOT_FOUND', 'Chat room not found', 404);
  }

  const where: Prisma.ChatMessageWhereInput = {
    roomId,
    isDeleted: false,
  };

  // Cursor-based pagination if "before" is provided
  if (before) {
    where.createdAt = { lt: new Date(before) };
  }

  const skip = before ? 0 : (page - 1) * limit;

  const [messages, total] = await Promise.all([
    prisma.chatMessage.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      select: {
        id: true,
        content: true,
        type: true,
        metadata: true,
        createdAt: true,
        replyToId: true,
        user: {
          select: {
            id: true,
            username: true,
            avatar: true,
            vipTier: true,
          },
        },
        replyTo: {
          select: {
            id: true,
            content: true,
            user: {
              select: {
                id: true,
                username: true,
              },
            },
          },
        },
      },
    }),
    prisma.chatMessage.count({ where: { roomId, isDeleted: false } }),
  ]);

  return {
    messages: messages.reverse(), // Return in chronological order
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * Send a message to a chat room.
 */
export async function sendMessage(
  userId: string,
  roomId: string,
  input: SendMessageInput,
) {
  // Verify room exists and is active
  const room = await prisma.chatRoom.findUnique({
    where: { id: roomId },
    select: { id: true, isActive: true, type: true },
  });

  if (!room) {
    throw new ChatError('ROOM_NOT_FOUND', 'Chat room not found', 404);
  }

  if (!room.isActive) {
    throw new ChatError('ROOM_INACTIVE', 'This chat room is currently inactive', 403);
  }

  // Check user is not banned or muted
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      isBanned: true,
      isChatMuted: true,
      chatMutedUntil: true,
      vipTier: true,
      avatar: true,
    },
  });

  if (!user) {
    throw new ChatError('USER_NOT_FOUND', 'User not found', 404);
  }

  if (user.isBanned) {
    throw new ChatError('USER_BANNED', 'Your account is banned', 403);
  }

  if (user.isChatMuted) {
    if (!user.chatMutedUntil || user.chatMutedUntil > new Date()) {
      throw new ChatError(
        'USER_MUTED',
        user.chatMutedUntil
          ? `You are muted until ${user.chatMutedUntil.toISOString()}`
          : 'You are muted from chat',
        403,
      );
    }
    // Mute period expired, unset it
    await prisma.user.update({
      where: { id: userId },
      data: { isChatMuted: false, chatMutedUntil: null },
    });
  }

  // Rate limiting
  const rateKey = `${MESSAGE_RATE_LIMIT_KEY}${userId}`;
  const currentCount = await redis.incr(rateKey);
  if (currentCount === 1) {
    await redis.expire(rateKey, MESSAGE_RATE_LIMIT_WINDOW);
  }
  if (currentCount > MESSAGE_RATE_LIMIT_MAX) {
    throw new ChatError(
      'RATE_LIMITED',
      'You are sending messages too quickly. Please wait a moment.',
      429,
    );
  }

  // Verify reply target exists if provided
  if (input.replyToId) {
    const replyTarget = await prisma.chatMessage.findUnique({
      where: { id: input.replyToId },
      select: { id: true, roomId: true },
    });
    if (!replyTarget || replyTarget.roomId !== roomId) {
      throw new ChatError('REPLY_NOT_FOUND', 'Reply target message not found in this room', 404);
    }
  }

  // Create message
  const message = await prisma.chatMessage.create({
    data: {
      roomId,
      userId,
      content: input.content,
      type: 'TEXT',
      replyToId: input.replyToId ?? null,
    },
    select: {
      id: true,
      content: true,
      type: true,
      metadata: true,
      createdAt: true,
      replyToId: true,
      user: {
        select: {
          id: true,
          username: true,
          avatar: true,
          vipTier: true,
        },
      },
      replyTo: {
        select: {
          id: true,
          content: true,
          user: {
            select: {
              id: true,
              username: true,
            },
          },
        },
      },
    },
  });

  return message;
}

// ---------------------------------------------------------------------------
// Tips
// ---------------------------------------------------------------------------

/**
 * Tip another user in a chat room.
 * Transfers funds from sender's wallet to recipient's wallet.
 */
export async function tipUser(
  senderId: string,
  roomId: string,
  input: TipUserInput,
) {
  const { recipientId, amount, currency, message: tipMessage } = input;

  // Cannot tip yourself
  if (senderId === recipientId) {
    throw new ChatError('SELF_TIP', 'You cannot tip yourself', 400);
  }

  if (amount < TIP_MIN_AMOUNT) {
    throw new ChatError('TIP_TOO_LOW', `Minimum tip amount is ${TIP_MIN_AMOUNT}`, 400);
  }

  // Verify room exists and is active
  const room = await prisma.chatRoom.findUnique({
    where: { id: roomId },
    select: { id: true, isActive: true },
  });

  if (!room) {
    throw new ChatError('ROOM_NOT_FOUND', 'Chat room not found', 404);
  }

  if (!room.isActive) {
    throw new ChatError('ROOM_INACTIVE', 'This chat room is currently inactive', 403);
  }

  // Verify recipient exists and is not banned
  const recipient = await prisma.user.findUnique({
    where: { id: recipientId },
    select: { id: true, username: true, isBanned: true },
  });

  if (!recipient) {
    throw new ChatError('RECIPIENT_NOT_FOUND', 'Recipient user not found', 404);
  }

  if (recipient.isBanned) {
    throw new ChatError('RECIPIENT_BANNED', 'Cannot tip a banned user', 400);
  }

  // Verify sender is not banned
  const sender = await prisma.user.findUnique({
    where: { id: senderId },
    select: { id: true, username: true, isBanned: true },
  });

  if (!sender) {
    throw new ChatError('USER_NOT_FOUND', 'Sender not found', 404);
  }

  if (sender.isBanned) {
    throw new ChatError('USER_BANNED', 'Your account is banned', 403);
  }

  // Atomic transaction: transfer funds and create messages
  const result = await prisma.$transaction(async (tx) => {
    // Find sender's wallet
    const currencyRecord = await tx.currency.findUnique({
      where: { symbol: currency.toUpperCase() },
      select: { id: true, symbol: true },
    });

    if (!currencyRecord) {
      throw new ChatError('CURRENCY_NOT_FOUND', `Currency "${currency}" not found`, 404);
    }

    const senderWallet = await tx.wallet.findUnique({
      where: {
        userId_currencyId: {
          userId: senderId,
          currencyId: currencyRecord.id,
        },
      },
    });

    if (!senderWallet) {
      throw new ChatError('WALLET_NOT_FOUND', `No ${currency} wallet found`, 404);
    }

    const amountDecimal = new Prisma.Decimal(amount.toFixed(8));

    if (senderWallet.balance.lt(amountDecimal)) {
      throw new ChatError(
        'INSUFFICIENT_BALANCE',
        `Insufficient ${currency} balance. Available: ${senderWallet.balance.toString()}`,
        400,
      );
    }

    // Find or create recipient's wallet
    let recipientWallet = await tx.wallet.findUnique({
      where: {
        userId_currencyId: {
          userId: recipientId,
          currencyId: currencyRecord.id,
        },
      },
    });

    if (!recipientWallet) {
      recipientWallet = await tx.wallet.create({
        data: {
          userId: recipientId,
          currencyId: currencyRecord.id,
          balance: new Prisma.Decimal(0),
        },
      });
    }

    // Deduct from sender
    await tx.wallet.update({
      where: { id: senderWallet.id },
      data: {
        balance: { decrement: amountDecimal },
      },
    });

    // Credit to recipient
    await tx.wallet.update({
      where: { id: recipientWallet.id },
      data: {
        balance: { increment: amountDecimal },
      },
    });

    // Record transactions
    await tx.transaction.create({
      data: {
        walletId: senderWallet.id,
        type: 'TIP',
        amount: amountDecimal.negated(),
        status: 'COMPLETED',
        metadata: {
          recipientId,
          recipientUsername: recipient.username,
          chatRoomId: roomId,
          tipMessage: tipMessage ?? null,
        },
      },
    });

    await tx.transaction.create({
      data: {
        walletId: recipientWallet.id,
        type: 'TIP',
        amount: amountDecimal,
        status: 'COMPLETED',
        metadata: {
          senderId,
          senderUsername: sender.username,
          chatRoomId: roomId,
          tipMessage: tipMessage ?? null,
        },
      },
    });

    // Create a system message in the chat room about the tip
    const tipChatMessage = await tx.chatMessage.create({
      data: {
        roomId,
        userId: senderId,
        content: tipMessage
          ? `tipped @${recipient.username} ${amount} ${currency.toUpperCase()} - "${tipMessage}"`
          : `tipped @${recipient.username} ${amount} ${currency.toUpperCase()}`,
        type: 'TIP',
        metadata: {
          recipientId,
          recipientUsername: recipient.username,
          amount: amount.toFixed(8),
          currency: currency.toUpperCase(),
          tipMessage: tipMessage ?? null,
        },
      },
      select: {
        id: true,
        content: true,
        type: true,
        metadata: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            username: true,
            avatar: true,
            vipTier: true,
          },
        },
      },
    });

    // Create notification for recipient
    await tx.notification.create({
      data: {
        userId: recipientId,
        type: 'TIP_RECEIVED',
        title: 'Tip Received!',
        message: `${sender.username} tipped you ${amount} ${currency.toUpperCase()}${tipMessage ? `: "${tipMessage}"` : ''}`,
        data: {
          senderId,
          senderUsername: sender.username,
          amount: amount.toFixed(8),
          currency: currency.toUpperCase(),
          chatRoomId: roomId,
        },
      },
    });

    return {
      tipId: tipChatMessage.id,
      message: tipChatMessage,
      amount: amount.toFixed(8),
      currency: currency.toUpperCase(),
      sender: {
        id: sender.id,
        username: sender.username,
      },
      recipient: {
        id: recipient.id,
        username: recipient.username,
      },
    };
  });

  return result;
}

// ---------------------------------------------------------------------------
// Online tracking helpers (used by Socket.IO handlers)
// ---------------------------------------------------------------------------

/**
 * Mark a user as online in a room.
 */
export async function markUserOnline(roomId: string, userId: string): Promise<void> {
  await redis.sadd(`${ONLINE_USERS_KEY}${roomId}`, userId);
}

/**
 * Mark a user as offline in a room.
 */
export async function markUserOffline(roomId: string, userId: string): Promise<void> {
  await redis.srem(`${ONLINE_USERS_KEY}${roomId}`, userId);
}

/**
 * Get count of online users in a room.
 */
export async function getOnlineCount(roomId: string): Promise<number> {
  return redis.scard(`${ONLINE_USERS_KEY}${roomId}`);
}
