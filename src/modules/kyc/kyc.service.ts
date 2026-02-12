import prisma from '../../lib/prisma';
import { NotFoundError, AppError, ValidationError } from '../../utils/errors';
import { addNotificationJob } from '../../queues';

type KycDocType = 'PASSPORT' | 'DRIVERS_LICENSE' | 'NATIONAL_ID' | 'PROOF_OF_ADDRESS' | 'SELFIE';
type KycLevel = 'UNVERIFIED' | 'BASIC' | 'FULL';

const BASIC_KYC_TYPES: KycDocType[] = ['PASSPORT', 'DRIVERS_LICENSE', 'NATIONAL_ID'];
const FULL_KYC_TYPES: KycDocType[] = ['PROOF_OF_ADDRESS', 'SELFIE'];

export class KycService {
  async uploadDocument(userId: string, input: { type: KycDocType; fileUrl: string }) {
    const existing = await prisma.kycDocument.findFirst({
      where: { userId, type: input.type, status: 'PENDING' },
    });
    if (existing) throw new AppError('PENDING_EXISTS', 'A pending document of this type already exists', 409);

    const document = await prisma.kycDocument.create({
      data: {
        userId,
        type: input.type,
        fileUrl: input.fileUrl,
        status: 'PENDING',
      },
    });

    return {
      id: document.id,
      type: document.type,
      status: document.status,
      createdAt: document.createdAt.toISOString(),
    };
  }

  async getDocuments(userId: string) {
    const documents = await prisma.kycDocument.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, type: true, status: true, reviewNote: true, createdAt: true, reviewedAt: true },
    });
    return documents;
  }

  async getKycStatus(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, kycLevel: true },
    });
    if (!user) throw new NotFoundError('User', userId);

    const documents = await prisma.kycDocument.findMany({
      where: { userId },
      select: { type: true, status: true },
    });

    const approvedTypes = documents.filter((d) => d.status === 'APPROVED').map((d) => d.type);
    const pendingTypes = documents.filter((d) => d.status === 'PENDING').map((d) => d.type);

    const hasBasicDoc = BASIC_KYC_TYPES.some((t) => approvedTypes.includes(t));
    const hasFullDocs = hasBasicDoc && FULL_KYC_TYPES.every((t) => approvedTypes.includes(t));

    const calculatedLevel: KycLevel = hasFullDocs ? 'FULL' : hasBasicDoc ? 'BASIC' : 'UNVERIFIED';

    const requiredForBasic = hasBasicDoc ? [] : BASIC_KYC_TYPES.filter((t) => !approvedTypes.includes(t) && !pendingTypes.includes(t));
    const requiredForFull = hasFullDocs ? [] : FULL_KYC_TYPES.filter((t) => !approvedTypes.includes(t) && !pendingTypes.includes(t));

    return {
      currentLevel: user.kycLevel,
      calculatedLevel,
      approvedTypes,
      pendingTypes,
      requiredForNextLevel: calculatedLevel === 'FULL' ? [] : calculatedLevel === 'BASIC' ? requiredForFull : requiredForBasic.length > 0 ? requiredForBasic : requiredForFull,
    };
  }

  async getPendingDocuments(options: { page: number; limit: number }) {
    const { page, limit } = options;
    const [documents, total] = await Promise.all([
      prisma.kycDocument.findMany({
        where: { status: 'PENDING' },
        include: { user: { select: { id: true, email: true, username: true, kycLevel: true } } },
        orderBy: { createdAt: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.kycDocument.count({ where: { status: 'PENDING' } }),
    ]);

    return { documents, meta: { page, total, hasMore: (page - 1) * limit + limit < total } };
  }

  async reviewDocument(documentId: string, adminId: string, input: { status: 'APPROVED' | 'REJECTED'; reviewNote?: string }) {
    const document = await prisma.kycDocument.findUnique({
      where: { id: documentId },
      include: { user: { select: { id: true, kycLevel: true } } },
    });

    if (!document) throw new NotFoundError('KycDocument', documentId);
    if (document.status !== 'PENDING') throw new AppError('ALREADY_REVIEWED', 'Document already reviewed', 409);

    const updated = await prisma.kycDocument.update({
      where: { id: documentId },
      data: {
        status: input.status,
        reviewedBy: adminId,
        reviewNote: input.reviewNote || null,
        reviewedAt: new Date(),
      },
    });

    if (input.status === 'APPROVED') {
      await this.recalculateKycLevel(document.user.id);
    }

    await prisma.auditLog.create({
      data: {
        userId: document.user.id,
        adminId,
        action: `kyc_${input.status.toLowerCase()}`,
        resource: 'kyc_document',
        resourceId: documentId,
        details: { type: document.type, reviewNote: input.reviewNote },
      },
    });

    await addNotificationJob({
      userId: document.user.id,
      type: 'KYC',
      title: `Document ${input.status === 'APPROVED' ? 'Approved' : 'Rejected'}`,
      message: input.status === 'APPROVED'
        ? `Your ${document.type} document has been approved.`
        : `Your ${document.type} document was rejected. ${input.reviewNote || ''}`,
      data: { documentId, status: input.status },
    });

    return updated;
  }

  private async recalculateKycLevel(userId: string) {
    const documents = await prisma.kycDocument.findMany({
      where: { userId, status: 'APPROVED' },
      select: { type: true },
    });

    const approvedTypes = documents.map((d) => d.type);
    const hasBasicDoc = BASIC_KYC_TYPES.some((t) => approvedTypes.includes(t));
    const hasFullDocs = hasBasicDoc && FULL_KYC_TYPES.every((t) => approvedTypes.includes(t));
    const newLevel: KycLevel = hasFullDocs ? 'FULL' : hasBasicDoc ? 'BASIC' : 'UNVERIFIED';

    await prisma.user.update({ where: { id: userId }, data: { kycLevel: newLevel } });
  }
}

export const kycService = new KycService();
