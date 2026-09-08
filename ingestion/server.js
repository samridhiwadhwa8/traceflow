require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const Trace = require('./models/Trace');

const app = express();
const PORT = 4000;

app.use(express.json());

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://<username>:<password>@<cluster>.mongodb.net/traceflow';
mongoose.connect(MONGODB_URI)
  .then(() => console.log('Connected to MongoDB Atlas'))
  .catch(err => console.error('MongoDB connection error:', err));

// Ingest endpoint
app.post('/ingest', async (req, res) => {
  try {
    const traceEvent = req.body;
    
    const trace = new Trace(traceEvent);
    await trace.save();
    
    console.log(`[Ingestion] Received trace: ${traceEvent.traceId}`);
    res.status(201).json({ message: 'Trace ingested successfully' });
  } catch (error) {
    console.error('[Ingestion] Error saving trace:', error);
    res.status(500).json({ error: 'Failed to ingest trace' });
  }
});

app.get("/traces",async(req,res)=>{
  const traces=await Trace.find();
  res.json(traces);
})
// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Get all traces (for debugging)
app.get('/traces', async (req, res) => {
  try {
    const traces = await Trace.find().sort({ createdAt: -1 }).limit(100);
    res.json(traces);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch traces' });
  }
});

app.listen(PORT, () => {
  console.log(`Ingestion server running on http://localhost:${PORT}`);
});
