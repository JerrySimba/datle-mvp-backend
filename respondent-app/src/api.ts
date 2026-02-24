import type { RespondentProfileInput, Study } from "./types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

const jsonHeaders = {
  "Content-Type": "application/json"
};

const getError = async (response: Response) => {
  try {
    const data = (await response.json()) as { message?: string };
    return data.message || "Request failed";
  } catch {
    return "Request failed";
  }
};

export const requestOtp = async (email: string) => {
  const response = await fetch(`${API_BASE_URL}/api/auth/request-otp`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ email })
  });

  if (!response.ok) {
    throw new Error(await getError(response));
  }
};

export const verifyOtp = async (email: string, otp: string) => {
  const response = await fetch(`${API_BASE_URL}/api/auth/verify-otp`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ email, otp })
  });

  if (!response.ok) {
    throw new Error(await getError(response));
  }

  const data = (await response.json()) as { token: string };
  return data.token;
};

export const fetchStudies = async () => {
  const response = await fetch(`${API_BASE_URL}/api/studies`);
  if (!response.ok) {
    throw new Error("Failed to load studies");
  }

  return (await response.json()) as Study[];
};

export const createRespondent = async (token: string, payload: RespondentProfileInput) => {
  const response = await fetch(`${API_BASE_URL}/api/respondents`, {
    method: "POST",
    headers: {
      ...jsonHeaders,
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(await getError(response));
  }

  const data = (await response.json()) as { id: string };
  return data.id;
};

export const submitResponse = async (
  token: string,
  payload: {
    respondent_id: string;
    study_id: string;
    payload: Record<string, string | number | boolean>;
  }
) => {
  const response = await fetch(`${API_BASE_URL}/api/responses`, {
    method: "POST",
    headers: {
      ...jsonHeaders,
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(await getError(response));
  }
};
