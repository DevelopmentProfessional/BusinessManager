/*
 * ============================================================
 * FILE: Button_ImportCSV.jsx
 *
 * PURPOSE:
 *   A self-contained CSV import button that opens a modal allowing the user to
 *   select a CSV file, preview the parsed data, review column mapping against
 *   the target entity's table columns, and trigger a batch import via a
 *   caller-supplied async callback. Handles parsing, validation, error display,
 *   and import result feedback entirely within the component.
 *
 * FUNCTIONAL PARTS:
 *   [1] State & Refs — File, parsed data, headers, import status, error/result state
 *   [2] Column Mapping — useMemo computes matched, unmatched CSV, and missing table columns
 *   [3] CSV Parsing — parseCSV and parseCSVLine handle quoted fields and header mapping
 *   [4] File Selection Handler — FileReader reads the file, validates required fields
 *   [5] Import Handler — Calls onImport callback, stores results, triggers onComplete
 *   [6] Modal Close Handler — Resets all state on dismiss
 *   [7] Trigger Button & Modal UI — File upload area, mapping preview, data preview table,
 *       error/success panels, and action buttons
 *
 * CHANGE LOG — all modifications to this file must be recorded here:
 *   Format : YYYY-MM-DD | Author | Description
 *   ─────────────────────────────────────────────────────────────
 *   2026-03-01 | Claude  | Added section comments and top-level documentation
 * ============================================================
 */
