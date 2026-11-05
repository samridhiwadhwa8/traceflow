const { AsyncLocalStorage } = require("node:async_hooks");
const { performance } = require("node:perf_hooks");
const crypto = require("node:crypto");

const storage = new AsyncLocalStorage();
const INGESTION_URL =
  process.env.TRACEFLOW_INGESTION_URL || "http://localhost:4000/ingest";

// Instrument a real operation.
// Nested withSpan() calls become child spans.
async function withSpan(operation, work) {
  const context = storage.getStore();

  if (!context) {
    // Allows the function to work outside an instrumented request too.
    return work();
  }

  const spanId = crypto.randomUUID();
  const parentSpanId = context.activeSpanId ?? null;

  const startClock = performance.now();
  const startTime = new Date();

  let status = "OK";

  try {
    // Store the original parent context
    const originalActiveSpanId = context.activeSpanId;

    // Run the work with the new span as active
    const result = await storage.run(
      { ...context, activeSpanId: spanId },
      work
    );

    // Restore the original parent context
    context.activeSpanId = originalActiveSpanId;

    return result;
  } catch (error) {
    status = "ERROR";
    // Restore the original parent context even on error
    context.activeSpanId = parentSpanId;
    throw error;
  } finally {
    const endClock = performance.now();
    const endTime = new Date();

    context.spans.push({
      traceId: context.traceId,
      spanId,
      parentSpanId,
      operation,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      durationMs: endClock - startClock,
      status,
    });
  }
}

function traceflow(req, res, next) {
  const traceId = crypto.randomUUID();
  res.setHeader("x-trace-id", traceId);
  const requestStartClock = performance.now();
  const requestStartTime = new Date();
  const rootSpanId = crypto.randomUUID();
  const spans = [];

  const context = {
    traceId,
    spans,
    activeSpanId: rootSpanId,
  };

  // Root span represents the complete incoming HTTP request.
  spans.push({
    traceId,
    spanId: rootSpanId,
    parentSpanId: null,
    operation: `${req.method} ${req.path}`,
    startTime: requestStartTime.toISOString(),
    endTime: null,
    durationMs: null,
    status: "OK",
  });

  storage.run(context, () => {
    res.on("finish", async () => {
      const requestEndClock = performance.now();
      const requestEndTime = new Date();

      spans[0].endTime = requestEndTime.toISOString();
      spans[0].durationMs =
        requestEndClock - requestStartClock;

      spans[0].status =
        res.statusCode >= 500 ? "ERROR" : "OK";

      const trace = {
        traceId,
        timestamp: requestStartTime.toISOString(),
        method: req.method,
        route: req.route && typeof req.route.path === "string"
          ? `${req.baseUrl}${req.route.path}`
          : req.path,
        faultType: String(req.query.fault || "normal"),
        status: res.statusCode,
        duration: Math.round(
          requestEndClock - requestStartClock
        ),
      };

      try {
        const response = await fetch(INGESTION_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ trace, spans }),
        });

        if (!response.ok) {
          console.error(
            "Failed to send trace:",
            response.status,
            response.statusText
          );
        } else {
          console.log(
            `Trace sent successfully: ${traceId} with ${spans.length} spans`
          );
        }
      } catch (error) {
        console.error("Failed to send trace:", error.message);
      }
    });

    next();
  });
}

module.exports = {
  traceflow,
  storage,
  withSpan,
};
