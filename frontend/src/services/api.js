import axios from 'axios';

// Sanitize base URL: trim whitespace and trailing slashes to avoid `%20` or double-slash issues
const RAW_API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1');
const API_BASE_URL = RAW_API_BASE_URL.trim().replace(/\/+$/, '');

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// API endpoints for all entities
export const clientsAPI = {
  getAll: () => api.get('/clients'),
  getById: (id) => api.get(`/clients/${id}`),
  create: (data) => api.post('/clients', data),
  update: (id, data) => api.put(`/clients/${id}`, data),
  delete: (id) => api.delete(`/clients/${id}`),
};

export const productsAPI = {
  getAll: () => api.get('/products'),
  getById: (id) => api.get(`/products/${id}`),
  create: (data) => api.post('/products', data),
  delete: (id) => api.delete(`/products/${id}`),
};

export const inventoryAPI = {
  getAll: () => api.get('/inventory'),
  getLowStock: () => api.get('/inventory/low-stock'),
  update: (productId, quantity) => api.post('/inventory', { product_id: productId, quantity }),
};

export const servicesAPI = {
  getAll: () => api.get('/services'),
  getById: (id) => api.get(`/services/${id}`),
  create: (data) => api.post('/services', data),
  update: (id, data) => api.put(`/services/${id}`, data),
  delete: (id) => api.delete(`/services/${id}`),
};

export const employeesAPI = {
  getAll: () => api.get('/employees'),
  getById: (id) => api.get(`/employees/${id}`),
  create: (data) => api.post('/employees', data),
  update: (id, data) => api.put(`/employees/${id}`, data),
  delete: (id) => api.delete(`/employees/${id}`),
};

export const scheduleAPI = {
  getAll: () => api.get('/schedule'),
  getByEmployee: (employeeId) => api.get(`/schedule/employee/${employeeId}`),
  create: (data) => api.post('/schedule', data),
  update: (id, data) => api.put(`/schedule/${id}`, data),
};

export const assetsAPI = {
  getAll: () => api.get('/assets'),
  getById: (id) => api.get(`/assets/${id}`),
  create: (data) => api.post('/assets', data),
  update: (id, data) => api.put(`/assets/${id}`, data),
  delete: (id) => api.delete(`/assets/${id}`),
};

export const attendanceAPI = {
  getAll: () => api.get('/attendance'),
  getByEmployee: (employeeId) => api.get(`/attendance/employee/${employeeId}`),
  create: (data) => api.post('/attendance', data),
  update: (id, data) => api.put(`/attendance/${id}`, data),
};

export const documentsAPI = {
  getAll: () => api.get('/documents'),
  getByEntity: (entityType, entityId) => api.get(`/documents/${entityType}/${entityId}`),
  upload: (entityType, entityId, file, description) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('entity_type', entityType);
    formData.append('entity_id', entityId);
    if (description) formData.append('description', description);
    
    return api.post('/documents', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  delete: (id) => api.delete(`/documents/${id}`),
  fileUrl: (id) => `${API_BASE_URL}/documents/${id}/download`,
};

export default api;
