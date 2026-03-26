import { Router } from "express";
import { z } from "zod";

import { validateBody } from "../../utils/validate";
import { requireAuth, requireRoles } from "../../middleware/auth";
import { companiesService } from "./companies.service";

export const companiesRouter = Router();

const createCompanySchema = z.object({
  name: z.string().min(1, "Company name is required")
});

companiesRouter.get("/", requireAuth, requireRoles("ADMIN"), async (_req, res, next) => {
  try {
    const companies = await companiesService.list();
    res.status(200).json(companies);
  } catch (error) {
    next(error);
  }
});

companiesRouter.post("/", requireAuth, requireRoles("ADMIN"), async (req, res, next) => {
  try {
    const data = validateBody(createCompanySchema, req.body);
    const company = await companiesService.create(data.name);
    res.status(201).json(company);
  } catch (error) {
    next(error);
  }
});
