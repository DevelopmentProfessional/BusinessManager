import React, { useState } from 'react';
import { DocumentArrowUpIcon, XMarkIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { adminAPI } from '../../services/api';
import IconButton from './IconButton';
import ActionFooter from './ActionFooter';

export default function DataImportModal({ isOpen, onClose, onImportComplete }) {
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay */}
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={handleClose}></div>

        {/* Modal panel */}
        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="sm:flex sm:items-start">
              <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">
                    Import Data from CSV Files
                  </h3>
                  <button
                    onClick={handleClose}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>

                <div className="mt-2">
                  <p className="text-sm text-gray-500 mb-4">
                    Upload CSV files to import clients, services, and appointments. 
                    You can upload one, two, or all three files at once.
                  </p>

                  {/* File upload areas */}
                  <div className="space-y-4">
                    {/* Clients Upload */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Clients CSV
                      </label>
                      <div className="flex items-center justify-center w-full">
                        <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
                          <div className="flex flex-col items-center justify-center pt-3 pb-4">
                            <DocumentArrowUpIcon className="w-6 h-6 mb-1 text-gray-500" />
                            <p className="text-xs text-gray-500">
                              <span className="font-semibold">Click to upload</span> clients.csv
                            </p>
                            <p className="text-xs text-gray-500">CSV files only (.csv)</p>
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
                        <div className="flex items-center justify-between p-2 mt-2 bg-green-50 border border-green-200 rounded-lg">
                          <div className="flex items-center">
                            <DocumentArrowUpIcon className="w-4 h-4 text-green-600 mr-2" />
                            <span className="text-xs text-green-800">{files.clients.name}</span>
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
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Services CSV
                      </label>
                      <div className="flex items-center justify-center w-full">
                        <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
                          <div className="flex flex-col items-center justify-center pt-3 pb-4">
                            <DocumentArrowUpIcon className="w-6 h-6 mb-1 text-gray-500" />
                            <p className="text-xs text-gray-500">
                              <span className="font-semibold">Click to upload</span> services.csv
                            </p>
                            <p className="text-xs text-gray-500">CSV files only (.csv)</p>
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
                        <div className="flex items-center justify-between p-2 mt-2 bg-green-50 border border-green-200 rounded-lg">
                          <div className="flex items-center">
                            <DocumentArrowUpIcon className="w-4 h-4 text-green-600 mr-2" />
                            <span className="text-xs text-green-800">{files.services.name}</span>
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
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Appointments CSV
                      </label>
                      <div className="flex items-center justify-center w-full">
                        <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
                          <div className="flex flex-col items-center justify-center pt-3 pb-4">
                            <DocumentArrowUpIcon className="w-6 h-6 mb-1 text-gray-500" />
                            <p className="text-xs text-gray-500">
                              <span className="font-semibold">Click to upload</span> appointments.csv
                            </p>
                            <p className="text-xs text-gray-500">CSV files only (.csv)</p>
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
                        <div className="flex items-center justify-between p-2 mt-2 bg-green-50 border border-green-200 rounded-lg">
                          <div className="flex items-center">
                            <DocumentArrowUpIcon className="w-4 h-4 text-green-600 mr-2" />
                            <span className="text-xs text-green-800">{files.appointments.name}</span>
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
                      <div className="flex items-center p-3 bg-red-50 border border-red-200 rounded-lg">
                        <span className="text-sm text-red-800">{error}</span>
                      </div>
                    )}

                    {/* Success message */}
                    {success && (
                      <div className="flex items-center p-3 bg-green-50 border border-green-200 rounded-lg">
                        <span className="text-sm text-green-800">{success}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Modal footer - icon-only buttons with tooltips */}
          <div className="bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-4 py-3 sm:px-6 flex justify-end gap-2">
            <IconButton
              icon={uploading ? ArrowPathIcon : DocumentArrowUpIcon}
              label={uploading ? 'Importing...' : 'Import Data'}
              onClick={handleUpload}
              disabled={!Object.values(files).some(file => file !== null) || uploading}
              variant="primary"
              className={uploading ? 'animate-spin' : ''}
            />
            <IconButton icon={XMarkIcon} label="Cancel" onClick={handleClose} variant="secondary" />
          </div>
        </div>
      </div>
    </div>
  );
}
