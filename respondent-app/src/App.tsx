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
        // Let flow continue even if studies are temporarily unavailable.
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
      if (question.type === "number") {
        payload[question.key] = Number(value);
      } else {
        payload[question.key] = value;
      }
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
    <main className="app">
      <section className="card">
        <header>
          <p className="kicker">DatLe Study Panel</p>
          <h1>Respondent Journey</h1>
          <p className="muted">Step {step} of {totalSteps}</p>
          <div className="progress">
            <div className="progress-fill" style={{ width: `${(step / totalSteps) * 100}%` }} />
          </div>
        </header>

        {error && <p className="error">{error}</p>}

        {step === 1 && (
          <section className="step">
            <h2>1. Enter email</h2>
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
            <h2>2. Verify OTP</h2>
            <p className="muted small">Use the 6-digit OTP shown in backend logs for MVP mode.</p>
            <input type="text" placeholder="123456" value={otp} onChange={(event) => setOtp(event.target.value)} />
            <button onClick={onVerifyOtp} disabled={loading}>
              {loading ? "Verifying..." : "Verify OTP"}
            </button>
          </section>
        )}

        {step === 3 && (
          <section className="step">
            <h2>3. Profile capture</h2>
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
              {loading ? "Saving..." : "Continue to study"}
            </button>
          </section>
        )}

        {step === 4 && (
          <section className="step">
            <h2>4. Study response</h2>
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
                <h3>Thank you. Your response has been submitted.</h3>
                <p>Your input has been captured for this study.</p>
              </div>
            )}
          </section>
        )}
      </section>
    </main>
  );
}

export default App;
