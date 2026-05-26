/*
 * Full-screen modal for managing insurance plans and linking shared plan documents.
 */
import React, { useEffect, useState } from "react";
import Modal from "./Modal";
import { XMarkIcon, CheckIcon, PencilSquareIcon, TrashIcon, DocumentTextIcon, LinkIcon } from "@heroicons/react/24/outline";
import Button_Toolbar from "./Button_Toolbar";
import { documentsAPI } from "../../services/api";
import Modal_DocumentUpload from "./Modal_DocumentUpload";
import Modal_Viewer_Document from "./Modal_DocumentView";
import Button_InsuranceDocument from "./Button_InsuranceDocument";

export default function Modal_InsurancePlans({
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
  const [documents, setDocuments] = useState([]);
  const [showDocUpload, setShowDocUpload] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerDoc, setViewerDoc] = useState(null);

  const activePlan = editingPlan || null;

  useEffect(() => {
    if (!isOpen) return;
    documentsAPI
      .getAll()
      .then((res) => {
        const data = res?.data;
        setDocuments(Array.isArray(data) ? data : []);
      })
      .catch(() => setDocuments([]));
  }, [isOpen]);

  const openViewer = async (documentId) => {
    if (!documentId) return;
    try {
      const res = await documentsAPI.getById(documentId);
      const doc = res?.data ?? res;
      if (doc?.id) {
        setViewerDoc(doc);
        setViewerOpen(true);
      }
    } catch (err) {
      console.error("Failed to load document:", err);
    }
  };

  const setPlanDocumentId = (documentId) => {
    if (editingPlan) {
      setEditingPlan((prev) => ({ ...prev, document_id: documentId || null }));
    } else {
      setNewPlan((prev) => ({ ...prev, document_id: documentId || null }));
    }
  };

  const linkedDocLabel = (documentId) => {
    if (!documentId) return null;
    const doc = documents.find((d) => String(d.id) === String(documentId));
    return doc?.original_filename || doc?.filename || "Linked document";
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        onClose();
        setEditingPlan(null);
      }}
      noPadding
      fullScreen
    >
      <form onSubmit={onSave} className="component h-100 min-h-0">
        <div className="component-header">
          <div className="component-header-left">Insurance Plans</div>
          <div className="component-header-center"></div>
          <div className="component-header-right"></div>
        </div>

        <div className="component-body">
          <div className="component-body-inner">
          {insuranceError && (
            <div className="alert alert-danger alert-sm py-2 px-3 mb-2" style={{ fontSize: "0.8rem" }}>
              {insuranceError}
            </div>
          )}
          {insurancePlansLoading ? (
            <div className="text-center py-4">
              <div className="spinner-border spinner-border-sm text-primary" role="status" />
            </div>
          ) : insurancePlans.length === 0 ? (
            <p className="text-muted small text-center py-4">No insurance plans yet. Add one below.</p>
          ) : (
            <div className="d-flex flex-column gap-2 pb-2">
              {insurancePlans.map((plan) => (
                <div key={plan.id} className={`d-flex align-items-center gap-2 p-2 border rounded ${!plan.is_active ? "opacity-60" : ""}`}>
                  <button type="button" className="btn btn-outline-danger btn-bulk-circle flex-shrink-0" onClick={() => onDelete(plan.id)} title="Delete plan">
                    <TrashIcon style={{ width: 16, height: 16 }} />
                  </button>
                  {plan.document_id && (
                    <Button_InsuranceDocument documentId={plan.document_id} insurancePlans={insurancePlans} title="View plan document" />
                  )}
                  <div className="min-w-0 flex-grow-1">
                    <div className="fw-semibold d-flex align-items-center gap-2 flex-wrap" style={{ fontSize: "0.875rem" }}>
                      {plan.name}
                      <span className="badge bg-secondary" style={{ fontSize: "0.65rem" }}>
                        {plan.is_active ? "Active" : "Inactive"}
                      </span>
                    </div>
                    {plan.description && (
                      <div className="text-muted text-truncate" style={{ fontSize: "0.78rem" }}>
                        {plan.description}
                      </div>
                    )}
                    {plan.document_id && (
                      <div className="text-muted text-truncate" style={{ fontSize: "0.72rem" }}>
                        Doc: {linkedDocLabel(plan.document_id)}
                      </div>
                    )}
                  </div>
                  <div className="d-flex gap-1 flex-shrink-0">
                    <button type="button" className="btn btn-sm btn-outline-secondary" style={{ fontSize: "0.75rem", padding: "0.2rem 0.5rem" }} onClick={() => onToggle(plan)} title={plan.is_active ? "Deactivate" : "Activate"}>
                      {plan.is_active ? "Deactivate" : "Activate"}
                    </button>
                    <button type="button" className="btn btn-outline-secondary btn-bulk-circle" onClick={() => setEditingPlan({ ...plan })} title="Edit plan">
                      <PencilSquareIcon style={{ width: 16, height: 16 }} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ─── Create / Edit Form ───────────────────────────────────────── */}
          <div className="border-top pt-3 mt-2 d-flex flex-column gap-2">
            <div className="small fw-semibold text-muted">{editingPlan ? "Edit Plan" : "New Plan"}</div>
            <div className="row g-2">
              <div className="col-6">
                <div className="form-floating">
                  <input
                    type="text"
                    id="ins_plan_name"
                    className="form-control form-control-sm"
                    placeholder="Plan name"
                    value={editingPlan ? editingPlan.name : newPlan.name}
                    onChange={(e) => (editingPlan ? setEditingPlan((prev) => ({ ...prev, name: e.target.value })) : setNewPlan((prev) => ({ ...prev, name: e.target.value })))}
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
                    value={editingPlan ? editingPlan.description || "" : newPlan.description}
                    onChange={(e) => (editingPlan ? setEditingPlan((prev) => ({ ...prev, description: e.target.value })) : setNewPlan((prev) => ({ ...prev, description: e.target.value })))}
                  />
                  <label htmlFor="ins_plan_desc">Description</label>
                </div>
              </div>
            </div>

            <div className="border rounded p-2">
              <div className="small fw-semibold text-muted mb-2">Plan document (shared by all employees on this plan)</div>
              {(editingPlan?.document_id || newPlan?.document_id) ? (
                <div className="d-flex align-items-center gap-2 flex-wrap">
                  <span className="small text-truncate flex-grow-1">{linkedDocLabel(editingPlan?.document_id || newPlan?.document_id)}</span>
                  <button type="button" className="btn btn-outline-secondary btn-bulk-circle" onClick={() => openViewer(editingPlan?.document_id || newPlan?.document_id)} title="View document">
                    <DocumentTextIcon style={{ width: 16, height: 16 }} />
                  </button>
                  <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setPlanDocumentId(null)}>
                    Unlink
                  </button>
                </div>
              ) : (
                <p className="small text-muted mb-2">No document linked.</p>
              )}
              <div className="d-flex flex-wrap gap-2 align-items-center">
                <select
                  className="form-select form-select-sm"
                  style={{ maxWidth: "14rem" }}
                  value={editingPlan?.document_id || newPlan?.document_id || ""}
                  onChange={(e) => setPlanDocumentId(e.target.value || null)}
                >
                  <option value="">Link existing document…</option>
                  {documents.map((doc) => (
                    <option key={doc.id} value={doc.id}>
                      {doc.original_filename || doc.filename}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1"
                  disabled={!editingPlan?.id}
                  onClick={() => setShowDocUpload(true)}
                  title={editingPlan?.id ? "Upload and link a new document" : "Save the plan first, then edit to upload"}
                >
                  <LinkIcon style={{ width: 14, height: 14 }} />
                  Link
                </button>
              </div>
              {!editingPlan?.id && <p className="small text-muted mb-0 mt-1">Save a new plan before uploading a document.</p>}
            </div>

          </div>{/* /create-edit form */}
          </div>{/* /component-body-inner */}
        </div>{/* /component-body */}

        <div className="component-footer">
          <div className="component-footer-left">
            <Button_Toolbar type="submit" icon={CheckIcon} label={editingPlan ? "Save" : "Add"} className="btn-outline-secondary" title={editingPlan ? "Save plan" : "Add plan"} />
          </div>
          <div className="component-footer-center">
            <button
              type="button"
              onClick={editingPlan ? () => setEditingPlan(null) : onClose}
              className="btn btn-circle btn-outline-secondary"
              title={editingPlan ? "Cancel edit" : "Close"}
            >
              <XMarkIcon />
            </button>
          </div>
          <div className="component-footer-right"></div>
        </div>
      </form>

      <Modal_DocumentUpload
        isOpen={showDocUpload}
        onClose={() => setShowDocUpload(false)}
        entityType="insurance_plan"
        entityId={editingPlan?.id}
        title="Upload insurance plan document"
        onUploaded={(doc) => {
          const id = doc?.id ?? doc?.data?.id;
          if (id) setPlanDocumentId(id);
          documentsAPI.getAll().then((res) => setDocuments(Array.isArray(res?.data) ? res.data : []));
        }}
      />

      <Modal_Viewer_Document isOpen={viewerOpen} onClose={() => { setViewerOpen(false); setViewerDoc(null); }} document={viewerDoc} />
    </Modal>
  );
}
