import { Prisma } from "@prisma/client";
import { prisma } from "../../services/prisma";

import { AppError } from "../../middleware/errorHandler";
import { describeQuota, getStudyQuotaRules, quotaTargetCount, respondentMatchesQuota } from "../../utils/studyMatching";

type CreateResponseInput = {
  account_id: string;
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

    if (respondent.accountId !== data.account_id) {
      await prisma.validationLog.create({
        data: {
          entityType: "RESPONSE_SUBMISSION",
          entityId: validationEntityId,
          checkType: "respondent_account_match",
          status: "FAIL",
          details: {
            respondent_id: data.respondent_id,
            study_id: data.study_id,
            account_id: data.account_id,
            reason: "Respondent does not belong to authenticated account"
          }
        }
      });
      throw new AppError("Forbidden", 403);
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

    const respondentSnapshot = {
      age: respondent.age,
      gender: respondent.gender,
      location: respondent.location,
      incomeBand: respondent.incomeBand
    };

    const quotas = getStudyQuotaRules(study.targetCriteria);
    if (quotas.length > 0) {
      const matchingQuotas = quotas
        .map((quota, index) => ({ quota, index }))
        .filter(({ quota }) => respondentMatchesQuota(respondentSnapshot, quota));

      if (matchingQuotas.length > 0) {
        const existingResponses = await prisma.response.findMany({
          where: { studyId: data.study_id },
          include: {
            respondent: {
              select: {
                age: true,
                gender: true,
                location: true,
                incomeBand: true
              }
            }
          }
        });

        const blockedQuota = matchingQuotas.find(({ quota }) => {
          const target = quotaTargetCount(quota);
          if (target === null) {
            return false;
          }

          const currentCount = existingResponses.filter((response) =>
            respondentMatchesQuota(
              {
                age: response.respondent.age,
                gender: response.respondent.gender,
                location: response.respondent.location,
                incomeBand: response.respondent.incomeBand
              },
              quota
            )
          ).length;

          return currentCount >= target;
        });

        if (blockedQuota) {
          await prisma.validationLog.create({
            data: {
              entityType: "RESPONSE_SUBMISSION",
              entityId: validationEntityId,
              checkType: "quota_available",
              status: "FAIL",
              details: {
                respondent_id: data.respondent_id,
                study_id: data.study_id,
                quota_label: describeQuota(blockedQuota.quota, blockedQuota.index),
                reason: "Quota already filled"
              }
            }
          });

          throw new AppError(`Quota filled for ${describeQuota(blockedQuota.quota, blockedQuota.index)}`, 409);
        }
      }
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
            checks: [
              "respondent_exists",
              "respondent_account_match",
              "study_exists",
              "quota_available",
              "unique_respondent_study"
            ]
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
