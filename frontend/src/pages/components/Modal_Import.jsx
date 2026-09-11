/*
 * ============================================================
 * FILE: Modal_Import.jsx
 *
 * PURPOSE:
 *   Modal dialog that allows admins to bulk-import business data from CSV files.
 *   Supports independent upload of clients, services, and appointments CSV files
 *   in a single submission, with visual confirmation and error feedback.
 *
 * FUNCTIONAL PARTS:
 *   [1] State Initialization — selected file refs, uploading flag, error/success messages
 *   [2] File Selection Handler — validates .csv extension and updates file state
 *   [3] Upload Handler — builds FormData, calls adminAPI.importData, shows result
 *   [4] Close Handler — resets all state before closing
 *   [5] JSX Render — three drag-and-drop file zones (clients, services, appointments) with feedback
 *
 * CHANGE LOG — all modifications to this file must be recorded here:
 *   Format : YYYY-MM-DD | Author | Description
 *   ─────────────────────────────────────────────────────────────
 *   2026-03-01 | Claude  | Added section comments and top-level documentation
 * ============================================================
 */

import React, { useState } from "react";
import { DocumentArrowUpIcon, XMarkIcon, ArrowPathIcon } from "@heroicons/react/24/outline";
import { adminAPI } from "../../services/api";
import Button_Toolbar from "./Button_Toolbar";
import Modal from "./Modal";

