import axios from 'axios';
import cacheService from './cacheService';

// API Configuration - Determine backend URL based on environment
const getApiBaseUrl = () => {
  // Check for explicit environment variable first
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }

  const hostname = window.location.hostname;

  // Check if we're in development (localhost, 127.0.0.1, or private network IPs)
  const isLocalhost = hostname === 'localhost' ||
                      hostname === '127.0.0.1' ||
                      hostname === '';

  // Check for private/local network IPs (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
  const isPrivateIP = /^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/.test(hostname);

  if (isLocalhost || isPrivateIP) {
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

// In-flight request dedup (prevents parallel identical requests during rapid re-renders)
const inFlightRequests = new Map();

// Maps cache keys to their ISUD table names (for background sync)
const ISUD_TABLE_MAP = {
  clients: 'clients',
  inventory: 'inventory',
  services: 'services',
  suppliers: 'suppliers',
  employees: 'users',
  schedule: 'schedules',
  attendance: 'attendance',
  documents: 'documents',
  'document-categories': 'document_category',
};

// Tables currently running a background sync (prevents duplicate syncs)
const syncingTables = new Set();

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

/**
 * Background sync: compares local cache metadata with the server's /sync
 * endpoint. If there's new data, fetches only the delta (rows created after
 * the cached maxCreatedAt) and appends them to localStorage.
 * Runs silently — errors are swallowed (the sync endpoint may not be deployed).
 */
const backgroundSync = async (key, fetchFunction) => {
  const tableName = ISUD_TABLE_MAP[key];
  if (!tableName || syncingTables.has(key)) return;
  syncingTables.add(key);

  try {
    const syncRes = await api.get(`/isud/${tableName}/sync`);
    const { count, max_created_at } = syncRes.data;
    const cached = cacheService.get(key);

    // If counts and max timestamps match, data is up-to-date
    if (cached && cached.count === count && cached.maxCreatedAt === max_created_at) {
      return;
    }

    // Attempt incremental fetch if we have a maxCreatedAt to compare
    if (cached && cached.maxCreatedAt && max_created_at && cached.maxCreatedAt < max_created_at) {
      try {
        const deltaRes = await api.get(`/isud/${tableName}`, {
          params: { _after: cached.maxCreatedAt },
        });
        const newRows = deltaRes?.data ?? [];
        if (Array.isArray(newRows) && newRows.length > 0) {
          cacheService.append(key, newRows);
        }
        return; // incremental success
      } catch {
        // Fall through to full re-fetch
      }
    }

    // Full re-fetch (first load, or incremental failed, or count mismatch due to deletes)
    const response = await fetchFunction();
    const data = response?.data ?? response;
    if (Array.isArray(data)) {
      cacheService.set(key, data);
    }
  } catch {
    // /sync endpoint may not exist yet — silently degrade
  } finally {
    syncingTables.delete(key);
  }
};

/**
 * Persistent cache-then-fetch strategy:
 *  1. If localStorage has cached rows, return them immediately (fast).
 *  2. Schedule a background sync to update localStorage for next visit.
 *  3. If no cached data, do a full fetch and persist the result.
 *  4. In-flight dedup prevents parallel identical requests.
 */
const getCachedOrFetch = async (key, fetchFunction) => {
  // 1. Serve from persistent localStorage cache
  const persisted = cacheService.getRows(key);
  if (persisted.length > 0) {
    // Kick off non-blocking background sync
    backgroundSync(key, fetchFunction);
    // Return shape that matches axios response (callers do res.data)
    return { data: persisted };
  }

  // 2. Dedup: if a request for this key is already in flight, wait for it
  if (inFlightRequests.has(key)) {
    return inFlightRequests.get(key);
  }

  // 3. Full fetch — no cache available
  const promise = fetchFunction()
    .then((response) => {
      const data = response?.data ?? response;
      if (Array.isArray(data)) {
        cacheService.set(key, data);
      }
      inFlightRequests.delete(key);
      return response;
    })
    .catch((err) => {
      inFlightRequests.delete(key);
      throw err;
    });

  inFlightRequests.set(key, promise);
  return promise;
};

/**
 * Clear cache for a specific key (or all if key is falsy).
 * Called by mutation methods (create / update / delete) to invalidate stale data.
 * Clears both in-flight dedup and persistent localStorage.
 */
const clearCache = (key) => {
  if (key) {
    inFlightRequests.delete(key);
    cacheService.clearTable(key);
  } else {
    inFlightRequests.clear();
    cacheService.clearAll();
  }
};

// Expose clearCache globally for logout (called from useStore.logout)
if (typeof window !== 'undefined') {
  window.clearApiCache = () => {
    inFlightRequests.clear();
    cacheService.clearAll();
  };
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
  
  // Image management
  getImages: (inventoryId) => api.get(`/isud/inventory/${inventoryId}/images`),
  addImageUrl: (inventoryId, imageData) => {
    clearCache('inventory');
    return api.post(`/isud/inventory/${inventoryId}/images/url`, imageData);
  },
  uploadImageFile: (inventoryId, file, isPrimary = false) => {
    clearCache('inventory');
    const formData = new FormData();
    formData.append('file', file);
    formData.append('is_primary', isPrimary);
    return api.post(`/isud/inventory/${inventoryId}/images/upload`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  updateImage: (imageId, imageData) => {
    clearCache('inventory');
    return api.put(`/isud/inventory/images/${imageId}`, imageData);
  },
  deleteImage: (imageId) => {
    clearCache('inventory');
    return api.delete(`/isud/inventory/images/${imageId}`);
  },
  getImageFileUrl: (imageId) =>
    `${api.defaults.baseURL}/isud/inventory/images/${imageId}/file`,
  getLocations: () => api.get('/isud/inventory/locations'),
};

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
  delete: (id) => {
    clearCache('schedule');
    return api.delete(`/isud/schedules/${id}`);
  },
};

export const scheduleAttendeesAPI = {
  getBySchedule: (scheduleId) => api.get(`/isud/schedule_attendee?schedule_id=${scheduleId}`),
  create: (data) => api.post('/isud/schedule_attendee', data),
  delete: (id) => api.delete(`/isud/schedule_attendee/${id}`),
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
  sign: (id) => {
    clearCache('documents');
    return api.put(`/documents/${id}/sign`);
  },
  fileUrl: (id, { download = false } = {}) =>
    `${api.defaults.baseURL}/documents/${id}/${download ? 'download' : 'file'}`,
  historyFileUrl: (historyId, { download = true } = {}) =>
    `${api.defaults.baseURL}/documents/history/${historyId}/download${download ? '?download=true' : ''}`,
  history: () => Promise.resolve({ data: [] }),
  replaceContent: () => Promise.reject(new Error('Replace content: use document editor component')),
  listAssignments: (documentId) =>
    api.get(`/documents/${documentId}/assignments`),
  addAssignment: (documentId, entityId, entityType = 'employee') =>
    api.post(`/documents/${documentId}/assignments`, {
      entity_type: entityType,
      entity_id: entityId,
    }),
  removeAssignment: (documentId, entityId, entityType = 'employee') =>
    api.delete(`/documents/${documentId}/assignments/${entityId}?entity_type=${entityType}`),
  onlyofficeConfig: (id) => api.get(`/documents/${id}/onlyoffice-config`),
  getContent: (id) => api.get(`/documents/${id}/content`),
  saveContent: (id, content, contentType) => {
    clearCache('documents');
    return api.put(`/documents/${id}/content`, { content, content_type: contentType });
  },
  saveBinary: (id, blob, contentType) => {
    clearCache('documents');
    const formData = new FormData();
    formData.append('file', blob, 'document');
    if (contentType) formData.append('content_type', contentType);
    return api.put(`/documents/${id}/binary`, formData);
  },
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

// DEPRECATED: Database environment is now stored in user profile (user.db_environment)
// Use employeesAPI.updateUser(userId, { db_environment: 'development' }) to update
export const dbEnvironmentAPI = {
  getCurrent: () => Promise.resolve({ data: { current: 'development', environments: {} } }),
  switch: () => Promise.resolve({ data: { message: 'Use user profile to update db_environment' } }),
};

export const settingsAPI = {
  getScheduleSettings: () => getCachedOrFetch('schedule-settings', () => api.get('/settings/schedule')),
  updateScheduleSettings: (data) => {
    clearCache('schedule-settings');
    return api.put('/settings/schedule', data);
  },
};

// Schema/Database Import API
export const schemaAPI = {
  getTables: () => getCachedOrFetch('schema-tables', () => api.get('/isud/schema/tables')),
  getTableColumns: (tableName) => getCachedOrFetch(`schema-columns-${tableName}`, () => api.get(`/isud/schema/tables/${tableName}/columns`)),
  bulkImport: (tableName, records) => api.post(`/isud/schema/tables/${tableName}/import`, records),
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
  scheduleAttendees: scheduleAttendeesAPI,
  attendance: attendanceAPI,
};

export default api;
