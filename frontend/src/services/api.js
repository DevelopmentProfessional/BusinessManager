import axios from "axios";

// API Configuration - Determine backend URL based on environment
const getApiBaseUrl = () => {
  // Check for explicit environment variable first
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }

  const hostname = window.location.hostname;

  // Check if we're in development (localhost, 127.0.0.1, or private network IPs)
  const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "";

  // Check for private/local network IPs (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
  const isPrivateIP = /^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/.test(hostname);

  if (isLocalhost || isPrivateIP) {
    // Local development uses Vite proxy
    return "/api/v1";
  }

  // Production fallback: static frontend is hosted separately from backend API on Render.
  return "https://businessmanager-reference-api.onrender.com/api/v1";
};

const API_BASE_URL = getApiBaseUrl();

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000, // 60s — covers Render cold-start wake-up time
});

// Add authentication interceptor
api.interceptors.request.use((config) => {
  // Get token from localStorage or sessionStorage
  const token = localStorage.getItem("token") || sessionStorage.getItem("token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // Ensure FormData requests are sent as multipart/form-data (let the browser set the boundary)
  const isFormData = typeof FormData !== "undefined" && config.data instanceof FormData;
  if (isFormData) {
    if (config.headers && "Content-Type" in config.headers) {
      delete config.headers["Content-Type"];
    }
  }

  return config;
});

// Add response interceptor — auto-retry on timeout, handle 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config;

    // Retry once on timeout (ECONNABORTED) — handles Render cold-start delays
    if (error.code === "ECONNABORTED" && config && !config._retried) {
      config._retried = true;
      await new Promise((r) => setTimeout(r, 2000));
      return api(config);
    }

    if (error.response?.status === 401) {
      localStorage.removeItem("token");
      sessionStorage.removeItem("token");
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }

    return Promise.reject(error);
  }
);

// Caching removed — all fetches hit the server directly.
const getCachedOrFetch = (_key, fetchFunction) => fetchFunction();
const clearCache = () => {};
if (typeof window !== "undefined") {
  window.clearApiCache = () => {};
}

// ─── FACTORIES ────────────────────────────────────────────────────────────────

// Creates a standard ISUD CRUD API (getAll / getById / create / update / delete).
// tableName : ISUD route segment, e.g. "clients", "inventory"
// cacheKey  : optional cache key override (defaults to tableName)
function createISUDApi(tableName, cacheKey) {
  const key = cacheKey ?? tableName;
  return {
    getAll: () => getCachedOrFetch(key, () => api.get(`/isud/${tableName}`)),
    getById: (id) => api.get(`/isud/${tableName}/${id}`),
    create: (data) => {
      clearCache(key);
      return api.post(`/isud/${tableName}`, data);
    },
    update: (id, data) => {
      clearCache(key);
      return api.put(`/isud/${tableName}/${id}`, data);
    },
    delete: (id) => {
      clearCache(key);
      return api.delete(`/isud/${tableName}/${id}`);
    },
  };
}

// Creates an HR-request API (leave / onboarding / offboarding).
// tableName    : ISUD table name, e.g. "leave_request"
// actionPrefix : URL prefix for the action endpoint, e.g. "leave-requests"
function createRequestApi(tableName, actionPrefix) {
  return {
    getAll: () => api.get(`/isud/${tableName}`),
    getBySupervisor: (supervisorId) => api.get(`/isud/${tableName}?supervisor_id=${supervisorId}`),
    getByUser: (userId) => api.get(`/isud/${tableName}?user_id=${userId}`),
    create: (data) => api.post(`/isud/${tableName}`, data),
    update: (id, data) => api.put(`/isud/${tableName}/${id}`, data),
    delete: (id) => api.delete(`/isud/${tableName}/${id}`),
    action: (id, action) => api.put(`/${actionPrefix}/${id}/action`, { action }),
  };
}

/**
 * Preload major tables into the Zustand store after login.
 * Fire-and-forget — call without await. Fetches sequentially with a small
 * stagger so pages feel instant on first visit.
 *
 * @param {object} setters - Store setter functions
 */
