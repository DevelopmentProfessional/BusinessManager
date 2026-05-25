import React, { useState } from "react";
import { DocumentIcon, XMarkIcon, ArrowDownTrayIcon } from "@heroicons/react/24/outline";
import Modal from "./Modal";
import Button_Toolbar from "./Button_Toolbar";
import { documentsAPI } from "../../services/api";

function formatFileSize(bytes) {
  if (!bytes) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export default function Modal_DocumentUpload({ isOpen, onClose, entityType, entityId, title = "Attach document", onUploaded }) {
  const [description, setDescription] = useState("");
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [dragActive, setDragActive] = useState(false);

  const reset = () => {
    setDescription("");
    setFile(null);
    setError(null);
    setUploading(false);
    setDragActive(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file || entityId == null) {
      setError("Select a file to upload.");
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const res = await documentsAPI.upload(file, description, {
        entity_type: entityType,
        entity_id: entityId,
      });
      onUploaded?.(res?.data);
      handleClose();
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || "Upload failed.");
      setUploading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} noPadding>
      <form onSubmit={handleSubmit} className="component">
        <div className="component-header">
          <div className="component-header-left">{title}</div>
          <div className="component-header-center"></div>
          <div className="component-header-right"></div>
        </div>

        <div className="component-body">
          <div className="component-body-inner">
          <div
            className={`border border-2 border-dashed rounded p-3 text-center ${dragActive ? "border-primary bg-primary bg-opacity-10" : ""}`}
            onDragEnter={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              setDragActive(false);
            }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              setDragActive(false);
              const f = e.dataTransfer.files?.[0];
              if (f) setFile(f);
            }}
          >
            {file ? (
              <>
                <p className="small fw-medium mb-1">{file.name}</p>
                <p className="text-muted small mb-2">{formatFileSize(file.size)}</p>
                <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => setFile(null)}>
                  Remove
                </button>
              </>
            ) : (
              <>
                <DocumentIcon className="mx-auto mb-2 text-muted" style={{ width: 40, height: 40 }} />
                <p className="small text-muted mb-2">Drag and drop or choose a file</p>
                <input type="file" id="modal-doc-upload-file" className="d-none" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                <label htmlFor="modal-doc-upload-file" className="btn btn-sm btn-outline-primary mb-0">
                  Select file
                </label>
              </>
            )}
          </div>
          <div className="form-floating mt-3">
            <textarea id="po_doc_desc" className="form-control form-control-sm" style={{ minHeight: 72 }} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" disabled={uploading} />
            <label htmlFor="po_doc_desc">Description (optional)</label>
          </div>
          {error && <div className="alert alert-danger py-2 small mt-2 mb-0">{error}</div>}
          </div>{/* /component-body-inner */}
        </div>{/* /component-body */}

        <div className="component-footer">
          <div className="component-footer-left">
            <Button_Toolbar
              type="submit"
              icon={ArrowDownTrayIcon}
              label={uploading ? "Uploading…" : "Upload"}
              className="btn-outline-secondary"
              disabled={uploading || !file}
              title="Upload file"
            />
          </div>
          <div className="component-footer-center">
            <button type="button" onClick={handleClose} disabled={uploading} className="btn btn-circle btn-outline-secondary" title="Cancel">
              <XMarkIcon />
            </button>
          </div>
          <div className="component-footer-right"></div>
        </div>
      </form>
    </Modal>
  );
}
