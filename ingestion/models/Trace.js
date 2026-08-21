const mongoose = require('mongoose');

const traceSchema = new mongoose.Schema({
  traceId: {
    type: String,
    required: true,
    index: true
  },
  timestamp: {
    type: Date,
    required: true
  },
  method: {
    type: String,
    required: true
  },
  path: {
    type: String,
    required: true
  },
  statusCode: {
    type: Number,
    required: true
  },
  duration: {
    type: Number,
    required: true
  },
  userAgent: String,
  ip: String
}, {
  timestamps: true
});

module.exports = mongoose.model('Trace', traceSchema);
