import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";

import { app } from "../src/app";
import { prisma } from "../src/services/prisma";

describe("DatLe API happy path", () => {
  const registerWithOtp = async (email: string, idNumber: string, password = "SecurePass123") => {
    const otpRequestRes = await request(app).post("/api/auth/request-otp").send({ email });
    expect(otpRequestRes.status).toBe(200);

    const otp = otpRequestRes.body.test_otp || "123456";
    const registerRes = await request(app)
      .post("/api/auth/register")
      .send({ email, id_number: idNumber, password, otp });

    return registerRes;
  };

  it("returns health status", async () => {
    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
  });

  it("registers and logs in account with unique id number", async () => {
    const unique = Date.now().toString();
    const email = `account-${unique}@datle.com`;
    const idNumber = `ID-${unique}`;
    const password = "SecurePass123";

    const registerRes = await registerWithOtp(email, idNumber, password);

    expect(registerRes.status).toBe(201);
    expect(registerRes.body.token).toBeTruthy();
    expect(registerRes.body.account.email).toBe(email);
    expect(registerRes.body.account.id_number).toBe(idNumber);

    const otherEmail = `other-${unique}@datle.com`;
    const otherOtpRes = await request(app).post("/api/auth/request-otp").send({ email: otherEmail });
    expect(otherOtpRes.status).toBe(200);

    const duplicateIdRes = await request(app)
      .post("/api/auth/register")
      .send({ email: otherEmail, id_number: idNumber, password, otp: otherOtpRes.body.test_otp || "123456" });

    expect(duplicateIdRes.status).toBe(409);
    expect(duplicateIdRes.body.message).toContain("ID number");

    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ identifier: idNumber, password });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.token).toBeTruthy();
    expect(loginRes.body.account.email).toBe(email);

    const logoutRes = await request(app).post("/api/auth/logout").set({ Authorization: `Bearer ${loginRes.body.token}` });
    expect(logoutRes.status).toBe(200);

    const postLogoutRes = await request(app)
      .post("/api/respondents")
      .set({ Authorization: `Bearer ${loginRes.body.token}` })
      .send({
        email,
        age: 30,
        gender: "female",
        location: "Nairobi",
        income_band: "50k-75k",
        education: "bachelors",
        employment_status: "full_time"
      });
    expect(postLogoutRes.status).toBe(401);
  });

  it("allows admin to promote a business account to business role", async () => {
    const unique = Date.now().toString();
    const adminEmail = `admin-${unique}@datle.com`;
    const businessEmail = `business-${unique}@datle.com`;

    const adminRegisterRes = await registerWithOtp(adminEmail, `ID-ADMIN-${unique}`);
    expect(adminRegisterRes.status).toBe(201);

    await prisma.account.update({
      where: { id: adminRegisterRes.body.account.id },
      data: { role: "ADMIN" }
    });

    const adminLoginRes = await request(app)
      .post("/api/auth/login")
      .send({ identifier: adminEmail, password: "SecurePass123" });

    expect(adminLoginRes.status).toBe(200);
    expect(adminLoginRes.body.account.role).toBe("ADMIN");

    const businessRegisterRes = await registerWithOtp(businessEmail, `ID-BIZ-${unique}`);
    expect(businessRegisterRes.status).toBe(201);

    const promoteRes = await request(app)
      .patch(`/api/auth/accounts/${businessRegisterRes.body.account.id}/role`)
      .set({ Authorization: `Bearer ${adminLoginRes.body.token}` })
      .send({ role: "BUSINESS" });

    expect(promoteRes.status).toBe(200);
    expect(promoteRes.body.role).toBe("BUSINESS");

    const businessLogin = await request(app)
      .post("/api/auth/login")
      .send({ identifier: businessEmail, password: "SecurePass123" });

    expect(businessLogin.status).toBe(200);
    expect(businessLogin.body.account.role).toBe("BUSINESS");
  });

  it("registers a business account with a company during onboarding", async () => {
    const unique = Date.now().toString();
    const email = `onboard-${unique}@datle.com`;

    const otpRequestRes = await request(app).post("/api/auth/request-otp").send({ email });
    expect(otpRequestRes.status).toBe(200);

    const registerRes = await request(app).post("/api/auth/business/register").send({
      company_name: `Onboard Co ${unique}`,
      email,
      id_number: `ID-ONBOARD-${unique}`,
      password: "SecurePass123",
      otp: otpRequestRes.body.test_otp || "123456"
    });

    expect(registerRes.status).toBe(201);
    expect(registerRes.body.token).toBeTruthy();
    expect(registerRes.body.account.role).toBe("BUSINESS");
    expect(registerRes.body.account.company_id).toBeTruthy();
    expect(registerRes.body.company.name).toBe(`Onboard Co ${unique}`);

    const savedAccount = await prisma.account.findUnique({
      where: { email },
      include: {
        company: true
      }
    });

    expect(savedAccount?.role).toBe("BUSINESS");
    expect(savedAccount?.company?.name).toBe(`Onboard Co ${unique}`);
  });

  it("reuses existing respondent when same email is submitted again", async () => {
    const unique = Date.now().toString();
    const email = `duplicate-${unique}@datle.com`;
    const registerRes = await registerWithOtp(email, `ID-DUP-${unique}`);

    expect(registerRes.status).toBe(201);

    await prisma.account.update({
      where: { id: registerRes.body.account.id },
      data: { role: "BUSINESS" }
    });

    const elevatedLoginRes = await request(app)
      .post("/api/auth/login")
      .send({ identifier: email, password: "SecurePass123" });

    expect(elevatedLoginRes.status).toBe(200);

    const authHeader = { Authorization: `Bearer ${elevatedLoginRes.body.token}` };

    const first = await request(app)
      .post("/api/respondents")
      .set(authHeader)
      .send({
        email,
        age: 28,
        gender: "female",
        location: "Nairobi",
        income_band: "50k-75k",
        education: "bachelors",
        employment_status: "full_time"
      });

    expect(first.status).toBe(201);
    expect(first.body.id).toBeTruthy();

    const second = await request(app)
      .post("/api/respondents")
      .set(authHeader)
      .send({
        email,
        age: 28,
        gender: "female",
        location: "Nairobi",
        income_band: "50k-75k",
        education: "bachelors",
        employment_status: "full_time"
      });

    expect(second.status).toBe(201);
    expect(second.body.id).toBe(first.body.id);
  });

  it("creates respondent, study, response and returns joined export", async () => {
    const unique = Date.now().toString();
    const email = `respondent-${unique}@datle.com`;
    const registerRes = await registerWithOtp(email, `ID-HAPPY-${unique}`);

    expect(registerRes.status).toBe(201);

    await prisma.account.update({
      where: { id: registerRes.body.account.id },
      data: { role: "BUSINESS" }
    });

    const elevatedLoginRes = await request(app)
      .post("/api/auth/login")
      .send({ identifier: email, password: "SecurePass123" });

    expect(elevatedLoginRes.status).toBe(200);

    const authHeader = { Authorization: `Bearer ${elevatedLoginRes.body.token}` };

    const respondentRes = await request(app)
      .post("/api/respondents")
      .set(authHeader)
      .send({
        email,
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

    const activateStudyRes = await request(app)
      .patch(`/api/studies/${studyRes.body.id}/status`)
      .set(authHeader)
      .send({ status: "ACTIVE" });

    expect(activateStudyRes.status).toBe(200);
    expect(activateStudyRes.body.status).toBe("ACTIVE");

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

    const respondentTwoRes = await request(app)
      .post("/api/respondents")
      .set(authHeader)
      .send({
        email,
        age: 35,
        gender: "male",
        location: "Austin, TX",
        income_band: "100k-150k",
        education: "masters",
        employment_status: "full_time"
      });

    expect(respondentTwoRes.status).toBe(201);
    expect(respondentTwoRes.body.id).toBe(respondentRes.body.id);

    const responseTwoRes = await request(app)
      .post("/api/responses")
      .set(authHeader)
      .send({
        respondent_id: respondentTwoRes.body.id,
        study_id: studyRes.body.id,
        payload: {
          q1_preferred_brand: "Brand B",
          q2_purchase_frequency: "monthly"
        }
      });

    expect(responseTwoRes.status).toBe(409);
    expect(responseTwoRes.body.message).toContain("already exists");

    const ownStudiesRes = await request(app).get("/api/studies/mine").set(authHeader);

    expect(ownStudiesRes.status).toBe(200);
    expect(ownStudiesRes.body).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: studyRes.body.id, createdBy: email })])
    );

    const exportRes = await request(app).get(`/api/studies/${studyRes.body.id}/responses`).set(authHeader);

    expect(exportRes.status).toBe(200);
    expect(exportRes.body.study.id).toBe(studyRes.body.id);
    expect(exportRes.body.total_responses).toBe(1);

    const csvRes = await request(app).get(`/api/studies/${studyRes.body.id}/responses.csv`).set(authHeader);

    expect(csvRes.status).toBe(200);
    expect(csvRes.headers["content-type"]).toContain("text/csv");
    expect(csvRes.headers["content-disposition"]).toContain("attachment");
    expect(csvRes.text).toContain("study_id");
    expect(csvRes.text).toContain("respondent_email");
    expect(csvRes.text).toContain("q1_preferred_brand");
    expect(csvRes.text).toContain("Brand A");
    expect(csvRes.text).not.toContain("Brand B");

    const analyticsRes = await request(app).get(`/api/analytics/studies/${studyRes.body.id}/summary`).set(authHeader);

    expect(analyticsRes.status).toBe(200);
    expect(analyticsRes.body.study.id).toBe(studyRes.body.id);
    expect(analyticsRes.body.metrics.total_responses).toBe(1);
    expect(analyticsRes.body.metrics.unique_respondents).toBe(1);
    expect(analyticsRes.body.respondent_breakdowns.gender).toEqual(
      expect.arrayContaining([expect.objectContaining({ value: "male", count: 1 })])
    );
    expect(analyticsRes.body.question_stats).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          question: "q1_preferred_brand",
          total_answered: 1
        })
      ])
    );

    const filteredAnalyticsRes = await request(app).get(
      `/api/analytics/studies/${studyRes.body.id}/summary?gender=female&location=Seattle%2C%20WA&q_q1_preferred_brand=Brand%20A`
    ).set(authHeader);

    expect(filteredAnalyticsRes.status).toBe(200);
    expect(filteredAnalyticsRes.body.metrics.total_responses).toBe(0);
    expect(filteredAnalyticsRes.body.metrics.unique_respondents).toBe(0);
    expect(filteredAnalyticsRes.body.applied_filters.dimensions.gender).toBe("female");
    expect(filteredAnalyticsRes.body.applied_filters.dimensions.location).toBe("Seattle, WA");
    expect(filteredAnalyticsRes.body.applied_filters.dimensions.q_q1_preferred_brand).toBe("Brand A");
    expect(filteredAnalyticsRes.body.respondent_breakdowns.gender).toEqual([]);

    const activityRes = await request(app).get("/api/respondents/me/activity").set(authHeader);

    expect(activityRes.status).toBe(200);
    expect(activityRes.body.metrics.total_submissions).toBe(1);
    expect(activityRes.body.activity).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          study: expect.objectContaining({
            id: studyRes.body.id
          })
        })
      ])
    );

    const validationLog = await prisma.validationLog.findFirst({
      where: {
        entityType: "RESPONSE_SUBMISSION",
        entityId: `${studyRes.body.id}:${respondentRes.body.id}`,
        checkType: "unique_respondent_study",
        status: "FAIL"
      }
    });

    expect(validationLog).not.toBeNull();
  });

  it("blocks business users from accessing another business study analytics", async () => {
    const unique = Date.now().toString();
    const ownerOneEmail = `biz-one-${unique}@datle.com`;
    const ownerTwoEmail = `biz-two-${unique}@datle.com`;

    const ownerOneRegister = await registerWithOtp(ownerOneEmail, `ID-BIZ1-${unique}`);
    const ownerTwoRegister = await registerWithOtp(ownerTwoEmail, `ID-BIZ2-${unique}`);

    await prisma.account.update({
      where: { id: ownerOneRegister.body.account.id },
      data: { role: "BUSINESS" }
    });

    await prisma.account.update({
      where: { id: ownerTwoRegister.body.account.id },
      data: { role: "BUSINESS" }
    });

    const ownerOneLogin = await request(app)
      .post("/api/auth/login")
      .send({ identifier: ownerOneEmail, password: "SecurePass123" });

    const ownerTwoLogin = await request(app)
      .post("/api/auth/login")
      .send({ identifier: ownerTwoEmail, password: "SecurePass123" });

    const ownerOneHeader = { Authorization: `Bearer ${ownerOneLogin.body.token}` };
    const ownerTwoHeader = { Authorization: `Bearer ${ownerTwoLogin.body.token}` };

    const studyRes = await request(app)
      .post("/api/studies")
      .set(ownerOneHeader)
      .send({
        title: `Protected Study ${unique}`,
        target_criteria: { segment: "premium" },
        status: "ACTIVE",
        created_by: "ignored@datle.com"
      });

    expect(studyRes.status).toBe(201);
    expect(studyRes.body.createdBy).toBe(ownerOneEmail);

    const forbiddenAnalytics = await request(app)
      .get(`/api/analytics/studies/${studyRes.body.id}/summary`)
      .set(ownerTwoHeader);

    expect(forbiddenAnalytics.status).toBe(403);

    const forbiddenExport = await request(app)
      .get(`/api/studies/${studyRes.body.id}/responses`)
      .set(ownerTwoHeader);

    expect(forbiddenExport.status).toBe(403);
  });

  it("allows business teammates in the same company to access company-owned studies", async () => {
    const unique = Date.now().toString();
    const adminEmail = `company-admin-${unique}@datle.com`;
    const ownerEmail = `owner-${unique}@datle.com`;
    const teammateEmail = `teammate-${unique}@datle.com`;

    const adminRegisterRes = await registerWithOtp(adminEmail, `ID-CADMIN-${unique}`);
    await prisma.account.update({
      where: { id: adminRegisterRes.body.account.id },
      data: { role: "ADMIN" }
    });

    const adminLoginRes = await request(app)
      .post("/api/auth/login")
      .send({ identifier: adminEmail, password: "SecurePass123" });

    const companyRes = await request(app)
      .post("/api/companies")
      .set({ Authorization: `Bearer ${adminLoginRes.body.token}` })
      .send({ name: `Acme Foods ${unique}` });

    expect(companyRes.status).toBe(201);

    const ownerRegisterRes = await registerWithOtp(ownerEmail, `ID-OWNER-${unique}`);
    const teammateRegisterRes = await registerWithOtp(teammateEmail, `ID-TEAM-${unique}`);

    await request(app)
      .patch(`/api/auth/accounts/${ownerRegisterRes.body.account.id}/role`)
      .set({ Authorization: `Bearer ${adminLoginRes.body.token}` })
      .send({ role: "BUSINESS", company_id: companyRes.body.id });

    await request(app)
      .patch(`/api/auth/accounts/${teammateRegisterRes.body.account.id}/role`)
      .set({ Authorization: `Bearer ${adminLoginRes.body.token}` })
      .send({ role: "BUSINESS", company_id: companyRes.body.id });

    const ownerLoginRes = await request(app)
      .post("/api/auth/login")
      .send({ identifier: ownerEmail, password: "SecurePass123" });

    const teammateLoginRes = await request(app)
      .post("/api/auth/login")
      .send({ identifier: teammateEmail, password: "SecurePass123" });

    const studyRes = await request(app)
      .post("/api/studies")
      .set({ Authorization: `Bearer ${ownerLoginRes.body.token}` })
      .send({
        title: `Company Study ${unique}`,
        target_criteria: { segment: "snacks" },
        status: "ACTIVE",
        created_by: "ignored@datle.com"
      });

    expect(studyRes.status).toBe(201);
    expect(studyRes.body.companyId).toBe(companyRes.body.id);

    const teammateStudyList = await request(app)
      .get("/api/studies/mine")
      .set({ Authorization: `Bearer ${teammateLoginRes.body.token}` });

    expect(teammateStudyList.status).toBe(200);
    expect(teammateStudyList.body).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: studyRes.body.id, companyId: companyRes.body.id })])
    );

    const teammateAnalytics = await request(app)
      .get(`/api/analytics/studies/${studyRes.body.id}/summary`)
      .set({ Authorization: `Bearer ${teammateLoginRes.body.token}` });

    expect(teammateAnalytics.status).toBe(200);
  });

  it("returns only eligible active studies for a respondent profile", async () => {
    const unique = Date.now().toString();
    const businessEmail = `matcher-biz-${unique}@datle.com`;
    const respondentEmail = `matcher-user-${unique}@datle.com`;

    const businessRegisterRes = await registerWithOtp(businessEmail, `ID-MBIZ-${unique}`);
    await prisma.account.update({
      where: { id: businessRegisterRes.body.account.id },
      data: { role: "BUSINESS" }
    });

    const businessLoginRes = await request(app)
      .post("/api/auth/login")
      .send({ identifier: businessEmail, password: "SecurePass123" });

    const respondentRegisterRes = await registerWithOtp(respondentEmail, `ID-MUSER-${unique}`);
    const respondentLoginRes = await request(app)
      .post("/api/auth/login")
      .send({ identifier: respondentEmail, password: "SecurePass123" });

    await request(app)
      .post("/api/respondents")
      .set({ Authorization: `Bearer ${respondentLoginRes.body.token}` })
      .send({
        email: respondentEmail,
        age: 25,
        gender: "female",
        location: "Nairobi",
        income_band: "25k-50k",
        education: "bachelors",
        employment_status: "full_time"
      });

    const matchingStudyRes = await request(app)
      .post("/api/studies")
      .set({ Authorization: `Bearer ${businessLoginRes.body.token}` })
      .send({
        title: `Eligible Study ${unique}`,
        target_criteria: {
          audience: {
            locations: ["Nairobi"],
            age_range: { min: 21, max: 30 },
            income_bands: ["25k-50k"]
          }
        },
        status: "ACTIVE",
        created_by: "ignored@datle.com"
      });

    const nonMatchingStudyRes = await request(app)
      .post("/api/studies")
      .set({ Authorization: `Bearer ${businessLoginRes.body.token}` })
      .send({
        title: `Ineligible Study ${unique}`,
        target_criteria: {
          audience: {
            locations: ["Mombasa"],
            age_range: { min: 35, max: 50 },
            income_bands: ["100k-150k"]
          }
        },
        status: "ACTIVE",
        created_by: "ignored@datle.com"
      });

    const eligibleStudiesRes = await request(app)
      .get("/api/respondents/me/eligible-studies")
      .set({ Authorization: `Bearer ${respondentLoginRes.body.token}` });

    expect(eligibleStudiesRes.status).toBe(200);
    expect(eligibleStudiesRes.body.studies).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: matchingStudyRes.body.id })])
    );
    expect(eligibleStudiesRes.body.studies).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: nonMatchingStudyRes.body.id })])
    );
  });

  it("blocks responses when a matching quota is already filled", async () => {
    const unique = Date.now().toString();
    const businessEmail = `quota-biz-${unique}@datle.com`;
    const userOneEmail = `quota-user-one-${unique}@datle.com`;
    const userTwoEmail = `quota-user-two-${unique}@datle.com`;

    const businessRegisterRes = await registerWithOtp(businessEmail, `ID-QBIZ-${unique}`);
    await prisma.account.update({
      where: { id: businessRegisterRes.body.account.id },
      data: { role: "BUSINESS" }
    });

    const businessLoginRes = await request(app)
      .post("/api/auth/login")
      .send({ identifier: businessEmail, password: "SecurePass123" });

    const createProfile = async (email: string, idNumber: string) => {
      const registerRes = await registerWithOtp(email, idNumber);
      const loginRes = await request(app)
        .post("/api/auth/login")
        .send({ identifier: email, password: "SecurePass123" });

      const profileRes = await request(app)
        .post("/api/respondents")
        .set({ Authorization: `Bearer ${loginRes.body.token}` })
        .send({
          email,
          age: 26,
          gender: "female",
          location: "Nairobi",
          income_band: "25k-50k",
          education: "bachelors",
          employment_status: "full_time"
        });

      return {
        registerRes,
        loginRes,
        profileRes
      };
    };

    const userOne = await createProfile(userOneEmail, `ID-QU1-${unique}`);
    const userTwo = await createProfile(userTwoEmail, `ID-QU2-${unique}`);

    const studyRes = await request(app)
      .post("/api/studies")
      .set({ Authorization: `Bearer ${businessLoginRes.body.token}` })
      .send({
        title: `Quota Study ${unique}`,
        target_criteria: {
          audience: {
            locations: ["Nairobi"],
            age_range: { min: 20, max: 30 },
            income_bands: ["25k-50k"]
          },
          quotas: [
            {
              label: "Nairobi women 25k-50k",
              gender: "female",
              location: "Nairobi",
              income_band: "25k-50k",
              min_age: 20,
              max_age: 30,
              target_count: 1
            }
          ]
        },
        status: "ACTIVE",
        created_by: "ignored@datle.com"
      });

    const firstResponseRes = await request(app)
      .post("/api/responses")
      .set({ Authorization: `Bearer ${userOne.loginRes.body.token}` })
      .send({
        respondent_id: userOne.profileRes.body.id,
        study_id: studyRes.body.id,
        payload: {
          q1: "yes"
        }
      });

    expect(firstResponseRes.status).toBe(201);

    const secondEligibleStudiesRes = await request(app)
      .get("/api/respondents/me/eligible-studies")
      .set({ Authorization: `Bearer ${userTwo.loginRes.body.token}` });

    expect(secondEligibleStudiesRes.status).toBe(200);
    expect(secondEligibleStudiesRes.body.studies).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: studyRes.body.id })])
    );

    const secondResponseRes = await request(app)
      .post("/api/responses")
      .set({ Authorization: `Bearer ${userTwo.loginRes.body.token}` })
      .send({
        respondent_id: userTwo.profileRes.body.id,
        study_id: studyRes.body.id,
        payload: {
          q1: "yes"
        }
      });

    expect(secondResponseRes.status).toBe(409);
    expect(secondResponseRes.body.message).toContain("Quota filled");

    const studyFeedRes = await request(app)
      .get("/api/respondents/me/study-feed")
      .set({ Authorization: `Bearer ${userTwo.loginRes.body.token}` });

    expect(studyFeedRes.status).toBe(200);
    expect(studyFeedRes.body.unavailable).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: studyRes.body.id,
          availability: expect.objectContaining({
            reason: expect.stringContaining("quota")
          })
        })
      ])
    );
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});
