import React, { useMemo, useImperativeHandle, forwardRef, useRef, useCallback } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { json } from '@codemirror/lang-json';
import { css } from '@codemirror/lang-css';
import { html } from '@codemirror/lang-html';
import { xml } from '@codemirror/lang-xml';
import { python } from '@codemirror/lang-python';
import { sql } from '@codemirror/lang-sql';
import { markdown } from '@codemirror/lang-markdown';
import { oneDark } from '@codemirror/theme-one-dark';

const LANGUAGE_EXTENSIONS = {
  javascript: () => javascript({ jsx: true }),
  json: () => json(),
  css: () => css(),
  html: () => html(),
  xml: () => xml(),
  python: () => python(),
  sql: () => sql(),
  markdown: () => markdown(),
};

const CodeEditor = forwardRef(function CodeEditor({ content, onChange, language = 'text' }, ref) {
  const viewRef = useRef(null);

  const extensions = useMemo(() => {
    const langFn = LANGUAGE_EXTENSIONS[language];
    return langFn ? [langFn()] : [];
  }, [language]);

  const isDark = useMemo(() => {
    return document.documentElement.classList.contains('dark');
  }, []);

  useImperativeHandle(ref, () => ({
    undo: () => {
      if (viewRef.current?.view) {
        const { undo } = require('@codemirror/commands');
        undo(viewRef.current.view);
      }
    },
    redo: () => {
      if (viewRef.current?.view) {
        const { redo } = require('@codemirror/commands');
        redo(viewRef.current.view);
      }
    },
  }), []);

  const handleChange = useCallback((value) => {
    onChange?.(value);
  }, [onChange]);

  return (
    <div className="h-full overflow-hidden code-editor-wrapper">
      <CodeMirror
        ref={viewRef}
        value={content || ''}
        onChange={handleChange}
        extensions={extensions}
        theme={isDark ? oneDark : 'light'}
        height="100%"
        style={{ height: '100%' }}
        basicSetup={{
          lineNumbers: true,
          highlightActiveLineGutter: true,
          highlightActiveLine: true,
          foldGutter: true,
          bracketMatching: true,
          closeBrackets: true,
          autocompletion: true,
          indentOnInput: true,
        }}
      />
      <style>{`
        .code-editor-wrapper { height: 100%; }
        .code-editor-wrapper .cm-editor { height: 100%; }
        .code-editor-wrapper .cm-scroller { overflow: auto; }
      `}</style>
    </div>
  );
});

export default CodeEditor;
