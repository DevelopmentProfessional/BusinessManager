import React, { useEffect, useState, useMemo, useRef } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import useStore from '../services/useStore';
import { clientsAPI } from '../services/api';
import Modal from './components/Modal';
import Form_Client from './components/Form_Client';
import Modal_Detail_Client from './components/Modal_Detail_Client';
import Gate_Permission from './components/Gate_Permission';
import { PlusIcon, StarIcon, XMarkIcon } from '@heroicons/react/24/outline';

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
  const [isTierFilterOpen, setIsTierFilterOpen] = useState(false);
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

  const handleOpenClient = (client) => {
    setEditingClient(client);
    openModal('client-detail');
  };

  const handleDeleteClient = async (clientId) => {
    if (!hasPermission('clients', 'delete')) {
      setError('You do not have permission to delete clients');
      return;
    }
    try {
      await clientsAPI.delete(clientId);
      removeClient(clientId);
      closeModal();
      clearError();
    } catch (err) {
      const errorMsg = err?.response?.data?.detail || 'Failed to delete client';
      setError(errorMsg);
      console.error(err);
    }
  };

  const handleSubmitCreate = async (clientData) => {
    try {
      const response = await clientsAPI.create(clientData);
      const newClient = response?.data ?? response;
      addClient(newClient);
      closeModal();
      clearError();
    } catch (err) {
      const errorMsg = err?.response?.data?.detail || 'Failed to create client';
      setError(errorMsg);
      console.error(err);
    }
  };

  const handleUpdateClient = async (clientId, clientData) => {
    try {
      const response = await clientsAPI.update(clientId, clientData);
      const updatedClient = response?.data ?? response;
      updateClient(clientId, updatedClient);
      closeModal();
      clearError();
    } catch (err) {
      const errorMsg = err?.response?.data?.detail || 'Failed to update client';
      setError(errorMsg);
      console.error(err);
    }
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

  const getTierFilterButtonClass = () => {
    if (tierFilter === 'all') return 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600';
    if (tierFilter === 'PLATINUM') return 'bg-purple-600 text-white';
    if (tierFilter === 'GOLD') return 'bg-yellow-500 text-white';
    if (tierFilter === 'SILVER') return 'bg-gray-400 text-white';
    if (tierFilter === 'BRONZE') return 'bg-orange-600 text-white';
    return 'bg-gray-500 text-white'; // NONE
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
    <div className="d-flex flex-column overflow-hidden bg-body" style={{ height: '100dvh' }}>

      {/* Header */}
      <div className="flex-shrink-0 border-bottom p-2 bg-body" style={{ zIndex: 5 }}>
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

        {/* Container_Scrollable rows – grow upwards from bottom */}
        <div
          ref={scrollRef}
          className="flex-grow-1 overflow-auto d-flex flex-column-reverse bg-white no-scrollbar"
          style={{ background: 'var(--bs-body-bg)' }}
        >
          {filteredClients.length > 0 ? (
            <table className="table table-borderless table-hover mb-0 table-fixed">
              <colgroup>
                <col />
                <col style={{ width: '110px' }} />
              </colgroup>
              <tbody>
                {filteredClients.map((client, index) => (
                  <tr
                    key={client.id || index}
                    className="align-middle border-bottom"
                    style={{ height: '56px', cursor: 'pointer' }}
                    onClick={() => handleOpenClient(client)}
                  >
                    {/* Name + contact */}
                    <td className="px-3">
                      <div className="fw-medium text-truncate">{client.name}</div>
                      <div className="small text-muted text-truncate">
                        {client.email || client.phone || 'No contact'}
                      </div>
                    </td>

                    {/* Membership */}
                    <td className="px-2">
                      <span className={`badge rounded-pill ${getTierColor(client.membership_tier)}`}>
                        {getTierLabel(client.membership_tier)}
                      </span>
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
        <div className="app-footer-search flex-shrink-0 bg-white dark:bg-gray-800 border-top border-gray-200 dark:border-gray-700 shadow-sm" style={{ zIndex: 10 }}>
          {/* Column Headers */}
          <table className="table table-borderless mb-0 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
            <colgroup>
              <col />
              <col style={{ width: '110px' }} />
            </colgroup>
            <tfoot>
              <tr className="bg-gray-100 dark:bg-gray-700">
                <th>Client</th>
                <th>Membership</th>
              </tr>
            </tfoot>
          </table>

          {/* Controls */}
          <div className="p-3 pt-2 border-top border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 ">
            {/* Search row */}
            <div className="position-relative w-100 mb-2">
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
                className="app-search-input form-control ps-5 w-100 rounded-pill"
              />
            </div>

            {/* Controls row - Add, Tier */}
            <div className="d-flex align-items-center gap-1 pb-2 flex-wrap">
              <Gate_Permission page="clients" permission="write">
                <button
                  type="button"
                  onClick={handleCreateClient}
                  className="btn flex-shrink-0 d-flex align-items-center justify-content-center rounded-circle bg-secondary-600 hover:bg-secondary-700 text-white border-0 shadow-lg"
                  style={{ width: '3rem', height: '3rem' }}
                  title="Add client"
                >
                  <PlusIcon className="h-5 w-5" />
                </button>
              </Gate_Permission>

              {/* Clear Filters Button */}
              {tierFilter !== 'all' && (
                <button
                  type="button"
                  onClick={() => setTierFilter('all')}
                  className="btn d-flex align-items-center justify-content-center rounded-circle bg-red-600 hover:bg-red-700 text-white border-0 shadow-lg transition-all"
                  style={{ width: '3rem', height: '3rem' }}
                  title="Clear filter"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              )}

              {/* Tier Filter */}
              <div className="position-relative">
                <button
                  type="button"
                  onClick={() => setIsTierFilterOpen(!isTierFilterOpen)}
                  className={`btn d-flex align-items-center justify-content-center rounded-circle border-0 shadow-lg transition-all ${getTierFilterButtonClass()}`}
                  style={{ width: '3rem', height: '3rem' }}
                  title="Filter by tier"
                  data-active={tierFilter !== 'all'}
                >
                  <StarIcon className="h-6 w-6" />
                </button>
                {isTierFilterOpen && (
                  <div className="position-absolute bottom-100 start-0 mb-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg p-2 z-50" style={{ minWidth: '200px' }}>
                    <button
                      onClick={() => { setTierFilter('all'); setIsTierFilterOpen(false); }}
                      className={`d-block w-100 text-start px-3 py-2 rounded-lg mb-1 transition-colors ${tierFilter === 'all' ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400' : 'hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100'}`}
                    >
                      All Tiers
                    </button>
                    <button
                      onClick={() => { setTierFilter('NONE'); setIsTierFilterOpen(false); }}
                      className={`d-block w-100 text-start px-3 py-2 rounded-lg mb-1 transition-colors ${tierFilter === 'NONE' ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400' : 'hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100'}`}
                    >
                      No Membership
                    </button>
                    <button
                      onClick={() => { setTierFilter('BRONZE'); setIsTierFilterOpen(false); }}
                      className={`d-block w-100 text-start px-3 py-2 rounded-lg mb-1 transition-colors ${tierFilter === 'BRONZE' ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400' : 'hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100'}`}
                    >
                      Bronze
                    </button>
                    <button
                      onClick={() => { setTierFilter('SILVER'); setIsTierFilterOpen(false); }}
                      className={`d-block w-100 text-start px-3 py-2 rounded-lg mb-1 transition-colors ${tierFilter === 'SILVER' ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400' : 'hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100'}`}
                    >
                      Silver
                    </button>
                    <button
                      onClick={() => { setTierFilter('GOLD'); setIsTierFilterOpen(false); }}
                      className={`d-block w-100 text-start px-3 py-2 rounded-lg mb-1 transition-colors ${tierFilter === 'GOLD' ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400' : 'hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100'}`}
                    >
                      Gold
                    </button>
                    <button
                      onClick={() => { setTierFilter('PLATINUM'); setIsTierFilterOpen(false); }}
                      className={`d-block w-100 text-start px-3 py-2 rounded-lg transition-colors ${tierFilter === 'PLATINUM' ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400' : 'hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100'}`}
                    >
                      Platinum
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Client Detail Modal (for viewing/editing) */}
      <Modal_Detail_Client
        isOpen={isModalOpen && modalContent === 'client-detail'}
        onClose={closeModal}
        client={editingClient}
        onUpdate={handleUpdateClient}
        onDelete={handleDeleteClient}
        canDelete={hasPermission('clients', 'delete')}
      />

      {/* Create Client Modal (bottom-sheet form) */}
      <Modal isOpen={isModalOpen && modalContent === 'client-form'} onClose={closeModal} noPadding={true} fullScreen={true}>
        {isModalOpen && modalContent === 'client-form' && (
          <Form_Client
            client={null}
            onSubmit={handleSubmitCreate}
            onCancel={closeModal}
            error={error}
          />
        )}
      </Modal>
    </div>
  );
}
