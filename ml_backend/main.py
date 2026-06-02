"""
FastAPI + PyTorch AI Backend for Event Decor Analyzer
Ensemble: CNN (EfficientNet-B0) 60% + ViT 40% for per-image classification
RNN (BiGRU + Attention) for event-level sequence analysis
"""

import os
import io
import base64
import uuid
from datetime import datetime
from typing import List, Optional
from PIL import Image

import torch
import torch.nn as nn
import torch.nn.functional as F
from torchvision import transforms
from torchvision.models import efficientnet_b0

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from pydantic import BaseModel

# ============== CONSTANTS ==============
DECOR_CATEGORIES = [
    "flowers_floral", "fabric_draping", "lights_lighting", "balloons",
    "candles_fire", "centerpieces", "greenery_plants", "ribbons_bows",
    "table_settings", "arches_mandap", "backdrop_panels", "other_decor"
]

LABELS = {
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
}

COLORS = {
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
}

NUM_CLASSES = len(DECOR_CATEGORIES)
UPLOAD_DIR = "./uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# In-memory storage
image_records = []

# ============== IMAGE PREPROCESSING ==============
preprocess = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
])

# ============== MODEL DEFINITIONS ==============

class CNNModel(nn.Module):
    """EfficientNet-B0 backbone with custom classifier head"""
    def __init__(self, num_classes=NUM_CLASSES):
        super().__init__()
        self.backbone = efficientnet_b0(weights=None)
        in_features = self.backbone.classifier[1].in_features  # 1280
        self.backbone.classifier = nn.Sequential(
            nn.Dropout(0.3),
            nn.Linear(in_features, 256),
            nn.ReLU(),
            nn.Dropout(0.3),
            nn.Linear(256, num_classes)
        )
    
    def forward(self, x):
        return self.backbone(x)
    
    def extract_features(self, x):
        """Extract features from avgpool layer (1280-dim)"""
        x = self.backbone.features(x)
        x = self.backbone.avgpool(x)
        x = torch.flatten(x, 1)
        return x


