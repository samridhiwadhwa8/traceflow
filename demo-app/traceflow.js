const { AsyncLocalStorage } = require('async_hooks');
const crypto = require('crypto');

const storage = new AsyncLocalStorage();
const INGESTION_URL = 'http://localhost:4000/ingest';

function traceflow(req, res, next) {
  const traceId = crypto.randomUUID();
  const start = Date.now();

  storage.run({ traceId }, () => {
    const spans = [];
    const spanStarts = {};

    // Helper to create a span
    const createSpan = (operation, parentSpanId = null) => {
      const spanId = crypto.randomUUID();
      const spanStart = Date.now();
      spanStarts[spanId] = spanStart;
      
      return {
        spanId,
        parentSpanId,
        operation,
        startTime: new Date().toISOString()
      };
    };

    // Simulate spans for different routes
    if (req.originalUrl.includes('/checkout')) {
      spans.push(createSpan('auth'));
      spans.push(createSpan('inventory', spans[0].spanId));
      spans.push(createSpan('payment', spans[0].spanId));
      spans.push(createSpan('database', spans[1].spanId));
    } else if (req.originalUrl.includes('/api/users')) {
      spans.push(createSpan('auth'));
      spans.push(createSpan('database', spans[0].spanId));
    } else if (req.originalUrl.includes('/api/slow')) {
      spans.push(createSpan('database'));
    }

    res.on('finish', async () => {
      const duration = Date.now() - start;

      // Calculate span durations
      const completedSpans = spans.map(span => ({
        ...span,
        traceId,
        durationMs: Math.floor(Math.random() * 100) + 10,
        status: 'OK'
      }));

      const trace = {
        traceId,
        timestamp: new Date().toISOString(),
        method: req.method,
        route: req.originalUrl,
        status: res.statusCode,
        duration
      };

      try {
        const response = await fetch(INGESTION_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            trace,
            spans: completedSpans
          })
        });
        
        if (!response.ok) {
          console.error('Failed to send trace:', response.status, response.statusText);
        } else {
          console.log(`Trace sent successfully: ${traceId} with ${completedSpans.length} spans`);
        }
      } catch (error) {
        console.error('Failed to send trace:', error.message);
      }
    });

    next();
  });
}

module.exports = {
  traceflow,
  storage
};
