import { Router } from "express";

import { analyticsService } from "./analytics.service";

export const analyticsRouter = Router();

analyticsRouter.get("/studies/:id/summary", async (req, res, next) => {
  try {
    const from = typeof req.query.from === "string" ? req.query.from : undefined;
    const to = typeof req.query.to === "string" ? req.query.to : undefined;
    const gender = typeof req.query.gender === "string" ? req.query.gender : undefined;
    const location = typeof req.query.location === "string" ? req.query.location : undefined;

    const summary = await analyticsService.getStudySummary(req.params.id, {
      from,
      to,
      gender,
      location
    });

    res.status(200).json(summary);
  } catch (error) {
    next(error);
  }
});
