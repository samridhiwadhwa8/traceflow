import { useEffect, useState, useRef } from "react";
import "./SpanWaterfall.css";

const API_URL = "http://localhost:4000";
const WS_URL = "ws://localhost:8080";

function flattenTree(roots, depth = 0, rows = []) {
  for (const span of roots) {
    rows.push({ ...span, depth });
    flattenTree(span.children || [], depth + 1, rows);
  }

  return rows;
}

export default function SpanWaterfall() {
  const [traces, setTraces] = useState([]);
  const [traceId, setTraceId] = useState("");
  const [tree, setTree] = useState([]);
  const [diagnosisState, setDiagnosisState] = useState({
    traceId: "",
    result: null,
    error: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef(null);

  // Load the available traces.
  useEffect(() => {
    async function loadTraces() {
      try {
        const response = await fetch(`${API_URL}/api/v1/traces`);

        if (!response.ok) {
          throw new Error("Could not load traces");
        }

        const data = await response.json();
        const items = Array.isArray(data) ? data : data.traces || [];

        setTraces(items);

        if (items.length > 0 && !traceId) {
          setTraceId(items[0].traceId);
        }
      } catch (err) {
        setError(err.message);
      }
    }

    loadTraces();
  }, [traceId]);

  useEffect(() => {
    if (!traceId) {
      return;
    }

    let cancelled = false;

    async function loadDiagnosis() {
      try {
        const response = await fetch(
          `${API_URL}/api/v1/traces/${encodeURIComponent(traceId)}/diagnosis`
        );

        if (!response.ok) {
          throw new Error("Could not analyze this trace");
        }

        const result = await response.json();
        if (!cancelled) {
          setDiagnosisState({ traceId, result, error: "" });
        }
      } catch (err) {
        if (!cancelled) {
          setDiagnosisState({
            traceId,
            result: null,
            error: err.message,
          });
        }
      }
    }

    loadDiagnosis();

    return () => {
      cancelled = true;
    };
  }, [traceId]);

  // WebSocket connection for live updates
  useEffect(() => {
    const ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      setWsConnected(true);
      console.log("WebSocket connected");
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === "new_trace") {
        // Refresh traces when new trace arrives
        fetch(`${API_URL}/api/v1/traces`)
          .then(response => response.json())
          .then(data => {
            const items = Array.isArray(data) ? data : data.traces || [];
            setTraces(items);
            // Auto-select the newest trace
            if (items.length > 0) {
              setTraceId(items[0].traceId);
            }
          })
          .catch(err => console.error("Failed to refresh traces:", err));
      } else if (data.type === "connected") {
        console.log("Connected to TraceFlow WebSocket server");
      }
    };

    ws.onclose = () => {
      setWsConnected(false);
      console.log("WebSocket disconnected");
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
      setWsConnected(false);
    };

    wsRef.current = ws;

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, []);

  // Load the selected trace's nested span tree.
  useEffect(() => {
    if (!traceId) {
      return;
    }

    let cancelled = false;

    async function loadTree() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(
          `${API_URL}/api/v1/traces/${encodeURIComponent(traceId)}/tree`
        );

        if (!response.ok) {
          throw new Error("Could not load the span tree");
        }

        const data = await response.json();

        if (!cancelled) {
          setTree(flattenTree(data.roots || []));
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message);
          setTree([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadTree();

    return () => {
      cancelled = true;
    };
  }, [traceId]);

  // Calculate timeline for waterfall positioning
  const calculateTimeline = () => {
    if (tree.length === 0) return { startTime: 0, endTime: 0, totalDuration: 0 };

    const startTimes = tree.map(span => new Date(span.startTime).getTime());
    const endTimes = tree.map(span => new Date(span.endTime || span.startTime).getTime());

    const startTime = Math.min(...startTimes);
    const endTime = Math.max(...endTimes);
    const totalDuration = Math.max(1, endTime - startTime);

    return { startTime, endTime, totalDuration };
  };

  const { startTime: timelineStart, totalDuration } = calculateTimeline();
  const diagnosis = diagnosisState.traceId === traceId
    ? diagnosisState.result
    : null;
  const diagnosisError = diagnosisState.traceId === traceId
    ? diagnosisState.error
    : "";

  return (
    <main className="waterfall-page">
      <header className="waterfall-header">
        <div>
          <p className="eyebrow">TRACEFLOW / OBSERVABILITY</p>
          <h1>Trace Waterfall</h1>
          <p className="subtitle">
            Explore request operations and their parent-child relationships.
          </p>
        </div>

        <span className={`live-badge ${wsConnected ? 'connected' : 'disconnected'}`}>
          {wsConnected ? '🟢 LIVE' : '🔴 OFFLINE'}
        </span>
      </header>

      <section className="trace-controls">
        <label htmlFor="trace-select">Select a trace</label>

        <select
          id="trace-select"
          value={traceId}
          onChange={(event) => setTraceId(event.target.value)}
        >
          {traces.length === 0 && (
            <option value="">No traces available</option>
          )}

          {traces.map((trace) => (
            <option key={trace.traceId} value={trace.traceId}>
              {trace.route || "Request"} — {trace.traceId}
            </option>
          ))}
        </select>

        <span>{tree.length} spans</span>
      </section>

      {error && <p className="waterfall-error">{error}</p>}

      {loading && <p>Loading span tree...</p>}

      {diagnosisError && <p className="waterfall-error">{diagnosisError}</p>}

      {diagnosis && (
        <section className={`diagnosis-panel diagnosis-${diagnosis.state}`}>
          <div className="diagnosis-heading">
            <h2>Trace diagnosis</h2>
            <span>{diagnosis.state.replace("_", " ")}</span>
          </div>
          <p>{diagnosis.message}</p>
          {diagnosis.baseline && (
            <p className="diagnosis-baseline">
              Compared with {diagnosis.sampleCount} similar healthy traces:
              median {Math.round(diagnosis.baseline.medianMs)} ms,
              p95 {Math.round(diagnosis.baseline.p95Ms)} ms.
            </p>
          )}
          {diagnosis.rankedSpans.length > 0 && (
            <>
              <h3>Likely contributors (ranked)</h3>
              <ol>
                {diagnosis.rankedSpans.map((span) => (
                  <li key={span.spanId}>
                    <strong>{span.operation}</strong>
                    {" — "}
                    {span.reason}
                    {span.slowdownFactor && (
                      <span> ({span.slowdownFactor}× its baseline)</span>
                    )}
                  </li>
                ))}
              </ol>
              <p className="diagnosis-disclaimer">
                Rankings show timing evidence; they do not prove the underlying cause.
              </p>
            </>
          )}
        </section>
      )}

      {!loading && !error && tree.length === 0 && (
        <p>No spans found. Generate a request in your demo application.</p>
      )}

      {!loading && tree.length > 0 && (
        <section className="waterfall-panel">
          <div className="waterfall-column-head">
            <span>OPERATION</span>
            <span>TIMELINE</span>
          </div>

          {tree.map((span) => {
            const spanStartTime = new Date(span.startTime).getTime();
            const duration = Number(span.durationMs) || 0;

            // Calculate position and width based on actual timeline
            const offset = Math.max(0, spanStartTime - timelineStart);
            const leftPercent = Math.max(0, (offset / totalDuration) * 100);
            const widthPercent = Math.max(2, (duration / totalDuration) * 100);

            return (
              <div className="span-row" key={span.spanId}>
                <div
                  className="span-operation"
                  style={{ paddingLeft: `${span.depth * 24 + 12}px` }}
                >
                  <span className="span-dot" />
                  <span>{span.operation}</span>
                  <span
                    className={`span-status ${
                      span.status === "OK" ? "success" : "failure"
                    }`}
                  >
                    {span.status}
                  </span>
                </div>

                <div className="span-timing">
                  <div className="span-bar-track">
                    <div
                      className="span-bar"
                      style={{
                        width: `${widthPercent}%`,
                        left: `${leftPercent}%`
                      }}
                    />
                  </div>

                  <span className="duration-label">
                    {duration} ms
                  </span>
                </div>
              </div>
            );
          })}

          <p className="timing-note">
            Waterfall shows actual timeline positions based on start times and durations.
          </p>
        </section>
      )}
    </main>
  );
}
