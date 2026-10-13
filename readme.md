# TraceFlow v1.0

A distributed tracing system for monitoring application performance with real-time waterfall visualization, statistical analysis, and span tree reconstruction.

## Architecture

```
DEMO APP (localhost:3000)
     │
     ▼
TraceFlow Middleware (Real Instrumentation)
     │
     │ performance.now() timing
     ▼
  traceId + spans with real durations
     │
     ▼
POST /ingest
     │
     ▼
INGESTION SERVER (localhost:4000)
     │
     ├────────→ MongoDB (traces + spans)
     │
     ├────────→ Redis (caching)
     │
     └────────→ WebSocket (localhost:8080)
                    │
                    ▼
            WATERFALL DASHBOARD (localhost:5173)
                    │
                    ▼
            Real-time trace visualization
```

## Features

### Core Capabilities
- **Real Span Instrumentation**: Uses `performance.now()` for accurate timing measurements
- **Span Tree Reconstruction**: Rebuilds hierarchical parent-child relationships from flat span data
- **Waterfall Visualization**: Timeline-based view showing operation execution order and overlaps
- **Statistical Analysis**: Calculates mean, standard deviation, percentiles (p50, p95, p99), EWMA, and IQR
- **Live Updates**: WebSocket integration for real-time dashboard updates
- **Caching**: Redis integration for improved query performance

### API Endpoints
- `POST /ingest` - Ingest trace data
- `GET /health` - Health check
- `GET /api/v1/traces` - List all traces
- `GET /api/v1/traces/:traceId` - Get specific trace (with Redis caching)
- `GET /api/v1/traces/:traceId/tree` - Get hierarchical span tree for waterfall visualization

## Project Structure

```
TraceFlow/
├── demo-app/              # Demo application monitored by TraceFlow
│   ├── server.js          # Express server with demo endpoints
│   ├── traceflow.js       # TraceFlow middleware with real instrumentation
│   └── package.json
│
├── ingestion/             # TraceFlow backend for receiving telemetry
│   ├── server.js          # Ingestion server with CORS and WebSocket
│   ├── websocket.js       # WebSocket server for live updates
│   ├── statistics.js      # Statistical analysis module
│   ├── spanTree.js        # Span tree reconstruction
│   ├── models/
│   │   ├── Trace.js       # MongoDB Trace model
│   │   └── Span.js        # MongoDB Span model (with endTime)
│   ├── test-statistics.js # Statistics testing
│   └── package.json
│
├── waterfall-dashboard/    # React waterfall visualization
│   ├── src/
│   │   ├── components/
│   │   │   └── SpanWaterfall.jsx  # Main waterfall component
│   │   └── App.jsx
│   └── package.json
│
└── README.md
```

## Setup

### Prerequisites
- Node.js
- MongoDB (running on localhost:27017 or MongoDB Atlas)
- Redis (running on localhost:6379) - optional but recommended
- Docker (for Redis)

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

3. Install dependencies for waterfall dashboard:
```bash
cd waterfall-dashboard
npm install
```

4. Start Redis with Docker:
```bash
docker run -d -p 6379:6379 --name traceflow-redis redis
```

## Running

### Start Redis (if not running)
```bash
docker start traceflow-redis
```

### Start Ingestion Server (localhost:4000)
```bash
cd ingestion
npm start
```
This starts:
- HTTP API on port 4000
- WebSocket server on port 8080

### Start Demo App (localhost:3000)
```bash
cd demo-app
npm start
```

### Start Waterfall Dashboard (localhost:5173)
```bash
cd waterfall-dashboard
npm run dev
```

## Testing

### Generate Traces via Postman/curl
```bash
# Simple request
curl http://localhost:3000

# Users endpoint (auth + database spans)
curl http://localhost:3000/api/users

# Slow endpoint (slow database span)
curl http://localhost:3000/api/slow

# Checkout endpoint (auth + inventory + payment + database spans)
curl -X POST http://localhost:3000/checkout
```

### Test API Endpoints
```bash
# Health check
curl http://localhost:4000/health

# List all traces
curl http://localhost:4000/api/v1/traces

# Get specific trace
curl http://localhost:4000/api/v1/traces/{traceId}

# Get span tree for waterfall
curl http://localhost:4000/api/v1/traces/{traceId}/tree
```

### Test Statistics
```bash
cd ingestion
node test-statistics.js          # Test with sample data
node test-mongodb-statistics.js  # Test with real MongoDB data
```

## Trace Event Schema

### Trace
```javascript
{
  traceId: String,      // Unique identifier for the request
  timestamp: Date,      // When the request was made
  method: String,       // HTTP method (GET, POST, etc.)
  route: String,        // Request route
  status: Number,       // HTTP response status
  duration: Number      // Request duration in milliseconds
}
```

### Span
```javascript
{
  traceId: String,      // Which trace this span belongs to
  spanId: String,       // Unique ID for this operation
  parentSpanId: String, // ID of the parent operation (null for root)
  operation: String,    // Name of the operation (auth, database, etc.)
  startTime: Date,      // When the operation started
  endTime: Date,        // When the operation finished
  durationMs: Number,   // Operation duration in milliseconds
  status: String        // Operation status (OK, ERROR)
}
```

## Statistics Module

The statistics module provides the following metrics for span duration analysis:

- **Mean**: Average duration
- **Standard Deviation**: Measure of variability
- **p50/p95/p99**: Percentiles for latency analysis
- **EWMA**: Exponentially Weighted Moving Average for trend detection
- **IQR**: Interquartile Range for outlier detection

## Waterfall Visualization

The waterfall dashboard shows:
- **Hierarchical Structure**: Parent-child relationships with indentation
- **Timeline Position**: When each operation started relative to the trace
- **Duration**: How long each operation took
- **Status**: Success/failure indicators
- **Live Updates**: Real-time updates via WebSocket

## Current Limitations

1. **Demo Timing**: The demo app uses simulated timing patterns rather than measuring actual operation execution
2. **Manual Instrumentation**: Requires manual span creation in application code
3. **Basic Anomaly Detection**: Statistical thresholds not yet implemented
4. **Single Endpoint**: Currently designed for single-server applications

## Future Enhancements

- Automatic instrumentation
- Multi-service distributed tracing
- Machine learning-based anomaly detection
- Root cause analysis
- Service dependency mapping
- Alerting and notifications
