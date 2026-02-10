import axios from 'axios';

// API Configuration - Fixed backend URL for production
const API_BASE_URL = window.location.hostname === 'localhost' 
  ? '/api/v1'  // Local development uses Vite proxy
  : 'https://lavish-beauty-api.onrender.com/api/v1';  // Production uses direct backend

// Simple cache to prevent duplicate API calls
const apiCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

const api = axios.create({
  baseURL: API_BASE_URL,
});

// Add authentication interceptor
api.interceptors.request.use((config) => {
  // Get token from localStorage or sessionStorage
  const token = localStorage.getItem('token') || sessionStorage.getItem('token');
  
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
    return Promise.reject(error);
  }
);

// Helper function to get cached data or make API call
const getCachedOrFetch = async (key, fetchFunction) => {
  const cached = apiCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }
  
  const data = await fetchFunction();
  apiCache.set(key, { data, timestamp: Date.now() });
  return data;
};

// Helper function to clear cache for specific key
const clearCache = (key) => {
  if (key) {
    apiCache.delete(key);
  } else {
    apiCache.clear();
  }
};

// Expose clearCache globally for logout
if (typeof window !== 'undefined') {
  window.clearApiCache = () => apiCache.clear();
}

// API endpoints for all entities
export const clientsAPI = {
  getAll: () => getCachedOrFetch('clients', () => api.get('/clients')),
  getById: (id) => api.get(`/clients/${id}`),
  create: (data) => {
    clearCache('clients');
    return api.post('/clients', data);
  },
  update: (id, data) => {
    clearCache('clients');
    return api.put(`/clients/${id}`, data);
  },
  delete: (id) => {
    clearCache('clients');
    return api.delete(`/clients/${id}`);
  },
  uploadCSV: (formData) => {
    clearCache('clients');
    return api.post('/clients/upload-csv', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
};

// Items API
export const itemsAPI = {
  getAll: () => getCachedOrFetch('items', () => api.get('/items')),
  getById: (id) => api.get(`/items/${id}`),
  create: (data) => {
    clearCache('items');
    return api.post('/items', data);
  },
  update: (id, data) => {
    clearCache('items');
    return api.put(`/items/${id}`, data);
  },
  delete: (id) => {
    clearCache('items');
    return api.delete(`/items/${id}`);
  },
};

export const inventoryAPI = {
  getAll: () => getCachedOrFetch('inventory', () => api.get('/inventory')),
  getLowStock: () => getCachedOrFetch('inventory-low-stock', () => api.get('/inventory/low-stock')),
  update: (itemId, quantity, { min_stock_level, location } = {}) => {
    const body = { item_id: itemId, quantity };
    if (min_stock_level != null) body.min_stock_level = min_stock_level;
    if (location != null) body.location = location;
    clearCache('inventory');
    return api.post('/inventory', body);
  },
};

export const servicesAPI = {
  getAll: () => getCachedOrFetch('services', () => api.get('/services')),
  getById: (id) => api.get(`/services/${id}`),
  create: (data) => {
    clearCache('services');
    return api.post('/services', data);
  },
  update: (id, data) => {
    clearCache('services');
    return api.put(`/services/${id}`, data);
  },
  delete: (id) => {
    clearCache('services');
    return api.delete(`/services/${id}`);
  },
  uploadCSV: (formData) => {
    clearCache('services');
    return api.post('/services/upload-csv', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
};

export const suppliersAPI = {
  getAll: () => getCachedOrFetch('suppliers', () => api.get('/suppliers')),
  getById: (id) => api.get(`/suppliers/${id}`),
  create: (data) => {
    clearCache('suppliers');
    return api.post('/suppliers', data);
  },
  update: (id, data) => {
    clearCache('suppliers');
    return api.put(`/suppliers/${id}`, data);
  },
  delete: (id) => {
    clearCache('suppliers');
    return api.delete(`/suppliers/${id}`);
  },
};

export const employeesAPI = {
  getAll: () => getCachedOrFetch('employees', () => api.get('/employees')),
  getById: (id) => api.get(`/employees/${id}`),
  create: (data) => {
    clearCache('employees');
    return api.post('/employees', data);
  },
  update: (id, data) => {
    clearCache('employees');
    return api.put(`/employees/${id}`, data);
  },
  delete: (id) => {
    clearCache('employees');
    return api.delete(`/employees/${id}`);
  },
  getUserData: (userId) => api.get(`/auth/users/${userId}`),
  getUserPermissions: (userId) => api.get(`/auth/users/${userId}/permissions`),
  updateUser: (userId, data) => api.put(`/auth/users/${userId}`, data),
  createUserPermission: (userId, data) => api.post(`/auth/users/${userId}/permissions`, data),
  updateUserPermission: (userId, permissionId, data) => api.put(`/auth/users/${userId}/permissions/${permissionId}`, data),
  deleteUserPermission: (userId, permissionId) => api.delete(`/auth/users/${userId}/permissions/${permissionId}`),
  uploadCSV: (formData) => {
    clearCache('employees');
    return api.post('/employees/upload-csv', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
};

export const scheduleAPI = {
  getAll: () => getCachedOrFetch('schedule', () => api.get('/schedule')),
  getByEmployee: (userId) => api.get(`/schedule/employee/${userId}`),
  getAvailableEmployees: () => api.get('/schedule/employees'),
  create: (data) => {
    clearCache('schedule');
    return api.post('/schedule', data);
  },
  update: (id, data) => {
    clearCache('schedule');
    return api.put(`/schedule/${id}`, data);
  },
};

export const tasksAPI = {
  getAll: () => getCachedOrFetch('tasks', () => api.get('/tasks')),
  getById: (id) => api.get(`/tasks/${id}`),
  getByTitle: (title) => api.get(`/tasks/by-title/${encodeURIComponent(title)}`),
  create: (data) => {
    clearCache('tasks');
    return api.post('/tasks', data);
  },
  update: (id, data) => {
    clearCache('tasks');
    return api.put(`/tasks/${id}`, data);
  },
  delete: (id) => {
    clearCache('tasks');
    return api.delete(`/tasks/${id}`);
  },
  linkByTitle: (taskId, targetTaskTitle) => {
    clearCache('tasks');
    return api.post(`/tasks/${taskId}/link`, {
      target_task_title: targetTaskTitle
    });
  },
  unlink: (taskId, targetTaskId) => {
    clearCache('tasks');
    return api.delete(`/tasks/${taskId}/link/${targetTaskId}`);
  },
};

export const attendanceAPI = {
  getAll: () => getCachedOrFetch('attendance', () => api.get('/attendance')),
  getByUser: (userId) => api.get(`/attendance/user/${userId}`),
  getByUserAndDate: (userId, date) => api.get(`/attendance/user/${userId}/date/${date}`),
  me: () => api.get('/attendance/me'),
  checkUser: () => api.get('/attendance/check-user'),
  clockIn: () => api.post('/attendance/clock-in', {}),
  clockOut: () => api.post('/attendance/clock-out', {}),
  create: (data) => {
    clearCache('attendance');
    return api.post('/attendance', data);
  },
  update: (id, data) => {
    clearCache('attendance');
    return api.put(`/attendance/${id}`, data);
  },
};

export const documentsAPI = {
  getAll: () => getCachedOrFetch('documents', () => api.get('/documents')),
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
  delete: (id) => {
    clearCache('documents');
    return api.delete(`/documents/${id}`);
  },
  update: (id, data) => {
    clearCache('documents');
    return api.put(`/documents/${id}`, data);
  },
  sign: (id, signerName) => api.post(`/documents/${id}/sign`, { signed_by: signerName }),
  fileUrl: (id) => `/api/v1/documents/${id}/download`,
  historyFileUrl: (historyId, { download = true } = {}) =>
    `/api/v1/documents/history/${historyId}/download${download ? '?download=true' : ''}`,
  history: (id) => api.get(`/documents/${id}/history`),
  replaceContent: (id, file, note) => {
    const formData = new FormData();
    formData.append('file', file);
    if (note) formData.append('note', note);
    return api.put(`/documents/${id}/content`, formData);
  },
  listAssignments: (id) => api.get(`/documents/${id}/assignments`),
  addAssignment: (id, user_id) => api.post(`/documents/${id}/assignments`, { user_id }),
  removeAssignment: (id, user_id) => api.delete(`/documents/${id}/assignments/${user_id}`),
  onlyofficeConfig: (id) => api.get(`/documents/${id}/onlyoffice-config`),
};

export const documentCategoriesAPI = {
  list: () => getCachedOrFetch('document-categories', () => api.get('/document-categories')),
  create: (data) => {
    clearCache('document-categories');
    return api.post('/document-categories', data);
  }, // { name, description? }
  update: (id, data) => {
    clearCache('document-categories');
    return api.put(`/document-categories/${id}`, data);
  },
  delete: (id) => {
    clearCache('document-categories');
    return api.delete(`/document-categories/${id}`);
  },
};

export const adminAPI = {
  importData: (formData) => {
    clearCache('clients');
    clearCache('services');
    clearCache('schedule');
    return api.post('/admin/import-data', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  getSystemInfo: () => api.get('/admin/system-info'),
  testAppointments: () => api.get('/admin/test-appointments'),
};

export default api;