// ─── 1 STATE INITIALIZATION ────────────────────────────────────────────────
export default function Modal_Import({ isOpen, onClose, onImportComplete }) {
  const [files, setFiles] = useState({
    clients: null,
    services: null,
    appointments: null,
  });
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // ─── 2 FILE SELECTION HANDLER ─────────────────────────────────────────────
  const handleFileChange = (fileType, e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      if (selectedFile.name.endsWith(".csv")) {
        setFiles((prev) => ({ ...prev, [fileType]: selectedFile }));
        setError("");
      } else {
        setError("Please select a CSV file (.csv)");
        setFiles((prev) => ({ ...prev, [fileType]: null }));
      }
    }
  };

  // ─── 3 UPLOAD HANDLER ─────────────────────────────────────────────────────
  const handleUpload = async () => {
    // Check if at least one file is selected
    const hasFiles = Object.values(files).some((file) => file !== null);
    if (!hasFiles) {
      setError("Please select at least one CSV file to upload");
      return;
    }

    setUploading(true);
    setError("");
    setSuccess("");

    try {
      const formData = new FormData();

      // Add selected files to form data
      if (files.clients) {
        formData.append("clients_file", files.clients);
      }
      if (files.services) {
        formData.append("services_file", files.services);
      }
      if (files.appointments) {
        formData.append("appointments_file", files.appointments);
      }

      await adminAPI.importData(formData);

      setSuccess("Data imported successfully!");
      setFiles({ clients: null, services: null, appointments: null });

      // Reset file inputs
      ["clients-upload", "services-upload", "appointments-upload"].forEach((id) => {
        const fileInput = document.getElementById(id);
        if (fileInput) {
          fileInput.value = "";
        }
      });

      // Call callback to refresh data
      if (onImportComplete) {
        onImportComplete();
      }
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to import data");
    } finally {
      setUploading(false);
    }
  };

  // ─── 4 CLOSE HANDLER ──────────────────────────────────────────────────────
  const handleClose = () => {
    setFiles({ clients: null, services: null, appointments: null });
    setError("");
    setSuccess("");
    onClose();
  };

  // ─── 5 JSX RENDER ────────────────────────────────────────────────────────
  return (
    <Modal isOpen={isOpen} onClose={handleClose} noPadding centered>
      <div className="ui-component-shell">
        <div className="component-header">
          <div className="component-header-left">Import Data from CSV Files</div>
          <div className="component-header-center"></div>
          <div className="component-header-right"></div>
        </div>

        <div className="component-body">
          <div className="component-body-inner">
            <p className="dark:text-gray-400 mb-4 text-gray-500 text-sm">Upload CSV files to import clients, services, and appointments. You can upload one, two, or all three files at once.</p>

            <div className="space-y-4">
        {/* Clients Upload */}
        <div>
          <label className="block dark:text-gray-300 font-medium mb-2 text-gray-700 text-sm">Clients CSV</label>
          <div className="flex items-center justify-center w-full">
            <label className="bg-gray-50 border-2 border-dashed border-gray-300 cursor-pointer dark:bg-gray-700 dark:border-gray-600 dark:hover:bg-gray-600 flex flex-col h-24 hover:bg-gray-100 items-center justify-center rounded-lg w-full">
              <div className="flex flex-col items-center justify-center pb-1 pt-1">
                <DocumentArrowUpIcon className="dark:text-gray-400 h-6 mb-1 text-gray-500 w-6" />
                <p className="ui-muted-xs">
                  <span className="font-semibold">Click to upload</span> clients.csv
                </p>
                <p className="ui-muted-xs">CSV files only (.csv)</p>
              </div>
              <input id="clients-upload" type="file" className="hidden" accept=".csv" onChange={(e) => handleFileChange("clients", e)} />
            </label>
          </div>
          {files.clients && (
            <div className="bg-green-50 border border-green-200 dark:bg-green-900/20 dark:border-green-800 flex items-center justify-between mt-2 p-0 rounded-lg">
              <div className="flex items-center">
                <DocumentArrowUpIcon className="h-4 mr-2 text-green-600 w-4" />
                <span className="dark:text-green-300 text-green-800 text-xs">{files.clients.name}</span>
              </div>
              <button onClick={() => setFiles((prev) => ({ ...prev, clients: null }))} className="hover:text-green-800 text-green-600">
                <XMarkIcon className="ui-icon-4" />
              </button>
            </div>
          )}
        </div>

        {/* Services Upload */}
        <div>
          <label className="block dark:text-gray-300 font-medium mb-2 text-gray-700 text-sm">Services CSV</label>
          <div className="flex items-center justify-center w-full">
            <label className="bg-gray-50 border-2 border-dashed border-gray-300 cursor-pointer dark:bg-gray-700 dark:border-gray-600 dark:hover:bg-gray-600 flex flex-col h-24 hover:bg-gray-100 items-center justify-center rounded-lg w-full">
              <div className="flex flex-col items-center justify-center pb-1 pt-1">
                <DocumentArrowUpIcon className="dark:text-gray-400 h-6 mb-1 text-gray-500 w-6" />
                <p className="ui-muted-xs">
                  <span className="font-semibold">Click to upload</span> services.csv
                </p>
                <p className="ui-muted-xs">CSV files only (.csv)</p>
              </div>
              <input id="services-upload" type="file" className="hidden" accept=".csv" onChange={(e) => handleFileChange("services", e)} />
            </label>
          </div>
          {files.services && (
            <div className="bg-green-50 border border-green-200 dark:bg-green-900/20 dark:border-green-800 flex items-center justify-between mt-2 p-0 rounded-lg">
              <div className="flex items-center">
                <DocumentArrowUpIcon className="h-4 mr-2 text-green-600 w-4" />
                <span className="dark:text-green-300 text-green-800 text-xs">{files.services.name}</span>
              </div>
              <button onClick={() => setFiles((prev) => ({ ...prev, services: null }))} className="hover:text-green-800 text-green-600">
                <XMarkIcon className="ui-icon-4" />
              </button>
            </div>
          )}
        </div>

        {/* Appointments Upload */}
        <div>
          <label className="block dark:text-gray-300 font-medium mb-2 text-gray-700 text-sm">Appointments CSV</label>
          <div className="flex items-center justify-center w-full">
            <label className="bg-gray-50 border-2 border-dashed border-gray-300 cursor-pointer dark:bg-gray-700 dark:border-gray-600 dark:hover:bg-gray-600 flex flex-col h-24 hover:bg-gray-100 items-center justify-center rounded-lg w-full">
              <div className="flex flex-col items-center justify-center pb-1 pt-1">
                <DocumentArrowUpIcon className="dark:text-gray-400 h-6 mb-1 text-gray-500 w-6" />
                <p className="ui-muted-xs">
                  <span className="font-semibold">Click to upload</span> appointments.csv
                </p>
                <p className="ui-muted-xs">CSV files only (.csv)</p>
              </div>
              <input id="appointments-upload" type="file" className="hidden" accept=".csv" onChange={(e) => handleFileChange("appointments", e)} />
            </label>
          </div>
          {files.appointments && (
            <div className="bg-green-50 border border-green-200 dark:bg-green-900/20 dark:border-green-800 flex items-center justify-between mt-2 p-0 rounded-lg">
              <div className="flex items-center">
                <DocumentArrowUpIcon className="h-4 mr-2 text-green-600 w-4" />
                <span className="dark:text-green-300 text-green-800 text-xs">{files.appointments.name}</span>
              </div>
              <button onClick={() => setFiles((prev) => ({ ...prev, appointments: null }))} className="hover:text-green-800 text-green-600">
                <XMarkIcon className="ui-icon-4" />
              </button>
            </div>
          )}
        </div>

        {/* Error message */}
        {error && (
          <div className="bg-red-50 border border-red-200 dark:bg-red-900/20 dark:border-red-800 flex items-center p-1 rounded-lg">
            <span className="dark:text-red-300 text-red-800 text-sm">{error}</span>
          </div>
        )}

        {success && (
            <div className="bg-green-50 border border-green-200 dark:bg-green-900/20 dark:border-green-800 flex items-center p-1 rounded-lg">
              <span className="dark:text-green-300 text-green-800 text-sm">{success}</span>
            </div>
          )}
          </div>{/* /space-y-4 */}
          </div>{/* /component-body-inner */}
        </div>{/* /component-body */}

        <div className="component-footer">
          <div className="component-footer-left">
            <Button_Toolbar
              icon={uploading ? ArrowPathIcon : DocumentArrowUpIcon}
              label={uploading ? "Importing..." : "Import"}
              onClick={handleUpload}
              disabled={!Object.values(files).some((file) => file !== null) || uploading}
              className="btn-outline-secondary"
              title="Import data"
            />
          </div>
          <div className="component-footer-center">
            <button type="button" onClick={handleClose} className="btn ui-btn-circle-outline-secondary" title="Cancel">
              <XMarkIcon />
            </button>
          </div>
          <div className="component-footer-right"></div>
        </div>
      </div>
    </Modal>
  );
}
