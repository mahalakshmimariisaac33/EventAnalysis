const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const FormData = require('form-data');
const mongoose = require('mongoose');
const DecorImage = require('../models/DecorImage');

// ============== CONSTANTS ==============
const ML_API_URL = process.env.ML_API_URL || 'http://localhost:8000';

const DECOR_CATEGORIES = [
  "flowers_floral", "fabric_draping", "lights_lighting", "balloons",
  "candles_fire", "centerpieces", "greenery_plants", "ribbons_bows",
  "table_settings", "arches_mandap", "backdrop_panels", "other_decor"
];

const LABELS = {
  "flowers_floral": "Flowers & Floral",
  "fabric_draping": "Fabric & Draping",
  "lights_lighting": "Lights & Lighting",
  "balloons": "Balloons",
  "candles_fire": "Candles & Fire",
  "centerpieces": "Centerpieces",
  "greenery_plants": "Greenery & Plants",
  "ribbons_bows": "Ribbons & Bows",
  "table_settings": "Table Settings",
  "arches_mandap": "Arches & Mandap",
  "backdrop_panels": "Backdrop & Panels",
  "other_decor": "Other Decor"
};

const COLORS = {
  "flowers_floral": "#ec4899",
  "fabric_draping": "#8b5cf6",
  "lights_lighting": "#f59e0b",
  "balloons": "#ef4444",
  "candles_fire": "#f97316",
  "centerpieces": "#06b6d4",
  "greenery_plants": "#22c55e",
  "ribbons_bows": "#a855f7",
  "table_settings": "#3b82f6",
  "arches_mandap": "#14b8a6",
  "backdrop_panels": "#6366f1",
  "other_decor": "#6b7280"
};

// ============== MULTER CONFIG ==============
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
  }
});

const imageFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);
  if (extname && mimetype) cb(null, true);
  else cb(new Error('Only image files are allowed'));
};

const upload = multer({
  storage,
  fileFilter: imageFilter,
  limits: { fileSize: 20 * 1024 * 1024 } // 20MB
});

// ============== ROUTES ==============

