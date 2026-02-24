export type Study = {
  id: string;
  title: string;
  status: string;
  createdBy: string;
  startDate?: string | null;
  endDate?: string | null;
};

export type BreakdownItem = {
  value: string;
  count: number;
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
  trends: {
    responses_by_day: Array<{ date: string; count: number }>;
  };
  applied_filters: {
    from: string | null;
    to: string | null;
    gender: string | null;
    location: string | null;
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
