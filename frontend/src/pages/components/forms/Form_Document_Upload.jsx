import React, { useState, useEffect } from "react";
import { DocumentIcon, ArrowDownTrayIcon, XMarkIcon } from "@heroicons/react/24/outline";
import Button_Toolbar from "../buttons/Button_Toolbar";
import Footer_Actions from "../footers/Footer_Actions";

function formatFileSize(bytes) {
  if (!bytes) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export default function Form_Document_Upload({ onSubmit, onCancel }) {
  const [formData, setFormData] = useState({
    description: "",
    file: null,
  });
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState(null);
  const [, setUploadProgress] = useState(0);
  const [previewUrl, setPreviewUrl] = useState(null);

  useEffect(() => {
    if (!formData.file || !formData.file.type.startsWith("image/")) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(formData.file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [formData.file]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (error) setError(null);
  };

  const handleFileChange = (e) => {
    setFormData((prev) => ({ ...prev, file: e.target.files[0] }));
    if (error) setError(null);
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFormData((prev) => ({ ...prev, file: e.dataTransfer.files[0] }));
      if (error) setError(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.file) {
      setError("Please select a file to upload");
      return;
    }
    try {
      setUploading(true);
      setError(null);
      setUploadProgress(0);
      await onSubmit(formData);
    } catch (err) {
      const errorMsg = err?.response?.data?.detail || err?.message || "Upload failed. Please try again.";
      setError(errorMsg);
      setUploading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="ui-page-shell">
      <div className="flex-grow-1 min-h-0 overflow-auto p-1">
        <div className="fw-semibold mb-2 small text-muted">Upload Document</div>

        <div className={`border border-2 border-dashed rounded p-1 text-center ${dragActive ? "border-primary bg-primary bg-opacity-10" : ""}`} onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}>
          {formData.file ? (
            <>
              {formData.file.type.startsWith("image/") ? <img src={previewUrl} alt="preview" className="mb-2 mx-auto rounded" style={{ maxHeight: "8rem" }} /> : <DocumentIcon className="app-icon-40 mb-2 mx-auto text-muted" />}
              <p className="fw-medium mb-1 small">{formData.file.name}</p>
              <p className="mb-2 ui-small-muted">{formatFileSize(formData.file.size)}</p>
              <button
                type="button"
                className="btn btn-outline-danger btn-sm"
                onClick={() => {
                  if (previewUrl) URL.revokeObjectURL(previewUrl);
                  setFormData((prev) => ({ ...prev, file: null }));
                }}
              >
                Remove
              </button>
            </>
          ) : (
            <>
              <DocumentIcon className="app-icon-40 mb-2 mx-auto text-muted" />
              <p className="mb-2 ui-small-muted">Drag and drop or choose a file</p>
              <input type="file" id="documents-page-upload-file" name="file" onChange={handleFileChange} className="d-none" accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.ppt,.pptx,.txt,.jpg,.jpeg,.png,.gif" />
              <label htmlFor="documents-page-upload-file" className="btn btn-outline-primary btn-sm mb-0">
                Select file
              </label>
            </>
          )}
        </div>

        <p className="mb-0 mt-2 small text-muted">Supported: PDF, DOC/DOCX, XLS/XLSX, CSV, PPT/PPTX, TXT, JPG/PNG/GIF</p>

        <div className="form-floating mt-3">
          <textarea id="documents-upload-description" name="description" rows={6} value={formData.description} onChange={handleChange} className="ui-description-textarea form-control form-control-sm" placeholder="Description" disabled={uploading} />
          <label htmlFor="documents-upload-description">Description (optional)</label>
        </div>

        {error && <div className="alert alert-danger mb-0 mt-2 py-0 small">{error}</div>}
      </div>

      <div className="app-footer-padding app-form-footer bg-white border-gray-200 border-top dark:bg-gray-900 dark:border-gray-700 flex-shrink-0">
        <Footer_Actions
          start={<Button_Toolbar type="submit" icon={ArrowDownTrayIcon} label={uploading ? "Uploading…" : "Upload"} className="btn-outline-secondary" disabled={uploading || !formData.file} title="Upload document" />}
          center={<Button_Toolbar icon={XMarkIcon} label="Cancel" onClick={onCancel} className="btn-outline-secondary" disabled={uploading} title="Cancel" />}
        />
      </div>
    </form>
  );
}
