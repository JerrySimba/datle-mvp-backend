import { prisma } from "../services/prisma";
import { passwordService } from "../services/password";

const DEMO_PREFIX = "demo-seed";
const DEMO_PASSWORD = "DemoPass123!";
const DEMO_COMPANY_NAME = "Demo Consumer Insights Ltd";
const BUSINESS_EMAIL = `${DEMO_PREFIX}-business@datle.com`;
const ADMIN_EMAIL = `${DEMO_PREFIX}-admin@datle.com`;

const GENERATED_STUDY_PREFIXES = [
  "Demo ",
  "MVP Study ",
  "Protected Study ",
  "Company Study ",
  "Eligible Study ",
  "Ineligible Study ",
  "Quota Study "
];

const GENERATED_EMAIL_PREFIXES = [
  DEMO_PREFIX,
  "account-",
  "admin-",
  "business-",
  "duplicate-",
  "respondent-",
  "biz-one-",
  "biz-two-",
  "company-admin-",
  "owner-",
  "teammate-",
  "onboard-",
  "matcher-biz-",
  "matcher-user-",
  "quota-biz-",
  "quota-user-one-",
  "quota-user-two-"
];

const GENERATED_COMPANY_PREFIXES = ["Acme Foods ", "Onboard Co "];

type DemoRespondent = {
  email: string;
  idNumber: string;
  age: number;
  gender: string;
  location: string;
  incomeBand: string;
  education: string;
  employmentStatus: string;
};

const respondents: DemoRespondent[] = [
  {
    email: `${DEMO_PREFIX}-respondent-1@datle.com`,
    idNumber: "DEMO-R1",
    age: 24,
    gender: "female",
    location: "Nairobi",
    incomeBand: "25k-50k",
    education: "bachelors",
    employmentStatus: "full_time"
  },
  {
    email: `${DEMO_PREFIX}-respondent-2@datle.com`,
    idNumber: "DEMO-R2",
    age: 27,
    gender: "female",
    location: "Nairobi",
    incomeBand: "25k-50k",
    education: "masters",
    employmentStatus: "self_employed"
  },
  {
    email: `${DEMO_PREFIX}-respondent-3@datle.com`,
    idNumber: "DEMO-R3",
    age: 29,
    gender: "male",
    location: "Nairobi",
    incomeBand: "25k-50k",
    education: "bachelors",
    employmentStatus: "full_time"
  },
  {
    email: `${DEMO_PREFIX}-respondent-4@datle.com`,
    idNumber: "DEMO-R4",
    age: 34,
    gender: "female",
    location: "Mombasa",
    incomeBand: "50k-75k",
    education: "bachelors",
    employmentStatus: "full_time"
  },
  {
    email: `${DEMO_PREFIX}-respondent-5@datle.com`,
    idNumber: "DEMO-R5",
    age: 38,
    gender: "male",
    location: "Kisumu",
    incomeBand: "75k-100k",
    education: "masters",
    employmentStatus: "full_time"
  },
  {
    email: `${DEMO_PREFIX}-respondent-6@datle.com`,
    idNumber: "DEMO-R6",
    age: 22,
    gender: "female",
    location: "Nairobi",
    incomeBand: "50k-75k",
    education: "high_school",
    employmentStatus: "part_time"
  }
];

const activeStudyStructure = [
  {
    section_number: 1,
    section_title: "Category Usage",
    questions: [
      {
        key: "q_soft_drink_frequency",
        prompt: "How often do you consume carbonated soft drinks?",
        type: "single_select",
        options: ["Daily", "Several times per week", "Once per week", "Monthly", "Rarely"]
      },
      {
        key: "q_preferred_brand",
        prompt: "Which soft drink brand do you buy most often?",
        type: "single_select",
        options: ["Coca-Cola", "Pepsi", "Fanta", "Sprite", "Other"]
      }
    ]
  },
  {
    section_number: 2,
    section_title: "Purchase Behavior",
    questions: [
      {
        key: "q_purchase_channel",
        prompt: "Where do you usually buy soft drinks?",
        type: "single_select",
        options: ["Supermarket", "Kiosk", "Restaurant", "Online"]
      },
      {
        key: "q_price_sensitivity",
        prompt: "How price sensitive are you when choosing a soft drink?",
        type: "single_select",
        options: ["Low", "Medium", "High"]
      }
    ]
  }
];

