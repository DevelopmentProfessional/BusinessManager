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
import Footer_Settings from "./Footer_Settings";

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
  onClose,
}) => (
  <div className="accordion-popup d-flex flex-column min-h-0" style={settingsPanelStyle}>
    <div className="flex-grow-1 min-h-0 overflow-auto" style={{ flexShrink: 0, width: "100%" }}>
      <h2 className="dark:text-white flex font-semibold gap-2 items-center mb-4 text-gray-900 text-lg">
        <CircleStackIcon className="ui-icon-5" /> Database Settings
      </h2>

      <div className="mb-6">
        <Manager_DatabaseConnection />
      </div>

      <div className="border-gray-200 border-t pt-1">
        <h3 className="flex font-medium items-center mb-3 text-base">
          <ArrowUpTrayIcon className="h-5 mr-2 w-5" />
          Data Import
          <HelpIcon id="data-import" text="Import data from CSV files into database tables" />
        </h3>

        <div className="mb-3">
          <label className="flex font-medium items-center mb-1 text-sm">
            Select Table <HelpIcon id="select-table" text="Choose which database table to import data into" />
          </label>
          <select value={selectedTable} onChange={(e) => setSelectedTable(e.target.value)} className="form-select ui-control-sm">
            <option value="">-- Select a table --</option>
            {availableTables.map((t) => (
              <option key={t.name} value={t.name}>
                {t.display_name}
              </option>
            ))}
          </select>
        </div>

        {selectedTable && tableColumns.length > 0 && (
          <div className="bg-gray-50 dark:bg-gray-900 mb-3 p-1 rounded-lg">
            <h4 className="flex font-medium items-center mb-2 text-sm">
              <TableCellsIcon className="h-4 mr-1 w-4" /> Table Columns
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {tableColumns
                .filter((col) => !col.auto_generated)
                .map((col) => (
                  <span key={col.name} className={`px-0 py-1 text-xs rounded ${col.required ? "bg-red-100 text-red-700" : "bg-gray-200 text-gray-700"}`} title={`Type: ${col.type}${col.required ? " (Required)" : ""}`}>
                    {col.display_name}
                  </span>
                ))}
            </div>
            <p className="mt-2 text-gray-500 text-xs">
              <span className="bg-red-100 h-3 inline-block mr-1 rounded w-3"></span>Required fields
            </p>
          </div>
        )}

        {selectedTable && (
          <div className="mb-3">
            <label className="flex font-medium items-center mb-1 text-sm">
              Upload CSV File <HelpIcon id="csv-upload" text="First row should contain column headers" />
            </label>
            <div className="ui-flex-center-gap-2">
              <input ref={csvFileInputRef} type="file" accept=".csv" onChange={handleFileSelect} className="flex-1 form-control form-control-sm" />
              {csvData && (
                <button onClick={resetImport} className="btn ui-btn-outline-secondary-sm">
                  Clear
                </button>
              )}
            </div>
          </div>
        )}

        {csvData && csvHeaders.length > 0 && (
          <div className="bg-gray-50 dark:bg-gray-900 mb-3 p-1 rounded-lg">
            <h4 className="flex font-medium items-center mb-2 text-sm">
              <DocumentTextIcon className="h-4 mr-1 w-4" />
              Column Mapping <HelpIcon id="column-mapping" text="Match CSV columns to database columns" />
            </h4>
            <div className="space-y-2" style={{ maxHeight: "12rem", overflowY: "auto", scrollbarWidth: "none", msOverflowStyle: "none" }}>
              {csvHeaders.map((header) => (
                <div key={header} className="ui-flex-center-gap-2">
                  <span className="fw-medium small text-truncate" style={{ minWidth: "8rem", maxWidth: "8rem" }}>
                    {header}
                  </span>
                  <span className="text-muted">→</span>
                  <select value={columnMapping[header] || ""} onChange={(e) => handleColumnMappingChange(header, e.target.value)} className="flex-1 form-select form-select-sm">
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
            <p className="mt-2 text-gray-500 text-xs">{csvData.length} rows found in CSV</p>
          </div>
        )}

        {csvData && Object.keys(columnMapping).filter((k) => columnMapping[k]).length > 0 && (
          <button onClick={handleImport} disabled={importLoading} className="align-items-center btn btn-sm btn-success d-flex gap-2">
            <ArrowUpTrayIcon className="ui-icon-4" />
            {importLoading ? "Importing…" : `Import ${csvData.length} Records`}
          </button>
        )}

        {importResult && (
          <div className={`mt-3 p-1 rounded-lg border ${importResult.errors?.length > 0 ? "bg-yellow-50 border-yellow-200" : "bg-green-50 border-green-200"}`}>
            <div className="align-items-center d-flex gap-2 mb-2">
              <CheckCircleIcon className={`h-5 w-5 flex-shrink-0 ${importResult.errors?.length > 0 ? "text-yellow-600" : "text-green-600"}`} />
              <span className="small">
                Imported {importResult.imported} of {importResult.total} records
              </span>
            </div>
            {importResult.errors?.length > 0 && (
              <div className="mt-1 text-xs text-yellow-700">
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
          <div className="align-items-center bg-red-50 border border-red-200 d-flex gap-2 mt-3 p-1 rounded-lg text-danger text-sm">
            <ExclamationTriangleIcon className="flex-shrink-0 h-4 w-4" />
            {settingsError}
          </div>
        )}
      </div>
    </div>
    {onClose && <Footer_Settings onSave={onClose} onClose={onClose} />}
  </div>
);

export default Panel_Database;
