# AI Event Decor Material Analyzer

A full MERN stack AI Event Decor Analyzer with CNN (EfficientNet-B0), Vision Transformer, and RNN (BiGRU + Attention) models for decoration classification and event-level sequence analysis.

## Architecture

```
├── ml_backend/main.py     # FastAPI + PyTorch AI Backend (Port 8000)
├── backend/               # Express + MongoDB Backend (Port 5001)
│   ├── server.js
│   ├── models/DecorImage.js
│   └── routes/decor.js
├── src/                   # React Frontend (Port 3000)
│   ├── components/DecorGallery.js
│   ├── hooks/useDecorGallery.js
│   └── services/decorApi.js
└── public/index.html
```

## AI Models

### Ensemble Classifier (Per-Image)
- **CNN**: EfficientNet-B0 backbone with custom classifier (Dropout→Linear→ReLU→Dropout→Linear)
- **Vision Transformer**: Custom ViT with PatchEmbedding (patch_size=16), 4-layer TransformerEncoder
- **Ensemble**: CNN 60% + ViT 40% weighted softmax

### RNN Sequence Model (Event-Level)
- **BiGRU**: Bidirectional GRU (hidden_size=256, 2 layers) with attention pooling
- Processes sequences of CNN feature vectors (1280-dim) for event theme prediction

### 12 Decor Categories
```
flowers_floral, fabric_draping, lights_lighting, balloons,
candles_fire, centerpieces, greenery_plants, ribbons_bows,
table_settings, arches_mandap, backdrop_panels, other_decor
```

## Features

- **Single Image Analysis**: Upload one image for CNN-ViT ensemble classification
- **Batch Analysis**: Upload multiple images for RNN event-level theme detection
- **MongoDB Storage**: All results stored permanently via Mongoose
- **Offline Resilience**: If ML backend is down, saves images with "Pending Analysis"
- **Gallery View**: Responsive grid with category badges, confidence indicators
- **Stats View**: Horizontal bar chart with category distribution
- **Event Filters**: Filter by category and event type (Wedding, Birthday, Corporate, etc.)

## Features

### 🔧 Core Functionality
- **File Upload**: Upload images or videos of event decoration setups with drag-and-drop support
- **Manual Input**: Add, edit, and delete items manually with material categorization
- **AI Detection**: Display detected items from backend API with confidence scores
- **Material Visualization**: Interactive pie and bar charts showing material distribution
- **Multilingual Support**: Toggle between English and Tamil languages
- **Voice Output**: Text-to-speech functionality in both languages
- **Responsive Design**: Mobile-first design that works on all devices

### 📊 Data Visualization
- Material distribution charts (Pie & Bar charts)
- Real-time updates based on detected and manual items
- Color-coded materials for easy identification
- Summary statistics display

### 🎯 User Experience
- Clean and modern UI with card-based layout
- Loading spinners and error handling
- Drag-and-drop file upload with preview
- Smooth animations and transitions
- Accessibility-compliant design

## Tech Stack

- **Frontend**: React.js 18
- **Charts**: Chart.js with react-chartjs-2
- **HTTP Client**: Axios
- **Styling**: CSS3 with Flexbox/Grid
- **Voice**: Web Speech API
- **Build Tool**: Create React App

## Installation

### Prerequisites
- Node.js 18+
- Python 3.10+
- MongoDB

### 1. Install Python Dependencies (ML Backend)
```bash
cd ml_backend
pip install -r requirements.txt
```

### 2. Install Node.js Dependencies (Express Backend)
```bash
cd backend
npm install
```

### 3. Install React Dependencies
```bash
npm install
```

## Running the Application (4 Terminals)

### Terminal 1 — MongoDB
```bash
mongod --dbpath C:\data\db
```

### Terminal 2 — Python ML Backend (Port 8000)
```bash
cd ml_backend
python -m uvicorn main:app --port 8000 --reload
```

### Terminal 3 — Express Backend (Port 5001)
```bash
cd backend
npm run dev
```

### Terminal 4 — React Frontend (Port 3000)
```bash
npm start
```

## API Endpoints

### ML Backend (Python - Port 8000)
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Health check |
| `/api/analyze` | POST | Single image analysis |
| `/api/analyze-batch` | POST | Batch analysis with RNN |
| `/api/images` | GET | Get stored images |
| `/api/stats` | GET | Get category statistics |
| `/api/images/{id}` | DELETE | Delete image |

### Express Backend (Node - Port 5001)
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check |
| `/api/decor/analyze` | POST | Single image analysis (proxied to ML) |
| `/api/decor/analyze-batch` | POST | Batch analysis (proxied to ML) |
| `/api/decor/images` | GET | Get images from MongoDB |
| `/api/decor/stats` | GET | Get aggregated statistics |
| `/api/decor/images/:id` | DELETE | Delete from MongoDB + disk |
| `/api/decor/health` | GET | Check MongoDB + ML backend status |

## Environment Variables

### backend/.env
```
PORT=5001
MONGO_URI=mongodb://localhost:27017/decor-analyzer
ML_API_URL=http://localhost:8000
CLIENT_URL=http://localhost:3000
```

### src/.env
```
REACT_APP_API_URL=http://localhost:5001/api
```

## How It Works

1. **Frontend** never calls Python ML backend directly — all requests go through Express on port 5001
2. **Express** proxies file uploads to Python using form-data + axios streaming (not base64)
3. **MongoDB** stores all results permanently via Mongoose
4. **If ML backend is offline**, Express still saves images with `primaryLabel: 'Pending Analysis'`
5. All file uploads use multer diskStorage, never memoryStorage
6. Python ML models use `weights=None` (no internet download required)

## Tech Stack

- **Frontend**: React 18, Axios
- **Backend**: Express, Mongoose, Multer
- **AI/ML**: FastAPI, PyTorch, torchvision
- **Database**: MongoDB
- **Models**: EfficientNet-B0, Vision Transformer, BiGRU + Attention

## Project Structure

```
stock-analysis/
├── ml_backend/
│   ├── main.py              # FastAPI + PyTorch AI Backend
│   └── requirements.txt
├── backend/
│   ├── server.js            # Express Entry Point
│   ├── package.json
│   ├── .env
│   ├── models/
│   │   └── DecorImage.js    # Mongoose Schema
│   ├── routes/
│   │   └── decor.js         # Express Routes
│   └── uploads/             # Image storage
├── src/
│   ├── services/
│   │   └── decorApi.js      # React API Service
│   ├── hooks/
│   │   └── useDecorGallery.js
│   ├── components/
│   │   └── DecorGallery.js
│   ├── App.js
│   ├── index.js
│   └── .env
├── public/
│   └── index.html
└── package.json
```

## License

This project is licensed under the MIT License.