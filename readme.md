# TT (TraceFlow)

TT is a local observability and trace-diagnosis project. It instruments an Express demo application, records request and operation spans, stores traces, and displays their timing in a React waterfall dashboard. A statistical diagnosis module compares a request with similar healthy traces and ranks spans that may explain a latency increase.

> The demo uses controlled simulated delays and injected errors. Diagnosis is statistical evidence, not proof of a root cause. Evaluation results describe this synthetic workload only.

## Architecture

```text
Express demo app
  └─ TraceFlow middleware + AsyncLocalStorage + withSpan()
       └─ POST /ingest
            ├─ MongoDB: traces and spans
            ├─ WebSocket: new-trace event
            └─ Redis: optional trace-read cache
                 ↑
React/Vite dashboard ── REST API
  ├─ Trace list and selection
  ├─ Span tree and timeline waterfall
  └─ Statistical diagnosis and ranked contributors
```

## Implemented

- Request-level trace IDs and nested operation spans using Node.js AsyncLocalStorage.
- Monotonic duration measurement with `performance.now()`.
- Trace/span ingestion and MongoDB persistence.
- Parent-child span tree reconstruction.
- Trace lookup with optional Redis caching and MongoDB fallback.
- WebSocket notifications when a trace is ingested.
- React waterfall UI showing operation hierarchy, timing, status and duration.
- Statistical latency diagnosis using route/span-structure matching, median, p95, MAD and a minimum healthy baseline.
- Error detection for HTTP 5xx responses and ranked leaf-span evidence.
- Deterministic unit tests and a controlled evaluation runner.
- Docker Compose for local MongoDB, Redis, ingestion, demo app and dashboard.

## Tech stack

Node.js, Express, AsyncLocalStorage, React, Vite, MongoDB, Mongoose, Redis, WebSocket (`ws`), Docker Compose and Node's built-in test runner.

## Run the full project

Prerequisites: Docker Desktop with Compose support.

From the repository root:

```bash
docker compose up --build -d
docker compose ps
```

Open:
- Dashboard: http://localhost:5173
- Demo app: http://localhost:3000
- Ingestion health: http://localhost:4000/health

Generate sample requests:

```bash
curl http://localhost:3000/api/users
curl http://localhost:3000/api/slow
curl -X POST http://localhost:3000/checkout
curl -X POST "http://localhost:3000/checkout?fault=slow_payment"
curl -X POST "http://localhost:3000/checkout?fault=slow_inventory"
curl -X POST "http://localhost:3000/checkout?fault=slow_confirmation"
curl -X POST "http://localhost:3000/checkout?fault=payment_500"
curl -X POST "http://localhost:3000/checkout?fault=inventory_500"
```

Stop the stack:

```bash
docker compose down
```

MongoDB data is kept in the named Docker volume. To remove it as well, use `docker compose down -v` (this permanently deletes local project data).

## Tests

Run the ingestion unit tests from the repository root:

```bash
npm test --prefix ingestion
```

The tests cover diagnosis/fingerprinting, evaluation metrics, statistical calculations and span-tree reconstruction.

Build and lint the dashboard:

```bash
npm run build --prefix waterfall-dashboard
npm run lint --prefix waterfall-dashboard
```

## Controlled anomaly evaluation

With the Docker Compose stack running:

```bash
npm run evaluate --prefix ingestion
```

The evaluation runner first sends five normal warm-up requests, then runs six labelled scenarios ten times each (60 evaluation requests). It writes the detailed report to `ingestion/evaluation/results/latest.json`.

The report includes detection confusion-matrix metrics (accuracy, precision, recall, F1 and false-positive rate) and root-cause ranking metrics (Top-1, Top-3 and end-to-end Top-1). Do not describe these as production accuracy: the workload is simulated, sequential and limited to the listed scenarios.

## API

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/health` | Ingestion/MongoDB health; Redis is optional |
| POST | `/ingest` | Validate and persist a trace with spans |
| GET | `/api/v1/traces` | List recent traces |
| GET | `/api/v1/traces/:traceId` | Fetch one trace (Redis cache when available) |
| GET | `/api/v1/traces/:traceId/tree` | Reconstruct the span hierarchy |
| GET | `/api/v1/traces/:traceId/diagnosis` | Compare against similar healthy traces |

## Diagnosis approach

The detector compares traces with the same normalized route and span structure. It requires at least five comparable healthy traces before making a latency decision. It calculates median, p95 and median absolute deviation (MAD) from baseline request durations to derive a threshold. HTTP 5xx responses are immediately marked anomalous. For anomalies, leaf spans are ranked using excess duration and slowdown factor against operation-level historical medians.

This is a transparent statistical heuristic, not a trained machine-learning model. A ranked span is a diagnostic lead and should be investigated, not treated as confirmed causality.

## Current scope and limitations

- Instrumentation is manual; this is not yet a general-purpose installable SDK.
- The demo workload uses simulated delays, not real payment, inventory or database services.
- The evaluation is a small synthetic test suite, not a production benchmark.
- Redis is an optional cache, not a durable queue.
- WebSocket notifications trigger a dashboard refresh; they do not stream every span incrementally.
- Authentication, multi-tenant isolation, OpenTelemetry/OTLP ingestion, alerting, retention policies and cloud deployment are not implemented.
- Docker Compose is for local development, not a production deployment.

## Repository layout

- `demo-app/`: Express demo workload and tracing middleware.
- `ingestion/`: ingestion/query API, diagnosis, persistence, WebSocket service and tests.
- `waterfall-dashboard/`: React/Vite trace waterfall UI.
- `docker-compose.yml`: local multi-service environment.
