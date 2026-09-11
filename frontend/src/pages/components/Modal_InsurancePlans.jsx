/*
 * Full-screen modal for managing insurance plans and linking shared plan documents.
 */
import React, { useEffect, useState } from "react";
import Modal from "./Modal";
import { XMarkIcon, CheckIcon, PencilSquareIcon, DocumentTextIcon, LinkIcon } from "@heroicons/react/24/outline";
import Button_Toolbar from "./Button_Toolbar";
import { documentsAPI } from "../../services/api";
import Modal_DocumentUpload from "./Modal_DocumentUpload";
import Modal_Viewer_Document from "./Modal_DocumentView";
import Button_InsuranceDocument from "./Button_InsuranceDocument";
import Footer_Actions from "./Footer_Actions";
import Dropdown_Custom from "./Dropdown_Custom";

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
      <form onSubmit={onSave} className="ui-component-shell d-flex flex-column h-100 min-h-0">
        <div className="component-header">
          <div className="component-header-left">Insurance Plans</div>
          <div className="component-header-center"></div>
          <div className="component-header-right"></div>
        </div>

        <div className="component-body">
          <div className="component-body-inner">
          {insuranceError && (
            <div className="alert alert-danger alert-sm mb-2 px-1 py-0" style={{ fontSize: "0.8rem" }}>
              {insuranceError}
            </div>
          )}
          {insurancePlansLoading ? (
            <div className="py-1 text-center">
              <div className="spinner-border spinner-border-sm text-primary" role="status" />
            </div>
          ) : insurancePlans.length === 0 ? (
            <p className="py-1 small text-center text-muted">No insurance plans yet. Add one below.</p>
          ) : (
            <div className="d-flex flex-column gap-2 pb-0">
              {insurancePlans.map((plan) => (
                <div key={plan.id} className={`d-flex align-items-center gap-2 p-0 border rounded ${!plan.is_active ? "opacity-60" : ""}`}>
                  <button type="button" className="btn btn-bulk-circle btn-outline-danger flex-shrink-0" onClick={() => onDelete(plan.id)} title="Delete plan">
                    <XMarkIcon style={{ width: 16, height: 16 }} />
                  </button>
                  {plan.document_id && (
                    <Button_InsuranceDocument documentId={plan.document_id} insurancePlans={insurancePlans} title="View plan document" />
                  )}
                  <div className="flex-grow-1 min-w-0">
                    <div className="align-items-center d-flex flex-wrap fw-semibold gap-2" style={{ fontSize: "0.875rem" }}>
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
                  <div className="d-flex flex-shrink-0 gap-1">
                    <button type="button" className="btn ui-btn-outline-secondary-sm" style={{ fontSize: "0.75rem", padding: "0.2rem 0.5rem" }} onClick={() => onToggle(plan)} title={plan.is_active ? "Deactivate" : "Activate"}>
                      {plan.is_active ? "Deactivate" : "Activate"}
                    </button>
                    <button type="button" className="btn btn-bulk-circle btn-outline-secondary" onClick={() => setEditingPlan({ ...plan })} title="Edit plan">
                      <PencilSquareIcon style={{ width: 16, height: 16 }} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ─── Create / Edit Form ───────────────────────────────────────── */}
          <div className="border-top d-flex flex-column gap-2 mt-2 pt-1">
            <div className="fw-semibold small text-muted">{editingPlan ? "Edit Plan" : "New Plan"}</div>
            <div className="row ui-row-g2">
              <div className="col-6">
                <div className="form-floating">
                  <input
                    type="text"
                    id="ins_plan_name"
                    className="form-control ui-control-sm"
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
                    className="form-control ui-control-sm"
                    placeholder="Description"
                    value={editingPlan ? editingPlan.description || "" : newPlan.description}
                    onChange={(e) => (editingPlan ? setEditingPlan((prev) => ({ ...prev, description: e.target.value })) : setNewPlan((prev) => ({ ...prev, description: e.target.value })))}
                  />
                  <label htmlFor="ins_plan_desc">Description</label>
                </div>
              </div>
            </div>

            <div className="border p-0 rounded">
              <div className="fw-semibold mb-2 small text-muted">Plan document (shared by all employees on this plan)</div>
              {(editingPlan?.document_id || newPlan?.document_id) ? (
                <div className="align-items-center d-flex flex-wrap gap-2">
                  <span className="flex-grow-1 small text-truncate">{linkedDocLabel(editingPlan?.document_id || newPlan?.document_id)}</span>
                  <button type="button" className="btn btn-bulk-circle btn-outline-secondary" onClick={() => openViewer(editingPlan?.document_id || newPlan?.document_id)} title="View document">
                    <DocumentTextIcon style={{ width: 16, height: 16 }} />
                  </button>
                  <button type="button" className="btn ui-btn-outline-secondary-sm" onClick={() => setPlanDocumentId(null)}>
                    Unlink
                  </button>
                </div>
              ) : (
                <p className="mb-2 ui-small-muted">No document linked.</p>
              )}
              <div className="align-items-center d-flex flex-wrap gap-2">
                <Dropdown_Custom
                  className="form-select ui-control-sm"
                  style={{ maxWidth: "14rem" }}
                  value={editingPlan?.document_id || newPlan?.document_id || ""}
                  onChange={(e) => setPlanDocumentId(e.target.value || null)}
                  options={[
                    { value: "", label: "Link existing document…" },
                    ...documents.map((doc) => ({ value: doc.id, label: doc.original_filename || doc.filename })),
                  ]}
                />
                <button
                  type="button"
                  className="align-items-center btn btn-outline-primary btn-sm d-inline-flex gap-1"
                  disabled={!editingPlan?.id}
                  onClick={() => setShowDocUpload(true)}
                  title={editingPlan?.id ? "Upload and link a new document" : "Save the plan first, then edit to upload"}
                >
                  <LinkIcon style={{ width: 14, height: 14 }} />
                  Link
                </button>
              </div>
              {!editingPlan?.id && <p className="mb-0 mt-1 small text-muted">Save a new plan before uploading a document.</p>}
            </div>

          </div>{/* /create-edit form */}
          </div>{/* /component-body-inner */}
        </div>{/* /component-body */}

        <div className="app-footer-padding app-form-footer app-standard-footer ui-form-footer-shell">
          <Footer_Actions
            start={<Button_Toolbar type="submit" icon={CheckIcon} label={editingPlan ? "Save" : "Add"} className="btn-outline-secondary" title={editingPlan ? "Save plan" : "Add plan"} />}
            center={
              <button
                type="button"
                onClick={editingPlan ? () => setEditingPlan(null) : onClose}
                className="btn ui-btn-circle-outline-secondary"
                title={editingPlan ? "Cancel edit" : "Close"}
              >
                <XMarkIcon />
              </button>
            }
          />
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