class PatchEmbedding(nn.Module):
    """Patch embedding for ViT"""
    def __init__(self, img_size=224, patch_size=16, in_channels=3, embed_dim=256):
        super().__init__()
        self.num_patches = (img_size // patch_size) ** 2
        self.proj = nn.Conv2d(in_channels, embed_dim, kernel_size=patch_size, stride=patch_size)
    
    def forward(self, x):
        x = self.proj(x)  # (B, embed_dim, H/P, W/P)
        x = x.flatten(2).transpose(1, 2)  # (B, num_patches, embed_dim)
        return x


class VisionTransformer(nn.Module):
    """Lightweight Vision Transformer"""
    def __init__(self, img_size=224, patch_size=16, in_channels=3, embed_dim=256, 
                 num_heads=8, num_layers=4, mlp_dim=512, num_classes=NUM_CLASSES):
        super().__init__()
        self.patch_embed = PatchEmbedding(img_size, patch_size, in_channels, embed_dim)
        num_patches = self.patch_embed.num_patches
        
        self.cls_token = nn.Parameter(torch.zeros(1, 1, embed_dim))
        self.pos_embed = nn.Parameter(torch.zeros(1, num_patches + 1, embed_dim))
        
        encoder_layer = nn.TransformerEncoderLayer(
            d_model=embed_dim, nhead=num_heads, dim_feedforward=mlp_dim,
            dropout=0.1, batch_first=True
        )
        self.transformer = nn.TransformerEncoder(encoder_layer, num_layers=num_layers)
        
        self.norm = nn.LayerNorm(embed_dim)
        self.head = nn.Linear(embed_dim, num_classes)
        
        self._init_weights()
    
    def _init_weights(self):
        nn.init.trunc_normal_(self.pos_embed, std=0.02)
        nn.init.trunc_normal_(self.cls_token, std=0.02)
    
    def forward(self, x):
        B = x.shape[0]
        x = self.patch_embed(x)  # (B, num_patches, embed_dim)
        
        cls_tokens = self.cls_token.expand(B, -1, -1)
        x = torch.cat([cls_tokens, x], dim=1)
        x = x + self.pos_embed
        
        x = self.transformer(x)
        x = self.norm(x[:, 0])  # CLS token
        
        return self.head(x)


class RNNModel(nn.Module):
    """Bidirectional GRU with attention pooling for sequence analysis"""
    def __init__(self, input_size=1280, hidden_size=256, num_layers=2, num_classes=NUM_CLASSES):
        super().__init__()
        self.gru = nn.GRU(input_size, hidden_size, num_layers=num_layers, 
                         batch_first=True, bidirectional=True, dropout=0.2)
        
        # Attention pooling
        self.attention = nn.Linear(hidden_size * 2, 1)
        
        # Classifier
        self.classifier = nn.Sequential(
            nn.Linear(hidden_size * 2, 128),
            nn.ReLU(),
            nn.Dropout(0.3),
            nn.Linear(128, num_classes)
        )
    
    def forward(self, x):
        # x: (B, seq_len, input_size)
        output, _ = self.gru(x)  # (B, seq_len, hidden*2)
        
        # Attention weights
        attn_weights = F.softmax(self.attention(output), dim=1)  # (B, seq_len, 1)
        
        # Weighted sum
        context = torch.sum(attn_weights * output, dim=1)  # (B, hidden*2)
        
        return self.classifier(context)


# ============== INITIALIZE MODELS ==============
device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
print(f"🔧 Using device: {device}")

cnn_model = CNNModel().to(device)
vit_model = VisionTransformer().to(device)
rnn_model = RNNModel().to(device)

cnn_model.eval()
vit_model.eval()
rnn_model.eval()

print("✅ Models initialized (weights=None, no pretrained)")


# ============== HELPER FUNCTIONS ==============
def generate_thumbnail(image: Image.Image, size: int = 300) -> str:
    """Generate base64 thumbnail"""
    img_copy = image.copy()
    img_copy.thumbnail((size, size))
    buffer = io.BytesIO()
    img_copy.save(buffer, format='JPEG', quality=85)
    return base64.b64encode(buffer.getvalue()).decode('utf-8')


def predict_ensemble(image: Image.Image) -> dict:
    """Ensemble prediction: CNN 60% + ViT 40%"""
    img_tensor = preprocess(image).unsqueeze(0).to(device)
    
    with torch.no_grad():
        # CNN prediction
        cnn_logits = cnn_model(img_tensor)
        cnn_probs = F.softmax(cnn_logits, dim=1)
        
        # ViT prediction
        vit_logits = vit_model(img_tensor)
        vit_probs = F.softmax(vit_logits, dim=1)
        
        # Weighted ensemble
        ensemble_probs = 0.6 * cnn_probs + 0.4 * vit_probs
        
        # Get predictions
        probs = ensemble_probs[0].cpu().numpy()
        top_idx = probs.argmax()
        
        # Get all scores
        all_scores = {DECOR_CATEGORIES[i]: float(probs[i]) for i in range(NUM_CLASSES)}
        
        # Secondary detections (top 2 excluding primary)
        sorted_indices = probs.argsort()[::-1]
        secondary = [
            {"category": DECOR_CATEGORIES[sorted_indices[1]], 
             "label": LABELS[DECOR_CATEGORIES[sorted_indices[1]]], 
             "confidence": float(probs[sorted_indices[1]])},
            {"category": DECOR_CATEGORIES[sorted_indices[2]], 
             "label": LABELS[DECOR_CATEGORIES[sorted_indices[2]]], 
             "confidence": float(probs[sorted_indices[2]])}
        ]
    
    return {
        "primary_category": DECOR_CATEGORIES[top_idx],
        "primary_label": LABELS[DECOR_CATEGORIES[top_idx]],
        "confidence": float(probs[top_idx]),
        "color": COLORS[DECOR_CATEGORIES[top_idx]],
        "secondary_detections": secondary,
        "all_scores": all_scores,
        "model_used": "CNN-ViT Ensemble (60/40)"
    }


def predict_sequence(features_list: List[torch.Tensor]) -> dict:
    """RNN prediction for sequence of features"""
    if len(features_list) < 2:
        return None
    
    # Stack features: (1, seq_len, 1280)
    features = torch.stack(features_list).unsqueeze(0).to(device)
    
    with torch.no_grad():
        logits = rnn_model(features)
        probs = F.softmax(logits, dim=1)[0].cpu().numpy()
        
        top_idx = probs.argmax()
        
        return {
            "dominant_theme": DECOR_CATEGORIES[top_idx],
            "dominant_label": LABELS[DECOR_CATEGORIES[top_idx]],
            "dominant_confidence": float(probs[top_idx]),
            "model_used": "BiGRU + Attention"
        }


def extract_cnn_features(image: Image.Image) -> torch.Tensor:
    """Extract 1280-dim features from CNN avgpool"""
    img_tensor = preprocess(image).unsqueeze(0).to(device)
    with torch.no_grad():
        features = cnn_model.extract_features(img_tensor)
    return features.squeeze(0).cpu()


# ============== FASTAPI APP ==============
app = FastAPI(title="Decor AI Backend", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve uploads
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")


@app.get("/")
async def health_check():
    return {"status": "ok", "service": "Python ML Backend", "port": 8000}


@app.post("/api/analyze")
async def analyze_image(
    file: UploadFile = File(...),
    event_type: str = Form(default="Wedding")
):
    """Analyze single image"""
    try:
        # Read image
        contents = await file.read()
        image = Image.open(io.BytesIO(contents)).convert('RGB')
        
        # Generate unique filename
        ext = file.filename.split('.')[-1] if '.' in file.filename else 'jpg'
        filename = f"{uuid.uuid4().hex}.{ext}"
        filepath = os.path.join(UPLOAD_DIR, filename)
        
        # Save original
        image.save(filepath, quality=95)
        
        # Generate thumbnail
        thumbnail = generate_thumbnail(image)
        
        # Predict
        result = predict_ensemble(image)
        
        # Create record
        record = {
            "id": uuid.uuid4().hex,
            "filename": filename,
            "filepath": f"/uploads/{filename}",
            "thumbnail": f"data:image/jpeg;base64,{thumbnail}",
            "primary_category": result["primary_category"],
            "primary_label": result["primary_label"],
            "confidence": result["confidence"],
            "color": result["color"],
            "secondary_detections": result["secondary_detections"],
            "all_scores": result["all_scores"],
            "model_used": result["model_used"],
            "width": image.width,
            "height": image.height,
            "uploaded_at": datetime.utcnow().isoformat(),
            "event_type": event_type
        }
        
        image_records.append(record)
        
        return {"success": True, "record": record}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/analyze-batch")
async def analyze_batch(
    files: List[UploadFile] = File(...),
    event_type: str = Form(default="Wedding")
):
    """Analyze batch of images with RNN sequence analysis"""
    try:
        records = []
        features_list = []
        
        for file in files:
            contents = await file.read()
            image = Image.open(io.BytesIO(contents)).convert('RGB')
            
            ext = file.filename.split('.')[-1] if '.' in file.filename else 'jpg'
            filename = f"{uuid.uuid4().hex}.{ext}"
            filepath = os.path.join(UPLOAD_DIR, filename)
            
            image.save(filepath, quality=95)
            
            thumbnail = generate_thumbnail(image)
            result = predict_ensemble(image)
            
            record = {
                "id": uuid.uuid4().hex,
                "filename": filename,
                "filepath": f"/uploads/{filename}",
                "thumbnail": f"data:image/jpeg;base64,{thumbnail}",
                "primary_category": result["primary_category"],
                "primary_label": result["primary_label"],
                "confidence": result["confidence"],
                "color": result["color"],
                "secondary_detections": result["secondary_detections"],
                "all_scores": result["all_scores"],
                "model_used": result["model_used"],
                "width": image.width,
                "height": image.height,
                "uploaded_at": datetime.utcnow().isoformat(),
                "event_type": event_type
            }
            
            records.append(record)
            image_records.append(record)
            
            # Extract features for RNN
            features_list.append(extract_cnn_features(image))
        
        # RNN event-level analysis
        event_analysis = None
        if len(features_list) >= 2:
            rnn_result = predict_sequence(features_list)
            if rnn_result:
                # Calculate breakdown
                breakdown = {}
                for r in records:
                    cat = r["primary_category"]
                    breakdown[cat] = breakdown.get(cat, 0) + 1
                
                event_analysis = {
                    "dominant_theme": rnn_result["dominant_theme"],
                    "dominant_label": rnn_result["dominant_label"],
                    "dominant_confidence": rnn_result["dominant_confidence"],
                    "event_breakdown": breakdown,
                    "model_used": rnn_result["model_used"],
                    "sequence_length": len(records)
                }
        
        return {
            "success": True,
            "count": len(records),
            "records": records,
            "event_analysis": event_analysis
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/images")
async def get_images(
    category: Optional[str] = Query(default=None),
    event_type: Optional[str] = Query(default=None),
    event_id: Optional[str] = Query(default=None)
):
    """Get stored images"""
    filtered = image_records[:]
    
    if category:
        filtered = [r for r in filtered if r.get("primary_category") == category]
    if event_type:
        filtered = [r for r in filtered if r.get("event_type") == event_type]
    
    return {"success": True, "records": filtered, "total": len(filtered)}


@app.get("/api/stats")
async def get_stats():
    """Get category statistics"""
    chart_data = []
    category_counts = {}
    
    for record in image_records:
        cat = record.get("primary_category")
        if cat:
            category_counts[cat] = category_counts.get(cat, 0) + 1
    
    for cat in DECOR_CATEGORIES:
        chart_data.append({
            "category": cat,
            "label": LABELS[cat],
            "count": category_counts.get(cat, 0),
            "color": COLORS[cat]
        })
    
    return {
        "success": True,
        "total_images": len(image_records),
        "chart_data": chart_data
    }


@app.delete("/api/images/{image_id}")
async def delete_image(image_id: str):
    """Delete image"""
    global image_records
    
    for i, record in enumerate(image_records):
        if record["id"] == image_id:
            filepath = os.path.join(UPLOAD_DIR, record["filename"])
            if os.path.exists(filepath):
                os.remove(filepath)
            image_records.pop(i)
            return {"success": True, "message": "Image deleted"}
    
    raise HTTPException(status_code=404, detail="Image not found")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
