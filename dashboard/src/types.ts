export type StudyStatus = "DRAFT" | "ACTIVE" | "PAUSED" | "COMPLETED" | "ARCHIVED";

export type Company = {
  id: string;
  name: string;
  slug: string;
  createdAt?: string;
  updatedAt?: string;
};

export type Study = {
  id: string;
  companyId?: string | null;
  title: string;
  status: StudyStatus;
  createdBy: string;
  startDate?: string | null;
  endDate?: string | null;
};

export type BusinessAuthResponse = {
  token: string;
  tokenType: "Bearer";
  account: {
    id: string;
    email: string;
    id_number: string;
    company_id?: string | null;
    company_name?: string | null;
    role?: string;
  };
  company?: Company;
};

export type BusinessAccount = {
  id: string;
  email: string;
  id_number: string;
  role: "USER" | "BUSINESS" | "ADMIN";
  company_id?: string | null;
  company_name?: string | null;
  created_at: string;
};

export type CreateStudyInput = {
  title: string;
  target_criteria: Record<string, unknown>;
  status: StudyStatus;
  start_date?: string;
  end_date?: string;
};

export type BreakdownItem = {
  value: string;
  count: number;
};

export type QuotaProgressItem = {
  id: string;
  label: string;
  target_count: number;
  current_count: number;
  remaining: number;
  filled: boolean;
};

export type QuestionStat = {
  question: string;
  total_answered: number;
  top_values: BreakdownItem[];
};

export type Summary = {
  study: {
    id: string;
    title: string;
    status: string;
    created_by: string;
    start_date: string | null;
    end_date: string | null;
  };
  metrics: {
    total_responses: number;
    unique_respondents: number;
  };
  quota_progress: QuotaProgressItem[];
  trends: {
    responses_by_day: Array<{ date: string; count: number }>;
  };
  applied_filters: {
    from: string | null;
    to: string | null;
    dimensions: Record<string, string>;
  };
  respondent_breakdowns: {
    gender: BreakdownItem[];
    location: BreakdownItem[];
    income_band: BreakdownItem[];
    education: BreakdownItem[];
    employment_status: BreakdownItem[];
    age: BreakdownItem[];
  };
  question_stats: QuestionStat[];
};
