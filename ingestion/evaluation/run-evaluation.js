const fs = require("node:fs");
const path = require("node:path");
const {
  calculateDetectionMetrics,
  calculateRootCauseMetrics,
} = require("./metrics");

const DEMO_URL = process.env.DEMO_URL || "http://localhost:3000";
const INGESTION_URL = process.env.INGESTION_URL || "http://localhost:4000";
const groundTruth = JSON.parse(
  fs.readFileSync(path.join(__dirname, "ground-truth.json"), "utf8")
);

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function sendScenario(faultType) {
  const url = `${DEMO_URL}/checkout${
    faultType === "normal" ? "" : `?fault=${encodeURIComponent(faultType)}`
  }`;
  const response = await fetch(url, { method: "POST" });
  const traceId = response.headers.get("x-trace-id");

  if (!traceId) throw new Error(`No trace ID returned for ${faultType}`);

  for (let attempt = 0; attempt < 20; attempt += 1) {
    await sleep(100);
    const diagnosisResponse = await fetch(
      `${INGESTION_URL}/api/v1/traces/${traceId}/diagnosis`
    );
    if (diagnosisResponse.ok) return diagnosisResponse.json();
  }

  throw new Error(`Timed out waiting for diagnosis of ${traceId}`);
}

async function main() {
  const warmups = [];
  for (let index = 0; index < 5; index += 1) {
    warmups.push(await sendScenario("normal"));
  }

  const rows = [];
  for (const scenario of groundTruth) {
    for (let index = 0; index < scenario.repetitions; index += 1) {
      const diagnosis = await sendScenario(scenario.faultType);
      rows.push({
        testId: `${scenario.faultType}_${String(index + 1).padStart(3, "0")}`,
        expectedAnomaly: scenario.expectedAnomaly,
        expectedRootCause: scenario.expectedRootCause,
        actualAnomaly: diagnosis.isAnomaly,
        state: diagnosis.state,
        ranking: (diagnosis.rankedSpans || []).map((span) => span.operation),
      });
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    warmupTraces: warmups.length,
    detection: calculateDetectionMetrics(rows),
    rootCause: calculateRootCauseMetrics(rows),
    rows,
  };

  const resultsDir = path.join(__dirname, "results");
  fs.mkdirSync(resultsDir, { recursive: true });
  const outputPath = path.join(resultsDir, "latest.json");
  fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);

  console.log(JSON.stringify(report, null, 2));
  console.log(`Results written to ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
