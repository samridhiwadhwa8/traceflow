const test = require("node:test");
const assert = require("node:assert/strict");
const {
  mean,
  standardDeviation,
  percentile,
  ewma,
  iqr,
  calculateStatistics,
  groupByOperation,
} = require("./statistics");

test("calculates mean and population standard deviation", () => {
  assert.equal(mean([2, 4, 6]), 4);
  assert.equal(standardDeviation([2, 4, 6]), Math.sqrt(8 / 3));
  assert.equal(standardDeviation([5]), 0);
});

test("calculates interpolated percentiles", () => {
  assert.equal(percentile([10, 20, 30, 40], 50), 25);
  assert.equal(percentile([10, 20, 30, 40], 95), 38.5);
  assert.equal(percentile([], 95), 0);
});

test("calculates EWMA and validates alpha", () => {
  assert.equal(ewma([10, 20, 30], 0.5), 22.5);
  assert.throws(() => ewma([1, 2], 0), RangeError);
});

test("calculates IQR and grouped operation statistics", () => {
  assert.equal(iqr([1, 2, 3, 4]), 1.5);
  const grouped = groupByOperation([
    { operation: "db", durationMs: 10 },
    { operation: "api", durationMs: 20 },
    { operation: "db", durationMs: 30 },
  ]);
  assert.deepEqual(grouped, { db: [10, 30], api: [20] });
  assert.equal(calculateStatistics([]).count, 0);
  assert.equal(calculateStatistics([10, 20]).p50, 15);
});