export const preloadStoreData = async ({ setClients, setServices, setEmployees, setInventory, setAppointments }) => {
  const token = localStorage.getItem("token") || sessionStorage.getItem("token");
  if (!token) return;

  const tables = [
    { fetch: () => api.get("/isud/clients"), set: setClients },
    { fetch: () => api.get("/isud/services"), set: setServices },
    { fetch: () => api.get("/isud/users"), set: setEmployees },
    { fetch: () => api.get("/isud/inventory"), set: setInventory },
    { fetch: () => api.get("/isud/schedules"), set: setAppointments },
  ];

  for (const { fetch, set } of tables) {
    try {
      const res = await fetch();
      const data = res?.data ?? res;
      if (Array.isArray(data)) set(data);
    } catch {
      /* individual failure won't abort the rest */
    }
    await new Promise((r) => setTimeout(r, 200));
  }
};

// API endpoints for all entities
export const clientsAPI = {
  ...createISUDApi("clients"),
  uploadCSV: (formData) => {
    clearCache("clients");
    return api.post("/clients/upload-csv", formData, { headers: { "Content-Type": "multipart/form-data" } });
  },
  getSchedules: (clientId) => api.get(`/isud/schedules?client_id=${clientId}`),
  getTransactions: (clientId) => api.get(`/isud/sale_transaction?client_id=${clientId}`),
  getTransactionItems: (transactionId) => api.get(`/isud/sale_transaction_item?sale_transaction_id=${transactionId}`),
  getPortalOrders: (clientId) => api.get(`/isud/client_orders?client_id=${clientId}`),
  getPortalOrderItems: (orderId) => api.get(`/isud/client_order_items?order_id=${orderId}`),
  bulkImport: async (records) => {
    clearCache("clients");
    const results = [];
    for (const record of records) {
      results.push((await api.post("/isud/clients", record))?.data);
    }
    return { created_count: results.length };
  },
};

// Inventory API (replaces both items and inventory APIs)
export const inventoryAPI = {
  getAll: () => getCachedOrFetch("inventory", () => api.get("/isud/inventory")),
  getById: (id) => api.get(`/isud/inventory/${id}`),
  getLowStock: () => getCachedOrFetch("inventory-low-stock", () => api.get("/isud/inventory/low-stock")),
  create: (data) => {
    clearCache("inventory");
    return api.post("/isud/inventory", data);
  },
  update: (id, data) => {
    clearCache("inventory");
    return api.put(`/isud/inventory/${id}`, data);
  },
  delete: (id) => {
    clearCache("inventory");
    return api.delete(`/isud/inventory/${id}`);
  },

  // Image management — always fetches fresh from database; uses cache only for offline mode
  getImages: (inventoryId) => api.get(`/isud/inventory/${inventoryId}/images`),
  addImageUrl: (inventoryId, imageData) => {
    return api.post(`/isud/inventory/${inventoryId}/images/url`, imageData);
  },
  uploadImageFile: (inventoryId, file, isPrimary = false) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("is_primary", isPrimary);
    return api.post(`/isud/inventory/${inventoryId}/images/upload`, formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
  },
  updateImage: (imageId, imageData) => {
    return api.put(`/isud/inventory/images/${imageId}`, imageData);
  },
  deleteImage: (imageId) => {
    return api.delete(`/isud/inventory/images/${imageId}`);
  },
  getImageFileUrl: (imageId) => {
    const token = localStorage.getItem("token") || sessionStorage.getItem("token") || "";
    const base = `${api.defaults.baseURL}/isud/inventory/images/${imageId}/file`;
    return token ? `${base}?token=${encodeURIComponent(token)}` : base;
  },
  getLocations: () => api.get("/isud/inventory/locations"),
  bulkImport: (products) => {
    clearCache("inventory");
    return api.post("/products/bulk-import", { products });
  },
};

// ─── Descriptive Features API ────────────────────────────────────────────────
export const featuresAPI = {
  listAll: () => api.get("/features"),
  create: (data) => api.post("/features", data),
  rename: (id, data) => api.patch(`/features/${id}`, data),
  delete: (id) => api.delete(`/features/${id}`),
  addOption: (fid, data) => api.post(`/features/${fid}/options`, data),
  renameOption: (fid, oid, data) => api.patch(`/features/${fid}/options/${oid}`, data),
  deleteOption: (fid, oid) => api.delete(`/features/${fid}/options/${oid}`),
  getInventorySummary: () => api.get("/features/inventory-summary"),
  deductStock: (items) => api.post("/features/deduct-stock", items),
};

