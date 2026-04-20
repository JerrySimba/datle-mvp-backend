import { useEffect, useMemo, useState } from "react";
import {
  createRespondent,
  fetchEligibleStudies,
  fetchStudyFeed,
  fetchMyActivity,
  fetchMyRespondent,
  fetchStudies,
  loginAccount,
  logoutAccount,
  registerAccount,
  requestOtp,
  submitResponse
} from "./api";
import { questionConfig } from "./studyConfig";
import type { AccountActivity, ResponsePayload, Study, StudyFeed, SurveyQuestion, SurveySection } from "./types";

type Step = 1 | 2;
type AnswerValue = string | string[];
type Route = "/" | "/account";

type StoredSession = {
  token: string;
  email: string;
  idNumber: string;
  accountRole: string;
};

const SESSION_STORAGE_KEY = "datle-respondent-session";

const fallbackSurveySections: SurveySection[] = [
  {
    section_number: 1,
    section_title: "General Product Study",
    questions: questionConfig.map((question) => ({
      key: question.key,
      prompt: question.label,
      type: question.type === "select" ? "single_select" : "number",
      options: question.type === "select" ? [...question.options] : undefined,
      min: question.type === "number" ? question.min : undefined,
      max: question.type === "number" ? question.max : undefined,
      required: true
    }))
  }
];

const isMultiSelect = (question: SurveyQuestion) =>
  question.type === "multi_select" || question.type === "multi_select_max_3";

const maxSelections = (question: SurveyQuestion) => (question.type === "multi_select_max_3" ? 3 : undefined);

const humanizeValue = (value: string) =>
  value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

const getRoute = (): Route => (window.location.pathname === "/account" ? "/account" : "/");

const pushRoute = (route: Route) => {
  if (window.location.pathname !== route) {
    window.history.pushState({}, "", route);
  }
};

