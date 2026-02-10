import React, { useEffect, useImperativeHandle, forwardRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';

const RichTextEditor = forwardRef(function RichTextEditor({ content, onChange }, ref) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Placeholder.configure({
        placeholder: 'Start typing...',
      }),
    ],
    content: content || '',
    onUpdate: ({ editor }) => {
      onChange?.(editor.getHTML());
    },
  });

  useImperativeHandle(ref, () => editor, [editor]);

  // Update content when prop changes (e.g., initial load)
  useEffect(() => {
    if (editor && content !== undefined && content !== editor.getHTML()) {
      editor.commands.setContent(content || '', false);
    }
  }, [content, editor]);

  if (!editor) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <EditorContent
        editor={editor}
        className="flex-1 overflow-auto tiptap-editor"
      />
      <style>{`
        .tiptap-editor .tiptap {
          padding: 1.5rem;
          min-height: 100%;
          outline: none;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-size: 1rem;
          line-height: 1.75;
          color: inherit;
        }
        .tiptap-editor .tiptap h1 { font-size: 2rem; font-weight: 700; margin: 1rem 0 0.5rem; }
        .tiptap-editor .tiptap h2 { font-size: 1.5rem; font-weight: 600; margin: 0.75rem 0 0.5rem; }
        .tiptap-editor .tiptap h3 { font-size: 1.25rem; font-weight: 600; margin: 0.5rem 0 0.25rem; }
        .tiptap-editor .tiptap p { margin: 0.5rem 0; }
        .tiptap-editor .tiptap ul { list-style: disc; padding-left: 1.5rem; margin: 0.5rem 0; }
        .tiptap-editor .tiptap ol { list-style: decimal; padding-left: 1.5rem; margin: 0.5rem 0; }
        .tiptap-editor .tiptap li { margin: 0.25rem 0; }
        .tiptap-editor .tiptap blockquote {
          border-left: 3px solid #d1d5db;
          padding-left: 1rem;
          margin: 0.5rem 0;
          color: #6b7280;
        }
        .tiptap-editor .tiptap code {
          background: #f3f4f6;
          border-radius: 0.25rem;
          padding: 0.15rem 0.3rem;
          font-size: 0.9em;
          font-family: 'Fira Code', 'Consolas', monospace;
        }
        .tiptap-editor .tiptap pre {
          background: #1f2937;
          color: #e5e7eb;
          border-radius: 0.5rem;
          padding: 1rem;
          margin: 0.75rem 0;
          overflow-x: auto;
        }
        .tiptap-editor .tiptap pre code {
          background: none;
          padding: 0;
          color: inherit;
        }
        .tiptap-editor .tiptap .is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: #9ca3af;
          pointer-events: none;
          height: 0;
        }
        .dark .tiptap-editor .tiptap code { background: #374151; }
        .dark .tiptap-editor .tiptap blockquote { border-left-color: #4b5563; color: #9ca3af; }
      `}</style>
    </div>
  );
});

export default RichTextEditor;
