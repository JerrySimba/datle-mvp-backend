import { useEffect, useMemo, useState } from "react";
import { fetchStudies, fetchSummary } from "./api";
import type { BreakdownItem, Study, Summary } from "./types";

const asDateInput = (value: string | null) => (value ? value.slice(0, 10) : "");
const asIsoStart = (value: string) => (value ? `${value}T00:00:00.000Z` : undefined);
const asIsoEnd = (value: string) => (value ? `${value}T23:59:59.999Z` : undefined);

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

function App() {
  const [studies, setStudies] = useState<Study[]>([]);
  const [studyId, setStudyId] = useState("");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [gender, setGender] = useState("");
  const [location, setLocation] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const list = await fetchStudies();
        setStudies(list);
        if (list.length > 0) {
          setStudyId(list[0].id);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load studies");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  useEffect(() => {
    if (!studyId) return;

    const loadSummary = async () => {
      setLoading(true);
      setError("");
      try {
        const payload = await fetchSummary(studyId, {
          gender: gender || undefined,
          location: location || undefined,
          from: asIsoStart(from),
          to: asIsoEnd(to)
        });
        setSummary(payload);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load summary");
      } finally {
        setLoading(false);
      }
    };

    loadSummary();
  }, [studyId, gender, location, from, to]);

  const locationOptions = useMemo(
    () =>
      Array.from(new Set(summary?.respondent_breakdowns.location.map((item) => item.value) || [])).sort(),
    [summary]
  );

  return (
    <main className="app">
      <header className="hero">
        <p className="kicker">DatLe Consumer Intelligence</p>
        <h1>Study Analytics Dashboard</h1>
        <p className="lede">Live response tracking, segment cuts, and question-level signals for rapid product decisions.</p>
      </header>

      <section className="filters panel">
        <div className="field">
          <label>Study</label>
          <select value={studyId} onChange={(event) => setStudyId(event.target.value)}>
            {studies.map((study) => (
              <option key={study.id} value={study.id}>
                {study.title}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Gender</label>
          <select value={gender} onChange={(event) => setGender(event.target.value)}>
            <option value="">All</option>
            <option value="female">female</option>
            <option value="male">male</option>
          </select>
        </div>
        <div className="field">
          <label>Location</label>
          <select value={location} onChange={(event) => setLocation(event.target.value)}>
            <option value="">All</option>
            {locationOptions.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
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
      </section>

      {error && <div className="error">{error}</div>}
      {loading && <div className="panel">Loading...</div>}

      {summary && !loading && (
        <>
          <section className="cards">
            <article className="card">
              <span>Total Responses</span>
              <strong>{summary.metrics.total_responses}</strong>
            </article>
            <article className="card">
              <span>Unique Respondents</span>
              <strong>{summary.metrics.unique_respondents}</strong>
            </article>
            <article className="card">
              <span>Study Status</span>
              <strong>{summary.study.status}</strong>
            </article>
          </section>

          <section className="panel">
            <h3>Response Trend</h3>
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

          <section className="grid">
            <BreakdownList label="Gender" items={summary.respondent_breakdowns.gender} />
            <BreakdownList label="Location" items={summary.respondent_breakdowns.location} />
            <BreakdownList label="Income Band" items={summary.respondent_breakdowns.income_band} />
          </section>

          <section className="panel">
            <h3>Question Signals</h3>
            <div className="rows">
              {summary.question_stats.map((question) => (
                <div key={question.question} className="question">
                  <div className="row-head">
                    <span>{question.question}</span>
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
        </>
      )}
    </main>
  );
}

export default App;
