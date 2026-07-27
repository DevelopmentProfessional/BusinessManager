import { create } from "zustand";
import cacheService from "./cacheService";
import { getApiBaseUrl } from "./api";
import { sortItemsAlphabetically } from "../utils/displaySort";

const API_BASE_URL = getApiBaseUrl();

const IMPLIED_PERMISSIONS = {
  read: ["read", "read_all", "view_all", "write", "write_self_only", "write_all", "delete", "admin"],
  read_all: ["read_all", "view_all", "write_all", "delete", "admin"],
  view_all: ["view_all", "write_all", "delete", "admin"],
  write: ["write", "write_self_only", "write_all", "delete", "admin"],
  write_self_only: ["write_self_only", "write_all", "delete", "admin"],
  write_all: ["write_all", "delete", "admin"],
  delete: ["delete", "admin"],
  admin: ["admin"],
};

const useStore = create((set, get) => ({
  // Network state
  isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
  setOnline: (value) => set({ isOnline: value }),

  // Authentication state
  user: null,
  token: null,
  permissions: [],
  authReady: false, // true once initializeUserData has run at least once
  setAuthReady: () => set({ authReady: true }),
  setUser: (user) => set({ user }),
  setToken: (token) => set({ token }),
  setPermissions: (permissions) => set({ permissions }),
  logout: () => {
    try {
      localStorage.removeItem("token");
    } catch {}
    try {
      localStorage.removeItem("user");
    } catch {}
    try {
      localStorage.removeItem("permissions");
    } catch {}
    try {
      sessionStorage.removeItem("token");
    } catch {}
    try {
      sessionStorage.removeItem("user");
    } catch {}
    try {
      sessionStorage.removeItem("permissions");
    } catch {}
    set({ user: null, token: null, permissions: [] });

    // Clear persistent data cache on logout
    cacheService.clearAll();

    // Clear in-flight API request dedup
    if (typeof window !== "undefined" && window.clearApiCache) {
      window.clearApiCache();
    }
  },
  isAuthenticated: () => {
    const state = get();
    if (state.token) return true;
    try {
      return !!(localStorage.getItem("token") || sessionStorage.getItem("token"));
    } catch {
      return false;
    }
  },
  hasPermission: (page, permission) => {
    const state = get();

    // Safe localStorage/sessionStorage reads — iOS Safari private mode throws SecurityError
    let storedUser = null;
    let storedPermissions = [];
    try {
      storedUser = JSON.parse(localStorage.getItem("user") || sessionStorage.getItem("user") || "null");
    } catch {}
    try {
      storedPermissions = JSON.parse(localStorage.getItem("permissions") || sessionStorage.getItem("permissions") || "[]");
    } catch {}

    const user = state.user || storedUser;

    // Admin users have access to everything
    if (user && String(user.role).toLowerCase() === "admin") {
      return true;
    }

    // Check user permissions (from UserPermission table)
    const userPermissions = state.permissions.length > 0 ? state.permissions : storedPermissions;

    const normalizedPage = String(page || "").toLowerCase();
    const normalizedPermission = String(permission || "").toLowerCase();
    const normalizedUserPermissions = userPermissions.map((entry) => String(entry).toLowerCase());
    const satisfies = IMPLIED_PERMISSIONS[normalizedPermission] ?? [normalizedPermission];

    if (satisfies.some((p) => normalizedUserPermissions.includes(`${normalizedPage}:${p}`))) {
      return true;
    }

    return false;
  },
  hasPageAccess: (page) => {
    const { hasPermission } = get();
    return hasPermission(page, "read") || hasPermission(page, "write") || hasPermission(page, "write_self_only") || hasPermission(page, "delete") || hasPermission(page, "admin") || hasPermission(page, "read_all") || hasPermission(page, "view_all") || hasPermission(page, "write_all");
  },

  // Fetch and update the current user's flat permission strings from the server
  refetchPermissions: async () => {
    try {
      let storageToken = null;
      try {
        storageToken = localStorage.getItem("token") || sessionStorage.getItem("token");
      } catch {}
      const token = get().token || storageToken;
      if (!token) return;
      const response = await fetch(`${API_BASE_URL}/auth/me/permissions`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data.permissions)) {
          set({ permissions: data.permissions });
          try {
            localStorage.setItem("permissions", JSON.stringify(data.permissions));
          } catch {}
          try {
            sessionStorage.setItem("permissions", JSON.stringify(data.permissions));
          } catch {}
        }
      }
    } catch {
      // Silently fail — stale permissions are better than a broken UI
    }
  },

  // Function to refresh user permissions from server
  refreshUserPermissions: async () => {
    try {
      const token = get().token || localStorage.getItem("token") || sessionStorage.getItem("token");
      if (!token) return;

      const response = await fetch(`${API_BASE_URL}/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        const userData = await response.json();
        set({ user: userData });

        // Update localStorage/sessionStorage
        localStorage.setItem("user", JSON.stringify(userData));
        sessionStorage.setItem("user", JSON.stringify(userData));
      }
    } catch (error) {
      // Error handling - permissions refresh failed
    }
  },

  // Function to update user permissions in real-time
  updateUserPermissions: (userId, updatedUser) => {
    const state = get();

    // Update the user in the employees list (employees are now users)
    const updatedEmployees = sortItemsAlphabetically(
      state.employees.map((employee) => (employee.id === userId ? { ...employee, ...updatedUser } : employee)),
      ["first_name", "last_name", "username", "email"]
    );
    set({ employees: updatedEmployees });

    // If the updated user is the current user, also update the current user's data
    const currentUser = state.user || JSON.parse(localStorage.getItem("user") || sessionStorage.getItem("user") || "null");
    if (currentUser && currentUser.id === userId) {
      const updatedCurrentUser = { ...currentUser, ...updatedUser };
      set({ user: updatedCurrentUser });
      localStorage.setItem("user", JSON.stringify(updatedCurrentUser));
      sessionStorage.setItem("user", JSON.stringify(updatedCurrentUser));

      // Trigger a permission refresh to ensure all components are updated
      setTimeout(() => {
        get().refreshUserPermissions();
      }, 100);
    }
  },

  // Backward compatibility alias
  updateEmployeePermissions: (userId, updatedUser) => get().updateUserPermissions(userId, updatedUser),

  // Function to handle permission changes for any user
  handlePermissionChange: async (userId, permissionField, value) => {
    const state = get();

    try {
      // Update the user in the store immediately for responsive UI
      const updatedEmployees = sortItemsAlphabetically(
        state.employees.map((employee) => (employee.id === userId ? { ...employee, [permissionField]: value } : employee)),
        ["first_name", "last_name", "username", "email"]
      );
      set({ employees: updatedEmployees });

      // If this is the current user, update their permissions as well
      const currentUser = state.user || JSON.parse(localStorage.getItem("user") || sessionStorage.getItem("user") || "null");
      if (currentUser && currentUser.id === userId) {
        const updatedUser = { ...currentUser, [permissionField]: value };
        set({ user: updatedUser });
        localStorage.setItem("user", JSON.stringify(updatedUser));
        sessionStorage.setItem("user", JSON.stringify(updatedUser));

        // Dispatch a custom event to notify all components of permission changes
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("permissionsChanged", {
              detail: { userId, permissionField, value, updatedUser },
            })
          );
        }
      }

      return true;
    } catch (error) {
      // Error handling - permission update failed
      return false;
    }
  },

  // Persistent filter state management
  filters: {},
  setFilter: (page, filterKey, value) => {
    const state = get();
    const currentFilters = state.filters[page] || {};
    const updatedFilters = {
      ...state.filters,
      [page]: {
        ...currentFilters,
        [filterKey]: value,
      },
    };

    set({ filters: updatedFilters });

    // Save to localStorage for persistence across sessions
    localStorage.setItem("userFilters", JSON.stringify(updatedFilters));
  },

  getFilter: (page, filterKey, defaultValue = null) => {
    const state = get();
    return state.filters[page]?.[filterKey] ?? defaultValue;
  },

  clearFilters: (page = null) => {
    const state = get();
    if (page) {
      // Clear filters for specific page
      const updatedFilters = { ...state.filters };
      delete updatedFilters[page];
      set({ filters: updatedFilters });
      localStorage.setItem("userFilters", JSON.stringify(updatedFilters));
    } else {
      // Clear all filters
      set({ filters: {} });
      localStorage.removeItem("userFilters");
    }
  },

  // Load filters from localStorage on app initialization
  loadPersistedFilters: () => {
    try {
      const savedFilters = localStorage.getItem("userFilters");
      if (savedFilters) {
        const filters = JSON.parse(savedFilters);
        set({ filters });
      }
    } catch (error) {
      // Error handling - failed to load persisted filters
    }
  },

  // Clients state
  clients: [],
  setClients: (clients) => set({ clients: sortItemsAlphabetically(clients, ["name", "email"]) }),
  addClient: (client) => set((state) => ({ clients: sortItemsAlphabetically([...state.clients, client], ["name", "email"]) })),
  updateClient: (id, updatedClient) =>
    set((state) => ({
      clients: sortItemsAlphabetically(
        state.clients.map((client) => (client.id === id ? { ...client, ...updatedClient } : client)),
        ["name", "email"]
      ),
    })),
  removeClient: (id) =>
    set((state) => ({
      clients: state.clients.filter((client) => client.id !== id),
    })),

  // Services state
  services: [],
  setServices: (services) => set({ services: sortItemsAlphabetically(services, ["name", "category"]) }),
  addService: (service) => set((state) => ({ services: sortItemsAlphabetically([...state.services, service], ["name", "category"]) })),
  updateService: (id, updatedService) =>
    set((state) => ({
      services: sortItemsAlphabetically(
        state.services.map((service) => (service.id === id ? { ...service, ...updatedService } : service)),
        ["name", "category"]
      ),
    })),
  removeService: (id) =>
    set((state) => ({
      services: state.services.filter((service) => service.id !== id),
    })),

  // Employees state (employees are now users)
  employees: [],
  setEmployees: (employees) => set({ employees: sortItemsAlphabetically(employees, ["first_name", "last_name", "username", "email"]) }),
  addEmployee: (employee) => set((state) => ({ employees: sortItemsAlphabetically([...state.employees, employee], ["first_name", "last_name", "username", "email"]) })),
  updateEmployee: (id, updatedEmployee) =>
    set((state) => ({
      employees: sortItemsAlphabetically(
        state.employees.map((employee) => (employee.id === id ? { ...employee, ...updatedEmployee } : employee)),
        ["first_name", "last_name", "username", "email"]
      ),
    })),
  removeEmployee: (id) =>
    set((state) => ({
      employees: state.employees.filter((employee) => employee.id !== id),
    })),

  // Schedule state
  appointments: [],
  setAppointments: (appointments) => set({ appointments }),
  addAppointment: (appointment) => set((state) => ({ appointments: [...state.appointments, appointment] })),
  updateAppointment: (id, updatedAppointment) =>
    set((state) => ({
      appointments: state.appointments.map((appointment) => (appointment.id === id ? { ...appointment, ...updatedAppointment } : appointment)),
    })),

  // Inventory state
  inventory: [],
  setInventory: (inventory) => set({ inventory: sortItemsAlphabetically(inventory, ["name", "sku", "type"]) }),
  lowStockItems: [],
  setLowStockItems: (items) => set({ lowStockItems: items }),

  // Suppliers state
  suppliers: [],
  setSuppliers: (suppliers) => set({ suppliers: sortItemsAlphabetically(suppliers, ["name", "email"]) }),
  addSupplier: (supplier) => set((state) => ({ suppliers: sortItemsAlphabetically([...state.suppliers, supplier], ["name", "email"]) })),
  updateSupplier: (id, updatedSupplier) =>
    set((state) => ({
      suppliers: sortItemsAlphabetically(
        state.suppliers.map((supplier) => (supplier.id === id ? { ...supplier, ...updatedSupplier } : supplier)),
        ["name", "email"]
      ),
    })),
  removeSupplier: (id) =>
    set((state) => ({
      suppliers: state.suppliers.filter((supplier) => supplier.id !== id),
    })),

  // Documents state
  documents: [],
  setDocuments: (documents) => set({ documents: sortItemsAlphabetically(documents, ["original_filename", "filename", "description"]) }),
  addDocument: (document) => set((state) => ({ documents: sortItemsAlphabetically([...state.documents, document], ["original_filename", "filename", "description"]) })),
  updateDocument: (id, updatedDocument) =>
    set((state) => ({
      documents: sortItemsAlphabetically(
        state.documents.map((document) => (document.id === id ? { ...document, ...updatedDocument } : document)),
        ["original_filename", "filename", "description"]
      ),
    })),
  removeDocument: (id) =>
    set((state) => ({
      documents: state.documents.filter((document) => document.id !== id),
    })),

  // Attendance state
  attendanceRecords: [],
  setAttendanceRecords: (records) => set({ attendanceRecords: records }),
  addAttendanceRecord: (record) =>
    set((state) => ({
      attendanceRecords: [...state.attendanceRecords, record],
    })),

  // UI state
  loading: false,
  setLoading: (loading) => set({ loading }),
  error: null,
  setError: (error) => set({ error }),
  clearError: () => set({ error: null }),

  // Modal state
  isModalOpen: false,
  modalContent: null,
  openModal: (content) => set({ isModalOpen: true, modalContent: content }),
  closeModal: () => set({ isModalOpen: false, modalContent: null }),

  // Global Add Client Modal state (can be opened from anywhere in the app)
  isAddClientModalOpen: false,
  addClientCallback: null,
  addClientPrefill: null,
  openAddClientModal: (callbackOrOptions = null, prefill = null) => {
    let callback = null;
    let resolvedPrefill = null;

    if (typeof callbackOrOptions === "function") {
      callback = callbackOrOptions;
      resolvedPrefill = prefill ?? null;
    } else if (callbackOrOptions && typeof callbackOrOptions === "object") {
      callback = callbackOrOptions.onCreated || callbackOrOptions.callback || null;
      resolvedPrefill = callbackOrOptions.prefill ?? null;
    }

    set({
      isAddClientModalOpen: true,
      addClientCallback: callback,
      addClientPrefill: resolvedPrefill,
    });
  },
  closeAddClientModal: () => set({ isAddClientModalOpen: false, addClientCallback: null, addClientPrefill: null }),

  // Global Add Service Modal state (can be opened from anywhere in the app)
  isAddServiceModalOpen: false,
  addServiceCallback: null,
  addServicePrefill: null,
  openAddServiceModal: (callbackOrOptions = null, prefill = null) => {
    let callback = null;
    let resolvedPrefill = null;

    if (typeof callbackOrOptions === "function") {
      callback = callbackOrOptions;
      resolvedPrefill = prefill ?? null;
    } else if (callbackOrOptions && typeof callbackOrOptions === "object") {
      callback = callbackOrOptions.onCreated || callbackOrOptions.callback || null;
      resolvedPrefill = callbackOrOptions.prefill ?? null;
    }

    set({
      isAddServiceModalOpen: true,
      addServiceCallback: callback,
      addServicePrefill: resolvedPrefill,
    });
  },
  closeAddServiceModal: () => set({ isAddServiceModalOpen: false, addServiceCallback: null, addServicePrefill: null }),

  // Global Add Inventory Modal state (used for quick-create flows like production items)
  isAddInventoryModalOpen: false,
  addInventoryCallback: null,
  addInventoryPrefill: null,
  openAddInventoryModal: (callbackOrOptions = null, prefill = null) => {
    let callback = null;
    let resolvedPrefill = null;

    if (typeof callbackOrOptions === "function") {
      callback = callbackOrOptions;
      resolvedPrefill = prefill ?? null;
    } else if (callbackOrOptions && typeof callbackOrOptions === "object") {
      callback = callbackOrOptions.onCreated || callbackOrOptions.callback || null;
      resolvedPrefill = callbackOrOptions.prefill ?? null;
    }

    set({
      isAddInventoryModalOpen: true,
      addInventoryCallback: callback,
      addInventoryPrefill: resolvedPrefill,
    });
  },
  closeAddInventoryModal: () => set({ isAddInventoryModalOpen: false, addInventoryCallback: null, addInventoryPrefill: null }),
}));

export default useStore;