// POST /api/decor/analyze - Single image analysis
router.post('/analyze', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    const eventType = req.body.eventType || 'Wedding';
    const eventId = req.body.eventId || null;

    const decorImage = new DecorImage({
      filename: req.file.filename,
      originalName: req.file.originalname,
      filepath: `/uploads/${req.file.filename}`,
      eventType,
      eventId,
      fileSize: req.file.size,
      mimeType: req.file.mimetype
    });

    // Try to call ML backend
    try {
      const formData = new FormData();
      formData.append('file', fs.createReadStream(req.file.path), {
        filename: req.file.originalname,
        contentType: req.file.mimetype
      });
      formData.append('event_type', eventType);

      const mlResponse = await axios.post(`${ML_API_URL}/api/analyze`, formData, {
        headers: { ...formData.getHeaders() },
        timeout: 60000
      });

      const mlData = mlResponse.data.record;

      decorImage.thumbnail = mlData.thumbnail;
      decorImage.primaryCategory = mlData.primary_category;
      decorImage.primaryLabel = mlData.primary_label;
      decorImage.confidence = mlData.confidence;
      decorImage.color = mlData.color;
      decorImage.secondaryDetections = mlData.secondary_detections;
      decorImage.allScores = mlData.all_scores;
      decorImage.modelUsed = mlData.model_used;
      decorImage.width = mlData.width;
      decorImage.height = mlData.height;

    } catch (mlError) {
      console.warn('⚠️ ML backend unreachable:', mlError.message);
      decorImage.primaryLabel = 'Pending Analysis';
      decorImage.modelUsed = 'Pending';
    }

    await decorImage.save();

    res.json({ success: true, record: decorImage });

  } catch (error) {
    console.error('Analysis error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/decor/analyze-batch - Batch analysis with RNN
router.post('/analyze-batch', upload.array('files', 50), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, error: 'No files uploaded' });
    }

    const eventType = req.body.eventType || 'Wedding';
    const eventId = Date.now().toString();

    const records = [];
    let eventAnalysis = null;

    try {
      const formData = new FormData();

      req.files.forEach(file => {
        formData.append('files', fs.createReadStream(file.path), {
          filename: file.originalname,
          contentType: file.mimetype
        });
      });
      formData.append('event_type', eventType);

      const mlResponse = await axios.post(`${ML_API_URL}/api/analyze-batch`, formData, {
        headers: { ...formData.getHeaders() },
        timeout: 120000
      });

      const mlData = mlResponse.data;

      for (let i = 0; i < mlData.records.length; i++) {
        const mlRecord = mlData.records[i];
        const file = req.files[i];

        const decorImage = new DecorImage({
          filename: path.basename(mlRecord.filepath),
          originalName: file.originalname,
          filepath: mlRecord.filepath,
          thumbnail: mlRecord.thumbnail,
          eventType,
          eventId,
          primaryCategory: mlRecord.primary_category,
          primaryLabel: mlRecord.primary_label,
          confidence: mlRecord.confidence,
          color: mlRecord.color,
          secondaryDetections: mlRecord.secondary_detections,
          allScores: mlRecord.all_scores,
          modelUsed: mlRecord.model_used,
          width: mlRecord.width,
          height: mlRecord.height,
          fileSize: file.size,
          mimeType: file.mimetype
        });

        await decorImage.save();
        records.push(decorImage);
      }

      if (mlData.event_analysis) {
        eventAnalysis = {
          dominantTheme: mlData.event_analysis.dominant_theme,
          dominantLabel: mlData.event_analysis.dominant_label,
          dominantConfidence: mlData.event_analysis.dominant_confidence,
          sequenceLength: mlData.event_analysis.sequence_length,
          modelUsed: mlData.event_analysis.model_used,
          eventBreakdown: mlData.event_analysis.event_breakdown
        };

        // Update all records with event analysis
        await DecorImage.updateMany({ eventId }, { eventAnalysis });
      }

    } catch (mlError) {
      console.warn('⚠️ ML backend unreachable:', mlError.message);

      for (const file of req.files) {
        const decorImage = new DecorImage({
          filename: file.filename,
          originalName: file.originalname,
          filepath: `/uploads/${file.filename}`,
          eventType,
          eventId,
          primaryLabel: 'Pending Analysis',
          modelUsed: 'Pending',
          fileSize: file.size,
          mimeType: file.mimetype
        });
        await decorImage.save();
        records.push(decorImage);
      }
    }

    res.json({
      success: true,
      count: records.length,
      records,
      eventAnalysis
    });

  } catch (error) {
    console.error('Batch analysis error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/decor/images - Get images with filters
router.get('/images', async (req, res) => {
  try {
    const { category, eventType, eventId, page = 1, limit = 50 } = req.query;

    const query = {};
    if (category) query.primaryCategory = category;
    if (eventType) query.eventType = eventType;
    if (eventId) query.eventId = eventId;

    const total = await DecorImage.countDocuments(query);
    const pages = Math.ceil(total / limit);

    const records = await DecorImage.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    res.json({
      success: true,
      records,
      total,
      page: parseInt(page),
      pages
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/decor/stats - Get statistics  ✅ FIXED
router.get('/stats', async (req, res) => {
  try {
    const { eventType } = req.query;

    // ✅ FIXED: changed "match" to "$match"
    const matchStage = eventType ? { $match: { eventType } } : { $match: {} };

    const categoryStats = await DecorImage.aggregate([
      matchStage,  // ✅ FIXED: removed { ...matchStage }
      { $group: {
        _id: '$primaryCategory',
        count: { $sum: 1 },
        avgConfidence: { $avg: '$confidence' }
      }},
      { $sort: { count: -1 } }
    ]);

    const eventStats = await DecorImage.aggregate([
      { $group: {
        _id: '$eventType',
        count: { $sum: 1 }
      }},
      { $sort: { count: -1 } }
    ]);

    const categoryData = DECOR_CATEGORIES.map(cat => {
      const stat = categoryStats.find(s => s._id === cat) || { count: 0, avgConfidence: 0 };
      return {
        category: cat,
        label: LABELS[cat],
        count: stat.count,
        avgConfidence: stat.avgConfidence || 0,
        color: COLORS[cat]
      };
    });

    const total = await DecorImage.countDocuments(eventType ? { eventType } : {});

    res.json({
      success: true,
      total,
      categoryStats: categoryData,
      eventStats: eventStats.map(e => ({ eventType: e._id, count: e.count }))
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/decor/images/:id - Delete image
router.delete('/images/:id', async (req, res) => {
  try {
    const image = await DecorImage.findById(req.params.id);

    if (!image) {
      return res.status(404).json({ success: false, error: 'Image not found' });
    }

    // Delete file from disk
    const filepath = path.join(__dirname, '../uploads', image.filename);
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
    }

    await DecorImage.findByIdAndDelete(req.params.id);

    res.json({ success: true, message: 'Image deleted' });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/decor/health - Health check
router.get('/health', async (req, res) => {
  try {
    // Check MongoDB
    const mongoStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';

    // Check ML backend
    let mlStatus = 'offline';
    try {
      await axios.get(`${ML_API_URL}/`, { timeout: 5000 });
      mlStatus = 'online';
    } catch {
      mlStatus = 'offline';
    }

    res.json({
      mongodb: mongoStatus,
      mlBackend: mlStatus
    });

  } catch (error) {
    res.status(500).json({ mongodb: 'error', mlBackend: 'error', error: error.message });
  }
});

module.exports = router;