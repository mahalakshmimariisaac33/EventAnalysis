import axios from 'axios';

const API = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5001/api',
  timeout: 60000,
});

export const analyzeImage = async (file, eventType = 'Wedding', eventId = '') => {
  const form = new FormData();
  form.append('file', file);
  form.append('eventType', eventType);
  form.append('eventId', eventId);
  const res = await API.post('/decor/analyze', form);
  return res.data;
};

export const analyzeBatch = async (files, eventType = 'Wedding') => {
  const form = new FormData();
  files.forEach(f => form.append('files', f));
  form.append('eventType', eventType);
  const res = await API.post('/decor/analyze-batch', form);
  return res.data;
};

export const getImages = async ({ category, eventType, eventId, page = 1, limit = 50 } = {}) => {
  const params = {};
  if (category) params.category = category;
  if (eventType) params.eventType = eventType;
  if (eventId) params.eventId = eventId;
  params.page = page; params.limit = limit;
  const res = await API.get('/decor/images', { params });
  return res.data;
};

export const getStats = async (eventType = '') => {
  const res = await API.get('/decor/stats', { params: eventType ? { eventType } : {} });
  return res.data;
};

export const deleteImage = async (id) => {
  const res = await API.delete(`/decor/images/${id}`);
  return res.data;
};

export const checkHealth = async () => {
  const res = await API.get('/decor/health');
  return res.data;
};
