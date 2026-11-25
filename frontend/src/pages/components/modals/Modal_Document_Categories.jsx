// FILE: Modal_Document_Categories.jsx
// Dedicated modal for managing document categories
import React, { useState } from "react";
import { InputText } from "../Inputs";
import { CheckIcon, PlusIcon, XMarkIcon } from "../../../icons";
import Modal from "./Modal";
import Button_Toolbar from "../buttons/Button_Toolbar";
import SettingsMasterDetail, { SettingsMasterDetailTable } from "../layout/Settings_MasterDetail";

export default function Modal_Document_Categories({
  isOpen,
  onClose,
  container,
  categories = [],
  sortedCategories = [],
  editingCatId,
  editingCatName,
  setEditingCatName,
  editingCatDesc,
  setEditingCatDesc,
  startEditCategory,
  saveEditCategory,
  cancelEditCategory,
  handleDeleteCategory,
  newCatName,
  setNewCatName,
  newCatDesc,
  setNewCatDesc,
  handleCreateCategory,
  loading = false,
  error = "",
}) {
  const [creating, setCreating] = useState(false);
  const closeManager = () => {
    setCreating(false);
    onClose();
    cancelEditCategory?.();
  };
  const closeDetail = () => {
    setCreating(false);
    cancelEditCategory?.();
  };

  return (
    <Modal
      isOpen={isOpen}
      container={container}
      onClose={closeManager}
      title="Manage Categories"
      noPadding
      contentGravity="bottom"
      footer={creating ? (
        <>
          <Button_Toolbar type="submit" form="new-document-category-form" icon={CheckIcon} label="Add" className="btn-primary" title="Add category" />
          <Button_Toolbar icon={XMarkIcon} label="" onClick={closeDetail} className="btn-outline-secondary" title="Cancel" />
        </>
      ) : editingCatId ? (
        <>
          <Button_Toolbar type="submit" form="edit-document-category-form" icon={CheckIcon} label="Save" className="btn-primary" title="Save category" />
          <Button_Toolbar icon={XMarkIcon} label="" onClick={closeDetail} className="btn-outline-secondary" title="Cancel" />
        </>
      ) : (
        <>
          <Button_Toolbar icon={PlusIcon} label="Add" onClick={() => { cancelEditCategory?.(); setCreating(true); }} className="btn-primary" title="Add category" />
          <Button_Toolbar icon={XMarkIcon} label="" onClick={closeManager} className="btn-outline-secondary" title="Cancel" />
        </>
      )}
    >
      <div className="d-flex flex-column h-100 min-h-0 p-2">
        {error && <div className="alert alert-danger py-2 mb-2" role="alert">{error}</div>}
        <SettingsMasterDetail
          detailOpen={creating || Boolean(editingCatId)}
          onBack={closeDetail}
          list={
            <div className="d-flex flex-column h-100 min-h-0">
              <div className="mb-2">
                <h5 className="mb-0">Categories</h5>
              </div>
              <SettingsMasterDetailTable
                columns={[
                  { label: "", style: { width: 48 } },
                  { label: "Category" },
                  { label: "Description" },
                ]}
              >
                {loading ? (
                  <tr><td colSpan={3} className="py-2 small text-center text-muted">Loading categories…</td></tr>
                ) : categories.length === 0 ? (
                  <tr><td colSpan={3} className="py-2 small text-center text-muted">No categories yet.</td></tr>
                ) : sortedCategories.map((cat) => (
                  <tr key={cat.id} className={editingCatId === cat.id ? "table-primary" : ""}>
                    <td className="text-center">
                      <button type="button" className="btn btn-bulk-circle btn-outline-danger btn-sm p-0" onClick={() => handleDeleteCategory(cat.id)} title="Delete category">
                        <XMarkIcon style={{ width: 14, height: 14 }} />
                      </button>
                    </td>
                    <td>
                      <button type="button" className="btn btn-link fw-medium p-0 text-body text-start text-decoration-none" onClick={() => { setCreating(false); startEditCategory(cat); }}>
                        {cat.name}
                      </button>
                    </td>
                    <td className="text-muted">{cat.description || "—"}</td>
                  </tr>
                ))}
              </SettingsMasterDetailTable>
            </div>
          }
          detail={
            creating ? (
              <form id="new-document-category-form" onSubmit={handleCreateCategory} className="d-flex flex-column gap-3">
                <h5 className="mb-0">New Category</h5>
                <div className="form-floating">
                  <InputText id="newCatName" className="form-control" placeholder="Category Name" value={newCatName} onChange={(e) => setNewCatName(e.target.value)} required />
                  <label htmlFor="newCatName">Category Name *</label>
                </div>
                <div className="form-floating">
                  <InputText id="newCatDesc" className="form-control" placeholder="Description" value={newCatDesc} onChange={(e) => setNewCatDesc(e.target.value)} />
                  <label htmlFor="newCatDesc">Description</label>
                </div>
              </form>
            ) : editingCatId ? (
              <form id="edit-document-category-form" onSubmit={(event) => { event.preventDefault(); saveEditCategory(editingCatId); }} className="d-flex flex-column gap-3">
                <h5 className="mb-0">Edit Category</h5>
                <div className="form-floating">
                  <InputText id="editCatName" className="form-control" value={editingCatName} onChange={(e) => setEditingCatName(e.target.value)} placeholder="Name" required />
                  <label htmlFor="editCatName">Name *</label>
                </div>
                <div className="form-floating">
                  <InputText id="editCatDesc" className="form-control" value={editingCatDesc} onChange={(e) => setEditingCatDesc(e.target.value)} placeholder="Description" />
                  <label htmlFor="editCatDesc">Description</label>
                </div>
              </form>
            ) : (
              <div className="align-items-center d-flex h-100 justify-content-center text-muted">Select a category or create a new one.</div>
            )
          }
        />
      </div>
    </Modal>
  );
}
