require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const { createClient } = require('redis');
const cors = require('cors');
const Trace = require('./models/Trace');
const Span = require('./models/Span');
const websocket = require('./websocket');
const { buildSpanTree } = require('./spanTree');
const { analyzeTrace, normalizeRoute } = require('./diagnostics');

const app = express();
const PORT = Number(process.env.INGESTION_PORT) || 4000;

app.use(cors());
app.use(express.json());

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/traceflow';
mongoose.connect(MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Redis connection (optional - will work without Redis)
const redis = createClient({
  url: process.env.REDIS_URL || 'redis://127.0.0.1:6379'
});

redis.on('error', err => console.error('Redis Error:', err));
redis.connect()
  .then(() => console.log('Connected to Redis'))
  .catch(err => {
    console.warn('Redis not available - caching disabled:', err.message);
  });

// Ingest endpoint
app.post('/ingest', async (req, res) => {
  try {
    const { trace, spans = [] } = req.body || {};

    if (
      !trace ||
      typeof trace.traceId !== 'string' ||
      !Array.isArray(spans) ||
      spans.some((span) => !span || span.traceId !== trace.traceId)
    ) {
      return res.status(400).json({
        error: 'A trace and an array of spans belonging to that trace are required'
      });
    }
    
    // Save trace
    const traceDoc = new Trace(trace);
    await traceDoc.save();
    
    // Save spans if provided
    if (spans && spans.length > 0) {
      await Span.insertMany(spans);
      console.log(`[Ingestion] Received trace: ${trace.traceId} with ${spans.length} spans`);
    } else {
      console.log(`[Ingestion] Received trace: ${trace.traceId}`);
    }

    // Broadcast to connected dashboards
    websocket.broadcast({
      type: "new_trace",
      trace: trace,
      spans: spans
    });

    res.status(202).json({ message: 'Trace ingested successfully' });
  } catch (error) {
    console.error('[Ingestion] Error saving trace:', error);
    res.status(500).json({ error: 'Failed to ingest trace' });
  }
});

// Health check
app.get('/health', (req, res) => {
  const mongoReady = mongoose.connection.readyState === 1;
  const status = mongoReady ? 'ok' : 'unavailable';

  res.status(mongoReady ? 200 : 503).json({
    status,
    services: {
      mongodb: mongoReady ? 'connected' : 'unavailable',
      redis: redis.isReady ? 'connected' : 'unavailable (optional)'
    }
  });
});

// Get all traces (for debugging)
app.get('/api/v1/traces', async (req, res) => {
  try {
    const traces = await Trace.find().sort({ createdAt: -1 }).limit(100);
    res.json(traces);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch traces' });
  }
});

// Get single trace by ID with Redis caching
app.get('/api/v1/traces/:traceId', async (req, res) => {
  const traceId = req.params.traceId;
  const cacheKey = `trace:${traceId}`;

  try {
    const cached = redis.isReady ? await redis.get(cacheKey).catch((error) => {
      console.warn('Redis read failed; falling back to MongoDB:', error.message);
      return null;
    }) : null;

    if (cached) {
      return res.json(JSON.parse(cached));
    }

    const trace = await Trace.findOne({ traceId });

    if (!trace) {
      return res.status(404).json({ error: 'Trace not found' });
    }

    if (redis.isReady) {
      await redis.set(cacheKey, JSON.stringify(trace), { EX: 60 }).catch((error) => {
        console.warn('Redis cache write failed:', error.message);
      });
    }
    res.json(trace);
  } catch (error) {
    console.error('Error fetching trace:', error);
    res.status(500).json({ error: 'Failed to fetch trace' });
  }
});

app.get('/api/v1/traces/:traceId/diagnosis', async (req, res) => {
  try {
    const { traceId } = req.params;
    const trace = await Trace.findOne({ traceId }).lean();

    if (!trace) {
      return res.status(404).json({ error: 'Trace not found' });
    }

    const spans = await Span.find({ traceId }).lean();
    const routePattern = new RegExp(
      `^${normalizeRoute(trace.route).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\?.*)?$`
    );
    const baselineTraces = await Trace.find({
      traceId: { $ne: traceId },
      status: { $lt: 500 },
      route: routePattern
    })
      .sort({ timestamp: -1 })
      .limit(200)
      .lean();
    const baselineTraceIds = baselineTraces.map((item) => item.traceId);
    const baselineSpans = baselineTraceIds.length
      ? await Span.find({ traceId: { $in: baselineTraceIds } }).lean()
      : [];

    res.json(analyzeTrace({
      trace,
      spans,
      baselineTraces,
      baselineSpans
    }));
  } catch (error) {
    console.error('Error analyzing trace:', error);
    res.status(500).json({ error: 'Failed to analyze trace' });
  }
});

// Get span tree for a trace
app.get('/api/v1/traces/:traceId/tree', async (req, res) => {
  try {
    const { traceId } = req.params;

    const spans = await Span.find({ traceId })
      .sort({ startTime: 1 })
      .lean();

    if (spans.length === 0) {
      return res.status(404).json({
        error: 'No spans found for this trace'
      });
    }

    const roots = buildSpanTree(spans);

    res.json({
      traceId,
      spanCount: spans.length,
      roots
    });
  } catch (error) {
    console.error('Error building span tree:', error);

    res.status(500).json({
      error: 'Failed to build span tree'
    });
  }
});

app.listen(PORT, () => {
  console.log(`Ingestion server running on http://localhost:${PORT}`);
});
