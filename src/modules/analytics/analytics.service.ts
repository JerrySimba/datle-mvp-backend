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
      dimensionFilters?: Record<string, string>;
    }
  ) {
    const study = await prisma.study.findUnique({ where: { id: studyId } });

    if (!study) {
      throw new AppError("Study not found", 404);
    }

    const respondentFieldMap: Record<string, string> = {
      gender: "gender",
      location: "location",
      income_band: "incomeBand",
      education: "education",
      employment_status: "employmentStatus",
      age: "age"
    };

    const respondentFilterEntries = Object.entries(filters?.dimensionFilters || {}).filter(([key]) =>
      Object.keys(respondentFieldMap).includes(key)
    );

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
      ...(respondentFilterEntries.length > 0
        ? {
            respondent: respondentFilterEntries.reduce<Record<string, string | number>>((acc, [key, value]) => {
              const mapped = respondentFieldMap[key];
              if (mapped === "age") {
                const asNumber = Number(value);
                if (!Number.isNaN(asNumber)) {
                  acc[mapped] = asNumber;
                }
                return acc;
              }

              acc[mapped] = value;
              return acc;
            }, {})
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

    const payloadFilters = Object.entries(filters?.dimensionFilters || {}).filter(([key]) => key.startsWith("q_"));
    const filteredResponses =
      payloadFilters.length === 0
        ? responses
        : responses.filter((item) => {
            if (!item.payload || typeof item.payload !== "object" || Array.isArray(item.payload)) {
              return false;
            }

            const payload = item.payload as Record<string, unknown>;
            return payloadFilters.every(([key, expected]) => {
              const payloadKey = key.slice(2);
              const actual = payload[payloadKey];

              const normalized =
                actual === null
                  ? "null"
                  : typeof actual === "string"
                    ? actual
                    : typeof actual === "number" || typeof actual === "boolean"
                      ? String(actual)
                      : actual === undefined
                        ? ""
                        : JSON.stringify(actual);

              return normalized === expected;
            });
          });

    const trendMap = new Map<string, number>();
    filteredResponses.forEach((response) => {
      const day = response.submittedAt.toISOString().slice(0, 10);
      trendMap.set(day, (trendMap.get(day) || 0) + 1);
    });

    const totalResponses = filteredResponses.length;
    const uniqueRespondents = new Set(filteredResponses.map((item) => item.respondentId)).size;
    const payloadValueCounts = new Map<string, Map<string, number>>();

    filteredResponses.forEach((item) => {
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
        dimensions: filters?.dimensionFilters || {}
      },
      respondent_breakdowns: {
        gender: countBy(filteredResponses.map((item) => item.respondent.gender)),
        location: countBy(filteredResponses.map((item) => item.respondent.location)),
        income_band: countBy(filteredResponses.map((item) => item.respondent.incomeBand)),
        education: countBy(filteredResponses.map((item) => item.respondent.education)),
        employment_status: countBy(filteredResponses.map((item) => item.respondent.employmentStatus)),
        age: countBy(filteredResponses.map((item) => item.respondent.age))
      },
      question_stats: questionStats
    };
  }
};
