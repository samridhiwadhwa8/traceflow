# TraceFlow v0.1

A distributed tracing system for monitoring application performance.

## Architecture

```
DEMO APP (localhost:3000)
     │
     ▼
TraceFlow Middleware
     │
     │ generates
     ▼
  traceId
     │
     │
request finishes
     │
     ▼
create trace event
     │
     ▼
POST /ingest
     │
     ▼
INGESTION SERVER (localhost:4000)
     │
     ▼
MongoDB
     │
     ▼
traces collection
```

## Project Structure

```
TraceFlow/
├── demo-app/              # Demo application monitored by TraceFlow
│   ├── server.js          # Express server with demo endpoints
│   ├── traceflow.js       # TraceFlow middleware
│   └── package.json
│
├── ingestion/             # TraceFlow backend for receiving telemetry
│   ├── server.js          # Ingestion server
│   ├── models/
│   │   └── Trace.js       # MongoDB Trace model
│   └── package.json
│
└── README.md
```

## Setup

### Prerequisites
- Node.js
- MongoDB (running on localhost:27017)

### Installation

1. Install dependencies for demo-app:
```bash
cd demo-app
npm install
```

2. Install dependencies for ingestion:
```bash
cd ingestion
npm install
```

## Running

### Start Ingestion Server (localhost:4000)
```bash
cd ingestion
npm start
```

### Start Demo App (localhost:3000)
```bash
cd demo-app
npm start
```

## Testing

Make requests to the demo app:
```bash
curl http://localhost:3000
curl http://localhost:3000/api/users
curl http://localhost:3000/api/slow
```

View ingested traces:
```bash
curl http://localhost:4000/traces
```

## Trace Event Schema

```javascript
{
  traceId: String,      // Unique identifier for the request
  timestamp: Date,      // When the request was made
  method: String,       // HTTP method (GET, POST, etc.)
  path: String,         // Request path
  statusCode: Number,   // HTTP response status
  duration: Number,     // Request duration in milliseconds
  userAgent: String,    // User agent header
  ip: String           // Client IP address
}
```
