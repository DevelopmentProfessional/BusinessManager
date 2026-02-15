import { create } from 'zustand';
import cacheService from './cacheService';

const useStore = create((set, get) => ({
  // Authentication state
  user: null,
  token: null,
  permissions: [],
  setUser: (user) => set({ user }),
  setToken: (token) => set({ token }),
  setPermissions: (permissions) => set({ permissions }),
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('permissions');
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    sessionStorage.removeItem('permissions');
    set({ user: null, token: null, permissions: [] });

    // Clear persistent data cache on logout
    cacheService.clearAll();

    // Clear in-flight API request dedup
    if (typeof window !== 'undefined' && window.clearApiCache) {
      window.clearApiCache();
    }
  },
  isAuthenticated: () => {
    const state = get();
    return !!(state.token || localStorage.getItem('token') || sessionStorage.getItem('token'));
  },
  hasPermission: (page, permission) => {
    const state = get();
    const user = state.user || JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user') || 'null');
    
    // Admin users have access to everything
    if (user && user.role === 'admin') {
      return true;
    }
    
    // Check user permissions first (from UserPermission table)
    const userPermissions = state.permissions.length > 0 ? state.permissions : 
      JSON.parse(localStorage.getItem('permissions') || sessionStorage.getItem('permissions') || '[]');
    
    if (userPermissions.includes(`${page}:${permission}`) || userPermissions.includes(`${page}:admin`)) {
      return true;
    }
    
    // No additional permission checks needed - all permissions are now handled via UserPermission table
    
    return false;
  },

  // Function to refresh user permissions from server
  refreshUserPermissions: async () => {
    try {
      const token = get().token || localStorage.getItem('token') || sessionStorage.getItem('token');
      if (!token) return;

      const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';
      const response = await fetch(`${API_BASE_URL}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const userData = await response.json();
        set({ user: userData });
        
        // Update localStorage/sessionStorage
        localStorage.setItem('user', JSON.stringify(userData));
        sessionStorage.setItem('user', JSON.stringify(userData));
      }
    } catch (error) {
      // Error handling - permissions refresh failed
    }
  },

  // Function to update user permissions in real-time
  updateUserPermissions: (userId, updatedUser) => {
    const state = get();
    
    // Update the user in the employees list (employees are now users)
    const updatedEmployees = state.employees.map(employee => 
      employee.id === userId ? { ...employee, ...updatedUser } : employee
    );
    set({ employees: updatedEmployees });
    
    // If the updated user is the current user, also update the current user's data
    const currentUser = state.user || JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user') || 'null');
    if (currentUser && currentUser.id === userId) {
      const updatedCurrentUser = { ...currentUser, ...updatedUser };
      set({ user: updatedCurrentUser });
      localStorage.setItem('user', JSON.stringify(updatedCurrentUser));
      sessionStorage.setItem('user', JSON.stringify(updatedCurrentUser));
      
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
      const updatedEmployees = state.employees.map(employee => 
        employee.id === userId ? { ...employee, [permissionField]: value } : employee
      );
      set({ employees: updatedEmployees });
      
      // If this is the current user, update their permissions as well
      const currentUser = state.user || JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user') || 'null');
      if (currentUser && currentUser.id === userId) {
        const updatedUser = { ...currentUser, [permissionField]: value };
        set({ user: updatedUser });
        localStorage.setItem('user', JSON.stringify(updatedUser));
        sessionStorage.setItem('user', JSON.stringify(updatedUser));
        
        // Dispatch a custom event to notify all components of permission changes
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('permissionsChanged', {
            detail: { userId, permissionField, value, updatedUser }
          }));
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
        [filterKey]: value
      }
    };
    
    set({ filters: updatedFilters });
    
    // Save to localStorage for persistence across sessions
    localStorage.setItem('userFilters', JSON.stringify(updatedFilters));
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
      localStorage.setItem('userFilters', JSON.stringify(updatedFilters));
    } else {
      // Clear all filters
      set({ filters: {} });
      localStorage.removeItem('userFilters');
    }
  },
  
  // Load filters from localStorage on app initialization
  loadPersistedFilters: () => {
    try {
      const savedFilters = localStorage.getItem('userFilters');
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
  setClients: (clients) => set({ clients }),
  addClient: (client) => set((state) => ({ clients: [...state.clients, client] })),
  updateClient: (id, updatedClient) => set((state) => ({
    clients: state.clients.map(client => 
      client.id === id ? { ...client, ...updatedClient } : client
    )
  })),
  removeClient: (id) => set((state) => ({
    clients: state.clients.filter(client => client.id !== id)
  })),

  // Services state
  services: [],
  setServices: (services) => set({ services }),
  addService: (service) => set((state) => ({ services: [...state.services, service] })),
  updateService: (id, updatedService) => set((state) => ({
    services: state.services.map(service => 
      service.id === id ? { ...service, ...updatedService } : service
    )
  })),
  removeService: (id) => set((state) => ({
    services: state.services.filter(service => service.id !== id)
  })),

  // Employees state (employees are now users)
  employees: [],
  setEmployees: (employees) => set({ employees }),
  addEmployee: (employee) => set((state) => ({ employees: [...state.employees, employee] })),
  updateEmployee: (id, updatedEmployee) => set((state) => ({
    employees: state.employees.map(employee => 
      employee.id === id ? { ...employee, ...updatedEmployee } : employee
    )
  })),
  removeEmployee: (id) => set((state) => ({
    employees: state.employees.filter(employee => employee.id !== id)
  })),

  // Schedule state
  appointments: [],
  setAppointments: (appointments) => set({ appointments }),
  addAppointment: (appointment) => set((state) => ({ appointments: [...state.appointments, appointment] })),
  updateAppointment: (id, updatedAppointment) => set((state) => ({
    appointments: state.appointments.map(appointment => 
      appointment.id === id ? { ...appointment, ...updatedAppointment } : appointment
    )
  })),

  // Inventory state
  inventory: [],
  setInventory: (inventory) => set({ inventory }),
  lowStockItems: [],
  setLowStockItems: (items) => set({ lowStockItems: items }),

  // Suppliers state
  suppliers: [],
  setSuppliers: (suppliers) => set({ suppliers }),
  addSupplier: (supplier) => set((state) => ({ suppliers: [...state.suppliers, supplier] })),
  updateSupplier: (id, updatedSupplier) => set((state) => ({
    suppliers: state.suppliers.map(supplier => 
      supplier.id === id ? { ...supplier, ...updatedSupplier } : supplier
    )
  })),
  removeSupplier: (id) => set((state) => ({
    suppliers: state.suppliers.filter(supplier => supplier.id !== id)
  })),

  // Documents state
  documents: [],
  setDocuments: (documents) => set({ documents }),
  addDocument: (document) => set((state) => ({ documents: [...state.documents, document] })),
  updateDocument: (id, updatedDocument) => set((state) => ({
    documents: state.documents.map(document => 
      document.id === id ? { ...document, ...updatedDocument } : document
    )
  })),
  removeDocument: (id) => set((state) => ({
    documents: state.documents.filter(document => document.id !== id)
  })),

  // Attendance state
  attendanceRecords: [],
  setAttendanceRecords: (records) => set({ attendanceRecords: records }),
  addAttendanceRecord: (record) => set((state) => ({ 
    attendanceRecords: [...state.attendanceRecords, record] 
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
  openAddClientModal: (callback = null) => set({ isAddClientModalOpen: true, addClientCallback: callback }),
  closeAddClientModal: () => set({ isAddClientModalOpen: false, addClientCallback: null }),
}));

export default useStore;
