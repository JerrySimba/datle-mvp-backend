import { Prisma } from "@prisma/client";
import { prisma } from "../../services/prisma";
import { AppError } from "../../middleware/errorHandler";

const countBy = <T>(items: T[]) => {
  const counts = new Map<string, number>();

  items.forEach((item) => {
    const key = String(item);
    counts.set(key, (counts.get(key) || 0) + 1);
  });

  return Array.from(counts.entries())
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count);
};

export const analyticsService = {
  async getStudySummary(
    studyId: string,
    filters?: {
      from?: string;
      to?: string;
      gender?: string;
      location?: string;
    }
  ) {
    const study = await prisma.study.findUnique({ where: { id: studyId } });

    if (!study) {
      throw new AppError("Study not found", 404);
    }

    const where: Prisma.ResponseWhereInput = {
      studyId,
      ...(filters?.from || filters?.to
        ? {
            submittedAt: {
              ...(filters?.from ? { gte: new Date(filters.from) } : {}),
              ...(filters?.to ? { lte: new Date(filters.to) } : {})
            }
          }
        : {}),
      ...(filters?.gender || filters?.location
        ? {
            respondent: {
              ...(filters?.gender ? { gender: filters.gender } : {}),
              ...(filters?.location ? { location: filters.location } : {})
            }
          }
        : {})
    };

    const responses = await prisma.response.findMany({
      where,
      include: {
        respondent: {
          select: {
            age: true,
            gender: true,
            location: true,
            incomeBand: true,
            education: true,
            employmentStatus: true
          }
        }
      },
      orderBy: { submittedAt: "asc" }
    });

    const trendMap = new Map<string, number>();
    responses.forEach((response) => {
      const day = response.submittedAt.toISOString().slice(0, 10);
      trendMap.set(day, (trendMap.get(day) || 0) + 1);
    });

    const totalResponses = responses.length;
    const uniqueRespondents = new Set(responses.map((item) => item.respondentId)).size;
    const payloadValueCounts = new Map<string, Map<string, number>>();

    responses.forEach((item) => {
      if (item.payload && typeof item.payload === "object" && !Array.isArray(item.payload)) {
        const payload = item.payload as Record<string, unknown>;
        Object.entries(payload).forEach(([key, value]) => {
          const bucket = payloadValueCounts.get(key) || new Map<string, number>();
          const normalizedValue =
            value === null
              ? "null"
              : typeof value === "string"
                ? value
                : typeof value === "number" || typeof value === "boolean"
                  ? String(value)
                  : JSON.stringify(value);

          bucket.set(normalizedValue, (bucket.get(normalizedValue) || 0) + 1);
          payloadValueCounts.set(key, bucket);
        });
      }
    });

    const questionStats = Array.from(payloadValueCounts.entries())
      .map(([question, values]) => {
        const top_values = Array.from(values.entries())
          .map(([value, count]) => ({ value, count }))
          .sort((a, b) => b.count - a.count);

        return {
          question,
          total_answered: top_values.reduce((acc, item) => acc + item.count, 0),
          top_values
        };
      })
      .sort((a, b) => a.question.localeCompare(b.question));

    return {
      study: {
        id: study.id,
        title: study.title,
        status: study.status,
        created_by: study.createdBy,
        start_date: study.startDate,
        end_date: study.endDate
      },
      metrics: {
        total_responses: totalResponses,
        unique_respondents: uniqueRespondents
      },
      trends: {
        responses_by_day: Array.from(trendMap.entries()).map(([date, count]) => ({ date, count }))
      },
      applied_filters: {
        from: filters?.from || null,
        to: filters?.to || null,
        gender: filters?.gender || null,
        location: filters?.location || null
      },
      respondent_breakdowns: {
        gender: countBy(responses.map((item) => item.respondent.gender)),
        location: countBy(responses.map((item) => item.respondent.location)),
        income_band: countBy(responses.map((item) => item.respondent.incomeBand)),
        education: countBy(responses.map((item) => item.respondent.education)),
        employment_status: countBy(responses.map((item) => item.respondent.employmentStatus)),
        age: countBy(responses.map((item) => item.respondent.age))
      },
      question_stats: questionStats
    };
  }
};
