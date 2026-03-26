export type SurveyQuestionType =
  | "single_select"
  | "multi_select"
  | "multi_select_max_3"
  | "number"
  | "select"
  | string;

export type SurveyQuestion = {
  key: string;
  prompt: string;
  type: SurveyQuestionType;
  options?: string[];
  required?: boolean;
  min?: number;
  max?: number;
};

export type SurveySection = {
  section_number: number;
  section_title: string;
  questions: SurveyQuestion[];
};

export type StudyTargetCriteria = {
  survey_structure?: SurveySection[];
};

export type Study = {
  id: string;
  title: string;
  status: string;
  targetCriteria?: StudyTargetCriteria;
  availability?: {
    state: "available" | "completed" | "unavailable";
    reason: string;
  };
  eligibility?: {
    matched: boolean;
    basis?: {
      age: number;
      location: string;
      income_band: string;
    };
    quota_status?: Array<{
      label: string;
      target_count: number;
      current_count: number;
      remaining: number;
    }>;
  };
};

export type StudyFeed = {
  available: Study[];
  completed: Study[];
  unavailable: Study[];
};

export type AccountAuthResponse = {
  token: string;
  tokenType: "Bearer";
  account: {
    id: string;
    email: string;
    id_number: string;
    role?: string;
  };
};

export type RespondentProfileInput = {
  email: string;
  age: number;
  gender: string;
  location: string;
  income_band: string;
  education: string;
  employment_status: string;
};

export type RespondentProfile = RespondentProfileInput & {
  id: string;
  created_at?: string;
};

export type AccountActivity = {
  respondent: RespondentProfile | null;
  metrics: {
    total_submissions: number;
    unique_studies_completed: number;
    last_submission_at: string | null;
  };
  activity: Array<{
    response_id: string;
    submitted_at: string;
    study: {
      id: string;
      title: string;
      status: string;
    };
  }>;
};

export type ResponsePayload = Record<string, string | number | boolean | string[]>;
