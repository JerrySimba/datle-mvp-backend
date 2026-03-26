import { Prisma } from "@prisma/client";
import { prisma } from "../../services/prisma";

import { AppError } from "../../middleware/errorHandler";

type CreateStudyInput = {
  title: string;
  target_criteria: Prisma.InputJsonValue;
  status: "DRAFT" | "ACTIVE" | "PAUSED" | "COMPLETED" | "ARCHIVED";
  created_by: string;
  company_id?: string;
  start_date?: string;
  end_date?: string;
};

export const studiesService = {
  async create(data: CreateStudyInput) {
    return prisma.study.create({
      data: {
        title: data.title,
        targetCriteria: data.target_criteria,
        status: data.status,
        createdBy: data.created_by,
        companyId: data.company_id || null,
        startDate: data.start_date ? new Date(data.start_date) : null,
        endDate: data.end_date ? new Date(data.end_date) : null
      }
    });
  },

  async list() {
    return prisma.study.findMany({
      orderBy: { createdAt: "desc" }
    });
  },

  async updateStatus(
    id: string,
    status: "DRAFT" | "ACTIVE" | "PAUSED" | "COMPLETED" | "ARCHIVED",
    account: { email: string; role?: string; companyId?: string }
  ) {
    await this.assertAccountAccess(id, account);

    return prisma.study.update({
      where: { id },
      data: { status }
    });
  },

  async listForAccount(account: { email: string; role?: string; companyId?: string }) {
    return prisma.study.findMany({
      where:
        account.role === "ADMIN"
          ? undefined
          : account.companyId
            ? {
                OR: [{ companyId: account.companyId }, { companyId: null, createdBy: account.email }]
              }
            : { createdBy: account.email },
      orderBy: { createdAt: "desc" }
    });
  },

  async getById(id: string) {
    const study = await prisma.study.findUnique({ where: { id } });

    if (!study) {
      throw new AppError("Study not found", 404);
    }

    return study;
  },

  async assertAccountAccess(id: string, account: { email: string; role?: string; companyId?: string }) {
    const study = await prisma.study.findUnique({ where: { id } });

    if (!study) {
      throw new AppError("Study not found", 404);
    }

    const hasCompanyAccess = !!account.companyId && study.companyId === account.companyId;
    const hasLegacyAccess = !study.companyId && study.createdBy === account.email;

    if (account.role !== "ADMIN" && !hasCompanyAccess && !hasLegacyAccess) {
      throw new AppError("Forbidden", 403);
    }

    return study;
  },

  async getResponsesExport(id: string) {
    const study = await prisma.study.findUnique({ where: { id } });

    if (!study) {
      throw new AppError("Study not found", 404);
    }

    const responses = await prisma.response.findMany({
      where: { studyId: id },
      orderBy: { submittedAt: "desc" },
      include: {
        respondent: {
          select: {
            id: true,
            email: true,
            age: true,
            gender: true,
            location: true,
            incomeBand: true,
            education: true,
            employmentStatus: true
          }
        }
      }
    });

    return {
      study: {
        id: study.id,
        title: study.title,
        status: study.status,
        created_by: study.createdBy,
        target_criteria: study.targetCriteria,
        start_date: study.startDate,
        end_date: study.endDate
      },
      total_responses: responses.length,
      rows: responses.map((response) => ({
        response_id: response.id,
        submitted_at: response.submittedAt,
        payload: response.payload,
        respondent: {
          id: response.respondent.id,
          email: response.respondent.email,
          age: response.respondent.age,
          gender: response.respondent.gender,
          location: response.respondent.location,
          income_band: response.respondent.incomeBand,
          education: response.respondent.education,
          employment_status: response.respondent.employmentStatus
        }
      }))
    };
  }
};
