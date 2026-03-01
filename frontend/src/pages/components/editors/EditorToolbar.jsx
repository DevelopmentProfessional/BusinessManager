/*
 * ============================================================
 * FILE: EditorToolbar.jsx
 *
 * PURPOSE:
 *   Renders a context-aware toolbar for both the rich-text (Tiptap) and code
 *   (CodeMirror) editors. For rich text it presents a tabbed ribbon with Home,
 *   Find & Replace, and Design tabs; for code it renders a minimal Save/Undo/Redo
 *   strip. All formatting commands are dispatched directly to the Tiptap editor
 *   instance passed in via props.
 *
 * FUNCTIONAL PARTS:
 *   [1] Reusable UI Primitives  — ToolButton, Divider, ColorButton helper components
 *   [2] Static Data Constants   — FONT_FAMILIES, FONT_SIZES, LINE_SPACINGS, THEMES arrays
 *   [3] HomeTab Panel           — inline formatting, font, paragraph, alignment, and spacing controls
 *   [4] FindTab Panel           — search input, match counter, next/prev navigation, and replace controls
 *   [5] DesignTab Panel         — one-click theme presets that apply font + color across the document
 *   [6] StatusBadge             — small inline save-status indicator (Unsaved / Saving / Saved / Failed)
 *   [7] EditorToolbar (main)    — tab orchestration, Ctrl+F shortcut, code-editor fallback rendering
 *
 * CHANGE LOG — all modifications to this file must be recorded here:
 *   Format : YYYY-MM-DD | Author | Description
 *   ─────────────────────────────────────────────────────────────
 *   2026-03-01 | Claude  | Added section comments and top-level documentation
 * ============================================================
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';

// ─── 1 REUSABLE UI PRIMITIVES ──────────────────────────────────────────────────

function ToolButton({ active, onClick, title, children, disabled, className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`px-1.5 py-1 text-sm rounded transition-colors ${
        active
          ? 'bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300'
          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
      } ${disabled ? 'opacity-40 cursor-not-allowed' : ''} ${className}`}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-0.5 flex-shrink-0" />;
}

function ColorButton({ value, onChange, title, label }) {
  const inputRef = useRef(null);
  return (
    <button
      type="button"
      title={title}
      onClick={() => inputRef.current?.click()}
      className="relative flex flex-col items-center px-1.5 py-0.5 text-sm rounded text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
    >
      <span className="text-xs font-bold">{label}</span>
      <span
        className="w-5 h-1 rounded-sm mt-0.5"
        style={{ backgroundColor: value || '#000000' }}
      />
      <input
        ref={inputRef}
        type="color"
        value={value || '#000000'}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
        tabIndex={-1}
      />
    </button>
  );
}

/* ── Font families & sizes ────────────────────────────────────────── */

