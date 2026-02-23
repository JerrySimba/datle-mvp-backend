import { Router } from "express";

import { validateBody } from "../../utils/validate";
import { respondentsService } from "./respondents.service";
import { createRespondentSchema } from "./respondents.schema";
import { requireAuth } from "../../middleware/auth";

export const respondentsRouter = Router();

respondentsRouter.post("/", requireAuth, async (req, res, next) => {
  try {
    const data = validateBody(createRespondentSchema, req.body);
    const respondent = await respondentsService.create(data);
    res.status(201).json(respondent);
  } catch (error) {
    next(error);
  }
});

respondentsRouter.get("/:id", async (req, res, next) => {
  try {
    const respondent = await respondentsService.findById(req.params.id);
    res.status(200).json(respondent);
  } catch (error) {
    next(error);
  }
});
