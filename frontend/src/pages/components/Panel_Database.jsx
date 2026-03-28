// FILE: Panel_Database.jsx
// Renders the database settings panel: connection manager and CSV data import tool.

import React from "react";
import {
  CircleStackIcon,
  ArrowUpTrayIcon,
  TableCellsIcon,
  DocumentTextIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import Manager_DatabaseConnection from "./Manager_DatabaseConnection";

const Panel_Database = ({
  isMobile,
  settingsPanelStyle,
  availableTables,
  selectedTable,
  setSelectedTable,
  tableColumns,
  csvData,
  csvHeaders,
  columnMapping,
  handleColumnMappingChange,
  handleFileSelect,
  handleImport,
  importLoading,
  importResult,
  resetImport,
  csvFileInputRef,
  settingsError,
  HelpIcon,
}) => (
  <div className="accordion-popup" style={settingsPanelStyle}>
    <div style={{ flexGrow: isMobile ? 0 : 1, minHeight: isMobile ? 0 : undefined }} />
    <div style={{ flexShrink: 0, width: "100%", overflowY: "auto", minHeight: 0 }}>
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
        <CircleStackIcon className="h-5 w-5" /> Database Settings
      </h2>

      <div className="mb-6">
        <Manager_DatabaseConnection />
      </div>

      <div className="border-t border-gray-200 pt-4">
        <h3 className="text-base font-medium mb-3 flex items-center">
          <ArrowUpTrayIcon className="h-5 w-5 mr-2" />
          Data Import
          <HelpIcon id="data-import" text="Import data from CSV files into database tables" />
        </h3>

        <div className="mb-3">
          <label className="flex items-center text-sm font-medium mb-1">
            Select Table <HelpIcon id="select-table" text="Choose which database table to import data into" />
          </label>
          <select value={selectedTable} onChange={(e) => setSelectedTable(e.target.value)} className="form-select form-select-sm">
            <option value="">-- Select a table --</option>
            {availableTables.map((t) => (
              <option key={t.name} value={t.name}>
                {t.display_name}
              </option>
            ))}
          </select>
        </div>

        {selectedTable && tableColumns.length > 0 && (
          <div className="mb-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <h4 className="text-sm font-medium mb-2 flex items-center">
              <TableCellsIcon className="h-4 w-4 mr-1" /> Table Columns
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {tableColumns
                .filter((col) => !col.auto_generated)
                .map((col) => (
                  <span key={col.name} className={`px-2 py-1 text-xs rounded ${col.required ? "bg-red-100 text-red-700" : "bg-gray-200 text-gray-700"}`} title={`Type: ${col.type}${col.required ? " (Required)" : ""}`}>
                    {col.display_name}
                  </span>
                ))}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              <span className="inline-block w-3 h-3 bg-red-100 rounded mr-1"></span>Required fields
            </p>
          </div>
        )}

        {selectedTable && (
          <div className="mb-3">
            <label className="flex items-center text-sm font-medium mb-1">
              Upload CSV File <HelpIcon id="csv-upload" text="First row should contain column headers" />
            </label>
            <div className="d-flex align-items-center gap-2">
              <input ref={csvFileInputRef} type="file" accept=".csv" onChange={handleFileSelect} className="form-control form-control-sm flex-1" />
              {csvData && (
                <button onClick={resetImport} className="btn btn-outline-secondary btn-sm">
                  Clear
                </button>
              )}
            </div>
          </div>
        )}

        {csvData && csvHeaders.length > 0 && (
          <div className="mb-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <h4 className="text-sm font-medium mb-2 flex items-center">
              <DocumentTextIcon className="h-4 w-4 mr-1" />
              Column Mapping <HelpIcon id="column-mapping" text="Match CSV columns to database columns" />
            </h4>
            <div className="space-y-2" style={{ maxHeight: "12rem", overflowY: "auto", scrollbarWidth: "none", msOverflowStyle: "none" }}>
              {csvHeaders.map((header) => (
                <div key={header} className="d-flex align-items-center gap-2">
                  <span className="small fw-medium text-truncate" style={{ minWidth: "8rem", maxWidth: "8rem" }}>
                    {header}
                  </span>
                  <span className="text-muted">→</span>
                  <select value={columnMapping[header] || ""} onChange={(e) => handleColumnMappingChange(header, e.target.value)} className="form-select form-select-sm flex-1">
                    <option value="">-- Skip --</option>
                    {tableColumns
                      .filter((col) => !col.auto_generated)
                      .map((col) => (
                        <option key={col.name} value={col.name}>
                          {col.display_name}
                        </option>
                      ))}
                  </select>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-2">{csvData.length} rows found in CSV</p>
          </div>
        )}

        {csvData && Object.keys(columnMapping).filter((k) => columnMapping[k]).length > 0 && (
          <button onClick={handleImport} disabled={importLoading} className="btn btn-success btn-sm d-flex align-items-center gap-2">
            <ArrowUpTrayIcon className="h-4 w-4" />
            {importLoading ? "Importing…" : `Import ${csvData.length} Records`}
          </button>
        )}

        {importResult && (
          <div className={`mt-3 p-3 rounded-lg border ${importResult.errors?.length > 0 ? "bg-yellow-50 border-yellow-200" : "bg-green-50 border-green-200"}`}>
            <div className="d-flex align-items-center gap-2 mb-2">
              <CheckCircleIcon className={`h-5 w-5 flex-shrink-0 ${importResult.errors?.length > 0 ? "text-yellow-600" : "text-green-600"}`} />
              <span className="small">
                Imported {importResult.imported} of {importResult.total} records
              </span>
            </div>
            {importResult.errors?.length > 0 && (
              <div className="text-xs text-yellow-700 mt-1">
                <p className="fw-medium mb-1">Errors:</p>
                <ul className="list-unstyled mb-0">
                  {importResult.errors.slice(0, 5).map((err, idx) => (
                    <li key={idx}>
                      Row {err.row}: {err.error}
                    </li>
                  ))}
                  {importResult.errors.length > 5 && <li>…and {importResult.errors.length - 5} more</li>}
                </ul>
              </div>
            )}
          </div>
        )}

        {settingsError && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg d-flex align-items-center gap-2 text-danger text-sm">
            <ExclamationTriangleIcon className="h-4 w-4 flex-shrink-0" />
            {settingsError}
          </div>
        )}
      </div>
    </div>
  </div>
);

export default Panel_Database;
