import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";

import { app } from "../src/app";
import { tokenService } from "../src/services/token";
import { prisma } from "../src/services/prisma";

describe("DatLe API happy path", () => {
  it("returns health status", async () => {
    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
  });

  it("creates respondent, study, response and returns joined export", async () => {
    const token = tokenService.createToken({
      email: "test-operator@datle.com",
      iat: Date.now()
    });

    const authHeader = { Authorization: `Bearer ${token}` };
    const unique = Date.now().toString();

    const respondentRes = await request(app)
      .post("/api/respondents")
      .set(authHeader)
      .send({
        email: `respondent-${unique}@datle.com`,
        age: 30,
        gender: "female",
        location: "Seattle, WA",
        income_band: "75k-100k",
        education: "bachelors",
        employment_status: "full_time"
      });

    expect(respondentRes.status).toBe(201);
    expect(respondentRes.body.id).toBeTruthy();

    const studyRes = await request(app)
      .post("/api/studies")
      .set(authHeader)
      .send({
        title: `MVP Study ${unique}`,
        target_criteria: {
          age_range: "25-40",
          location: ["Seattle, WA"]
        },
        status: "ACTIVE",
        created_by: "research@datle.com",
        start_date: "2026-02-22T00:00:00.000Z",
        end_date: "2026-03-22T00:00:00.000Z"
      });

    expect(studyRes.status).toBe(201);
    expect(studyRes.body.id).toBeTruthy();

    const responseRes = await request(app)
      .post("/api/responses")
      .set(authHeader)
      .send({
        respondent_id: respondentRes.body.id,
        study_id: studyRes.body.id,
        payload: {
          q1_preferred_brand: "Brand A",
          q2_purchase_frequency: "weekly"
        }
      });

    expect(responseRes.status).toBe(201);
    expect(responseRes.body.id).toBeTruthy();

    const exportRes = await request(app).get(`/api/studies/${studyRes.body.id}/responses`);

    expect(exportRes.status).toBe(200);
    expect(exportRes.body.study.id).toBe(studyRes.body.id);
    expect(exportRes.body.total_responses).toBe(1);
    expect(exportRes.body.rows[0].respondent.id).toBe(respondentRes.body.id);
    expect(exportRes.body.rows[0].payload.q1_preferred_brand).toBe("Brand A");

    const csvRes = await request(app).get(`/api/studies/${studyRes.body.id}/responses.csv`);

    expect(csvRes.status).toBe(200);
    expect(csvRes.headers["content-type"]).toContain("text/csv");
    expect(csvRes.headers["content-disposition"]).toContain("attachment");
    expect(csvRes.text).toContain("study_id");
    expect(csvRes.text).toContain("respondent_email");
    expect(csvRes.text).toContain("q1_preferred_brand");
    expect(csvRes.text).toContain("Brand A");

    const analyticsRes = await request(app).get(`/api/analytics/studies/${studyRes.body.id}/summary`);

    expect(analyticsRes.status).toBe(200);
    expect(analyticsRes.body.study.id).toBe(studyRes.body.id);
    expect(analyticsRes.body.metrics.total_responses).toBe(1);
    expect(analyticsRes.body.metrics.unique_respondents).toBe(1);
    expect(analyticsRes.body.respondent_breakdowns.gender[0].value).toBe("female");
    expect(analyticsRes.body.respondent_breakdowns.gender[0].count).toBe(1);

    const validationLog = await prisma.validationLog.findFirst({
      where: {
        entityType: "RESPONSE",
        entityId: responseRes.body.id,
        checkType: "response_submission_consistency",
        status: "PASS"
      }
    });

    expect(validationLog).not.toBeNull();
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});
