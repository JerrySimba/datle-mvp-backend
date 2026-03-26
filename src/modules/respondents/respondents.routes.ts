import { Router } from "express";

import { validateBody } from "../../utils/validate";
import { respondentsService } from "./respondents.service";
import { createRespondentSchema } from "./respondents.schema";
import { AuthenticatedRequest, requireAuth } from "../../middleware/auth";
import { AppError } from "../../middleware/errorHandler";

export const respondentsRouter = Router();

respondentsRouter.post("/", requireAuth, async (req, res, next) => {
  try {
    const auth = (req as AuthenticatedRequest).auth;
    if (!auth?.accountId) {
      throw new AppError("Account login required", 403);
    }

    const data = validateBody(createRespondentSchema, req.body);
    if (data.email.toLowerCase() !== auth.email.toLowerCase()) {
      throw new AppError("Profile email must match authenticated account", 403);
    }

    const respondent = await respondentsService.create({
      ...data,
      account_id: auth.accountId
    });

    res.status(201).json(respondent);
  } catch (error) {
    next(error);
  }
});

respondentsRouter.get("/me", requireAuth, async (req, res, next) => {
  try {
    const auth = (req as AuthenticatedRequest).auth;
    if (!auth?.accountId) {
      throw new AppError("Account login required", 403);
    }

    const respondent = await respondentsService.findByAccountId(auth.accountId);
    if (!respondent) {
      res.status(200).json({ respondent: null });
      return;
    }

    res.status(200).json({ respondent });
  } catch (error) {
    next(error);
  }
});

respondentsRouter.get("/me/activity", requireAuth, async (req, res, next) => {
  try {
    const auth = (req as AuthenticatedRequest).auth;
    if (!auth?.accountId) {
      throw new AppError("Account login required", 403);
    }

    const activity = await respondentsService.getAccountActivity(auth.accountId);
    res.status(200).json(activity);
  } catch (error) {
    next(error);
  }
});

respondentsRouter.get("/me/eligible-studies", requireAuth, async (req, res, next) => {
  try {
    const auth = (req as AuthenticatedRequest).auth;
    if (!auth?.accountId) {
      throw new AppError("Account login required", 403);
    }

    const studies = await respondentsService.getEligibleStudies(auth.accountId);
    res.status(200).json({ studies });
  } catch (error) {
    next(error);
  }
});

respondentsRouter.get("/me/study-feed", requireAuth, async (req, res, next) => {
  try {
    const auth = (req as AuthenticatedRequest).auth;
    if (!auth?.accountId) {
      throw new AppError("Account login required", 403);
    }

    const feed = await respondentsService.getStudyFeed(auth.accountId);
    res.status(200).json(feed);
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
