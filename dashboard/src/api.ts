import type { BusinessAccount, BusinessAuthResponse, Company, CreateStudyInput, Study, Summary } from "./types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";
const jsonHeaders = {
  "Content-Type": "application/json"
};

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

const getError = async (response: Response) => {
  try {
    const data = (await response.json()) as { message?: string };
    return data.message || "Request failed";
  } catch {
    return "Request failed";
  }
};

export const loginBusiness = async (payload: { identifier: string; password: string }) => {
  const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(await getError(response));
  }

  return (await response.json()) as BusinessAuthResponse;
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

  return (await response.json()) as {
    message: string;
    expiresInMinutes: number;
    delivery: string;
    test_otp?: string;
  };
};

export const registerBusiness = async (payload: {
  company_name: string;
  email: string;
  id_number: string;
  password: string;
  otp: string;
}) => {
  const response = await fetch(`${API_BASE_URL}/api/auth/business/register`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(await getError(response));
  }

  return (await response.json()) as BusinessAuthResponse;
};

export const logoutBusiness = async (token: string) => {
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

export const fetchOwnedStudies = async (token: string) => {
  const response = await fetch(`${API_BASE_URL}/api/studies/mine`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    throw new Error(await getError(response));
  }

  return (await response.json()) as Study[];
};

export const createStudy = async (token: string, payload: CreateStudyInput) => {
  const response = await fetch(`${API_BASE_URL}/api/studies`, {
    method: "POST",
    headers: {
      ...jsonHeaders,
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      ...payload,
      created_by: "ignored-by-backend"
    })
  });

  if (!response.ok) {
    throw new Error(await getError(response));
  }

  return (await response.json()) as Study;
};

export const updateStudyStatus = async (token: string, studyId: string, status: Study["status"]) => {
  const response = await fetch(`${API_BASE_URL}/api/studies/${studyId}/status`, {
    method: "PATCH",
    headers: {
      ...jsonHeaders,
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ status })
  });

  if (!response.ok) {
    throw new Error(await getError(response));
  }

  return (await response.json()) as Study;
};

export const fetchAccounts = async (token: string) => {
  const response = await fetch(`${API_BASE_URL}/api/auth/accounts`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    throw new Error(await getError(response));
  }

  return (await response.json()) as BusinessAccount[];
};

export const fetchCompanies = async (token: string) => {
  const response = await fetch(`${API_BASE_URL}/api/companies`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    throw new Error(await getError(response));
  }

  return (await response.json()) as Company[];
};

export const createCompany = async (token: string, name: string) => {
  const response = await fetch(`${API_BASE_URL}/api/companies`, {
    method: "POST",
    headers: {
      ...jsonHeaders,
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ name })
  });

  if (!response.ok) {
    throw new Error(await getError(response));
  }

  return (await response.json()) as Company;
};

export const updateAccountRole = async (
  token: string,
  accountId: string,
  role: BusinessAccount["role"],
  companyId?: string
) => {
  const response = await fetch(`${API_BASE_URL}/api/auth/accounts/${accountId}/role`, {
    method: "PATCH",
    headers: {
      ...jsonHeaders,
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ role, company_id: companyId || undefined })
  });

  if (!response.ok) {
    throw new Error(await getError(response));
  }

  return (await response.json()) as BusinessAccount;
};

export const fetchSummary = async (
  token: string,
  studyId: string,
  filters: Record<string, string | undefined>
) => {
  const query = toQueryString(filters);
  const response = await fetch(`${API_BASE_URL}/api/analytics/studies/${studyId}/summary${query}`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    throw new Error(await getError(response));
  }

  return (await response.json()) as Summary;
};

export const downloadStudyExport = async (token: string, studyId: string, format: "json" | "csv") => {
  const url =
    format === "csv"
      ? `${API_BASE_URL}/api/studies/${studyId}/responses.csv`
      : `${API_BASE_URL}/api/studies/${studyId}/responses`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    throw new Error(await getError(response));
  }

  const blob = await response.blob();
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = format === "csv" ? `${studyId}-responses.csv` : `${studyId}-responses.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(href);
};