const FONT_FAMILIES = [
  { label: 'Default', value: '' },
  { label: 'Arial', value: 'Arial, sans-serif' },
  { label: 'Times New Roman', value: 'Times New Roman, serif' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Garamond', value: 'Garamond, serif' },
  { label: 'Courier New', value: 'Courier New, monospace' },
  { label: 'Consolas', value: 'Consolas, monospace' },
  { label: 'Verdana', value: 'Verdana, sans-serif' },
  { label: 'Trebuchet MS', value: 'Trebuchet MS, sans-serif' },
  { label: 'Comic Sans MS', value: 'Comic Sans MS, cursive' },
  { label: 'Inter', value: 'Inter, sans-serif' },
];

const FONT_SIZES = [
  '8px', '9px', '10px', '11px', '12px', '14px', '16px',
  '18px', '20px', '24px', '28px', '32px', '36px', '48px', '72px',
];

const LINE_SPACINGS = [
  { label: '1.0', value: '1' },
  { label: '1.15', value: '1.15' },
  { label: '1.5', value: '1.5' },
  { label: '2.0', value: '2' },
  { label: '2.5', value: '2.5' },
  { label: '3.0', value: '3' },
];

/* ── Design themes ────────────────────────────────────────────────── */

const THEMES = [
  {
    name: 'Default',
    font: '',
    color: '',
    desc: 'System font, default colors',
  },
  {
    name: 'Formal',
    font: 'Georgia, serif',
    color: '#1a2744',
    desc: 'Classic serif, dark navy',
  },
  {
    name: 'Modern',
    font: 'Inter, sans-serif',
    color: '#1f2937',
    desc: 'Clean sans-serif, dark gray',
  },
  {
    name: 'Creative',
    font: 'Comic Sans MS, cursive',
    color: '#6d28d9',
    desc: 'Playful, purple tones',
  },
  {
    name: 'Elegant',
    font: 'Garamond, serif',
    color: '#44403c',
    desc: 'Refined serif, warm brown',
  },
  {
    name: 'Technical',
    font: 'Consolas, monospace',
    color: '#18181b',
    desc: 'Monospace, sharp contrast',
  },
];

/* ── Tab panels ───────────────────────────────────────────────────── */

function HomeTab({ editor, onSave, onUndo, onRedo, isDirty, isSaving, saveStatus }) {
  if (!editor) return null;

  const currentFontFamily = editor.getAttributes('textStyle').fontFamily || '';
  const currentFontSize = editor.getAttributes('textStyle').fontSize || '';
  const currentColor = editor.getAttributes('textStyle').color || '#000000';
  const currentHighlight = editor.getAttributes('highlight').color || '#ffff00';
  // Read current line-height from the active block node (paragraph or heading)
  const currentLineHeight = editor.getAttributes('paragraph').lineHeight
    || editor.getAttributes('heading').lineHeight
    || '';

  return (
    <div className="flex flex-col gap-1">
      {/* Row 1: Save, Undo/Redo, Font controls, Inline formatting */}
      <div className="flex items-center gap-1 flex-wrap">
        {/* Save */}
        <ToolButton onClick={onSave} disabled={!isDirty || isSaving} title="Save (Ctrl+S)">
          {isSaving ? (
            <span className="flex items-center gap-1">
              <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Save
            </span>
          ) : 'Save'}
        </ToolButton>
        <ToolButton onClick={onUndo} title="Undo (Ctrl+Z)">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
          </svg>
        </ToolButton>
        <ToolButton onClick={onRedo} title="Redo (Ctrl+Shift+Z)">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 15l6-6m0 0l-6-6m6 6H9a6 6 0 000 12h3" />
          </svg>
        </ToolButton>

        {/* Status */}
        <StatusBadge saveStatus={saveStatus} isDirty={isDirty} />

        <Divider />

        {/* Font Family */}
        <select
          className="text-xs border border-gray-300 dark:border-gray-600 rounded px-1 py-0.5 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 max-w-[120px]"
          value={currentFontFamily}
          onChange={(e) => {
            if (e.target.value) {
              editor.chain().focus().setFontFamily(e.target.value).run();
            } else {
              editor.chain().focus().unsetFontFamily().run();
            }
          }}
          title="Font Family"
        >
          {FONT_FAMILIES.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>

        {/* Font Size */}
        <select
          className="text-xs border border-gray-300 dark:border-gray-600 rounded px-1 py-0.5 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 w-[65px]"
          value={currentFontSize}
          onChange={(e) => {
            if (e.target.value) {
              editor.chain().focus().setFontSize(e.target.value).run();
            } else {
              editor.chain().focus().unsetFontSize().run();
            }
          }}
          title="Font Size"
        >
          <option value="">Size</option>
          {FONT_SIZES.map((s) => (
            <option key={s} value={s}>{parseInt(s)}</option>
          ))}
        </select>

        <Divider />

        {/* Bold, Italic, Underline, Strikethrough */}
        <ToolButton
          active={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="Bold (Ctrl+B)"
        >
          <strong>B</strong>
        </ToolButton>
        <ToolButton
          active={editor.isActive('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="Italic (Ctrl+I)"
        >
          <em>I</em>
        </ToolButton>
        <ToolButton
          active={editor.isActive('underline')}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          title="Underline (Ctrl+U)"
        >
          <span className="underline">U</span>
        </ToolButton>
        <ToolButton
          active={editor.isActive('strike')}
          onClick={() => editor.chain().focus().toggleStrike().run()}
          title="Strikethrough"
        >
          <span className="line-through">S</span>
        </ToolButton>

        <Divider />

        {/* Font Color */}
        <ColorButton
          value={currentColor}
          onChange={(color) => editor.chain().focus().setColor(color).run()}
          title="Font Color"
          label="A"
        />

        {/* Highlight Color */}
        <ColorButton
          value={currentHighlight}
          onChange={(color) => editor.chain().focus().toggleHighlight({ color }).run()}
          title="Highlight Color"
          label="H"
        />

        <Divider />

        {/* Superscript / Subscript */}
        <ToolButton
          active={editor.isActive('superscript')}
          onClick={() => editor.chain().focus().toggleSuperscript().run()}
          title="Superscript"
        >
          <span className="text-xs">X<sup className="text-[8px]">2</sup></span>
        </ToolButton>
        <ToolButton
          active={editor.isActive('subscript')}
          onClick={() => editor.chain().focus().toggleSubscript().run()}
          title="Subscript"
        >
          <span className="text-xs">X<sub className="text-[8px]">2</sub></span>
        </ToolButton>

        <Divider />

        {/* Clear Formatting */}
        <ToolButton
          onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}
          title="Clear Formatting"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
        </ToolButton>
      </div>

      {/* Row 2: Headings, Lists, Indent, Alignment, Line Spacing, HR */}
      <div className="flex items-center gap-1 flex-wrap">
        {/* Heading */}
        <select
          className="text-xs border border-gray-300 dark:border-gray-600 rounded px-1 py-0.5 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300"
          value={
            editor.isActive('heading', { level: 1 }) ? '1' :
            editor.isActive('heading', { level: 2 }) ? '2' :
            editor.isActive('heading', { level: 3 }) ? '3' : '0'
          }
          onChange={(e) => {
            const level = parseInt(e.target.value);
            if (level === 0) {
              editor.chain().focus().setParagraph().run();
            } else {
              editor.chain().focus().toggleHeading({ level }).run();
            }
          }}
          title="Block Style"
        >
          <option value="0">Paragraph</option>
          <option value="1">Heading 1</option>
          <option value="2">Heading 2</option>
          <option value="3">Heading 3</option>
        </select>

        <Divider />

        {/* Lists */}
        <ToolButton
          active={editor.isActive('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          title="Bullet List"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
          </svg>
        </ToolButton>
        <ToolButton
          active={editor.isActive('orderedList')}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          title="Ordered List"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" d="M8 6h13M8 12h13M8 18h13" />
            <text x="1" y="8" fontSize="7" fill="currentColor" fontFamily="sans-serif">1</text>
            <text x="1" y="14" fontSize="7" fill="currentColor" fontFamily="sans-serif">2</text>
            <text x="1" y="20" fontSize="7" fill="currentColor" fontFamily="sans-serif">3</text>
          </svg>
        </ToolButton>

        <Divider />

        {/* Indent / Outdent */}
        <ToolButton
          onClick={() => editor.chain().focus().indent().run()}
          title="Increase Indent (Tab)"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" d="M3 6h18M9 12h12M9 18h12M3 11l3 1.5L3 14" />
          </svg>
        </ToolButton>
        <ToolButton
          onClick={() => editor.chain().focus().outdent().run()}
          title="Decrease Indent (Shift+Tab)"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" d="M3 6h18M9 12h12M9 18h12M6 11l-3 1.5L6 14" />
          </svg>
        </ToolButton>

        <Divider />

        {/* Text Alignment */}
        <ToolButton
          active={editor.isActive({ textAlign: 'left' })}
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
          title="Align Left"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" d="M3 6h18M3 12h10M3 18h14" />
          </svg>
        </ToolButton>
        <ToolButton
          active={editor.isActive({ textAlign: 'center' })}
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
          title="Align Center"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" d="M3 6h18M7 12h10M5 18h14" />
          </svg>
        </ToolButton>
        <ToolButton
          active={editor.isActive({ textAlign: 'right' })}
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
          title="Align Right"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" d="M3 6h18M11 12h10M7 18h14" />
          </svg>
        </ToolButton>
        <ToolButton
          active={editor.isActive({ textAlign: 'justify' })}
          onClick={() => editor.chain().focus().setTextAlign('justify').run()}
          title="Justify"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" d="M3 6h18M3 12h18M3 18h18" />
          </svg>
        </ToolButton>

        <Divider />

        {/* Line Spacing */}
        <select
          className="text-xs border border-gray-300 dark:border-gray-600 rounded px-1 py-0.5 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 w-[55px]"
          value={currentLineHeight}
          onChange={(e) => {
            if (e.target.value) {
              editor.chain().focus().setLineHeight(e.target.value).run();
            } else {
              editor.chain().focus().unsetLineHeight().run();
            }
          }}
          title="Line Spacing"
        >
          <option value="">Sp.</option>
          {LINE_SPACINGS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>

        <Divider />

        {/* Blockquote */}
        <ToolButton
          active={editor.isActive('blockquote')}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          title="Block Quote"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" d="M8 10h.01M12 10h.01M6 4h12a2 2 0 012 2v8a2 2 0 01-2 2H8l-4 4V6a2 2 0 012-2z" />
          </svg>
        </ToolButton>

        {/* Code Block */}
        <ToolButton
          active={editor.isActive('codeBlock')}
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          title="Code Block"
        >
          {'</>'}
        </ToolButton>

        {/* Horizontal Rule */}
        <ToolButton
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          title="Horizontal Line"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" d="M3 12h18" />
          </svg>
        </ToolButton>
      </div>
    </div>
  );
}

function FindTab({ editor }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [replaceTerm, setReplaceTerm] = useState('');
  const searchInputRef = useRef(null);

  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  const matchCount = editor?.storage?.searchAndReplace?.results?.length || 0;
  const currentIdx = (editor?.storage?.searchAndReplace?.currentIndex || 0) + 1;

  const handleSearch = useCallback(
    (term) => {
      setSearchTerm(term);
      editor?.commands.setSearchTerm(term);
    },
    [editor]
  );

  const handleReplace = useCallback(
    (term) => {
      setReplaceTerm(term);
      editor?.commands.setReplaceTerm(term);
    },
    [editor]
  );

  return (
    <div className="flex flex-col gap-1.5">
      {/* Search row */}
      <div className="flex items-center gap-1.5">
        <input
          ref={searchInputRef}
          type="text"
          placeholder="Find..."
          value={searchTerm}
          onChange={(e) => handleSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.shiftKey
                ? editor?.commands.prevSearchResult()
                : editor?.commands.nextSearchResult();
            }
            if (e.key === 'Escape') {
              editor?.commands.clearSearch();
              setSearchTerm('');
              setReplaceTerm('');
            }
          }}
          className="text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 w-48"
        />
        <span className="text-xs text-gray-500 dark:text-gray-400 min-w-[50px]">
          {searchTerm ? `${matchCount > 0 ? currentIdx : 0}/${matchCount}` : ''}
        </span>
        <ToolButton
          onClick={() => editor?.commands.prevSearchResult()}
          disabled={matchCount === 0}
          title="Previous (Shift+Enter)"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
          </svg>
        </ToolButton>
        <ToolButton
          onClick={() => editor?.commands.nextSearchResult()}
          disabled={matchCount === 0}
          title="Next (Enter)"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </ToolButton>
      </div>

      {/* Replace row */}
      <div className="flex items-center gap-1.5">
        <input
          type="text"
          placeholder="Replace..."
          value={replaceTerm}
          onChange={(e) => handleReplace(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') editor?.commands.replaceCurrentResult();
          }}
          className="text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 w-48"
        />
        <ToolButton
          onClick={() => editor?.commands.replaceCurrentResult()}
          disabled={matchCount === 0}
          title="Replace"
        >
          Replace
        </ToolButton>
        <ToolButton
          onClick={() => editor?.commands.replaceAllResults()}
          disabled={matchCount === 0}
          title="Replace All"
        >
          All
        </ToolButton>
        <ToolButton
          onClick={() => {
            editor?.commands.clearSearch();
            setSearchTerm('');
            setReplaceTerm('');
          }}
          title="Clear Search"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </ToolButton>
      </div>
    </div>
  );
}

function DesignTab({ editor }) {
  if (!editor) return null;

  const applyTheme = (theme) => {
    // Build a single chain: select all, apply font + color, then collapse cursor
    const chain = editor.chain().focus().selectAll();

    // Font family
    if (theme.font) {
      chain.setFontFamily(theme.font);
    } else {
      chain.unsetFontFamily();
    }

    // Color
    if (theme.color) {
      chain.setColor(theme.color);
    } else {
      chain.unsetColor();
    }

    chain.run();

    // Collapse selection to start of document (position 1 = inside first node)
    editor.commands.setTextSelection(1);
  };

  return (
    <div className="flex items-center gap-2 py-0.5 flex-wrap">
      {THEMES.map((theme) => (
        <button
          key={theme.name}
          type="button"
          onClick={() => applyTheme(theme)}
          className="flex flex-col items-start px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md hover:border-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors min-w-[100px]"
          title={theme.desc}
        >
          <span
            className="text-sm font-medium leading-tight"
            style={{
              fontFamily: theme.font || 'inherit',
              color: theme.color || 'inherit',
            }}
          >
            {theme.name}
          </span>
          <span className="text-[10px] text-gray-400 dark:text-gray-500 leading-tight">
            {theme.desc}
          </span>
        </button>
      ))}
    </div>
  );
}

function StatusBadge({ saveStatus, isDirty }) {
  const statusText = {
    idle: isDirty ? 'Unsaved' : '',
    saving: 'Saving...',
    saved: 'Saved',
    error: 'Failed',
  };
  const statusColor = {
    idle: isDirty ? 'text-amber-600 dark:text-amber-400' : 'text-gray-400',
    saving: 'text-blue-600 dark:text-blue-400',
    saved: 'text-green-600 dark:text-green-400',
    error: 'text-red-600 dark:text-red-400',
  };

  const text = statusText[saveStatus] || '';
  if (!text) return null;

  return (
    <span className={`text-[10px] font-medium ml-0.5 ${statusColor[saveStatus] || ''}`}>
      {text}
    </span>
  );
}

/* ── Main Toolbar ─────────────────────────────────────────────────── */

export default function EditorToolbar({
  editorType,
  editor,
  onSave,
  onUndo,
  onRedo,
  isDirty,
  isSaving,
  saveStatus,
}) {
  const [activeTab, setActiveTab] = useState('home');

  // Ctrl+F opens Find tab
  useEffect(() => {
    const handleKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f' && editorType === 'richtext') {
        e.preventDefault();
        setActiveTab((prev) => (prev === 'find' ? 'home' : 'find'));
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [editorType]);

  // For code editors, keep the old minimal toolbar
  if (editorType === 'code') {
    return (
      <div className="flex items-center gap-1 px-3 py-1.5 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex-wrap">
        <ToolButton onClick={onSave} disabled={!isDirty || isSaving} title="Save (Ctrl+S)">
          {isSaving ? (
            <span className="flex items-center gap-1">
              <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Save
            </span>
          ) : 'Save'}
        </ToolButton>
        <ToolButton onClick={onUndo} title="Undo (Ctrl+Z)">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
          </svg>
        </ToolButton>
        <ToolButton onClick={onRedo} title="Redo (Ctrl+Shift+Z)">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 15l6-6m0 0l-6-6m6 6H9a6 6 0 000 12h3" />
          </svg>
        </ToolButton>
        <StatusBadge saveStatus={saveStatus} isDirty={isDirty} />
        <Divider />
        <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">
          Syntax highlighting active
        </span>
      </div>
    );
  }

  // Rich text editor: tabbed ribbon
  return (
    <div className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
      {/* Tab bar */}
      <div className="flex items-center gap-0 border-b border-gray-200 dark:border-gray-700 px-2">
        {['home', 'find', 'design'].map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1 text-xs font-medium capitalize border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-primary-500 text-primary-700 dark:text-primary-300'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {tab === 'find' ? 'Find & Replace' : tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="px-2 py-1">
        {activeTab === 'home' && (
          <HomeTab
            editor={editor}
            onSave={onSave}
            onUndo={onUndo}
            onRedo={onRedo}
            isDirty={isDirty}
            isSaving={isSaving}
            saveStatus={saveStatus}
          />
        )}
        {activeTab === 'find' && <FindTab editor={editor} />}
        {activeTab === 'design' && <DesignTab editor={editor} />}
      </div>
    </div>
  );
}
