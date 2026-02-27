import React, { useState, useRef, useEffect, lazy, Suspense } from 'react';
import { XMarkIcon, ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';
import { TEMPLATE_VARIABLES } from './templateVariables';

const RichTextEditor = lazy(() =>
  import('./editors/RichTextEditor')
);

const TEMPLATE_TYPES = [
  { value: 'email', label: 'Email' },
  { value: 'invoice', label: 'Invoice' },
  { value: 'receipt', label: 'Receipt' },
  { value: 'memo', label: 'Memo' },
  { value: 'quote', label: 'Quote' },
  { value: 'custom', label: 'Custom' },
];

const PAGE_OPTIONS = [
  { value: 'clients', label: 'Clients' },
  { value: 'employees', label: 'Employees' },
  { value: 'sales', label: 'Sales' },
  { value: 'schedule', label: 'Schedule' },
];

// All variable scopes to show in the picker
const ALL_SCOPES = ['system', 'company', 'sender', 'client', 'employee', 'invoice', 'appointment'];

export default function Modal_Template_Editor({ template, onSave, onClose }) {
  const isNew = !template?.id;
  const isStandard = template?.is_standard === true;

  const [name, setName] = useState(template?.name || '');
  const [description, setDescription] = useState(template?.description || '');
  const [templateType, setTemplateType] = useState(template?.template_type || 'custom');
  const [accessiblePages, setAccessiblePages] = useState(
    () => {
      try { return JSON.parse(template?.accessible_pages || '[]'); }
      catch { return []; }
    }
  );
  const [content, setContent] = useState(template?.content || '');
  const [showVarPicker, setShowVarPicker] = useState(false);
  const [openScope, setOpenScope] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const editorRef = useRef(null);

  const handlePageToggle = (page) => {
    setAccessiblePages((prev) =>
      prev.includes(page) ? prev.filter((p) => p !== page) : [...prev, page]
    );
  };

  const insertVariable = (key) => {
    const editor = editorRef.current;
    if (editor) {
      editor.chain().focus().insertContent(`{{${key}}}`).run();
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Template name is required');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSave({
        name: name.trim(),
        description: description.trim() || null,
        template_type: templateType,
        accessible_pages: JSON.stringify(accessiblePages),
        content,
        is_standard: isStandard,
      });
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to save template');
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-white dark:bg-gray-900"
      style={{ fontFamily: 'inherit' }}
    >
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            {isNew ? 'New Template' : `Edit Template`}
          </h2>
          {isStandard && (
            <span className="text-xs text-amber-600 dark:text-amber-400">
              Editing Standard Template
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-full text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
        >
          <XMarkIcon className="h-5 w-5" />
        </button>
      </div>

      {/* Body: scrollable meta + editor */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Meta fields */}
        <div className="flex-shrink-0 px-4 pt-3 pb-2 border-b border-gray-200 dark:border-gray-700 space-y-2">
          {error && (
            <div className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 rounded px-2 py-1">
              {error}
            </div>
          )}
          {/* Name + type row */}
          <div className="flex gap-2">
            <div className="form-floating flex-1">
              <input
                type="text"
                id="tpl-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="form-control form-control-sm"
                placeholder="Template name"
              />
              <label htmlFor="tpl-name">Template Name</label>
            </div>
            <div className="form-floating" style={{ width: '130px' }}>
              <select
                id="tpl-type"
                value={templateType}
                onChange={(e) => setTemplateType(e.target.value)}
                className="form-select form-select-sm"
              >
                {TEMPLATE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              <label htmlFor="tpl-type">Type</label>
            </div>
          </div>

          {/* Description */}
          <div className="form-floating">
            <input
              type="text"
              id="tpl-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="form-control form-control-sm"
              placeholder="Description (optional)"
            />
            <label htmlFor="tpl-desc">Description (optional)</label>
          </div>

          {/* Accessible pages */}
          <div>
            <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              Available on pages:
            </div>
            <div className="flex gap-2 flex-wrap">
              {PAGE_OPTIONS.map((pg) => (
                <label key={pg.value} className="flex items-center gap-1 cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    checked={accessiblePages.includes(pg.value)}
                    onChange={() => handlePageToggle(pg.value)}
                    className="rounded"
                  />
                  <span>{pg.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Editor area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Variable picker toggle */}
          <div className="flex-shrink-0 flex items-center justify-between px-4 py-1 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
            <button
              type="button"
              onClick={() => setShowVarPicker((v) => !v)}
              className="flex items-center gap-1 text-xs text-primary-600 dark:text-primary-400 hover:underline"
            >
              {showVarPicker ? <ChevronUpIcon className="h-4 w-4" /> : <ChevronDownIcon className="h-4 w-4" />}
              Variables
            </button>
          </div>

          {/* Variable picker panel */}
          {showVarPicker && (
            <div className="flex-shrink-0 px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 overflow-y-auto max-h-48">
              <div className="space-y-1">
                {ALL_SCOPES.map((scope) => {
                  const vars = TEMPLATE_VARIABLES[scope] || [];
                  const isOpen = openScope === scope;
                  return (
                    <div key={scope}>
                      <button
                        type="button"
                        onClick={() => setOpenScope(isOpen ? null : scope)}
                        className="w-full flex items-center justify-between text-xs font-semibold text-gray-700 dark:text-gray-300 py-0.5 hover:text-primary-600 dark:hover:text-primary-400"
                      >
                        <span className="capitalize">{scope}</span>
                        {isOpen ? <ChevronUpIcon className="h-3 w-3" /> : <ChevronDownIcon className="h-3 w-3" />}
                      </button>
                      {isOpen && (
                        <div className="flex flex-wrap gap-1 pl-2 pb-1">
                          {vars.map((v) => (
                            <button
                              key={v.key}
                              type="button"
                              onClick={() => insertVariable(v.key)}
                              title={v.description}
                              className="px-2 py-0.5 rounded text-xs bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 hover:bg-primary-200 dark:hover:bg-primary-800/50 border border-primary-200 dark:border-primary-700"
                            >
                              {'{{'}{v.key}{'}}'}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Rich text editor */}
          <div className="flex-1 overflow-hidden p-2">
            <div className="h-full border border-gray-300 dark:border-gray-600 rounded overflow-hidden">
              <Suspense fallback={<div className="flex items-center justify-center h-full text-sm text-gray-500">Loading editor...</div>}>
                <RichTextEditor
                  ref={editorRef}
                  content={content}
                  onChange={setContent}
                />
              </Suspense>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 flex justify-end gap-2 px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <button
          type="button"
          onClick={onClose}
          className="btn btn-secondary btn-sm"
          disabled={saving}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          className="btn btn-primary btn-sm"
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Save Template'}
        </button>
      </div>
    </div>
  );
}