const readStoredSession = (): StoredSession | null => {
  try {
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<StoredSession>;
    if (!parsed.token || !parsed.email || !parsed.idNumber) {
      return null;
    }

    return {
      token: parsed.token,
      email: parsed.email,
      idNumber: parsed.idNumber,
      accountRole: parsed.accountRole || ""
    };
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
  const [route, setRoute] = useState<Route>(getRoute());
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [loadingActivity, setLoadingActivity] = useState(false);
  const [error, setError] = useState("");
  const [bootstrappingSession, setBootstrappingSession] = useState(true);

  const [authMode, setAuthMode] = useState<"register" | "login">("register");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [otpChannel, setOtpChannel] = useState<"email" | "phone">("email");
  const [idNumber, setIdNumber] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [testOtpHint, setTestOtpHint] = useState("");

  const [token, setToken] = useState("");
  const [accountRole, setAccountRole] = useState("");
  const [hasExistingProfile, setHasExistingProfile] = useState(false);
  const [respondentId, setRespondentId] = useState("");
  const [activity, setActivity] = useState<AccountActivity | null>(null);

  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [location, setLocation] = useState("");
  const [incomeBand, setIncomeBand] = useState("");
  const [education, setEducation] = useState("");
  const [employmentStatus, setEmploymentStatus] = useState("");

  const [studies, setStudies] = useState<Study[]>([]);
  const [studyFeed, setStudyFeed] = useState<StudyFeed>({ available: [], completed: [], unavailable: [] });
  const [selectedStudyId, setSelectedStudyId] = useState("");
  const [activeStudyId, setActiveStudyId] = useState("");
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const onPopState = () => setRoute(getRoute());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    const loadStudies = async () => {
      try {
        const list = await fetchStudies();
        setStudies(list);
        const preferred = list.find((item) => item.status === "ACTIVE") || list[0];
        if (preferred) {
          setSelectedStudyId(preferred.id);
        }
      } catch {
        // Leave homepage usable while studies load later.
      }
    };

    loadStudies();
  }, []);

  const loadEligibleStudies = async (authToken: string) => {
    const [result, feed] = await Promise.all([fetchEligibleStudies(authToken), fetchStudyFeed(authToken)]);
    setStudies(result.studies);
    setStudyFeed(feed);
    const preferred = feed.available[0];
    setSelectedStudyId(preferred?.id || "");
    setActiveStudyId((current) => (current && feed.available.some((study) => study.id === current) ? current : ""));
  };

  const hydrateProfile = (profile: AccountActivity["respondent"]) => {
    if (!profile) {
      setHasExistingProfile(false);
      setRespondentId("");
      setAge("");
      setGender("");
      setLocation("");
      setIncomeBand("");
      setEducation("");
      setEmploymentStatus("");
      return;
    }

    setRespondentId(profile.id);
    setAge(profile.age.toString());
    setGender(profile.gender);
    setLocation(profile.location);
    setIncomeBand(profile.income_band);
    setEducation(profile.education);
    setEmploymentStatus(profile.employment_status);
    setHasExistingProfile(true);
    setStep(2);
  };

  const resetSessionState = () => {
    setToken("");
    setAccountRole("");
    setRespondentId("");
    setActivity(null);
    setHasExistingProfile(false);
    setAge("");
    setGender("");
    setLocation("");
    setIncomeBand("");
    setEducation("");
    setEmploymentStatus("");
    setAnswers({});
    setSubmitted(false);
    setStudyFeed({ available: [], completed: [], unavailable: [] });
    setActiveStudyId("");
    setStep(1);
    setOtpSent(false);
    setOtpCode("");
    setPhoneNumber("");
    setOtpChannel("email");
    setPassword("");
    setConfirmPassword("");
    setTestOtpHint("");
  };

  const goHome = () => {
    pushRoute("/");
    setRoute("/");
  };

  const goAccount = () => {
    pushRoute("/account");
    setRoute("/account");
  };

  const loadAccountActivity = async (authToken: string) => {
    try {
      setLoadingActivity(true);
      const result = await fetchMyActivity(authToken);
      setActivity(result);
      hydrateProfile(result.respondent);
    } finally {
      setLoadingActivity(false);
    }
  };

  useEffect(() => {
    const restoreSession = async () => {
      const stored = readStoredSession();
      if (!stored) {
        setBootstrappingSession(false);
        return;
      }

      setToken(stored.token);
      setEmail(stored.email);
      setIdNumber(stored.idNumber);
      setAccountRole(stored.accountRole);

      try {
        const profile = await fetchMyRespondent(stored.token);
        if (profile.respondent) {
          hydrateProfile(profile.respondent);
          await loadEligibleStudies(stored.token);
        } else {
          setHasExistingProfile(false);
          setStep(2);
        }
        await loadAccountActivity(stored.token);
      } catch {
        writeStoredSession(null);
        resetSessionState();
        goHome();
      } finally {
        setBootstrappingSession(false);
      }
    };

    restoreSession();
  }, []);

  const studyOptions = useMemo(() => {
    const active = studyFeed.available.filter((item) => item.status === "ACTIVE");
    return active.length > 0 ? active : studyFeed.available;
  }, [studyFeed]);

  const selectedStudy = useMemo(
    () => studyOptions.find((study) => study.id === (activeStudyId || selectedStudyId)),
    [activeStudyId, selectedStudyId, studyOptions]
  );

  const surveySections = useMemo(() => {
    const dynamicSections = selectedStudy?.targetCriteria?.survey_structure;
    if (Array.isArray(dynamicSections) && dynamicSections.length > 0) {
      return dynamicSections;
    }

    return fallbackSurveySections;
  }, [selectedStudy]);

  const surveyQuestions = useMemo(() => surveySections.flatMap((section) => section.questions), [surveySections]);

  useEffect(() => {
    setAnswers({});
    setSubmitted(false);
  }, [activeStudyId, selectedStudyId]);

  const onSendOtp = async () => {
    setError("");
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPhone = phoneNumber.trim();

    if (otpChannel === "email") {
      if (!normalizedEmail.includes("@")) {
        setError("Enter a valid email before requesting OTP.");
        return;
      }
    } else if (!/^\+?[1-9]\d{7,14}$/.test(normalizedPhone)) {
      setError("Enter a valid phone number before requesting OTP.");
      return;
    }

    try {
      setLoading(true);
      const result = await requestOtp(
        otpChannel === "email" ? { email: normalizedEmail } : { phone_number: normalizedPhone }
      );
      setOtpSent(true);
      setTestOtpHint(result.test_otp || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to request OTP");
    } finally {
      setLoading(false);
    }
  };

  const onAuthenticate = async () => {
    setError("");
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedId = idNumber.trim().toUpperCase();

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (authMode === "register") {
      if (!normalizedEmail.includes("@")) {
        setError("Enter a valid email.");
        return;
      }

      if (otpChannel === "phone" && !/^\+?[1-9]\d{7,14}$/.test(phoneNumber.trim())) {
        setError("Enter a valid phone number.");
        return;
      }

      if (normalizedId.length < 4) {
        setError("Enter a valid ID number.");
        return;
      }
    } else if (!normalizedEmail.includes("@") && normalizedId.length < 4) {
      setError("Enter either your email or your ID number.");
      return;
    }

    if (authMode === "register" && !/^\d{6}$/.test(otpCode)) {
      setError("OTP must be exactly 6 digits.");
      return;
    }

    if (authMode === "register" && password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      setLoading(true);
      const result =
        authMode === "register"
          ? await registerAccount({
              email: normalizedEmail,
              phone_number: phoneNumber.trim() || undefined,
              otp_channel: otpChannel,
              id_number: normalizedId,
              password,
              otp: otpCode
            })
          : await loginAccount({
              identifier: normalizedId || normalizedEmail,
              password
            });

      const session: StoredSession = {
        token: result.token,
        email: result.account.email,
        idNumber: result.account.id_number,
        accountRole: result.account.role || ""
      };

      setToken(session.token);
      setEmail(session.email);
      setIdNumber(session.idNumber);
      setAccountRole(session.accountRole);
      writeStoredSession(session);

      const profile = await fetchMyRespondent(result.token);
      if (profile.respondent) {
        hydrateProfile(profile.respondent);
        await loadEligibleStudies(result.token);
      } else {
        setHasExistingProfile(false);
        setStep(2);
      }

      await loadAccountActivity(result.token);
      goAccount();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to authenticate account");
    } finally {
      setLoading(false);
    }
  };
  const onLogout = async () => {
    try {
      if (token) {
        await logoutAccount(token);
      }
    } catch {
      // Keep client logout resilient even if backend logout fails.
    } finally {
      writeStoredSession(null);
      resetSessionState();
      setEmail("");
      setIdNumber("");
      setError("");
      goHome();
    }
  };

  const onCreateProfile = async () => {
    setError("");
    if (!age || !gender || !location || !incomeBand || !education || !employmentStatus) {
      setError("Complete all profile fields.");
      return;
    }

    const ageValue = Number(age);
    if (Number.isNaN(ageValue) || ageValue < 13 || ageValue > 120) {
      setError("Age must be between 13 and 120.");
      return;
    }

    if (!token) {
      setError("Session expired. Login again.");
      writeStoredSession(null);
      resetSessionState();
      goHome();
      return;
    }

    try {
      setLoading(true);
      const id = await createRespondent(token, {
        email: email.trim().toLowerCase(),
        age: ageValue,
        gender,
        location,
        income_band: incomeBand,
        education,
        employment_status: employmentStatus
      });
      setRespondentId(id);
      setHasExistingProfile(true);
      await loadEligibleStudies(token);
      await loadAccountActivity(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save profile");
    } finally {
      setLoading(false);
    }
  };

  const onSubmitStudy = async () => {
    setError("");
    const studyId = activeStudyId || selectedStudyId;
    if (!studyId) {
      setError("No study is currently available.");
      return;
    }

    if (!respondentId || !token) {
      setError("Session invalid. Login again.");
      writeStoredSession(null);
      resetSessionState();
      goHome();
      return;
    }

    const missing = surveyQuestions.find((question) => {
      if (question.required === false) {
        return false;
      }

      const value = answers[question.key];
      if (Array.isArray(value)) {
        return value.length === 0;
      }

      return !value;
    });

    if (missing) {
      setError(`Answer required: ${missing.prompt}`);
      return;
    }

    const payload: ResponsePayload = {};
    surveyQuestions.forEach((question) => {
      const value = answers[question.key];
      if (value === undefined) {
        return;
      }

      payload[question.key] = question.type === "number" && !Array.isArray(value) ? Number(value) : value;
    });

    try {
      setLoading(true);
      await submitResponse(token, {
        respondent_id: respondentId,
        study_id: studyId,
        payload
      });
      setSubmitted(true);
      await loadEligibleStudies(token);
      await loadAccountActivity(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit response");
    } finally {
      setLoading(false);
    }
  };

  if (bootstrappingSession) {
    return (
      <main className="page">
        <section className="join-card shell-state">
          <p className="kicker">Loading</p>
          <h2>Restoring your account session...</h2>
        </section>
      </main>
    );
  }

  const renderHomePage = () => (
    <>
      <section className="hero">
        <div className="hero-copy">
          <h1>
            Share Your <span>Voice</span>
            <br />
            Get <strong>Paid</strong> for It
          </h1>
          <p>
            DatLe connects verified respondents to high-quality product studies. Create your account first, complete
            your profile once, then manage surveys from your personal dashboard.
          </p>
          <div className="hero-actions">
            <a href="#join" className="btn primary">
              Create Account
            </a>
            <a href="#how" className="btn secondary">
              How It Works
            </a>
          </div>
          <div className="stats">
            <div>
              <h3>1,000+</h3>
              <p>Verified Respondents</p>
            </div>
            <div>
              <h3>200+</h3>
              <p>Studies Run</p>
            </div>
            <div>
              <h3>4 min</h3>
              <p>Avg Completion</p>
            </div>
          </div>
        </div>
        <div className="hero-card">
          <p className="pill">Trusted panel for structured consumer intelligence</p>
          <div className="card-body">
            <h4>DatLe Panel Promise</h4>
            <ul>
              <li>Verified participation</li>
              <li>Fast study completion</li>
              <li>Reward-aligned responses</li>
            </ul>
          </div>
        </div>
      </section>

      <section id="how" className="how">
        <h2>
          Simple Steps To
          <br />
          <span>Help Make Better Customer-Driven Decisions</span>
        </h2>
        <p className="how-copy">
          DatLe connects verified respondents and businesses through structured studies designed for reliable product
          and market decisions.
        </p>
        <div className="audience-switch" aria-hidden="true">
          <button className="audience-btn active">For Respondents</button>
          <button className="audience-btn">For Businesses</button>
        </div>
        <div className="steps">
          <article>
            <h4>1. Create an account</h4>
            <p>Register with email, ID number, password, and OTP verification.</p>
          </article>
          <article>
            <h4>2. Complete your profile once</h4>
            <p>Store profile details once so we can match you to better studies over time.</p>
          </article>
          <article>
            <h4>3. Access your dashboard</h4>
            <p>Browse surveys, review activity, and complete studies from your separate account page.</p>
          </article>
        </div>
      </section>

      <section id="join" className="join-card">
        <header>
          <p className="kicker">Respondent Onboarding</p>
          <h2>Step {step} of 2</h2>
          <p className="muted">
            {step === 1
              ? "Create your account or sign in to continue."
              : "Save your profile once so we can match you to the right studies."}
          </p>
          <div className="progress">
            <div className="progress-fill" style={{ width: `${(step / 2) * 100}%` }} />
          </div>
        </header>

        {error && <p className="error">{error}</p>}

        {step === 1 && (
          <section className="step">
            <h3>{authMode === "register" ? "Create your account" : "Sign in to your account"}</h3>
            <p className="muted">
              {authMode === "register"
                ? "Use your email, ID number, password, and a one-time code delivered by email or phone to create a verified respondent account."
                : "Sign in with either your email or your ID number."}
            </p>
            <div className="audience-switch" aria-hidden="true">
              <button
                className={`audience-btn ${authMode === "register" ? "active" : ""}`}
                onClick={() => setAuthMode("register")}
                type="button"
              >
                Register
              </button>
              <button
                className={`audience-btn ${authMode === "login" ? "active" : ""}`}
                onClick={() => setAuthMode("login")}
                type="button"
              >
                Login
              </button>
            </div>
            <input
              type="email"
              placeholder={authMode === "register" ? "you@example.com" : "Email (optional if using ID number)"}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <input
              type="text"
              placeholder={authMode === "register" ? "ID number (e.g. 12345678)" : "ID number (optional if using email)"}
              value={idNumber}
              onChange={(event) => setIdNumber(event.target.value)}
            />
            {authMode === "register" && (
              <>
                <select value={otpChannel} onChange={(event) => setOtpChannel(event.target.value as "email" | "phone")}>
                  <option value="email">Receive OTP by email</option>
                  <option value="phone">Receive OTP by phone</option>
                </select>
                <input
                  type="tel"
                  placeholder="Phone number for OTP (e.g. +254712345678)"
                  value={phoneNumber}
                  onChange={(event) => setPhoneNumber(event.target.value)}
                />
              </>
            )}
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            {authMode === "register" && (
              <>
                <button
                  onClick={onSendOtp}
                  disabled={loading || (otpChannel === "email" ? !email.trim() : !phoneNumber.trim())}
                  type="button"
                >
                  {loading ? "Sending OTP..." : otpSent ? "Resend OTP" : "Send OTP"}
                </button>
                <input
                  type="text"
                  placeholder="Enter 6-digit OTP"
                  value={otpCode}
                  onChange={(event) => setOtpCode(event.target.value)}
                />
                <p className="muted">
                  We will verify your {otpChannel === "email" ? "email" : "phone number"} before the account is created.
                </p>
                {testOtpHint && <p className="muted">Test OTP: {testOtpHint}</p>}
              </>
            )}
            {authMode === "register" && (
              <input
                type="password"
                placeholder="Confirm password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
            )}
            <button onClick={onAuthenticate} disabled={loading} type="button">
              {loading ? "Submitting..." : authMode === "register" ? "Create account" : "Sign in"}
            </button>
          </section>
        )}

        {step === 2 && token && !hasExistingProfile && (
          <section className="step">
            <h3>Profile capture</h3>
            <p className="muted">We only ask this once. When you save it, your separate account dashboard opens.</p>
            <input type="number" placeholder="Age" value={age} onChange={(event) => setAge(event.target.value)} />
            <select value={gender} onChange={(event) => setGender(event.target.value)}>
              <option value="">Select gender</option>
              <option value="female">female</option>
              <option value="male">male</option>
            </select>
            <input
              type="text"
              placeholder="Location (e.g. Nairobi)"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
            />
            <select value={incomeBand} onChange={(event) => setIncomeBand(event.target.value)}>
              <option value="">Income band</option>
              <option value="25k-50k">25k-50k</option>
              <option value="50k-75k">50k-75k</option>
              <option value="75k-100k">75k-100k</option>
              <option value="100k-150k">100k-150k</option>
            </select>
            <select value={education} onChange={(event) => setEducation(event.target.value)}>
              <option value="">Education</option>
              <option value="high_school">high_school</option>
              <option value="bachelors">bachelors</option>
              <option value="masters">masters</option>
              <option value="phd">phd</option>
            </select>
            <select value={employmentStatus} onChange={(event) => setEmploymentStatus(event.target.value)}>
              <option value="">Employment status</option>
              <option value="full_time">full_time</option>
              <option value="part_time">part_time</option>
              <option value="self_employed">self_employed</option>
              <option value="unemployed">unemployed</option>
            </select>
            <button onClick={onCreateProfile} disabled={loading} type="button">
              {loading ? "Saving..." : "Save profile"}
            </button>
          </section>
        )}
      </section>
    </>
  );
  const renderSurveyWorkspace = () => {
    if (!activeStudyId || !selectedStudy) {
      return (
        <article className="dashboard-panel survey-workspace">
          <p className="muted">Choose a survey from the dashboard to start responding.</p>
        </article>
      );
    }

    return (
      <article className="dashboard-panel survey-workspace">
        <div className="panel-header">
          <div>
            <p className="kicker">Survey Workspace</p>
            <h3>{selectedStudy.title}</h3>
            <p className="muted">{selectedStudy.availability?.reason || "This study is ready for your response."}</p>
          </div>
          <span className="status-chip">{selectedStudy.status}</span>
        </div>

        {!submitted && (
          <>
            {surveySections.map((section) => (
              <div key={`${section.section_number}-${section.section_title}`} className="survey-section">
                <h4>
                  Section {section.section_number}: {section.section_title}
                </h4>

                {section.questions.map((question) => (
                  <div className="question" key={question.key}>
                    <label>{question.prompt}</label>
                    {isMultiSelect(question) ? (
                      <div className="checkbox-group">
                        {(question.options || []).map((option) => {
                          const selected = Array.isArray(answers[question.key]) ? answers[question.key] : [];
                          const checked = selected.includes(option);

                          return (
                            <label key={`${question.key}-${option}`} className="checkbox-option">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(event) => {
                                  const shouldCheck = event.target.checked;
                                  setError("");

                                  setAnswers((prev) => {
                                    const current = Array.isArray(prev[question.key])
                                      ? (prev[question.key] as string[])
                                      : [];

                                    if (!shouldCheck) {
                                      return {
                                        ...prev,
                                        [question.key]: current.filter((item: string) => item !== option)
                                      };
                                    }

                                    if (current.includes(option)) {
                                      return prev;
                                    }

                                    const max = maxSelections(question);
                                    if (max && current.length >= max) {
                                      setError(`Select up to ${max}: ${question.prompt}`);
                                      return prev;
                                    }

                                    return { ...prev, [question.key]: [...current, option] };
                                  });
                                }}
                              />
                              <span>{option}</span>
                            </label>
                          );
                        })}
                      </div>
                    ) : question.type === "number" ? (
                      <input
                        type="number"
                        min={question.min}
                        max={question.max}
                        value={Array.isArray(answers[question.key]) ? "" : answers[question.key] || ""}
                        onChange={(event) => {
                          setError("");
                          setAnswers((prev) => ({ ...prev, [question.key]: event.target.value }));
                        }}
                      />
                    ) : (
                      <select
                        value={Array.isArray(answers[question.key]) ? "" : answers[question.key] || ""}
                        onChange={(event) => {
                          setError("");
                          setAnswers((prev) => ({ ...prev, [question.key]: event.target.value }));
                        }}
                      >
                        <option value="">Select an answer</option>
                        {(question.options || []).map((option) => (
                          <option key={`${question.key}-${option}`} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                ))}
              </div>
            ))}

            <button onClick={onSubmitStudy} disabled={loading} type="button">
              {loading ? "Submitting..." : "Submit response"}
            </button>
          </>
        )}

        {submitted && (
          <div className="success">
            <h3>Thanks. You are now reward-eligible for this submission.</h3>
            <p>Your account activity has been updated, and you can choose another study anytime.</p>
          </div>
        )}
      </article>
    );
  };

  const renderAccountPage = () => {
    if (!token) {
      return (
        <section className="join-card shell-state">
          <p className="kicker">Account Access</p>
          <h2>Login required</h2>
          <p className="muted">Your account dashboard lives on a separate page. Sign in from the homepage first.</p>
          <button className="shell-button" onClick={goHome} type="button">
            Go to homepage
          </button>
        </section>
      );
    }

    return (
      <section className="dashboard-shell">
        <div className="dashboard-hero">
          <div>
            <p className="kicker">Respondent Dashboard</p>
            <h1>Welcome back</h1>
            <p className="muted">
              Review your activity, see your saved profile status, and choose a study when you are ready.
            </p>
          </div>
          <div className="dashboard-actions">
            <button className="btn secondary action-btn" onClick={goHome} type="button">
              View homepage
            </button>
            <button className="btn secondary action-btn" onClick={onLogout} type="button">
              Logout
            </button>
          </div>
        </div>

        {error && <p className="error">{error}</p>}

        {!hasExistingProfile ? (
          <section className="join-card">
            <header>
              <p className="kicker">Profile Setup</p>
              <h2>Complete your profile to unlock surveys</h2>
            </header>
            <section className="step">
              <input type="number" placeholder="Age" value={age} onChange={(event) => setAge(event.target.value)} />
              <select value={gender} onChange={(event) => setGender(event.target.value)}>
                <option value="">Select gender</option>
                <option value="female">female</option>
                <option value="male">male</option>
              </select>
              <input
                type="text"
                placeholder="Location (e.g. Nairobi)"
                value={location}
                onChange={(event) => setLocation(event.target.value)}
              />
              <select value={incomeBand} onChange={(event) => setIncomeBand(event.target.value)}>
                <option value="">Income band</option>
                <option value="25k-50k">25k-50k</option>
                <option value="50k-75k">50k-75k</option>
                <option value="75k-100k">75k-100k</option>
                <option value="100k-150k">100k-150k</option>
              </select>
              <select value={education} onChange={(event) => setEducation(event.target.value)}>
                <option value="">Education</option>
                <option value="high_school">high_school</option>
                <option value="bachelors">bachelors</option>
                <option value="masters">masters</option>
                <option value="phd">phd</option>
              </select>
              <select value={employmentStatus} onChange={(event) => setEmploymentStatus(event.target.value)}>
                <option value="">Employment status</option>
                <option value="full_time">full_time</option>
                <option value="part_time">part_time</option>
                <option value="self_employed">self_employed</option>
                <option value="unemployed">unemployed</option>
              </select>
              <button onClick={onCreateProfile} disabled={loading} type="button">
                {loading ? "Saving..." : "Save profile"}
              </button>
            </section>
          </section>
        ) : (
          <>
            <div className="dashboard-grid">
              <article className="dashboard-panel">
                <div className="panel-header">
                  <div>
                    <p className="kicker">Account Overview</p>
                    <h3>{email}</h3>
                  </div>
                  <span className="status-chip">Verified</span>
                </div>
                <p className="muted">
                  ID: {idNumber} {accountRole ? `| Role: ${accountRole}` : ""}
                </p>
                <div className="activity-metrics">
                  <div>
                    <strong>{activity?.metrics.total_submissions ?? 0}</strong>
                    <span>Submissions</span>
                  </div>
                  <div>
                    <strong>{activity?.metrics.unique_studies_completed ?? 0}</strong>
                    <span>Studies completed</span>
                  </div>
                  <div>
                    <strong>{loadingActivity ? "..." : activity?.metrics.last_submission_at ? "Recent" : "New"}</strong>
                    <span>
                      {activity?.metrics.last_submission_at
                        ? new Date(activity.metrics.last_submission_at).toLocaleDateString()
                        : "No activity yet"}
                    </span>
                  </div>
                </div>
              </article>

              <article className="dashboard-panel">
                <div className="panel-header">
                  <div>
                    <p className="kicker">Profile Status</p>
                    <h3>Saved respondent profile</h3>
                  </div>
                  <span className="status-chip">Ready</span>
                </div>
                <div className="profile-summary">
                  <div>
                    <span>Age</span>
                    <strong>{age}</strong>
                  </div>
                  <div>
                    <span>Gender</span>
                    <strong>{humanizeValue(gender)}</strong>
                  </div>
                  <div>
                    <span>Location</span>
                    <strong>{location}</strong>
                  </div>
                  <div>
                    <span>Income</span>
                    <strong>{humanizeValue(incomeBand)}</strong>
                  </div>
                  <div>
                    <span>Education</span>
                    <strong>{humanizeValue(education)}</strong>
                  </div>
                  <div>
                    <span>Employment</span>
                    <strong>{humanizeValue(employmentStatus)}</strong>
                  </div>
                </div>
              </article>
            </div>

            <div className="dashboard-grid">
              <article className="dashboard-panel">
                <div className="panel-header">
                  <div>
                    <p className="kicker">Recent Activity</p>
                    <h3>Submission history</h3>
                  </div>
                </div>
                <div className="activity-list">
                  {activity?.activity.length ? (
                    activity.activity.map((item) => (
                      <div className="activity-item" key={item.response_id}>
                        <strong>{item.study.title}</strong>
                        <span>{new Date(item.submitted_at).toLocaleString()}</span>
                      </div>
                    ))
                  ) : (
                    <p className="muted">No submissions yet. Choose a survey when you are ready.</p>
                  )}
                </div>
              </article>

              <article className="dashboard-panel">
                <div className="panel-header">
                  <div>
                    <p className="kicker">Available Now</p>
                    <h3>Studies you can join today</h3>
                  </div>
                </div>
                <div className="survey-list">
                  {studyOptions.length ? (
                    studyOptions.map((study) => (
                      <button
                        key={study.id}
                        type="button"
                        className={`survey-card ${activeStudyId === study.id ? "active" : ""}`}
                        onClick={() => {
                          setActiveStudyId(study.id);
                          setSelectedStudyId(study.id);
                          setSubmitted(false);
                          setError("");
                        }}
                      >
                        <strong>{study.title}</strong>
                        <span>{study.status === "ACTIVE" ? "Open now" : humanizeValue(study.status)}</span>
                        <small>{study.availability?.reason}</small>
                        {study.eligibility?.basis ? (
                          <small>
                            Match: {study.eligibility.basis.location} | {study.eligibility.basis.income_band}
                          </small>
                        ) : null}
                        {study.eligibility?.quota_status?.[0] ? (
                          <small>
                            Quota: {study.eligibility.quota_status[0].remaining} spots left in {study.eligibility.quota_status[0].label}
                          </small>
                        ) : null}
                      </button>
                    ))
                  ) : (
                    <p className="muted">
                      No active studies match your profile yet. As more studies are launched for your demographic, they
                      will appear here automatically.
                    </p>
                  )}
                </div>
              </article>
            </div>

            <div className="dashboard-grid">
              <article className="dashboard-panel">
                <div className="panel-header">
                  <div>
                    <p className="kicker">Completed Studies</p>
                    <h3>Your finished work</h3>
                  </div>
                </div>
                <div className="survey-list">
                  {studyFeed.completed.length ? (
                    studyFeed.completed.map((study) => (
                      <div key={study.id} className="survey-card survey-card-static">
                        <strong>{study.title}</strong>
                        <span>{study.status === "COMPLETED" ? "Closed" : humanizeValue(study.status)}</span>
                        <small>{study.availability?.reason}</small>
                      </div>
                    ))
                  ) : (
                    <p className="muted">You have not completed any studies yet.</p>
                  )}
                </div>
              </article>

              <article className="dashboard-panel">
                <div className="panel-header">
                  <div>
                    <p className="kicker">Not Available Yet</p>
                    <h3>Why some studies are hidden from action</h3>
                  </div>
                </div>
                <div className="survey-list">
                  {studyFeed.unavailable.length ? (
                    studyFeed.unavailable.map((study) => (
                      <div key={study.id} className="survey-card survey-card-static survey-card-muted">
                        <strong>{study.title}</strong>
                        <span>{study.status === "ACTIVE" ? "Not currently available" : humanizeValue(study.status)}</span>
                        <small>{study.availability?.reason}</small>
                        {study.eligibility?.quota_status?.[0] ? (
                          <small>
                            Matching quota: {study.eligibility.quota_status[0].current_count}/
                            {study.eligibility.quota_status[0].target_count}
                          </small>
                        ) : null}
                      </div>
                    ))
                  ) : (
                    <p className="muted">All visible studies are currently available to you.</p>
                  )}
                </div>
              </article>
            </div>

            {renderSurveyWorkspace()}
          </>
        )}
      </section>
    );
  };

  return (
    <main className="page">
      <header className="topbar">
        <button className="brand-lockup" onClick={goHome} type="button">
          <img className="brand-logo" src="/datle-logo.png" alt="DatLe" />
        </button>
        <nav className="topnav">
          <button className={`nav-link ${route === "/" ? "active" : ""}`} onClick={goHome} type="button">
            Home
          </button>
          <button className={`nav-link ${route === "/account" ? "active" : ""}`} onClick={goAccount} type="button">
            Account
          </button>
          {token ? (
            <button onClick={onLogout} className="btn secondary action-btn" type="button">
              Logout
            </button>
          ) : null}
        </nav>
      </header>

      {route === "/account" ? renderAccountPage() : renderHomePage()}
    </main>
  );
}

export default App;
