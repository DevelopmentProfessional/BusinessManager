import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { PlusIcon, PencilIcon, TrashIcon, ArrowUpTrayIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import useStore from '../services/useStore';
import { clientsAPI } from '../services/api';
import Modal from './components/Modal';
import ClientForm from './components/ClientForm';
import MobileTable from './components/MobileTable';
import MobileAddButton from './components/MobileAddButton';
import PermissionGate from './components/PermissionGate';
import IconButton from './components/IconButton';
import ActionFooter from './components/ActionFooter';
import { useLocation, useNavigate } from 'react-router-dom';

export default function Clients() {
  const { 
    clients, setClients, addClient, updateClient, removeClient,
    loading, setLoading, error, setError, clearError,
    isModalOpen, modalContent, openModal, closeModal, hasPermission,
    setFilter, getFilter
  } = useStore();

  // Use the permission refresh hook

  // Check permissions at page level
  if (!hasPermission('clients', 'read') && 
      !hasPermission('clients', 'write') && 
      !hasPermission('clients', 'delete') && 
      !hasPermission('clients', 'admin')) {
    return <Navigate to="/profile" replace />;
  }

  const [editingClient, setEditingClient] = useState(null);
  const [selectedClient, setSelectedClient] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [searchTerm, setSearchTerm] = useState(() => getFilter('clients', 'searchTerm', ''));
  const [isImporting, setIsImporting] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    loadClients();
  }, []);

  // Auto-open create modal when navigated with ?new=1 and then clean the URL
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('new') === '1') {
      setEditingClient(null);
      openModal('client-form');
      params.delete('new');
      navigate({ pathname: location.pathname, search: params.toString() ? `?${params.toString()}` : '' }, { replace: true });
    }
  }, [location.search]);

  const loadClients = async () => {
    setLoading(true);
    try {
      const response = await clientsAPI.getAll();
      // Handle both direct data and response.data formats
      const clientsData = response?.data ?? response;
      if (Array.isArray(clientsData)) {
        setClients(clientsData);
        clearError();
      } else {
        console.error('Invalid clients data format:', clientsData);
        setError('Invalid data format received from server');
        setClients([]);
      }
    } catch (err) {
      setError('Failed to load clients');
      console.error('Error loading clients:', err);
      setClients([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateClient = () => {
    if (!hasPermission('clients', 'write')) {
      setError('You do not have permission to create clients');
      return;
    }
    setEditingClient(null);
    openModal('client-form');
  };

  const handleEditClient = (client) => {
    if (!hasPermission('clients', 'write')) {
      setError('You do not have permission to edit clients');
      return;
    }
    setEditingClient(client);
    openModal('client-form');
  };

  const handleDeleteClient = async (clientId) => {
    if (!hasPermission('clients', 'delete')) {
      setError('You do not have permission to delete clients');
      return;
    }
    
    if (!window.confirm('Are you sure you want to delete this client?')) return;

    await clientsAPI.delete(clientId);
    removeClient(clientId);
  };

  const handleImportCSV = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setIsImporting(true);
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await clientsAPI.uploadCSV(formData);
    if (response?.data) {
      loadClients();
    }
    
    setIsImporting(false);
    event.target.value = '';
  };

  const handleSubmitClient = async (clientData) => {
    try {
      if (editingClient) {
        const response = await clientsAPI.update(editingClient.id, clientData);
        updateClient(editingClient.id, response.data);
      } else {
        const response = await clientsAPI.create(clientData);
        addClient(response.data);
      }
      closeModal();
      clearError();
    } catch (err) {
      setError('Failed to save client');
      console.error(err);
    }
  };

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    setFilter('clients', 'searchTerm', value);
  };

  const handleRefresh = () => {
    loadClients();
  };

  // Filter clients based on search term
  const filteredClients = clients.filter(client =>
    client.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.phone?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.address?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  // Table columns configuration
  const columns = [
    { key: 'name', title: 'Name' },
    { key: 'email', title: 'Email', render: (value) => value || '-' },
    { key: 'phone', title: 'Phone', render: (value) => value || '-' },
    { key: 'address', title: 'Address', render: (value) => value || '-' },
  ];

  // Transaction columns for history panel
  const transactionColumns = [
    { key: 'date', title: 'Date', render: (value) => new Date(value).toLocaleDateString() },
    { key: 'description', title: 'Description' },
    { key: 'amount', title: 'Amount', render: (value) => `$${value}` },
    { key: 'status', title: 'Status' },
  ];

  const handleClientSelect = (client) => {
    if (selectedClient?.id === client.id) {
      setSelectedClient(null);
    } else {
      setSelectedClient(client);
      // Mock transaction data - replace with actual API call
      setTransactions([
        { id: 1, date: '2024-01-15', description: 'Service Payment', amount: 150, status: 'Completed' },
        { id: 2, date: '2024-01-10', description: 'Item Purchase', amount: 75, status: 'Pending' },
        { id: 3, date: '2024-01-05', description: 'Consultation Fee', amount: 100, status: 'Completed' },
      ]);
    }
  };

  return (
    <div className="h-full flex flex-col min-h-0 overflow-hidden">
      {/* Header - does not scroll */}
      <div className="flex-shrink-0 mb-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Clients</h1>
        
        {/* Search */}
        <div className="mt-4">
          <input
            type="text"
            placeholder="Search clients by name, email, phone, or address..."
            value={searchTerm}
            onChange={handleSearchChange}
            className="form-control"
          />
        </div>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Client List - fills remaining space, list scrolls inside */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Client List Area - scrollable container */}
        <div className={`flex-1 min-h-0 flex flex-col transition-all duration-300 ${selectedClient ? 'flex-shrink-0' : ''}`}>
          <div className="flex-1 min-h-0 overflow-y-auto bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            {filteredClients.length > 0 ? (
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredClients.map((client) => (
                  <div 
                    key={client.id}
                    onClick={() => handleClientSelect(client)}
                    className={`p-4 cursor-pointer transition-colors ${
                      selectedClient?.id === client.id 
                        ? 'bg-blue-50 border-l-4 border-l-blue-500' 
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 dark:text-gray-100 truncate">
                          {client.name}
                        </h3>
                        <p className="text-sm text-gray-500 truncate">
                          {client.email || client.phone || 'No contact info'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <PermissionGate page="clients" permission="delete">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteClient(client.id);
                            }}
                            title="Delete"
                            aria-label="Delete"
                            className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </PermissionGate>
                        <PermissionGate page="clients" permission="write">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditClient(client);
                            }}
                            title="Edit"
                            aria-label="Edit"
                            className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                          >
                            <PencilIcon className="h-4 w-4" />
                          </button>
                        </PermissionGate>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center h-32">
                <p className="text-gray-500">
                  {searchTerm ? `No clients found matching "${searchTerm}"` : 'No clients found'}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Transaction History Panel */}
        {selectedClient && (
          <div className="mt-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            {/* Selected Client Header */}
            <div className="p-4 border-b border-gray-200 bg-blue-50">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                {selectedClient.name}
              </h3>
              <p className="text-sm text-gray-600">Transaction History</p>
            </div>
            
            {/* Transaction Table */}
            <div className="max-h-64 overflow-y-auto">
              <MobileTable
                data={transactions}
                columns={transactionColumns}
                onEdit={(transaction) => console.log('Edit transaction:', transaction)}
                onDelete={(transaction) => console.log('Delete transaction:', transaction)}
                loading={false}
              />
            </div>
          </div>
        )}
      </div>

      {/* Page footer: icon-only actions with tooltips - does not scroll */}
      <ActionFooter className="flex-shrink-0 mt-auto border-0 pt-2">
        <PermissionGate page="clients" permission="write">
          <IconButton icon={ArrowPathIcon} label="Refresh" onClick={handleRefresh} variant="secondary" />
          <label className="cursor-pointer" title={isImporting ? 'Importing...' : 'Import CSV'} aria-label={isImporting ? 'Importing...' : 'Import CSV'}>
            <span className="inline-flex items-center justify-center rounded-lg p-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50">
              <ArrowUpTrayIcon className="h-5 w-5" />
            </span>
            <input type="file" accept=".csv" onChange={handleImportCSV} className="hidden" disabled={isImporting} />
          </label>
          <IconButton icon={PlusIcon} label="Add Client" onClick={handleCreateClient} variant="primary" />
        </PermissionGate>
      </ActionFooter>

      {/* Mobile Add Button - icon only with tooltip */}
      <PermissionGate page="clients" permission="write">
        <MobileAddButton onClick={handleCreateClient} label="Add Client" />
      </PermissionGate>

      {/* Modal for Client Form */}
      <Modal isOpen={isModalOpen && modalContent === 'client-form'} onClose={closeModal}>
        {isModalOpen && modalContent === 'client-form' && (
          <ClientForm
            client={editingClient}
            onSubmit={handleSubmitClient}
            onCancel={closeModal}
            error={error}
          />
        )}
      </Modal>
    </div>
  );
}
