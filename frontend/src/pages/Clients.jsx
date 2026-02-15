import React, { useEffect, useState, useMemo, useRef } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import useStore from '../services/useStore';
import { clientsAPI } from '../services/api';
import Modal from './components/Modal';
import ClientForm from './components/ClientForm';
import PermissionGate from './components/PermissionGate';
import CSVImportButton from './components/CSVImportButton';

export default function Clients() {
  const { 
    clients, setClients, addClient, updateClient, removeClient,
    loading, setLoading, error, setError, clearError,
    isModalOpen, modalContent, openModal, closeModal, hasPermission
  } = useStore();

  // Check permissions at page level
  if (!hasPermission('clients', 'read') && 
      !hasPermission('clients', 'write') && 
      !hasPermission('clients', 'delete') && 
      !hasPermission('clients', 'admin')) {
    return <Navigate to="/profile" replace />;
  }

  const [editingClient, setEditingClient] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [tierFilter, setTierFilter] = useState('all');
  const scrollRef = useRef(null);
  const hasFetched = useRef(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;
    loadClients();
  }, []);

  // Auto-open create modal when navigated with ?new=1
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

    try {
      await clientsAPI.delete(clientId);
      removeClient(clientId);
      clearError();
    } catch (err) {
      const errorMsg = err?.response?.data?.detail || 'Failed to delete client';
      setError(errorMsg);
      console.error(err);
    }
  };

  const handleSubmitClient = async (clientData) => {
    try {
      if (editingClient) {
        const response = await clientsAPI.update(editingClient.id, clientData);
        const updatedClient = response?.data ?? response;
        updateClient(editingClient.id, updatedClient);
      } else {
        const response = await clientsAPI.create(clientData);
        const newClient = response?.data ?? response;
        addClient(newClient);
      }
      closeModal();
      clearError();
    } catch (err) {
      const errorMsg = err?.response?.data?.detail || 'Failed to save client';
      setError(errorMsg);
      console.error(err);
    }
  };

  const handleCSVImport = async (records) => {
    let success = 0;
    let failed = 0;
    const errors = [];

    for (const record of records) {
      try {
        const clientData = {
          name: record.name,
          email: record.email || null,
          phone: record.phone || null,
          address: record.address || null,
          notes: record.notes || null,
          membership_tier: (record.membership_tier || 'NONE').toUpperCase(),
        };
        
        await clientsAPI.create(clientData);
        success++;
      } catch (err) {
        failed++;
        const detail = err?.response?.data?.detail || err?.message || 'Unknown error';
        errors.push(`Row ${success + failed}: ${record.name || 'Unknown'} - ${detail}`);
      }
    }

    return { success, failed, errors };
  };

  // Get membership tier badge color
  const getTierColor = (tier) => {
    const upperTier = (tier || 'NONE').toUpperCase();
    if (upperTier === 'PLATINUM') return 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300';
    if (upperTier === 'GOLD') return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300';
    if (upperTier === 'SILVER') return 'bg-gray-200 text-gray-800 dark:bg-gray-600 dark:text-gray-200';
    if (upperTier === 'BRONZE') return 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300';
    return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'; // NONE
  };

  const getTierLabel = (tier) => {
    const labels = { NONE: 'None', BRONZE: 'Bronze', SILVER: 'Silver', GOLD: 'Gold', PLATINUM: 'Platinum' };
    return labels[(tier || 'NONE').toUpperCase()] || tier || 'None';
  };

  // Filter clients
  const filteredClients = useMemo(() => {
    return clients.filter((client) => {
      // Search filter
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchesName = (client.name || '').toLowerCase().includes(term);
        const matchesEmail = (client.email || '').toLowerCase().includes(term);
        const matchesPhone = (client.phone || '').toLowerCase().includes(term);
        if (!matchesName && !matchesEmail && !matchesPhone) return false;
      }

      // Tier filter
      if (tierFilter !== 'all') {
        const clientTier = (client.membership_tier || 'NONE').toUpperCase();
        if (clientTier !== tierFilter) return false;
      }

      return true;
    });
  }, [clients, searchTerm, tierFilter]);

  // Scroll to bottom when data loads
  useEffect(() => {
    if (scrollRef.current && filteredClients.length > 0) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [filteredClients.length]);

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ height: '16rem' }}>
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="d-flex flex-column vh-100 overflow-hidden bg-body">

      {/* Header */}
      <div className="flex-shrink-0 border-bottom p-3">
        <h1 className="h-4 mb-0 fw-bold text-body-emphasis">Clients</h1>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="flex-shrink-0 alert alert-danger border-0 rounded-0 m-0">
          {error}
        </div>
      )}

      {/* Main table container */}
      <div className="flex-grow-1 d-flex flex-column overflow-hidden">

        {/* Scrollable rows – grow upwards from bottom */}
        <div
          ref={scrollRef}
          className="flex-grow-1 overflow-auto d-flex flex-column-reverse bg-white"
          style={{ background: 'var(--bs-body-bg)' }}
        >
          {filteredClients.length > 0 ? (
            <table className="table table-borderless table-hover mb-0 table-fixed">
              <colgroup>
                <col style={{ width: '50px' }} />
                <col />
                <col style={{ width: '180px' }} />
                <col style={{ width: '140px' }} />
                <col style={{ width: '100px' }} />
                <col style={{ width: '50px' }} />
              </colgroup>
              <tbody>
                {filteredClients.map((client, index) => (
                  <tr
                    key={client.id || index}
                    className="align-middle border-bottom"
                    style={{ height: '56px' }}
                  >
                    {/* Delete */}
                    <td className="text-center px-2">
                      <PermissionGate page="clients" permission="delete">
                        <button
                          onClick={() => handleDeleteClient(client.id)}
                          className="btn btn-sm btn-outline-danger border-0 p-1"
                          title="Delete"
                        >
                          ×
                        </button>
                      </PermissionGate>
                    </td>

                    {/* Name */}
                    <td className="px-3">
                      <div className="fw-medium text-truncate" style={{ maxWidth: '100%' }}>
                        {client.name}
                      </div>
                      <div className="small text-muted text-truncate">
                        {client.email || client.phone || 'No contact'}
                      </div>
                    </td>

                    {/* Phone */}
                    <td className="px-3 text-muted">
                      <div className="text-truncate" style={{ maxWidth: '100%' }}>
                        {client.phone || '-'}
                      </div>
                    </td>

                    {/* Membership */}
                    <td className="px-3">
                      <span className={`badge rounded-pill ${getTierColor(client.membership_tier)}`}>
                        {getTierLabel(client.membership_tier)}
                      </span>
                    </td>

                    {/* Points */}
                    <td className="text-center px-3">
                      <span className="badge bg-secondary-subtle text-secondary">
                        {client.membership_points || 0} pts
                      </span>
                    </td>

                    {/* Edit */}
                    <td className="text-center px-2">
                      <PermissionGate page="clients" permission="write">
                        <button
                          onClick={() => handleEditClient(client)}
                          className="btn btn-sm btn-outline-primary border-0 p-1"
                          title="Edit"
                        >
                          ✎
                        </button>
                      </PermissionGate>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="d-flex align-items-center justify-content-center flex-grow-1 text-muted">
              {searchTerm ? `No clients found matching "${searchTerm}"` : 'No clients found'}
            </div>
          )}
        </div>

        {/* Fixed bottom – headers + controls */}
        <div className="flex-shrink-0 bg-white dark:bg-gray-800 border-top border-gray-200 dark:border-gray-700 shadow-sm" style={{ zIndex: 10 }}>
          {/* Column Headers */}
          <table className="table table-borderless mb-0 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
            <colgroup>
              <col style={{ width: '50px' }} />
              <col />
              <col style={{ width: '180px' }} />
              <col style={{ width: '140px' }} />
              <col style={{ width: '100px' }} />
              <col style={{ width: '50px' }} />
            </colgroup>
            <tfoot>
              <tr className="bg-gray-100 dark:bg-gray-700">
                <th className="text-center"></th>
                <th>Client</th>
                <th>Phone</th>
                <th>Membership</th>
                <th className="text-center">Points</th>
                <th className="text-center"></th>
              </tr>
            </tfoot>
          </table>

          {/* Controls */}
          <div className="p-2 border-top border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
            {/* Filters row */}
            <div className="d-flex flex-wrap gap-2 mb-2 align-items-center">
              <div className="flex-grow-1 position-relative" style={{ minWidth: '180px' }}>
                <span className="position-absolute top-50 start-0 translate-middle-y ps-2 text-muted">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001q.044.06.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1 1 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0"/>
                  </svg>
                </span>
                <input
                  type="text"
                  placeholder="Search by name, email, or phone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="form-control ps-5"
                />
              </div>

              <select
                value={tierFilter}
                onChange={(e) => setTierFilter(e.target.value)}
                className="form-select form-select-sm"
                style={{ maxWidth: '160px' }}
              >
                <option value="all">All Tiers</option>
                <option value="NONE">No Membership</option>
                <option value="BRONZE">Bronze</option>
                <option value="SILVER">Silver</option>
                <option value="GOLD">Gold</option>
                <option value="PLATINUM">Platinum</option>
              </select>

              <span className="text-muted small ms-2">
                {filteredClients.length} / {clients.length}
              </span>
            </div>

            {/* Action buttons */}
            <PermissionGate page="clients" permission="write">
              <div className="d-flex gap-2">
                <div className="btn-group">
                  <CSVImportButton
                    entityName="Clients"
                    onImport={handleCSVImport}
                    onComplete={loadClients}
                    requiredFields={['name']}
                    fieldMapping={{
                      'client name': 'name',
                      'full name': 'name',
                      'client': 'name',
                      'email address': 'email',
                      'phone number': 'phone',
                      'tier': 'membership_tier',
                      'membership': 'membership_tier',
                    }}
                    className="btn btn-outline-secondary"
                  />
                  <button
                    type="button"
                    onClick={handleCreateClient}
                    className="btn btn-primary"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16" className="me-1">
                      <path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4"/>
                    </svg>
                    Add
                  </button>
                </div>
              </div>
            </PermissionGate>
          </div>
        </div>
      </div>

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
