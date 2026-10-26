import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowDown,
  ArrowRight,
  Check,
  CheckCheck,
  ChevronDown,
  CircleHelp,
  Clipboard,
  Code2,
  Database,
  FlaskConical,
  GitBranch,
  Layers3,
  LoaderCircle,
  ShieldCheck,
  Sparkles,
  Terminal,
  TriangleAlert,
} from "lucide-react";
import type { QueryResponse } from "../../backend/src/contracts";
type Health = {
  mode: "demo" | "live";
  configured: boolean;
  schemaName?: string;
  maxRows?: number;
  examples?: string[];
  specialExamples?: string[];
  message?: string;
};
const cellText = (value: unknown) =>
  value === null
    ? "null"
    : typeof value === "object"
      ? JSON.stringify(value)
      : String(value);
export default function App() {
  const [health, setHealth] = useState<Health | null>(null);
  const [healthError, setHealthError] = useState("");
  const [question, setQuestion] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [response, setResponse] = useState<QueryResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const resultRef = useRef<HTMLElement>(null);
  const inFlight = useRef(false);
  async function checkHealth() {
    setHealthError("");
    try {
      const res = await fetch("/api/health");
      const data = (await res.json()) as Health;
      setHealth(data);
    } catch {
      setHealthError(
        "Cannot reach the backend. Start both servers with npm run dev, then retry.",
      );
    }
  }
  useEffect(() => {
    void checkHealth();
  }, []);
  const demo = health?.mode === "demo";
  function choose(value: string) {
    setQuestion(value);
    inputRef.current?.focus();
  }
  async function ask(event: FormEvent) {
    event.preventDefault();
    if (inFlight.current || !question.trim()) return;
    inFlight.current = true;
    setBusy(true);
    setResponse(null);
    setCopied(false);
    setCopyError("");
    setSubmitted(question.trim());
    try {
      const res = await fetch("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: question.trim() }),
        signal: AbortSignal.timeout(100000),
      });
      const data = (await res.json()) as QueryResponse;
      setResponse(data);
    } catch {
      setResponse({
        ok: false,
        mode: health?.mode ?? "demo",
        status: "error",
        message:
          "The server could not be reached or the request timed out. Check the backend and try again.",
        elapsedMs: 0,
      });
    } finally {
      inFlight.current = false;
      setBusy(false);
      setTimeout(() => resultRef.current?.focus(), 0);
    }
  }
  async function copyQuery() {
    try {
      await navigator.clipboard.writeText(
        response?.candidate?.cypher ?? response?.generation?.cypher ?? "",
      );
      setCopied(true);
      setCopyError("");
    } catch {
      setCopyError(
        "Copy unavailable. Select the query text to copy it manually.",
      );
    }
  }
  const query = response?.candidate?.cypher ?? response?.generation?.cypher;
  return (
    <div className="app-shell">
      <header className="topbar">
        <a href="/" className="brand" aria-label="GraphQuery home">
          <span className="brand-mark">
            <GitBranch size={23} />
          </span>
          GraphQuery
          <span className="brand-divider" />
          <span className="brand-caption">Natural language to Cypher</span>
        </a>
        <div className="header-right">
          <a href="#how-it-works" className="text-link">
            How it works <ArrowRight size={14} />
          </a>
          <span className={`mode-badge ${demo ? "" : "live"}`}>
            <span className="status-dot" />
            {health ? (demo ? "Demo Mode" : "Live Mode") : "Connecting"}
          </span>
        </div>
      </header>
      <main>
        <section className="intro">
          <div>
            <h1>
              Your questions. <span>Your graph.</span>
            </h1>
            <p>Ask in plain English. Inspect the Cypher. Explore the answer.</p>
          </div>
          <div className="intro-note">
            <ShieldCheck size={19} />
            <span>
              Independent review
              <br />
              <strong>before every query</strong>
            </span>
          </div>
        </section>
        {healthError && (
          <div className="notice error" role="alert">
            {healthError}
            <button className="text-link" onClick={() => void checkHealth()}>
              Retry connection
            </button>
          </div>
        )}
        {health && !health.configured && (
          <div className="notice error" role="alert">
            <TriangleAlert size={18} />
            <span>{health.message}</span>
            <button className="text-link" onClick={() => void checkHealth()}>
              Recheck
            </button>
          </div>
        )}
        {demo && (
          <div className="demo-banner">
            <FlaskConical size={18} />
            <p>
              <strong>A little graph. A working demonstration.</strong> Explore
              a fictional product catalog (prices in INR) with simulated AI
              generation and review. No external services are called.
            </p>
            <span className="sample-tag">Sample dataset</span>
          </div>
        )}
        <div className="workspace">
          <aside className="question-side">
            <form onSubmit={ask} className="question-form">
              <div className="section-heading">
                <span className="icon-box">
                  <Sparkles size={18} />
                </span>
                <h2>Ask your graph</h2>
              </div>
              <label htmlFor="question">Your question in English</label>
              <textarea
                ref={inputRef}
                id="question"
                placeholder="e.g. Find in-stock headphones under INR 5000."
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                maxLength={1000}
                required
                rows={5}
                disabled={busy}
                aria-describedby="input-help"
              />
              <div className="input-meta">
                <span id="input-help">
                  Be specific about what you want to find.
                </span>
                <span>{question.length}/1000</span>
              </div>
              <button
                className="ask-button"
                disabled={busy || !question.trim() || !health?.configured}
              >
                {busy ? (
                  <LoaderCircle className="spin" size={18} />
                ) : (
                  <Sparkles size={18} />
                )}{" "}
                {busy ? "Processing question…" : "Ask GraphQuery"}
                {!busy && <ArrowRight size={18} />}
              </button>
            </form>
            {demo && (
              <section className="examples">
                <h3>Start with a question</h3>
                <p>Pick an example, then ask GraphQuery.</p>
                <div className="example-list">
                  {health.examples?.map((example, i) => (
                    <button
                      key={example}
                      disabled={busy}
                      onClick={() => choose(example)}
                    >
                      <span className="example-number">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span>{example}</span>
                      <ArrowRight size={15} />
                    </button>
                  ))}
                </div>
                <details className="demo-cases">
                  <summary>
                    Explore other outcomes <ChevronDown size={14} />
                  </summary>
                  {health.specialExamples?.map((example) => (
                    <button
                      disabled={busy}
                      onClick={() => choose(example)}
                      key={example}
                    >
                      {example}
                      <ArrowRight size={14} />
                    </button>
                  ))}
                  <p>
                    Other questions return an honest unsupported response in
                    demo mode.
                  </p>
                </details>
              </section>
            )}
            <div className="schema-note">
              <Database size={18} />
              <div>
                <strong>{health?.schemaName ?? "Configured graph"}</strong>
                <p>
                  {demo
                    ? "Product · Category · Feature · Review"
                    : "Uses your server-configured graph schema"}
                  <br />
                  Up to {health?.maxRows ?? 100} rows per query
                </p>
              </div>
            </div>
          </aside>
          <section
            className="answer-side"
            ref={resultRef}
            tabIndex={-1}
            aria-label="Query output"
            aria-busy={busy}
          >
            <div className="output-heading">
              <h2>
                <Terminal size={18} /> Query workspace
              </h2>
              <span>{response ? "Latest question" : "Ready when you are"}</span>
            </div>
            {!response && !busy && (
              <div className="empty-workspace">
                <div className="graph-motif" aria-hidden="true">
                  <svg viewBox="0 0 220 120">
                    <path d="M46 60 110 25 174 60 110 95 46 60m64-35v70" />
                    <circle cx="46" cy="60" r="13" />
                    <circle cx="110" cy="25" r="13" />
                    <circle cx="174" cy="60" r="13" />
                    <circle cx="110" cy="95" r="13" />
                  </svg>
                </div>
                <h3>There’s a story in your connections.</h3>
                <p>
                  Ask a question to see its query, independent review, and
                  results in one place.
                </p>
                <div className="empty-flow">
                  <span>English</span>
                  <ArrowRight size={14} />
                  <span>Cypher</span>
                  <ArrowRight size={14} />
                  <span>Answers</span>
                </div>
              </div>
            )}
            {busy && (
              <div className="empty-workspace loading" role="status">
                <LoaderCircle size={32} className="spin" />
                <h3>Working on your question</h3>
                <p>
                  Generating, reviewing, and checking the query before
                  retrieving results.
                </p>
              </div>
            )}
            {response && (
              <div className="response-content">
                <div className="asked-question">
                  <span>You asked</span>
                  <p>{submitted}</p>
                </div>
                {query && (
                  <section className="query-panel">
                    <div className="code-heading">
                      <h3>
                        <Code2 size={16} /> Generated Cypher
                      </h3>
                      <button
                        onClick={() => void copyQuery()}
                        aria-label="Copy Cypher query"
                      >
                        {copied ? (
                          <CheckCheck size={15} />
                        ) : (
                          <Clipboard size={15} />
                        )}{" "}
                        {copied ? "Copied" : "Copy"}
                      </button>
                    </div>
                    <pre>
                      <code>
                        {query.replace(
                          / (WHERE|RETURN|ORDER BY|LIMIT) /g,
                          "\n$1 ",
                        )}
                      </code>
                    </pre>
                    {copied && (
                      <span className="sr-only" role="status">
                        Cypher query copied to clipboard.
                      </span>
                    )}
                    {copyError && <p role="status">{copyError}</p>}
                    <div className="query-explanation">
                      {response.generation?.explanation}
                    </div>
                  </section>
                )}
                {response.candidate && (
                  <details className="parameters">
                    <summary>
                      Query parameters{" "}
                      <span>
                        {Object.keys(response.candidate.parameters).length}{" "}
                        values <ChevronDown size={14} />
                      </span>
                    </summary>
                    <pre>
                      {JSON.stringify(response.candidate.parameters, null, 2)}
                    </pre>
                  </details>
                )}
                {response.review && (
                  <section
                    className={`review ${response.review.verdict === "approved" ? "approved" : "not-approved"}`}
                  >
                    <div className="review-icon">
                      {response.review.verdict === "approved" ? (
                        <ShieldCheck size={20} />
                      ) : (
                        <TriangleAlert size={20} />
                      )}
                    </div>
                    <div>
                      <h3>
                        {response.review.verdict === "approved"
                          ? demo
                            ? "Simulated AI review passed"
                            : "AI review passed"
                          : response.review.verdict === "rejected"
                            ? "Query not approved"
                            : "Review needs clarification"}
                      </h3>
                      <p>{response.review.explanation}</p>
                      {response.review.issues.length > 0 && (
                        <ul>
                          {response.review.issues.map((issue) => (
                            <li key={issue}>{issue}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </section>
                )}
                {["error", "unsupported", "clarification_required"].includes(
                  response.status,
                ) && (
                  <div
                    className={`notice ${response.status === "error" ? "error" : "info"}`}
                    role={response.status === "error" ? "alert" : "status"}
                  >
                    <CircleHelp size={20} />
                    <div>
                      <strong>
                        {response.status === "clarification_required"
                          ? "A little more detail, please"
                          : response.status === "unsupported"
                            ? "Outside this demo or query scope"
                            : "Query stopped"}
                      </strong>
                      <p>{response.message}</p>
                    </div>
                  </div>
                )}
                {response.result && (
                  <section className="results">
                    <div className="results-heading">
                      <div>
                        <h3>
                          <Layers3 size={17} />
                          {demo ? "Sample results" : "Database results"}
                        </h3>
                        <p>
                          {response.rowCount}{" "}
                          {response.rowCount === 1 ? "row" : "rows"} returned{" "}
                          <span>·</span> {response.elapsedMs} ms
                        </p>
                      </div>
                      <span className="result-state">
                        <Check size={13} />{" "}
                        {response.status === "empty"
                          ? "No matches"
                          : "Complete"}
                      </span>
                    </div>
                    {response.result.rows.length ? (
                      <div
                        className="table-scroll"
                        tabIndex={0}
                        role="region"
                        aria-label="Results table"
                      >
                        <table>
                          <thead>
                            <tr>
                              <th scope="col" className="row-index">
                                #
                              </th>
                              {response.result.columns.map((c) => (
                                <th scope="col" key={c}>
                                  {c}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {response.result.rows.map((row, i) => (
                              <tr key={i}>
                                <td className="row-index">
                                  {String(i + 1).padStart(2, "0")}
                                </td>
                                {row.map((value, j) => (
                                  <td key={j}>{cellText(value)}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="empty-results">
                        <Database size={24} />
                        <h4>No matching records</h4>
                        <p>
                          The query completed successfully, but no records
                          matched your filters.
                        </p>
                      </div>
                    )}
                    <div className="results-foot">
                      <span>
                        {demo
                          ? "Fictional data · deterministic fixtures"
                          : "Results returned directly from Neo4j"}
                      </span>
                      <span>Limit: {response.candidate?.limit} rows</span>
                    </div>
                    {response.limitReached && (
                      <p className="limit-note">
                        The row limit was reached. More matches may exist; these
                        results may be limited.
                      </p>
                    )}
                  </section>
                )}
              </div>
            )}
          </section>
        </div>
        <section id="how-it-works" className="how-section">
          <div className="how-title">
            <h2>A clear path from question to answer.</h2>
            <p>Every result has a query you can inspect.</p>
          </div>
          <ol>
            <li>
              <span className="step">1</span>
              <div>
                <h3>Generate</h3>
                <p>Translate your question using the trusted graph schema.</p>
              </div>
            </li>
            <li>
              <span className="step">2</span>
              <div>
                <h3>Review independently</h3>
                <p>
                  A separate AI request checks the query’s intended meaning.
                </p>
              </div>
            </li>
            <li>
              <span className="step">3</span>
              <div>
                <h3>Plan & retrieve</h3>
                <p>Safety checks and Neo4j EXPLAIN gate read-only execution.</p>
              </div>
            </li>
          </ol>
          <p className="review-caveat">
            <CircleHelp size={14} /> AI review can make mistakes. It does not
            guarantee query correctness.
            {demo &&
              " In demo mode, generation, review, and retrieval are simulated."}
          </p>
        </section>
      </main>
      <footer>
        <span>
          <GitBranch size={15} /> GraphQuery
        </span>
        <p>
          Natural Language to Neo4j Cypher <span>·</span> VTU Mini Project
        </p>
        <a href="#question">
          Ask another question <ArrowDown size={13} />
        </a>
      </footer>
    </div>
  );
}
