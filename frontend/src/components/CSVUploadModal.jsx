import React, { useState } from 'react';
import { DocumentArrowUpIcon, ExclamationTriangleIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';
import Modal from './Modal';

const CSVUploadModal = ({ 
  isOpen, 
  onClose, 
  onUpload, 
  entityType, 
  formatInstructions, 
  requiredColumns,
  exampleData 
}) => {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState('');

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile && selectedFile.type === 'text/csv') {
      setFile(selectedFile);
      setError('');
      setResults(null);
    } else {
      setError('Please select a valid CSV file');
      setFile(null);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a CSV file first');
      return;
    }

    setUploading(true);
    setError('');
    setResults(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('entity_type', entityType);

      const response = await onUpload(formData);
      setResults(response);
    } catch (err) {
      setError(err.message || 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setResults(null);
    setError('');
    setUploading(false);
    onClose();
  };

  const getEntityTitle = () => {
    switch (entityType) {
      case 'clients': return 'Clients';
      case 'employees': return 'Employees';
      case 'inventory': return 'Inventory Items';
      case 'services': return 'Services';
      default: return 'Data';
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={`Upload ${getEntityTitle()} via CSV`}>
      <div className="space-y-6">
        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-sm font-medium text-blue-900 mb-2">CSV Format Requirements</h3>
          <div className="text-sm text-blue-800 space-y-2">
            {formatInstructions}
          </div>
          
          {requiredColumns && (
            <div className="mt-3">
              <p className="text-sm font-medium text-blue-900 mb-1">Required Columns:</p>
              <div className="flex flex-wrap gap-1">
                {requiredColumns.map((column, index) => (
                  <span key={index} className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                    {column}
                  </span>
                ))}
              </div>
            </div>
          )}

          {exampleData && (
            <div className="mt-3">
              <p className="text-sm font-medium text-blue-900 mb-1">Example CSV:</p>
              <pre className="text-xs bg-white p-2 rounded border overflow-x-auto">
                {exampleData}
              </pre>
            </div>
          )}
        </div>

        {/* File Upload */}
        <div className="space-y-4">
          <div className="flex items-center justify-center w-full">
            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <DocumentArrowUpIcon className="w-8 h-8 mb-2 text-gray-500" />
                <p className="mb-2 text-sm text-gray-500">
                  <span className="font-semibold">Click to upload</span> or drag and drop
                </p>
                <p className="text-xs text-gray-500">CSV files only</p>
              </div>
              <input 
                type="file" 
                className="hidden" 
                accept=".csv"
                onChange={handleFileChange}
              />
            </label>
          </div>

          {file && (
            <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center">
                <CheckCircleIcon className="w-5 h-5 text-green-600 mr-2" />
                <span className="text-sm text-green-800">{file.name}</span>
              </div>
              <button
                onClick={() => setFile(null)}
                className="text-green-600 hover:text-green-800"
              >
                <XCircleIcon className="w-5 h-5" />
              </button>
            </div>
          )}

          {error && (
            <div className="flex items-center p-3 bg-red-50 border border-red-200 rounded-lg">
              <ExclamationTriangleIcon className="w-5 h-5 text-red-600 mr-2" />
              <span className="text-sm text-red-800">{error}</span>
            </div>
          )}
        </div>

        {/* Upload Results */}
        {results && (
          <div className="space-y-4">
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-900 mb-3">Upload Results</h3>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center">
                  <CheckCircleIcon className="w-4 h-4 text-green-600 mr-2" />
                  <span>Successfully imported: {results.successful}</span>
                </div>
                <div className="flex items-center">
                  <XCircleIcon className="w-4 h-4 text-red-600 mr-2" />
                  <span>Failed: {results.failed}</span>
                </div>
                <div className="flex items-center">
                  <ExclamationTriangleIcon className="w-4 h-4 text-yellow-600 mr-2" />
                  <span>Skipped (duplicates): {results.skipped}</span>
                </div>
                <div className="flex items-center">
                  <span className="text-gray-600">Total processed: {results.total}</span>
                </div>
              </div>

              {results.errors && results.errors.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-sm font-medium text-gray-900 mb-2">Errors Found:</h4>
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {results.errors.map((error, index) => (
                      <div key={index} className="text-xs bg-red-50 border border-red-200 rounded p-2">
                        <span className="font-medium">Row {error.row}:</span> {error.message}
                        {error.column && <span className="text-red-600"> (Column: {error.column})</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end space-x-3 pt-4">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            {results ? 'Close' : 'Cancel'}
          </button>
          {!results && (
            <button
              type="button"
              onClick={handleUpload}
              disabled={!file || uploading}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? 'Uploading...' : 'Upload CSV'}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default CSVUploadModal;
