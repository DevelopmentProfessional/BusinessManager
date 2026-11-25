/*
 * Bottom-sheet manager for managing insurance plans and linking shared plan documents.
 *
 * CHANGE LOG
 * 2026-11-15 | GitHub Copilot | Aligned the modal footer with the shared component hierarchy.
 */
import React, { useEffect, useState } from "react";
import Modal from "./Modal";
import { XMarkIcon, CheckIcon, PlusIcon, LinkIcon, DocumentTextIcon } from "../../../icons";
import Button_Toolbar from "../buttons/Button_Toolbar";
import { documentsAPI } from "../../../services/api";
import Modal_DocumentUpload from "./Modal_DocumentUpload";
import Modal_Viewer_Document from "./Modal_DocumentView";
import Button_InsuranceDocument from "../buttons/Button_InsuranceDocument";
import Dropdown_Custom from "../dropdowns/Dropdown_Custom";
import { InputText, InputTextarea } from "../Inputs";
import Field_Floating from "../fields/Field_Floating";
import { LoadingSpinner } from "../feedback";
import SettingsMasterDetail, { SettingsMasterDetailTable } from "../layout/Settings_MasterDetail";

export default function Modal_InsurancePlans({
  isOpen,
  onClose,
  container,
  insurancePlans = [],
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
  const [creating, setCreating] = useState(false);
  const [documents, setDocuments] = useState([]);
  const [showDocUpload, setShowDocUpload] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerDoc, setViewerDoc] = useState(null);
  const detailOpen = creating || Boolean(editingPlan);
  const closeDetail = () => {
    setCreating(false);
    setEditingPlan(null);
  };
  const closeManager = () => {
    closeDetail();
    onClose();
  };

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

  useEffect(() => {
    if (editingPlan?.id && !insurancePlans.some((plan) => String(plan.id) === String(editingPlan.id))) {
      setEditingPlan(null);
    }
  }, [editingPlan?.id, insurancePlans, setEditingPlan]);

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
      container={container}
      onClose={closeManager}
      noPadding
      contentGravity="bottom"
      title="Insurance Plans"
      footer={detailOpen ? (
        <>
          <Button_Toolbar type="submit" form="insurance-plan-form" icon={CheckIcon} label={editingPlan ? "Save" : "Add"} className="btn-primary" title={editingPlan ? "Save plan" : "Add plan"} />
          <Button_Toolbar icon={XMarkIcon} label="" onClick={closeDetail} className="btn-outline-secondary" title="Cancel" />
        </>
      ) : (
        <>
          <Button_Toolbar icon={PlusIcon} label="Add" onClick={() => { setEditingPlan(null); setCreating(true); }} className="btn-primary" title="Add insurance plan" />
          <Button_Toolbar icon={XMarkIcon} label="" onClick={closeManager} className="btn-outline-secondary" title="Cancel" />
        </>
      )}
    >
      <form id="insurance-plan-form" onSubmit={onSave} className="ui-component-shell d-flex flex-column h-100 min-h-0">
        <div className="component-body h-100">
          <div className="component-body-inner h-100">
            {insuranceError && <div className="alert alert-danger alert-sm mb-2 px-1 py-0" role="alert">{insuranceError}</div>}
            <SettingsMasterDetail
              detailOpen={detailOpen}
              onBack={closeDetail}
              list={
                <div className="d-flex flex-column h-100 min-h-0">
                  <div className="mb-2">
                    <h5 className="mb-0">Plans</h5>
                  </div>
                  <SettingsMasterDetailTable
                    columns={[
                      { label: "", style: { width: 48 } },
                      { label: "Plan" },
                      { label: "Status" },
                      { label: "Document" },
                      { label: "", style: { width: 160 } },
                    ]}
                  >
                    {insurancePlansLoading ? (
                      <tr><td colSpan={5} className="text-center py-2"><LoadingSpinner label="Loading insurance plans" size="sm" /></td></tr>
                    ) : insurancePlans.length === 0 ? (
                      <tr><td colSpan={5} className="text-center text-muted py-2">No insurance plans yet. Add one to get started.</td></tr>
                    ) : insurancePlans.map((plan) => (
                      <tr key={plan.id} className={`${String(editingPlan?.id) === String(plan.id) ? "table-primary" : ""} ${!plan.is_active ? "opacity-60" : ""}`}>
                        <td className="text-center">
                          <button type="button" className="btn btn-bulk-circle btn-outline-danger" onClick={() => onDelete(plan.id)} title="Delete plan">
                            <XMarkIcon style={{ width: 14, height: 14 }} />
                          </button>
                        </td>
                        <td>
                          <button type="button" className="btn btn-link fw-medium p-0 text-start text-decoration-none" onClick={() => { setCreating(false); setEditingPlan({ ...plan }); }}>
                            {plan.name}
                          </button>
                        </td>
                        <td>{plan.is_active ? "Active" : "Inactive"}</td>
                        <td className="text-truncate" style={{ maxWidth: "10rem" }}>{plan.document_id ? linkedDocLabel(plan.document_id) : "—"}</td>
                        <td className="text-end">
                          <div className="align-items-center d-inline-flex gap-1">
                            {plan.document_id && <Button_InsuranceDocument documentId={plan.document_id} insurancePlans={insurancePlans} title="View plan document" />}
                            <button type="button" className="btn ui-btn-outline-secondary-sm" onClick={() => onToggle(plan)} title={plan.is_active ? "Deactivate" : "Activate"}>
                              {plan.is_active ? "Deactivate" : "Activate"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </SettingsMasterDetailTable>
                </div>
              }
              detail={
                <div className="d-flex flex-column gap-2 h-100 overflow-auto">
                  <div className="fw-semibold small text-muted">{editingPlan ? "Edit Plan" : "New Plan"}</div>
                  <div className="row ui-row-g2">
                    <div className="col-6">
                      <Field_Floating id="ins_plan_name" label="Plan Name *">
                        <InputText value={editingPlan ? editingPlan.name : newPlan.name} onChange={(e) => (editingPlan ? setEditingPlan((prev) => ({ ...prev, name: e.target.value })) : setNewPlan((prev) => ({ ...prev, name: e.target.value })))} required />
                      </Field_Floating>
                    </div>
                    <div className="col-6">
                      <Field_Floating id="ins_plan_desc" label="Description">
                        <InputTextarea value={editingPlan ? editingPlan.description || "" : newPlan.description} onChange={(e) => (editingPlan ? setEditingPlan((prev) => ({ ...prev, description: e.target.value })) : setNewPlan((prev) => ({ ...prev, description: e.target.value })))} rows={2} />
                      </Field_Floating>
                    </div>
                  </div>
                  <div className="border p-2 rounded">
                    <div className="fw-semibold mb-2 small text-muted">Plan document (shared by all employees on this plan)</div>
                    {(editingPlan?.document_id || newPlan?.document_id) ? (
                      <div className="align-items-center d-flex flex-wrap gap-2">
                        <span className="flex-grow-1 small text-truncate">{linkedDocLabel(editingPlan?.document_id || newPlan?.document_id)}</span>
                        <button type="button" className="btn btn-bulk-circle btn-outline-secondary" onClick={() => openViewer(editingPlan?.document_id || newPlan?.document_id)} title="View document"><DocumentTextIcon style={{ width: 16, height: 16 }} /></button>
                        <button type="button" className="btn ui-btn-outline-secondary-sm" onClick={() => setPlanDocumentId(null)}>Unlink</button>
                      </div>
                    ) : <p className="mb-2 ui-small-muted">No document linked.</p>}
                    <div className="align-items-center d-flex flex-wrap gap-2">
                      <Dropdown_Custom
                        className="form-select ui-control-sm"
                        style={{ maxWidth: "14rem" }}
                        value={editingPlan?.document_id || newPlan?.document_id || ""}
                        onChange={(e) => setPlanDocumentId(e.target.value || null)}
                        options={[{ value: "", label: "Link existing document…" }, ...documents.map((doc) => ({ value: doc.id, label: doc.original_filename || doc.filename }))]}
                      />
                      <button type="button" className="align-items-center btn btn-outline-primary btn-sm d-inline-flex gap-1" disabled={!editingPlan?.id} onClick={() => setShowDocUpload(true)} title={editingPlan?.id ? "Upload and link a new document" : "Save the plan first, then edit to upload"}>
                        <LinkIcon style={{ width: 14, height: 14 }} />Link
                      </button>
                    </div>
                    {!editingPlan?.id && <p className="mb-0 mt-1 small text-muted">Save a new plan before uploading a document.</p>}
                  </div>
                </div>
              }
            />
          </div>{/* /component-body-inner */}
        </div>{/* /component-body */}

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