const completedStudyStructure = [
  {
    section_number: 1,
    section_title: "Pack Format Recall",
    questions: [
      {
        key: "q_pack_format",
        prompt: "Which pack type do you buy most often?",
        type: "single_select",
        options: ["Can", "PET bottle", "Glass bottle"]
      }
    ]
  }
];

const resetDemoData = async () => {
  await prisma.validationLog.deleteMany();
  await prisma.authOtpCode.deleteMany();

  await prisma.study.deleteMany({
    where: {
      OR: [
        ...GENERATED_STUDY_PREFIXES.map((prefix) => ({
          title: {
            startsWith: prefix
          }
        })),
        ...GENERATED_EMAIL_PREFIXES.map((prefix) => ({
          createdBy: {
            startsWith: prefix
          }
        }))
      ]
    }
  });

  await prisma.respondent.deleteMany({
    where: {
      OR: GENERATED_EMAIL_PREFIXES.map((prefix) => ({
        email: {
          startsWith: prefix
        }
      }))
    }
  });

  await prisma.account.deleteMany({
    where: {
      OR: GENERATED_EMAIL_PREFIXES.map((prefix) => ({
        email: {
          startsWith: prefix
        }
      }))
    }
  });

  await prisma.company.deleteMany({
    where: {
      OR: [
        {
          name: DEMO_COMPANY_NAME
        },
        ...GENERATED_COMPANY_PREFIXES.map((prefix) => ({
          name: {
            startsWith: prefix
          }
        }))
      ]
    }
  });
};

