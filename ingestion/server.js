require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const { createClient } = require('redis');
const Trace = require('./models/Trace');
const Span = require('./models/Span');
const websocket = require('./websocket');

const app = express();
const PORT = 4000;

app.use(express.json());

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://<username>:<password>@<cluster>.mongodb.net/traceflow';
mongoose.connect(MONGODB_URI)
  .then(() => console.log('Connected to MongoDB Atlas'))
  .catch(err => console.error('MongoDB connection error:', err));

// Redis connection (optional - will work without Redis)
const redis = createClient({
  url: 'redis://localhost:6379'
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
    const { trace, spans } = req.body;
    
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
  res.json({ status: 'ok' });
});

// Get all traces (for debugging)
app.get('/traces', async (req, res) => {
  try {
    const traces = await Trace.find().sort({ createdAt: -1 }).limit(100);
    res.json(traces);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch traces' });
  }
});

// Get single trace by ID with Redis caching
app.get('/traces/:traceId', async (req, res) => {
  const traceId = req.params.traceId;
  const cacheKey = `trace:${traceId}`;

  try {
    // 1. Check Redis
    const cached = await redis.get(cacheKey);

    if (cached) {
      console.log('CACHE HIT');
      return res.json(JSON.parse(cached));
    }

    console.log('CACHE MISS');

    // 2. Query MongoDB
    const trace = await Trace.findOne({ traceId });

    if (!trace) {
      return res.status(404).json({ error: 'Trace not found' });
    }

    // 3. Store in Redis with 60 second TTL
    await redis.set(
      cacheKey,
      JSON.stringify(trace),
      { EX: 60 }
    );

    // 4. Return result
    res.json(trace);
  } catch (error) {
    console.error('Error fetching trace:', error);
    res.status(500).json({ error: 'Failed to fetch trace' });
  }
});

app.listen(PORT, () => {
  console.log(`Ingestion server running on http://localhost:${PORT}`);
});
