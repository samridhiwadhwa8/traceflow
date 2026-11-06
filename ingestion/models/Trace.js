const mongoose = require('mongoose');

const traceSchema = new mongoose.Schema({
  traceId: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    required: true
  },
  method: {
    type: String,
    required: true
  },
  route: {
    type: String,
    required: true
  },
  faultType: {
    type: String,
    default: "normal"
  },
  status: {
    type: Number,
    required: true
  },
  duration: {
    type: Number,
    required: true
  }
}, {
  timestamps: true
});
traceSchema.index({ traceId: 1 });
traceSchema.index({ route: 1 });
traceSchema.index({ timestamp: -1 });
module.exports = mongoose.model('Trace', traceSchema);
