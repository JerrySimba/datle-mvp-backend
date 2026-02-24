import type { Study, Summary } from "./types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

const toQueryString = (params: Record<string, string | undefined>) => {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      query.set(key, value);
    }
  });

  const queryString = query.toString();
  return queryString ? `?${queryString}` : "";
};

export const fetchStudies = async () => {
  const response = await fetch(`${API_BASE_URL}/api/studies`);
  if (!response.ok) {
    throw new Error("Failed to load studies");
  }

  return (await response.json()) as Study[];
};

export const fetchSummary = async (
  studyId: string,
  filters: { from?: string; to?: string; gender?: string; location?: string }
) => {
  const query = toQueryString(filters);
  const response = await fetch(`${API_BASE_URL}/api/analytics/studies/${studyId}/summary${query}`);

  if (!response.ok) {
    throw new Error("Failed to load analytics summary");
  }

  return (await response.json()) as Summary;
};
