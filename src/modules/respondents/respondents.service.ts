import { Prisma } from "@prisma/client";
import { prisma } from "../../services/prisma";

import { AppError } from "../../middleware/errorHandler";
import {
  describeQuota,
  getStudyQuotaRules,
  matchesAudienceCriteria,
  quotaTargetCount,
  respondentMatchesQuota
} from "../../utils/studyMatching";

type CreateRespondentInput = {
  account_id: string;
  email: string;
  age: number;
  gender: string;
  location: string;
  income_band: string;
  education: string;
  employment_status: string;
};

export const respondentsService = {
  async create(data: CreateRespondentInput) {
    const normalizedEmail = data.email.toLowerCase();
    try {
      return await prisma.respondent.upsert({
        where: { email: normalizedEmail },
        create: {
          accountId: data.account_id,
          email: normalizedEmail,
          age: data.age,
          gender: data.gender,
          location: data.location,
          incomeBand: data.income_band,
          education: data.education,
          employmentStatus: data.employment_status
        },
        update: {
          accountId: data.account_id,
          age: data.age,
          gender: data.gender,
          location: data.location,
          incomeBand: data.income_band,
          education: data.education,
          employmentStatus: data.employment_status
        }
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const target = Array.isArray(error.meta?.target) ? error.meta?.target.join(",") : "";
        if (target.includes("account_id") || target.includes("accountId")) {
          throw new AppError("Account already linked to another respondent profile", 409);
        }
      }

      throw error;
    }
  },

  async findById(id: string) {
    const respondent = await prisma.respondent.findUnique({ where: { id } });

    if (!respondent) {
      throw new AppError("Respondent not found", 404);
    }

    return respondent;
  },

  async findByAccountId(accountId: string) {
    return prisma.respondent.findUnique({
      where: { accountId }
    });
  },

  async getAccountActivity(accountId: string) {
    const respondent = await prisma.respondent.findUnique({
      where: { accountId },
      include: {
        responses: {
          orderBy: { submittedAt: "desc" },
          include: {
            study: {
              select: {
                id: true,
                title: true,
                status: true
              }
            }
          }
        }
      }
    });

    if (!respondent) {
      return {
        respondent: null,
        metrics: {
          total_submissions: 0,
          unique_studies_completed: 0,
          last_submission_at: null
        },
        activity: []
      };
    }

    return {
      respondent: {
        id: respondent.id,
        email: respondent.email,
        age: respondent.age,
        gender: respondent.gender,
        location: respondent.location,
        income_band: respondent.incomeBand,
        education: respondent.education,
        employment_status: respondent.employmentStatus,
        created_at: respondent.createdAt
      },
      metrics: {
        total_submissions: respondent.responses.length,
        unique_studies_completed: new Set(respondent.responses.map((item) => item.studyId)).size,
        last_submission_at: respondent.responses[0]?.submittedAt ?? null
      },
      activity: respondent.responses.map((response) => ({
        response_id: response.id,
        submitted_at: response.submittedAt,
        study: {
          id: response.study.id,
          title: response.study.title,
          status: response.study.status
        }
      }))
    };
  },

  async getStudyFeed(accountId: string) {
    const respondent = await prisma.respondent.findUnique({
      where: { accountId },
      include: {
        responses: {
          select: {
            studyId: true
          }
        }
      }
    });

    if (!respondent) {
      return {
        available: [],
        completed: [],
        unavailable: []
      };
    }

    const completedStudyIds = new Set(respondent.responses.map((response) => response.studyId));
    const studies = await prisma.study.findMany({
      where: {
        status: "ACTIVE"
      },
      include: {
        responses: {
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
        }
      },
      orderBy: { createdAt: "desc" }
    });

    const respondentSnapshot = {
      age: respondent.age,
      gender: respondent.gender,
      location: respondent.location,
      incomeBand: respondent.incomeBand
    };

    const available: Array<Record<string, unknown>> = [];
    const completed: Array<Record<string, unknown>> = [];
    const unavailable: Array<Record<string, unknown>> = [];

    const toStudyCard = (study: (typeof studies)[number]) => {
      const quotaStatus = getStudyQuotaRules(study.targetCriteria)
        .map((quota, index) => {
          const target = quotaTargetCount(quota);
          if (target === null || !respondentMatchesQuota(respondentSnapshot, quota)) {
            return null;
          }

          const current = study.responses.filter((response) =>
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

          return {
            label: describeQuota(quota, index),
            target_count: target,
            current_count: current,
            remaining: Math.max(target - current, 0)
          };
        })
        .filter(Boolean);

      return {
        id: study.id,
        title: study.title,
        status: study.status,
        targetCriteria: study.targetCriteria,
        eligibility: {
          matched: true,
          basis: {
            age: respondent.age,
            location: respondent.location,
            income_band: respondent.incomeBand
          },
          quota_status: quotaStatus
        }
      };
    };

    studies.forEach((study) => {
      const card = toStudyCard(study);

      if (completedStudyIds.has(study.id)) {
        completed.push({
          ...card,
          availability: {
            state: "completed",
            reason: "You already completed this study."
          }
        });
        return;
      }

      if (study.status !== "ACTIVE") {
        unavailable.push({
          ...card,
          availability: {
            state: "unavailable",
            reason: "This study is not currently open for responses."
          }
        });
        return;
      }

      if (!matchesAudienceCriteria(respondentSnapshot, study.targetCriteria)) {
        unavailable.push({
          ...card,
          availability: {
            state: "unavailable",
            reason: "Your current saved profile does not match the target audience for this study."
          }
        });
        return;
      }

      const quotaStatus = Array.isArray(card.eligibility?.quota_status) ? card.eligibility.quota_status : [];
      if (quotaStatus.length > 0 && quotaStatus.every((quota) => quota.remaining <= 0)) {
        unavailable.push({
          ...card,
          availability: {
            state: "unavailable",
            reason: "The quota for your matching respondent segment is already full."
          }
        });
        return;
      }

      available.push({
        ...card,
        availability: {
          state: "available",
          reason:
            quotaStatus.length > 0
              ? "You match an open quota for this study."
              : "You match the target audience for this study."
        }
      });
    });

    return { available, completed, unavailable };
  },

  async getEligibleStudies(accountId: string) {
    const feed = await this.getStudyFeed(accountId);
    return feed.available;
  }
};
