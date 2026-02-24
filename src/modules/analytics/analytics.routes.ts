import { Router } from "express";

import { analyticsService } from "./analytics.service";

export const analyticsRouter = Router();

analyticsRouter.get("/studies/:id/summary", async (req, res, next) => {
  try {
    const from = typeof req.query.from === "string" ? req.query.from : undefined;
    const to = typeof req.query.to === "string" ? req.query.to : undefined;
    const dimensionFilters = Object.entries(req.query).reduce<Record<string, string>>((acc, [key, value]) => {
      if (key === "from" || key === "to") {
        return acc;
      }

      if (typeof value === "string" && value.trim().length > 0) {
        acc[key] = value;
      }

      return acc;
    }, {});

    const summary = await analyticsService.getStudySummary(req.params.id, {
      from,
      to,
      dimensionFilters
    });

    res.status(200).json(summary);
  } catch (error) {
    next(error);
  }
});
