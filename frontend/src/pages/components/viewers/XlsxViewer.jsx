/*
 * ============================================================
 * FILE: XlsxViewer.jsx
 *
 * PURPOSE:
 *   Fetches and renders an Excel (.xlsx) spreadsheet in-browser using the xlsx
 *   library. Supports multi-sheet navigation, a toggleable cell-editing mode with
 *   inline inputs, row/column add and row delete, and saves modified workbook
 *   data back to the server via the documents API.
 *
 * FUNCTIONAL PARTS:
 *   [1] Component State & Refs   — workbook, sheet data, loading/error, edit mode,
 *                                  cell edit, save status, and timer refs
 *   [2] Data Loading             — useEffect that fetches the file, parses it with
 *                                  xlsx, and seeds activeSheet/sheetData
 *   [3] Sheet Navigation         — handleSheetChange switches the active sheet
 *   [4] Cell Editing Helpers     — handleCellDoubleClick, commitEdit, cancelEdit,
 *                                  handleCellKeyDown (Enter/Escape/Tab support)
 *   [5] Row & Column Mutations   — handleAddRow, handleDeleteRow, handleAddColumn
 *   [6] Save Logic               — saveWorkbook (POST binary to API), Ctrl+S listener,
 *                                  cleanup timer on unmount
 *   [7] Toolbar Render           — edit-mode toggle, save button, add row/col, metadata button
 *   [8] Sheet Tabs Render        — tab strip shown when workbook has more than one sheet
 *   [9] Spreadsheet Table Render — sticky header with column letters, row numbers,
 *                                  editable cells, delete row controls
 *   [10] Status Bar Render       — row/column count, active sheet name, unsaved indicator
 *
 * CHANGE LOG — all modifications to this file must be recorded here:
 *   Format : YYYY-MM-DD | Author | Description
 *   ─────────────────────────────────────────────────────────────
 *   2026-03-01 | Claude  | Added section comments and top-level documentation
 * ============================================================
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { ArrowDownTrayIcon, PencilIcon, TableCellsIcon, PlusIcon, TrashIcon, CheckIcon } from '@heroicons/react/24/outline';
import { documentsAPI } from '../../../services/api';

// ─── 1 COMPONENT STATE & REFS ──────────────────────────────────────────────────

export default function XlsxViewer({ document, onEdit }) {
  const [workbook, setWorkbook] = useState(null);
  const [activeSheet, setActiveSheet] = useState('');
  const [sheetData, setSheetData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const tableRef = useRef(null);

  // Editing state
  const [isEditing, setIsEditing] = useState(false);
  const [editingCell, setEditingCell] = useState(null); // { row, col }
  const [editValue, setEditValue] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState('idle'); // idle | saving | saved | error
  const saveTimerRef = useRef(null);
  const editInputRef = useRef(null);

  // ─── 2 DATA LOADING ────────────────────────────────────────────────────────────

  useEffect(() => {
    let canceled = false;

    const loadXlsx = async () => {
      try {
        setLoading(true);
        setError('');
        const res = await fetch(documentsAPI.fileUrl(document.id));
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const ab = await res.arrayBuffer();
        if (canceled) return;

        const wb = XLSX.read(new Uint8Array(ab), { type: 'array' });
        setWorkbook(wb);
        if (wb.SheetNames.length > 0) {
          const firstSheet = wb.SheetNames[0];
          setActiveSheet(firstSheet);
          const ws = wb.Sheets[firstSheet];
          setSheetData(XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }));
        }
        setLoading(false);
      } catch (err) {
        console.error('Failed to load spreadsheet', err);
        if (!canceled) {
          setError('Failed to load spreadsheet.');
          setLoading(false);
        }
      }
    };

    loadXlsx();
    return () => { canceled = true; };
  }, [document.id]);

  // ─── 3 SHEET NAVIGATION ────────────────────────────────────────────────────────

  const handleSheetChange = (sheetName) => {
    if (!workbook) return;
    setActiveSheet(sheetName);
    const ws = workbook.Sheets[sheetName];
    setSheetData(XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }));
    setEditingCell(null);
  };

  // Find the maximum number of columns across all rows
  const maxCols = sheetData.reduce((max, row) => Math.max(max, Array.isArray(row) ? row.length : 0), 0) || 1;

  // Generate column letters (A, B, C, ... Z, AA, AB, etc.)
  const getColLetter = (index) => {
    let letter = '';
    let n = index;
    while (n >= 0) {
      letter = String.fromCharCode(65 + (n % 26)) + letter;
      n = Math.floor(n / 26) - 1;
    }
    return letter;
  };

  // ─── 4 CELL EDITING HELPERS ────────────────────────────────────────────────────

  // Start editing a cell on double-click
  const handleCellDoubleClick = (rowIdx, colIdx) => {
    if (!isEditing) return;
    const cellVal = Array.isArray(sheetData[rowIdx]) ? sheetData[rowIdx][colIdx] : '';
    setEditingCell({ row: rowIdx, col: colIdx });
    setEditValue(cellVal != null ? String(cellVal) : '');
  };

  // Focus input when editing cell changes
  useEffect(() => {
    if (editingCell && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingCell]);

  // Commit cell edit
  const commitEdit = useCallback(() => {
    if (!editingCell) return;
    const { row, col } = editingCell;

    const newData = sheetData.map((r, i) => {
      if (i !== row) return Array.isArray(r) ? [...r] : [];
      const newRow = Array.isArray(r) ? [...r] : [];
      // Extend row if needed
      while (newRow.length <= col) newRow.push('');
      // Try to parse as number if it looks like one
      const trimmed = editValue.trim();
      if (trimmed !== '' && !isNaN(trimmed) && trimmed !== '') {
        newRow[col] = Number(trimmed);
      } else {
        newRow[col] = editValue;
      }
      return newRow;
    });

    setSheetData(newData);
    setEditingCell(null);
    setIsDirty(true);
    if (saveStatus === 'saved') setSaveStatus('idle');

    // Update the workbook sheet in memory
    if (workbook && activeSheet) {
      workbook.Sheets[activeSheet] = XLSX.utils.aoa_to_sheet(newData);
    }
  }, [editingCell, editValue, sheetData, workbook, activeSheet, saveStatus]);

  // Cancel cell edit
  const cancelEdit = () => {
    setEditingCell(null);
    setEditValue('');
  };

  // Handle keydown in cell input
  const handleCellKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitEdit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelEdit();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      commitEdit();
      // Move to next cell
      if (editingCell) {
        const nextCol = editingCell.col + 1;
        if (nextCol < maxCols) {
          const cellVal = Array.isArray(sheetData[editingCell.row]) ? sheetData[editingCell.row][nextCol] : '';
          setEditingCell({ row: editingCell.row, col: nextCol });
          setEditValue(cellVal != null ? String(cellVal) : '');
        }
      }
    }
  };

  // ─── 5 ROW & COLUMN MUTATIONS ──────────────────────────────────────────────────

  // Add a new row at the bottom
  const handleAddRow = () => {
    const newRow = Array(maxCols).fill('');
    const newData = [...sheetData, newRow];
    setSheetData(newData);
    setIsDirty(true);
    if (saveStatus === 'saved') setSaveStatus('idle');
    if (workbook && activeSheet) {
      workbook.Sheets[activeSheet] = XLSX.utils.aoa_to_sheet(newData);
    }
  };

  // Delete a row
  const handleDeleteRow = (rowIdx) => {
    if (sheetData.length <= 1) return;
    const newData = sheetData.filter((_, i) => i !== rowIdx);
    setSheetData(newData);
    setIsDirty(true);
    if (saveStatus === 'saved') setSaveStatus('idle');
    if (editingCell && editingCell.row === rowIdx) {
      setEditingCell(null);
    }
    if (workbook && activeSheet) {
      workbook.Sheets[activeSheet] = XLSX.utils.aoa_to_sheet(newData);
    }
  };

  // Add a new column
  const handleAddColumn = () => {
    const newData = sheetData.map(row => {
      const r = Array.isArray(row) ? [...row] : [];
      while (r.length < maxCols) r.push('');
      r.push('');
      return r;
    });
    setSheetData(newData);
    setIsDirty(true);
    if (saveStatus === 'saved') setSaveStatus('idle');
    if (workbook && activeSheet) {
      workbook.Sheets[activeSheet] = XLSX.utils.aoa_to_sheet(newData);
    }
  };

  // ─── 6 SAVE LOGIC ──────────────────────────────────────────────────────────────

  // Save workbook back to server
  const saveWorkbook = useCallback(async () => {
    if (!workbook || !isDirty || isSaving) return;

    setIsSaving(true);
    setSaveStatus('saving');

    try {
      const wbOut = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([wbOut], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      await documentsAPI.saveBinary(
        document.id,
        blob,
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      setIsDirty(false);
      setSaveStatus('saved');

      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (err) {
      console.error('Failed to save spreadsheet:', err);
      setSaveStatus('error');
      setError('Failed to save: ' + (err.message || 'Unknown error'));
    } finally {
      setIsSaving(false);
    }
  }, [workbook, isDirty, isSaving, document.id]);

  // Ctrl+S keyboard shortcut when editing
  useEffect(() => {
    if (!isEditing) return;
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveWorkbook();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isEditing, saveWorkbook]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  // Toggle edit mode
  const toggleEditMode = () => {
    if (isEditing) {
      setEditingCell(null);
    }
    setIsEditing(!isEditing);
  };

  // ─── 7 TOOLBAR RENDER ──────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <div className="flex items-center gap-2">
          <TableCellsIcon className="h-4 w-4 text-gray-500 dark:text-gray-400" />
          <span className="text-sm text-gray-600 dark:text-gray-300">Excel Spreadsheet</span>
          {workbook && (
            <span className="text-xs text-gray-400 dark:text-gray-500">
              ({workbook.SheetNames.length} sheet{workbook.SheetNames.length !== 1 ? 's' : ''})
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Edit mode toggle */}
          {!loading && !error && (
            <button
              onClick={toggleEditMode}
              className={`flex items-center gap-1 px-3 py-1 text-sm rounded transition-colors ${
                isEditing
                  ? 'bg-primary-600 text-white hover:bg-primary-700'
                  : 'text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              <PencilIcon className="h-4 w-4" />
              {isEditing ? 'Editing' : 'Edit'}
            </button>
          )}
          {/* Save button (when editing) */}
          {isEditing && (
            <>
              <button
                onClick={saveWorkbook}
                disabled={!isDirty || isSaving}
                className={`flex items-center gap-1 px-3 py-1 text-sm rounded transition-colors ${
                  isDirty && !isSaving
                    ? 'bg-green-600 text-white hover:bg-green-700'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                }`}
              >
                {isSaving ? (
                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                ) : (
                  <CheckIcon className="h-4 w-4" />
                )}
                {isSaving ? 'Saving...' : saveStatus === 'saved' ? 'Saved' : 'Save'}
              </button>
              <button
                onClick={handleAddRow}
                className="flex items-center gap-1 px-3 py-1 text-sm text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                <PlusIcon className="h-4 w-4" />
                Row
              </button>
              <button
                onClick={handleAddColumn}
                className="flex items-center gap-1 px-3 py-1 text-sm text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                <PlusIcon className="h-4 w-4" />
                Col
              </button>
            </>
          )}
          {/* Save status indicator */}
          {saveStatus === 'saved' && (
            <span className="text-xs text-green-600 dark:text-green-400">Saved</span>
          )}
          {saveStatus === 'error' && (
            <span className="text-xs text-red-600 dark:text-red-400">Save failed</span>
          )}
          {onEdit && (
            <button
              onClick={onEdit}
              className="flex items-center gap-1 px-3 py-1 text-sm bg-primary-600 text-white rounded hover:bg-primary-700"
            >
              <PencilIcon className="h-4 w-4" />
              Metadata
            </button>
          )}
        </div>
      </div>

      {/* ─── 8 SHEET TABS RENDER ────────────────────────────────────────────── */}
      {/* Sheet Tabs */}
      {workbook && workbook.SheetNames.length > 1 && (
        <div className="flex border-b border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 overflow-x-auto">
          {workbook.SheetNames.map((name) => (
            <button
              key={name}
              onClick={() => handleSheetChange(name)}
              className={`px-4 py-1.5 text-sm whitespace-nowrap border-b-2 transition-colors ${
                activeSheet === name
                  ? 'border-primary-600 text-primary-700 dark:text-primary-400 bg-white dark:bg-gray-700 font-medium'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              {name}
            </button>
          ))}
        </div>
      )}

      {/* ─── 9 SPREADSHEET TABLE RENDER ─────────────────────────────────────── */}
      {/* Content */}
      <div className="flex-1 overflow-auto bg-white" ref={tableRef}>
        {loading && (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        )}
        {error && (
          <div className="p-4">
            <div className="text-red-600 bg-red-50 dark:bg-red-900/20 p-4 rounded mb-4">{error}</div>
            <a
              href={documentsAPI.fileUrl(document.id, { download: true })}
              download
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700"
            >
              <ArrowDownTrayIcon className="h-5 w-5" />
              Download to View
            </a>
          </div>
        )}
        {!loading && !error && sheetData.length === 0 && (
          <div className="flex flex-col items-center justify-center h-32 text-gray-500 dark:text-gray-400 gap-2">
            <span>This sheet is empty.</span>
            {isEditing && (
              <button
                onClick={handleAddRow}
                className="flex items-center gap-1 px-3 py-1 text-sm bg-primary-600 text-white rounded hover:bg-primary-700"
              >
                <PlusIcon className="h-4 w-4" />
                Add Row
              </button>
            )}
          </div>
        )}
        {!loading && !error && sheetData.length > 0 && (
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="bg-gray-100 dark:bg-gray-800">
                {/* Row number header */}
                <th className="px-2 py-1 text-center text-xs font-medium text-gray-400 dark:text-gray-500 border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 w-10">
                  #
                </th>
                {Array.from({ length: maxCols }, (_, i) => (
                  <th
                    key={i}
                    className="px-3 py-1 text-center text-xs font-medium text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 min-w-[80px]"
                  >
                    {getColLetter(i)}
                  </th>
                ))}
                {/* Delete column placeholder when editing */}
                {isEditing && <th className="w-8 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700"></th>}
              </tr>
            </thead>
            <tbody>
              {sheetData.map((row, rowIdx) => (
                <tr key={rowIdx} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 group">
                  {/* Row number */}
                  <td className="px-2 py-1 text-center text-xs text-gray-400 dark:text-gray-500 border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                    {rowIdx + 1}
                  </td>
                  {Array.from({ length: maxCols }, (_, colIdx) => {
                    const isEditingThis = editingCell && editingCell.row === rowIdx && editingCell.col === colIdx;
                    const cellVal = Array.isArray(row) ? row[colIdx] : '';
                    const display = cellVal != null ? String(cellVal) : '';

                    return (
                      <td
                        key={colIdx}
                        className={`px-3 py-1 border border-gray-200 bg-white whitespace-nowrap ${
                          isEditing ? 'cursor-cell' : ''
                        } ${isEditingThis ? 'p-0' : 'text-gray-800'}`}
                        title={isEditing ? 'Double-click to edit' : display}
                        onDoubleClick={() => handleCellDoubleClick(rowIdx, colIdx)}
                      >
                        {isEditingThis ? (
                          <input
                            ref={editInputRef}
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={commitEdit}
                            onKeyDown={handleCellKeyDown}
                            className="w-full h-full px-2 py-1 text-sm border-2 border-primary-500 outline-none bg-white text-gray-900"
                          />
                        ) : (
                          display
                        )}
                      </td>
                    );
                  })}
                  {/* Delete row button */}
                  {isEditing && (
                    <td className="px-1 py-1 border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                      <button
                        onClick={() => handleDeleteRow(rowIdx)}
                        className="p-0.5 text-gray-300 hover:text-red-500 dark:text-gray-600 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Delete row"
                      >
                        <TrashIcon className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ─── 10 STATUS BAR RENDER ───────────────────────────────────────────── */}
      {/* Status bar */}
      {!loading && !error && (
        <div className="px-3 py-1 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-xs text-gray-500 dark:text-gray-400 flex items-center gap-4">
          <span>{sheetData.length} rows</span>
          <span>{maxCols} columns</span>
          <span>Sheet: {activeSheet}</span>
          {isEditing && isDirty && (
            <span className="text-amber-600 dark:text-amber-400">Unsaved changes</span>
          )}
          {isEditing && (
            <span className="ml-auto text-gray-400">Double-click a cell to edit | Ctrl+S to save</span>
          )}
        </div>
      )}
    </div>
  );
}
