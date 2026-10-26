const test = require("node:test");
const assert = require("node:assert/strict");
const { analyzeTrace, createFingerprint, normalizeRoute } = require("./diagnostics");

function createFixture({ slowPayment = false, status = 200 } = {}) {
  const trace = {
    traceId: "current",
    route: "/checkout?source=test",
    status,
    duration: slowPayment ? 950 : 200,
  };
  const spans = [
    {
      traceId: "current",
      spanId: "root",
      parentSpanId: null,
      operation: "POST /checkout",
      durationMs: trace.duration,
      status: status >= 500 ? "ERROR" : "OK",
    },
    {
      traceId: "current",
      spanId: "payment",
      parentSpanId: "root",
      operation: "process_payment",
      durationMs: slowPayment ? 800 : 100,
      status: "OK",
    },
    {
      traceId: "current",
      spanId: "inventory",
      parentSpanId: "root",
      operation: "update_inventory",
      durationMs: 50,
      status: "OK",
    },
  ];
  const baselineTraces = Array.from({ length: 5 }, (_, index) => ({
    traceId: `baseline-${index}`,
    route: "/checkout",
    status: 200,
    duration: 200 + index,
  }));
  const baselineSpans = baselineTraces.flatMap((baseline, index) => [
    {
      traceId: baseline.traceId,
      spanId: `root-${index}`,
      parentSpanId: null,
      operation: "POST /checkout",
      durationMs: baseline.duration,
      status: "OK",
    },
    {
      traceId: baseline.traceId,
      spanId: `payment-${index}`,
      parentSpanId: `root-${index}`,
      operation: "process_payment",
      durationMs: 95 + index,
      status: "OK",
    },
    {
      traceId: baseline.traceId,
      spanId: `inventory-${index}`,
      parentSpanId: `root-${index}`,
      operation: "update_inventory",
      durationMs: 48 + index,
      status: "OK",
    },
  ]);

  return { trace, spans, baselineTraces, baselineSpans };
}

test("fingerprints ignore IDs, durations, query strings and sibling order", () => {
  const first = createFixture();
  const second = createFixture();
  second.trace.route = "/checkout?source=another";
  second.spans.reverse();
  const newSpanIds = new Map(
    second.spans.map((span) => [span.spanId, `other-${span.spanId}`])
  );
  second.spans.forEach((span) => {
    span.spanId = newSpanIds.get(span.spanId);
    span.parentSpanId = newSpanIds.get(span.parentSpanId) || null;
    span.durationMs += 20;
  });

  assert.equal(createFingerprint(first.spans), createFingerprint(second.spans));
  assert.equal(normalizeRoute("/checkout?source=test"), "/checkout");
});

test("detects a slow request and ranks the span with the largest increase", () => {
  const fixture = createFixture({ slowPayment: true });
  const diagnosis = analyzeTrace(fixture);

  assert.equal(diagnosis.state, "anomaly");
  assert.equal(diagnosis.isAnomaly, true);
  assert.equal(diagnosis.sampleCount, 5);
  assert.equal(diagnosis.rankedSpans[0].operation, "process_payment");
  assert.match(diagnosis.rankedSpans[0].reason, /median/);
});

test("does not flag a normal request against its matching baseline", () => {
  const diagnosis = analyzeTrace(createFixture());

  assert.equal(diagnosis.state, "normal");
  assert.equal(diagnosis.isAnomaly, false);
  assert.deepEqual(diagnosis.rankedSpans, []);
});

test("keeps the detector warming up until enough comparable traces exist", () => {
  const fixture = createFixture();
  fixture.baselineTraces = fixture.baselineTraces.slice(0, 2);
  fixture.baselineSpans = fixture.baselineSpans.filter((span) =>
    fixture.baselineTraces.some((trace) => trace.traceId === span.traceId)
  );

  const diagnosis = analyzeTrace(fixture);

  assert.equal(diagnosis.state, "warming_up");
  assert.equal(diagnosis.isAnomaly, null);
  assert.equal(diagnosis.sampleCount, 2);
  assert.match(diagnosis.message, /2 of 5/);
});

test("reports request errors even while the latency baseline is warming up", () => {
  const fixture = createFixture({ status: 500 });
  fixture.baselineTraces = [];
  fixture.baselineSpans = [];

  const diagnosis = analyzeTrace(fixture);

  assert.equal(diagnosis.state, "anomaly");
  assert.equal(diagnosis.isAnomaly, true);
  assert.match(diagnosis.message, /HTTP 500/);
});

test("does not compare traces with different span structures", () => {
  const fixture = createFixture();
  fixture.spans.pop();

  const diagnosis = analyzeTrace(fixture);

  assert.equal(diagnosis.state, "warming_up");
  assert.equal(diagnosis.sampleCount, 0);
});
