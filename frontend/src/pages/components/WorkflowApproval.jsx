/**
 * ============================================================
 * FILE: WorkflowApproval.jsx
 *
 * PURPOSE:
 *   Modal/component for assigning workflows to documents and
 *   viewing workflow approval status
 *
 * FEATURES:
 *   - Assign workflow to document
 *   - View workflow progress
 *   - Approve/reject steps
 *   - Add signature when approving
 * ============================================================
 */

import React, { useState, useEffect } from 'react';
import { 
  CheckCircleIcon, 
  ExclamationIcon,
  XMarkIcon,
  PencilSquareIcon
} from '@heroicons/react/24/outline';
import { formatDateTime } from '../utils/dateFormatters';

// ─ Main Component ────────────────────────────────────────────────────

export const WorkflowModal = ({ documentId, onClose, onAssigned }) => {
  const [workflows, setWorkflows] = useState([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    fetchWorkflows();
  }, []);
  
  const fetchWorkflows = async () => {
    try {
      const response = await fetch('/api/v1/workflows');
      if (response.ok) {
        setWorkflows(await response.json());
      }
    } catch (error) {
      console.error('Failed to load workflows:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const handleAssignWorkflow = async () => {
    if (!selectedWorkflow) return;
    
    try {
      const response = await fetch(`/api/v1/documents/${documentId}/assign-workflow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workflow_template_id: selectedWorkflow.id })
      });
      
      if (response.ok) {
        alert('Workflow assigned successfully');
        onAssigned?.();
        onClose();
      }
    } catch (error) {
      console.error('Failed to assign workflow:', error);
      alert('Error assigning workflow');
    }
  };
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">Assign Workflow</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>
        
        <div className="p-6">
          {loading ? (
            <p className="text-gray-600">Loading workflows...</p>
          ) : workflows.length === 0 ? (
            <p className="text-gray-600">No workflows available. Create one first.</p>
          ) : (
            <div className="space-y-3">
              {workflows.map(wf => (
                <label key={wf.id} className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                  <input
                    type="radio"
                    name="workflow"
                    value={wf.id}
                    checked={selectedWorkflow?.id === wf.id}
                    onChange={() => setSelectedWorkflow(wf)}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900">{wf.name}</h3>
                    <p className="text-sm text-gray-600">{wf.description}</p>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>
        
        <div className="flex gap-3 justify-end p-6 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={handleAssignWorkflow}
            disabled={!selectedWorkflow}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            Assign Workflow
          </button>
        </div>
      </div>
    </div>
  );
};


// ─ Workflow Status Tracker ─────────────────────────────────────────

export const WorkflowStatusTracker = ({ documentId }) => {
  const [workflow, setWorkflow] = useState(null);
  const [steps, setSteps] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    loadWorkflow();
  }, [documentId]);
  
  const loadWorkflow = async () => {
    try {
      const [wfRes, stepsRes] = await Promise.all([
        fetch(`/api/v1/documents/${documentId}/workflow`),
        fetch(`/api/v1/documents/${documentId}/workflow-steps`)
      ]);
      
      if (wfRes.ok) setWorkflow(await wfRes.json());
      if (stepsRes.ok) setSteps(await stepsRes.json());
    } catch (error) {
      console.error('Failed to load workflow:', error);
    } finally {
      setLoading(false);
    }
  };
  
  if (loading) return <div>Loading workflow...</div>;
  if (!workflow) return null;
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
        <h3 className="font-semibold text-gray-900">Workflow Progress</h3>
        <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
          {workflow.status}
        </span>
      </div>
      
      <div className="space-y-3">
        {steps.map((step, idx) => (
          <div key={step.id} className="flex gap-4 items-start">
            {/* Status indicator */}
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${
                step.action === 'approved' ? 'bg-green-600' :
                step.action === 'rejected' ? 'bg-red-600' :
                step.action === 'pending' ? 'bg-yellow-600' :
                'bg-gray-400'
              }`}>
                {step.action === 'approved' ? '✓' :
                 step.action === 'rejected' ? '✕' :
                 step.action === 'pending' ? '⏱' : '○'}
              </div>
              {idx < steps.length - 1 && <div className="w-0.5 h-8 bg-gray-300 mt-1"></div>}
            </div>
            
            {/* Step details */}
            <div className="flex-1">
              <h4 className="font-medium text-gray-900">{step.stage_name}</h4>
              <p className="text-sm text-gray-600">Assigned to {step.assigned_to_user_id}</p>
              {step.assigned_at && (
                <p className="text-xs text-gray-500">Assigned {formatDateTime(step.assigned_at)}</p>
              )}
              {step.action_at && (
                <p className="text-xs text-gray-500">
                  {step.action === 'approved' ? 'Approved' : 'Rejected'} {formatDateTime(step.action_at)}
                </p>
              )}
              {step.action_reason && (
                <p className="text-sm text-red-900 mt-1">Reason: {step.action_reason}</p>
              )}
            </div>
          </div>
        ))}
      </div>
      
      {workflow.status === 'approved' && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex gap-2">
          <CheckCircleIcon className="w-5 h-5 text-green-600 flex-shrink-0" />
          <p className="text-sm text-green-900">Document workflow approved</p>
        </div>
      )}
      
      {workflow.status === 'rejected' && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex gap-2">
          <ExclamationIcon className="w-5 h-5 text-red-600 flex-shrink-0" />
          <div>
            <p className="text-sm text-red-900 font-medium">Document rejected</p>
            {workflow.rejection_reason && (
              <p className="text-sm text-red-800">Reason: {workflow.rejection_reason}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};


// ─ Approval Action Component ───────────────────────────────────────

export const ApprovalActions = ({ stepId, onApprovalComplete }) => {
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const handleApprove = async (signatureImage = null) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/v1/approval-steps/${stepId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signature_image: signatureImage })
      });
      
      if (response.ok) {
        alert('Approved successfully!');
        onApprovalComplete?.();
      }
    } catch (error) {
      console.error('Failed to approve:', error);
      alert('Error approving');
    } finally {
      setLoading(false);
    }
  };
  
  const handleReject = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/v1/approval-steps/${stepId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectReason })
      });
      
      if (response.ok) {
        alert('Rejected');
        onApprovalComplete?.();
      }
    } catch (error) {
      console.error('Failed to reject:', error);
      alert('Error rejecting');
    } finally {
      setLoading(false);
      setShowRejectModal(false);
    }
  };
  
  return (
    <div className="flex gap-3">
      <button
        onClick={() => handleApprove()}
        disabled={loading}
        className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
      >
        ✓ Approve
      </button>
      
      <button
        onClick={() => setShowRejectModal(true)}
        disabled={loading}
        className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
      >
        ✕ Reject
      </button>
      
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Reject Document</h3>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Reason for rejection..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-4 h-24"
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowRejectModal(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkflowStatusTracker;
