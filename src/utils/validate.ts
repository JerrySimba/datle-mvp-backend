import { ZodError, ZodTypeAny, infer as zInfer } from "zod";
import { AppError } from "../middleware/errorHandler";

export const validateBody = <T extends ZodTypeAny>(schema: T, body: unknown): zInfer<T> => {
  try {
    return schema.parse(body);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new AppError(error.errors.map((item) => item.message).join(", "), 422);
    }

    throw error;
  }
};