export const inventoryFeaturesAPI = {
  get: (invId) => api.get(`/inventory/${invId}/features`),
  getCombinations: (invId) => api.get(`/inventory/${invId}/feature-combinations`),
  addFeature: (invId, fid) => api.post(`/inventory/${invId}/features/${fid}`),
  removeFeature: (invId, fid) => api.delete(`/inventory/${invId}/features/${fid}`),
  setAffectsPrice: (invId, data) => api.patch(`/inventory/${invId}/features/affects-price`, data),
  saveCombinations: (invId, rows) => api.put(`/inventory/${invId}/feature-combinations`, rows),
  saveOptionData: (invId, fid, rows) => api.put(`/inventory/${invId}/features/${fid}/options`, rows),
};

export const servicesAPI = {
  ...createISUDApi("services"),
  uploadCSV: (formData) => {
    clearCache("services");
    return api.post("/services/upload-csv", formData, { headers: { "Content-Type": "multipart/form-data" } });
  },
  bulkImport: async (records) => {
    clearCache("services");
    const results = [];
    for (const record of records) {
      results.push((await api.post("/isud/services", record))?.data);
    }
    return { created_count: results.length };
  },
};

export const serviceRelationsAPI = {
  // Consumable resources linked to a service
  getResources: (serviceId) => api.get(`/isud/service_resource?service_id=${serviceId}`),
  addResource: (serviceId, inventoryId, quantity, consumptionRatePct = null) =>
    api.post("/isud/service_resource", {
      service_id: serviceId,
      inventory_id: inventoryId,
      quantity,
      ...(consumptionRatePct != null ? { consumption_rate_pct: consumptionRatePct } : {}),
    }),
  updateResource: (id, quantity) => api.put(`/isud/service_resource/${id}`, { quantity }),
  updateResourceRate: (id, rate) => api.put(`/isud/service_resource/${id}`, { consumption_rate_pct: rate }),
  removeResource: (id) => api.delete(`/isud/service_resource/${id}`),

  // Assets reserved for the full duration of a service
  getAssets: (serviceId) => api.get(`/isud/service_asset?service_id=${serviceId}`),
  addAsset: (serviceId, inventoryId) => api.post("/isud/service_asset", { service_id: serviceId, inventory_id: inventoryId }),
  updateAssetDuration: (id, durationMinutes) => api.put(`/isud/service_asset/${id}`, { asset_duration_minutes: durationMinutes }),
  removeAsset: (id) => api.delete(`/isud/service_asset/${id}`),

  // Employees capable of performing a service
  getEmployees: (serviceId) => api.get(`/isud/service_employee?service_id=${serviceId}`),
  addEmployee: (serviceId, userId) => api.post("/isud/service_employee", { service_id: serviceId, user_id: userId }),
  removeEmployee: (id) => api.delete(`/isud/service_employee/${id}`),

  // Locations where the service is offered
  getLocations: (serviceId) => api.get(`/isud/service_location?service_id=${serviceId}`),
  addLocation: (serviceId, inventoryId) => api.post("/isud/service_location", { service_id: serviceId, inventory_id: inventoryId }),
  removeLocation: (id) => api.delete(`/isud/service_location/${id}`),
};

export const serviceRecipeAPI = {
  get: (serviceId) => api.get(`/isud/service_recipe?service_id=${serviceId}`),
  create: (data) => api.post("/isud/service_recipe", data),
  update: (id, data) => api.put(`/isud/service_recipe/${id}`, data),
};

export const suppliersAPI = createISUDApi("suppliers");

export const employeesAPI = {
  ...createISUDApi("users", "employees"),
  getUserData: (userId) => api.get(`/auth/users/${userId}`),
  lockUser: (userId) => api.post(`/auth/users/${userId}/lock`),
  unlockUser: (userId) => api.post(`/auth/users/${userId}/unlock`),
  getUserPermissions: (userId) => api.get(`/auth/users/${userId}/permissions`),
  updateUser: (userId, data) => api.put(`/auth/users/${userId}`, data),
  createUserPermission: (userId, data) => api.post(`/auth/users/${userId}/permissions`, data),
  updateUserPermission: (userId, permissionId, data) => api.put(`/auth/users/${userId}/permissions/${permissionId}`, data),
  deleteUserPermission: (userId, permissionId) => api.delete(`/auth/users/${userId}/permissions/${permissionId}`),
  uploadCSV: (formData) => {
    clearCache("employees");
    return api.post("/employees/upload-csv", formData, { headers: { "Content-Type": "multipart/form-data" } });
  },
  bulkImport: async (records) => {
    clearCache("employees");
    const results = [];
    for (const record of records) {
      results.push((await api.post("/isud/users", record))?.data);
    }
    return { created_count: results.length };
  },
};

