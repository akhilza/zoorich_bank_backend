"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KycService = void 0;
const db_1 = require("../config/db");
const client_1 = require("@prisma/client");
class KycService {
    static async submitDocument(userId, data) {
        const document = await db_1.prisma.kycDocument.create({
            data: {
                userId,
                type: data.type,
                fileUrl: data.fileUrl,
                documentNum: data.documentNum,
                status: client_1.KycStatus.PENDING,
            },
        });
        await db_1.prisma.auditLog.create({
            data: {
                userId,
                action: 'KYC_DOCUMENT_SUBMITTED',
                details: `Submitted KYC document: ${data.type}`,
            },
        });
        return document;
    }
    static async getStatus(userId) {
        const documents = await db_1.prisma.kycDocument.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
        });
        let overallStatus = 'NOT_SUBMITTED';
        if (documents.some((d) => d.status === client_1.KycStatus.APPROVED)) {
            overallStatus = 'APPROVED';
        }
        else if (documents.some((d) => d.status === client_1.KycStatus.PENDING)) {
            overallStatus = 'PENDING';
        }
        else if (documents.some((d) => d.status === client_1.KycStatus.REJECTED)) {
            overallStatus = 'REJECTED';
        }
        return {
            status: overallStatus,
            documents,
        };
    }
}
exports.KycService = KycService;
