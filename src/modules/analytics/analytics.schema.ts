import { z } from "zod";

export const insightMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(4000)
});

export const generateInsightsSchema = z.object({
  question: z.string().trim().min(1).max(2000).optional(),
  history: z.array(insightMessageSchema).max(12).optional()
});

