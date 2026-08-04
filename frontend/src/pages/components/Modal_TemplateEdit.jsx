import React, { useState, useRef, lazy, Suspense, useCallback, useMemo } from "react";
import { XMarkIcon, CheckIcon, PhotoIcon, TableCellsIcon, VariableIcon, QuestionMarkCircleIcon, DocumentTextIcon } from "@heroicons/react/24/outline";
import { TEMPLATE_VARIABLES, SCOPE_PAGE_CONTEXT, LAYOUT_TEMPLATES } from "./Utils_TemplateVariables";
import { documentsAPI } from "../../services/api";
import Editor_Toolbar from "./editors/Editor_Toolbar";
import Modal from "./Modal";
import { sortItemsAlphabetically } from "../../utils/displaySort";
import Dropdown_Custom from "./Dropdown_Custom";

const Editor_RichText = lazy(() => import("./editors/Editor_RichText"));

// ─── Constants ────────────────────────────────────────────────────────────────

const TEMPLATE_TYPES = [
  { value: "email", label: "Email" },
  { value: "invoice", label: "Invoice" },
  { value: "receipt", label: "Receipt" },
  { value: "memo", label: "Memo" },
  { value: "quote", label: "Quote" },
  { value: "custom", label: "Custom" },
];

const PAGE_OPTIONS = [
  { value: "clients", label: "Clients" },
  { value: "employees", label: "Employees" },
  { value: "sales", label: "Sales" },
  { value: "schedule", label: "Schedule" },
];

// Tailwind colour helpers for scope badges
const SCOPE_COLORS = {
  gray: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
  blue: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  green: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  amber: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  purple: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
};

const PAGE_LABEL = { clients: "Clients", employees: "Employees", sales: "Sales", schedule: "Schedule" };

// ─── Picker tab IDs ───────────────────────────────────────────────────────────
const TAB_NONE = null;
const TAB_VARS = "vars";
const TAB_LAYOUTS = "layouts";
const TAB_IMAGES = "images";

// ─── Component ────────────────────────────────────────────────────────────────

