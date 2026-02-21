import path from 'path';
import fs from 'fs/promises';
import { prisma } from '../../lib/prisma.js';
import type { KycDocType, KycDocStatus, KycLevel } from '@prisma/client';
import {
  notifyKycApproved,
  notifyKycRejected,
} from '../notifications/notification.service.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const UPLOAD_BASE_DIR = path.resolve(process.cwd(), 'uploads', 'kyc');

/**
 * Withdrawal limits per KYC level (in USD equivalent).
 */
const WITHDRAWAL_LIMITS: Record<KycLevel, { daily: number; weekly: number; monthly: number }> = {
  UNVERIFIED: { daily: 0, weekly: 0, monthly: 0 },
  BASIC: { daily: 1_000, weekly: 5_000, monthly: 15_000 },
  INTERMEDIATE: { daily: 10_000, weekly: 50_000, monthly: 150_000 },
  ADVANCED: { daily: 100_000, weekly: 500_000, monthly: 1_500_000 },
};

// ---------------------------------------------------------------------------
// getKycStatus
// ---------------------------------------------------------------------------

export async function getKycStatus(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      kycLevel: true,
      kycDocuments: {
        select: {
          id: true,
          type: true,
          fileName: true,
          status: true,
          reviewNote: true,
          createdAt: true,
          reviewedAt: true,
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!user) {
    return null;
  }

  return {
    kycLevel: user.kycLevel,
    documents: user.kycDocuments,
    withdrawalLimits: getWithdrawalLimits(user.kycLevel),
    requirements: getRequirements(user.kycLevel),
  };
}

// ---------------------------------------------------------------------------
// uploadDocument
// ---------------------------------------------------------------------------

export async function uploadDocument(
  userId: string,
  type: KycDocType,
  file: Buffer,
  fileName: string,
) {
  // Check for existing pending document of same type
  const existingPending = await prisma.kycDocument.findFirst({
    where: {
      userId,
      type,
      status: 'PENDING',
    },
  });

  if (existingPending) {
    return {
      error: 'DUPLICATE_PENDING',
      message: `You already have a pending ${type} document awaiting review. Please wait for it to be reviewed before submitting another.`,
    };
  }

  // Ensure upload directory exists
  const userDir = path.join(UPLOAD_BASE_DIR, userId);
  await fs.mkdir(userDir, { recursive: true });

  // Generate unique filename with timestamp
  const sanitizedName = fileName
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .substring(0, 100);
  const ext = path.extname(sanitizedName) || '.jpg';
  const baseName = path.basename(sanitizedName, path.extname(sanitizedName));
  const uniqueFileName = `${type}_${Date.now()}_${baseName}${ext}`;
  const filePath = path.join(userDir, uniqueFileName);

  // Write file to disk
  await fs.writeFile(filePath, file);

  // Store relative URL path
  const fileUrl = `/uploads/kyc/${userId}/${uniqueFileName}`;

  // Create KycDocument record
  const document = await prisma.kycDocument.create({
    data: {
      userId,
      type,
      fileUrl,
      fileName: sanitizedName,
      status: 'PENDING',
    },
  });

  // Audit log
  await prisma.auditLog.create({
    data: {
      userId,
      action: 'KYC_DOCUMENT_UPLOADED',
      resource: 'kyc_document',
      resourceId: document.id,
      details: { type, fileName: sanitizedName },
    },
  });

  return {
    document: {
      id: document.id,
      type: document.type,
      fileName: document.fileName,
      status: document.status,
      createdAt: document.createdAt,
    },
  };
}

// ---------------------------------------------------------------------------
// getUserDocuments
// ---------------------------------------------------------------------------

export async function getUserDocuments(userId: string) {
  const documents = await prisma.kycDocument.findMany({
    where: { userId },
    select: {
      id: true,
      type: true,
      fileName: true,
      fileUrl: true,
      status: true,
      reviewNote: true,
      reviewedAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  return documents;
}

// ---------------------------------------------------------------------------
// getPendingQueue (admin)
// ---------------------------------------------------------------------------

export async function getPendingQueue(page: number, limit: number) {
  const where = { status: 'PENDING' as KycDocStatus };

  const [documents, total] = await Promise.all([
    prisma.kycDocument.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            username: true,
            kycLevel: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' }, // FIFO - oldest first
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.kycDocument.count({ where }),
  ]);

  return {
    documents,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

// ---------------------------------------------------------------------------
// getDocumentById (admin)
// ---------------------------------------------------------------------------

export async function getDocumentById(docId: string) {
  const document = await prisma.kycDocument.findUnique({
    where: { id: docId },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          username: true,
          kycLevel: true,
          vipTier: true,
          createdAt: true,
          kycDocuments: {
            select: {
              id: true,
              type: true,
              status: true,
              createdAt: true,
            },
            orderBy: { createdAt: 'desc' },
          },
        },
      },
    },
  });

  return document;
}

// ---------------------------------------------------------------------------
// approveDocument (admin)
// ---------------------------------------------------------------------------

export async function approveDocument(docId: string, adminId: string) {
  const document = await prisma.kycDocument.findUnique({
    where: { id: docId },
    include: {
      user: {
        select: {
          id: true,
          kycLevel: true,
          email: true,
          kycDocuments: {
            select: { type: true, status: true },
          },
        },
      },
    },
  });

  if (!document) {
    return { error: 'NOT_FOUND', message: 'Document not found.' };
  }

  if (document.status !== 'PENDING') {
    return {
      error: 'ALREADY_REVIEWED',
      message: `Document has already been ${document.status.toLowerCase()}.`,
    };
  }

  // Approve the document
  const updated = await prisma.kycDocument.update({
    where: { id: docId },
    data: {
      status: 'APPROVED',
      reviewedBy: adminId,
      reviewedAt: new Date(),
    },
  });

  // Determine if user qualifies for KYC level upgrade
  const newLevel = await evaluateKycLevel(document.user.id, document.type);

  if (newLevel && newLevel !== document.user.kycLevel) {
    await prisma.user.update({
      where: { id: document.user.id },
      data: { kycLevel: newLevel },
    });
  }

  // Audit log
  await prisma.auditLog.create({
    data: {
      adminId,
      userId: document.user.id,
      action: 'KYC_DOCUMENT_APPROVED',
      resource: 'kyc_document',
      resourceId: docId,
      details: {
        docType: document.type,
        previousLevel: document.user.kycLevel,
        newLevel: newLevel ?? document.user.kycLevel,
      },
    },
  });

  // Notify user
  await notifyKycApproved(
    document.user.id,
    document.type,
    newLevel ?? document.user.kycLevel,
  );

  return {
    document: updated,
    kycLevelUpgraded: newLevel ? newLevel !== document.user.kycLevel : false,
    newKycLevel: newLevel ?? document.user.kycLevel,
  };
}

// ---------------------------------------------------------------------------
// rejectDocument (admin)
// ---------------------------------------------------------------------------

export async function rejectDocument(docId: string, adminId: string, reason: string) {
  const document = await prisma.kycDocument.findUnique({
    where: { id: docId },
    include: {
      user: {
        select: { id: true, email: true },
      },
    },
  });

  if (!document) {
    return { error: 'NOT_FOUND', message: 'Document not found.' };
  }

  if (document.status !== 'PENDING') {
    return {
      error: 'ALREADY_REVIEWED',
      message: `Document has already been ${document.status.toLowerCase()}.`,
    };
  }

  const updated = await prisma.kycDocument.update({
    where: { id: docId },
    data: {
      status: 'REJECTED',
      reviewedBy: adminId,
      reviewNote: reason,
      reviewedAt: new Date(),
    },
  });

  // Audit log
  await prisma.auditLog.create({
    data: {
      adminId,
      userId: document.user.id,
      action: 'KYC_DOCUMENT_REJECTED',
      resource: 'kyc_document',
      resourceId: docId,
      details: { docType: document.type, reason },
    },
  });

  // Notify user
  await notifyKycRejected(document.user.id, document.type, reason);

  return { document: updated };
}

// ---------------------------------------------------------------------------
// getWithdrawalLimits
// ---------------------------------------------------------------------------

export function getWithdrawalLimits(kycLevel: KycLevel) {
  return WITHDRAWAL_LIMITS[kycLevel];
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Evaluate what KYC level a user qualifies for after a document approval.
 *
 * Levels:
 *   UNVERIFIED -> BASIC:       email verified (handled at registration)
 *   BASIC -> INTERMEDIATE:     at least one approved ID document
 *                              (PASSPORT | DRIVERS_LICENSE | NATIONAL_ID)
 *   INTERMEDIATE -> ADVANCED:  approved proof of address
 */
async function evaluateKycLevel(
  userId: string,
  _approvedDocType: KycDocType,
): Promise<KycLevel | null> {
  // Re-fetch all documents for this user with updated status
  const allDocs = await prisma.kycDocument.findMany({
    where: { userId },
    select: { type: true, status: true },
  });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { kycLevel: true },
  });

  if (!user) return null;

  const approvedDocs = allDocs.filter((d) => d.status === 'APPROVED');
  const approvedTypes = new Set(approvedDocs.map((d) => d.type));

  const hasIdDoc =
    approvedTypes.has('PASSPORT') ||
    approvedTypes.has('DRIVERS_LICENSE') ||
    approvedTypes.has('NATIONAL_ID');

  const hasProofOfAddress = approvedTypes.has('PROOF_OF_ADDRESS');

  // Determine the highest level the user qualifies for
  if (hasIdDoc && hasProofOfAddress) {
    return 'ADVANCED';
  }

  if (hasIdDoc) {
    return 'INTERMEDIATE';
  }

  // BASIC is typically set when email is verified (during registration flow)
  // but if user has no approved ID docs, they stay at their current level
  return user.kycLevel;
}

/**
 * Return requirements for the next KYC level.
 */
function getRequirements(currentLevel: KycLevel) {
  switch (currentLevel) {
    case 'UNVERIFIED':
      return {
        nextLevel: 'BASIC',
        requirements: ['Verify your email address'],
      };
    case 'BASIC':
      return {
        nextLevel: 'INTERMEDIATE',
        requirements: [
          'Submit a government-issued ID (Passport, Driver\'s License, or National ID)',
        ],
      };
    case 'INTERMEDIATE':
      return {
        nextLevel: 'ADVANCED',
        requirements: [
          'Submit a proof of address document (utility bill, bank statement, etc.)',
        ],
      };
    case 'ADVANCED':
      return {
        nextLevel: null,
        requirements: [],
      };
    default:
      return {
        nextLevel: null,
        requirements: [],
      };
  }
}
