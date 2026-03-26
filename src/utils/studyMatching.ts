type StudyQuotaRule = {
  id?: string;
  label?: string;
  target_count?: unknown;
  gender?: unknown;
  location?: unknown;
  income_band?: unknown;
  min_age?: unknown;
  max_age?: unknown;
};

type RespondentSnapshot = {
  age: number;
  gender: string;
  location: string;
  incomeBand: string;
};

const normalizeText = (value: string) => value.trim().toLowerCase();

const asArray = (value: unknown) =>
  Array.isArray(value)
    ? value
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter(Boolean)
    : typeof value === "string"
      ? [value.trim()].filter(Boolean)
      : [];

const toNumber = (value: unknown) => {
  if (typeof value === "number" && !Number.isNaN(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  }

  return null;
};

const getAudience = (targetCriteria: unknown) => {
  if (!targetCriteria || typeof targetCriteria !== "object" || Array.isArray(targetCriteria)) {
    return null;
  }

  const candidate = targetCriteria as Record<string, unknown>;
  const audience = candidate.audience;
  if (!audience || typeof audience !== "object" || Array.isArray(audience)) {
    return null;
  }

  return audience as Record<string, unknown>;
};

export const matchesAudienceCriteria = (respondent: RespondentSnapshot, targetCriteria: unknown) => {
  const audience = getAudience(targetCriteria);
  if (!audience) {
    return true;
  }

  const locations = asArray(audience.locations).map(normalizeText);
  const incomeBands = asArray(audience.income_bands).map(normalizeText);
  const genders = asArray(audience.genders).map(normalizeText);
  const ageRange =
    audience.age_range && typeof audience.age_range === "object" && !Array.isArray(audience.age_range)
      ? (audience.age_range as Record<string, unknown>)
      : {};

  const minAge = toNumber(ageRange.min);
  const maxAge = toNumber(ageRange.max);

  if (locations.length > 0 && !locations.includes(normalizeText(respondent.location))) {
    return false;
  }

  if (incomeBands.length > 0 && !incomeBands.includes(normalizeText(respondent.incomeBand))) {
    return false;
  }

  if (genders.length > 0 && !genders.includes(normalizeText(respondent.gender))) {
    return false;
  }

  if (typeof minAge === "number" && respondent.age < minAge) {
    return false;
  }

  if (typeof maxAge === "number" && respondent.age > maxAge) {
    return false;
  }

  return true;
};

export const getStudyQuotaRules = (targetCriteria: unknown): StudyQuotaRule[] => {
  if (!targetCriteria || typeof targetCriteria !== "object" || Array.isArray(targetCriteria)) {
    return [];
  }

  const candidate = targetCriteria as Record<string, unknown>;
  const quotas = candidate.quotas;
  if (!Array.isArray(quotas)) {
    return [];
  }

  return quotas.filter((item): item is StudyQuotaRule => !!item && typeof item === "object");
};

export const respondentMatchesQuota = (respondent: RespondentSnapshot, quota: StudyQuotaRule) => {
  const genders = asArray(quota.gender).map(normalizeText);
  const locations = asArray(quota.location).map(normalizeText);
  const incomeBands = asArray(quota.income_band).map(normalizeText);
  const minAge = toNumber(quota.min_age);
  const maxAge = toNumber(quota.max_age);

  if (genders.length > 0 && !genders.includes(normalizeText(respondent.gender))) {
    return false;
  }

  if (locations.length > 0 && !locations.includes(normalizeText(respondent.location))) {
    return false;
  }

  if (incomeBands.length > 0 && !incomeBands.includes(normalizeText(respondent.incomeBand))) {
    return false;
  }

  if (typeof minAge === "number" && respondent.age < minAge) {
    return false;
  }

  if (typeof maxAge === "number" && respondent.age > maxAge) {
    return false;
  }

  return true;
};

export const describeQuota = (quota: StudyQuotaRule, index: number) => quota.label?.trim() || `Quota ${index + 1}`;

export const quotaTargetCount = (quota: StudyQuotaRule) => {
  const parsed = toNumber(quota.target_count);
  return typeof parsed === "number" && parsed > 0 ? parsed : null;
};
