import type { PilotPanel } from "../api/client";

/**
 * Invented display names for the 40 synthetic Kisumu facilities: a tree, a landscape word and
 * the facility level, in panel order. They are not checked against any real register and match
 * docs/design/prototype/kisumu-v2/export_data.py. The SYN-… ID stays in the detail panel and CSV.
 */
const TREES = [
  "Acacia",
  "Mvule",
  "Cedar",
  "Jacaranda",
  "Neem",
  "Fig",
  "Tamarind",
  "Croton",
];
const FEATURES = ["Ridge", "Spring", "Grove", "Crossing", "Gate"];
const LEVELS: Record<number, string> = {
  2: "Dispensary",
  3: "Health Centre",
  4: "Sub-County Hospital",
  5: "County Referral Hospital",
};

export function displayName(index: number, level: number) {
  const tree = TREES[index % TREES.length];
  const feature = FEATURES[Math.floor(index / TREES.length) % FEATURES.length];
  return `${tree} ${feature} ${LEVELS[level] ?? "Facility"}`;
}

/** The panel with invented display names in place of the generator's numbered names. */
export function withDisplayNames(panel: PilotPanel): PilotPanel {
  return {
    ...panel,
    facilities: panel.facilities.map((facility, index) => ({
      ...facility,
      name: displayName(index, facility.level),
    })),
  };
}

const CATEGORIES = {
  en: {
    antimalarial: "Antimalarial",
    malaria_diagnostic: "Malaria test",
    family_planning: "Family planning",
    antiretroviral: "Antiretroviral",
  },
  // Awaiting native-speaker review, like the other Swahili strings.
  sw: {
    antimalarial: "Dawa ya malaria",
    malaria_diagnostic: "Kipimo cha malaria",
    family_planning: "Uzazi wa mpango",
    antiretroviral: "Dawa ya ARV",
  },
} as const;

/** "Family planning tracer 04": the backend category plus the tracer number from the ID. */
export function commodityLabel(
  commodities: PilotPanel["commodities"],
  id: string,
  locale: "en" | "sw" = "en",
) {
  const commodity = commodities.find((item) => item.id === id);
  if (!commodity) return id;
  const names: Record<string, string> = CATEGORIES[locale];
  const category = names[commodity.category] ?? commodity.category;
  const number = id.slice(-2);
  return locale === "sw"
    ? `${category} (kifuatiliaji ${number})`
    : `${category} tracer ${number}`;
}
