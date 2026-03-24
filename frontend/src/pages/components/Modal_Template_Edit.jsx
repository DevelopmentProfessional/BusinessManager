import React, { useState, useRef, lazy, Suspense, useCallback, useMemo } from 'react';
import { XMarkIcon, CheckIcon, ChevronDownIcon, ChevronUpIcon, PhotoIcon, TableCellsIcon, VariableIcon, QuestionMarkCircleIcon } from '@heroicons/react/24/outline';
import { TEMPLATE_VARIABLES, SCOPE_PAGE_CONTEXT, LAYOUT_TEMPLATES } from './Utils_Template_Variables';
import { documentsAPI } from '../../services/api';
import EditorToolbar from './editors/EditorToolbar';

const RichTextEditor = lazy(() => import('./editors/RichTextEditor'));

// ─── Constants ────────────────────────────────────────────────────────────────

const TEMPLATE_TYPES = [
  { value: 'email',   label: 'Email' },
  { value: 'invoice', label: 'Invoice' },
  { value: 'receipt', label: 'Receipt' },
  { value: 'memo',    label: 'Memo' },
  { value: 'quote',   label: 'Quote' },
  { value: 'custom',  label: 'Custom' },
];

const PAGE_OPTIONS = [
  { value: 'clients',   label: 'Clients' },
  { value: 'employees', label: 'Employees' },
  { value: 'sales',     label: 'Sales' },
  { value: 'schedule',  label: 'Schedule' },
];

// Tailwind colour helpers for scope badges
const SCOPE_COLORS = {
  gray:   'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  blue:   'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  green:  'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  amber:  'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  purple: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
};

const PAGE_LABEL = { clients: 'Clients', employees: 'Employees', sales: 'Sales', schedule: 'Schedule' };

// ─── Picker tab IDs ───────────────────────────────────────────────────────────
const TAB_NONE     = null;
const TAB_VARS     = 'vars';
const TAB_LAYOUTS  = 'layouts';
const TAB_IMAGES   = 'images';

// ─── Component ────────────────────────────────────────────────────────────────

