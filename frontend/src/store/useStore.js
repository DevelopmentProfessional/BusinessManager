import { create } from 'zustand';

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
    
    // Clear API cache on logout
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
    
    // If no user permissions found, check employee permissions (from employee table)
    // Convert employee permission fields to the expected format
    const employeePermissionField = `${page}_${permission}`;
    const employeeAdminField = `${page}_admin`;
    
    // Check if the user has admin access for this page (admin permission grants all access)
    if (user && user[employeeAdminField] === true) {
      return true;
    }
    
    // Check if the user has the specific permission
    if (user && user[employeePermissionField] === true) {
      return true;
    }
    
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
      console.error('Failed to refresh user permissions:', error);
    }
  },

  // Function to update employee permissions in real-time
  updateEmployeePermissions: (employeeId, updatedEmployee) => {
    const state = get();
    
    // Update the employee in the employees list
    const updatedEmployees = state.employees.map(employee => 
      employee.id === employeeId ? { ...employee, ...updatedEmployee } : employee
    );
    set({ employees: updatedEmployees });
    
    // If the updated employee is the current user, also update the current user's permissions
    const currentUser = state.user || JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user') || 'null');
    if (currentUser && currentUser.employee && currentUser.employee.id === employeeId) {
      const updatedUser = { ...currentUser, ...updatedEmployee };
      set({ user: updatedUser });
      localStorage.setItem('user', JSON.stringify(updatedUser));
      sessionStorage.setItem('user', JSON.stringify(updatedUser));
      
      // Trigger a permission refresh to ensure all components are updated
      setTimeout(() => {
        get().refreshUserPermissions();
      }, 100);
    }
  },

  // Function to handle permission changes for any employee
  handlePermissionChange: async (employeeId, permissionField, value) => {
    const state = get();
    
    try {
      // Update the employee in the store immediately for responsive UI
      const updatedEmployees = state.employees.map(employee => 
        employee.id === employeeId ? { ...employee, [permissionField]: value } : employee
      );
      set({ employees: updatedEmployees });
      
      // If this is the current user, update their permissions as well
      const currentUser = state.user || JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user') || 'null');
      if (currentUser && currentUser.employee && currentUser.employee.id === employeeId) {
        const updatedUser = { ...currentUser, [permissionField]: value };
        set({ user: updatedUser });
        localStorage.setItem('user', JSON.stringify(updatedUser));
        sessionStorage.setItem('user', JSON.stringify(updatedUser));
        
        // Dispatch a custom event to notify all components of permission changes
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('permissionsChanged', {
            detail: { employeeId, permissionField, value, updatedUser }
          }));
        }
      }
      
      return true;
    } catch (error) {
      console.error('Error updating permission:', error);
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
      console.error('Error loading persisted filters:', error);
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

  // Items state
  items: [],
  setItems: (items) => set({ items }),
  addItem: (item) => set((state) => ({ items: [...state.items, item] })),
  removeItem: (id) => set((state) => ({
    items: state.items.filter(item => item.id !== id)
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

  // Employees state
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
}));

export default useStore;
