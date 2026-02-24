export type Study = {
  id: string;
  title: string;
  status: string;
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

export type ResponsePayload = Record<string, string | number | boolean>;
