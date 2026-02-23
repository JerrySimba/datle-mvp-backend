import { z } from "zod";

export const createStudySchema = z
  .object({
    title: z.string().min(1),
    target_criteria: z.record(z.any()),
    status: z.enum(["DRAFT", "ACTIVE", "PAUSED", "COMPLETED", "ARCHIVED"]).default("DRAFT"),
    created_by: z.string().min(1),
    start_date: z.string().datetime().optional(),
    end_date: z.string().datetime().optional()
  })
  .refine(
    (payload) => {
      if (!payload.start_date || !payload.end_date) {
        return true;
      }

      return new Date(payload.start_date) <= new Date(payload.end_date);
    },
    {
      message: "start_date must be earlier than or equal to end_date",
      path: ["start_date"]
    }
  );
