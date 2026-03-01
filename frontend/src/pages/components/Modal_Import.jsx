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

import React, { useState } from 'react';
import { DocumentArrowUpIcon, XMarkIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { adminAPI } from '../../services/api';
import Button_Icon from './Button_Icon';
import Footer_Action from './Footer_Action';
import Modal from './Modal';

export default function Modal_Import({ isOpen, onClose, onImportComplete }) {
  const [files, setFiles] = useState({
    clients: null,
    services: null,
    appointments: null
  });
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleFileChange = (fileType, e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      if (selectedFile.name.endsWith('.csv')) {
        setFiles(prev => ({ ...prev, [fileType]: selectedFile }));
        setError('');
      } else {
        setError('Please select a CSV file (.csv)');
        setFiles(prev => ({ ...prev, [fileType]: null }));
      }
    }
  };

  const handleUpload = async () => {
    // Check if at least one file is selected
    const hasFiles = Object.values(files).some(file => file !== null);
    if (!hasFiles) {
      setError('Please select at least one CSV file to upload');
      return;
    }

    setUploading(true);
    setError('');
    setSuccess('');

    try {
      const formData = new FormData();
      
      // Add selected files to form data
      if (files.clients) {
        formData.append('clients_file', files.clients);
      }
      if (files.services) {
        formData.append('services_file', files.services);
      }
      if (files.appointments) {
        formData.append('appointments_file', files.appointments);
      }

      const response = await adminAPI.importData(formData);

      setSuccess('Data imported successfully!');
      setFiles({ clients: null, services: null, appointments: null });
      
      // Reset file inputs
      ['clients-upload', 'services-upload', 'appointments-upload'].forEach(id => {
        const fileInput = document.getElementById(id);
        if (fileInput) {
          fileInput.value = '';
        }
      });

      // Call callback to refresh data
      if (onImportComplete) {
        onImportComplete();
      }

    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to import data');
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    setFiles({ clients: null, services: null, appointments: null });
    setError('');
    setSuccess('');
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Import Data from CSV Files"
      centered={true}
      footer={
        <div className="flex justify-end gap-2">
          <Button_Icon
            icon={uploading ? ArrowPathIcon : DocumentArrowUpIcon}
            label={uploading ? 'Importing...' : 'Import Data'}
            onClick={handleUpload}
            disabled={!Object.values(files).some(file => file !== null) || uploading}
            variant="primary"
            className={uploading ? 'animate-spin' : ''}
          />
          <Button_Icon icon={XMarkIcon} label="Cancel" onClick={handleClose} variant="secondary" />
        </div>
      }
    >
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        Upload CSV files to import clients, services, and appointments.
        You can upload one, two, or all three files at once.
      </p>

      <div className="space-y-4">
                    {/* Clients Upload */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Clients CSV
                      </label>
                      <div className="flex items-center justify-center w-full">
                        <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-gray-300 dark:border-gray-600 border-dashed rounded-lg cursor-pointer bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600">
                          <div className="flex flex-col items-center justify-center pt-3 pb-4">
                            <DocumentArrowUpIcon className="w-6 h-6 mb-1 text-gray-500 dark:text-gray-400" />
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              <span className="font-semibold">Click to upload</span> clients.csv
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">CSV files only (.csv)</p>
                          </div>
                          <input 
                            id="clients-upload"
                            type="file" 
                            className="hidden" 
                            accept=".csv"
                            onChange={(e) => handleFileChange('clients', e)}
                          />
                        </label>
                      </div>
                      {files.clients && (
                        <div className="flex items-center justify-between p-2 mt-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                          <div className="flex items-center">
                            <DocumentArrowUpIcon className="w-4 h-4 text-green-600 mr-2" />
                            <span className="text-xs text-green-800 dark:text-green-300">{files.clients.name}</span>
                          </div>
                          <button
                            onClick={() => setFiles(prev => ({ ...prev, clients: null }))}
                            className="text-green-600 hover:text-green-800"
                          >
                            <XMarkIcon className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Services Upload */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Services CSV
                      </label>
                      <div className="flex items-center justify-center w-full">
                        <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-gray-300 dark:border-gray-600 border-dashed rounded-lg cursor-pointer bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600">
                          <div className="flex flex-col items-center justify-center pt-3 pb-4">
                            <DocumentArrowUpIcon className="w-6 h-6 mb-1 text-gray-500 dark:text-gray-400" />
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              <span className="font-semibold">Click to upload</span> services.csv
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">CSV files only (.csv)</p>
                          </div>
                          <input 
                            id="services-upload"
                            type="file" 
                            className="hidden" 
                            accept=".csv"
                            onChange={(e) => handleFileChange('services', e)}
                          />
                        </label>
                      </div>
                      {files.services && (
                        <div className="flex items-center justify-between p-2 mt-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                          <div className="flex items-center">
                            <DocumentArrowUpIcon className="w-4 h-4 text-green-600 mr-2" />
                            <span className="text-xs text-green-800 dark:text-green-300">{files.services.name}</span>
                          </div>
                          <button
                            onClick={() => setFiles(prev => ({ ...prev, services: null }))}
                            className="text-green-600 hover:text-green-800"
                          >
                            <XMarkIcon className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Appointments Upload */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Appointments CSV
                      </label>
                      <div className="flex items-center justify-center w-full">
                        <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-gray-300 dark:border-gray-600 border-dashed rounded-lg cursor-pointer bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600">
                          <div className="flex flex-col items-center justify-center pt-3 pb-4">
                            <DocumentArrowUpIcon className="w-6 h-6 mb-1 text-gray-500 dark:text-gray-400" />
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              <span className="font-semibold">Click to upload</span> appointments.csv
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">CSV files only (.csv)</p>
                          </div>
                          <input 
                            id="appointments-upload"
                            type="file" 
                            className="hidden" 
                            accept=".csv"
                            onChange={(e) => handleFileChange('appointments', e)}
                          />
                        </label>
                      </div>
                      {files.appointments && (
                        <div className="flex items-center justify-between p-2 mt-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                          <div className="flex items-center">
                            <DocumentArrowUpIcon className="w-4 h-4 text-green-600 mr-2" />
                            <span className="text-xs text-green-800 dark:text-green-300">{files.appointments.name}</span>
                          </div>
                          <button
                            onClick={() => setFiles(prev => ({ ...prev, appointments: null }))}
                            className="text-green-600 hover:text-green-800"
                          >
                            <XMarkIcon className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Error message */}
                    {error && (
                      <div className="flex items-center p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                        <span className="text-sm text-red-800 dark:text-red-300">{error}</span>
                      </div>
                    )}

                    {/* Success message */}
                    {success && (
                      <div className="flex items-center p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                        <span className="text-sm text-green-800 dark:text-green-300">{success}</span>
                      </div>
                    )}
      </div>
    </Modal>
  );
}
