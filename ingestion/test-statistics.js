const {
    calculateStatistics
} = require("./statistics");

// Realistic TraceFlow span data
const spans = [
    { operation: "auth", durationMs: 20 },
    { operation: "auth", durationMs: 22 },
    { operation: "auth", durationMs: 21 },

    { operation: "payment", durationMs: 40 },
    { operation: "payment", durationMs: 42 },
    { operation: "payment", durationMs: 45 },
    { operation: "payment", durationMs: 43 },
    { operation: "payment", durationMs: 41 },
    { operation: "payment", durationMs: 450 },

    { operation: "database", durationMs: 18 },
    { operation: "database", durationMs: 20 },
    { operation: "database", durationMs: 19 }
];

console.log("Testing TraceFlow Statistics Module");
console.log("====================================");
console.log("Sample span data:", spans);

// Group spans by operation
const groupedSpans = spans.reduce((acc, span) => {
    if (!acc[span.operation]) {
        acc[span.operation] = [];
    }
    acc[span.operation].push(span.durationMs);
    return acc;
}, {});

console.log("\nGrouped by operation:");
console.log(groupedSpans);

// Calculate statistics for each operation
console.log("\nStatistics by operation:");
for (const [operation, latencies] of Object.entries(groupedSpans)) {
    console.log(`\n${operation}:`);
    console.log(calculateStatistics(latencies));
}
