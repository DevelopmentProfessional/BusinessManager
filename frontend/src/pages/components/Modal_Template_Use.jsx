import React, { useState, useEffect, useRef } from 'react';
import { XMarkIcon, PrinterIcon, ClipboardDocumentIcon } from '@heroicons/react/24/outline';
import { templatesAPI } from '../../services/api';
import {
  renderTemplate,
  buildClientVariables,
  buildEmployeeVariables,
  buildSalesVariables,
} from './templateVariables';

const TYPE_BADGE_COLOR = {
  email: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
  invoice: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
  receipt: 'bg-teal-100 text-teal-800 dark:bg-teal-900/50 dark:text-teal-300',
  memo: 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300',
  quote: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300',
  custom: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
};

/**
 * Props:
 *  page          – 'clients' | 'employees' | 'sales'
 *  entity        – client | employee | transaction object
 *  currentUser   – logged-in user object
 *  settings      – AppSettings object
 *  items         – (optional) sale transaction items for sales page
 *  client        – (optional) client for sales page
 *  filterType    – (optional) only show templates of this type (e.g. 'invoice', 'receipt')
 *  onClose       – callback to close this modal
 */
export default function Modal_Template_Use({
  page,
  entity,
  currentUser,
  settings,
  items = [],
  client,
  filterType = null,
  onClose,
}) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [renderedHtml, setRenderedHtml] = useState('');
  const [copied, setCopied] = useState(false);
  const iframeRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    templatesAPI.getAll(page)
      .then((res) => {
        if (!cancelled) setTemplates(res.data || []);
      })
      .catch(() => {
        if (!cancelled) setTemplates([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [page]);

  useEffect(() => {
    if (!selected) { setRenderedHtml(''); return; }
    const vars = buildVars();
    setRenderedHtml(renderTemplate(selected.content, vars));
  }, [selected]);

  const buildVars = () => {
    if (page === 'clients') return buildClientVariables(entity, currentUser, settings);
    if (page === 'employees') return buildEmployeeVariables(entity, currentUser, settings);
    if (page === 'sales') return buildSalesVariables(entity, client || entity, currentUser, settings, items);
    return {};
  };

  const handlePrint = () => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
  };

  const handleCopyHtml = async () => {
    try {
      await navigator.clipboard.writeText(renderedHtml);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  const handleCopyText = async () => {
    const tmp = document.createElement('div');
    tmp.innerHTML = renderedHtml;
    const text = tmp.innerText || tmp.textContent || '';
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  // Build the full HTML page for the iframe
  const iframeContent = `<!DOCTYPE html><html><head>
    <meta charset="utf-8"/>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
             font-size: 14px; line-height: 1.6; padding: 24px; margin: 0; color: #111; }
      h1,h2,h3 { margin: 0.5em 0; }
      p { margin: 0.4em 0; }
      hr { border: none; border-top: 1px solid #ccc; margin: 1em 0; }
      ul,ol { padding-left: 1.5em; }
      @media print { body { padding: 0; } }
    </style>
  </head><body>${renderedHtml}</body></html>`;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">
          Use Template
        </h2>
        <button
          onClick={onClose}
          className="p-1 rounded-full text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
        >
          <XMarkIcon className="h-5 w-5" />
        </button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left: template list */}
        <div
          className="flex-shrink-0 border-r border-gray-200 dark:border-gray-700 overflow-y-auto"
          style={{ width: '200px' }}
        >
          {loading ? (
            <div className="p-4 text-sm text-gray-500">Loading...</div>
          ) : templates.length === 0 ? (
            <div className="p-4 text-sm text-gray-500">No templates available for this page.</div>
          ) : (
            <ul className="py-1">
              {(filterType ? templates.filter(t => t.template_type === filterType) : templates).map((tpl) => (
                <li key={tpl.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(tpl)}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
                      selected?.id === tpl.id
                        ? 'bg-primary-50 dark:bg-primary-900/20 border-r-2 border-primary-500'
                        : ''
                    }`}
                  >
                    <div className="font-medium text-gray-900 dark:text-white text-xs leading-tight">
                      {tpl.name}
                    </div>
                    <span
                      className={`inline-block mt-1 px-1.5 py-0.5 rounded text-xs font-medium ${
                        TYPE_BADGE_COLOR[tpl.template_type] || TYPE_BADGE_COLOR.custom
                      }`}
                    >
                      {tpl.template_type}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Right: preview */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {selected ? (
            <>
              {/* Preview toolbar */}
              <div className="flex-shrink-0 flex items-center gap-2 px-3 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                <span className="text-xs text-gray-500 flex-1 truncate">{selected.name}</span>
                <button
                  type="button"
                  onClick={handlePrint}
                  className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-primary-600 text-white hover:bg-primary-700"
                  title="Print"
                >
                  <PrinterIcon className="h-3.5 w-3.5" /> Print
                </button>
                <button
                  type="button"
                  onClick={handleCopyHtml}
                  className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600"
                  title="Copy HTML"
                >
                  <ClipboardDocumentIcon className="h-3.5 w-3.5" />
                  {copied ? 'Copied!' : 'Copy HTML'}
                </button>
                <button
                  type="button"
                  onClick={handleCopyText}
                  className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600"
                  title="Copy plain text"
                >
                  Copy Text
                </button>
              </div>
              {/* iframe preview */}
              <div className="flex-1 overflow-hidden">
                <iframe
                  ref={iframeRef}
                  srcDoc={iframeContent}
                  className="w-full h-full border-0"
                  title="Template preview"
                  sandbox="allow-same-origin allow-modals"
                />
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-sm text-gray-400">
              Select a template to preview
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
