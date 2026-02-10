import React from 'react';

function ToolButton({ active, onClick, title, children, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`px-2 py-1 text-sm rounded transition-colors ${
        active
          ? 'bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300'
          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
      } ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1" />;
}

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
  const statusText = {
    idle: isDirty ? 'Unsaved changes' : '',
    saving: 'Saving...',
    saved: 'Saved',
    error: 'Save failed',
  };

  const statusColor = {
    idle: isDirty ? 'text-amber-600 dark:text-amber-400' : 'text-gray-400',
    saving: 'text-blue-600 dark:text-blue-400',
    saved: 'text-green-600 dark:text-green-400',
    error: 'text-red-600 dark:text-red-400',
  };

  return (
    <div className="flex items-center gap-1 px-3 py-1.5 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex-wrap">
      {/* Shared: Save, Undo, Redo */}
      <ToolButton
        onClick={onSave}
        disabled={!isDirty || isSaving}
        title="Save (Ctrl+S)"
      >
        {isSaving ? (
          <span className="flex items-center gap-1">
            <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Save
          </span>
        ) : (
          'Save'
        )}
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

      <span className={`text-xs ml-1 ${statusColor[saveStatus] || ''}`}>
        {statusText[saveStatus] || ''}
      </span>

      {/* Rich Text Tools */}
      {editorType === 'richtext' && editor && (
        <>
          <Divider />
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

          <Divider />

          <select
            className="text-sm border border-gray-300 dark:border-gray-600 rounded px-1 py-0.5 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300"
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
          >
            <option value="0">Paragraph</option>
            <option value="1">Heading 1</option>
            <option value="2">Heading 2</option>
            <option value="3">Heading 3</option>
          </select>

          <Divider />

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
          <ToolButton
            active={editor.isActive('codeBlock')}
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            title="Code Block"
          >
            {'</>'}
          </ToolButton>

          <Divider />

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
        </>
      )}

      {/* Code Tools */}
      {editorType === 'code' && (
        <>
          <Divider />
          <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">
            Syntax highlighting active
          </span>
        </>
      )}
    </div>
  );
}
