import React from 'react';
import Modal from './Modal';
import { XMarkIcon, CheckIcon, PlusIcon } from '@heroicons/react/24/outline';
import Button_Toolbar from './Button_Toolbar';

export default function Modal_Insurance_Plans({
  isOpen,
  onClose,
  insurancePlans,
  editingPlan,
  setEditingPlan,
  newPlan,
  setNewPlan,
  insurancePlansLoading,
  insuranceError,
  onSave,
  onDelete,
  onToggle,
}) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={() => { onClose(); setEditingPlan(null); }}
      noPadding={true}
      fullScreen={true}
    >
      <div className="d-flex flex-column bg-white dark:bg-gray-900" style={{ height: '100%' }}>
        {/* Header */}
        <div className="flex-shrink-0 p-2 border-bottom border-gray-200 dark:border-gray-700 d-flex align-items-center">
          <h6 className="mb-0 fw-semibold text-gray-900 dark:text-gray-100">Insurance Plans</h6>
        </div>

        {/* Scrollable list */}
        <div className="flex-grow-1 overflow-auto no-scrollbar px-3 pt-2">
          {insuranceError && (
            <div className="alert alert-danger alert-sm py-2 px-3 mb-2" style={{ fontSize: '0.8rem' }}>{insuranceError}</div>
          )}
          {insurancePlansLoading ? (
            <div className="text-center py-4">
              <div className="spinner-border spinner-border-sm text-primary" role="status" />
            </div>
          ) : insurancePlans.length === 0 ? (
            <p className="text-muted small text-center py-4">No insurance plans yet. Add one below.</p>
          ) : (
            <div className="d-flex flex-column gap-2 pb-2">
              {insurancePlans.map(plan => (
                <div key={plan.id} className={`d-flex align-items-center justify-content-between p-2 border rounded ${!plan.is_active ? 'opacity-60' : ''}`}>
                  <div>
                    <div className="fw-semibold d-flex align-items-center gap-2" style={{ fontSize: '0.875rem' }}>
                      {plan.name}
                      <span className={`badge ${plan.is_active ? 'bg-success' : 'bg-secondary'}`} style={{ fontSize: '0.65rem' }}>
                        {plan.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    {plan.description && (
                      <div className="text-muted" style={{ fontSize: '0.78rem' }}>{plan.description}</div>
                    )}
                  </div>
                  <div className="d-flex gap-1">
                    <button
                      className={`btn btn-sm ${plan.is_active ? 'btn-outline-secondary' : 'btn-outline-success'}`}
                      style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                      onClick={() => onToggle(plan)}
                      title={plan.is_active ? 'Deactivate' : 'Activate'}
                    >
                      {plan.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      className="btn btn-sm btn-outline-secondary"
                      style={{ fontSize: '0.75rem', padding: '0.2rem 0.4rem' }}
                      onClick={() => setEditingPlan({ ...plan })}
                      title="Edit"
                    >
                      <PlusIcon style={{ width: 12, height: 12 }} />
                    </button>
                    <button
                      className="btn btn-sm btn-outline-danger"
                      style={{ fontSize: '0.75rem', padding: '0.2rem 0.4rem' }}
                      onClick={() => onDelete(plan.id)}
                      title="Delete"
                    >
                      <XMarkIcon style={{ width: 12, height: 12 }} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer – Add / Edit Plan form */}
        <div className="flex-shrink-0 border-top border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 pt-2 pb-4">
          <form onSubmit={onSave} className="d-flex flex-column gap-2">
            <div className="small fw-semibold text-muted">{editingPlan ? 'Edit Plan' : 'New Plan'}</div>
            <div className="row g-2">
              <div className="col-6">
                <div className="form-floating">
                  <input
                    type="text"
                    id="ins_plan_name"
                    className="form-control form-control-sm"
                    placeholder="Plan name"
                    value={editingPlan ? editingPlan.name : newPlan.name}
                    onChange={e => editingPlan
                      ? setEditingPlan(prev => ({ ...prev, name: e.target.value }))
                      : setNewPlan(prev => ({ ...prev, name: e.target.value }))}
                    required
                  />
                  <label htmlFor="ins_plan_name">Plan Name *</label>
                </div>
              </div>
              <div className="col-6">
                <div className="form-floating">
                  <input
                    type="text"
                    id="ins_plan_desc"
                    className="form-control form-control-sm"
                    placeholder="Description"
                    value={editingPlan ? (editingPlan.description || '') : newPlan.description}
                    onChange={e => editingPlan
                      ? setEditingPlan(prev => ({ ...prev, description: e.target.value }))
                      : setNewPlan(prev => ({ ...prev, description: e.target.value }))}
                  />
                  <label htmlFor="ins_plan_desc">Description</label>
                </div>
              </div>
            </div>
            <div className="d-flex align-items-center">
              <div style={{ width: 40 }}>
                {editingPlan && (
                  <button
                    type="button"
                    onClick={() => setEditingPlan(null)}
                    className="btn btn-outline-secondary btn-sm p-1 d-flex align-items-center justify-content-center"
                    style={{ width: '2.5rem', height: '2.5rem' }}
                    title="Cancel edit"
                  >
                    <XMarkIcon style={{ width: 14, height: 14 }} />
                  </button>
                )}
                {!editingPlan && (
                  <button
                    type="button"
                    onClick={() => onClose()}
                    className="btn btn-outline-secondary btn-sm p-1 d-flex align-items-center justify-content-center"
                    style={{ width: '2.5rem', height: '2.5rem' }}
                    title="Close modal"
                  >
                    <XMarkIcon style={{ width: 14, height: 14 }} />
                  </button>
                )}
              </div>
              <div className="flex-grow-1 d-flex justify-content-center">
                <button
                  type="submit"
                  className="btn btn-primary btn-sm p-1 d-flex align-items-center justify-content-center"
                  style={{ width: '3rem', height: '3rem' }}
                  title={editingPlan ? 'Save Changes' : 'Add Plan'}
                >
                  <CheckIcon style={{ width: 18, height: 18 }} />
                </button>
              </div>
              <div style={{ width: 40 }} />
            </div>
          </form>
        </div>
      </div>
    </Modal>
  );
}
