import React, { useState, useEffect } from "react";
import { DocumentIcon, ArrowDownTrayIcon, XMarkIcon } from "../../../icons";
import Button_Toolbar from "../buttons/Button_Toolbar";
import Footer_Actions from "../footers/Footer_Actions";
import { InputTextarea } from "../Inputs";

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
    files: [],
  });
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState(null);
  const [, setUploadProgress] = useState(0);
  const [previewUrl, setPreviewUrl] = useState(null);

  useEffect(() => {
    const firstFile = formData.files[0];
    if (!firstFile || !firstFile.type.startsWith("image/")) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(firstFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [formData.files]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (error) setError(null);
  };

  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length) {
      setFormData((prev) => ({ ...prev, files: [...prev.files, ...selectedFiles] }));
    }
    e.target.value = "";
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
    const droppedFiles = Array.from(e.dataTransfer.files || []);
    if (droppedFiles.length) {
      setFormData((prev) => ({ ...prev, files: [...prev.files, ...droppedFiles] }));
      if (error) setError(null);
    }
  };

  const handleRemoveFile = (fileIndex) => {
    setFormData((prev) => ({ ...prev, files: prev.files.filter((_, index) => index !== fileIndex) }));
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.files.length === 0) {
      setError("Please select at least one file to upload");
      return;
    }
    try {
      setUploading(true);
      setError(null);
      setUploadProgress(0);
      const result = await onSubmit(formData);
      if (result?.failedFiles?.length) {
        setFormData((prev) => ({ ...prev, files: result.failedFiles }));
        setError(result.errorMessage || "Some files could not be uploaded. Retry the remaining files.");
      }
    } catch (err) {
      const errorMsg = err?.response?.data?.detail || err?.message || "Upload failed. Please try again.";
      setError(errorMsg);
    } finally {
      setUploading(false);
    }
  };

  const firstFile = formData.files[0];

  return (
    <form onSubmit={handleSubmit} className="ui-page-shell">
      <div className="flex-grow-1 min-h-0 overflow-auto p-1">
        <div className="fw-semibold mb-2 small text-muted">Upload Document</div>

        <div className={`border border-2 border-dashed rounded p-1 text-center ${dragActive ? "border-primary bg-primary bg-opacity-10" : ""}`} onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}>
          <input type="file" id="documents-page-upload-file" name="file" onChange={handleFileChange} className="d-none" accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.ppt,.pptx,.txt,.jpg,.jpeg,.png,.gif" multiple />
          {formData.files.length > 0 ? (
            <>
              {firstFile.type.startsWith("image/") && previewUrl && <img src={previewUrl} alt="Selected file preview" className="mb-2 mx-auto rounded" style={{ maxHeight: "8rem" }} />}
              <div className="d-flex flex-column gap-1 mb-2 text-start">
                {formData.files.map((file, index) => (
                  <div key={`${file.name}-${file.size}-${file.lastModified}-${index}`} className="align-items-center border rounded d-flex gap-1 justify-content-between p-1">
                    <div className="align-items-center d-flex gap-1 min-w-0">
                      <DocumentIcon className="app-icon flex-shrink-0 text-muted" aria-hidden="true" />
                      <span className="small text-truncate" title={file.name}>{file.name}</span>
                      <span className="flex-shrink-0 ui-small-muted">{formatFileSize(file.size)}</span>
                    </div>
                    <button type="button" className="btn btn-outline-secondary btn-sm flex-shrink-0 p-0" onClick={() => handleRemoveFile(index)} disabled={uploading} aria-label={`Remove ${file.name}`}>
                      <XMarkIcon className="app-icon" aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
              <label htmlFor="documents-page-upload-file" className="btn btn-outline-primary btn-sm mb-0">
                Add more files
              </label>
            </>
          ) : (
            <>
              <DocumentIcon className="app-icon-40 mb-2 mx-auto text-muted" />
              <p className="mb-2 ui-small-muted">Drag and drop or choose files</p>
              <label htmlFor="documents-page-upload-file" className="btn btn-outline-primary btn-sm mb-0">
                Select files
              </label>
            </>
          )}
        </div>

        <p className="mb-0 mt-2 small text-muted">Supported: PDF, DOC/DOCX, XLS/XLSX, CSV, PPT/PPTX, TXT, JPG/PNG/GIF</p>

        <div className="form-floating mt-3">
          <InputTextarea id="documents-upload-description" name="description" rows={6} value={formData.description} onChange={handleChange} className="ui-description-textarea" placeholder="Description" disabled={uploading} />
          <label htmlFor="documents-upload-description">Description (optional)</label>
        </div>

        {error && <div className="alert alert-danger mb-0 mt-2 py-0 small">{error}</div>}
      </div>

      <div className="app-footer-padding app-form-footer bg-white border-gray-200 border-top dark:bg-gray-900 dark:border-gray-700 flex-shrink-0">
        <Footer_Actions
          start={<Button_Toolbar type="submit" icon={ArrowDownTrayIcon} label={uploading ? "Uploading…" : "Upload"} className="btn-outline-secondary" disabled={uploading || formData.files.length === 0} title="Upload document" />}
          center={<Button_Toolbar icon={XMarkIcon} label="Cancel" onClick={onCancel} className="btn-outline-secondary" disabled={uploading} title="Cancel" />}
        />
      </div>
    </form>
  );
}
