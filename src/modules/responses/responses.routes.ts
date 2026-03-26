import { Router } from "express";

import { validateBody } from "../../utils/validate";
import { createResponseSchema } from "./responses.schema";
import { responsesService } from "./responses.service";
import { AuthenticatedRequest, requireAuth } from "../../middleware/auth";
import { AppError } from "../../middleware/errorHandler";

export const responsesRouter = Router();

responsesRouter.post("/", requireAuth, async (req, res, next) => {
  try {
    const auth = (req as AuthenticatedRequest).auth;
    if (!auth?.accountId) {
      throw new AppError("Account login required", 403);
    }

    const data = validateBody(createResponseSchema, req.body);
    const response = await responsesService.create({
      ...data,
      account_id: auth.accountId
    });
    res.status(201).json(response);
  } catch (error) {
    next(error);
  }
});

responsesRouter.get("/study/:studyId", async (req, res, next) => {
  try {
    const responses = await responsesService.listByStudy(req.params.studyId);
    res.status(200).json(responses);
  } catch (error) {
    next(error);
  }
});
