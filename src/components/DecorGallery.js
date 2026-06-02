import { useState, useCallback, useMemo } from 'react';
import useDecorGallery from '../hooks/useDecorGallery';

const EVENT_TYPES = ['Wedding', 'Birthday', 'Corporate', 'Engagement', 'Baby Shower', 'Anniversary'];

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

function DecorGallery() {
  const {
    images, stats, eventAnalysis, loading, uploading, error,
    filters, uploadOne, uploadBatch, removeImage, setFilters
  } = useDecorGallery();

  const [view, setView] = useState('gallery');
  const [dragOver, setDragOver] = useState(false);
  const [selectedEventType, setSelectedEventType] = useState('Wedding');

  // Get unique categories from images
  const categoriesInUse = useMemo(() => {
    const cats = [...new Set(images.map(img => img.primaryCategory).filter(Boolean))];
    return cats;
  }, [images]);

  // Category counts for sidebar
  const categoryCounts = useMemo(() => {
    const counts = {};
    images.forEach(img => {
      if (img.primaryCategory) {
        counts[img.primaryCategory] = (counts[img.primaryCategory] || 0) + 1;
      }
    });
    return counts;
  }, [images]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback(async (e) => {
    e.preventDefault();
    setDragOver(false);
    
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    if (files.length === 0) return;

    if (files.length === 1) {
      await uploadOne(files[0], selectedEventType);
    } else {
      await uploadBatch(files, selectedEventType);
    }
  }, [selectedEventType, uploadOne, uploadBatch]);

  const handleFileInput = useCallback(async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    if (files.length === 1) {
      await uploadOne(files[0], selectedEventType);
    } else {
      await uploadBatch(files, selectedEventType);
    }
    e.target.value = '';
  }, [selectedEventType, uploadOne, uploadBatch]);

  const handleDelete = useCallback(async (id) => {
    if (window.confirm('Delete this image?')) {
      await removeImage(id);
    }
  }, [removeImage]);

  const getConfidenceColor = (conf) => {
    if (conf >= 0.7) return '#22c55e';
    if (conf >= 0.45) return '#eab308';
    return '#f97316';
  };

  // Image Card Component
  const ImageCard = ({ image }) => (
    <div style={styles.imageCard}>
      <div style={styles.imageContainer}>
        <img
          src={image.thumbnail || `http://localhost:5001${image.filepath}`}
          alt={image.originalName}
          style={styles.thumbnail}
        />
        {image.primaryCategory && (
          <span style={{
            ...styles.categoryBadge,
            backgroundColor: COLORS[image.primaryCategory] || '#6b7280'
          }}>
            {LABELS[image.primaryCategory] || image.primaryCategory}
          </span>
        )}
        {image.confidence != null && (
          <span style={{
            ...styles.confidenceBadge,
            backgroundColor: getConfidenceColor(image.confidence)
          }}>
            {(image.confidence * 100).toFixed(0)}%
          </span>
        )}
        <button
          onClick={() => handleDelete(image._id)}
          style={styles.deleteButton}
          title="Delete"
        >
          ×
        </button>
      </div>
      <div style={styles.cardInfo}>
        <div style={styles.fileName}>{image.originalName}</div>
        {image.confidence != null && (
          <div style={styles.confidenceBar}>
            <div
              style={{
                ...styles.confidenceFill,
                width: `${image.confidence * 100}%`,
                backgroundColor: getConfidenceColor(image.confidence)
              }}
            />
          </div>
        )}
        <div style={styles.metaInfo}>
          <span>{image.eventType}</span>
          <span>{new Date(image.createdAt).toLocaleDateString()}</span>
        </div>
        {image.secondaryDetections && image.secondaryDetections.length > 0 && (
          <div style={styles.secondaryPills}>
            {image.secondaryDetections.slice(0, 2).map((det, i) => (
              <span key={i} style={styles.secondaryPill}>
                {det.label}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  // Stats Bar Chart
  const StatsView = () => (
    <div style={styles.statsContainer}>
      <h3 style={styles.statsTitle}>Category Distribution</h3>
      {stats?.categoryStats?.filter(s => s.count > 0).map(stat => (
        <div key={stat.category} style={styles.statRow} onClick={() => setFilters({ category: stat.category })}>
          <div style={styles.statLabel}>
            <span style={{ ...styles.colorDot, backgroundColor: stat.color }} />
            {stat.label}
          </div>
          <div style={styles.statBarContainer}>
            <div style={{
              ...styles.statBar,
              width: `${stats.total > 0 ? (stat.count / stats.total) * 100 : 0}%`,
              backgroundColor: stat.color
            }} />
          </div>
          <div style={styles.statCount}>{stat.count}</div>
          {stat.avgConfidence > 0 && (
            <div style={styles.statConfidence}>
              {(stat.avgConfidence * 100).toFixed(0)}% avg
            </div>
          )}
        </div>
      ))}
    </div>
  );

  return (
    <div style={styles.container}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <h1 style={styles.title}>🎨 Decor AI Gallery</h1>
          <p style={styles.subtitle}>CNN · Vision Transformer · RNN — stored in MongoDB</p>
        </div>
        <div style={styles.headerRight}>
          <button
            style={{ ...styles.viewBtn, ...(view === 'gallery' ? styles.viewBtnActive : {}) }}
            onClick={() => setView('gallery')}
          >
            Gallery
          </button>
          <button
            style={{ ...styles.viewBtn, ...(view === 'stats' ? styles.viewBtnActive : {}) }}
            onClick={() => setView('stats')}
          >
            Stats
          </button>
        </div>
      </header>

      {error && (
        <div style={styles.errorBanner}>
          ⚠️ {error}
        </div>
      )}

      <div style={styles.mainLayout}>
        {/* Sidebar */}
        <aside style={styles.sidebar}>
          <div style={styles.sidebarSection}>
            <h4 style={styles.sidebarTitle}>Categories</h4>
            <button
              style={{
                ...styles.filterBtn,
                ...(filters.category === '' ? styles.filterBtnActive : {})
              }}
              onClick={() => setFilters({ category: '' })}
            >
              All ({images.length})
            </button>
            {categoriesInUse.map(cat => (
              <button
                key={cat}
                style={{
                  ...styles.filterBtn,
                  ...(filters.category === cat ? styles.filterBtnActive : {})
                }}
                onClick={() => setFilters({ category: cat })}
              >
                <span style={{ ...styles.colorDot, backgroundColor: COLORS[cat] }} />
                {LABELS[cat]} ({categoryCounts[cat]})
              </button>
            ))}
          </div>

          <div style={styles.sidebarSection}>
            <h4 style={styles.sidebarTitle}>Event Types</h4>
            {EVENT_TYPES.map(type => (
              <button
                key={type}
                style={{
                  ...styles.filterBtn,
                  ...(filters.eventType === type ? styles.filterBtnActive : {})
                }}
                onClick={() => setFilters({ eventType: filters.eventType === type ? '' : type })}
              >
                {type}
              </button>
            ))}
          </div>

          {/* RNN Event Analysis */}
          {eventAnalysis && (
            <div style={styles.eventAnalysisCard}>
              <h4 style={styles.eventAnalysisTitle}>🧠 RNN Event Analysis</h4>
              <div style={styles.eventAnalysisContent}>
                <div><strong>Theme:</strong> {eventAnalysis.dominantLabel}</div>
                <div><strong>Confidence:</strong> {(eventAnalysis.dominantConfidence * 100).toFixed(1)}%</div>
                <div><strong>Model:</strong> {eventAnalysis.modelUsed}</div>
                <div><strong>Images:</strong> {eventAnalysis.sequenceLength}</div>
              </div>
            </div>
          )}
        </aside>

        {/* Main Content */}
        <main style={styles.main}>
          {/* Upload Panel */}
          <div style={styles.uploadPanel}>
            <div style={styles.eventTypeSelector}>
              {EVENT_TYPES.map(type => (
                <button
                  key={type}
                  style={{
                    ...styles.eventTypePill,
                    ...(selectedEventType === type ? styles.eventTypePillActive : {})
                  }}
                  onClick={() => setSelectedEventType(type)}
                >
                  {type}
                </button>
              ))}
            </div>

            <div
              style={{
                ...styles.dropZone,
                ...(dragOver ? styles.dropZoneActive : {})
              }}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => document.getElementById('fileInput').click()}
            >
              {uploading ? (
                <div style={styles.uploadingText}>
                  🧠 AI Processing...
                </div>
              ) : (
                <div>
                  <div style={styles.dropZoneIcon}>📁</div>
                  <div>Drag & drop images here</div>
                  <div style={styles.dropZoneHint}>or click to browse</div>
                </div>
              )}
              <input
                id="fileInput"
                type="file"
                accept="image/*"
                multiple
                style={styles.fileInput}
                onChange={handleFileInput}
              />
            </div>
          </div>

          {/* Gallery or Stats View */}
          {loading ? (
            <div style={styles.loading}>Loading...</div>
          ) : view === 'stats' ? (
            <StatsView />
          ) : images.length === 0 ? (
            <div style={styles.emptyState}>
              <div style={styles.emptyIcon}>🖼️</div>
              <p>Upload decoration images above — they'll be saved to MongoDB</p>
            </div>
          ) : (
            <div style={styles.gallery}>
              {images.map(image => (
                <ImageCard key={image._id} image={image} />
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#f9fafb',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  },
  header: {
    position: 'sticky',
    top: 0,
    zIndex: 100,
    backgroundColor: '#fff',
    borderBottom: '1px solid #e5e7eb',
    padding: '16px 24px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  headerLeft: {},
  title: {
    margin: 0,
    fontSize: '24px',
    fontWeight: 600
  },
  subtitle: {
    margin: '4px 0 0',
    color: '#6b7280',
    fontSize: '14px'
  },
  headerRight: {
    display: 'flex',
    gap: '8px'
  },
  viewBtn: {
    padding: '8px 16px',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    backgroundColor: '#fff',
    cursor: 'pointer',
    fontSize: '14px'
  },
  viewBtnActive: {
    backgroundColor: '#4f46e5',
    color: '#fff',
    borderColor: '#4f46e5'
  },
  errorBanner: {
    backgroundColor: '#fef2f2',
    color: '#dc2626',
    padding: '12px 24px',
    borderBottom: '1px solid #fecaca'
  },
  mainLayout: {
    display: 'flex',
    minHeight: 'calc(100vh - 80px)'
  },
  sidebar: {
    width: '220px',
    backgroundColor: '#fff',
    borderRight: '1px solid #e5e7eb',
    padding: '16px',
    flexShrink: 0
  },
  sidebarSection: {
    marginBottom: '24px'
  },
  sidebarTitle: {
    margin: '0 0 12px',
    fontSize: '12px',
    textTransform: 'uppercase',
    color: '#6b7280',
    fontWeight: 600
  },
  filterBtn: {
    display: 'flex',
    alignItems: 'center',
    width: '100%',
    padding: '8px 12px',
    border: 'none',
    borderRadius: '6px',
    backgroundColor: 'transparent',
    cursor: 'pointer',
    fontSize: '14px',
    textAlign: 'left',
    marginBottom: '4px'
  },
  filterBtnActive: {
    backgroundColor: '#eef2ff',
    color: '#4f46e5'
  },
  colorDot: {
    display: 'inline-block',
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    marginRight: '8px'
  },
  eventAnalysisCard: {
    backgroundColor: '#f0fdf4',
    borderRadius: '8px',
    padding: '12px',
    border: '1px solid #bbf7d0'
  },
  eventAnalysisTitle: {
    margin: '0 0 8px',
    fontSize: '14px'
  },
  eventAnalysisContent: {
    fontSize: '12px',
    color: '#166534'
  },
  main: {
    flex: 1,
    padding: '24px',
    overflowY: 'auto'
  },
  uploadPanel: {
    marginBottom: '24px'
  },
  eventTypeSelector: {
    display: 'flex',
    gap: '8px',
    marginBottom: '12px',
    flexWrap: 'wrap'
  },
  eventTypePill: {
    padding: '6px 14px',
    border: '1px solid #e5e7eb',
    borderRadius: '20px',
    backgroundColor: '#fff',
    cursor: 'pointer',
    fontSize: '13px'
  },
  eventTypePillActive: {
    backgroundColor: '#4f46e5',
    color: '#fff',
    border: '1px solid #4f46e5'
  },
  dropZone: {
    border: '2px dashed #d1d5db',
    borderRadius: '12px',
    padding: '32px',
    textAlign: 'center',
    cursor: 'pointer',
    backgroundColor: '#fff',
    transition: 'all 0.2s'
  },
  dropZoneActive: {
    borderColor: '#4f46e5',
    backgroundColor: '#eef2ff'
  },
  dropZoneIcon: {
    fontSize: '32px',
    marginBottom: '8px'
  },
  dropZoneHint: {
    fontSize: '12px',
    color: '#9ca3af',
    marginTop: '4px'
  },
  uploadingText: {
    fontSize: '16px',
    color: '#4f46e5'
  },
  fileInput: {
    display: 'none'
  },
  gallery: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '16px'
  },
  imageCard: {
    backgroundColor: '#fff',
    borderRadius: '12px',
    overflow: 'hidden',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
  },
  imageContainer: {
    position: 'relative',
    paddingTop: '100%'
  },
  thumbnail: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover'
  },
  categoryBadge: {
    position: 'absolute',
    top: '8px',
    left: '8px',
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: 500,
    color: '#fff'
  },
  confidenceBadge: {
    position: 'absolute',
    top: '8px',
    right: '8px',
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: 600,
    color: '#fff'
  },
  deleteButton: {
    position: 'absolute',
    bottom: '8px',
    right: '8px',
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    border: 'none',
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '14px',
    lineHeight: '1'
  },
  cardInfo: {
    padding: '12px'
  },
  fileName: {
    fontSize: '13px',
    fontWeight: 500,
    marginBottom: '6px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  confidenceBar: {
    height: '4px',
    backgroundColor: '#e5e7eb',
    borderRadius: '2px',
    marginBottom: '6px'
  },
  confidenceFill: {
    height: '100%',
    borderRadius: '2px'
  },
  metaInfo: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '11px',
    color: '#6b7280'
  },
  secondaryPills: {
    display: 'flex',
    gap: '4px',
    marginTop: '6px',
    flexWrap: 'wrap'
  },
  secondaryPill: {
    padding: '2px 6px',
    backgroundColor: '#f3f4f6',
    borderRadius: '4px',
    fontSize: '10px',
    color: '#6b7280'
  },
  statsContainer: {
    backgroundColor: '#fff',
    borderRadius: '12px',
    padding: '24px'
  },
  statsTitle: {
    margin: '0 0 16px',
    fontSize: '18px'
  },
  statRow: {
    display: 'flex',
    alignItems: 'center',
    padding: '8px 0',
    cursor: 'pointer',
    gap: '12px'
  },
  statLabel: {
    width: '140px',
    fontSize: '14px',
    display: 'flex',
    alignItems: 'center'
  },
  statBarContainer: {
    flex: 1,
    height: '24px',
    backgroundColor: '#f3f4f6',
    borderRadius: '4px'
  },
  statBar: {
    height: '100%',
    borderRadius: '4px',
    transition: 'width 0.3s'
  },
  statCount: {
    width: '40px',
    textAlign: 'right',
    fontWeight: 600
  },
  statConfidence: {
    width: '60px',
    textAlign: 'right',
    fontSize: '12px',
    color: '#6b7280'
  },
  loading: {
    textAlign: 'center',
    padding: '48px',
    color: '#6b7280'
  },
  emptyState: {
    textAlign: 'center',
    padding: '64px',
    color: '#6b7280'
  },
  emptyIcon: {
    fontSize: '48px',
    marginBottom: '16px'
  }
};

export default DecorGallery;
