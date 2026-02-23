import { z } from "zod";

export const createResponseSchema = z.object({
  respondent_id: z.string().min(1),
  study_id: z.string().min(1),
  payload: z.record(z.any())
});
