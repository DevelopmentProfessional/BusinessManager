import React from 'react';
import Modal from './Modal';
import { XMarkIcon } from '@heroicons/react/24/outline';
import Button_Toolbar from './Button_Toolbar';

export default function Modal_Requests_Employee({
  isOpen,
  onClose,
  allRequests,
  requestTypeFilter,
  setRequestTypeFilter,
  requestTimeFilter,
  setRequestTimeFilter,
  requestsLoading,
  employees,
  onRequestAction,
  loadRequests,
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} noPadding={true} fullScreen={true}>
      <div className="d-flex flex-column bg-white dark:bg-gray-900" style={{ height: '100%' }}>
        {/* Header */}
        <div className="flex-shrink-0 p-2 border-bottom border-gray-200 dark:border-gray-700 d-flex justify-content-between align-items-center">
          <h6 className="mb-0 fw-semibold text-gray-900 dark:text-gray-100">Requests</h6>
          <button type="button" onClick={onClose} className="btn btn-link p-0 text-muted">
            <XMarkIcon style={{ width: 20, height: 20 }} />
          </button>
        </div>

        <div className="flex-grow-1 overflow-auto no-scrollbar px-3 pt-2">
          {requestsLoading ? (
            <div className="text-center py-4">
              <div className="spinner-border text-primary" role="status" />
            </div>
          ) : allRequests.length === 0 ? (
            <p className="text-muted text-center py-4">No requests found.</p>
          ) : (
            <div className="d-flex flex-column gap-2">
              {['approved', 'denied', 'pending'].map(statusGroup => {
                const now = new Date();
                const timeFiltered = allRequests.filter(r => {
                  if (requestTimeFilter === 'all') return true;
                  if (!r.created_at) return true;
                  const diffDays = (now - new Date(r.created_at)) / (1000 * 60 * 60 * 24);
                  if (requestTimeFilter === '7d') return diffDays <= 7;
                  if (requestTimeFilter === '30d') return diffDays <= 30;
                  if (requestTimeFilter === '90d') return diffDays <= 90;
                  return true;
                });
                const grouped = timeFiltered.filter(r => r.status === statusGroup);
                if (grouped.length === 0) return null;
                return (
                  <div key={statusGroup}>
                    <h6 className={`text-capitalize mb-2 ${statusGroup === 'pending' ? 'text-warning' : statusGroup === 'approved' ? 'text-success' : 'text-danger'}`}>
                      {statusGroup} ({grouped.length})
                    </h6>
                    {grouped.map(req => {
                      const emp = employees.find(e => e.id === req.user_id);
                      return (
                        <div key={req.id} className="card mb-2">
                          <div className="card-body py-2 px-3">
                            <div className="d-flex justify-content-between align-items-start">
                              <div>
                                <div className="fw-semibold">{emp ? `${emp.first_name} ${emp.last_name}` : 'Unknown Employee'}</div>
                                <div className="small text-muted">
                                  <span className="badge bg-secondary me-1">{req._typeLabel}</span>
                                  {req._dateInfo}
                                </div>
                                {req.notes && <div className="small text-muted fst-italic">{req.notes}</div>}
                              </div>
                              {req.status === 'pending' && (
                                <div className="d-flex gap-1">
                                  <button
                                    className="btn btn-sm btn-success"
                                    onClick={() => onRequestAction(req, 'approved')}
                                  >
                                    Approve
                                  </button>
                                  <button
                                    className="btn btn-sm btn-danger"
                                    onClick={() => onRequestAction(req, 'denied')}
                                  >
                                    Deny
                                  </button>
                                </div>
                              )}
                              {req.status !== 'pending' && (
                                <span className={`badge ${req.status === 'approved' ? 'bg-success' : 'bg-danger'}`}>
                                  {req.status}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 pt-2 pb-4 px-3 border-top border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
          {/* Row 1: Type filter pills */}
          <div className="d-flex flex-wrap gap-1 mb-2">
            {[
              { key: 'all', label: 'All' },
              { key: 'leave_vacation', label: 'Vacation' },
              { key: 'leave_sick', label: 'Sick' },
              { key: 'onboarding', label: 'Onboarding' },
              { key: 'offboarding', label: 'Offboarding' },
            ].map(({ key, label }) => (
              <button
                key={key}
                className={`btn btn-sm rounded-pill ${requestTypeFilter === key ? 'btn-warning' : 'btn-outline-secondary'}`}
                onClick={() => {
                  setRequestTypeFilter(key);
                  loadRequests(key);
                }}
              >
                {label}
              </button>
            ))}
          </div>
          {/* Row 2: Time filter + Close */}
          <div className="d-flex align-items-center gap-2">
            <select
              value={requestTimeFilter}
              onChange={e => setRequestTimeFilter(e.target.value)}
              className="form-select form-select-sm rounded-pill"
              style={{ width: 'fit-content' }}
            >
              <option value="all">All Time</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="90d">Last 90 Days</option>
            </select>
            <div className="flex-grow-1 d-flex gap-3 justify-content-center">
              <button
                type="button"
                onClick={onClose}
                className="btn btn-outline-secondary btn-sm p-1 d-flex align-items-center justify-content-center"
                style={{ width: '3rem', height: '3rem' }}
                title="Close"
              >
                <XMarkIcon style={{ width: 18, height: 18 }} />
              </button>
            </div>
            <div style={{ width: 40 }} />
          </div>
        </div>
      </div>
    </Modal>
  );
}
