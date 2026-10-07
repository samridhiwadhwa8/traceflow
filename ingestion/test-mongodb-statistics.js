require('dotenv').config();
const mongoose = require('mongoose');
const Span = require('./models/Span');
const { getSpanStatistics } = require('./statistics');

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://samridhiwadhwa49:14june2006@cluster0.0y4ablc.mongodb.net/';

async function testMongoDBStatistics() {
    try {
        // Connect to MongoDB
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB');

        // Get statistics for the last 24 hours (wider range to find data)
        const endTime = new Date();
        const startTime = new Date(endTime.getTime() - 24 * 60 * 60 * 1000); // 24 hours ago

        console.log(`Calculating statistics for spans from ${startTime} to ${endTime}`);

        // Check total span count
        const totalSpans = await Span.countDocuments();
        console.log(`Total spans in database: ${totalSpans}`);

        // Check spans in time range
        const spansInRange = await Span.countDocuments({
            startTime: {
                $gte: startTime,
                $lte: endTime
            }
        });
        console.log(`Spans in time range: ${spansInRange}`);

        const statistics = await getSpanStatistics(startTime, endTime);

        console.log('\nStatistics by operation:');
        console.log(JSON.stringify(statistics, null, 2));

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\nDisconnected from MongoDB');
    }
}

testMongoDBStatistics();