export const profileAPI = {
  updateMyProfile: (data) => api.put("/auth/me/profile", data),
  uploadProfilePicture: (file) => {
    const formData = new FormData();
    formData.append("file", file);
    return api.put("/auth/me/profile-picture", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  getProfilePictureUrl: (userId) => `${api.defaults.baseURL}/auth/users/${userId}/profile-picture`,
};

export const departmentsAPI = createISUDApi("department");

export const rolesAPI = {
  getAll: () => getCachedOrFetch("roles", () => api.get("/auth/roles")),
  getById: (id) => api.get(`/auth/roles/${id}`),
  create: (data) => {
    clearCache("roles");
    return api.post("/auth/roles", data);
  },
  update: (id, data) => {
    clearCache("roles");
    return api.put(`/auth/roles/${id}`, data);
  },
  delete: (id) => {
    clearCache("roles");
    return api.delete(`/auth/roles/${id}`);
  },
  addPermission: (roleId, data) => {
    clearCache("roles");
    return api.post(`/auth/roles/${roleId}/permissions`, data);
  },
  removePermission: (roleId, permissionId) => {
    clearCache("roles");
    return api.delete(`/auth/roles/${roleId}/permissions/${permissionId}`);
  },
};

export const scheduleAPI = {
  ...createISUDApi("schedules", "schedule"),
  getByEmployee: (userId) => api.get(`/isud/schedules?employee_id=${userId}`),
  getAvailableEmployees: () => api.get("/isud/users"),
};

export const scheduleAttendeesAPI = {
  getBySchedule: (scheduleId) => api.get(`/isud/schedule_attendee?schedule_id=${scheduleId}`),
  create: (data) => api.post("/isud/schedule_attendee", data),
  delete: (id) => api.delete(`/isud/schedule_attendee/${id}`),
};

export const tasksAPI = {
  getAll: () => getCachedOrFetch("tasks", () => api.get("/tasks")),
  getById: (id) => api.get(`/tasks/${id}`),
  getByTitle: (title) => api.get(`/tasks/by-title/${encodeURIComponent(title)}`),
  create: (data) => {
    clearCache("tasks");
    return api.post("/tasks", data);
  },
  update: (id, data) => {
    clearCache("tasks");
    return api.put(`/tasks/${id}`, data);
  },
  delete: (id) => {
    clearCache("tasks");
    return api.delete(`/tasks/${id}`);
  },
  linkByTitle: (taskId, targetTaskTitle) => {
    clearCache("tasks");
    return api.post(`/tasks/${taskId}/link`, {
      target_task_title: targetTaskTitle,
    });
  },
  unlink: (taskId, targetTaskId) => {
    clearCache("tasks");
    return api.delete(`/tasks/${taskId}/link/${targetTaskId}`);
  },
};

export const attendanceAPI = {
  ...createISUDApi("attendance"),
  getByUser: (userId) => api.get(`/isud/attendance?employee_id=${userId}`),
  getByUserAndDate: (userId, date) => api.get(`/isud/attendance?employee_id=${userId}&date=${date}`),
  me: () => api.get("/auth/attendance/me"),
  checkUser: () => api.get("/auth/attendance/check-user"),
  clockIn: () => api.post("/auth/attendance/clock-in", {}),
  clockOut: () => api.post("/auth/attendance/clock-out", {}),
};

// Documents: full CRUD via ISUD pattern including file uploads.
export const documentsAPI = {
  getAll: () => getCachedOrFetch("documents", () => api.get("/isud/documents")),
  getById: (id) => api.get(`/isud/documents/${id}`),
  getByEntity: (entityType, entityId) => api.get("/isud/documents", { params: { entity_type: entityType, entity_id: entityId } }),
  upload: (file, description, extra = {}) => {
    clearCache("documents");
    const formData = new FormData();
    formData.append("file", file);
    if (description) formData.append("description", description);
    if (extra.entity_type) formData.append("entity_type", extra.entity_type);
    if (extra.entity_id) formData.append("entity_id", extra.entity_id);
    if (extra.category_id) formData.append("category_id", extra.category_id);
    return api.post("/isud/document/insert", formData);
  },
  uploadBulk: (files, { entity_type, entity_id, description } = {}) => Promise.all(files.map((file) => documentsAPI.upload(file, description, { entity_type, entity_id }))),
  delete: (id) => {
    clearCache("documents");
    return api.delete(`/isud/documents/${id}`);
  },
  update: (id, data) => {
    clearCache("documents");
    return api.put(`/isud/documents/${id}`, data);
  },
  sign: (id) => {
    clearCache("documents");
    return api.put(`/documents/${id}/sign`);
  },
  fileUrl: (id, { download = false } = {}) => `${api.defaults.baseURL}/documents/${id}/${download ? "download" : "file"}`,
  historyFileUrl: (historyId, { download = true } = {}) => `${api.defaults.baseURL}/documents/history/${historyId}/download${download ? "?download=true" : ""}`,
  history: () => Promise.resolve({ data: [] }),
  replaceContent: () => Promise.reject(new Error("Replace content: use document editor component")),
  listAssignments: (documentId) => api.get(`/documents/${documentId}/assignments`),
  addAssignment: (documentId, entityId, entityType = "employee") =>
    api.post(`/documents/${documentId}/assignments`, {
      entity_type: entityType,
      entity_id: entityId,
    }),
  removeAssignment: (documentId, entityId, entityType = "employee") => api.delete(`/documents/${documentId}/assignments/${entityId}?entity_type=${entityType}`),
  onlyofficeConfig: (id) => api.get(`/documents/${id}/onlyoffice-config`),
  getContent: (id) => api.get(`/documents/${id}/content`),
  saveContent: (id, content, contentType) => {
    clearCache("documents");
    return api.put(`/documents/${id}/content`, { content, content_type: contentType });
  },
  saveBinary: (id, blob, contentType) => {
    clearCache("documents");
    const formData = new FormData();
    formData.append("file", blob, "document");
    if (contentType) formData.append("content_type", contentType);
    return api.put(`/documents/${id}/binary`, formData);
  },
};

// Document tags: company-scoped tags + per-document assignment.
export const documentTagsAPI = {
  list: (q) => api.get("/document-tags", { params: q ? { q } : {} }),
  create: (name) => api.post("/document-tags", { name }),
  delete: (tagId) => api.delete(`/document-tags/${tagId}`),
  getForDocument: (documentId) => api.get(`/documents/${documentId}/tags`),
  setForDocument: (documentId, tagIds) => api.put(`/documents/${documentId}/tags`, { tag_ids: tagIds }),
  getAllLinks: () => api.get("/document-tag-links"),
};

// Document categories: full CRUD via isud (table document_category).
export const documentCategoriesAPI = {
  list: () => getCachedOrFetch("document-categories", () => api.get("/isud/document_category")),
  create: (data) => {
    clearCache("document-categories");
    return api.post("/isud/document_category", data);
  },
  update: (id, data) => {
    clearCache("document-categories");
    return api.put(`/isud/document_category/${id}`, data);
  },
  delete: (id) => {
    clearCache("document-categories");
    return api.delete(`/isud/document_category/${id}`);
  },
};

export const leaveRequestsAPI = {
  ...createRequestApi("leave_request", "leave-requests"),
  // Override getByUser to support optional leaveType filter
  getByUser: (userId, leaveType) => api.get(leaveType ? `/isud/leave_request?user_id=${userId}&leave_type=${leaveType}` : `/isud/leave_request?user_id=${userId}`),
};

export const onboardingRequestsAPI = createRequestApi("onboarding_request", "onboarding-requests");
export const offboardingRequestsAPI = createRequestApi("offboarding_request", "offboarding-requests");

export const saleTransactionsAPI = {
  getAll: () => getCachedOrFetch("sale-transactions", () => api.get("/isud/sale_transaction")),
  create: (data) => {
    clearCache("sale-transactions");
    return api.post("/isud/sale_transaction", data);
  },
  createItem: (data) => api.post("/isud/sale_transaction_item", data),
  getItems: (transactionId) => api.get(`/isud/sale_transaction_item?sale_transaction_id=${transactionId}`),
};

/** Persistent client cart — database-backed, shared across employees/sessions */
export const clientCartAPI = {
  getItems: (clientId) => api.get(`/client-cart/${clientId}`),
  upsertItem: (clientId, itemData) => api.put(`/client-cart/${clientId}/item`, itemData),
  removeItem: (clientId, cartKey) => api.delete(`/client-cart/${clientId}/item/${encodeURIComponent(cartKey)}`),
  clearCart: (clientId) => api.delete(`/client-cart/${clientId}`),
};

export const clientOrdersAPI = {
  getAll: (params = {}) => api.get("/portal-orders", { params }),
  getItems: (orderId) => api.get(`/portal-orders/${orderId}/items`),
  createFromCart: (clientId, data = {}) => api.post(`/portal-orders/from-client-cart/${clientId}`, data),
  pay: (orderId, data = {}) => api.post(`/portal-orders/${orderId}/pay`, data),
  updateStatus: (orderId, status) => api.patch(`/portal-orders/${orderId}/status`, { status }),
};

// Product production relations (resources / assets / locations linked to a manufactured product)
export const productRelationsAPI = {
  // Resources consumed per batch
  getResources: (inventoryId) => api.get(`/isud/product_resource?inventory_id=${inventoryId}`),
  addResource: (inventoryId, resourceId, quantityPerBatch, notes = null) => api.post("/isud/product_resource", { inventory_id: inventoryId, resource_id: resourceId, quantity_per_batch: quantityPerBatch, notes }),
  updateResource: (id, data) => api.put(`/isud/product_resource/${id}`, data),
  removeResource: (id) => api.delete(`/isud/product_resource/${id}`),

  // Assets used during production
  getAssets: (inventoryId) => api.get(`/isud/product_asset?inventory_id=${inventoryId}`),
  addAsset: (inventoryId, assetId, batchSize = 1, durationMinutes = null) => api.post("/isud/product_asset", { inventory_id: inventoryId, asset_id: assetId, batch_size: batchSize, duration_minutes: durationMinutes }),
  updateAsset: (id, data) => api.put(`/isud/product_asset/${id}`, data),
  removeAsset: (id) => api.delete(`/isud/product_asset/${id}`),

  // Locations where the product is manufactured
  getLocations: (inventoryId) => api.get(`/isud/product_location?inventory_id=${inventoryId}`),
  addLocation: (inventoryId, locationId) => api.post("/isud/product_location", { inventory_id: inventoryId, location_id: locationId }),
  removeLocation: (id) => api.delete(`/isud/product_location/${id}`),
};

export const inventoryCategoriesAPI = {
  getByType: (itemType) => api.get(`/inventory-categories?item_type=${encodeURIComponent(itemType)}`),
  create: (itemType, name) => api.post("/inventory-categories", { item_type: itemType, name }),
  delete: (id) => api.delete(`/inventory-categories/${id}`),
};

export const discountRulesAPI = createISUDApi("discount_rule");

export const mixAPI = {
  // Mix config (one record per mix inventory item)
  getConfig: (inventoryId) => api.get(`/isud/mix_config?inventory_id=${inventoryId}`),
  saveConfig: (data) => api.post("/isud/mix_config", data),
  updateConfig: (id, data) => api.put(`/isud/mix_config/${id}`, data),
  // Mix components (products selectable within the mix)
  getComponents: (mixId) => api.get(`/isud/mix_component?mix_id=${mixId}`),
  addComponent: (mixId, componentId, maxQty = null) => api.post("/isud/mix_component", { mix_id: mixId, component_id: componentId, max_quantity: maxQty }),
  updateComponent: (id, data) => api.put(`/isud/mix_component/${id}`, data),
  removeComponent: (id) => api.delete(`/isud/mix_component/${id}`),
};

export const bundleAPI = {
  getComponents: (bundleId) => api.get(`/isud/bundle_component?bundle_id=${bundleId}`),
  addComponent: (bundleId, componentId, quantity, notes = null) => api.post("/isud/bundle_component", { bundle_id: bundleId, component_id: componentId, quantity, notes }),
  updateComponent: (id, data) => api.put(`/isud/bundle_component/${id}`, data),
  removeComponent: (id) => api.delete(`/isud/bundle_component/${id}`),
};

// Production task completion
export const productionAPI = {
  getInfo: (scheduleId) => api.get(`/production/tasks/${scheduleId}/info`),
  completeTask: (scheduleId) => api.post(`/production/tasks/${scheduleId}/complete`),
};

export const insurancePlansAPI = createISUDApi("insurance_plan", "insurance-plans");

export const payrollAPI = {
  processPayment: (employeeId, data) => api.post(`/payroll/pay/${employeeId}`, data),
  getByEmployee: (employeeId) => api.get(`/payroll/pay-slips/${employeeId}`),
  getAll: () => api.get("/payroll/pay-slips"),
  checkEligibility: (employeeId, periodStart) => api.get(`/payroll/check/${employeeId}?period_start=${encodeURIComponent(periodStart)}`),
};

export const chatAPI = {
  getHistory: (otherUserId) => api.get(`/chat/messages/${otherUserId}`),
  sendMessage: (receiverId, data) => api.post(`/chat/messages/${receiverId}`, data),
  markRead: (otherUserId) => api.put(`/chat/messages/${otherUserId}/read`),
  getUnreadCounts: () => api.get("/chat/unread-counts"),
};

export const adminAPI = {
  importData: (formData) => {
    clearCache("clients");
    clearCache("services");
    clearCache("schedule");
    return api.post("/admin/import-data", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
  },
  getSystemInfo: () => api.get("/admin/system-info"),
  testAppointments: () => api.get("/admin/test-appointments"),
};

// DEPRECATED: Runtime database routing is Render-only.
// The db_environment profile field is retained only for backward compatibility.
export const dbEnvironmentAPI = {
  getCurrent: () => Promise.resolve({ data: { current: "production", environments: { production: { name: "Render", configured: true, is_current: true } } } }),
  switch: () => Promise.resolve({ data: { message: "Database routing is fixed to the Render PostgreSQL environment." } }),
};

export const settingsAPI = {
  getScheduleSettings: () => getCachedOrFetch("schedule-settings", () => api.get("/settings/schedule")),
  updateScheduleSettings: (data) => {
    clearCache("schedule-settings");
    return api.put("/settings/schedule", data);
  },
  // Aliases (same endpoint, both names work)
  getSettings: () => getCachedOrFetch("schedule-settings", () => api.get("/settings/schedule")),
  updateSettings: (data) => {
    clearCache("schedule-settings");
    return api.put("/settings/schedule", data);
  },
  seedDemoData: (force = true, seedKey = "") => {
    const headers = {};
    if (seedKey) {
      headers["X-Seed-Key"] = seedKey;
    }
    return api.post("/settings/admin/seed", { force }, { headers });
  },
};

export const templatesAPI = {
  getAll: (page) => api.get("/templates" + (page ? `?page=${encodeURIComponent(page)}` : "")),
  getById: (id) => api.get(`/templates/${id}`),
  create: (data) => api.post("/templates", data),
  update: (id, data) => api.put(`/templates/${id}`, data),
  delete: (id) => api.delete(`/templates/${id}`),
  render: (id, variables) => api.post(`/templates/${id}/render`, { variables }),
};

// Schema/Database Import API
export const schemaAPI = {
  getTables: () => getCachedOrFetch("schema-tables", () => api.get("/isud/schema/tables")),
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
    return api.get("/reports/inventory");
  },
  getEmployeesReport: (params) => {
    const queryParams = new URLSearchParams(params).toString();
    return api.get(`/reports/employees?${queryParams}`);
  },
  getAttendanceReport: (params) => {
    const queryParams = new URLSearchParams(params).toString();
    return api.get(`/reports/attendance?${queryParams}`);
  },
  getSalesReport: (params) => {
    const queryParams = new URLSearchParams(params).toString();
    return api.get(`/reports/sales?${queryParams}`);
  },
  getPayrollReport: (params) => {
    const queryParams = new URLSearchParams(params).toString();
    return api.get(`/reports/payroll?${queryParams}`);
  },
};

/**
 * Single API namespace for the isud DB backend.
 * Components that need isud data should import isudAPI and call it directly
 * so they work independently on any page (no dependency on parent/page loading store).
 */
export const assetUnitsAPI = {
  list: (invId) => api.get(`/inventory/${invId}/asset-units`),
  add: (invId, data) => api.post(`/inventory/${invId}/asset-units`, data),
  update: (invId, uid, data) => api.put(`/inventory/${invId}/asset-units/${uid}`, data),
  remove: (invId, uid) => api.delete(`/inventory/${invId}/asset-units/${uid}`),
  availability: (invId, params) => api.get(`/inventory/${invId}/asset-units/availability`, { params }),
};

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
