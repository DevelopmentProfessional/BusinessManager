/*
 * ============================================================
 * FILE: Modal_Detail_Client.jsx
 *
 * PURPOSE:
 *   Full-screen modal for viewing and editing a client's full profile,
 *   including contact info, membership tier/points, and quick access to
 *   service history, purchase history, and the client's saved cart.
 *
 * FUNCTIONAL PARTS:
 *   [1] Helper Constants & Utilities — Membership tier colours, badge classes, labels,
 *       and date formatting functions
 *   [2] ServiceHistoryModal (sub-component) — Full-screen sub-modal listing upcoming
 *       and past scheduled appointments fetched from the API
 *   [3] PurchaseHistoryModal (sub-component) — Full-screen sub-modal listing
 *       transactions with expandable line-item details
 *   [4] Main Component State & Effects — Form data initialisation and cart count sync
 *   [5] Form Handlers — handleChange, handleSubmit, handleDelete
 *   [6] Header — "Client Details" title bar with close button
 *   [7] Avatar & Action Buttons — Initials avatar, tier badge, service history,
 *       purchase history, and cart shortcut buttons
 *   [8] Editable Form Fields — Contact info inputs and membership section
 *   [9] Fixed Footer — Delete, Cancel, and Save Changes actions
 *   [10] Sub-modal Mounts — ServiceHistoryModal, PurchaseHistoryModal, Modal_Client_Cart
 *
 * CHANGE LOG — all modifications to this file must be recorded here:
 *   Format : YYYY-MM-DD | Author | Description
 *   ─────────────────────────────────────────────────────────────
 *   2026-03-01 | Claude  | Added section comments and top-level documentation
 * ============================================================
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  XMarkIcon, CheckIcon, TrashIcon,
  ShoppingBagIcon, ClockIcon, SparklesIcon, CheckCircleIcon,
  ShoppingCartIcon, ArrowTrendingUpIcon
} from '@heroicons/react/24/outline';
import Modal from './Modal';
import Button_Toolbar from './Button_Toolbar';
import { clientsAPI, servicesAPI } from '../../services/api';
import Modal_Client_Cart, { getClientCartCount } from './Modal_Client_Cart';
import Modal_Template_Use from './Modal_Template_Use';
import { formatDate, formatDateTime } from '../../utils/dateFormatters';

// ─── 1 HELPER CONSTANTS & UTILITIES ────────────────────────────────────────
const MEMBERSHIP_TIERS = [
  { value: 'none',     label: 'None',     description: 'No membership tier. Standard pricing and access apply.' },
  { value: 'bronze',   label: 'Bronze',   description: 'Entry-level membership with basic benefits and discounts.' },
  { value: 'silver',   label: 'Silver',   description: 'Mid-tier membership with enhanced benefits and priority booking.' },
  { value: 'gold',     label: 'Gold',     description: 'Premium membership with exclusive perks and significant discounts.' },
  { value: 'platinum', label: 'Platinum', description: 'Top-tier membership with maximum benefits and VIP treatment.' },
];

const getTierAvatarColor = (tier) => {
  const t = (tier || 'none').toLowerCase();
  if (t === 'platinum') return '#8b5cf6';
  if (t === 'gold') return '#d97706';
  if (t === 'silver') return '#6b7280';
  if (t === 'bronze') return '#d97706';  // orange-ish
  return '#3b82f6';
};

const getTierBadgeClass = (tier) => {
  const t = (tier || 'none').toLowerCase();
  if (t === 'platinum') return 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300';
  if (t === 'gold') return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300';
  if (t === 'silver') return 'bg-gray-200 text-gray-800 dark:bg-gray-600 dark:text-gray-200';
  if (t === 'bronze') return 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300';
  return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400';
};

const getTierLabel = (tier) => {
  const labels = { none: 'None', bronze: 'Bronze', silver: 'Silver', gold: 'Gold', platinum: 'Platinum' };
  return labels[(tier || 'none').toLowerCase()] || 'None';
};


// ─── 2 SERVICE HISTORY SUB-MODAL ───────────────────────────────────────────

function ServiceHistoryModal({ isOpen, onClose, client, onEditSchedule }) {
  const [schedules, setSchedules] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen || !client) return;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const [schedRes, svcRes] = await Promise.all([
          clientsAPI.getSchedules(client.id),
          servicesAPI.getAll(),
        ]);
        setSchedules(schedRes?.data ?? []);
        const svcData = svcRes?.data ?? svcRes ?? [];
        setServices(Array.isArray(svcData) ? svcData : []);
      } catch {
        setError('Failed to load service history.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [isOpen, client?.id]);

  const now = new Date();
  const serviceMap = Object.fromEntries(services.map(s => [s.id, s]));
  // Ascending — oldest at top, most recent near the bottom
  const sorted = [...schedules].sort((a, b) => new Date(a.appointment_date) - new Date(b.appointment_date));
  const past = sorted.filter(s => new Date(s.appointment_date) < now);
  const upcoming = sorted.filter(s => new Date(s.appointment_date) >= now);

  const renderRow = (schedule, isUpcoming) => {
    const svc = serviceMap[schedule.service_id];
    const inner = (
      <>
        <div
          className="flex-shrink-0 rounded-circle d-flex align-items-center justify-content-center"
          style={{
            width: 32, height: 32,
            background: isUpcoming ? '#dbeafe' : '#f3f4f6',
            color: isUpcoming ? '#2563eb' : '#9ca3af'
          }}
        >
          {isUpcoming
            ? <ClockIcon style={{ width: 16, height: 16 }} />
            : <CheckCircleIcon style={{ width: 16, height: 16 }} />}
        </div>
        <div className="flex-grow-1 min-w-0">
          <div className="fw-medium text-truncate">{svc?.name || 'Service'}</div>
          <div className="small text-muted">{formatDateTime(schedule.appointment_date)}</div>
          {schedule.notes && (
            <div className="small text-muted text-truncate">{schedule.notes}</div>
          )}
        </div>
        <span className={`badge rounded-pill flex-shrink-0 ${isUpcoming ? 'bg-primary' : 'bg-secondary'}`}>
          {schedule.status || 'scheduled'}
        </span>
      </>
    );

    if (isUpcoming) {
      return (
        <button
          type="button"
          key={schedule.id}
          className="w-100 text-start d-flex align-items-start gap-2 py-2 px-3 border-bottom border-gray-100 dark:border-gray-700 bg-transparent border-0"
          style={{ cursor: 'pointer' }}
          onClick={() => onEditSchedule?.(schedule)}
        >
          {inner}
        </button>
      );
    }

    return (
      <div
        key={schedule.id}
        className="d-flex align-items-start gap-2 py-2 px-3 border-bottom border-gray-100 dark:border-gray-700"
      >
        {inner}
      </div>
    );
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} noPadding={true} fullScreen={true}>
      <div className="d-flex flex-column bg-white dark:bg-gray-900" style={{ height: '100%' }}>

        {/* Header */}
        <div className="flex-shrink-0 p-2 border-bottom border-gray-200 dark:border-gray-700 d-flex align-items-center bg-white dark:bg-gray-900">
          <h6 className="mb-0 fw-semibold text-gray-900 dark:text-gray-100">Service History</h6>
        </div>

        {/* Scrollable body */}
        <div className="flex-grow-1 overflow-auto no-scrollbar bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 d-flex flex-column">
          {loading && (
            <div className="d-flex justify-content-center py-4">
              <div className="spinner-border spinner-border-sm text-primary" role="status" />
            </div>
          )}
          {error && <div className="alert alert-danger py-2 mx-3 small">{error}</div>}

          {!loading && !error && (
            <>
              {schedules.length === 0 && (
                <div className="text-center text-muted py-4">
                  <SparklesIcon style={{ width: 32, height: 32, margin: '0 auto 8px' }} />
                  <div>No service history yet</div>
                </div>
              )}

              {/* Past — oldest at top */}
              {past.length > 0 && (
                <div className="mb-2">
                  <div className="fw-semibold small text-muted mb-1 px-3 pt-2">
                    Past ({past.length})
                  </div>
                  {past.map(s => renderRow(s, false))}
                </div>
              )}

              {/* Upcoming — nearest first, furthest at bottom; tap to edit */}
              {upcoming.length > 0 && (
                <div>
                  <div className="fw-semibold small text-primary mb-1 px-3 pt-2">
                    Upcoming ({upcoming.length}) — tap to edit
                  </div>
                  {upcoming.map(s => renderRow(s, true))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 pt-2 pb-4 px-3 border-top border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
          <div className="d-flex justify-content-center">
            <Button_Toolbar
              icon={XMarkIcon}
              label="Close"
              onClick={onClose}
              className="btn-outline-secondary"
            />
          </div>
        </div>

      </div>
    </Modal>
  );
}

// ─── 3 PURCHASE HISTORY SUB-MODAL ──────────────────────────────────────────

function PurchaseHistoryModal({ isOpen, onClose, client, currentUser, appSettings }) {
  const [transactions, setTransactions] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [items, setItems] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [invoiceTx, setInvoiceTx] = useState(null); // tx + items for invoice modal

  useEffect(() => {
    if (!isOpen || !client) return;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await clientsAPI.getTransactions(client.id);
        const txns = res?.data ?? [];
        // Ascending — oldest at top, most recent near the bottom
        const sorted = [...txns].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        setTransactions(sorted);
      } catch {
        setError('Failed to load purchase history.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [isOpen, client?.id]);

  const loadItems = async (txId) => {
    if (items[txId]) { setExpandedId(txId); return; }
    try {
      const res = await clientsAPI.getTransactionItems(txId);
      setItems(prev => ({ ...prev, [txId]: res?.data ?? [] }));
      setExpandedId(txId);
    } catch {
      setExpandedId(txId);
    }
  };

  const toggleExpand = (txId) => {
    if (expandedId === txId) { setExpandedId(null); return; }
    loadItems(txId);
  };

  const handleOpenInvoice = async (tx) => {
    if (!items[tx.id]) await loadItems(tx.id);
    setInvoiceTx(tx);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} noPadding={true} fullScreen={true}>
      <div className="d-flex flex-column bg-white dark:bg-gray-900" style={{ height: '100%' }}>

        {/* Header */}
        <div className="flex-shrink-0 p-2 border-bottom border-gray-200 dark:border-gray-700 d-flex justify-content-between align-items-center bg-white dark:bg-gray-900">
          <h6 className="mb-0 fw-semibold text-gray-900 dark:text-gray-100">Purchase History</h6>
        </div>

        {/* Scrollable body */}
        <div className="flex-grow-1 overflow-auto no-scrollbar bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 d-flex flex-column">
          {loading && (
            <div className="d-flex justify-content-center py-4">
              <div className="spinner-border spinner-border-sm text-primary" role="status" />
            </div>
          )}
          {error && <div className="alert alert-danger py-2 mx-3 small">{error}</div>}

          {!loading && !error && transactions.length === 0 && (
            <div className="text-center text-muted py-4">
              <ShoppingBagIcon style={{ width: 32, height: 32, margin: '0 auto 8px' }} />
              <div>No purchases yet</div>
            </div>
          )}

          {!loading && transactions.length > 0 && (
            <div>
              {transactions.map(tx => (
                <div key={tx.id} className="border-bottom border-gray-100 dark:border-gray-700">
              <div className="d-flex align-items-center">
                <button
                  type="button"
                  onClick={() => toggleExpand(tx.id)}
                  className="flex-grow-1 text-start d-flex align-items-center gap-2 py-2 px-3 bg-transparent border-0"
                  style={{ cursor: 'pointer' }}
                >
                  <div className="flex-grow-1">
                    <div className="fw-medium">${tx.total?.toFixed(2) ?? '0.00'}</div>
                    <div className="small text-muted">{formatDate(tx.created_at)}</div>
                  </div>
                  <div className="d-flex align-items-center gap-2">
                    <span className="badge bg-secondary-subtle text-secondary text-capitalize">
                      {tx.payment_method || 'cash'}
                    </span>
                    <span className="text-muted small">{expandedId === tx.id ? '▲' : '▼'}</span>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenInvoice(tx)}
                  className="btn btn-outline-secondary btn-sm me-2 flex-shrink-0"
                  title="Generate invoice for this transaction"
                  style={{ fontSize: 10, padding: '2px 6px' }}
                >
                  Invoice
                </button>
              </div>

              {expandedId === tx.id && (
                <div className="pb-2 px-3">
                  {(items[tx.id] || []).length === 0 ? (
                    <div className="small text-muted">No items found</div>
                  ) : (
                    <table className="table table-sm table-borderless mb-0">
                      <tbody>
                        {(items[tx.id] || []).map(item => (
                          <tr key={item.id}>
                            <td className="ps-0 py-1 small">
                              <span className={`badge me-1 ${item.item_type === 'service' ? 'bg-primary-subtle text-primary' : 'bg-secondary-subtle text-secondary'}`}>
                                {item.item_type}
                              </span>
                              {item.item_name}
                            </td>
                            <td className="py-1 small text-muted text-end">×{item.quantity}</td>
                            <td className="py-1 small fw-medium text-end">${item.line_total?.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td colSpan={2} className="small text-muted ps-0 pt-1">Tax</td>
                          <td className="small text-end pt-1">${tx.tax_amount?.toFixed(2)}</td>
                        </tr>
                        <tr>
                          <td colSpan={2} className="fw-semibold ps-0">Total</td>
                          <td className="fw-semibold text-end">${tx.total?.toFixed(2)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  )}
                </div>
              )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 pt-2 pb-4 px-3 border-top border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
          <div className="d-flex justify-content-center">
            <Button_Toolbar
              icon={XMarkIcon}
              label="Close"
              onClick={onClose}
              className="btn-outline-secondary"
            />
          </div>
        </div>

      </div>

      {/* Invoice template modal (nested, full-screen) */}
      {invoiceTx && (
        <div className="fixed inset-0 z-[60]">
          <Modal_Template_Use
            page="sales"
            entity={invoiceTx}
            client={client}
            items={items[invoiceTx.id] || []}
            currentUser={currentUser}
            settings={appSettings}
            filterType="invoice"
            onClose={() => setInvoiceTx(null)}
          />
        </div>
      )}
    </Modal>
  );
}

// ─── 4 MAIN COMPONENT ──────────────────────────────────────────────────────

export default function Modal_Detail_Client({
  isOpen,
  onClose,
  client,
  onUpdate,
  onDelete,
  canDelete = false,
  currentUser = null,
  appSettings = null,
}) {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    notes: '',
    membership_tier: 'none',
    membership_since: '',
    membership_expires: '',
    membership_points: 0,
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [showServiceHistory, setShowServiceHistory] = useState(false);
  const [showPurchaseHistory, setShowPurchaseHistory] = useState(false);
  const [showCart, setShowCart] = useState(false);
  const [cartCount, setCartCount] = useState(0);
  const [isTierDropdownOpen, setIsTierDropdownOpen] = useState(false);
  const [tierHelpKey, setTierHelpKey] = useState(null);
  const [tierHelpPos, setTierHelpPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (isOpen && client) {
      setFormData({
        name: client.name || '',
        email: client.email || '',
        phone: client.phone || '',
        address: client.address || '',
        notes: client.notes || '',
        membership_tier: client.membership_tier || 'none',
        membership_since: client.membership_since ? client.membership_since.split('T')[0] : '',
        membership_expires: client.membership_expires ? client.membership_expires.split('T')[0] : '',
        membership_points: client.membership_points || 0,
      });
      setFieldErrors({});
      getClientCartCount(client.id).then(setCartCount).catch(() => setCartCount(0));
    }
  }, [isOpen, client?.id]);

  // ─── 5 FORM HANDLERS ──────────────────────────────────────────────────────
  const formatPhone = (raw) => {
    const digits = raw.replace(/\D/g, '').slice(0, 10);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  };

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'phone'
        ? formatPhone(value)
        : type === 'number' ? (parseInt(value, 10) || 0) : value
    }));
  };

  const handleSubmit = () => {
    const submitData = { ...formData };
    if (!submitData.membership_since) submitData.membership_since = null;
    if (!submitData.membership_expires) submitData.membership_expires = null;
    onUpdate?.(client.id, submitData);
  };

  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this client?')) {
      onDelete?.(client.id);
      onClose();
    }
  };

  const handleEditScheduleFromHistory = (schedule) => {
    if (!schedule?.id) return;
    setShowServiceHistory(false);
    onClose?.();
    navigate(`/schedule?edit_schedule_id=${encodeURIComponent(schedule.id)}`);
  };

  const avatarColor = getTierAvatarColor(formData.membership_tier);
  const initials = (formData.name || '?').trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();

  if (!client) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} noPadding={true} fullScreen={true}>
      <div className="d-flex flex-column bg-white dark:bg-gray-900" style={{ height: '100%' }}>

        {/* ─── 6 HEADER ─────────────────────────────────────────────────── */}
        {/* Header */}
        <div className="flex-shrink-0 p-2 border-bottom border-gray-200 dark:border-gray-700 d-flex justify-content-between align-items-center bg-white dark:bg-gray-900">
          <h6 className="mb-0 fw-semibold text-gray-900 dark:text-gray-100">Client Details</h6>
        </div>

        {/* Scrollable content */}
        <div className="flex-grow-1 overflow-auto px-3 pt-3 pe-2 no-scrollbar bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">

          {/* ─── 7 AVATAR & ACTION BUTTONS ───────────────────────────────── */}
          {/* Avatar + name + tier */}
          <div className="d-flex align-items-center gap-3 mb-3">
            <div
              className="rounded-circle d-flex align-items-center justify-content-center text-white fw-bold flex-shrink-0"
              style={{ width: 56, height: 56, background: avatarColor, fontSize: '1.25rem' }}
            >
              {initials}
            </div>
            <div className="min-w-0">
              <div className="fw-bold fs-6 text-truncate">{formData.name || 'Client'}</div>
              <span className={`badge rounded-pill ${getTierBadgeClass(formData.membership_tier)}`}>
                {getTierLabel(formData.membership_tier)} · {formData.membership_points} pts
              </span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-3 mb-3">
            <button
              type="button"
              onClick={() => setShowServiceHistory(true)}
              className="flex-shrink-0 w-12 h-12 flex items-center justify-center bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white rounded-full shadow-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-all"
              title="Service History"
            >
              <SparklesIcon style={{ width: 24, height: 24 }} />
            </button>
            <button
              type="button"
              onClick={() => setShowPurchaseHistory(true)}
              className="flex-shrink-0 w-12 h-12 flex items-center justify-center bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white rounded-full shadow-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-all"
              title="Purchase History"
            >
              <ArrowTrendingUpIcon style={{ width: 24, height: 24 }} />
            </button>
            <button
              type="button"
              onClick={() => setShowCart(true)}
              className="relative flex-shrink-0 w-12 h-12 flex items-center justify-center bg-secondary-600 hover:bg-secondary-700 text-white rounded-full shadow-lg hover:shadow-xl transition-all"
              title="View Cart"
            >
              <ShoppingCartIcon style={{ width: 24, height: 24 }} />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1">
                  {cartCount}
                </span>
              )}
            </button>
          </div>

          {/* ─── 8 EDITABLE FORM FIELDS ──────────────────────────────────── */}
          <div className="form-floating mb-2">
            <input
              type="text"
              id="dc_name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className={`form-control form-control-sm ${fieldErrors.name ? 'is-invalid' : ''}`}
              placeholder="Name"
              required
            />
            <label htmlFor="dc_name">Name *</label>
            {fieldErrors.name && <div className="invalid-feedback">{fieldErrors.name}</div>}
          </div>

          <div className="form-floating mb-2">
            <input
              type="email"
              id="dc_email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="form-control form-control-sm"
              placeholder="Email"
            />
            <label htmlFor="dc_email">Email</label>
          </div>

          <div className="form-floating mb-2">
            <input
              type="tel"
              id="dc_phone"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              className="form-control form-control-sm"
              placeholder="(555) 555-5555"
              pattern="\(\d{3}\) \d{3}-\d{4}"
              title="Phone number format: (555) 555-5555"
            />
            <label htmlFor="dc_phone">Phone</label>
          </div>

          {/* Membership section */}
          <hr className="my-2" />
          <div className="small fw-semibold text-muted mb-2">Membership</div>
          <div className="row g-2 mb-2">
            <div className="col-6">
              <div className="position-relative">
                <label className="form-label" style={{ fontSize: '0.875rem', marginBottom: '0.25rem' }}>Tier</label>
                <div className="position-relative">
                  <button
                    type="button"
                    onClick={() => {
                      const nextOpen = !isTierDropdownOpen;
                      setIsTierDropdownOpen(nextOpen);
                      if (!nextOpen) setTierHelpKey(null);
                    }}
                    className="form-select form-select-sm text-start d-flex align-items-center justify-content-between"
                    style={{ cursor: 'pointer' }}
                  >
                    <span>{MEMBERSHIP_TIERS.find(opt => opt.value === formData.membership_tier)?.label || 'Select Tier'}</span>
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" viewBox="0 0 16 16" style={{ marginLeft: '8px' }}>
                      <path fillRule="evenodd" d="M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708z"/>
                    </svg>
                  </button>
                  {isTierDropdownOpen && (
                    <div
                      className="position-absolute w-100 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-lg"
                      style={{ top: 'calc(100% + 4px)', zIndex: 1000, maxHeight: '300px', overflowY: 'auto' }}
                    >
                      {MEMBERSHIP_TIERS.map((option) => {
                        const isHelpOpen = tierHelpKey === option.value;
                        return (
                          <div key={option.value} className="d-flex align-items-center gap-1 px-2 py-1 border-bottom border-gray-100 dark:border-gray-700">
                            <button
                              type="button"
                              onClick={() => {
                                handleChange({ target: { name: 'membership_tier', value: option.value } });
                                setIsTierDropdownOpen(false);
                                setTierHelpKey(null);
                              }}
                              className="btn btn-link text-start p-1 flex-grow-1 text-decoration-none text-gray-900 dark:text-gray-100"
                              style={{ fontSize: '0.875rem' }}
                            >
                              {option.label}
                            </button>
                            <div className="flex-shrink-0">
                              <button
                                type="button"
                                className="btn btn-link btn-sm p-0 text-primary border-0"
                                aria-label={`${option.label} help`}
                                onMouseEnter={(e) => {
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  setTierHelpPos({ top: rect.top, left: rect.right + 8 });
                                  setTierHelpKey(option.value);
                                }}
                                onMouseLeave={() => setTierHelpKey(prev => prev === option.value ? null : prev)}
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  setTierHelpPos({ top: rect.top, left: rect.right + 8 });
                                  setTierHelpKey(prev => prev === option.value ? null : option.value);
                                }}
                                style={{ width: '1.75rem', height: '1.75rem', lineHeight: 1, fontWeight: 700, fontSize: '0.75rem', border: 'none', outline: 'none' }}
                              >?</button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {/* Fixed-position tooltip — escapes overflow:auto container */}
                  {tierHelpKey && (() => {
                    const opt = MEMBERSHIP_TIERS.find(o => o.value === tierHelpKey);
                    if (!opt) return null;
                    return (
                      <div
                        style={{ position: 'fixed', top: tierHelpPos.top, left: tierHelpPos.left, width: 240, maxWidth: 'calc(100vw - 1rem)', zIndex: 9999, pointerEvents: 'none' }}
                        className="p-2 rounded-lg shadow-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700"
                      >
                        <div className="fw-semibold" style={{ fontSize: '0.8rem' }}>{opt.label}</div>
                        <div className="small text-gray-600 dark:text-gray-300">{opt.description}</div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
            <div className="col-6">
              <div className="form-floating">
                <input
                  type="number"
                  id="dc_points"
                  name="membership_points"
                  min="0"
                  value={formData.membership_points}
                  onChange={handleChange}
                  className="form-control form-control-sm"
                  placeholder="0"
                />
                <label htmlFor="dc_points">Points</label>
              </div>
            </div>
            <div className="col-6">
              <div className="form-floating">
                <input
                  type="date"
                  id="dc_since"
                  name="membership_since"
                  value={formData.membership_since}
                  onChange={handleChange}
                  className="form-control form-control-sm"
                  placeholder="Member Since"
                />
                <label htmlFor="dc_since">Member Since</label>
              </div>
            </div>
            <div className="col-6">
              <div className="form-floating">
                <input
                  type="date"
                  id="dc_expires"
                  name="membership_expires"
                  value={formData.membership_expires}
                  onChange={handleChange}
                  className="form-control form-control-sm"
                  placeholder="Expires"
                />
                <label htmlFor="dc_expires">Expires</label>
              </div>
            </div>
          </div>

          {/* Address & Notes */}
          <hr className="my-2" />
          <div className="form-floating mb-2">
            <textarea
              id="dc_address"
              name="address"
              value={formData.address}
              onChange={handleChange}
              className="form-control form-control-sm border-0"
              placeholder="Address"
              style={{ height: '60px' }}
            />
            <label htmlFor="dc_address">Address</label>
          </div>

          <div className="form-floating mb-2">
            <textarea
              id="dc_notes"
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              className="form-control form-control-sm border-0"
              placeholder="Notes"
              style={{ height: '80px' }}
            />
            <label htmlFor="dc_notes">Notes</label>
          </div>

        </div>

        {/* ─── 9 FIXED FOOTER ──────────────────────────────────────────────── */}
        {/* Fixed footer */}
        <div className="flex-shrink-0 pt-2 pb-4 px-3 border-top border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
          <div className="d-flex align-items-center">
            <div style={{ minWidth: 40 }}>
              {canDelete && (
                <Button_Toolbar
                  icon={TrashIcon}
                  label="Delete"
                  onClick={handleDelete}
                  className="btn-outline-danger"
                />
              )}
            </div>
            <div className="flex-grow-1 d-flex gap-3 justify-content-center align-items-center">
              <Button_Toolbar
                icon={XMarkIcon}
                label="Cancel"
                onClick={onClose}
                className="btn-outline-secondary"
              />
              <Button_Toolbar
                icon={CheckIcon}
                label="Save Changes"
                onClick={handleSubmit}
                className="btn-primary"
              />
            </div>
            <div style={{ minWidth: 40 }} />
          </div>
        </div>

      </div>

      {/* ─── 10 SUB-MODAL MOUNTS ──────────────────────────────────────────── */}
      {/* Service History Sub-modal */}
      <ServiceHistoryModal
        isOpen={showServiceHistory}
        onClose={() => setShowServiceHistory(false)}
        client={client}
        onEditSchedule={handleEditScheduleFromHistory}
      />

      {/* Purchase History Sub-modal */}
      <PurchaseHistoryModal
        isOpen={showPurchaseHistory}
        onClose={() => setShowPurchaseHistory(false)}
        client={client}
        currentUser={currentUser}
        appSettings={appSettings}
      />

      {/* Client Cart Modal */}
      <Modal_Client_Cart
        isOpen={showCart}
        onClose={() => {
          setShowCart(false);
          setCartCount(getClientCartCount(client?.id));
        }}
        client={client}
      />
    </Modal>
  );
}
