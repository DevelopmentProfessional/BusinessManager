import React, { useEffect, useImperativeHandle, forwardRef, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';
import { TextStyle, Color, FontFamily, FontSize, LineHeight } from '@tiptap/extension-text-style';
import { Highlight } from '@tiptap/extension-highlight';
import { Superscript } from '@tiptap/extension-superscript';
import { Subscript } from '@tiptap/extension-subscript';
import { Indent } from './extensions/Indent';
import { SearchAndReplace } from './extensions/SearchAndReplace';

const RichTextEditor = forwardRef(function RichTextEditor({ content, onChange }, ref) {
  const contentRef = useRef(content);
  
  // Keep track of initial mount
  const isInitialMount = useRef(true);
  
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
        alignments: ['left', 'center', 'right', 'justify'],
      }),
      Placeholder.configure({
        placeholder: 'Start typing...',
      }),
      TextStyle,
      Color,
      FontFamily,
      FontSize,
      LineHeight,
      Highlight.configure({ multicolor: true }),
      Superscript,
      Subscript,
      Indent,
      SearchAndReplace,
    ],
    content: '',
    onUpdate: ({ editor }) => {
      onChange?.(editor.getHTML());
    },
  });

  useImperativeHandle(ref, () => editor, [editor]);

  // Update content when prop changes (e.g., initial load)
  useEffect(() => {
    if (!editor) return;
    
    // Only update if content actually changed
    if (contentRef.current !== content) {
      contentRef.current = content;
      const newContent = content || '';
      console.log('Setting editor content:', { 
        hasContent: !!newContent, 
        length: newContent.length,
        preview: newContent.substring(0, 100) 
      });
      editor.commands.setContent(newContent, false);
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
        className="flex-1 min-h-0 overflow-auto tiptap-editor"
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
          width: 100%;
          box-sizing: border-box;
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
        .tiptap-editor .tiptap hr {
          border: none;
          border-top: 2px solid #d1d5db;
          margin: 1.5rem 0;
        }
        .tiptap-editor .tiptap mark {
          border-radius: 0.15rem;
          padding: 0.05rem 0.15rem;
        }
        .tiptap-editor .tiptap sup { font-size: 0.75em; }
        .tiptap-editor .tiptap sub { font-size: 0.75em; }
        .tiptap-editor .tiptap .is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: #9ca3af;
          pointer-events: none;
          height: 0;
        }
        /* Search result highlights */
        .tiptap-editor .tiptap .search-result {
          background-color: #fef08a;
          border-radius: 2px;
        }
        .tiptap-editor .tiptap .search-result-active {
          background-color: #f97316;
          color: white;
          border-radius: 2px;
        }
        /* Dark mode */
        .dark .tiptap-editor .tiptap code { background: #374151; }
        .dark .tiptap-editor .tiptap blockquote { border-left-color: #4b5563; color: #9ca3af; }
        .dark .tiptap-editor .tiptap hr { border-top-color: #4b5563; }
        .dark .tiptap-editor .tiptap .search-result { background-color: #854d0e; color: #fef3c7; }
        .dark .tiptap-editor .tiptap .search-result-active { background-color: #ea580c; color: white; }
      `}</style>
    </div>
  );
});

export default RichTextEditor;
