import { Router } from "express";

import { validateBody } from "../../utils/validate";
import { createStudySchema } from "./studies.schema";
import { studiesService } from "./studies.service";
import { requireAuth } from "../../middleware/auth";

export const studiesRouter = Router();

studiesRouter.post("/", requireAuth, async (req, res, next) => {
  try {
    const data = validateBody(createStudySchema, req.body);
    const study = await studiesService.create(data);
    res.status(201).json(study);
  } catch (error) {
    next(error);
  }
});

studiesRouter.get("/", async (_req, res, next) => {
  try {
    const studies = await studiesService.list();
    res.status(200).json(studies);
  } catch (error) {
    next(error);
  }
});

studiesRouter.get("/:id/responses", async (req, res, next) => {
  try {
    const exportPayload = await studiesService.getResponsesExport(req.params.id);
    res.status(200).json(exportPayload);
  } catch (error) {
    next(error);
  }
});

studiesRouter.get("/:id", async (req, res, next) => {
  try {
    const study = await studiesService.getById(req.params.id);
    res.status(200).json(study);
  } catch (error) {
    next(error);
  }
});
