import OpenAI from "openai";

import { env } from "../config/env";
import { AppError } from "../middleware/errorHandler";

type InsightMessage = {
  role: "user" | "assistant";
  content: string;
};

type StudySummaryContext = {
  study: {
    id: string;
    title: string;
    status: string;
    created_by: string;
    start_date: Date | string | null;
    end_date: Date | string | null;
  };
  metrics: {
    total_responses: number;
    unique_respondents: number;
  };
  quota_progress: Array<{
    id: string;
    label: string;
    target_count: number;
    current_count: number;
    remaining: number;
    filled: boolean;
  } | null>;
  trends: {
    responses_by_day: Array<{ date: string; count: number }>;
  };
  applied_filters: {
    from: string | null;
    to: string | null;
    dimensions: Record<string, string>;
  };
  respondent_breakdowns: {
    gender: Array<{ value: string; count: number }>;
    location: Array<{ value: string; count: number }>;
    income_band: Array<{ value: string; count: number }>;
    education: Array<{ value: string; count: number }>;
    employment_status: Array<{ value: string; count: number }>;
    age: Array<{ value: string; count: number }>;
  };
  question_stats: Array<{
    question: string;
    total_answered: number;
    top_values: Array<{ value: string; count: number }>;
  }>;
};

type InsightResult = {
  answer: string;
  model: string;
  generated_at: string;
};

const buildStudyContext = (summary: StudySummaryContext) =>
  JSON.stringify(
    {
      study: summary.study,
      metrics: summary.metrics,
      quota_progress: summary.quota_progress,
      trends: summary.trends.responses_by_day,
      applied_filters: summary.applied_filters,
      respondent_breakdowns: summary.respondent_breakdowns,
      question_stats: summary.question_stats
    },
    null,
    2
  );

const baseInstructions = `You are DatLe Insight Analyst, an AI research analyst for business dashboards.
Stay grounded in the provided study analytics context only.
Do not invent data, percentages, sample sizes, or respondent behaviors that are not present in the context.
When you make an inference, say it is an inference.
Write for business decision-makers in clear, concise language.
Always include:
1. Key findings
2. What they likely mean for the business
3. Recommended next actions
4. Caveats or limits in the data
If the user asks a follow-up question, answer it directly and reference the study context.
If the context is too thin to support a strong conclusion, say so plainly.`;

let cachedClient: OpenAI | null = null;

const getClient = () => {
  if (!env.OPENAI_API_KEY) {
    throw new AppError("AI insights are not configured. Add OPENAI_API_KEY to the backend environment.", 503);
  }

  if (!cachedClient) {
    cachedClient = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  }

  return cachedClient;
};

export const insightAssistant = {
  async generate(summary: StudySummaryContext, history: InsightMessage[] = [], question?: string): Promise<InsightResult> {
    const client = getClient();
    const prompt =
      question?.trim() ||
      "Generate a decision-ready insight brief for this study. Prioritize the most important patterns, actionable recommendations, and any caveats.";

    const historyText =
      history.length === 0
        ? "No prior conversation."
        : history.map((item) => `${item.role.toUpperCase()}: ${item.content}`).join("\n\n");

    let response;
    try {
      response = await client.responses.create({
        model: env.OPENAI_MODEL,
        instructions: baseInstructions,
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: `Study analytics context:\n${buildStudyContext(summary)}\n\nConversation so far:\n${historyText}\n\nUser request:\n${prompt}`
              }
            ]
          }
        ]
      });
    } catch (error) {
      const apiError = error as {
        status?: number;
        code?: string;
        message?: string;
      };

      if (apiError.status === 429 || apiError.code === "insufficient_quota") {
        throw new AppError(
          "OpenAI quota is exhausted for the configured project. Check billing and usage limits, then try again.",
          503
        );
      }

      if (apiError.status === 401) {
        throw new AppError("OpenAI rejected the API key. Check OPENAI_API_KEY and restart the backend.", 503);
      }

      if (apiError.status === 404) {
        throw new AppError(
          `The configured OpenAI model '${env.OPENAI_MODEL}' is unavailable for this project.`,
          503
        );
      }

      throw new AppError(apiError.message || "OpenAI request failed while generating insights.", 502);
    }

    const answer = response.output_text?.trim();
    if (!answer) {
      throw new AppError("AI insights were generated without any text output.", 502);
    }

    return {
      answer,
      model: env.OPENAI_MODEL,
      generated_at: new Date().toISOString()
    };
  }
};
