const test = require("node:test");
const assert = require("node:assert/strict");
const {
  calculateDetectionMetrics,
  calculateRootCauseMetrics,
} = require("./evaluation/metrics");

test("calculates the detection confusion matrix and derived metrics", () => {
  const metrics = calculateDetectionMetrics([
    { expectedAnomaly: true, actualAnomaly: true },
    { expectedAnomaly: true, actualAnomaly: false },
    { expectedAnomaly: false, actualAnomaly: true },
    { expectedAnomaly: false, actualAnomaly: false },
  ]);

  assert.deepEqual(
    { tp: metrics.tp, tn: metrics.tn, fp: metrics.fp, fn: metrics.fn },
    { tp: 1, tn: 1, fp: 1, fn: 1 }
  );
  assert.equal(metrics.accuracy, 0.5);
  assert.equal(metrics.precision, 0.5);
  assert.equal(metrics.recall, 0.5);
  assert.equal(metrics.f1, 0.5);
  assert.equal(metrics.falsePositiveRate, 0.5);
});

test("calculates top-one, top-three, and end-to-end root-cause accuracy", () => {
  const metrics = calculateRootCauseMetrics([
    { expectedAnomaly: true, expectedRootCause: "process_payment", actualAnomaly: true, ranking: ["process_payment", "update_inventory"] },
    { expectedAnomaly: true, expectedRootCause: "update_inventory", actualAnomaly: true, ranking: ["process_payment", "update_inventory"] },
    { expectedAnomaly: true, expectedRootCause: "send_confirmation", actualAnomaly: false, ranking: ["process_payment", "send_confirmation"] },
  ]);

  assert.equal(metrics.evaluated, 3);
  assert.equal(metrics.top1Accuracy, 1 / 3);
  assert.equal(metrics.top3Accuracy, 1);
  assert.equal(metrics.endToEndTop1Accuracy, 1 / 3);
});
