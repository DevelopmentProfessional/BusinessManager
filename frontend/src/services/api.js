import axios from 'axios';

// API Configuration - Determine backend URL based on environment
const getApiBaseUrl = () => {
  // Check for explicit environment variable first
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  
  // Check if we're in development (localhost or 127.0.0.1)
  const isLocalhost = window.location.hostname === 'localhost' || 
                      window.location.hostname === '127.0.0.1' ||
                      window.location.hostname === '';
  
  if (isLocalhost) {
    // Local development uses Vite proxy
    return '/api/v1';
  }
  
  // Production uses direct backend URL
  return 'https://businessmanager-reference-api.onrender.com/api/v1';
};

const API_BASE_URL = getApiBaseUrl();

// Log API configuration for debugging (only in development)
if (import.meta.env.DEV) {
  console.log('API Configuration:', {
    hostname: window.location.hostname,
    protocol: window.location.protocol,
    API_BASE_URL,
    VITE_API_URL: import.meta.env.VITE_API_URL,
  });
}

// Simple cache to prevent duplicate API calls
const apiCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 30 second timeout
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

// Add response interceptor to handle authentication errors and logging
api.interceptors.response.use(
  (response) => {
    // Log successful responses in development
    if (import.meta.env.DEV) {
      console.log(`API Success [${response.config.method?.toUpperCase()}] ${response.config.url}`, {
        status: response.status,
        dataLength: Array.isArray(response.data) ? response.data.length : 'N/A',
      });
    }
    return response;
  },
  (error) => {
    // Enhanced error logging
    if (error.response) {
      // Server responded with error status
      console.error(`API Error [${error.config?.method?.toUpperCase()}] ${error.config?.url}`, {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data,
        baseURL: error.config?.baseURL,
      });
      
      // Handle 401/403 authentication errors
      if (error.response.status === 401 || error.response.status === 403) {
        // Clear auth data and redirect to login
        localStorage.removeItem('token');
        sessionStorage.removeItem('token');
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      }
    } else if (error.request) {
      // Request was made but no response received
      console.error('API Network Error - No response received:', {
        url: error.config?.url,
        baseURL: error.config?.baseURL,
        message: error.message,
      });
    } else {
      // Something else happened
      console.error('API Error:', error.message);
    }
    
    return Promise.reject(error);
  }
);

