import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { PlusIcon, PencilIcon, TrashIcon, ArrowUpTrayIcon, ShoppingCartIcon, XMarkIcon, UserIcon, CreditCardIcon, BanknotesIcon } from '@heroicons/react/24/outline';
import useStore from '../services/useStore';
import { servicesAPI, clientsAPI } from '../services/api';
import Modal from './components/Modal';
import ServiceForm from './components/ServiceForm';
import MobileTable from './components/MobileTable';
import MobileAddButton from './components/MobileAddButton';
import PermissionGate from './components/PermissionGate';
import { useLocation, useNavigate } from 'react-router-dom';

export default function Services() {
  const { 
    services, setServices, addService, updateService, removeService,
    loading, setLoading, error, setError, clearError,
    isModalOpen, modalContent, openModal, closeModal, hasPermission
  } = useStore();

  // Use the permission refresh hook

  // Check permissions at page level
  if (!hasPermission('services', 'read') && 
      !hasPermission('services', 'write') && 
      !hasPermission('services', 'delete') && 
      !hasPermission('services', 'admin')) {
    return <Navigate to="/profile" replace />;
  }

  const [editingService, setEditingService] = useState(null);
  const [isImporting, setIsImporting] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  
  // POS State
  const [activeTab, setActiveTab] = useState('services'); // 'services' or 'pos'
  const [cart, setCart] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [clients, setClientsLocal] = useState([]);
  const [clientSearch, setClientSearch] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [showCheckout, setShowCheckout] = useState(false);

  useEffect(() => {
    loadServices();
    loadClients();
  }, []);

  const loadClients = async () => {
    try {
      const response = await clientsAPI.getAll();
      const data = response?.data ?? response;
      if (Array.isArray(data)) setClientsLocal(data);
    } catch (err) {
      console.error('Failed to load clients for POS:', err);
    }
  };

  // POS Functions
  const addToCart = (service) => {
    const existing = cart.find(item => item.id === service.id);
    if (existing) {
      setCart(cart.map(item => 
        item.id === service.id ? { ...item, quantity: item.quantity + 1 } : item
      ));
    } else {
      setCart([...cart, { ...service, quantity: 1 }]);
    }
  };

  const removeFromCart = (serviceId) => {
    setCart(cart.filter(item => item.id !== serviceId));
  };

  const updateCartQuantity = (serviceId, quantity) => {
    if (quantity <= 0) {
      removeFromCart(serviceId);
    } else {
      setCart(cart.map(item => 
        item.id === serviceId ? { ...item, quantity } : item
      ));
    }
  };

  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const handleCheckout = () => {
    if (cart.length === 0) {
      setError('Cart is empty');
      return;
    }
    setShowCheckout(true);
  };

  const processPayment = () => {
    // In a real app, this would create a transaction record
    alert(`Payment of $${cartTotal.toFixed(2)} processed via ${paymentMethod}${selectedClient ? ` for ${selectedClient.name}` : ''}!`);
    setCart([]);
    setSelectedClient(null);
    setShowCheckout(false);
    clearError();
  };

  const filteredClients = clients.filter(c => 
    c.name?.toLowerCase().includes(clientSearch.toLowerCase()) ||
    c.email?.toLowerCase().includes(clientSearch.toLowerCase())
  );

  // Auto-open create modal when navigated with ?new=1 and then clean the URL
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('new') === '1') {
      setEditingService(null);
      openModal('service-form');
      params.delete('new');
      navigate({ pathname: location.pathname, search: params.toString() ? `?${params.toString()}` : '' }, { replace: true });
    }
  }, [location.search]);

  const loadServices = async () => {
    setLoading(true);
    try {
      const response = await servicesAPI.getAll();
      // Handle both direct data and response.data formats
      const servicesData = response?.data ?? response;
      if (Array.isArray(servicesData)) {
        setServices(servicesData);
        clearError();
      } else {
        console.error('Invalid services data format:', servicesData);
        setError('Invalid data format received from server');
        setServices([]);
      }
    } catch (err) {
      setError('Failed to load services');
      console.error('Error loading services:', err);
      setServices([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateService = () => {
    if (!hasPermission('services', 'write')) {
      setError('You do not have permission to create services');
      return;
    }
    setEditingService(null);
    openModal('service-form');
  };

  const handleEditService = (service) => {
    if (!hasPermission('services', 'write')) {
      setError('You do not have permission to edit services');
      return;
    }
    setEditingService(service);
    openModal('service-form');
  };

  const handleDeleteService = async (serviceId) => {
    if (!hasPermission('services', 'delete')) {
      setError('You do not have permission to delete services');
      return;
    }
    
    if (!window.confirm('Are you sure you want to delete this service?')) return;

    await servicesAPI.delete(serviceId);
    removeService(serviceId);
  };

  const handleImportCSV = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setIsImporting(true);
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await servicesAPI.uploadCSV(formData);
    if (response?.data) {
      loadServices();
    }
    
    setIsImporting(false);
    event.target.value = '';
  };

  const handleSubmitService = async (serviceData) => {
    try {
      if (editingService) {
        const response = await servicesAPI.update(editingService.id, serviceData);
        updateService(editingService.id, response.data);
      } else {
        const response = await servicesAPI.create(serviceData);
        addService(response.data);
      }
      closeModal();
      clearError();
    } catch (err) {
      setError('Failed to save service');
      console.error(err);
    }
  };

  const handleRefresh = () => {
    loadServices();
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">Services</h1>
          {/* Tab Switcher */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setActiveTab('services')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'services' ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Services
            </button>
            <button
              onClick={() => setActiveTab('pos')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
                activeTab === 'pos' ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <ShoppingCartIcon className="h-4 w-4" />
              Point of Sale
              {cartItemCount > 0 && (
                <span className="bg-primary-600 text-white text-xs rounded-full px-2 py-0.5">{cartItemCount}</span>
              )}
            </button>
          </div>
        </div>
        
        {/* Search and Add Button Row */}
        <div className="mt-4">
          <div className="input-group">
            <input
              type="text"
              placeholder="Search services by name or category..."
              className="form-control"
            />
            <PermissionGate page="services" permission="write">
              <div className="input-group-append d-flex">
                <button
                  type="button"
                  onClick={handleRefresh}
                  className="btn btn-outline-secondary"
                >
                  <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Refresh
                </button>
                <label className="btn btn-outline-primary cursor-pointer">
                  <ArrowUpTrayIcon className="h-4 w-4 mr-1" />
                  {isImporting ? 'Importing...' : 'Import CSV'}
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleImportCSV}
                    className="hidden"
                    disabled={isImporting}
                  />
                </label>
              </div>
            </PermissionGate>
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* POS View */}
      {activeTab === 'pos' && (
        <div className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Services Grid */}
            <div className="lg:col-span-2">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Select Services</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {services.map(service => (
                  <button
                    key={service.id}
                    onClick={() => addToCart(service)}
                    className="p-4 bg-white border border-gray-200 rounded-lg hover:border-primary-500 hover:shadow-md transition-all text-left"
                  >
                    <div className="font-medium text-gray-900">{service.name}</div>
                    <div className="text-primary-600 font-bold">${service.price?.toFixed(2)}</div>
                    <div className="text-xs text-gray-500">{service.duration_minutes} min</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Cart */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
                <ShoppingCartIcon className="h-5 w-5" />
                Cart ({cartItemCount})
              </h3>

              {cart.length === 0 ? (
                <p className="text-gray-500 text-center py-8">Cart is empty</p>
              ) : (
                <>
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {cart.map(item => (
                      <div key={item.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <div className="flex-1">
                          <div className="font-medium text-sm">{item.name}</div>
                          <div className="text-xs text-gray-500">${item.price?.toFixed(2)} each</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => updateCartQuantity(item.id, item.quantity - 1)} className="w-6 h-6 bg-gray-200 rounded text-sm">-</button>
                          <span className="w-6 text-center text-sm">{item.quantity}</span>
                          <button onClick={() => updateCartQuantity(item.id, item.quantity + 1)} className="w-6 h-6 bg-gray-200 rounded text-sm">+</button>
                          <button onClick={() => removeFromCart(item.id)} className="text-red-500 ml-2"><XMarkIcon className="h-4 w-4" /></button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="border-t mt-4 pt-4">
                    <div className="flex justify-between text-lg font-bold">
                      <span>Total:</span>
                      <span>${cartTotal.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Client Selection */}
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <UserIcon className="h-4 w-4 inline mr-1" />
                      Client (optional)
                    </label>
                    {selectedClient ? (
                      <div className="flex items-center justify-between p-2 bg-primary-50 rounded">
                        <span className="text-sm">{selectedClient.name}</span>
                        <button onClick={() => setSelectedClient(null)} className="text-gray-500"><XMarkIcon className="h-4 w-4" /></button>
                      </div>
                    ) : (
                      <div>
                        <input
                          type="text"
                          placeholder="Search clients..."
                          value={clientSearch}
                          onChange={(e) => setClientSearch(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                        />
                        {clientSearch && (
                          <div className="mt-1 max-h-32 overflow-y-auto border rounded bg-white">
                            {filteredClients.slice(0, 5).map(c => (
                              <button
                                key={c.id}
                                onClick={() => { setSelectedClient(c); setClientSearch(''); }}
                                className="w-full text-left px-3 py-2 hover:bg-gray-100 text-sm"
                              >
                                {c.name}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Payment Method */}
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method</label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setPaymentMethod('cash')}
                        className={`flex-1 py-2 px-3 rounded border text-sm flex items-center justify-center gap-1 ${paymentMethod === 'cash' ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-300'}`}
                      >
                        <BanknotesIcon className="h-4 w-4" /> Cash
                      </button>
                      <button
                        onClick={() => setPaymentMethod('card')}
                        className={`flex-1 py-2 px-3 rounded border text-sm flex items-center justify-center gap-1 ${paymentMethod === 'card' ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-300'}`}
                      >
                        <CreditCardIcon className="h-4 w-4" /> Card
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={processPayment}
                    className="w-full mt-4 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700"
                  >
                    Complete Payment - ${cartTotal.toFixed(2)}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Services Tab Content */}
      {activeTab === 'services' && (
        <>
      {/* Mobile view */}
      <div className="mt-6 md:hidden">
        <MobileTable
          data={services}
          columns={[
            { key: 'name', title: 'Name' },
            { key: 'price', title: 'Price', render: (v) => `$${v.toFixed(2)}` },
            { key: 'duration_minutes', title: 'Duration', render: (v) => `${v} min` },
          ]}
          onEdit={(item) => handleEditService(item)}
          onDelete={(item) => handleDeleteService(item.id)}
          editPermission={{ page: 'services', permission: 'write' }}
          deletePermission={{ page: 'services', permission: 'delete' }}
          emptyMessage="No services found"
        />
        <PermissionGate page="services" permission="write">
          <MobileAddButton onClick={handleCreateService} label="Add" />
        </PermissionGate>
      </div>

      {/* Desktop table */}
      <div className="mt-8 flow-root hidden md:block">
        <div className="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
          <div className="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
            <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
              <table className="min-w-full divide-y divide-gray-300">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Price
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Duration
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Description
                    </th>
                    <th className="relative px-6 py-3">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {services.map((service) => (
                    <tr key={service.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {service.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        ${service.price.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {service.duration_minutes} min
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {service.description || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-4">
                        <PermissionGate page="services" permission="delete">
                          <button
                            onClick={() => handleDeleteService(service.id)}
                            className="text-red-600 hover:text-red-900"
                            title="Delete"
                          >
                            <TrashIcon className="h-5 w-5" />
                          </button>
                        </PermissionGate>
                        <PermissionGate page="services" permission="write">
                          <button
                            onClick={() => handleEditService(service)}
                            className="text-indigo-600 hover:text-indigo-900"
                            title="Edit"
                          >
                            <PencilIcon className="h-5 w-5" />
                          </button>
                        </PermissionGate>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {services.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-gray-500">No services found. Add your first service to get started.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
        </>
      )}

      {/* Modal for Service Form */}
      <Modal isOpen={isModalOpen && modalContent === 'service-form'} onClose={closeModal}>
        {isModalOpen && modalContent === 'service-form' && (
          <ServiceForm
            service={editingService}
            onSubmit={handleSubmitService}
            onCancel={closeModal}
          />
        )}
      </Modal>
    </div>
  );
}
