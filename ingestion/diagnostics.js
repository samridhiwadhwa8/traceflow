const crypto = require("node:crypto");

function normalizeRoute(route) {
  const path = String(route || "").split("?")[0];
  const normalized = path.replace(/\/+$/, "");
  return normalized || "/";
}

function createFingerprint(spans) {
  if (!Array.isArray(spans) || spans.length === 0) {
    return null;
  }

  const spansById = new Map(spans.map((span) => [span.spanId, span]));
  const shape = spans
    .map((span) => ({
      operation: String(span.operation || ""),
      parentOperation: span.parentSpanId
        ? String(spansById.get(span.parentSpanId)?.operation || "unknown")
        : null,
    }))
    .sort((left, right) => {
      const leftKey = `${left.parentOperation || ""}:${left.operation}`;
      const rightKey = `${right.parentOperation || ""}:${right.operation}`;
      return leftKey.localeCompare(rightKey);
    });

  return crypto
    .createHash("sha256")
    .update(JSON.stringify(shape))
    .digest("hex")
    .slice(0, 16);
}

function median(values) {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function percentile(values, percent) {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const index = (percent / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);

  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

function analyzeTrace({
  trace,
  spans,
  baselineTraces,
  baselineSpans,
  minSamples = 5,
}) {
  const traceSpans = Array.isArray(spans) ? spans : [];
  const fingerprint = createFingerprint(traceSpans);
  const spansByTraceId = new Map();

  for (const span of baselineSpans || []) {
    if (!spansByTraceId.has(span.traceId)) {
      spansByTraceId.set(span.traceId, []);
    }
    spansByTraceId.get(span.traceId).push(span);
  }

  const matchingTraces = (baselineTraces || []).filter((candidate) => {
    if (
      candidate.traceId === trace.traceId ||
      Number(candidate.status) >= 500 ||
      normalizeRoute(candidate.route) !== normalizeRoute(trace.route)
    ) {
      return false;
    }

    return createFingerprint(spansByTraceId.get(candidate.traceId)) === fingerprint;
  });
  const matchingTraceIds = new Set(
    matchingTraces.map((candidate) => candidate.traceId)
  );

  const baselineDurations = matchingTraces
    .map((candidate) => Number(candidate.duration))
    .filter(Number.isFinite);
  const baselineMedianMs = median(baselineDurations);
  const baselineP95Ms = percentile(baselineDurations, 95);
  const medianAbsoluteDeviation = median(
    baselineDurations.map((duration) => Math.abs(duration - baselineMedianMs))
  );
  const thresholdMs = Math.max(
    baselineP95Ms * 1.5,
    baselineMedianMs + 3 * medianAbsoluteDeviation * 1.4826,
    baselineMedianMs + 1
  );
  const statusCode = Number(trace.status);
  const durationMs = Number(trace.duration);
  const hasBaseline = baselineDurations.length >= minSamples;
  const requestFailed = statusCode >= 500;
  const isSlow =
    hasBaseline && Number.isFinite(durationMs) && durationMs > thresholdMs;
  const isAnomaly = requestFailed ? true : hasBaseline ? isSlow : null;
  const state = isAnomaly === true
    ? "anomaly"
    : isAnomaly === false
      ? "normal"
      : "warming_up";

  let message;
  if (requestFailed) {
    message = `The request returned HTTP ${statusCode}.`;
  } else if (!hasBaseline) {
    message = `Collecting a baseline: ${baselineDurations.length} of ${minSamples} similar healthy traces are available.`;
  } else if (isSlow) {
    message = `The request took ${Math.round(durationMs)} ms, above the ${Math.round(thresholdMs)} ms anomaly threshold for similar requests.`;
  } else {
    message = `No latency anomaly detected. The request took ${Math.round(durationMs)} ms.`;
  }

  const parentIds = new Set(
    traceSpans.map((span) => span.parentSpanId).filter(Boolean)
  );
  const durationsByOperation = new Map();
  const durationsByTraceAndOperation = new Map();

  for (const span of baselineSpans || []) {
    const spanDuration = Number(span.durationMs);

    if (
      !matchingTraceIds.has(span.traceId) ||
      span.status === "ERROR" ||
      !Number.isFinite(spanDuration)
    ) {
      continue;
    }

    const key = `${span.traceId}\u0000${span.operation}`;
    if (!durationsByTraceAndOperation.has(key)) {
      durationsByTraceAndOperation.set(key, []);
    }
    durationsByTraceAndOperation.get(key).push(spanDuration);
  }

  for (const [key, durations] of durationsByTraceAndOperation) {
    const operation = key.slice(key.indexOf("\u0000") + 1);
    if (!durationsByOperation.has(operation)) {
      durationsByOperation.set(operation, []);
    }
    durationsByOperation.get(operation).push(
      durations.reduce((sum, value) => sum + value, 0) / durations.length
    );
  }

  const rankedSpans = [];
  if (isAnomaly === true) {
    for (const span of traceSpans) {
      const spanDuration = Number(span.durationMs);
      const operationSamples = durationsByOperation.get(span.operation) || [];
      const isLeaf = !parentIds.has(span.spanId);

      if (
        span.parentSpanId == null ||
        !isLeaf ||
        !Number.isFinite(spanDuration) ||
        (operationSamples.length < minSamples && span.status !== "ERROR")
      ) {
        continue;
      }

      const operationMedianMs = operationSamples.length
        ? median(operationSamples)
        : null;
      const excessMs = operationMedianMs === null
        ? 0
        : Math.max(0, spanDuration - operationMedianMs);
      const slowdownFactor =
        operationMedianMs > 0 ? spanDuration / operationMedianMs : null;

      if (excessMs === 0 && span.status !== "ERROR") {
        continue;
      }

      rankedSpans.push({
        spanId: span.spanId,
        operation: span.operation,
        durationMs: spanDuration,
        baselineMedianMs: operationMedianMs,
        sampleCount: operationSamples.length,
        excessMs,
        slowdownFactor:
          slowdownFactor === null
            ? null
            : Number(slowdownFactor.toFixed(2)),
        reason: span.status === "ERROR"
          ? "This span returned an error."
          : `Took ${Math.round(spanDuration)} ms versus a ${Math.round(operationMedianMs)} ms median for this operation.`,
      });
    }

    rankedSpans.sort(
      (left, right) =>
        right.excessMs - left.excessMs ||
        (right.slowdownFactor || 0) - (left.slowdownFactor || 0)
    );
  }

  return {
    state,
    isAnomaly,
    message,
    fingerprint,
    sampleCount: baselineDurations.length,
    baseline: hasBaseline
      ? {
          medianMs: baselineMedianMs,
          p95Ms: baselineP95Ms,
          thresholdMs,
        }
      : null,
    rankedSpans: rankedSpans.slice(0, 5),
  };
}

module.exports = {
  analyzeTrace,
  createFingerprint,
  normalizeRoute,
};
