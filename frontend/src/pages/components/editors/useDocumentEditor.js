import { useState, useCallback, useEffect, useRef } from 'react';
import { documentsAPI } from '../../../services/api';
import { extractHtmlFromMhtml } from './documentEditorUtils';

/**
 * Custom hook for managing document editor state:
 * loading content, tracking dirty state, saving, and keyboard shortcuts.
 */
export function useDocumentEditor(documentId, documentType, filename) {
  const [content, setContentState] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState('idle'); // idle | saving | saved | error
  const [error, setError] = useState(null);
  const saveTimerRef = useRef(null);

  const isDirty = content !== originalContent;

  // Load content based on document type
  const loadContent = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setSaveStatus('idle');

    try {
      if (documentType === 'docx') {
        // Fetch binary and convert DOCX → HTML via mammoth (dynamic import)
        const res = await fetch(documentsAPI.fileUrl(documentId));
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const arrayBuffer = await res.arrayBuffer();
        let html = '';
        try {
          const mammoth = await import('mammoth');
          const result = await mammoth.convertToHtml({ arrayBuffer });
          html = result.value || '';
          console.log('DOCX converted via mammoth:', { length: html.length, preview: html.substring(0, 100) });
        } catch (mammothErr) {
          // Mammoth failed — file may have been previously saved as HTML or MHTML.
          // Fall back to treating the bytes as UTF-8 text, stripping MHTML headers.
          console.warn('Mammoth failed, trying HTML fallback:', mammothErr);
          const decoder = new TextDecoder('utf-8');
          html = extractHtmlFromMhtml(decoder.decode(arrayBuffer));
          console.log('HTML fallback extracted:', { length: html.length, preview: html.substring(0, 100) });
        }
        setContentState(html);
        setOriginalContent(html);
      } else {
        // Fetch text content via API
        const res = await documentsAPI.getContent(documentId);
        const text = res.data?.content || res.data || '';
        console.log('Text content loaded:', { length: text.length, preview: text.substring(0, 100) });
        setContentState(text);
        setOriginalContent(text);
      }
    } catch (err) {
      console.error('Failed to load document content:', err);
      setError(err.message || 'Failed to load document content');
    } finally {
      setIsLoading(false);
    }
  }, [documentId, documentType]);

  // Load on mount
  useEffect(() => {
    loadContent();
  }, [loadContent]);

  // Set content (called by editor onChange)
  const setContent = useCallback((newContent) => {
    setContentState(newContent);
    if (saveStatus === 'saved') {
      setSaveStatus('idle');
    }
  }, [saveStatus]);

  // Save content to backend
  const saveContent = useCallback(async () => {
    if (!isDirty || isSaving) return;

    setIsSaving(true);
    setSaveStatus('saving');

    try {
      if (documentType === 'docx') {
        // Save edited DOCX content as HTML text.
        // html-docx-js produces DOCX files that neither mammoth nor docx-preview
        // can reliably read back, so we store the HTML directly. The editor and
        // viewer both have HTML fallback paths that handle this correctly.
        // Word can also open HTML files if the user downloads.
        await documentsAPI.saveContent(documentId, content, 'text/html');
      } else {
        const ext = (filename || '').split('.').pop().toLowerCase();
        const mimeMap = {
          html: 'text/html', htm: 'text/html',
          css: 'text/css', js: 'application/javascript',
          json: 'application/json', xml: 'application/xml',
          md: 'text/markdown', txt: 'text/plain',
          csv: 'text/csv', py: 'text/x-python',
          sql: 'text/x-sql',
        };
        const contentType = mimeMap[ext] || 'text/plain';
        await documentsAPI.saveContent(documentId, content, contentType);
      }

      setOriginalContent(content);
      setSaveStatus('saved');

      // Auto-clear "Saved" status after 3 seconds
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (err) {
      console.error('Failed to save document:', err);
      setSaveStatus('error');
      setError(err.message || 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  }, [isDirty, isSaving, documentId, documentType, filename, content]);

  // Ctrl+S keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveContent();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [saveContent]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  return {
    content,
    setContent,
    originalContent,
    isDirty,
    isLoading,
    isSaving,
    saveStatus,
    error,
    saveContent,
    loadContent,
  };
}
