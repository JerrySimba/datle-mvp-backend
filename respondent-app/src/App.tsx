import { useEffect, useMemo, useState } from "react";
import { createRespondent, fetchStudies, requestOtp, submitResponse, verifyOtp } from "./api";
import { questionConfig } from "./studyConfig";
import type { ResponsePayload, Study } from "./types";

type Step = 1 | 2 | 3 | 4;
const totalSteps = 4;

function App() {
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [token, setToken] = useState("");
  const [respondentId, setRespondentId] = useState("");

  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [location, setLocation] = useState("");
  const [incomeBand, setIncomeBand] = useState("");
  const [education, setEducation] = useState("");
  const [employmentStatus, setEmploymentStatus] = useState("");

  const [studies, setStudies] = useState<Study[]>([]);
  const [selectedStudyId, setSelectedStudyId] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

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
        // Continue; flow still works when studies load later.
      }
    };

    loadStudies();
  }, []);

  const studyOptions = useMemo(() => {
    const active = studies.filter((item) => item.status === "ACTIVE");
    return active.length > 0 ? active : studies;
  }, [studies]);

  const onRequestOtp = async () => {
    setError("");
    if (!email.includes("@")) {
      setError("Enter a valid email.");
      return;
    }

    try {
      setLoading(true);
      await requestOtp(email.trim().toLowerCase());
      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to request OTP");
    } finally {
      setLoading(false);
    }
  };

  const onVerifyOtp = async () => {
    setError("");
    if (!/^\d{6}$/.test(otp)) {
      setError("OTP must be exactly 6 digits.");
      return;
    }

    try {
      setLoading(true);
      const value = await verifyOtp(email.trim().toLowerCase(), otp);
      setToken(value);
      setStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to verify OTP");
    } finally {
      setLoading(false);
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
      setError("Session expired. Verify OTP again.");
      setStep(2);
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
      setStep(4);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save profile");
    } finally {
      setLoading(false);
    }
  };

  const onSubmitStudy = async () => {
    setError("");
    if (!selectedStudyId) {
      setError("No study is currently available.");
      return;
    }

    if (!respondentId || !token) {
      setError("Session invalid. Restart from email verification.");
      setStep(1);
      return;
    }

    const missing = questionConfig.find((question) => !answers[question.key]);
    if (missing) {
      setError(`Answer required: ${missing.label}`);
      return;
    }

    const payload: ResponsePayload = {};
    questionConfig.forEach((question) => {
      const value = answers[question.key];
      payload[question.key] = question.type === "number" ? Number(value) : value;
    });

    try {
      setLoading(true);
      await submitResponse(token, {
        respondent_id: respondentId,
        study_id: selectedStudyId,
        payload
      });
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit response");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="page">
      <header className="topbar">
        <div className="logo">DatLe</div>
        <nav>
          <a href="#how">How it works</a>
          <a href="#join">Join study</a>
        </nav>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <h1>
            Share Your <span>Voice</span>
            <br />
            Get <strong>Paid</strong> for It
          </h1>
          <p>
            DatLe connects verified respondents to high-quality product studies. Complete short studies and earn
            rewards while helping teams build better products.
          </p>
          <div className="hero-actions">
            <a href="#join" className="btn primary">
              Join a Study
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
            <h4>1. Verify email</h4>
            <p>Secure OTP authentication ensures only verified respondents participate.</p>
          </article>
          <article>
            <h4>2. Complete profile</h4>
            <p>Provide profile data once so studies can target the right audiences.</p>
          </article>
          <article>
            <h4>3. Submit responses</h4>
            <p>Answer structured questions in minutes and become reward-eligible.</p>
          </article>
        </div>
      </section>

      <section id="join" className="join-card">
        <header>
          <p className="kicker">Respondent Flow</p>
          <h2>
            Step {step} of {totalSteps}
          </h2>
          <div className="progress">
            <div className="progress-fill" style={{ width: `${(step / totalSteps) * 100}%` }} />
          </div>
        </header>

        {error && <p className="error">{error}</p>}

        {step === 1 && (
          <section className="step">
            <h3>Enter email</h3>
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <button onClick={onRequestOtp} disabled={loading}>
              {loading ? "Requesting..." : "Request OTP"}
            </button>
          </section>
        )}

        {step === 2 && (
          <section className="step">
            <h3>Verify OTP</h3>
            <p className="muted">For MVP, use OTP from backend logs.</p>
            <input type="text" placeholder="123456" value={otp} onChange={(event) => setOtp(event.target.value)} />
            <button onClick={onVerifyOtp} disabled={loading}>
              {loading ? "Verifying..." : "Verify OTP"}
            </button>
          </section>
        )}

        {step === 3 && (
          <section className="step">
            <h3>Profile capture</h3>
            <input type="number" placeholder="Age" value={age} onChange={(event) => setAge(event.target.value)} />
            <select value={gender} onChange={(event) => setGender(event.target.value)}>
              <option value="">Select gender</option>
              <option value="female">female</option>
              <option value="male">male</option>
            </select>
            <input
              type="text"
              placeholder="Location (e.g. New York, NY)"
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
            <button onClick={onCreateProfile} disabled={loading}>
              {loading ? "Saving..." : "Continue"}
            </button>
          </section>
        )}

        {step === 4 && (
          <section className="step">
            <h3>Study response</h3>
            {!submitted && (
              <>
                <select value={selectedStudyId} onChange={(event) => setSelectedStudyId(event.target.value)}>
                  {studyOptions.map((study) => (
                    <option key={study.id} value={study.id}>
                      {study.title}
                    </option>
                  ))}
                </select>

                {questionConfig.map((question) => (
                  <div className="question" key={question.key}>
                    <label>{question.label}</label>
                    {question.type === "select" ? (
                      <select
                        value={answers[question.key] || ""}
                        onChange={(event) => setAnswers((prev) => ({ ...prev, [question.key]: event.target.value }))}
                      >
                        <option value="">Select an answer</option>
                        {question.options.map((option) => (
                          <option key={`${question.key}-${option}`} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="number"
                        min={question.min}
                        max={question.max}
                        value={answers[question.key] || ""}
                        onChange={(event) => setAnswers((prev) => ({ ...prev, [question.key]: event.target.value }))}
                      />
                    )}
                  </div>
                ))}

                <button onClick={onSubmitStudy} disabled={loading}>
                  {loading ? "Submitting..." : "Submit response"}
                </button>
              </>
            )}

            {submitted && (
              <div className="success">
                <h3>Thanks. You are now reward-eligible for this submission.</h3>
                <p>Your voice has been captured in this DatLe study.</p>
              </div>
            )}
          </section>
        )}
      </section>
    </main>
  );
}

export default App;
