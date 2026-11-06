const Span = require("./models/Span");

function mean(values) {
  if (!values || values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function standardDeviation(values) {
  if (!values || values.length < 2) return 0;
  const average = mean(values);
  return Math.sqrt(mean(values.map((value) => (value - average) ** 2)));
}

function percentile(values, percent) {
  if (!values || values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (percent / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

function ewma(values, alpha = 0.2) {
  if (!values || values.length === 0) return 0;
  if (!Number.isFinite(alpha) || alpha <= 0 || alpha > 1) {
    throw new RangeError("alpha must be greater than 0 and at most 1");
  }
  return values.slice(1).reduce(
    (current, value) => alpha * value + (1 - alpha) * current,
    values[0]
  );
}

function iqr(values) {
  if (!values || values.length < 4) return 0;
  return percentile(values, 75) - percentile(values, 25);
}

function calculateStatistics(values) {
  if (!values || values.length === 0) {
    return {
      count: 0, mean: 0, standardDeviation: 0,
      p50: 0, p95: 0, p99: 0, ewma: 0, iqr: 0
    };
  }

  return {
    count: values.length,
    mean: mean(values),
    standardDeviation: standardDeviation(values),
    p50: percentile(values, 50),
    p95: percentile(values, 95),
    p99: percentile(values, 99),
    ewma: ewma(values),
    iqr: iqr(values),
  };
}

function groupByOperation(spans) {
  const grouped = {};
  for (const span of spans) {
    if (!grouped[span.operation]) grouped[span.operation] = [];
    grouped[span.operation].push(span.durationMs);
  }
  return grouped;
}

async function getSpanStatistics(startTime, endTime) {
  const spans = await Span.find({
    startTime: { $gte: startTime, $lte: endTime },
  }).select("operation durationMs");

  const grouped = groupByOperation(spans);
  return Object.fromEntries(
    Object.entries(grouped).map(([operation, durations]) => [
      operation,
      calculateStatistics(durations),
    ])
  );
}

module.exports = {
  mean,
  standardDeviation,
  percentile,
  ewma,
  iqr,
  calculateStatistics,
  groupByOperation,
  getSpanStatistics,
};
