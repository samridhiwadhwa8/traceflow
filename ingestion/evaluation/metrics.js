function calculateDetectionMetrics(rows) {
  const totals = { tp: 0, tn: 0, fp: 0, fn: 0 };

  for (const row of rows) {
    const actual = row.expectedAnomaly;
    const predicted = row.actualAnomaly === true;

    if (actual && predicted) totals.tp += 1;
    else if (!actual && !predicted) totals.tn += 1;
    else if (!actual && predicted) totals.fp += 1;
    else totals.fn += 1;
  }

  const total = totals.tp + totals.tn + totals.fp + totals.fn;
  const precision = totals.tp + totals.fp
    ? totals.tp / (totals.tp + totals.fp)
    : 0;
  const recall = totals.tp + totals.fn
    ? totals.tp / (totals.tp + totals.fn)
    : 0;

  return {
    ...totals,
    accuracy: total ? (totals.tp + totals.tn) / total : 0,
    precision,
    recall,
    f1: precision + recall ? (2 * precision * recall) / (precision + recall) : 0,
    falsePositiveRate: totals.fp + totals.tn
      ? totals.fp / (totals.fp + totals.tn)
      : 0,
  };
}

function calculateRootCauseMetrics(rows) {
  const anomalies = rows.filter((row) => row.expectedAnomaly && row.expectedRootCause);
  let top1 = 0;
  let top3 = 0;
  let detectedAndRankedCorrectly = 0;

  for (const row of anomalies) {
    const ranking = Array.isArray(row.ranking) ? row.ranking : [];
    if (ranking[0] === row.expectedRootCause) {
      top1 += 1;
      if (row.actualAnomaly === true) detectedAndRankedCorrectly += 1;
    }
    if (ranking.slice(0, 3).includes(row.expectedRootCause)) top3 += 1;
  }

  const total = anomalies.length;
  return {
    evaluated: total,
    top1Accuracy: total ? top1 / total : 0,
    top3Accuracy: total ? top3 / total : 0,
    endToEndTop1Accuracy: total ? detectedAndRankedCorrectly / total : 0,
  };
}

module.exports = { calculateDetectionMetrics, calculateRootCauseMetrics };
