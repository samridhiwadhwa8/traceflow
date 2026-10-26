# Architecture Diagram

This document describes TraceFlow's target architecture for the full project. Components labeled planned or future are roadmap items, not claims about the current implementation. The same diagrams are included in the repository README.

## Application Architecture

<!-- mermaid-checked: no \n, no em-dash/en-dash, no {} in labels, subgraphs are id["label"], arrows are -->|"label"|, all subgraphs closed by end, ids unique -->
```mermaid
flowchart TD
    subgraph ClientLayer["Developer and Browser"]
        Developer["Developer application"]
        Browser["Dashboard user"]
    end

    subgraph InstrumentationLayer["Instrumentation"]
        App["Instrumented Node.js service"]
        SDK["TraceFlow Node.js SDK"]
        OTel["OpenTelemetry input - planned"]
    end

    subgraph BackendLayer["TraceFlow backend"]
        Ingest["Ingestion API"]
        Guard["Authentication, API keys and validation - planned"]
        Process["Trace processing"]
        Diagnosis["Statistical trace diagnosis"]
        REST["Versioned REST API with search and pagination"]
        Live["WebSocket live events"]
        Retention["Sampling and retention - planned"]
        Queue["Queue and workers - future"]
    end

    subgraph StorageLayer["Storage"]
        Mongo[("MongoDB traces and spans")]
        Redis[("Redis cache")]
    end

    subgraph PresentationLayer["Dashboard"]
        UI["React trace explorer and waterfall"]
        Metrics["Latency, error, SLO and service map views - planned"]
    end

    subgraph OperationsLayer["Operations"]
        Compose["Docker Compose local development"]
        CI["CI, tests and dependency scanning - planned"]
        Cloud["Cloud deployment - planned"]
    end

    Developer -->|"runs requests"| App
    App -->|"instrumented by"| SDK
    SDK -->|"POST trace and spans"| Ingest
    OTel -.->|"OTLP receiver - planned"| Ingest
    Ingest -->|"authenticate and validate - planned"| Guard
    Guard -->|"accepted telemetry"| Process
    Ingest -->|"202 accepted response"| SDK
    Process -->|"store trace and spans"| Mongo
    Process -->|"compare matching route and span structure"| Diagnosis
    Diagnosis -->|"load baseline and span records"| Mongo
    Diagnosis -->|"diagnosis JSON"| REST
    REST -->|"analyze selected trace"| Diagnosis
    Process -.->|"apply sampling and retention - planned"| Retention
    Retention -.->|"expire old trace data - planned"| Mongo
    Process -->|"publish new trace event"| Live
    Process -.->|"enqueue when scale requires it"| Queue
    Queue -.->|"process asynchronously - future"| Process

    Browser -->|"opens dashboard"| UI
    UI -->|"request traces, spans and diagnosis"| REST
    REST -->|"read and query"| Mongo
    REST -->|"cache lookup and response"| Redis
    Mongo -->|"trace and span records"| REST
    Redis -->|"cached trace when available"| REST
    REST -->|"JSON API response"| UI
    UI -->|"render waterfall and diagnosis"| Browser
    Live -->|"push new trace event"| UI
    Process -->|"latency and error aggregates - planned"| Metrics
    Metrics -->|"show service health - planned"| UI

    Compose -.->|"starts local services"| App
    Compose -.->|"starts local services"| Ingest
    Compose -.->|"starts local services"| Mongo
    Compose -.->|"starts local services"| Redis
    Compose -.->|"starts local services"| UI
    CI -.->|"checks code and images - planned"| Ingest
    CI -.->|"checks dashboard - planned"| UI
    Cloud -.->|"hosts production services - planned"| App
    Cloud -.->|"hosts production services - planned"| Ingest
    Cloud -.->|"hosts production services - planned"| Mongo
    Cloud -.->|"hosts production services - planned"| UI
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