import React, { useState, useRef, useMemo } from 'react';
import { ArrowUpTrayIcon, XMarkIcon, CheckCircleIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline';
import Modal from './Modal';

/**
 * Reusable CSV Import Button component
 *
 * Props:
 * - onImport: async function(records) - called with parsed CSV records array, should save to DB
 * - onComplete: function() - called after successful import to refresh data
 * - entityName: string - name of entity being imported (e.g., "Clients", "Items")
 * - fieldMapping: object - maps CSV headers to entity fields (optional)
 * - requiredFields: array - list of required field names
 * - className: string - additional CSS classes for the button
 */
export default function Button_ImportCSV({
  onImport,
  onComplete,
  entityName = 'Records',
  fieldMapping = {},
  requiredFields = [],
  tableColumns = [],
  className = ''
}) {
  // ─── 1 STATE & REFS ──────────────────────────────────────────────────────────

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [file, setFile] = useState(null);
  const [parsedData, setParsedData] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState(null);
  const fileInputRef = useRef(null);

  // ─── 2 COLUMN MAPPING ────────────────────────────────────────────────────────

  // Compute column mapping info when tableColumns is provided
  const mappingInfo = useMemo(() => {
    if (headers.length === 0 || tableColumns.length === 0) return null;

    const tableFieldSet = new Set(tableColumns.map(c => c.field));
    const matched = [];
    const unmatchedCsv = [];
    const mappedTableFields = new Set();

    headers.forEach(header => {
      const mappedField = fieldMapping[header.toLowerCase()] ||
                         fieldMapping[header] ||
                         header.toLowerCase().replace(/\s+/g, '_');

      if (tableFieldSet.has(mappedField)) {
        const col = tableColumns.find(c => c.field === mappedField);
        matched.push({ csvHeader: header, tableField: mappedField, tableLabel: col?.label || mappedField });
        mappedTableFields.add(mappedField);
      } else {
        unmatchedCsv.push(header);
      }
    });

    const missingTable = tableColumns.filter(c => !mappedTableFields.has(c.field));

    return { matched, unmatchedCsv, missingTable };
  }, [headers, tableColumns, fieldMapping]);

  // ─── 3 CSV PARSING ───────────────────────────────────────────────────────────

  const parseCSV = (text) => {
    const lines = text.split(/\r?\n/).filter(line => line.trim());
    if (lines.length < 2) {
      throw new Error('CSV must have at least a header row and one data row');
    }

    // Parse header row
    const headerLine = lines[0];
    const csvHeaders = parseCSVLine(headerLine);

    // Parse data rows
    const records = [];
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      if (values.length === 0 || values.every(v => !v.trim())) continue; // Skip empty rows

      const record = {};
      csvHeaders.forEach((header, index) => {
        // Apply field mapping if provided, otherwise use header as-is (lowercase, underscored)
        const fieldName = fieldMapping[header.toLowerCase()] ||
                         fieldMapping[header] ||
                         header.toLowerCase().replace(/\s+/g, '_');
        record[fieldName] = values[index]?.trim() || '';
      });
      records.push(record);
    }

    return { headers: csvHeaders, records };
  };

  const parseCSVLine = (line) => {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current);

    return result;
  };

  // ─── 4 FILE SELECTION HANDLER ────────────────────────────────────────────────

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    setError('');
    setResults(null);

    if (!selectedFile) {
      setFile(null);
      setParsedData([]);
      setHeaders([]);
      return;
    }

    if (!selectedFile.name.endsWith('.csv')) {
      setError('Please select a CSV file (.csv)');
      setFile(null);
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const { headers: csvHeaders, records } = parseCSV(event.target.result);

        // Validate required fields
        if (requiredFields.length > 0) {
          const mappedHeaders = csvHeaders.map(h =>
            fieldMapping[h.toLowerCase()] || fieldMapping[h] || h.toLowerCase().replace(/\s+/g, '_')
          );
          const missingFields = requiredFields.filter(f => !mappedHeaders.includes(f));
          if (missingFields.length > 0) {
            setError(`Missing required columns: ${missingFields.join(', ')}`);
            setFile(null);
            return;
          }
        }

        setFile(selectedFile);
        setHeaders(csvHeaders);
        setParsedData(records);
      } catch (err) {
        setError(err.message || 'Failed to parse CSV file');
        setFile(null);
      }
    };
    reader.onerror = () => {
      setError('Failed to read file');
      setFile(null);
    };
    reader.readAsText(selectedFile);
  };

  // ─── 5 IMPORT HANDLER ────────────────────────────────────────────────────────

  const handleImport = async () => {
    if (parsedData.length === 0) {
      setError('No data to import');
      return;
    }

    setImporting(true);
    setError('');
    setResults(null);

    try {
      const importResults = await onImport(parsedData);

      setResults({
        success: importResults.success || parsedData.length,
        failed: importResults.failed || 0,
        errors: importResults.errors || []
      });

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      setFile(null);
      setParsedData([]);
      setHeaders([]);

      // Call completion callback to refresh data
      if (onComplete) {
        onComplete();
      }
    } catch (err) {
      setError(err.message || 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  // ─── 6 MODAL CLOSE HANDLER ───────────────────────────────────────────────────

  const handleClose = () => {
    setIsModalOpen(false);
    setFile(null);
    setParsedData([]);
    setHeaders([]);
    setError('');
    setResults(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // ─── 7 TRIGGER BUTTON & MODAL UI ─────────────────────────────────────────────

  return (
    <>
      <button
        type="button"
        onClick={() => setIsModalOpen(true)}
        className={`bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-all font-medium text-sm ${className}`}
      >
        <ArrowUpTrayIcon className="h-4 w-4" />
        Import CSV
      </button>

      <Modal isOpen={isModalOpen} onClose={handleClose}>
        <div className="p-1">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
              Import {entityName} from CSV
            </h3>
            <button onClick={handleClose} className="text-gray-400 hover:text-gray-600">
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          {/* File Upload Area */}
          <div className="mb-4">
            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 dark:bg-gray-700 dark:border-gray-600 dark:hover:bg-gray-600">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <ArrowUpTrayIcon className="w-8 h-8 mb-2 text-gray-500" />
                <p className="mb-1 text-sm text-gray-500 dark:text-gray-400">
                  <span className="font-semibold">Click to upload</span> or drag and drop
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">CSV files only</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".csv"
                onChange={handleFileChange}
              />
            </label>
          </div>

          {/* Selected File Info */}
          {file && (
            <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-800 dark:text-blue-200">{file.name}</p>
                  <p className="text-xs text-blue-600 dark:text-blue-300">
                    {parsedData.length} records found • {headers.length} columns
                  </p>
                </div>
                <button
                  onClick={() => {
                    setFile(null);
                    setParsedData([]);
                    setHeaders([]);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="text-blue-600 hover:text-blue-800"
                >
                  <XMarkIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* Column Mapping Preview */}
          {headers.length > 0 && (
            <div className="mb-4">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Column Mapping:
              </p>

              {mappingInfo ? (
                <div className="space-y-2">
                  {/* Matched Columns */}
                  {mappingInfo.matched.length > 0 && (
                    <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                      <p className="text-xs font-semibold text-green-700 dark:text-green-300 mb-1.5 flex items-center gap-1">
                        <CheckCircleIcon className="h-3.5 w-3.5" />
                        Matched ({mappingInfo.matched.length})
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {mappingInfo.matched.map((m, i) => (
                          <span key={i} className="px-2 py-0.5 rounded text-xs bg-green-100 dark:bg-green-800 text-green-800 dark:text-green-200">
                            {m.csvHeader}{m.csvHeader.toLowerCase().replace(/\s+/g, '_') !== m.tableField && ` → ${m.tableLabel}`}
                            {requiredFields.includes(m.tableField) && <span className="text-red-500 ml-0.5">*</span>}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Unmatched CSV Columns */}
                  {mappingInfo.unmatchedCsv.length > 0 && (
                    <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                      <p className="text-xs font-semibold text-yellow-700 dark:text-yellow-300 mb-1.5 flex items-center gap-1">
                        <ExclamationCircleIcon className="h-3.5 w-3.5" />
                        Unmatched CSV Columns ({mappingInfo.unmatchedCsv.length})
                      </p>
                      <p className="text-xs text-yellow-600 dark:text-yellow-400 mb-1">Will be skipped during import:</p>
                      <div className="flex flex-wrap gap-1.5">
                        {mappingInfo.unmatchedCsv.map((h, i) => (
                          <span key={i} className="px-2 py-0.5 rounded text-xs bg-yellow-100 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200 line-through">
                            {h}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Missing Table Columns */}
                  {mappingInfo.missingTable.length > 0 && (
                    <div className="p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg">
                      <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">
                        Not in CSV ({mappingInfo.missingTable.length})
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Defaults will be used for these columns:</p>
                      <div className="flex flex-wrap gap-1.5">
                        {mappingInfo.missingTable.map((c, i) => (
                          <span key={i} className={`px-2 py-0.5 rounded text-xs ${
                            requiredFields.includes(c.field)
                              ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-700'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                          }`}>
                            {c.label}
                            {requiredFields.includes(c.field) && <span className="text-red-500 ml-0.5">*</span>}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {requiredFields.length > 0 && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      <span className="text-red-500">*</span> Required
                    </p>
                  )}
                </div>
              ) : (
                /* Fallback when tableColumns not provided */
                <div className="p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg">
                  <div className="flex flex-wrap gap-2">
                    {headers.map((header, i) => {
                      const mappedField = fieldMapping[header.toLowerCase()] ||
                                         fieldMapping[header] ||
                                         header.toLowerCase().replace(/\s+/g, '_');
                      const isRequired = requiredFields.includes(mappedField);
                      return (
                        <div
                          key={i}
                          className={`px-2 py-1 rounded text-xs ${
                            isRequired
                              ? 'bg-primary-100 dark:bg-primary-900 text-primary-800 dark:text-primary-200 border border-primary-300 dark:border-primary-700'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600'
                          }`}
                        >
                          <span className="font-medium">{header}</span>
                          {header.toLowerCase().replace(/\s+/g, '_') !== mappedField && (
                            <span className="text-gray-500 dark:text-gray-400"> → {mappedField}</span>
                          )}
                          {isRequired && <span className="text-red-500 ml-1">*</span>}
                        </div>
                      );
                    })}
                  </div>
                  {requiredFields.length > 0 && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                      <span className="text-red-500">*</span> Required fields
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Preview Table */}
          {parsedData.length > 0 && (
            <div className="mb-4">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Preview (first 5 rows):
              </p>
              <div className="overflow-x-auto max-h-48 border border-gray-200 dark:border-gray-600 rounded-lg">
                <table className="min-w-full text-xs">
                  <thead className="bg-gray-100 dark:bg-gray-700 sticky top-0">
                    <tr>
                      {headers.map((header, i) => (
                        <th key={i} className="px-2 py-1 text-left font-medium text-gray-600 dark:text-gray-300">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                    {parsedData.slice(0, 5).map((row, i) => (
                      <tr key={i} className="bg-white dark:bg-gray-800">
                        {headers.map((header, j) => {
                          const fieldName = fieldMapping[header.toLowerCase()] ||
                                           fieldMapping[header] ||
                                           header.toLowerCase().replace(/\s+/g, '_');
                          return (
                            <td key={j} className="px-2 py-1 text-gray-700 dark:text-gray-300 truncate max-w-32">
                              {row[fieldName] || '-'}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {parsedData.length > 5 && (
                <p className="text-xs text-gray-500 mt-1">
                  ...and {parsedData.length - 5} more rows
                </p>
              )}
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-2">
              <ExclamationCircleIcon className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
            </div>
          )}

          {/* Success Results */}
          {results && (
            <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <div className="flex items-start gap-2">
                <CheckCircleIcon className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-green-800 dark:text-green-200">
                    Import Complete
                  </p>
                  <p className="text-xs text-green-600 dark:text-green-300">
                    {results.success} records imported successfully
                    {results.failed > 0 && `, ${results.failed} failed`}
                  </p>
                  {results.errors && results.errors.length > 0 && (
                    <ul className="mt-1 text-xs text-red-600 dark:text-red-400">
                      {results.errors.slice(0, 3).map((err, i) => (
                        <li key={i}>• {err}</li>
                      ))}
                      {results.errors.length > 3 && (
                        <li>...and {results.errors.length - 3} more errors</li>
                      )}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 pt-4 border-t border-gray-200 dark:border-gray-600">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600"
            >
              {results ? 'Close' : 'Cancel'}
            </button>
            {!results && (
              <button
                type="button"
                onClick={handleImport}
                disabled={parsedData.length === 0 || importing}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {importing ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Importing...
                  </>
                ) : (
                  <>
                    <ArrowUpTrayIcon className="h-4 w-4" />
                    Import {parsedData.length} Records
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </Modal>
    </>
  );
}