export default function Modal_Template_Editor({ template, onSave, onClose }) {
  const isNew = !template?.id;
  const isStandard = template?.is_standard === true;

  // ── Meta state ──────────────────────────────────────────────────────────────
  const [name, setName] = useState(template?.name || "");
  const [description, setDescription] = useState(template?.description || "");
  const [templateType, setTemplateType] = useState(template?.template_type || "custom");
  const [accessiblePages, setAccessiblePages] = useState(() => {
    try {
      return JSON.parse(template?.accessible_pages || "[]");
    } catch {
      return [];
    }
  });
  const [content, setContent] = useState(template?.content || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saveStatus, setSaveStatus] = useState("idle");

  // ── Picker state ─────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState(TAB_NONE);
  const [openScope, setOpenScope] = useState(null);
  const [images, setImages] = useState([]);
  const [loadingImgs, setLoadingImgs] = useState(false);
  const [showDescriptionHelp, setShowDescriptionHelp] = useState(false);
  const [showPagesDropup, setShowPagesDropup] = useState(false);
  const [showInsertDropup, setShowInsertDropup] = useState(false);
  const [editorInstance, setEditorInstance] = useState(null);

  const editorRef = useRef(null);
  const originalPages = useMemo(() => {
    try {
      return JSON.parse(template?.accessible_pages || "[]");
    } catch {
      return [];
    }
  }, [template?.accessible_pages]);
  const isDirty = name !== (template?.name || "") || description !== (template?.description || "") || templateType !== (template?.template_type || "custom") || JSON.stringify([...accessiblePages].sort()) !== JSON.stringify([...originalPages].sort()) || content !== (template?.content || "");
  const sortedTemplateTypes = useMemo(() => sortItemsAlphabetically(TEMPLATE_TYPES, ["label"]), []);
  const sortedPageOptions = useMemo(() => sortItemsAlphabetically(PAGE_OPTIONS, ["label"]), []);
  const sortedLayoutTemplates = useMemo(() => sortItemsAlphabetically(LAYOUT_TEMPLATES, ["label"]), []);
  const sortedImages = useMemo(() => sortItemsAlphabetically(images, ["original_filename", "filename"]), [images]);

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
    const alt = doc.original_filename || doc.filename || "";
    editor.chain().focus().setImage({ src, alt, width: 320, float: "none" }).run();
    setActiveTab(TAB_NONE);
  };

  const editorCallbackRef = useCallback((instance) => {
    editorRef.current = instance;
    setEditorInstance(instance || null);
  }, []);

  const loadImages = async () => {
    setLoadingImgs(true);
    try {
      const res = await documentsAPI.getAll();
      const docs = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
      setImages(sortItemsAlphabetically(docs.filter((d) => (d.content_type || "").startsWith("image/")), ["original_filename", "filename"]));
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

  const handlePageToggle = (page) => setAccessiblePages((prev) => (prev.includes(page) ? prev.filter((p) => p !== page) : [...prev, page]));

  const handleSave = async () => {
    if (!name.trim()) {
      setError("Template name is required");
      return;
    }
    setSaving(true);
    setSaveStatus("saving");
    setError("");
    try {
      await onSave({
        name: name.trim(),
        description: description.trim() || null,
        template_type: templateType,
        accessible_pages: JSON.stringify(accessiblePages),
        content,
        is_standard: isStandard,
      });
      setSaveStatus("saved");
    } catch (err) {
      setError(err?.response?.data?.detail || "Failed to save template");
      setSaveStatus("error");
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
    <button type="button" onClick={() => handleTabClick(id)} className={`flex items-center gap-1 text-xs px-0 py-0.5 rounded transition-colors ${activeTab === id ? "bg-primary-600 text-white" : "text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20"}`}>
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );

  // ── Scope row in Variables panel ─────────────────────────────────────────────
  const renderScopeRow = (scope) => {
    const vars = sortItemsAlphabetically(TEMPLATE_VARIABLES[scope] || [], ["key", "description"]);
    const ctx = SCOPE_PAGE_CONTEXT[scope] || { label: scope, pages: [], color: "gray" };
    const isOpen = openScope === scope;
    return (
      <div key={scope}>
        <button type="button" onClick={() => setOpenScope(isOpen ? null : scope)} className="dark:hover:text-primary-400 flex hover:text-primary-600 items-center justify-between py-0.5 w-full">
          <div className="flex gap-1.5 items-center">
            <span className="capitalize dark:text-gray-300 font-semibold text-gray-700 text-xs">{ctx.label}</span>
            {/* Page badges */}
            <div className="flex gap-1">
              {ctx.pages.map((pg) => (
                <span key={pg} className={`text-[10px] px-1 rounded ${SCOPE_COLORS[ctx.color]}`}>
                  {PAGE_LABEL[pg] || pg}
                </span>
              ))}
            </div>
          </div>
        </button>

        {isOpen && (
          <div className="flex flex-wrap gap-1 pb-1 pl-0">
            {vars.map((v) => (
              <button
                key={v.key}
                type="button"
                onClick={() => insertVariable(v.key)}
                title={v.description}
                className={`px-0 py-0.5 rounded text-xs border ${
                  v.isLayout
                    ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-700 hover:bg-amber-200 dark:hover:bg-amber-800/50"
                    : "bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 border-primary-200 dark:border-primary-700 hover:bg-primary-200 dark:hover:bg-primary-800/50"
                }`}
              >
                {v.isLayout ? "⊞ " : ""}
                {`{{${v.key}}}`}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <Modal isOpen onClose={onClose} noPadding fullScreen>
      <div className="ui-component-shell">
        <div className="component-header">
          <div className="component-header-left">
            <DocumentTextIcon className="app-icon me-1 text-muted" aria-hidden="true" />
            {isNew ? "New Template" : "Edit Template"}
          </div>
          <div className="component-header-center"></div>
          <div className="component-header-right"></div>
        </div>

        {/* ── Body ───────────────────────────────────────────────────────────── */}
        <div className="component-body">
          <div className="component-body-inner template-editor-body">
            {/* Error banner */}
            <div className="flex-shrink-0 pb-0 pt-1 px-1">{error && <div className="bg-red-50 dark:bg-red-900/20 px-0 py-1 rounded text-red-600 text-sm">{error}</div>}</div>

            {/* ── Editor area ─────────────────────────────────────────────────── */}
            <div className="flex flex-1 flex-col overflow-hidden template-editor-content-shell">
              {/* ── Variables panel ─────────────────────────────────────────── */}
              {activeTab === TAB_VARS && (
                <div className="bg-gray-50 border-b border-gray-200 dark:bg-gray-800 dark:border-gray-700 flex-shrink-0 max-h-52 overflow-y-auto px-1 py-0">
                  <p className="dark:text-gray-500 mb-1.5 text-[10px] text-gray-400">
                    Click a variable to insert it. Coloured badges show which page populates it.
                    <span className="dark:text-amber-400 ml-1 text-amber-600">⊞ table variables</span> render as formatted tables.
                  </p>
                  <div className="space-y-1">{sortItemsAlphabetically(Object.keys(TEMPLATE_VARIABLES)).map(renderScopeRow)}</div>
                </div>
              )}

              {/* ── Layouts panel ───────────────────────────────────────────── */}
              {activeTab === TAB_LAYOUTS && (
                <div className="bg-gray-50 border-b border-gray-200 dark:bg-gray-800 dark:border-gray-700 flex-shrink-0 max-h-52 overflow-y-auto px-1 py-0">
                  <p className="dark:text-gray-500 mb-1.5 text-[10px] text-gray-400">Pre-built HTML blocks. Click to insert at the cursor. Data is filled when the template is used on the matching page.</p>
                  <div className="gap-1.5 grid grid-cols-2">
                    {sortedLayoutTemplates.map((layout) => (
                      <button key={layout.id} type="button" onClick={() => insertHtml(layout.html)} className="border border-gray-200 dark:border-gray-600 dark:hover:bg-primary-900/20 hover:bg-primary-50 hover:border-primary-400 p-0 rounded text-left transition-colors">
                        <div className="flex gap-1 items-start justify-between">
                          <span className="dark:text-gray-200 font-medium leading-tight text-gray-800 text-xs">{layout.label}</span>
                          <div className="flex flex-col flex-shrink-0 gap-0.5">
                            {layout.pages.map((pg) => (
                              <span key={pg} className="bg-primary-100 dark:bg-primary-900/30 dark:text-primary-300 px-1 rounded text-[9px] text-primary-700 whitespace-nowrap">
                                {PAGE_LABEL[pg]}
                              </span>
                            ))}
                          </div>
                        </div>
                        <p className="dark:text-gray-400 leading-tight mt-0.5 text-[10px] text-gray-500">{layout.description}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Images panel ────────────────────────────────────────────── */}
              {activeTab === TAB_IMAGES && (
                <div className="bg-gray-50 border-b border-gray-200 dark:bg-gray-800 dark:border-gray-700 flex-shrink-0 max-h-52 overflow-y-auto px-1 py-0">
                  {loadingImgs ? (
                    <p className="text-gray-500 text-xs">Loading images…</p>
                  ) : sortedImages.length === 0 ? (
                    <p className="ui-muted-xs">No images found. Upload images in the Documents section first, then return here.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {sortedImages.map((doc) => (
                        <button
                          key={doc.id}
                          type="button"
                          onClick={() => insertImage(doc)}
                          title={`Insert: ${doc.original_filename || doc.filename}`}
                          className="border border-gray-200 dark:border-gray-600 dark:hover:bg-primary-900/20 flex flex-col gap-1 hover:bg-primary-50 hover:border-primary-400 items-center p-1 rounded transition-colors"
                        >
                          <img
                            src={documentsAPI.fileUrl(doc.id)}
                            alt={doc.original_filename || ""}
                            className="h-16 object-cover rounded w-16"
                            onError={(e) => {
                              e.target.style.display = "none";
                            }}
                          />
                          <span className="dark:text-gray-400 max-w-[64px] text-gray-600 text-xs truncate">{doc.original_filename || doc.filename}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Rich text editor */}
              <div className="flex-1 overflow-hidden p-0 template-editor-richtext-wrap">
                <div className="border border-gray-300 dark:border-gray-600 h-full overflow-hidden rounded">
                  <Suspense fallback={<div className="flex h-full items-center justify-center text-gray-500 text-sm">Loading editor…</div>}>
                    <Editor_RichText ref={editorCallbackRef} content={content} onChange={setContent} />
                  </Suspense>
                </div>
              </div>
            </div>
            {/* /component-body-inner */}
          </div>
          {/* /component-body-inner */}
        </div>
        {/* /component-body */}

        {/* ── Footer ─────────────────────────────────────────────────────────── */}
        <div className="component-footer d-flex flex-column p-0" style={{ gap: 0 }}>
          {/* Row 1: editor controls */}
          <Editor_Toolbar editorType="richtext" editor={editorInstance} onSave={handleSave} onUndo={handleUndo} onRedo={handleRedo} isDirty={isDirty} isSaving={saving} saveStatus={saveStatus} showDesignTab={false} />
          {/* Row 2: template metadata + dropups */}
          <div className="align-items-center border-top d-flex flex-wrap gap-2 px-1 py-0">
            <div className="ui-flex-center-gap-1" style={{ minWidth: "240px", flex: "1 1 240px" }}>
              <div className="ui-flex-center-gap-1">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setSaveStatus("idle");
                  }}
                  className="form-control ui-control-sm"
                  style={{ minWidth: "160px", maxWidth: "260px" }}
                  placeholder="Template name"
                />
                <div className="ui-pos-rel">
                  <button type="button" className="align-items-center btn btn-outline-secondary btn-sm d-flex justify-content-center" onClick={() => setShowDescriptionHelp((prev) => !prev)} title="Template description">
                    <QuestionMarkCircleIcon className="ui-icon-4" />
                  </button>
                  {showDescriptionHelp && (
                    <div className="app-menu-panel bg-white border border-gray-200 bottom-100 dark:bg-gray-800 dark:border-gray-700 mb-2 p-0 position-absolute rounded shadow start-0" style={{ width: "280px", zIndex: 20 }}>
                      <label className="form-label ui-form-label-xs">Template description</label>
                      <textarea
                        value={description}
                        onChange={(e) => {
                          setDescription(e.target.value);
                          setSaveStatus("idle");
                        }}
                        className="form-control ui-control-sm"
                        rows={3}
                        placeholder="Describe this template"
                      />
                    </div>
                  )}
                </div>
              </div>

              <Dropdown_Custom
                value={templateType}
                onChange={(e) => {
                  setTemplateType(e.target.value);
                  setSaveStatus("idle");
                }}
                className="form-select ui-control-sm"
                style={{ width: "120px" }}
                options={sortedTemplateTypes.map((t) => ({ value: t.value, label: t.label }))}
              />

              <div className="ui-pos-rel">
                <button type="button" className="align-items-center app-menu-trigger btn btn-outline-secondary btn-sm d-flex gap-1" onClick={() => setShowPagesDropup((prev) => !prev)} title="Available pages">
                  Pages
                </button>
                {showPagesDropup && (
                  <div className="app-menu-panel bg-white border border-gray-200 bottom-100 dark:bg-gray-800 dark:border-gray-700 mb-2 p-0 position-absolute rounded shadow start-0" style={{ minWidth: "180px", zIndex: 20 }}>
                    {sortedPageOptions.map((pg) => (
                      <label key={pg.value} className="align-items-center app-menu-item d-flex gap-2 py-1">
                        <input
                          type="checkbox"
                          checked={accessiblePages.includes(pg.value)}
                          onChange={() => {
                            handlePageToggle(pg.value);
                            setSaveStatus("idle");
                          }}
                        />
                        <span>{pg.label}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div className="ui-pos-rel">
                <button type="button" className="align-items-center app-menu-trigger btn btn-outline-secondary btn-sm d-flex gap-1" onClick={() => setShowInsertDropup((prev) => !prev)} title="Insert options">
                  Insert
                </button>
                {showInsertDropup && (
                  <div className="app-menu-panel bg-white border border-gray-200 bottom-100 dark:bg-gray-800 dark:border-gray-700 mb-2 p-0 position-absolute rounded shadow start-0" style={{ minWidth: "180px", zIndex: 20 }}>
                    <button
                      type="button"
                      className="app-menu-item btn btn-sm text-start w-100"
                      onClick={() => {
                        handleTabClick(TAB_VARS);
                        setShowInsertDropup(false);
                      }}
                    >
                      <VariableIcon className="h-3.5 me-1 w-3.5" /> Variables
                    </button>
                    <button
                      type="button"
                      className="app-menu-item btn btn-sm text-start w-100"
                      onClick={() => {
                        handleTabClick(TAB_LAYOUTS);
                        setShowInsertDropup(false);
                      }}
                    >
                      <TableCellsIcon className="h-3.5 me-1 w-3.5" /> Layouts
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm text-start w-100"
                      onClick={() => {
                        handleTabClick(TAB_IMAGES);
                        setShowInsertDropup(false);
                      }}
                    >
                      <PhotoIcon className="h-3.5 me-1 w-3.5" /> Images
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Row 3: save/cancel */}
          <div className="align-items-center border-top d-flex gap-1 p-0">
            <div className="component-footer-left">
              <button type="button" onClick={handleSave} className="align-items-center btn btn-primary btn-sm d-flex gap-1" disabled={saving} title="Save Template">
                {saving ? (
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <CheckIcon className="flex-shrink-0 h-4 w-4" />
                )}
                <span className="d-none d-sm-inline">{saving ? "Saving…" : isNew ? "Add" : "Save"}</span>
              </button>
            </div>
            <div className="component-footer-center">
              <button type="button" className="btn ui-btn-circle-outline-secondary" onClick={onClose} disabled={saving} title="Cancel">
                <XMarkIcon />
              </button>
            </div>
            <div className="component-footer-right"></div>
          </div>
        </div>
        {/* /component-footer */}
      </div>
      {/* /component */}
    </Modal>
  );
}
