import { prisma } from "../services/prisma";

const DEMO_CREATED_BY = "demo-seed@datle.com";
const DEMO_EMAIL_PREFIX = "demo-seed-";

type SeedRespondent = {
  profile: {
    email: string;
    age: number;
    gender: string;
    location: string;
    incomeBand: string;
    education: string;
    employmentStatus: string;
  };
  payload: Record<string, string | number | boolean>;
};

const seedRespondents: SeedRespondent[] = [
  {
    profile: {
      email: `${DEMO_EMAIL_PREFIX}1@datle.com`,
      age: 24,
      gender: "female",
      location: "New York, NY",
      incomeBand: "50k-75k",
      education: "bachelors",
      employmentStatus: "full_time"
    },
    payload: {
      q_primary_use_case: "daily hydration",
      q_purchase_frequency: "weekly",
      q_price_sensitivity: 3,
      q_preferred_channel: "online",
      q_favorite_pack_size: "500ml"
    }
  },
  {
    profile: {
      email: `${DEMO_EMAIL_PREFIX}2@datle.com`,
      age: 31,
      gender: "male",
      location: "Austin, TX",
      incomeBand: "75k-100k",
      education: "masters",
      employmentStatus: "full_time"
    },
    payload: {
      q_primary_use_case: "workout recovery",
      q_purchase_frequency: "weekly",
      q_price_sensitivity: 2,
      q_preferred_channel: "retail",
      q_favorite_pack_size: "1L"
    }
  },
  {
    profile: {
      email: `${DEMO_EMAIL_PREFIX}3@datle.com`,
      age: 27,
      gender: "female",
      location: "Seattle, WA",
      incomeBand: "75k-100k",
      education: "bachelors",
      employmentStatus: "full_time"
    },
    payload: {
      q_primary_use_case: "daily hydration",
      q_purchase_frequency: "monthly",
      q_price_sensitivity: 4,
      q_preferred_channel: "online",
      q_favorite_pack_size: "500ml"
    }
  },
  {
    profile: {
      email: `${DEMO_EMAIL_PREFIX}4@datle.com`,
      age: 36,
      gender: "male",
      location: "Chicago, IL",
      incomeBand: "100k-150k",
      education: "masters",
      employmentStatus: "self_employed"
    },
    payload: {
      q_primary_use_case: "workout recovery",
      q_purchase_frequency: "monthly",
      q_price_sensitivity: 2,
      q_preferred_channel: "retail",
      q_favorite_pack_size: "1L"
    }
  },
  {
    profile: {
      email: `${DEMO_EMAIL_PREFIX}5@datle.com`,
      age: 29,
      gender: "female",
      location: "Boston, MA",
      incomeBand: "50k-75k",
      education: "bachelors",
      employmentStatus: "full_time"
    },
    payload: {
      q_primary_use_case: "on-the-go convenience",
      q_purchase_frequency: "weekly",
      q_price_sensitivity: 4,
      q_preferred_channel: "online",
      q_favorite_pack_size: "330ml"
    }
  },
  {
    profile: {
      email: `${DEMO_EMAIL_PREFIX}6@datle.com`,
      age: 41,
      gender: "male",
      location: "Denver, CO",
      incomeBand: "100k-150k",
      education: "phd",
      employmentStatus: "full_time"
    },
    payload: {
      q_primary_use_case: "daily hydration",
      q_purchase_frequency: "weekly",
      q_price_sensitivity: 1,
      q_preferred_channel: "retail",
      q_favorite_pack_size: "1L"
    }
  }
];

const resetDemoData = async () => {
  await prisma.study.deleteMany({
    where: { createdBy: DEMO_CREATED_BY }
  });

  await prisma.respondent.deleteMany({
    where: {
      email: {
        startsWith: DEMO_EMAIL_PREFIX
      }
    }
  });
};

const seed = async () => {
  await resetDemoData();

  const startDate = new Date();
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 21);

  const study = await prisma.study.create({
    data: {
      title: "Demo Beverage Demand Tracker",
      targetCriteria: {
        age_range: "21-45",
        locations: ["New York, NY", "Austin, TX", "Seattle, WA", "Chicago, IL", "Boston, MA", "Denver, CO"],
        purchase_frequency: ["weekly", "monthly"]
      },
      status: "ACTIVE",
      createdBy: DEMO_CREATED_BY,
      startDate,
      endDate
    }
  });

  for (let index = 0; index < seedRespondents.length; index += 1) {
    const item = seedRespondents[index];
    const respondent = await prisma.respondent.create({
      data: item.profile
    });

    const submittedAt = new Date(startDate);
    submittedAt.setDate(startDate.getDate() + index);

    const response = await prisma.response.create({
      data: {
        respondentId: respondent.id,
        studyId: study.id,
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

  console.log("Demo seed complete.");
  console.log(`Study ID: ${study.id}`);
  console.log(`Study Title: ${study.title}`);
  console.log(`Responses Created: ${seedRespondents.length}`);
};

seed()
  .catch((error) => {
    console.error("Demo seed failed.", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
