const mongoose = require('mongoose');

const DecorImageSchema = new mongoose.Schema({
  filename:        { type: String, required: true },
  originalName:    { type: String, required: true },
  filepath:        { type: String, required: true },
  thumbnail:       String,
  eventType:       { type: String, default: 'Wedding' },
  eventId:         String,
  primaryCategory: String,
  primaryLabel:    String,
  confidence:      Number,
  color:           String,
  secondaryDetections: [{
    category: String, label: String, confidence: Number, _id: false
  }],
  allScores:   { type: Map, of: Number },
  modelUsed:   String,
  eventAnalysis: {
    dominantTheme: String, dominantLabel: String,
    dominantConfidence: Number, sequenceLength: Number, modelUsed: String,
  },
  width: Number, height: Number, fileSize: Number, mimeType: String,
}, { timestamps: true });

DecorImageSchema.index({ primaryCategory: 1 });
DecorImageSchema.index({ eventType: 1 });
DecorImageSchema.index({ eventId: 1 });
DecorImageSchema.index({ createdAt: -1 });

module.exports = mongoose.model('DecorImage', DecorImageSchema);
