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
  async getStudySummary(studyId: string) {
    const study = await prisma.study.findUnique({ where: { id: studyId } });

    if (!study) {
      throw new AppError("Study not found", 404);
    }

    const responses = await prisma.response.findMany({
      where: { studyId },
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
      respondent_breakdowns: {
        gender: countBy(responses.map((item) => item.respondent.gender)),
        location: countBy(responses.map((item) => item.respondent.location)),
        income_band: countBy(responses.map((item) => item.respondent.incomeBand)),
        education: countBy(responses.map((item) => item.respondent.education)),
        employment_status: countBy(responses.map((item) => item.respondent.employmentStatus)),
        age: countBy(responses.map((item) => item.respondent.age))
      }
    };
  }
};
