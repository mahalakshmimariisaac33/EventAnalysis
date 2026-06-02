import { useState, useEffect, useCallback } from 'react';
import { analyzeImage, analyzeBatch, getImages, getStats, deleteImage } from '../services/decorApi';

export const useDecorGallery = () => {
  const [images, setImages] = useState([]);
  const [stats, setStats] = useState(null);
  const [eventAnalysis, setEventAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({ category: '', eventType: '' });

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [imagesData, statsData] = await Promise.all([
        getImages(filters),
        getStats(filters.eventType)
      ]);
      setImages(imagesData.records || []);
      setStats(statsData);
    } catch (err) {
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const uploadOne = async (file, eventType) => {
    setUploading(true);
    setError(null);
    try {
      await analyzeImage(file, eventType);
      await fetchData();
      return { success: true };
    } catch (err) {
      setError(err.message || 'Upload failed');
      return { success: false, error: err.message };
    } finally {
      setUploading(false);
    }
  };

  const uploadBatch = async (files, eventType) => {
    setUploading(true);
    setError(null);
    try {
      const result = await analyzeBatch(files, eventType);
      if (result.eventAnalysis) {
        setEventAnalysis(result.eventAnalysis);
      }
      await fetchData();
      return { success: true, count: result.count };
    } catch (err) {
      setError(err.message || 'Batch upload failed');
      return { success: false, error: err.message };
    } finally {
      setUploading(false);
    }
  };

  const removeImage = async (id) => {
    try {
      await deleteImage(id);
      await fetchData();
      return { success: true };
    } catch (err) {
      setError(err.message || 'Delete failed');
      return { success: false, error: err.message };
    }
  };

  const updateFilters = (newFilters) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  };

  return {
    images,
    stats,
    eventAnalysis,
    loading,
    uploading,
    error,
    filters,
    uploadOne,
    uploadBatch,
    removeImage,
    setFilters: updateFilters,
    refresh: fetchData
  };
};

export default useDecorGallery;
