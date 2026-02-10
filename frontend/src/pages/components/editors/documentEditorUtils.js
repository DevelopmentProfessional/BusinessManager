/**
 * Utility functions for the document editor system.
 * Determines which editor to use based on document type and file extension.
 */

const CODE_EXTENSIONS = new Set([
  'js', 'jsx', 'ts', 'tsx', 'css', 'scss', 'less',
  'json', 'xml', 'csv', 'yaml', 'yml', 'sql', 'py',
  'sh', 'bash', 'env', 'toml', 'ini', 'cfg', 'conf',
  'txt', 'md', 'log',
]);

const RICHTEXT_EXTENSIONS = new Set(['html', 'htm']);

const LANGUAGE_MAP = {
  js: 'javascript', jsx: 'javascript', ts: 'javascript', tsx: 'javascript',
  json: 'json',
  css: 'css', scss: 'css', less: 'css',
  html: 'html', htm: 'html',
  xml: 'xml', svg: 'xml',
  py: 'python',
  sql: 'sql',
  md: 'markdown',
};

/**
 * Check if a document type supports in-browser editing.
 */
export function isEditableType(documentType) {
  return documentType === 'docx' || documentType === 'text';
}

/**
 * Get the file extension from a filename.
 */
function getExtension(filename) {
  return (filename || '').split('.').pop().toLowerCase();
}

/**
 * Map a file extension to a CodeMirror language key.
 */
export function getCodeLanguage(filename) {
  const ext = getExtension(filename);
  return LANGUAGE_MAP[ext] || 'text';
}

/**
 * Determine which editor type and language to use for a document.
 * Returns { editorType: 'richtext'|'code'|null, codeLanguage: string|null }
 */
export function getEditorConfig(documentType, filename) {
  if (documentType === 'docx') {
    return { editorType: 'richtext', codeLanguage: null };
  }
  if (documentType === 'text') {
    const ext = getExtension(filename);
    if (RICHTEXT_EXTENSIONS.has(ext)) {
      return { editorType: 'richtext', codeLanguage: null };
    }
    return { editorType: 'code', codeLanguage: getCodeLanguage(filename) };
  }
  return { editorType: null, codeLanguage: null };
}
