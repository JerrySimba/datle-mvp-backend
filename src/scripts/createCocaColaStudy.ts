import { Prisma } from "@prisma/client";

import { prisma } from "../services/prisma";

const STUDY_TITLE = "Coca-Cola Consumer Products Deep Dive 2026";
const CREATED_BY = "research@datle.com";

const targetCriteria: Prisma.InputJsonValue = {
  study_theme: "consumer_products",
  brand_focus: "Coca-Cola",
  objectives: [
    "Understand consumption occasions and preferences by product category",
    "Measure brand choice drivers and switching behavior",
    "Estimate willingness to pay across package sizes and channels",
    "Evaluate reactions to concept, flavor, and packaging variants"
  ],
  product_categories: [
    {
      key: "carbonated_soft_drinks",
      label: "Carbonated Soft Drinks",
      products: ["Coca-Cola Original", "Coca-Cola Zero Sugar", "Fanta", "Sprite"]
    },
    {
      key: "juices_and_nectars",
      label: "Juices and Nectars",
      products: ["Minute Maid Pulpy", "Minute Maid Mango", "Cappy"]
    },
    {
      key: "energy_and_sports",
      label: "Energy and Sports Drinks",
      products: ["Powerade", "Predator Energy"]
    },
    {
      key: "water_and_hydration",
      label: "Water and Hydration",
      products: ["Dasani", "Smartwater"]
    }
  ],
  target_population: {
    age_range: [18, 55],
    geographies: ["Nairobi", "Mombasa", "Kisumu", "Nakuru", "Eldoret"],
    minimum_purchase_frequency: "at_least_twice_per_month",
    inclusion_criteria: [
      "Consumed at least one Coca-Cola portfolio product in the last 30 days",
      "Primary or shared household purchase decision maker for beverages"
    ],
    quotas: {
      gender: {
        female: 50,
        male: 48,
        non_binary_or_prefer_not_say: 2
      },
      age_bands: {
        "18_24": 20,
        "25_34": 35,
        "35_44": 25,
        "45_55": 20
      },
      income_band: {
        low: 30,
        middle: 50,
        high: 20
      }
    }
  },
  sample_plan: {
    target_sample_size: 1200,
    expected_completion_rate_percent: 78,
    fieldwork_days: 21
  },
  survey_structure: [
    {
      section_number: 2,
      section_title: "Soft Drink Consumption Habits",
      questions: [
        {
          key: "q_soft_drink_consumption_frequency",
          prompt: "How often do you consume carbonated soft drinks?",
          type: "single_select",
          options: [
            "Daily",
            "Several times per week",
            "Once per week",
            "A few times per month",
            "Rarely",
            "Never"
          ]
        },
        {
          key: "q_coca_cola_products_consumed",
          prompt: "Which of the following Coca-Cola products do you drink? (Select all that apply)",
          type: "multi_select",
          options: [
            "Coca-Cola (Original)",
            "Coke Zero",
            "Diet Coke",
            "Sprite",
            "Fanta",
            "Schweppes / other Coca-Cola brand",
            "None"
          ]
        },
        {
          key: "q_most_often_coca_cola_product",
          prompt: "Which Coca-Cola product do you drink most often?",
          type: "single_select",
          options: [
            "Coca-Cola (Original)",
            "Coke Zero",
            "Diet Coke",
            "Sprite",
            "Fanta",
            "Other Coca-Cola beverage"
          ]
        }
      ]
    },
    {
      section_number: 3,
      section_title: "Consumption Frequency per Product",
      questions: [
        {
          key: "q_frequency_coca_cola_original",
          prompt: "How often do you drink Coca-Cola (Original)?",
          type: "single_select",
          options: ["Daily", "Several times per week", "Once per week", "Monthly", "Rarely / never"]
        },
        {
          key: "q_frequency_coke_zero",
          prompt: "How often do you drink Coke Zero?",
          type: "single_select",
          options: ["Daily", "Several times per week", "Once per week", "Monthly", "Rarely / never"]
        },
        {
          key: "q_frequency_sprite",
          prompt: "How often do you drink Sprite?",
          type: "single_select",
          options: ["Daily", "Several times per week", "Once per week", "Monthly", "Rarely / never"]
        },
        {
          key: "q_frequency_fanta",
          prompt: "How often do you drink Fanta?",
          type: "single_select",
          options: ["Daily", "Several times per week", "Once per week", "Monthly", "Rarely / never"]
        }
      ]
    },
    {
      section_number: 4,
      section_title: "Consumption Occasions",
      questions: [
        {
          key: "q_consumption_occasions_coca_cola",
          prompt: "When do you usually drink Coca-Cola products? (Select all that apply)",
          type: "multi_select",
          options: [
            "With meals",
            "At social gatherings / parties",
            "During travel",
            "During work or study breaks",
            "When eating fast food",
            "For refreshment during the day"
          ]
        },
        {
          key: "q_most_often_consumption_place",
          prompt: "Where do you most often consume Coca-Cola beverages?",
          type: "single_select",
          options: ["At home", "Restaurants / cafes", "Workplace / school", "Events / parties", "While traveling"]
        }
      ]
    },
    {
      section_number: 5,
      section_title: "Purchase Behavior",
      questions: [
        {
          key: "q_purchase_channel",
          prompt: "Where do you usually buy Coca-Cola beverages?",
          type: "single_select",
          options: [
            "Supermarkets",
            "Convenience stores",
            "Restaurants / fast food outlets",
            "Street vendors / kiosks",
            "Online delivery platforms"
          ]
        },
        {
          key: "q_preferred_package_format",
          prompt: "What package format do you prefer?",
          type: "single_select",
          options: ["Can", "Plastic bottle (PET)", "Glass bottle", "No preference"]
        },
        {
          key: "q_usual_purchase_size",
          prompt: "What size do you usually buy?",
          type: "single_select",
          options: ["250-330 ml", "500 ml", "1 liter", "1.5-2 liters", "Multipack"]
        }
      ]
    },
    {
      section_number: 6,
      section_title: "Drivers of Consumption",
      questions: [
        {
          key: "q_drivers_top_3",
          prompt: "Why do you choose Coca-Cola products? (Select top 3)",
          type: "multi_select_max_3",
          options: [
            "Taste",
            "Brand reputation",
            "Availability",
            "Price",
            "Advertising",
            "Habit / routine",
            "Variety of flavors"
          ]
        },
        {
          key: "q_motivation_coke_zero",
          prompt: "What motivates you to choose Coke Zero instead of regular Coca-Cola?",
          type: "single_select",
          options: [
            "Lower sugar",
            "Lower calories",
            "Taste preference",
            "Health reasons",
            "Recommendation from others",
            "I don't drink Coke Zero"
          ]
        }
      ]
    },
    {
      section_number: 7,
      section_title: "Brand Loyalty & Switching",
      questions: [
        {
          key: "q_stick_or_switch",
          prompt: "Do you usually stick to one Coca-Cola drink or switch between them?",
          type: "single_select",
          options: [
            "Always stick to one",
            "Usually stick to one but sometimes switch",
            "Frequently switch",
            "No preference"
          ]
        },
        {
          key: "q_competitor_if_unavailable",
          prompt: "Which competing brand do you drink if Coca-Cola products are unavailable?",
          type: "single_select",
          options: ["Pepsi products", "Local soda brands", "Juice / flavored drinks", "Water", "Energy drinks"]
        }
      ]
    },
    {
      section_number: 8,
      section_title: "Perceptions",
      questions: [
        {
          key: "q_taste_rating_overall",
          prompt: "How would you rate the taste of Coca-Cola products overall?",
          type: "single_select",
          options: ["Excellent", "Good", "Average", "Poor", "Very poor"]
        },
        {
          key: "q_affordability_perception",
          prompt: "How affordable do you consider Coca-Cola beverages?",
          type: "single_select",
          options: ["Very affordable", "Affordable", "Reasonable", "Expensive", "Very expensive"]
        },
        {
          key: "q_overall_satisfaction",
          prompt: "How satisfied are you with Coca-Cola products overall?",
          type: "single_select",
          options: ["Very satisfied", "Satisfied", "Neutral", "Dissatisfied", "Very dissatisfied"]
        }
      ]
    },
    {
      section_number: 9,
      section_title: "Future Behavior",
      questions: [
        {
          key: "q_next_year_consumption_intent",
          prompt: "Are you likely to increase or decrease your consumption of Coca-Cola products in the next year?",
          type: "single_select",
          options: ["Increase", "Stay the same", "Decrease", "Not sure"]
        },
        {
          key: "q_encouragement_to_consume_more",
          prompt: "What would encourage you to consume Coca-Cola products more often?",
          type: "single_select",
          options: ["Lower price", "New flavors", "Healthier options", "Promotions / discounts", "Better packaging"]
        }
      ]
    }
  ],
  questionnaire_blueprint: {
    section_screening: [
      { key: "q_screen_recent_consumption", type: "single_select", required: true },
      { key: "q_screen_purchase_role", type: "single_select", required: true }
    ],
    section_behavior: [
      { key: "q_category_usage_frequency", type: "matrix", required: true },
      { key: "q_consumption_occasions", type: "multi_select", required: true },
      { key: "q_pack_size_preference", type: "single_select", required: true },
      { key: "q_channel_preference", type: "ranked_choice", required: true }
    ],
    section_brand_equity: [
      { key: "q_brand_consideration_set", type: "multi_select", required: true },
      { key: "q_nps_coca_cola", type: "nps_0_10", required: true },
      { key: "q_brand_attributes", type: "likert_1_5", required: true }
    ],
    section_pricing_and_promo: [
      { key: "q_price_sensitivity_meter", type: "psm", required: true },
      { key: "q_promo_response", type: "single_select", required: true },
      { key: "q_bundle_interest", type: "likert_1_5", required: false }
    ],
    section_innovation_testing: [
      { key: "q_new_flavor_concept_interest", type: "likert_1_5", required: true },
      { key: "q_package_design_preference", type: "single_select", required: true },
      { key: "q_open_feedback", type: "open_text", required: false }
    ]
  },
  analysis_plan: {
    primary_dimensions: ["gender", "age", "location", "income_band", "education", "employment_status"],
    key_kpis: ["repeat_purchase_intent", "nps", "price_sensitivity_index", "channel_affinity_score"],
    reporting_cuts: ["overall", "category_users", "heavy_users", "price_sensitive_segment"]
  }
};

const createOrUpdate = async () => {
  const startDate = new Date("2026-03-10T00:00:00.000Z");
  const endDate = new Date("2026-03-31T23:59:59.000Z");

  const existing = await prisma.study.findFirst({
    where: {
      title: STUDY_TITLE,
      createdBy: CREATED_BY
    }
  });

  const study = existing
    ? await prisma.study.update({
        where: { id: existing.id },
        data: {
          targetCriteria,
          status: "ACTIVE",
          startDate,
          endDate
        }
      })
    : await prisma.study.create({
        data: {
          title: STUDY_TITLE,
          targetCriteria,
          status: "ACTIVE",
          createdBy: CREATED_BY,
          startDate,
          endDate
        }
      });

  console.log(existing ? "Comprehensive study updated." : "Comprehensive study created.");
  console.log(`Study ID: ${study.id}`);
  console.log(`Study Title: ${study.title}`);
  console.log(`Status: ${study.status}`);
};

createOrUpdate()
  .catch((error) => {
    console.error("Failed to create/update comprehensive study.", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
