import { Router } from "express";

import { AuthenticatedRequest, requireAuth, requireRoles } from "../../middleware/auth";
import { validateBody } from "../../utils/validate";
import { analyticsService } from "./analytics.service";
import { generateInsightsSchema } from "./analytics.schema";
import { insightAssistant } from "../../services/insightAssistant";

export const analyticsRouter = Router();

analyticsRouter.get("/studies/:id/summary", requireAuth, requireRoles("BUSINESS", "ADMIN"), async (req, res, next) => {
  try {
    const studyId = String(req.params.id);
    const auth = (req as AuthenticatedRequest).auth;
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

    const summary = await analyticsService.getStudySummary(studyId, {
      from,
      to,
      dimensionFilters
    }, {
      email: auth?.email || "",
      role: auth?.role,
      companyId: auth?.companyId
    });

    res.status(200).json(summary);
  } catch (error) {
    next(error);
  }
});

analyticsRouter.post("/studies/:id/insights", requireAuth, requireRoles("BUSINESS", "ADMIN"), async (req, res, next) => {
  try {
    const studyId = String(req.params.id);
    const auth = (req as AuthenticatedRequest).auth;
    const data = validateBody(generateInsightsSchema, req.body);
    const summary = await analyticsService.getStudySummary(
      studyId,
      undefined,
      {
        email: auth?.email || "",
        role: auth?.role,
        companyId: auth?.companyId
      }
    );

    const insight = await insightAssistant.generate(summary, data.history, data.question);
    res.status(200).json(insight);
  } catch (error) {
    next(error);
  }
});
