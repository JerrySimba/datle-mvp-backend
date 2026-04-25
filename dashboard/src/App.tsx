import { useEffect, useMemo, useState } from "react";
import {
  createCompany,
  createStudy,
  downloadStudyExport,
  fetchAccounts,
  fetchCompanies,
  fetchOwnedStudies,
  fetchSummary,
  generateStudyInsights,
  loginBusiness,
  registerBusiness,
  requestOtp,
  logoutBusiness,
  updateStudyStatus,
  updateAccountRole
} from "./api";
import type {
  BreakdownItem,
  BusinessAccount,
  BusinessAuthResponse,
  Company,
  InsightMessage,
  Study,
  Summary
} from "./types";

const SESSION_STORAGE_KEY = "datle-dashboard-session";

const asIsoStart = (value: string) => (value ? `${value}T00:00:00.000Z` : undefined);
const asIsoEnd = (value: string) => (value ? `${value}T23:59:59.999Z` : undefined);

const splitListInput = (value: string) =>
  value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);

const humanize = (value: string) =>
  value
    .replace(/^q_/, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

const BreakdownList = ({ label, items }: { label: string; items: BreakdownItem[] }) => {
  const top = items.slice(0, 6);
  const max = Math.max(...top.map((item) => item.count), 1);

  return (
    <section className="panel">
      <h3>{label}</h3>
      <div className="rows">
        {top.map((item) => (
          <div key={`${label}-${item.value}`} className="row">
            <div className="row-head">
              <span>{item.value}</span>
              <strong>{item.count}</strong>
            </div>
            <div className="bar">
              <div className="fill" style={{ width: `${(item.count / max) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

const TrendLineChart = ({ points }: { points: Array<{ date: string; count: number }> }) => {
  if (points.length === 0) {
    return <div className="chart-empty">No response trend data.</div>;
  }

  const width = 640;
  const height = 220;
  const padding = 26;
  const max = Math.max(...points.map((item) => item.count), 1);
  const stepX = points.length > 1 ? (width - padding * 2) / (points.length - 1) : 0;

  const coords = points.map((item, index) => {
    const x = padding + index * stepX;
    const y = height - padding - (item.count / max) * (height - padding * 2);
    return { x, y, ...item };
  });

  const path = coords.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${width} ${height}`} className="chart-svg" role="img" aria-label="Response trend chart">
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} className="axis-line" />
        <line x1={padding} y1={padding} x2={padding} y2={height - padding} className="axis-line" />
        <path d={path} className="line-path" />
        {coords.map((point) => (
          <g key={point.date}>
            <circle cx={point.x} cy={point.y} r="4" className="line-dot" />
            <text x={point.x} y={height - 8} textAnchor="middle" className="axis-label">
              {point.date.slice(5)}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
};

const BreakdownBarChart = ({ label, items }: { label: string; items: BreakdownItem[] }) => {
  const top = items.slice(0, 6);
  if (top.length === 0) {
    return null;
  }

  const width = 640;
  const height = 250;
  const padding = 36;
  const max = Math.max(...top.map((item) => item.count), 1);
  const barSlot = (width - padding * 2) / top.length;
  const barWidth = Math.min(56, barSlot * 0.65);

  return (
    <section className="panel">
      <h3>{label} (Chart)</h3>
      <div className="chart-wrap">
        <svg viewBox={`0 0 ${width} ${height}`} className="chart-svg" role="img" aria-label={`${label} chart`}>
          <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} className="axis-line" />
          {top.map((item, index) => {
            const barHeight = (item.count / max) * (height - padding * 2);
            const x = padding + index * barSlot + (barSlot - barWidth) / 2;
            const y = height - padding - barHeight;
            return (
              <g key={`${label}-${item.value}`}>
                <rect x={x} y={y} width={barWidth} height={barHeight} rx="6" className="bar-rect" />
                <text x={x + barWidth / 2} y={y - 6} textAnchor="middle" className="axis-label">
                  {item.count}
                </text>
                <text x={x + barWidth / 2} y={height - 12} textAnchor="middle" className="axis-label">
                  {item.value.length > 10 ? `${item.value.slice(0, 10)}...` : item.value}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </section>
  );
};

type BuilderQuestion = {
  id: string;
  prompt: string;
  type: "single_select" | "multi_select" | "long_text";
  required: boolean;
  options: string;
};

type BuilderSection = {
  id: string;
  title: string;
  description: string;
  questions: BuilderQuestion[];
};

type BuilderQuota = {
  id: string;
  label: string;
  gender: string;
  location: string;
  incomeBand: string;
  minAge: string;
  maxAge: string;
  targetCount: string;
};

const createQuestion = (): BuilderQuestion => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  prompt: "",
  type: "single_select",
  required: true,
  options: ""
});

const createSection = (): BuilderSection => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  title: "",
  description: "",
  questions: [createQuestion()]
});

const createQuota = (): BuilderQuota => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  label: "",
  gender: "",
  location: "",
  incomeBand: "",
  minAge: "",
  maxAge: "",
  targetCount: ""
});

type StoredSession = Pick<BusinessAuthResponse, "token"> & {
  account: BusinessAuthResponse["account"];
};

const readStoredSession = (): StoredSession | null => {
  try {
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as StoredSession;
    if (!parsed.token || !parsed.account?.email) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
};

const writeStoredSession = (session: StoredSession | null) => {
  if (!session) {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
};

function App() {
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [signupCompanyName, setSignupCompanyName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPhoneNumber, setSignupPhoneNumber] = useState("");
  const [signupOtpChannel, setSignupOtpChannel] = useState<"email" | "phone">("email");
  const [signupIdNumber, setSignupIdNumber] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupOtp, setSignupOtp] = useState("");
  const [otpRequested, setOtpRequested] = useState(false);
  const [testOtpHint, setTestOtpHint] = useState("");
  const [token, setToken] = useState("");
  const [account, setAccount] = useState<BusinessAuthResponse["account"] | null>(null);
  const [studies, setStudies] = useState<Study[]>([]);
  const [studyId, setStudyId] = useState("");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [insightHistory, setInsightHistory] = useState<InsightMessage[]>([]);
  const [aiQuestion, setAiQuestion] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [insightModel, setInsightModel] = useState("");
  const [insightGeneratedAt, setInsightGeneratedAt] = useState("");
  const [accounts, setAccounts] = useState<BusinessAccount[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [dimensionFilters, setDimensionFilters] = useState<Record<string, string>>({});
  const [studyTitle, setStudyTitle] = useState("");
  const [studyObjective, setStudyObjective] = useState("");
  const [studyCategory, setStudyCategory] = useState("consumer products");
  const [studyDecisionFocus, setStudyDecisionFocus] = useState("");
  const [studyMethodology, setStudyMethodology] = useState("survey");
  const [studyAudienceLocations, setStudyAudienceLocations] = useState("");
  const [studyAudienceAgeMin, setStudyAudienceAgeMin] = useState("18");
  const [studyAudienceAgeMax, setStudyAudienceAgeMax] = useState("45");
  const [studyIncomeBands, setStudyIncomeBands] = useState("");
  const [studySampleTarget, setStudySampleTarget] = useState("150");
  const [studyIncentivePlan, setStudyIncentivePlan] = useState("");
  const [studyLaunchNotes, setStudyLaunchNotes] = useState("");
  const [studyQuotas, setStudyQuotas] = useState<BuilderQuota[]>([]);
  const [studySections, setStudySections] = useState<BuilderSection[]>([
    {
      ...createSection(),
      title: "Section 1: Profile and Usage",
      description: "Start with screening and baseline behaviour questions."
    }
  ]);
  const [studyStatus, setStudyStatus] = useState<Study["status"]>("DRAFT");
  const [studyStartDate, setStudyStartDate] = useState("");
  const [studyEndDate, setStudyEndDate] = useState("");
  const [companyName, setCompanyName] = useState("");

  const loadOwnedStudies = async (authToken: string) => {
    const list = await fetchOwnedStudies(authToken);
    setStudies(list);
    setStudyId((current) => {
      if (current && list.some((study) => study.id === current)) {
        return current;
      }
      return list[0]?.id || "";
    });
  };

  const loadAccounts = async (authToken: string, role?: string) => {
    if (role !== "ADMIN") {
      setAccounts([]);
      setCompanies([]);
      return;
    }

    const [accountsList, companiesList] = await Promise.all([fetchAccounts(authToken), fetchCompanies(authToken)]);
    setAccounts(accountsList);
    setCompanies(companiesList);
  };

  useEffect(() => {
    const restore = async () => {
      const stored = readStoredSession();
      if (!stored) {
        setBootstrapping(false);
        return;
      }

      if (!["BUSINESS", "ADMIN"].includes(stored.account.role || "")) {
        writeStoredSession(null);
        setBootstrapping(false);
        return;
      }

      setToken(stored.token);
      setAccount(stored.account);

      try {
        await loadOwnedStudies(stored.token);
        await loadAccounts(stored.token, stored.account.role);
      } catch (err) {
        writeStoredSession(null);
        setToken("");
        setAccount(null);
        setError(err instanceof Error ? err.message : "Failed to restore dashboard session");
      } finally {
        setBootstrapping(false);
      }
    };

    restore();
  }, []);

  useEffect(() => {
    setDimensionFilters({});
    setFrom("");
    setTo("");
    setInsightHistory([]);
    setAiQuestion("");
    setInsightModel("");
    setInsightGeneratedAt("");
  }, [studyId]);

  useEffect(() => {
    if (!token || !studyId) {
      setSummary(null);
      return;
    }

    const loadSummary = async () => {
      setLoading(true);
      setError("");
      try {
        const payload = await fetchSummary(token, studyId, {
          from: asIsoStart(from),
          to: asIsoEnd(to),
          ...dimensionFilters
        });
        setSummary(payload);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load analytics summary");
      } finally {
        setLoading(false);
      }
    };

    loadSummary();
  }, [token, studyId, from, to, dimensionFilters]);

  const respondentFields = useMemo(() => {
    if (!summary) return [];

    const map = summary.respondent_breakdowns;
    return ([
      { key: "gender", label: "Gender", options: map.gender },
      { key: "location", label: "Location", options: map.location },
      { key: "income_band", label: "Income Band", options: map.income_band },
      { key: "education", label: "Education", options: map.education },
      { key: "employment_status", label: "Employment Status", options: map.employment_status },
      { key: "age", label: "Age", options: map.age }
    ] as const).filter((item) => item.options.length > 0);
  }, [summary]);

  const questionFields = useMemo(() => {
    if (!summary) return [];
    return summary.question_stats
      .filter((item) => item.top_values.length > 0)
      .map((item) => ({
        key: `q_${item.question}`,
        label: humanize(item.question),
        options: item.top_values
      }));
  }, [summary]);

  const chartBreakdowns = respondentFields.slice(0, 2);
  const selectedStudyRecord = studies.find((study) => study.id === studyId) || null;

  const setFilter = (key: string, value: string) => {
    setDimensionFilters((prev) => {
      const next = { ...prev };
      if (!value) {
        delete next[key];
      } else {
        next[key] = value;
      }
      return next;
    });
  };

  const updateSection = (sectionId: string, patch: Partial<BuilderSection>) => {
    setStudySections((current) =>
      current.map((section) => (section.id === sectionId ? { ...section, ...patch } : section))
    );
  };

  const addSection = () => {
    setStudySections((current) => [...current, createSection()]);
  };

  const removeSection = (sectionId: string) => {
    setStudySections((current) => (current.length === 1 ? current : current.filter((section) => section.id !== sectionId)));
  };

  const addQuestion = (sectionId: string) => {
    setStudySections((current) =>
      current.map((section) =>
        section.id === sectionId ? { ...section, questions: [...section.questions, createQuestion()] } : section
      )
    );
  };

  const updateQuestion = (sectionId: string, questionId: string, patch: Partial<BuilderQuestion>) => {
    setStudySections((current) =>
      current.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              questions: section.questions.map((question) =>
                question.id === questionId ? { ...question, ...patch } : question
              )
            }
          : section
      )
    );
  };

  const removeQuestion = (sectionId: string, questionId: string) => {
    setStudySections((current) =>
      current.map((section) => {
        if (section.id !== sectionId || section.questions.length === 1) {
          return section;
        }

        return {
          ...section,
          questions: section.questions.filter((question) => question.id !== questionId)
        };
      })
    );
  };

  const addQuota = () => {
    setStudyQuotas((current) => [...current, createQuota()]);
  };

  const updateQuota = (quotaId: string, patch: Partial<BuilderQuota>) => {
    setStudyQuotas((current) => current.map((quota) => (quota.id === quotaId ? { ...quota, ...patch } : quota)));
  };

  const removeQuota = (quotaId: string) => {
    setStudyQuotas((current) => current.filter((quota) => quota.id !== quotaId));
  };

  const buildStudyPayload = () => {
    const sections = studySections
      .map((section) => ({
        title: section.title.trim(),
        description: section.description.trim(),
        questions: section.questions
          .map((question) => ({
            prompt: question.prompt.trim(),
            type: question.type,
            required: question.required,
            options:
              question.type === "long_text"
                ? []
                : question.options
                    .split("\n")
                    .map((item) => item.trim())
                    .filter(Boolean)
          }))
          .filter((question) => question.prompt)
      }))
      .filter((section) => section.title && section.questions.length > 0);

    const locations = splitListInput(studyAudienceLocations);

    const incomeBands = splitListInput(studyIncomeBands);

    const quotas = studyQuotas
      .map((quota) => ({
        id: quota.id,
        label: quota.label.trim(),
        gender: quota.gender.trim() || undefined,
        location: quota.location.trim() || undefined,
        income_band: quota.incomeBand.trim() || undefined,
        min_age: quota.minAge ? Number(quota.minAge) : undefined,
        max_age: quota.maxAge ? Number(quota.maxAge) : undefined,
        target_count: quota.targetCount ? Number(quota.targetCount) : undefined
      }))
      .filter((quota) => quota.target_count && quota.target_count > 0);

    return {
      study_brief: {
        objective: studyObjective.trim(),
        decision_focus: studyDecisionFocus.trim(),
        category: studyCategory.trim(),
        methodology: studyMethodology.trim(),
        launch_notes: studyLaunchNotes.trim()
      },
      audience: {
        locations,
        age_range: {
          min: Number(studyAudienceAgeMin) || null,
          max: Number(studyAudienceAgeMax) || null
        },
        income_bands: incomeBands
      },
      sample_plan: {
        target_responses: Number(studySampleTarget) || null,
        incentive_plan: studyIncentivePlan.trim()
      },
      quotas,
      survey_structure: sections,
      builder_version: "guided-v1"
    };
  };

  const handleLogin = async () => {
    setError("");
    setSuccess("");
    if (!identifier.trim() || !password.trim()) {
      setError("Enter your business email or KRA PIN and password.");
      return;
    }

    try {
      setLoading(true);
      const result = await loginBusiness({
        identifier: identifier.trim(),
        password
      });

      if (!["BUSINESS", "ADMIN"].includes(result.account.role || "")) {
        throw new Error("This account does not have business dashboard access yet.");
      }

      setToken(result.token);
      setAccount(result.account);
      writeStoredSession({ token: result.token, account: result.account });
      await loadOwnedStudies(result.token);
      await loadAccounts(result.token, result.account.role);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to login");
    } finally {
      setLoading(false);
    }
  };

  const handleRequestOtp = async () => {
    setError("");
    setSuccess("");
    const normalizedEmail = signupEmail.trim().toLowerCase();
    const normalizedPhone = signupPhoneNumber.trim();

    if (signupOtpChannel === "email") {
      if (!normalizedEmail) {
        setError("Enter your business email before requesting an OTP.");
        return;
      }
    } else if (!/^\+?[1-9]\d{7,14}$/.test(normalizedPhone)) {
      setError("Enter your business phone number before requesting an OTP.");
      return;
    }

    try {
      setLoading(true);
      const result = await requestOtp(
        signupOtpChannel === "email" ? { email: normalizedEmail } : { phone_number: normalizedPhone }
      );
      setOtpRequested(true);
      setTestOtpHint(result.test_otp || "");
      setSuccess(
        `OTP sent to ${
          signupOtpChannel === "email" ? normalizedEmail : normalizedPhone
        }. It expires in ${result.expiresInMinutes} minutes.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to request OTP");
    } finally {
      setLoading(false);
    }
  };

  const handleBusinessSignup = async () => {
    setError("");
    setSuccess("");
    if (
      !signupCompanyName.trim() ||
      !signupEmail.trim() ||
      !signupIdNumber.trim() ||
      !signupPassword.trim() ||
      !signupOtp.trim()
    ) {
      setError("Complete the company, email, KRA PIN, password, and OTP fields.");
      return;
    }

    if (signupOtpChannel === "phone" && !/^\+?[1-9]\d{7,14}$/.test(signupPhoneNumber.trim())) {
      setError("Enter a valid phone number for phone OTP.");
      return;
    }

    try {
      setLoading(true);
      const result = await registerBusiness({
        company_name: signupCompanyName.trim(),
        email: signupEmail.trim(),
        phone_number: signupPhoneNumber.trim() || undefined,
        otp_channel: signupOtpChannel,
        id_number: signupIdNumber.trim(),
        password: signupPassword,
        otp: signupOtp.trim()
      });

      setToken(result.token);
      setAccount(result.account);
      writeStoredSession({ token: result.token, account: result.account });
      await loadOwnedStudies(result.token);
      await loadAccounts(result.token, result.account.role);
      setSuccess(`Business workspace created for ${result.company?.name || signupCompanyName.trim()}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create business account");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      if (token) {
        await logoutBusiness(token);
      }
    } catch {
      // Keep dashboard logout resilient.
    } finally {
      writeStoredSession(null);
      setToken("");
      setAccount(null);
      setStudies([]);
      setStudyId("");
      setSummary(null);
      setAccounts([]);
      setCompanies([]);
      setIdentifier("");
      setPassword("");
      setSignupCompanyName("");
      setSignupEmail("");
      setSignupIdNumber("");
      setSignupPassword("");
      setSignupOtp("");
      setOtpRequested(false);
      setTestOtpHint("");
      setDimensionFilters({});
      setFrom("");
      setTo("");
      setError("");
      setSuccess("");
    }
  };

  const handleCreateStudy = async () => {
    setError("");
    setSuccess("");
    if (!token) {
      return;
    }

    if (!studyTitle.trim()) {
      setError("Study title is required.");
      return;
    }

    if (!studyObjective.trim()) {
      setError("Study objective is required.");
      return;
    }

    try {
      setLoading(true);
      const targetCriteria = buildStudyPayload();

      if (targetCriteria.survey_structure.length === 0) {
        throw new Error("Add at least one section with one valid question.");
      }

      const created = await createStudy(token, {
        title: studyTitle.trim(),
        target_criteria: targetCriteria,
        status: studyStatus,
        start_date: studyStartDate ? asIsoStart(studyStartDate) : undefined,
        end_date: studyEndDate ? asIsoEnd(studyEndDate) : undefined
      });

      await loadOwnedStudies(token);
      setStudyId(created.id);
      setStudyTitle("");
      setStudyObjective("");
      setStudyCategory("consumer products");
      setStudyDecisionFocus("");
      setStudyMethodology("survey");
      setStudyAudienceLocations("");
      setStudyAudienceAgeMin("18");
      setStudyAudienceAgeMax("45");
      setStudyIncomeBands("");
      setStudySampleTarget("150");
      setStudyIncentivePlan("");
      setStudyLaunchNotes("");
      setStudyQuotas([]);
      setStudySections([
        {
          ...createSection(),
          title: "Section 1: Profile and Usage",
          description: "Start with screening and baseline behaviour questions."
        }
      ]);
      setStudyStatus("DRAFT");
      setStudyStartDate("");
      setStudyEndDate("");
      setCompanyName("");
      setSuccess("Study created successfully and added to your business workspace.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create study");
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (accountId: string, role: BusinessAccount["role"], companyId?: string) => {
    if (!token) {
      return;
    }

    try {
      setLoading(true);
      await updateAccountRole(token, accountId, role, companyId);
      await loadAccounts(token, account?.role);
      setSuccess("Account role updated.");
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update role");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCompany = async () => {
    if (!token || !companyName.trim()) {
      setError("Company name is required.");
      return;
    }

    try {
      setLoading(true);
      await createCompany(token, companyName.trim());
      await loadAccounts(token, account?.role);
      setCompanyName("");
      setSuccess("Company created successfully.");
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create company");
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (format: "json" | "csv") => {
    if (!token || !studyId) {
      return;
    }

    try {
      setError("");
      await downloadStudyExport(token, studyId, format);
      setSuccess(`Study export downloaded as ${format.toUpperCase()}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to export study data");
    }
  };

  const handleStudyStatusUpdate = async (status: Study["status"]) => {
    if (!token || !studyId) {
      return;
    }

    try {
      setStatusUpdating(true);
      setStudies((current) =>
        current.map((study) => (study.id === studyId ? { ...study, status } : study))
      );
      setSummary((current) =>
        current
          ? {
              ...current,
              study: {
                ...current.study,
                status
              }
            }
          : current
      );
      const updated = await updateStudyStatus(token, studyId, status);
      await loadOwnedStudies(token);
      setStudyId(updated.id);
      setSummary((current) =>
        current
          ? {
              ...current,
              study: {
                ...current.study,
                status: updated.status
              }
            }
          : current
      );
      setSuccess(`Study status updated to ${updated.status}.`);
      setError("");
    } catch (err) {
      await loadOwnedStudies(token);
      setError(err instanceof Error ? err.message : "Failed to update study status");
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleGenerateInsights = async (questionOverride?: string) => {
    if (!token || !studyId) {
      return;
    }

    const trimmedQuestion = (questionOverride ?? aiQuestion).trim();

    try {
      setAiLoading(true);
      setError("");
      const priorHistory = insightHistory;

      const response = await generateStudyInsights(token, studyId, {
        question: trimmedQuestion || undefined,
        history: priorHistory
      });

      setInsightHistory((current) => [
        ...current,
        ...(trimmedQuestion ? [{ role: "user" as const, content: trimmedQuestion }] : []),
        { role: "assistant", content: response.answer }
      ]);
      setInsightModel(response.model);
      setInsightGeneratedAt(response.generated_at);
      setAiQuestion("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate AI insights");
    } finally {
      setAiLoading(false);
    }
  };

  if (bootstrapping) {
    return (
      <main className="app">
        <section className="panel auth-shell">
          <p className="kicker">Loading</p>
          <h1>Restoring business dashboard...</h1>
        </section>
      </main>
    );
  }

  if (!token || !account) {
    return (
      <main className="app">
        <header className="hero auth-hero">
          <div className="brand-lockup" aria-label="DatLe">
            <span className="brand-wordmark">
              <span>Dat</span>
              <span className="brand-wordmark-accent">Le</span>
            </span>
          </div>
          <p className="kicker">DatLe Business Intelligence</p>
          <h1>{authMode === "login" ? "Access Your Business Dashboard" : "Create Your Business Workspace"}</h1>
          <p className="lede">
            {authMode === "login"
              ? "Sign in with your business or admin account to review study performance, quota progress, analytics, and exports."
              : "Create your business workspace, verify by email or phone OTP, and go straight into the dashboard with company ownership already set up."}
          </p>
        </header>

        {error && <div className="error">{error}</div>}
        {success && <div className="success">{success}</div>}

        <section className="panel auth-shell">
          <div className="auth-mode-switch">
            <button
              className={authMode === "login" ? "primary-action" : "secondary-action"}
              onClick={() => {
                setAuthMode("login");
                setError("");
                setSuccess("");
              }}
              type="button"
            >
              Login
            </button>
            <button
              className={authMode === "register" ? "primary-action" : "secondary-action"}
              onClick={() => {
                setAuthMode("register");
                setError("");
                setSuccess("");
              }}
              type="button"
            >
              Register business
            </button>
          </div>

          {authMode === "login" ? (
            <>
              <div className="field">
                <label>Email or KRA PIN</label>
                <input
                  placeholder="business@datle.com or KRA PIN"
                  value={identifier}
                  onChange={(event) => setIdentifier(event.target.value)}
                />
              </div>
              <div className="field">
                <label>Password</label>
                <input
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </div>
              <button className="primary-action" onClick={handleLogin} disabled={loading} type="button">
                {loading ? "Signing in..." : "Access dashboard"}
              </button>
              <p className="subtle-note">
                Admins use the same login form. Business accounts created here get dashboard access immediately, so there is no extra approval step for the seeded pilot flow.
              </p>
            </>
          ) : (
            <>
              <div className="field">
                <label>Company name</label>
                <input
                  placeholder="Example Consumer Insights Ltd"
                  value={signupCompanyName}
                  onChange={(event) => setSignupCompanyName(event.target.value)}
                />
              </div>
              <div className="field">
                <label>Business email</label>
                <input
                  placeholder="team@company.com"
                  value={signupEmail}
                  onChange={(event) => setSignupEmail(event.target.value)}
                />
              </div>
              <div className="field">
                <label>Phone number for OTP</label>
                <input
                  placeholder="+254712345678"
                  value={signupPhoneNumber}
                  onChange={(event) => setSignupPhoneNumber(event.target.value)}
                />
              </div>
              <div className="field">
                <label>OTP delivery</label>
                <select
                  value={signupOtpChannel}
                  onChange={(event) => setSignupOtpChannel(event.target.value as "email" | "phone")}
                >
                  <option value="email">Email OTP</option>
                  <option value="phone">Phone OTP</option>
                </select>
              </div>
              <div className="field">
                <label>KRA PIN</label>
                <input
                  placeholder="KRA PIN"
                  value={signupIdNumber}
                  onChange={(event) => setSignupIdNumber(event.target.value)}
                />
              </div>
              <div className="field">
                <label>Password</label>
                <input
                  type="password"
                  placeholder="Create a password"
                  value={signupPassword}
                  onChange={(event) => setSignupPassword(event.target.value)}
                />
              </div>
              <div className="otp-row">
                <div className="field">
                  <label>OTP</label>
                  <input placeholder="Enter 6-digit OTP" value={signupOtp} onChange={(event) => setSignupOtp(event.target.value)} />
                </div>
                <button className="secondary-action otp-action" onClick={handleRequestOtp} disabled={loading} type="button">
                  {loading ? "Sending..." : otpRequested ? "Resend OTP" : "Request OTP"}
                </button>
              </div>
              <p className="subtle-note">
                We use the OTP to verify the {signupOtpChannel === "email" ? "email" : "phone number"} that will own the initial business workspace.
              </p>
              {testOtpHint && <p className="subtle-note">Test OTP: {testOtpHint}</p>}
              <button className="primary-action" onClick={handleBusinessSignup} disabled={loading} type="button">
                {loading ? "Creating workspace..." : "Create business workspace"}
              </button>
            </>
          )}
        </section>
      </main>
    );
  }

  return (
    <main className="app">
      <header className="hero dashboard-hero">
        <div className="hero-copy">
          <div className="brand-lockup">
            <img className="brand-logo" src="/datle-logo.png" alt="DatLe" />
          </div>
          <p className="kicker">DatLe Business Intelligence</p>
          <h1>Business Study Dashboard</h1>
          <p className="lede">This workspace shows only the studies, analytics, and exports owned by your business account or company.</p>
        </div>
        <div className="account-card">
          <strong>{account.email}</strong>
          <span>{account.role}</span>
          <span>{account.company_name || "No company assigned yet"}</span>
          <button className="secondary-action" onClick={handleLogout} type="button">
            Logout
          </button>
        </div>
      </header>

      {error && <div className="error">{error}</div>}
      {success && <div className="success">{success}</div>}

      <section className="cards">
        <article className="card">
          <span>Assigned Studies</span>
          <strong>{studies.length}</strong>
        </article>
        <article className="card">
          <span>Selected Study</span>
          <strong>{summary?.study.title || studies.find((study) => study.id === studyId)?.title || "None"}</strong>
        </article>
        <article className="card">
          <span>Study Owner</span>
          <strong>{summary?.study.created_by || account.email}</strong>
        </article>
        <article className="card">
          <span>Company</span>
          <strong>{account.company_name || "Unassigned"}</strong>
        </article>
      </section>

      <section className="grid">
        <article className="panel">
          <h3>Study Builder</h3>
          <p className="lede">Define the business question, target audience, quotas, and questionnaire structure without touching raw JSON.</p>
          <div className="rows">
            <div className="builder-grid">
              <div className="field">
                <label>Study title</label>
                <input value={studyTitle} onChange={(event) => setStudyTitle(event.target.value)} />
              </div>
              <div className="field">
                <label>Category</label>
                <input value={studyCategory} onChange={(event) => setStudyCategory(event.target.value)} />
              </div>
              <div className="field builder-span-2">
                <label>Decision objective</label>
                <textarea value={studyObjective} onChange={(event) => setStudyObjective(event.target.value)} rows={3} />
              </div>
              <div className="field builder-span-2">
                <label>Decision focus</label>
                <textarea
                  value={studyDecisionFocus}
                  onChange={(event) => setStudyDecisionFocus(event.target.value)}
                  rows={2}
                />
              </div>
              <div className="field">
                <label>Methodology</label>
                <input value={studyMethodology} onChange={(event) => setStudyMethodology(event.target.value)} />
              </div>
              <div className="field">
                <label>Status</label>
                <select value={studyStatus} onChange={(event) => setStudyStatus(event.target.value as Study["status"])}>
                  <option value="DRAFT">DRAFT</option>
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="PAUSED">PAUSED</option>
                  <option value="COMPLETED">COMPLETED</option>
                  <option value="ARCHIVED">ARCHIVED</option>
                </select>
              </div>
              <div className="field">
                <label>Start date</label>
                <input type="date" value={studyStartDate} onChange={(event) => setStudyStartDate(event.target.value)} />
              </div>
              <div className="field">
                <label>End date</label>
                <input type="date" value={studyEndDate} onChange={(event) => setStudyEndDate(event.target.value)} />
              </div>
            </div>

            <div className="builder-block">
              <h4>Audience</h4>
              <div className="builder-grid">
                <div className="field">
                  <label>Minimum age</label>
                  <input value={studyAudienceAgeMin} onChange={(event) => setStudyAudienceAgeMin(event.target.value)} />
                </div>
                <div className="field">
                  <label>Maximum age</label>
                  <input value={studyAudienceAgeMax} onChange={(event) => setStudyAudienceAgeMax(event.target.value)} />
                </div>
                <div className="field">
                  <label>Target responses</label>
                  <input value={studySampleTarget} onChange={(event) => setStudySampleTarget(event.target.value)} />
                </div>
                <div className="field builder-span-2">
                  <label>Target locations, comma-separated or one per line</label>
                  <textarea
                    value={studyAudienceLocations}
                    onChange={(event) => setStudyAudienceLocations(event.target.value)}
                    rows={4}
                  />
                </div>
                <div className="field builder-span-2">
                  <label>Income bands, comma-separated or one per line</label>
                  <textarea value={studyIncomeBands} onChange={(event) => setStudyIncomeBands(event.target.value)} rows={3} />
                </div>
              </div>
            </div>

            <div className="builder-block">
              <h4>Fieldwork Plan</h4>
              <div className="builder-grid">
                <div className="field builder-span-2">
                  <label>Incentive plan</label>
                  <textarea
                    value={studyIncentivePlan}
                    onChange={(event) => setStudyIncentivePlan(event.target.value)}
                    rows={2}
                  />
                </div>
                <div className="field builder-span-2">
                  <label>Launch notes</label>
                  <textarea value={studyLaunchNotes} onChange={(event) => setStudyLaunchNotes(event.target.value)} rows={3} />
                </div>
              </div>
            </div>

            <div className="builder-block">
              <div className="builder-header">
                <div>
                  <h4>Quota Plan</h4>
                  <p className="subtle-note">Set response caps for important audience segments. Filled quotas will stop additional matching submissions.</p>
                </div>
                <button className="secondary-action" onClick={addQuota} type="button">
                  Add quota
                </button>
              </div>

              {studyQuotas.length === 0 ? (
                <p className="subtle-note">No quotas yet. Leave this empty if you only want broad eligibility matching.</p>
              ) : (
                <div className="section-stack">
                  {studyQuotas.map((quota, index) => (
                    <div className="section-card" key={quota.id}>
                      <div className="builder-header">
                        <strong>Quota {index + 1}</strong>
                        <button className="secondary-action" onClick={() => removeQuota(quota.id)} type="button">
                          Remove quota
                        </button>
                      </div>
                      <div className="builder-grid">
                        <div className="field">
                          <label>Label</label>
                          <input value={quota.label} onChange={(event) => updateQuota(quota.id, { label: event.target.value })} />
                        </div>
                        <div className="field">
                          <label>Target count</label>
                          <input value={quota.targetCount} onChange={(event) => updateQuota(quota.id, { targetCount: event.target.value })} />
                        </div>
                        <div className="field">
                          <label>Gender</label>
                          <input value={quota.gender} onChange={(event) => updateQuota(quota.id, { gender: event.target.value })} />
                        </div>
                        <div className="field">
                          <label>Location</label>
                          <input value={quota.location} onChange={(event) => updateQuota(quota.id, { location: event.target.value })} />
                        </div>
                        <div className="field">
                          <label>Income band</label>
                          <input value={quota.incomeBand} onChange={(event) => updateQuota(quota.id, { incomeBand: event.target.value })} />
                        </div>
                        <div className="field">
                          <label>Minimum age</label>
                          <input value={quota.minAge} onChange={(event) => updateQuota(quota.id, { minAge: event.target.value })} />
                        </div>
                        <div className="field">
                          <label>Maximum age</label>
                          <input value={quota.maxAge} onChange={(event) => updateQuota(quota.id, { maxAge: event.target.value })} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="builder-block">
              <div className="builder-header">
                <div>
                  <h4>Questionnaire Builder</h4>
                  <p className="subtle-note">Add sections and questions that will be stored directly in the study structure.</p>
                </div>
                <button className="secondary-action" onClick={addSection} type="button">
                  Add section
                </button>
              </div>

              <div className="section-stack">
                {studySections.map((section, sectionIndex) => (
                  <div className="section-card" key={section.id}>
                    <div className="builder-header">
                      <strong>Section {sectionIndex + 1}</strong>
                      <button className="secondary-action" onClick={() => removeSection(section.id)} type="button">
                        Remove section
                      </button>
                    </div>
                    <div className="builder-grid">
                      <div className="field">
                        <label>Section title</label>
                        <input
                          value={section.title}
                          onChange={(event) => updateSection(section.id, { title: event.target.value })}
                        />
                      </div>
                      <div className="field builder-span-2">
                        <label>Description</label>
                        <textarea
                          value={section.description}
                          onChange={(event) => updateSection(section.id, { description: event.target.value })}
                          rows={2}
                        />
                      </div>
                    </div>

                    <div className="question-stack">
                      {section.questions.map((question, questionIndex) => (
                        <div className="question-card" key={question.id}>
                          <div className="builder-header">
                            <strong>Question {questionIndex + 1}</strong>
                            <button
                              className="secondary-action"
                              onClick={() => removeQuestion(section.id, question.id)}
                              type="button"
                            >
                              Remove question
                            </button>
                          </div>
                          <div className="builder-grid">
                            <div className="field builder-span-2">
                              <label>Prompt</label>
                              <textarea
                                value={question.prompt}
                                onChange={(event) => updateQuestion(section.id, question.id, { prompt: event.target.value })}
                                rows={2}
                              />
                            </div>
                            <div className="field">
                              <label>Type</label>
                              <select
                                value={question.type}
                                onChange={(event) =>
                                  updateQuestion(section.id, question.id, {
                                    type: event.target.value as BuilderQuestion["type"]
                                  })
                                }
                              >
                                <option value="single_select">Single select</option>
                                <option value="multi_select">Multi select</option>
                                <option value="long_text">Long text</option>
                              </select>
                            </div>
                            <div className="field">
                              <label>Required</label>
                              <select
                                value={question.required ? "yes" : "no"}
                                onChange={(event) =>
                                  updateQuestion(section.id, question.id, { required: event.target.value === "yes" })
                                }
                              >
                                <option value="yes">Yes</option>
                                <option value="no">No</option>
                              </select>
                            </div>
                            {question.type !== "long_text" && (
                              <div className="field builder-span-2">
                                <label>Answer options, one per line</label>
                                <textarea
                                  value={question.options}
                                  onChange={(event) =>
                                    updateQuestion(section.id, question.id, { options: event.target.value })
                                  }
                                  rows={4}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    <button className="secondary-action" onClick={() => addQuestion(section.id)} type="button">
                      Add question
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <button className="primary-action" onClick={handleCreateStudy} disabled={loading} type="button">
              {loading ? "Saving..." : "Create study"}
            </button>
          </div>
        </article>

        <article className="panel">
          <h3>Study Exports</h3>
          <p className="lede">Download response data for the currently selected study in either JSON or CSV.</p>
          <div className="actions-row">
            <button className="secondary-action" onClick={() => handleExport("json")} type="button">
              Download JSON
            </button>
            <button className="secondary-action" onClick={() => handleExport("csv")} type="button">
              Download CSV
            </button>
          </div>
        </article>
      </section>

      {account.role === "ADMIN" && (
        <section className="panel">
          <h3>Admin Account Access</h3>
          <div className="actions-row">
            <input
              placeholder="New company name"
              value={companyName}
              onChange={(event) => setCompanyName(event.target.value)}
            />
            <button className="primary-action" onClick={handleCreateCompany} disabled={loading} type="button">
              Create company
            </button>
          </div>
          <div className="account-list">
            {accounts.map((businessAccount) => (
              <div className="account-row" key={businessAccount.id}>
                <div>
                  <strong>{businessAccount.email}</strong>
                  <span>
                    KRA PIN: {businessAccount.id_number} | Joined {new Date(businessAccount.created_at).toLocaleDateString()}
                  </span>
                  <span>Company: {businessAccount.company_name || "Unassigned"}</span>
                </div>
                <div className="account-actions">
                  <select
                    value={businessAccount.company_id || ""}
                    onChange={(event) =>
                      handleRoleChange(
                        businessAccount.id,
                        businessAccount.role,
                        event.target.value || undefined
                      )
                    }
                  >
                    <option value="">No company</option>
                    {companies.map((company) => (
                      <option key={company.id} value={company.id}>
                        {company.name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={businessAccount.role}
                    onChange={(event) =>
                      handleRoleChange(
                        businessAccount.id,
                        event.target.value as BusinessAccount["role"],
                        businessAccount.company_id || undefined
                      )
                    }
                  >
                    <option value="USER">USER</option>
                    <option value="BUSINESS">BUSINESS</option>
                    <option value="ADMIN">ADMIN</option>
                  </select>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {studies.length === 0 ? (
        <section className="panel">
          <h3>No business studies yet</h3>
          <p className="lede">This account does not currently own any studies. Create your first study above and it will appear here automatically with analytics once responses arrive.</p>
        </section>
      ) : (
        <>
          <section className="panel filters">
            <div className="field">
              <label>Your study</label>
              <select value={studyId} onChange={(event) => setStudyId(event.target.value)}>
                {studies.map((study) => (
                  <option key={study.id} value={study.id}>
                    {study.title}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Current status</label>
              <select
                value={selectedStudyRecord?.status || ""}
                onChange={(event) => handleStudyStatusUpdate(event.target.value as Study["status"])}
                disabled={!selectedStudyRecord || loading}
              >
                <option value="DRAFT">DRAFT</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="PAUSED">PAUSED</option>
                <option value="COMPLETED">COMPLETED</option>
                <option value="ARCHIVED">ARCHIVED</option>
              </select>
            </div>
            <div className="field">
              <label>From</label>
              <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
            </div>
            <div className="field">
              <label>To</label>
              <input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
            </div>
            {[...respondentFields, ...questionFields].map((field) => (
              <div className="field" key={field.key}>
                <label>{field.label}</label>
                <select value={dimensionFilters[field.key] || ""} onChange={(event) => setFilter(field.key, event.target.value)}>
                  <option value="">All</option>
                  {field.options.map((option) => (
                    <option key={`${field.key}-${option.value}`} value={option.value}>
                      {option.value}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </section>

          {loading && <div className="panel">Loading analytics and quota progress...</div>}

          {summary && !loading && (
            <>
              <section className="cards">
                <article className="card muted-card">
                  <span>Total Responses</span>
                  <strong>{summary.metrics.total_responses}</strong>
                </article>
                <article className="card muted-card">
                  <span>Unique Respondents</span>
                  <strong>{summary.metrics.unique_respondents}</strong>
                </article>
                <article className="card muted-card">
                  <span>Study Status</span>
                  <strong>{summary.study.status}</strong>
                </article>
              </section>

              <section className="panel">
                <h3>Response Trend</h3>
                <TrendLineChart points={summary.trends.responses_by_day} />
                <div className="rows">
                  {summary.trends.responses_by_day.map((point) => (
                    <div key={point.date} className="row">
                      <div className="row-head">
                        <span>{point.date}</span>
                        <strong>{point.count}</strong>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {summary.quota_progress.length > 0 && (
                <section className="panel">
                  <h3>Quota Progress</h3>
                  <div className="rows">
                    {summary.quota_progress.map((quota) => (
                      <div key={quota.id} className="row">
                        <div className="row-head">
                          <span>{quota.label}</span>
                          <strong>
                            {quota.current_count}/{quota.target_count}
                          </strong>
                        </div>
                        <div className="bar">
                          <div
                            className="fill"
                            style={{ width: `${Math.min((quota.current_count / quota.target_count) * 100, 100)}%` }}
                          />
                        </div>
                        <p className="subtle-note">
                          {quota.filled ? "Filled" : `${quota.remaining} remaining`}
                        </p>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {chartBreakdowns.length > 0 && (
                <section className="grid">
                  {chartBreakdowns.map((item) => (
                    <BreakdownBarChart key={item.key} label={item.label} items={item.options} />
                  ))}
                </section>
              )}

              {respondentFields.length > 0 && (
                <section className="grid">
                  {respondentFields.map((item) => (
                    <BreakdownList key={item.key} label={item.label} items={item.options} />
                  ))}
                </section>
              )}

              <section className="panel">
                <h3>Question Signals</h3>
                <div className="rows">
                  {summary.question_stats.map((question) => (
                    <div key={question.question} className="question">
                      <div className="row-head">
                        <span>{humanize(question.question)}</span>
                        <strong>{question.total_answered}</strong>
                      </div>
                      <p>
                        {question.top_values
                          .slice(0, 3)
                          .map((item) => `${item.value} (${item.count})`)
                          .join("  |  ")}
                      </p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="panel">
                <div className="builder-header">
                  <div>
                    <h3>AI Insight Analyst</h3>
                    <p className="lede">
                      Generate decision-ready findings from the selected study and ask follow-up questions in plain language.
                    </p>
                  </div>
                  <button className="primary-action" onClick={() => handleGenerateInsights()} disabled={aiLoading} type="button">
                    {aiLoading ? "Generating..." : "Generate insight brief"}
                  </button>
                </div>

                <div className="field builder-span-2">
                  <label>Ask a follow-up question</label>
                  <textarea
                    value={aiQuestion}
                    onChange={(event) => setAiQuestion(event.target.value)}
                    rows={3}
                    placeholder="Example: Which segments look most price sensitive, and what should we do next?"
                  />
                </div>
                <div className="actions-row">
                  <button
                    className="secondary-action"
                    onClick={() => handleGenerateInsights(aiQuestion)}
                    disabled={aiLoading || !aiQuestion.trim()}
                    type="button"
                  >
                    {aiLoading ? "Thinking..." : "Ask AI"}
                  </button>
                </div>

                {insightModel && (
                  <p className="subtle-note">
                    Generated by {insightModel}
                    {insightGeneratedAt ? ` on ${new Date(insightGeneratedAt).toLocaleString()}` : ""}
                  </p>
                )}

                {insightHistory.length === 0 ? (
                  <p className="subtle-note">
                    Start with a one-click brief, then ask follow-up questions about segments, patterns, and next actions.
                  </p>
                ) : (
                  <div className="rows">
                    {insightHistory.map((message, index) => (
                      <div key={`${message.role}-${index}`} className={`question ${message.role === "assistant" ? "insight-answer" : ""}`}>
                        <div className="row-head">
                          <span>{message.role === "assistant" ? "DatLe AI" : "You"}</span>
                        </div>
                        <p style={{ whiteSpace: "pre-wrap" }}>{message.content}</p>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </>
      )}
    </main>
  );
}

export default App;
