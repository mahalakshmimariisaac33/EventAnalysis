const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const decorRoutes = require('./routes/decor');

const app = express();
const PORT = process.env.PORT || 5001;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/decor-analyzer';

app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:3000' }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/api/decor', decorRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

mongoose.connect(MONGO_URI)
  .then(() => {
    console.log('✅ MongoDB connected');
    app.listen(PORT, () => console.log(`✅ Express running on http://localhost:${PORT}`));
  })
  .catch(err => {
    console.error('❌ MongoDB failed:', err.message);
    process.exit(1);
  });