export default function Modal_Template_Editor({ template, onSave, onClose }) {
  const isNew      = !template?.id;
  const isStandard = template?.is_standard === true;

  // ── Meta state ──────────────────────────────────────────────────────────────
  const [name,            setName]            = useState(template?.name || '');
  const [description,     setDescription]     = useState(template?.description || '');
  const [templateType,    setTemplateType]     = useState(template?.template_type || 'custom');
  const [accessiblePages, setAccessiblePages] = useState(() => {
    try { return JSON.parse(template?.accessible_pages || '[]'); }
    catch { return []; }
  });
  const [content, setContent] = useState(template?.content || '');
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState('');
  const [saveStatus, setSaveStatus] = useState('idle');

  // ── Picker state ─────────────────────────────────────────────────────────────
  const [activeTab,   setActiveTab]   = useState(TAB_NONE);
  const [openScope,   setOpenScope]   = useState(null);
  const [images,      setImages]      = useState([]);
  const [loadingImgs, setLoadingImgs] = useState(false);
  const [showDescriptionHelp, setShowDescriptionHelp] = useState(false);
  const [showPagesDropup, setShowPagesDropup] = useState(false);
  const [showInsertDropup, setShowInsertDropup] = useState(false);
  const [editorInstance, setEditorInstance] = useState(null);

  const editorRef = useRef(null);
  const originalPages = useMemo(() => {
    try { return JSON.parse(template?.accessible_pages || '[]'); }
    catch { return []; }
  }, [template?.accessible_pages]);
  const isDirty =
    name !== (template?.name || '') ||
    description !== (template?.description || '') ||
    templateType !== (template?.template_type || 'custom') ||
    JSON.stringify([...accessiblePages].sort()) !== JSON.stringify([...originalPages].sort()) ||
    content !== (template?.content || '');

  // ── Helpers ──────────────────────────────────────────────────────────────────

  const toggleTab = (tab) => setActiveTab((prev) => (prev === tab ? TAB_NONE : tab));

  const insertVariable = (key) => {
    const editor = editorRef.current;
    if (editor) editor.chain().focus().insertContent(`{{${key}}}`).run();
  };

  const insertHtml = (html) => {
    const editor = editorRef.current;
    if (editor) editor.chain().focus().insertContent(html).run();
  };

  const insertImage = (doc) => {
    const editor = editorRef.current;
    if (!editor) return;
    const src = documentsAPI.fileUrl(doc.id);
    const alt = doc.original_filename || doc.filename || '';
    editor.chain().focus().setImage({ src, alt, width: 320, float: 'none' }).run();
    setActiveTab(TAB_NONE);
  };

  const editorCallbackRef = useCallback((instance) => {
    editorRef.current = instance;
    setEditorInstance(instance || null);
  }, []);

  const loadImages = async () => {
    setLoadingImgs(true);
    try {
      const res  = await documentsAPI.getAll();
      const docs = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
      setImages(docs.filter((d) => (d.content_type || '').startsWith('image/')));
    } catch {
      setImages([]);
    } finally {
      setLoadingImgs(false);
    }
  };

  const handleTabClick = (tab) => {
    if (tab === TAB_IMAGES && activeTab !== TAB_IMAGES && images.length === 0) loadImages();
    toggleTab(tab);
  };

  const handlePageToggle = (page) =>
    setAccessiblePages((prev) =>
      prev.includes(page) ? prev.filter((p) => p !== page) : [...prev, page]
    );

  const handleSave = async () => {
    if (!name.trim()) { setError('Template name is required'); return; }
    setSaving(true);
    setSaveStatus('saving');
    setError('');
    try {
      await onSave({
        name:             name.trim(),
        description:      description.trim() || null,
        template_type:    templateType,
        accessible_pages: JSON.stringify(accessiblePages),
        content,
        is_standard:      isStandard,
      });
      setSaveStatus('saved');
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to save template');
      setSaveStatus('error');
    } finally {
      setSaving(false);
    }
  };

  const handleUndo = () => {
    editorInstance?.chain().focus().undo().run();
  };

  const handleRedo = () => {
    editorInstance?.chain().focus().redo().run();
  };

  // ── Toolbar tab button ───────────────────────────────────────────────────────
  const TabBtn = ({ id, icon: Icon, label }) => (
    <button
      type="button"
      onClick={() => handleTabClick(id)}
      className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded transition-colors ${
        activeTab === id
          ? 'bg-primary-600 text-white'
          : 'text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20'
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );

  // ── Scope row in Variables panel ─────────────────────────────────────────────
  const renderScopeRow = (scope) => {
    const vars   = TEMPLATE_VARIABLES[scope] || [];
    const ctx    = SCOPE_PAGE_CONTEXT[scope] || { label: scope, pages: [], color: 'gray' };
    const isOpen = openScope === scope;
    return (
      <div key={scope}>
        <button
          type="button"
          onClick={() => setOpenScope(isOpen ? null : scope)}
          className="w-full flex items-center justify-between py-0.5 hover:text-primary-600 dark:hover:text-primary-400"
        >
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 capitalize">
              {ctx.label}
            </span>
            {/* Page badges */}
            <div className="flex gap-1">
              {ctx.pages.map((pg) => (
                <span
                  key={pg}
                  className={`text-[10px] px-1 rounded ${SCOPE_COLORS[ctx.color]}`}
                >
                  {PAGE_LABEL[pg] || pg}
                </span>
              ))}
            </div>
          </div>
          {isOpen
            ? <ChevronUpIcon className="h-3 w-3 text-gray-400 flex-shrink-0" />
            : <ChevronDownIcon className="h-3 w-3 text-gray-400 flex-shrink-0" />}
        </button>

        {isOpen && (
          <div className="flex flex-wrap gap-1 pl-2 pb-1">
            {vars.map((v) => (
              <button
                key={v.key}
                type="button"
                onClick={() => insertVariable(v.key)}
                title={v.description}
                className={`px-2 py-0.5 rounded text-xs border ${
                  v.isLayout
                    ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-700 hover:bg-amber-200 dark:hover:bg-amber-800/50'
                    : 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 border-primary-200 dark:border-primary-700 hover:bg-primary-200 dark:hover:bg-primary-800/50'
                }`}
              >
                {v.isLayout ? '⊞ ' : ''}{`{{${v.key}}}`}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white dark:bg-gray-900" style={{ fontFamily: 'inherit' }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">
          {isNew ? 'New Template' : 'Edit Template'}
        </h2>
      </div>

      {/* ── Body ───────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Error banner */}
        <div className="flex-shrink-0 px-4 pt-3 pb-2">
          {error && (
            <div className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 rounded px-2 py-1">{error}</div>
          )}
        </div>

        {/* ── Editor area ─────────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* ── Variables panel ─────────────────────────────────────────── */}
          {activeTab === TAB_VARS && (
            <div className="flex-shrink-0 px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 overflow-y-auto max-h-52">
              <p className="text-[10px] text-gray-400 dark:text-gray-500 mb-1.5">
                Click a variable to insert it. Coloured badges show which page populates it.
                <span className="ml-1 text-amber-600 dark:text-amber-400">⊞ table variables</span> render as formatted tables.
              </p>
              <div className="space-y-1">
                {Object.keys(TEMPLATE_VARIABLES).map(renderScopeRow)}
              </div>
            </div>
          )}

          {/* ── Layouts panel ───────────────────────────────────────────── */}
          {activeTab === TAB_LAYOUTS && (
            <div className="flex-shrink-0 px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 overflow-y-auto max-h-52">
              <p className="text-[10px] text-gray-400 dark:text-gray-500 mb-1.5">
                Pre-built HTML blocks. Click to insert at the cursor. Data is filled when the template is used on the matching page.
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {LAYOUT_TEMPLATES.map((layout) => (
                  <button
                    key={layout.id}
                    type="button"
                    onClick={() => insertHtml(layout.html)}
                    className="text-left p-2 rounded border border-gray-200 dark:border-gray-600 hover:border-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-1">
                      <span className="text-xs font-medium text-gray-800 dark:text-gray-200 leading-tight">
                        {layout.label}
                      </span>
                      <div className="flex flex-col gap-0.5 flex-shrink-0">
                        {layout.pages.map((pg) => (
                          <span key={pg} className="text-[9px] px-1 rounded bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 whitespace-nowrap">
                            {PAGE_LABEL[pg]}
                          </span>
                        ))}
                      </div>
                    </div>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 leading-tight">
                      {layout.description}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Images panel ────────────────────────────────────────────── */}
          {activeTab === TAB_IMAGES && (
            <div className="flex-shrink-0 px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 overflow-y-auto max-h-52">
              {loadingImgs ? (
                <p className="text-xs text-gray-500">Loading images…</p>
              ) : images.length === 0 ? (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  No images found. Upload images in the Documents section first, then return here.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {images.map((doc) => (
                    <button
                      key={doc.id}
                      type="button"
                      onClick={() => insertImage(doc)}
                      title={`Insert: ${doc.original_filename || doc.filename}`}
                      className="flex flex-col items-center gap-1 p-1 rounded border border-gray-200 dark:border-gray-600 hover:border-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
                    >
                      <img
                        src={documentsAPI.fileUrl(doc.id)}
                        alt={doc.original_filename || ''}
                        className="h-16 w-16 object-cover rounded"
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                      <span className="text-xs text-gray-600 dark:text-gray-400 max-w-[64px] truncate">
                        {doc.original_filename || doc.filename}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Rich text editor */}
          <div className="flex-1 overflow-hidden p-2">
            <div className="h-full border border-gray-300 dark:border-gray-600 rounded overflow-hidden">
              <Suspense fallback={<div className="flex items-center justify-center h-full text-sm text-gray-500">Loading editor…</div>}>
                <RichTextEditor ref={editorCallbackRef} content={content} onChange={setContent} />
              </Suspense>
            </div>
          </div>
        </div>
      </div>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        {/* Row 1: contextual editor controls */}
        <EditorToolbar
          editorType="richtext"
          editor={editorInstance}
          onSave={handleSave}
          onUndo={handleUndo}
          onRedo={handleRedo}
          isDirty={isDirty}
          isSaving={saving}
          saveStatus={saveStatus}
          showDesignTab={false}
        />

        {/* Row 2: template metadata + dropups */}
        <div className="px-3 py-2 border-t border-gray-200 dark:border-gray-700 d-flex align-items-center gap-2 flex-wrap">
          <div className="d-flex align-items-center gap-1" style={{ minWidth: '240px', flex: '1 1 240px' }}>
            <div className="d-flex align-items-center gap-1">
              <input
                type="text"
                value={name}
                onChange={(e) => { setName(e.target.value); setSaveStatus('idle'); }}
                className="form-control form-control-sm"
                style={{ minWidth: '160px', maxWidth: '260px' }}
                placeholder="Template name"
              />
              <div className="position-relative">
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm d-flex align-items-center justify-content-center"
                  style={{ width: '2rem', height: '2rem' }}
                  onClick={() => setShowDescriptionHelp((prev) => !prev)}
                  title="Template description"
                >
                  <QuestionMarkCircleIcon className="h-4 w-4" />
                </button>
                {showDescriptionHelp && (
                  <div
                    className="position-absolute bottom-100 start-0 mb-2 p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow"
                    style={{ width: '280px', zIndex: 20 }}
                  >
                    <label className="form-label text-xs mb-1">Template description</label>
                    <textarea
                      value={description}
                      onChange={(e) => { setDescription(e.target.value); setSaveStatus('idle'); }}
                      className="form-control form-control-sm"
                      rows={3}
                      placeholder="Describe this template"
                    />
                  </div>
                )}
              </div>
            </div>

            <select
              value={templateType}
              onChange={(e) => { setTemplateType(e.target.value); setSaveStatus('idle'); }}
              className="form-select form-select-sm"
              style={{ width: '120px' }}
              title="Template type"
            >
              {TEMPLATE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>

            <div className="position-relative">
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1"
                onClick={() => setShowPagesDropup((prev) => !prev)}
                title="Available pages"
              >
                Pages <ChevronUpIcon className="h-3 w-3" />
              </button>
              {showPagesDropup && (
                <div
                  className="position-absolute bottom-100 start-0 mb-2 p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow"
                  style={{ minWidth: '180px', zIndex: 20 }}
                >
                  {PAGE_OPTIONS.map((pg) => (
                    <label key={pg.value} className="d-flex align-items-center gap-2 small py-1">
                      <input
                        type="checkbox"
                        checked={accessiblePages.includes(pg.value)}
                        onChange={() => { handlePageToggle(pg.value); setSaveStatus('idle'); }}
                      />
                      <span>{pg.label}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="position-relative">
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1"
                onClick={() => setShowInsertDropup((prev) => !prev)}
                title="Insert options"
              >
                Insert <ChevronUpIcon className="h-3 w-3" />
              </button>
              {showInsertDropup && (
                <div
                  className="position-absolute bottom-100 start-0 mb-2 p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow"
                  style={{ minWidth: '180px', zIndex: 20 }}
                >
                  <button
                    type="button"
                    className="btn btn-sm w-100 text-start"
                    onClick={() => { handleTabClick(TAB_VARS); setShowInsertDropup(false); }}
                  >
                    <VariableIcon className="h-3.5 w-3.5 me-1" /> Variables
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm w-100 text-start"
                    onClick={() => { handleTabClick(TAB_LAYOUTS); setShowInsertDropup(false); }}
                  >
                    <TableCellsIcon className="h-3.5 w-3.5 me-1" /> Layouts
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm w-100 text-start"
                    onClick={() => { handleTabClick(TAB_IMAGES); setShowInsertDropup(false); }}
                  >
                    <PhotoIcon className="h-3.5 w-3.5 me-1" /> Images
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Row 3: actions */}
        <div
          className="px-3 pt-2 pb-4 border-t border-gray-200 dark:border-gray-700 align-items-center gap-2"
          style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr' }}
        >
          <div className="d-flex align-items-center">
            <button
              type="button"
              onClick={handleSave}
              className="btn btn-primary btn-sm d-flex align-items-center gap-1"
              disabled={saving}
              title="Save Template"
            >
              {saving ? (
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <CheckIcon className="h-4 w-4 flex-shrink-0" />
              )}
              <span className="d-none d-sm-inline">{saving ? 'Saving…' : 'Save'}</span>
            </button>
          </div>

          <div className="d-flex align-items-center justify-content-center">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary btn-sm d-flex align-items-center gap-1"
              disabled={saving}
              title="Cancel"
            >
              <XMarkIcon className="h-4 w-4 flex-shrink-0" />
              <span className="d-none d-sm-inline">Cancel</span>
            </button>
          </div>

          <div />
        </div>
      </div>
    </div>
  );
}
