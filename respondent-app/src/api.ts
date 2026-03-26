import type { AccountActivity, AccountAuthResponse, RespondentProfile, RespondentProfileInput, Study, StudyFeed } from "./types";

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

export const registerAccount = async (payload: { email: string; id_number: string; password: string; otp: string }) => {
  const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(await getError(response));
  }

  return (await response.json()) as AccountAuthResponse;
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

  return (await response.json()) as { message: string; expiresInMinutes: number; delivery: string; test_otp?: string };
};

export const loginAccount = async (payload: { identifier: string; password: string }) => {
  const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(await getError(response));
  }

  return (await response.json()) as AccountAuthResponse;
};

export const logoutAccount = async (token: string) => {
  const response = await fetch(`${API_BASE_URL}/api/auth/logout`, {
    method: "POST",
    headers: {
      ...jsonHeaders,
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    throw new Error(await getError(response));
  }
};

export const fetchStudies = async () => {
  const response = await fetch(`${API_BASE_URL}/api/studies`);
  if (!response.ok) {
    throw new Error("Failed to load studies");
  }

  return (await response.json()) as Study[];
};

export const fetchEligibleStudies = async (token: string) => {
  const response = await fetch(`${API_BASE_URL}/api/respondents/me/eligible-studies`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    throw new Error(await getError(response));
  }

  return (await response.json()) as { studies: Study[] };
};

export const fetchStudyFeed = async (token: string) => {
  const response = await fetch(`${API_BASE_URL}/api/respondents/me/study-feed`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    throw new Error(await getError(response));
  }

  return (await response.json()) as StudyFeed;
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

export const fetchMyRespondent = async (token: string) => {
  const response = await fetch(`${API_BASE_URL}/api/respondents/me`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    throw new Error(await getError(response));
  }

  return (await response.json()) as { respondent: null | RespondentProfile };
};

export const fetchMyActivity = async (token: string) => {
  const response = await fetch(`${API_BASE_URL}/api/respondents/me/activity`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    throw new Error(await getError(response));
  }

  return (await response.json()) as AccountActivity;
};

export const submitResponse = async (
  token: string,
  payload: {
    respondent_id: string;
    study_id: string;
    payload: Record<string, string | number | boolean | string[]>;
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
