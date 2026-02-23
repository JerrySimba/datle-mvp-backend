import { Router } from "express";

import { analyticsService } from "./analytics.service";

export const analyticsRouter = Router();

analyticsRouter.get("/studies/:id/summary", async (req, res, next) => {
  try {
    const summary = await analyticsService.getStudySummary(req.params.id);
    res.status(200).json(summary);
  } catch (error) {
    next(error);
  }
});
