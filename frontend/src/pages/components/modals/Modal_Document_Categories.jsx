// FILE: Modal_Document_Categories.jsx
// Dedicated modal for managing document categories
import React from "react";
import { CheckIcon, XMarkIcon, PencilSquareIcon, TrashIcon } from "@heroicons/react/24/outline";
import Modal from "./Modal";
import Button_Toolbar from "../buttons/Button_Toolbar";
import Footer_Actions from "../footers/Footer_Actions";

export default function Modal_Document_Categories({
  isOpen,
  onClose,
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
}) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        onClose();
        cancelEditCategory?.();
      }}
      title="Manage Categories"
    >
      <div className="bg-white d-flex dark:bg-gray-900 flex-column">
        {/* Scrollable list */}
        <div className="flex-grow-1 min-h-0 no-scrollbar overflow-auto pt-0 px-1">
          {categories.length === 0 ? (
            <p className="py-1 small text-center text-muted">No categories yet. Add one below.</p>
          ) : (
            <div className="d-flex flex-column gap-2 pb-0">
              {sortedCategories.map((cat) => (
                <div key={cat.id} className="align-items-center border d-flex justify-content-between p-0 rounded">
                  {/* Name + description (or inline edit inputs) */}
                  <div className="flex-grow-1 me-2" style={{ minWidth: 0 }}>
                    {editingCatId === cat.id ? (
                      <div className="d-flex gap-2">
                        <input className="form-control ui-control-sm" value={editingCatName} onChange={(e) => setEditingCatName(e.target.value)} placeholder="Name" />
                        <input className="form-control ui-control-sm" value={editingCatDesc} onChange={(e) => setEditingCatDesc(e.target.value)} placeholder="Description" />
                      </div>
                    ) : (
                      <>
                        <div className="fw-semibold" style={{ fontSize: "0.875rem" }}>
                          {cat.name}
                        </div>
                        {cat.description && (
                          <div className="text-muted" style={{ fontSize: "0.78rem" }}>
                            {cat.description}
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="d-flex flex-shrink-0 gap-1">
                    {editingCatId === cat.id ? (
                      <>
                        <button type="button" className="btn btn-outline-success btn-sm" style={{ padding: "0.2rem 0.4rem" }} onClick={() => saveEditCategory(cat.id)} title="Save">
                          <CheckIcon style={{ width: 14, height: 14 }} />
                        </button>
                        <button type="button" className="btn ui-btn-outline-secondary-sm" style={{ padding: "0.2rem 0.4rem" }} onClick={cancelEditCategory} title="Cancel">
                          <XMarkIcon style={{ width: 14, height: 14 }} />
                        </button>
                      </>
                    ) : (
                      <>
                        <button type="button" className="btn ui-btn-outline-secondary-sm" style={{ padding: "0.2rem 0.4rem" }} onClick={() => startEditCategory(cat)} title="Edit">
                          <PencilSquareIcon style={{ width: 14, height: 14 }} />
                        </button>
                        <button type="button" className="btn btn-bulk-circle btn-outline-danger btn-sm p-0" onClick={() => handleDeleteCategory(cat.id)} title="Delete">
                          <TrashIcon style={{ width: 14, height: 14 }} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer — Add / Edit form */}
        <div className="app-footer-padding app-form-footer bg-white border-gray-200 border-top dark:bg-gray-900 dark:border-gray-700 flex-shrink-0">
          <form onSubmit={handleCreateCategory} className="d-flex flex-column gap-2">
            <div className="fw-semibold small text-muted">New Category</div>
            <div className="row ui-row-g2">
              <div className="col-6">
                <div className="form-floating">
                  <input type="text" id="newCatName" className="form-control ui-control-sm" placeholder="Category Name" value={newCatName} onChange={(e) => setNewCatName(e.target.value)} required />
                  <label htmlFor="newCatName">Category Name *</label>
                </div>
              </div>
              <div className="col-6">
                <div className="form-floating">
                  <input type="text" id="newCatDesc" className="form-control ui-control-sm" placeholder="Description" value={newCatDesc} onChange={(e) => setNewCatDesc(e.target.value)} />
                  <label htmlFor="newCatDesc">Description</label>
                </div>
              </div>
            </div>
            <Footer_Actions
              start={
                <Button_Toolbar type="submit" icon={CheckIcon} label="Add" className="btn-primary" title="Add category" />
              }
              center={
                <Button_Toolbar
                  icon={XMarkIcon}
                  label="Close"
                  onClick={() => {
                    onClose();
                    cancelEditCategory?.();
                  }}
                  className="btn-outline-secondary"
                  title="Close"
                />
              }
            />
          </form>
        </div>
      </div>
    </Modal>
  );
}
