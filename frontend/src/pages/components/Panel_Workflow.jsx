/**
 * ============================================================
 * FILE: Panel_Workflow.jsx
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

import React, { useState, useEffect, useCallback } from "react";
import { CheckCircleIcon, ExclamationTriangleIcon, XMarkIcon } from "@heroicons/react/24/outline";
import api from "../../services/api";
import { formatDateTime } from "../../utils/dateFormatters";

// ─ Main Component ────────────────────────────────────────────────────

export const WorkflowModal = ({ documentId, onClose, onAssigned }) => {
  const [workflows, setWorkflows] = useState([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchWorkflows = useCallback(async () => {
    try {
      const response = await api.get("/workflows");
      setWorkflows(response?.data ?? []);
    } catch (error) {
      console.error("Failed to load workflows:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWorkflows();
  }, [fetchWorkflows]);

  const handleAssignWorkflow = async () => {
    if (!selectedWorkflow) return;

    try {
      await api.post(`/documents/${documentId}/assign-workflow`, {
        workflow_template_id: selectedWorkflow.id,
      });
      onAssigned?.();
      onClose();
    } catch (error) {
      console.error("Failed to assign workflow:", error);
    }
  };

  return (
    <div className="bg-black/50 fixed flex inset-0 items-center justify-center p-1 z-50">
      <div className="bg-white max-w-lg rounded-lg shadow-xl w-full">
        <div className="border-b flex items-center justify-between p-1">
          <h2 className="font-semibold text-gray-900 text-xl">Assign Workflow</h2>
          <button onClick={onClose} className="hover:text-gray-700 text-gray-500">
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <div className="p-1">
          {loading ? (
            <p className="text-gray-600">Loading workflows...</p>
          ) : workflows.length === 0 ? (
            <p className="text-gray-600">No workflows available. Create one first.</p>
          ) : (
            <div className="space-y-3">
              {workflows.map((wf) => (
                <label key={wf.id} className="border cursor-pointer flex gap-3 hover:bg-gray-50 items-start p-1 rounded-lg">
                  <input type="radio" name="workflow" value={wf.id} checked={selectedWorkflow?.id === wf.id} onChange={() => setSelectedWorkflow(wf)} className="mt-1" />
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900">{wf.name}</h3>
                    <p className="text-gray-600 text-sm">{wf.description}</p>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="bg-gray-50 border-t flex gap-3 justify-end p-1">
          <button onClick={onClose} className="border border-gray-300 hover:bg-gray-100 px-1 py-0 rounded-lg text-gray-700">
            Cancel
          </button>
          <button onClick={handleAssignWorkflow} disabled={!selectedWorkflow} className="bg-blue-600 disabled:opacity-50 hover:bg-blue-700 px-1 py-0 rounded-lg text-white">
            Assign Workflow
          </button>
        </div>
      </div>
    </div>
  );
};

// ─ Workflow Status Tracker ─────────────────────────────────────────

export const WorkflowStatusTracker = ({ documentId, currentUserId, onWorkflowUpdated }) => {
  const [workflow, setWorkflow] = useState(null);
  const [steps, setSteps] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadWorkflow = useCallback(async () => {
    try {
      const [wfRes, stepsRes] = await Promise.all([api.get(`/documents/${documentId}/workflow`), api.get(`/documents/${documentId}/workflow-steps`)]);

      setWorkflow(wfRes?.data ?? null);
      setSteps(stepsRes?.data ?? []);
    } catch (error) {
      console.error("Failed to load workflow:", error);
    } finally {
      setLoading(false);
    }
  }, [documentId]);

  useEffect(() => {
    loadWorkflow();
  }, [loadWorkflow]);

  if (loading) return <div>Loading workflow...</div>;
  if (!workflow) return null;

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 flex items-center justify-between p-1 rounded-lg">
        <h3 className="font-semibold text-gray-900">Workflow Progress</h3>
        <span className="bg-blue-100 font-medium px-1 py-1 rounded-full text-blue-700 text-sm">{workflow.status}</span>
      </div>

      <div className="space-y-3">
        {steps.map((step, idx) => (
          <div key={step.id} className="flex gap-4 items-start">
            {/* Status indicator */}
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${step.action === "approved" ? "bg-green-600" : step.action === "rejected" ? "bg-red-600" : step.action === "pending" ? "bg-yellow-600" : "bg-gray-400"}`}>
                {step.action === "approved" ? "✓" : step.action === "rejected" ? "✕" : step.action === "pending" ? "⏱" : "○"}
              </div>
              {idx < steps.length - 1 && <div className="bg-gray-300 h-8 mt-1 w-0.5"></div>}
            </div>

            {/* Step details */}
            <div className="flex-1">
              <h4 className="font-medium text-gray-900">{step.stage_name}</h4>
              <p className="text-gray-600 text-sm">Assigned to {step.assigned_to_user_id}</p>
              {step.assigned_at && <p className="text-gray-500 text-xs">Assigned {formatDateTime(step.assigned_at)}</p>}
              {step.action_at && (
                <p className="text-gray-500 text-xs">
                  {step.action === "approved" ? "Approved" : "Rejected"} {formatDateTime(step.action_at)}
                </p>
              )}
              {step.action_reason && <p className="mt-1 text-red-900 text-sm">Reason: {step.action_reason}</p>}
              {step.action === "pending" && currentUserId && String(step.assigned_to_user_id) === String(currentUserId) && (
                <div className="mt-3">
                  <ApprovalActions
                    stepId={step.id}
                    onApprovalComplete={() => {
                      loadWorkflow();
                      onWorkflowUpdated?.();
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {workflow.status === "approved" && (
        <div className="bg-green-50 border border-green-200 flex gap-2 p-1 rounded-lg">
          <CheckCircleIcon className="flex-shrink-0 h-5 text-green-600 w-5" />
          <p className="text-green-900 text-sm">Document workflow approved</p>
        </div>
      )}

      {workflow.status === "rejected" && (
        <div className="bg-red-50 border border-red-200 flex gap-2 p-1 rounded-lg">
          <ExclamationTriangleIcon className="flex-shrink-0 h-5 text-red-600 w-5" />
          <div>
            <p className="font-medium text-red-900 text-sm">Document rejected</p>
            {workflow.rejection_reason && <p className="text-red-800 text-sm">Reason: {workflow.rejection_reason}</p>}
          </div>
        </div>
      )}
    </div>
  );
};

// ─ Approval Action Component ───────────────────────────────────────

export const ApprovalActions = ({ stepId, onApprovalComplete }) => {
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleApprove = async (signatureImage = null) => {
    setLoading(true);
    try {
      await api.post(`/approval-steps/${stepId}/approve`, { signature_image: signatureImage });
      onApprovalComplete?.();
    } catch (error) {
      console.error("Failed to approve:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    setLoading(true);
    try {
      await api.post(`/approval-steps/${stepId}/reject`, { reason: rejectReason });
      onApprovalComplete?.();
    } catch (error) {
      console.error("Failed to reject:", error);
    } finally {
      setLoading(false);
      setShowRejectModal(false);
    }
  };

  return (
    <div className="flex gap-3">
      <button onClick={() => handleApprove()} disabled={loading} className="bg-green-600 disabled:opacity-50 flex-1 hover:bg-green-700 px-1 py-0 rounded-lg text-white">
        ✓ Approve
      </button>

      <button onClick={() => setShowRejectModal(true)} disabled={loading} className="bg-red-600 disabled:opacity-50 flex-1 hover:bg-red-700 px-1 py-0 rounded-lg text-white">
        ✕ Reject
      </button>

      {showRejectModal && (
        <div className="bg-black/50 fixed flex inset-0 items-center justify-center z-50">
          <div className="bg-white max-w-sm p-1 rounded-lg shadow-xl">
            <h3 className="font-semibold mb-4 text-gray-900 text-lg">Reject Document</h3>
            <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Reason for rejection..." className="border border-gray-300 h-24 mb-4 px-1 py-0 rounded-lg w-full" />
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowRejectModal(false)} className="border border-gray-300 hover:bg-gray-100 px-1 py-0 rounded-lg text-gray-700">
                Cancel
              </button>
              <button onClick={handleReject} className="bg-red-600 hover:bg-red-700 px-1 py-0 rounded-lg text-white">
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
