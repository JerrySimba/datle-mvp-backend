import { useEffect, useMemo, useState } from "react";
import { fetchStudies, fetchSummary } from "./api";
import type { BreakdownItem, Study, Summary } from "./types";

const asIsoStart = (value: string) => (value ? `${value}T00:00:00.000Z` : undefined);
const asIsoEnd = (value: string) => (value ? `${value}T23:59:59.999Z` : undefined);

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

function App() {
  const [studies, setStudies] = useState<Study[]>([]);
  const [studyId, setStudyId] = useState("");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [dimensionFilters, setDimensionFilters] = useState<Record<string, string>>({});

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
    setDimensionFilters({});
    setFrom("");
    setTo("");
  }, [studyId]);

  useEffect(() => {
    if (!studyId) return;

    const loadSummary = async () => {
      setLoading(true);
      setError("");
      try {
        const payload = await fetchSummary(studyId, {
          from: asIsoStart(from),
          to: asIsoEnd(to),
          ...dimensionFilters
        });
        setSummary(payload);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load summary");
      } finally {
        setLoading(false);
      }
    };

    loadSummary();
  }, [studyId, from, to, dimensionFilters]);

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

  const dynamicFilterFields = useMemo(() => [...respondentFields, ...questionFields], [respondentFields, questionFields]);
  const chartBreakdowns = respondentFields.slice(0, 2);

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
          <label>From</label>
          <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        </div>
        <div className="field">
          <label>To</label>
          <input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        </div>
        {dynamicFilterFields.map((field) => (
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
