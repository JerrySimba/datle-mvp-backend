export const questionConfig = [
  {
    key: "q_primary_use_case",
    label: "What is your primary use case?",
    type: "select",
    options: ["daily hydration", "workout recovery", "on-the-go convenience"]
  },
  {
    key: "q_purchase_frequency",
    label: "How often do you purchase this type of product?",
    type: "select",
    options: ["weekly", "monthly", "rarely"]
  },
  {
    key: "q_price_sensitivity",
    label: "How price-sensitive are you? (1 low - 5 high)",
    type: "number",
    min: 1,
    max: 5
  },
  {
    key: "q_preferred_channel",
    label: "Where do you prefer to buy?",
    type: "select",
    options: ["online", "retail"]
  },
  {
    key: "q_favorite_pack_size",
    label: "Which pack size do you prefer?",
    type: "select",
    options: ["330ml", "500ml", "1L"]
  }
] as const;
