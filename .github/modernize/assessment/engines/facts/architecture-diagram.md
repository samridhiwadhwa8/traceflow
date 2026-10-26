# Architecture Diagram

This document describes TraceFlow's target architecture for the full project. Components labeled planned or future are roadmap items, not claims about the current implementation. The same diagrams are included in the repository README.

## Application Architecture

### Telemetry ingestion and storage

<!-- mermaid-checked: no \n, no em-dash/en-dash, no {} in labels, subgraphs are id["label"], arrows are -->|"label"|, all subgraphs closed by end, ids unique -->
```mermaid
flowchart TD
    subgraph IngestClient["Application"]
        DeveloperApp["Developer application"]
        TraceSdk["TraceFlow Node.js SDK"]
        OTelInput["OpenTelemetry input planned"]
    end

    subgraph IngestBackend["Ingestion"]
        IngestApi["Ingestion API"]
        TraceStore["MongoDB trace and span storage"]
        LiveEvents["WebSocket live events"]
    end

    DeveloperApp -->|"creates request spans"| TraceSdk
    TraceSdk -->|"POST trace and spans"| IngestApi
    IngestApi -->|"202 accepted response"| TraceSdk
    OTelInput -.->|"OTLP receiver planned"| IngestApi
    IngestApi -->|"validates and stores"| TraceStore
    IngestApi -->|"publishes new trace event"| LiveEvents
```

### Trace exploration and diagnosis

<!-- mermaid-checked: no \n, no em-dash/en-dash, no {} in labels, subgraphs are id["label"], arrows are -->|"label"|, all subgraphs closed by end, ids unique -->
```mermaid
flowchart TD
    subgraph TraceUi["Dashboard"]
        DashboardUser["Dashboard user"]
        ReactDashboard["React trace explorer"]
        Waterfall["Waterfall and diagnosis panel"]
        MetricViews["Metrics and service map planned"]
    end

    subgraph TraceApi["Query and analysis"]
        RestApi["Trace REST API"]
        SpanTree["Span tree builder"]
        DiagnosisEngine["Statistical diagnosis"]
        TraceCache[("Redis optional cache")]
        TraceDatabase[("MongoDB")]
        SocketFeed["WebSocket live events"]
    end

    DashboardUser -->|"opens"| ReactDashboard
    ReactDashboard -->|"selects a trace"| Waterfall
    Waterfall -->|"requests trace and diagnosis"| RestApi
    RestApi -->|"reads trace data"| TraceDatabase
    RestApi -->|"optional cache lookup"| TraceCache
    RestApi -->|"builds span hierarchy"| SpanTree
    RestApi -->|"compares similar traces"| DiagnosisEngine
    DiagnosisEngine -->|"loads baseline spans"| TraceDatabase
    RestApi -->|"returns JSON response"| Waterfall
    SocketFeed -->|"pushes new trace notification"| ReactDashboard
    DiagnosisEngine -.->|"future aggregates"| MetricViews
```

### Local and future deployment

<!-- mermaid-checked: no \n, no em-dash/en-dash, no {} in labels, subgraphs are id["label"], arrows are -->|"label"|, all subgraphs closed by end, ids unique -->
```mermaid
flowchart TD
    LocalCompose["Docker Compose on developer laptop"]
    LocalContainers["Local app, API and dashboard containers"]
    LocalDatabase["Local MongoDB and Redis containers"]
    CloudHost["Cloud container host planned"]
    PublicApp["Public TraceFlow application planned"]
    CloudData["Managed or hosted cloud data services planned"]

    LocalCompose -->|"starts"| LocalContainers
    LocalCompose -->|"starts"| LocalDatabase
    CloudHost -.->|"runs after deployment setup"| PublicApp
    CloudHost -.->|"connects to"| CloudData
```

### Technology Stack Summary

| Layer | Technology | Version | Purpose |
|---|---|---|---|
| Demo application and ingestion | Node.js, Express | See package manifests | Demo workload and HTTP APIs |
| Instrumentation | TraceFlow middleware and manual spans | Project code | Capture request and operation timing |
| Dashboard | React, Vite | See package manifest | Trace explorer and waterfall UI |
| Trace storage | MongoDB, Mongoose | MongoDB 7 in Compose | Persist traces and spans |
| Cache | Redis | Redis 7 in Compose | Optional trace response cache |
| Live updates | WebSocket using `ws` | See package manifest | Notify dashboard of new traces |
| Local orchestration | Docker Compose | Compose specification | Start local services together |
| Queue, workers and OTLP | Not selected | Planned | Future ingestion and scaling integrations |

