import { z } from "zod";

export const createRespondentSchema = z.object({
  email: z.string().email("Valid email is required"),
  age: z.coerce.number().int().min(13).max(120),
  gender: z.string().min(1),
  location: z.string().min(1),
  income_band: z.string().min(1),
  education: z.string().min(1),
  employment_status: z.string().min(1)
});

export const respondentIdParamSchema = z.object({
  id: z.string().min(1)
});