const seed = async () => {
  await resetDemoData();

  const company = await prisma.company.create({
    data: {
      name: DEMO_COMPANY_NAME,
      slug: "demo-consumer-insights"
    }
  });

  const adminAccount = await prisma.account.create({
    data: {
      email: ADMIN_EMAIL,
      idNumber: "DEMO-ADMIN",
      passwordHash: passwordService.hashPassword(DEMO_PASSWORD),
      role: "ADMIN"
    }
  });

  const businessAccount = await prisma.account.create({
    data: {
      email: BUSINESS_EMAIL,
      idNumber: "DEMO-BIZ",
      passwordHash: passwordService.hashPassword(DEMO_PASSWORD),
      role: "BUSINESS",
      companyId: company.id
    }
  });

  const respondentRecords: Array<{ accountId: string; respondentId: string; email: string }> = [];

  for (const item of respondents) {
    const account = await prisma.account.create({
      data: {
        email: item.email,
        idNumber: item.idNumber,
        passwordHash: passwordService.hashPassword(DEMO_PASSWORD),
        role: "USER"
      }
    });

    const respondent = await prisma.respondent.create({
      data: {
        accountId: account.id,
        email: item.email,
        age: item.age,
        gender: item.gender,
        location: item.location,
        incomeBand: item.incomeBand,
        education: item.education,
        employmentStatus: item.employmentStatus
      }
    });

    respondentRecords.push({
      accountId: account.id,
      respondentId: respondent.id,
      email: item.email
    });
  }

  const now = new Date();
  const activeStudy = await prisma.study.create({
    data: {
      title: "Demo Urban Soft Drink Pulse",
      companyId: company.id,
      createdBy: BUSINESS_EMAIL,
      status: "ACTIVE",
      startDate: now,
      endDate: new Date(now.getTime() + 1000 * 60 * 60 * 24 * 21),
      targetCriteria: {
        study_brief: {
          objective: "Measure urban soft drink purchase drivers and brand preference.",
          category: "consumer products",
          methodology: "survey"
        },
        audience: {
          locations: ["Nairobi", "Mombasa", "Kisumu"],
          age_range: { min: 18, max: 40 },
          income_bands: ["25k-50k", "50k-75k", "75k-100k"]
        },
        sample_plan: {
          target_responses: 5
        },
        quotas: [
          {
            label: "Nairobi women 25k-50k",
            gender: "female",
            location: "Nairobi",
            income_band: "25k-50k",
            min_age: 18,
            max_age: 35,
            target_count: 3
          },
          {
            label: "Urban men 25k-50k",
            gender: "male",
            income_band: "25k-50k",
            min_age: 20,
            max_age: 35,
            target_count: 2
          }
        ],
        survey_structure: activeStudyStructure,
        builder_version: "guided-v1"
      }
    }
  });

  const completedStudy = await prisma.study.create({
    data: {
      title: "Demo Pack Format Recall",
      companyId: company.id,
      createdBy: BUSINESS_EMAIL,
      status: "COMPLETED",
      startDate: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 14),
      endDate: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 3),
      targetCriteria: {
        study_brief: {
          objective: "Understand preferred pack formats for household purchase missions.",
          category: "consumer products",
          methodology: "survey"
        },
        audience: {
          locations: ["Nairobi", "Mombasa", "Kisumu"]
        },
        survey_structure: completedStudyStructure,
        builder_version: "guided-v1"
      }
    }
  });

  const responsePayloads = [
    {
      studyId: activeStudy.id,
      respondentEmail: respondents[0].email,
      payload: {
        q_soft_drink_frequency: "Several times per week",
        q_preferred_brand: "Coca-Cola",
        q_purchase_channel: "Supermarket",
        q_price_sensitivity: "Medium"
      }
    },
    {
      studyId: activeStudy.id,
      respondentEmail: respondents[1].email,
      payload: {
        q_soft_drink_frequency: "Daily",
        q_preferred_brand: "Fanta",
        q_purchase_channel: "Kiosk",
        q_price_sensitivity: "High"
      }
    },
    {
      studyId: activeStudy.id,
      respondentEmail: respondents[2].email,
      payload: {
        q_soft_drink_frequency: "Once per week",
        q_preferred_brand: "Pepsi",
        q_purchase_channel: "Restaurant",
        q_price_sensitivity: "Low"
      }
    },
    {
      studyId: completedStudy.id,
      respondentEmail: respondents[3].email,
      payload: {
        q_pack_format: "PET bottle"
      }
    },
    {
      studyId: completedStudy.id,
      respondentEmail: respondents[4].email,
      payload: {
        q_pack_format: "Can"
      }
    }
  ];

  for (let index = 0; index < responsePayloads.length; index += 1) {
    const item = responsePayloads[index];
    const respondent = respondentRecords.find((entry) => entry.email === item.respondentEmail);
    if (!respondent) {
      continue;
    }

    const submittedAt = new Date(now.getTime() - 1000 * 60 * 60 * 24 * (responsePayloads.length - index));
    const response = await prisma.response.create({
      data: {
        respondentId: respondent.respondentId,
        studyId: item.studyId,
        payload: item.payload,
        submittedAt
      }
    });

    await prisma.validationLog.create({
      data: {
        entityType: "RESPONSE",
        entityId: response.id,
        checkType: "response_submission_consistency",
        status: "PASS",
        details: {
          source: "demo_seed",
          respondent_email: respondent.email
        }
      }
    });
  }

  console.log("Pilot demo seed complete.");
  console.log(`Company: ${company.name}`);
  console.log(`Admin login: ${ADMIN_EMAIL} / ${DEMO_PASSWORD}`);
  console.log(`Business login: ${BUSINESS_EMAIL} / ${DEMO_PASSWORD}`);
  console.log(`Active study: ${activeStudy.title} (${activeStudy.id})`);
  console.log(`Completed study: ${completedStudy.title} (${completedStudy.id})`);
  console.log("Demo respondent logins:");
  respondents.forEach((item) => {
    console.log(`- ${item.email} / ${DEMO_PASSWORD}`);
  });
};

seed()
  .catch((error) => {
    console.error("Demo seed failed.", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