### Data Storage & External Services

MongoDB stores trace and span records. Redis is an optional cache; stored trace queries should continue to work when Redis is unavailable. The local Compose setup runs these services on the developer's computer. It does not deploy or host TraceFlow in the cloud. A queue, OpenTelemetry receiver, and cloud hosting belong to later project stages.

### Key Architectural Decisions

- Start as a modular application with direct ingestion and MongoDB; add a queue only when a measured reliability or throughput need justifies the added complexity.
- Use matching routes and span structures to compare traces; report statistical evidence as a diagnostic lead, not proof of the root cause.
- Treat Docker Compose as local orchestration. Cloud hosting, production secrets, HTTPS, and durable cloud storage require separate deployment configuration.

## Component Relationships

This view shows how the major modules work together. Planned components are labeled as such and are not claims about the current implementation.

<!-- mermaid-checked: no \n, no em-dash/en-dash, no {} in labels, subgraphs are id["label"], arrows are -->|"label"|, all subgraphs closed by end, ids unique -->
```mermaid
flowchart LR
    subgraph cInstrumentation["Instrumentation"]
        cDemo["Demo application"]
        cSdk["TraceFlow middleware and spans"]
        cOtel["OpenTelemetry receiver - planned"]
    end

    subgraph cBackend["Backend API"]
        cIngest["Ingestion route"]
        cApi["Trace query and diagnosis routes"]
        cValidation["Authentication and validation - planned"]
        cRealtime["WebSocket broadcaster"]
    end

    subgraph cAnalysis["Processing and data"]
        cTree["Span tree builder"]
        cDiagnosis["Statistical diagnosis"]
        cTraceModel["Trace model"]
        cSpanModel["Span model"]
        cMongo["MongoDB"]
        cCache["Redis cache"]
        cQueue["Queue workers - future"]
    end

    subgraph cUi["Presentation"]
        cWaterfall["React waterfall and diagnosis panel"]
        cMetrics["Metrics and service map - planned"]
    end

    cDemo -->|"uses"| cSdk
    cSdk -->|"submits trace payload"| cIngest
    cOtel -.->|"OTLP payload - planned"| cIngest
    cIngest -.->|"protected by - planned"| cValidation
    cIngest -->|"writes trace document"| cTraceModel
    cIngest -->|"writes span documents"| cSpanModel
    cIngest -->|"persists"| cMongo
    cIngest -->|"notifies"| cRealtime
    cApi -->|"loads trace and spans"| cMongo
    cApi -->|"uses optional cache"| cCache
    cApi -->|"builds hierarchy"| cTree
    cApi -->|"compares similar traces"| cDiagnosis
    cRealtime -->|"pushes new trace event"| cWaterfall
    cWaterfall -->|"requests trace and diagnosis JSON"| cApi
    cDiagnosis -.->|"supplies aggregates - planned"| cMetrics
    cQueue -.->|"background processing - future"| cDiagnosis
```

### Component Inventory

| Component | Layer | Type | Responsibility |
|---|---|---|---|
| Demo application | Instrumentation | Express app | Generates requests and sample operations |
| TraceFlow middleware and spans | Instrumentation | Middleware/library code | Creates request context and records manual operation spans |
| OpenTelemetry receiver | Instrumentation | Planned integration | Accepts standard OTLP telemetry |
| Ingestion route | Backend API | Express route | Validates and stores incoming trace payloads |
| Trace query and diagnosis routes | Backend API | Express routes | Serves traces, span trees and statistical diagnosis |
| Authentication and validation | Backend API | Planned middleware | Protects ingestion and scopes access |
| WebSocket broadcaster | Backend API | WebSocket service | Publishes new trace events to connected dashboards |
| Span tree builder | Processing | Utility module | Reconstructs parent-child span relationships |
| Statistical diagnosis | Processing | Analysis module | Flags latency outliers and ranks leaf spans using comparable traces |
| Trace and Span models | Data access | Mongoose models | Define persisted trace and span records |
| MongoDB | Data storage | Document database | Persists trace and span records |
| Redis cache | Data storage | Optional cache | Caches trace reads with MongoDB fallback |
| Queue workers | Processing | Future infrastructure | Decouples ingestion from processing if scale requires it |
| React waterfall and diagnosis panel | Presentation | React UI | Displays trace selection, waterfall and diagnosis evidence |
| Metrics and service map | Presentation | Planned UI | Presents aggregate metrics and service dependencies |
