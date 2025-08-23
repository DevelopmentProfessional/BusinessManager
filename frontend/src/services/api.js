import axios from 'axios';

// Sanitize base URL: trim whitespace and trailing slashes to avoid `%20` or double-slash issues
// Default to relative path so Vite proxy (see vite.config.js) handles HTTPS -> HTTP backend
const RAW_API_BASE_URL = (import.meta.env.VITE_API_URL || '/api/v1');
const API_BASE_URL = RAW_API_BASE_URL.trim().replace(/\/+$/, '');

const api = axios.create({
  baseURL: API_BASE_URL,
});

// Add authentication interceptor
api.interceptors.request.use((config) => {
  // Get token from localStorage or sessionStorage
  let token = localStorage.getItem('token') || sessionStorage.getItem('token');
  
  // TEMPORARY: Use fake token if no token is found (for development)
  if (!token) {
    token = 'fake-jwt-token-for-development';
    console.log('🔓 TOKEN BYPASSED: Using fake token for development');
  }
  
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  
  // Ensure FormData requests are sent as multipart/form-data (let the browser set the boundary)
  const isFormData = typeof FormData !== 'undefined' && config.data instanceof FormData;
  if (isFormData) {
    if (config.headers && 'Content-Type' in config.headers) {
      delete config.headers['Content-Type'];
    }
  }
  
  return config;
});

// Add response interceptor to handle authentication errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // TEMPORARY: Bypass 401 errors during development
      console.log('🔓 AUTH BYPASSED: Ignoring 401 error for development');
      
      // Don't clear auth data or redirect during development
      // TODO: Restore this when login is working properly
      /*
      // Clear authentication data and redirect to login
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('permissions');
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('user');
      sessionStorage.removeItem('permissions');
      
      // Redirect to login page
      window.location.href = '/login';
      */
    }
    return Promise.reject(error);
  }
);

// API endpoints for all entities
export const clientsAPI = {
  getAll: () => api.get('/clients'),
  getById: (id) => api.get(`/clients/${id}`),
  create: (data) => api.post('/clients', data),
  update: (id, data) => api.put(`/clients/${id}`, data),
  delete: (id) => api.delete(`/clients/${id}`),
};

// Items API
export const itemsAPI = {
  getAll: () => api.get('/items'),
  getById: (id) => api.get(`/items/${id}`),
  create: (data) => api.post('/items', data),
  update: (id, data) => api.put(`/items/${id}`, data),
  delete: (id) => api.delete(`/items/${id}`),
};

export const inventoryAPI = {
  getAll: () => api.get('/inventory'),
  getLowStock: () => api.get('/inventory/low-stock'),
  update: (itemId, quantity, { min_stock_level, location } = {}) => {
    const body = { item_id: itemId, quantity };
    if (min_stock_level != null) body.min_stock_level = min_stock_level;
    if (location != null) body.location = location;
    return api.post('/inventory', body);
  },
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

export const attendanceAPI = {
  getAll: () => api.get('/attendance'),
  getByEmployee: (employeeId) => api.get(`/attendance/employee/${employeeId}`),
  create: (data) => api.post('/attendance', data),
  update: (id, data) => api.put(`/attendance/${id}`, data),
};

export const documentsAPI = {
  getAll: () => api.get('/documents'),
  getByEntity: (entityType, entityId) => api.get(`/documents/by-entity/${entityType}/${entityId}`),
  upload: (file, description) => {
    const formData = new FormData();
    formData.append('file', file);
    if (description) formData.append('description', description);
    
    // Let the browser set Content-Type with proper boundary
    return api.post('/documents', formData);
  },
  uploadBulk: (files, { entity_type, entity_id, description } = {}) => {
    const formData = new FormData();
    for (const file of files) {
      formData.append('files', file);
    }
    if (description) formData.append('description', description);
    if (entity_type) formData.append('entity_type', entity_type);
    if (entity_id) formData.append('entity_id', entity_id);
    return api.post('/documents/bulk', formData);
  },
  delete: (id) => api.delete(`/documents/${id}`),
  update: (id, data) => api.put(`/documents/${id}`, data),
  sign: (id, signerName) => api.post(`/documents/${id}/sign`, { signed_by: signerName }),
  fileUrl: (id) => `${API_BASE_URL}/documents/${id}/download`,
  historyFileUrl: (historyId, { download = true } = {}) =>
    `${API_BASE_URL}/documents/history/${historyId}/download${download ? '?download=true' : ''}`,
  history: (id) => api.get(`/documents/${id}/history`),
  replaceContent: (id, file, note) => {
    const formData = new FormData();
    formData.append('file', file);
    if (note) formData.append('note', note);
    return api.put(`/documents/${id}/content`, formData);
  },
  listAssignments: (id) => api.get(`/documents/${id}/assignments`),
  addAssignment: (id, employee_id) => api.post(`/documents/${id}/assignments`, { employee_id }),
  removeAssignment: (id, employee_id) => api.delete(`/documents/${id}/assignments/${employee_id}`),
  onlyofficeConfig: (id) => api.get(`/documents/${id}/onlyoffice-config`),
};

export const documentCategoriesAPI = {
  list: () => api.get('/document-categories'),
  create: (data) => api.post('/document-categories', data), // { name, description? }
  update: (id, data) => api.put(`/document-categories/${id}`, data),
  delete: (id) => api.delete(`/document-categories/${id}`),
};

export default api;
