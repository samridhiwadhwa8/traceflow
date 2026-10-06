const mongoose = require('mongoose');

const spanSchema = new mongoose.Schema({
  traceId: {
    type: String,
    required: true
  },
  spanId: {
    type: String,
    required: true
  },
  parentSpanId: String,
  operation: {
    type: String,
    required: true
  },
  durationMs: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    required: true
  },
  startTime: {
    type: Date,
    required: true
  }
}, {
  timestamps: true
});

spanSchema.index({ traceId: 1 });

module.exports = mongoose.model('Span', spanSchema);
