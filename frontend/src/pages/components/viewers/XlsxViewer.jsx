import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import { ArrowDownTrayIcon, PencilIcon, TableCellsIcon } from '@heroicons/react/24/outline';
import { documentsAPI } from '../../../services/api';

export default function XlsxViewer({ document, onEdit }) {
  const [workbook, setWorkbook] = useState(null);
  const [activeSheet, setActiveSheet] = useState('');
  const [sheetData, setSheetData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const tableRef = useRef(null);

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

  const handleSheetChange = (sheetName) => {
    if (!workbook) return;
    setActiveSheet(sheetName);
    const ws = workbook.Sheets[sheetName];
    setSheetData(XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }));
  };

  // Find the maximum number of columns across all rows
  const maxCols = sheetData.reduce((max, row) => Math.max(max, Array.isArray(row) ? row.length : 0), 0);

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
          {onEdit && (
            <button
              onClick={onEdit}
              className="flex items-center gap-1 px-3 py-1 text-sm bg-primary-600 text-white rounded hover:bg-primary-700"
            >
              <PencilIcon className="h-4 w-4" />
              Edit Metadata
            </button>
          )}
        </div>
      </div>

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

      {/* Content */}
      <div className="flex-1 overflow-auto bg-white dark:bg-gray-900" ref={tableRef}>
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
          <div className="flex items-center justify-center h-32 text-gray-500 dark:text-gray-400">
            This sheet is empty.
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
              </tr>
            </thead>
            <tbody>
              {sheetData.map((row, rowIdx) => (
                <tr key={rowIdx} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  {/* Row number */}
                  <td className="px-2 py-1 text-center text-xs text-gray-400 dark:text-gray-500 border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                    {rowIdx + 1}
                  </td>
                  {Array.from({ length: maxCols }, (_, colIdx) => {
                    const cellVal = Array.isArray(row) ? row[colIdx] : '';
                    const display = cellVal != null ? String(cellVal) : '';
                    return (
                      <td
                        key={colIdx}
                        className="px-3 py-1 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-700 whitespace-nowrap"
                        title={display}
                      >
                        {display}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Status bar */}
      {!loading && !error && sheetData.length > 0 && (
        <div className="px-3 py-1 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-xs text-gray-500 dark:text-gray-400 flex items-center gap-4">
          <span>{sheetData.length} rows</span>
          <span>{maxCols} columns</span>
          <span>Sheet: {activeSheet}</span>
        </div>
      )}
    </div>
  );
}
