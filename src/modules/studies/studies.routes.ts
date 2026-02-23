import { Router } from "express";

import { validateBody } from "../../utils/validate";
import { createStudySchema } from "./studies.schema";
import { studiesService } from "./studies.service";
import { requireAuth } from "../../middleware/auth";

export const studiesRouter = Router();

const csvEscape = (value: unknown) => {
  if (value === null || value === undefined) {
    return "";
  }

  const stringValue =
    typeof value === "string" ? value : typeof value === "object" ? JSON.stringify(value) : String(value);

  return `"${stringValue.replace(/"/g, "\"\"")}"`;
};

const buildCsv = (rows: Array<Record<string, unknown>>, headers: string[]) => {
  const headerLine = headers.map(csvEscape).join(",");
  const bodyLines = rows.map((row) => headers.map((header) => csvEscape(row[header])).join(","));
  return [headerLine, ...bodyLines].join("\n");
};

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

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

studiesRouter.get("/:id/responses.csv", async (req, res, next) => {
  try {
    const exportPayload = await studiesService.getResponsesExport(req.params.id);
    const payloadKeys = Array.from(
      new Set(
        exportPayload.rows.flatMap((row) =>
          row.payload && typeof row.payload === "object" && !Array.isArray(row.payload)
            ? Object.keys(row.payload as Record<string, unknown>)
            : []
        )
      )
    ).sort();

    const headers = [
      "study_id",
      "study_title",
      "study_status",
      "response_id",
      "submitted_at",
      "respondent_id",
      "respondent_email",
      "respondent_age",
      "respondent_gender",
      "respondent_location",
      "respondent_income_band",
      "respondent_education",
      "respondent_employment_status",
      ...payloadKeys
    ];

    const flattenedRows = exportPayload.rows.map((row) => {
      const payload =
        row.payload && typeof row.payload === "object" && !Array.isArray(row.payload)
          ? (row.payload as Record<string, unknown>)
          : {};

      return {
        study_id: exportPayload.study.id,
        study_title: exportPayload.study.title,
        study_status: exportPayload.study.status,
        response_id: row.response_id,
        submitted_at: row.submitted_at,
        respondent_id: row.respondent.id,
        respondent_email: row.respondent.email,
        respondent_age: row.respondent.age,
        respondent_gender: row.respondent.gender,
        respondent_location: row.respondent.location,
        respondent_income_band: row.respondent.income_band,
        respondent_education: row.respondent.education,
        respondent_employment_status: row.respondent.employment_status,
        ...payload
      };
    });

    const csv = buildCsv(flattenedRows, headers);
    const fileName = `${slugify(exportPayload.study.title) || "study"}-${exportPayload.study.id}-responses.csv`;

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.status(200).send(csv);
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
