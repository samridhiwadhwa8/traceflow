const { AsyncLocalStorage } = require('async_hooks');
const { performance } = require('perf_hooks');
const crypto = require('crypto');

const storage = new AsyncLocalStorage();
const INGESTION_URL = 'http://localhost:4000/ingest';

function traceflow(req, res, next) {
  const traceId = crypto.randomUUID();
  const traceStart = performance.now();
  const requestStartTime = new Date();

  storage.run({ traceId }, () => {
    const spans = [];
    const spanStarts = {};

    // Helper to create a span with timing
    const createSpan = (operation, parentSpanId = null) => {
      const spanId = crypto.randomUUID();
      const spanStart = performance.now();
      spanStarts[spanId] = spanStart;

      return {
        spanId,
        parentSpanId,
        operation,
        startTime: new Date(requestStartTime.getTime() + (spanStart - traceStart)).toISOString()
      };
    };

    // Simulate spans for different routes (created at their logical start times)
    if (req.originalUrl.includes('/checkout')) {
      spans.push(createSpan('auth'));
      spans.push(createSpan('inventory'));
      spans.push(createSpan('payment'));
      spans.push(createSpan('database'));
    } else if (req.originalUrl.includes('/api/users')) {
      spans.push(createSpan('auth'));
      spans.push(createSpan('database'));
    } else if (req.originalUrl.includes('/api/slow')) {
      spans.push(createSpan('database'));
    }

    res.on('finish', async () => {
      const traceEnd = performance.now();
      const duration = Math.round(traceEnd - traceStart);

      // Calculate span durations based on their actual execution time
      const completedSpans = spans.map((span, index) => {
        const spanStart = spanStarts[span.spanId] || traceStart;
        const spanEnd = performance.now();
        const durationMs = Math.round(spanEnd - spanStart);
        const endTime = new Date(requestStartTime.getTime() + (spanEnd - traceStart)).toISOString();

        // Set parent-child relationships for checkout
        if (req.originalUrl.includes('/checkout')) {
          if (index === 0) {
            // auth is root
            span.parentSpanId = null;
          } else if (index === 1 || index === 2) {
            // inventory and payment are children of auth
            span.parentSpanId = spans[0].spanId;
          } else if (index === 3) {
            // database is child of inventory
            span.parentSpanId = spans[1].spanId;
          }
        } else if (req.originalUrl.includes('/api/users')) {
          if (index === 0) {
            span.parentSpanId = null; // auth is root
          } else {
            span.parentSpanId = spans[0].spanId; // database is child of auth
          }
        }

        return {
          ...span,
          traceId,
          durationMs,
          endTime,
          status: 'OK'
        };
      });

      const trace = {
        traceId,
        timestamp: requestStartTime.toISOString(),
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
