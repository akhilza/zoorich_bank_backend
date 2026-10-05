import { prisma } from '../config/db';
import { KycDocumentType, KycStatus } from '@prisma/client';

export class KycService {
  static async submitDocument(
    userId: string,
    data: { type: KycDocumentType; fileUrl: string; documentNum?: string }
  ) {
    const document = await prisma.kycDocument.create({
      data: {
        userId,
        type: data.type,
        fileUrl: data.fileUrl,
        documentNum: data.documentNum,
        status: KycStatus.PENDING,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId,
        action: 'KYC_DOCUMENT_SUBMITTED',
        details: `Submitted KYC document: ${data.type}`,
      },
    });

    return document;
  }

  static async getStatus(userId: string) {
    const documents = await prisma.kycDocument.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    let overallStatus: 'NOT_SUBMITTED' | 'PENDING' | 'APPROVED' | 'REJECTED' = 'NOT_SUBMITTED';

    if (documents.some((d) => d.status === KycStatus.APPROVED)) {
      overallStatus = 'APPROVED';
    } else if (documents.some((d) => d.status === KycStatus.PENDING)) {
      overallStatus = 'PENDING';
    } else if (documents.some((d) => d.status === KycStatus.REJECTED)) {
      overallStatus = 'REJECTED';
    }

    return {
      status: overallStatus,
      documents,
    };
  }
}
