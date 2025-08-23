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
  },
  isAuthenticated: () => {
    const state = get();
    return !!(state.token || localStorage.getItem('token') || sessionStorage.getItem('token'));
  },
  hasPermission: (page, permission) => {
    const state = get();
    const userPermissions = state.permissions.length > 0 ? state.permissions : 
      JSON.parse(localStorage.getItem('permissions') || sessionStorage.getItem('permissions') || '[]');
    return userPermissions.includes(`${page}:${permission}`) || userPermissions.includes(`${page}:admin`);
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