// Helper function to get cached data or make API call
const getCachedOrFetch = async (key, fetchFunction) => {
  const cached = apiCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    // Return cached response (should be axios response object with .data property)
    return cached.data;
  }
  
  try {
    const response = await fetchFunction();
    // Store the full axios response object in cache
    apiCache.set(key, { data: response, timestamp: Date.now() });
    return response;
  } catch (error) {
    // If there's an error, don't cache it and re-throw
    throw error;
  }
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
  getAll: () => getCachedOrFetch('clients', () => api.get('/isud/clients')),
  getById: (id) => api.get(`/isud/clients/${id}`),
  create: (data) => {
    clearCache('clients');
    return api.post('/isud/clients', data);
  },
  update: (id, data) => {
    clearCache('clients');
    return api.put(`/isud/clients/${id}`, data);
  },
  delete: (id) => {
    clearCache('clients');
    return api.delete(`/isud/clients/${id}`);
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

// Inventory API (replaces both items and inventory APIs)
export const inventoryAPI = {
  getAll: () => getCachedOrFetch('inventory', () => api.get('/isud/inventory')),
  getById: (id) => api.get(`/isud/inventory/${id}`),
  getLowStock: () => getCachedOrFetch('inventory-low-stock', () => api.get('/isud/inventory/low-stock')),
  create: (data) => {
    clearCache('inventory');
    return api.post('/isud/inventory', data);
  },
  update: (id, data) => {
    clearCache('inventory');
    return api.put(`/isud/inventory/${id}`, data);
  },
  delete: (id) => {
    clearCache('inventory');
    return api.delete(`/isud/inventory/${id}`);
  },
};

// Legacy alias for backward compatibility (deprecated - use inventoryAPI)
export const itemsAPI = inventoryAPI;

export const servicesAPI = {
  getAll: () => getCachedOrFetch('services', () => api.get('/isud/services')),
  getById: (id) => api.get(`/isud/services/${id}`),
  create: (data) => {
    clearCache('services');
    return api.post('/isud/services', data);
  },
  update: (id, data) => {
    clearCache('services');
    return api.put(`/isud/services/${id}`, data);
  },
  delete: (id) => {
    clearCache('services');
    return api.delete(`/isud/services/${id}`);
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
  getAll: () => getCachedOrFetch('suppliers', () => api.get('/isud/suppliers')),
  getById: (id) => api.get(`/isud/suppliers/${id}`),
  create: (data) => {
    clearCache('suppliers');
    return api.post('/isud/suppliers', data);
  },
  update: (id, data) => {
    clearCache('suppliers');
    return api.put(`/isud/suppliers/${id}`, data);
  },
  delete: (id) => {
    clearCache('suppliers');
    return api.delete(`/isud/suppliers/${id}`);
  },
};

export const employeesAPI = {
  getAll: () => getCachedOrFetch('employees', () => api.get('/isud/users')),
  getById: (id) => api.get(`/isud/users/${id}`),
  create: (data) => {
    clearCache('employees');
    return api.post('/isud/users', data);
  },
  update: (id, data) => {
    clearCache('employees');
    return api.put(`/isud/users/${id}`, data);
  },
  delete: (id) => {
    clearCache('employees');
    return api.delete(`/isud/users/${id}`);
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

export const rolesAPI = {
  getAll: () => getCachedOrFetch('roles', () => api.get('/auth/roles')),
  getById: (id) => api.get(`/auth/roles/${id}`),
  create: (data) => {
    clearCache('roles');
    return api.post('/auth/roles', data);
  },
  update: (id, data) => {
    clearCache('roles');
    return api.put(`/auth/roles/${id}`, data);
  },
  delete: (id) => {
    clearCache('roles');
    return api.delete(`/auth/roles/${id}`);
  },
  addPermission: (roleId, data) => {
    clearCache('roles');
    return api.post(`/auth/roles/${roleId}/permissions`, data);
  },
  removePermission: (roleId, permissionId) => {
    clearCache('roles');
    return api.delete(`/auth/roles/${roleId}/permissions/${permissionId}`);
  },
};

export const scheduleAPI = {
  getAll: () => getCachedOrFetch('schedule', () => api.get('/isud/schedules')),
  getByEmployee: (userId) => api.get(`/isud/schedules?employee_id=${userId}`),
  getAvailableEmployees: () => api.get('/isud/users'),
  create: (data) => {
    clearCache('schedule');
    return api.post('/isud/schedules', data);
  },
  update: (id, data) => {
    clearCache('schedule');
    return api.put(`/isud/schedules/${id}`, data);
  },
};

export const attendanceAPI = {
  getAll: () => getCachedOrFetch('attendance', () => api.get('/isud/attendance')),
  getByUser: (userId) => api.get(`/isud/attendance?employee_id=${userId}`),
  getByUserAndDate: (userId, date) => api.get(`/isud/attendance?employee_id=${userId}&date=${date}`),
  me: () => api.get('/auth/attendance/me'),
  checkUser: () => api.get('/auth/attendance/check-user'),
  clockIn: () => api.post('/auth/attendance/clock-in', {}),
  clockOut: () => api.post('/auth/attendance/clock-out', {}),
  create: (data) => {
    clearCache('attendance');
    return api.post('/isud/attendance', data);
  },
  update: (id, data) => {
    clearCache('attendance');
    return api.put(`/isud/attendance/${id}`, data);
  },
};

// Documents: full CRUD via ISUD pattern including file uploads.
export const documentsAPI = {
  getAll: () => getCachedOrFetch('documents', () => api.get('/isud/documents')),
  getById: (id) => api.get(`/isud/documents/${id}`),
  getByEntity: (entityType, entityId) =>
    api.get('/isud/documents', { params: { entity_type: entityType, entity_id: entityId } }),
  upload: (file, description, extra = {}) => {
    clearCache('documents');
    const formData = new FormData();
    formData.append('file', file);
    if (description) formData.append('description', description);
    if (extra.entity_type) formData.append('entity_type', extra.entity_type);
    if (extra.entity_id) formData.append('entity_id', extra.entity_id);
    if (extra.category_id) formData.append('category_id', extra.category_id);
    return api.post('/isud/document/insert', formData);
  },
  uploadBulk: (files, { entity_type, entity_id, description } = {}) =>
    Promise.all(
      files.map((file) =>
        documentsAPI.upload(file, description, { entity_type, entity_id })
      )
    ),
  delete: (id) => {
    clearCache('documents');
    return api.delete(`/isud/documents/${id}`);
  },
  update: (id, data) => {
    clearCache('documents');
    return api.put(`/isud/documents/${id}`, data);
  },
  sign: (id, signerName) =>
    api.put(`/isud/documents/${id}`, {
      is_signed: true,
      signed_by: signerName,
      signed_at: new Date().toISOString(),
    }),
  fileUrl: (id, { download = false } = {}) =>
    `${api.defaults.baseURL}/documents/${id}/download${download ? '?download=true' : ''}`,
  historyFileUrl: (historyId, { download = true } = {}) =>
    `${api.defaults.baseURL}/documents/history/${historyId}/download${download ? '?download=true' : ''}`,
  history: () => Promise.resolve({ data: [] }),
  replaceContent: () => Promise.reject(new Error('Replace content: use document editor component')),
  listAssignments: () => Promise.resolve({ data: [] }),
  addAssignment: () => Promise.reject(new Error('Assignments: use document editor component')),
  removeAssignment: () => Promise.reject(new Error('Assignments: use document editor component')),
  onlyofficeConfig: (id) => api.get(`/documents/${id}/onlyoffice-config`),
};

// Document categories: full CRUD via isud (table document_category).
export const documentCategoriesAPI = {
  list: () => getCachedOrFetch('document-categories', () => api.get('/isud/document_category')),
  create: (data) => {
    clearCache('document-categories');
    return api.post('/isud/document_category', data);
  },
  update: (id, data) => {
    clearCache('document-categories');
    return api.put(`/isud/document_category/${id}`, data);
  },
  delete: (id) => {
    clearCache('document-categories');
    return api.delete(`/isud/document_category/${id}`);
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

export const dbEnvironmentAPI = {
  getCurrent: () => api.get('/auth/db-environment'),
  switch: (environment) => api.post('/auth/db-environment', { environment }),
};

export const reportsAPI = {
  getAppointmentsReport: (params) => {
    const queryParams = new URLSearchParams(params).toString();
    return api.get(`/reports/appointments?${queryParams}`);
  },
  getRevenueReport: (params) => {
    const queryParams = new URLSearchParams(params).toString();
    return api.get(`/reports/revenue?${queryParams}`);
  },
  getServicesReport: (params) => {
    const queryParams = new URLSearchParams(params).toString();
    return api.get(`/reports/services?${queryParams}`);
  },
  getClientsReport: (params) => {
    const queryParams = new URLSearchParams(params).toString();
    return api.get(`/reports/clients?${queryParams}`);
  },
  getInventoryReport: () => {
    return api.get('/reports/inventory');
  },
  getEmployeesReport: (params) => {
    const queryParams = new URLSearchParams(params).toString();
    return api.get(`/reports/employees?${queryParams}`);
  },
};

/**
 * Single API namespace for the isud DB backend.
 * Components that need isud data should import isudAPI and call it directly
 * so they work independently on any page (no dependency on parent/page loading store).
 */
export const isudAPI = {
  clients: clientsAPI,
  inventory: inventoryAPI,
  services: servicesAPI,
  suppliers: suppliersAPI,
  employees: employeesAPI,
  schedule: scheduleAPI,
  attendance: attendanceAPI,
};

export default api;
