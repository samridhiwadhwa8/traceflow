require("dotenv").config();
const mongoose = require("mongoose");
const Span = require("./models/Span");
const { getSpanStatistics } = require("./statistics");

// Use an environment variable for hosted databases; otherwise use local MongoDB.
// Never commit database credentials to source code.
const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/traceflow";

async function testMongoDBStatistics() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to MongoDB");

    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - 24 * 60 * 60 * 1000);

    const totalSpans = await Span.countDocuments();
    const spansInRange = await Span.countDocuments({
      startTime: { $gte: startTime, $lte: endTime },
    });

    console.log(`Total spans in database: ${totalSpans}`);
    console.log(`Spans in the last 24 hours: ${spansInRange}`);

    const queryPlan = await Span.find({
      startTime: { $gte: startTime, $lte: endTime },
    }).explain("executionStats");
    console.log("MongoDB query execution stats:");
    console.log(JSON.stringify(queryPlan, null, 2));

    const statistics = await getSpanStatistics(startTime, endTime);
    console.log("Statistics by operation:");
    console.log(JSON.stringify(statistics, null, 2));
  } catch (error) {
    console.error("MongoDB statistics check failed:", error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

testMongoDBStatistics();
