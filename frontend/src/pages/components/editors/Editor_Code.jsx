/*
 * ============================================================
 * FILE: Editor_Code.jsx
 *
 * PURPOSE:
 *   Provides a syntax-highlighted code editing surface built on CodeMirror 6
 *   via the @uiw/react-codemirror wrapper. It supports multiple languages,
 *   auto-detects dark mode, and exposes undo/redo commands to a parent via ref.
 *
 * FUNCTIONAL PARTS:
 *   [1] Language Extension Map — maps language name strings to CodeMirror language extensions
 *   [2] Editor_Code Component   — forwardRef component wiring CodeMirror, dark-mode detection,
 *                                imperative undo/redo handle, and change callback
 *
 * CHANGE LOG — all modifications to this file must be recorded here:
 *   Format : YYYY-MM-DD | Author | Description
 *   ─────────────────────────────────────────────────────────────
 *   2026-03-01 | Claude  | Added section comments and top-level documentation
 * ============================================================
 */

import React, { useMemo, useImperativeHandle, forwardRef, useRef, useCallback } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import { css } from "@codemirror/lang-css";
import { html } from "@codemirror/lang-html";
import { xml } from "@codemirror/lang-xml";
import { python } from "@codemirror/lang-python";
import { sql } from "@codemirror/lang-sql";
import { markdown } from "@codemirror/lang-markdown";
import { oneDark } from "@codemirror/theme-one-dark";
import { undo, redo } from "@codemirror/commands";

// ─── 1 LANGUAGE EXTENSION MAP ──────────────────────────────────────────────────

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

// ─── 2 CODEEDITOR COMPONENT ────────────────────────────────────────────────────

const Editor_Code = forwardRef(function Editor_Code({ content, onChange, language = "text" }, ref) {
  const viewRef = useRef(null);

  const extensions = useMemo(() => {
    const langFn = LANGUAGE_EXTENSIONS[language];
    return langFn ? [langFn()] : [];
  }, [language]);

  const isDark = useMemo(() => {
    return document.documentElement.classList.contains("dark");
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      undo: () => {
        if (viewRef.current?.view) {
          undo(viewRef.current.view);
        }
      },
      redo: () => {
        if (viewRef.current?.view) {
          redo(viewRef.current.view);
        }
      },
    }),
    []
  );

  const handleChange = useCallback(
    (value) => {
      onChange?.(value);
    },
    [onChange]
  );

  return (
    <div className="code-editor-wrapper h-full min-h-0 overflow-hidden">
      <CodeMirror
        ref={viewRef}
        value={content || ""}
        onChange={handleChange}
        extensions={extensions}
        theme={isDark ? oneDark : "light"}
        height="100%"
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
        .code-editor-wrapper { height: 100%; width: 100%; box-sizing: border-box; }
        .code-editor-wrapper .cm-editor { height: 100%; width: 100%; }
        .code-editor-wrapper .cm-scroller { overflow: auto; }
      `}</style>
    </div>
  );
});

export default Editor_Code;
