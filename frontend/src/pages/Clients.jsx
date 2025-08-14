import React, { useEffect, useState } from 'react';
import { PlusIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline';
import useStore from '../store/useStore';
import { clientsAPI } from '../services/api';
import Modal from '../components/Modal';
import ClientForm from '../components/ClientForm';
import MobileTable from '../components/MobileTable';
import MobileAddButton from '../components/MobileAddButton';

export default function Clients() {
  const { 
    clients, setClients, addClient, updateClient, removeClient,
    loading, setLoading, error, setError, clearError,
    isModalOpen, openModal, closeModal
  } = useStore();

  const [editingClient, setEditingClient] = useState(null);
  const [selectedClient, setSelectedClient] = useState(null);
  const [transactions, setTransactions] = useState([]);

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    setLoading(true);
    try {
      const response = await clientsAPI.getAll();
      setClients(response.data);
      clearError();
    } catch (err) {
      setError('Failed to load clients');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateClient = () => {
    setEditingClient(null);
    openModal('client-form');
  };

  const handleEditClient = (client) => {
    setEditingClient(client);
    openModal('client-form');
  };

  const handleDeleteClient = async (clientId) => {
    if (!window.confirm('Are you sure you want to delete this client?')) return;

    try {
      await clientsAPI.delete(clientId);
      removeClient(clientId);
      clearError();
    } catch (err) {
      setError('Failed to delete client');
      console.error(err);
    }
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
        { id: 2, date: '2024-01-10', description: 'Product Purchase', amount: 75, status: 'Pending' },
        { id: 3, date: '2024-01-05', description: 'Consultation Fee', amount: 100, status: 'Completed' },
      ]);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
        {/* Desktop Add Button */}
        <div className="hidden md:block mt-4">
          <button
            type="button"
            onClick={handleCreateClient}
            className="btn-primary flex items-center"
          >
            <PlusIcon className="h-5 w-5 mr-2" />
            Add Client
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Mobile Layout */}
      <div className="md:hidden flex-1 flex flex-col">
        {/* Client List Area */}
        <div className={`flex-1 transition-all duration-300 ${selectedClient ? 'flex-shrink-0' : ''}`}>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 h-full">
            {clients.length > 0 ? (
              <div className="divide-y divide-gray-200">
                {clients.map((client) => (
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
                        <h3 className="text-sm font-medium text-gray-900 truncate">
                          {client.name}
                        </h3>
                        <p className="text-sm text-gray-500 truncate">
                          {client.email || client.phone || 'No contact info'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteClient(client.id);
                          }}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditClient(client);
                          }}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <PencilIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center h-32">
                <p className="text-gray-500">No clients found</p>
              </div>
            )}
          </div>
        </div>

        {/* Transaction History Panel */}
        {selectedClient && (
          <div className="mt-4 bg-white rounded-lg shadow-sm border border-gray-200">
            {/* Selected Client Header */}
            <div className="p-4 border-b border-gray-200 bg-blue-50">
              <h3 className="text-lg font-medium text-gray-900">
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

      {/* Desktop Layout */}
      <div className="hidden md:block">
        <div className="bg-white shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
          <table className="min-w-full divide-y divide-gray-300">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Phone
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Address
                </th>
                <th className="relative px-6 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {clients.map((client) => (
                <tr key={client.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {client.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {client.email || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {client.phone || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {client.address || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => handleEditClient(client)}
                      className="text-indigo-600 hover:text-indigo-900 mr-4"
                    >
                      <PencilIcon className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => handleDeleteClient(client.id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      <TrashIcon className="h-5 w-5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {clients.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">No clients found</p>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Add Button */}
      <MobileAddButton 
        onClick={handleCreateClient}
        label="Add Client"
      />

      {/* Modal for Client Form */}
      <Modal isOpen={isModalOpen} onClose={closeModal}>
        {isModalOpen && (
          <ClientForm
            client={editingClient}
            onSubmit={handleSubmitClient}
            onCancel={closeModal}
          />
        )}
      </Modal>
    </div>
  );
}
