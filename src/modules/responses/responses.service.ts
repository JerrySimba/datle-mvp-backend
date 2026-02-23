import { Prisma } from "@prisma/client";
import { prisma } from "../../services/prisma";

import { AppError } from "../../middleware/errorHandler";

type CreateResponseInput = {
  respondent_id: string;
  study_id: string;
  payload: Prisma.InputJsonValue;
};

export const responsesService = {
  async create(data: CreateResponseInput) {
    const [respondent, study] = await Promise.all([
      prisma.respondent.findUnique({ where: { id: data.respondent_id } }),
      prisma.study.findUnique({ where: { id: data.study_id } })
    ]);

    const validationEntityId = `${data.study_id}:${data.respondent_id}`;

    if (!respondent) {
      await prisma.validationLog.create({
        data: {
          entityType: "RESPONSE_SUBMISSION",
          entityId: validationEntityId,
          checkType: "respondent_exists",
          status: "FAIL",
          details: {
            respondent_id: data.respondent_id,
            study_id: data.study_id,
            reason: "Respondent not found"
          }
        }
      });

      throw new AppError("Respondent not found", 404);
    }

    if (!study) {
      await prisma.validationLog.create({
        data: {
          entityType: "RESPONSE_SUBMISSION",
          entityId: validationEntityId,
          checkType: "study_exists",
          status: "FAIL",
          details: {
            respondent_id: data.respondent_id,
            study_id: data.study_id,
            reason: "Study not found"
          }
        }
      });

      throw new AppError("Study not found", 404);
    }

    try {
      const response = await prisma.response.create({
        data: {
          respondentId: data.respondent_id,
          studyId: data.study_id,
          payload: data.payload
        }
      });

      await prisma.validationLog.create({
        data: {
          entityType: "RESPONSE",
          entityId: response.id,
          checkType: "response_submission_consistency",
          status: "PASS",
          details: {
            respondent_id: data.respondent_id,
            study_id: data.study_id,
            payload_type: "json_object",
            checks: ["respondent_exists", "study_exists", "unique_respondent_study"]
          }
        }
      });

      return response;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        await prisma.validationLog.create({
          data: {
            entityType: "RESPONSE_SUBMISSION",
            entityId: validationEntityId,
            checkType: "unique_respondent_study",
            status: "FAIL",
            details: {
              respondent_id: data.respondent_id,
              study_id: data.study_id,
              reason: "Duplicate response for respondent and study"
            }
          }
        });

        throw new AppError("Response already exists for this respondent and study", 409);
      }

      throw error;
    }
  },

  async listByStudy(studyId: string) {
    return prisma.response.findMany({
      where: { studyId },
      orderBy: { submittedAt: "desc" }
    });
  }
};
