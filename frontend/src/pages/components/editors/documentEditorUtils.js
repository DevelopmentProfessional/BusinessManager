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

const RICHTEXT_EXTENSIONS = new Set(['html', 'htm', 'docx']);

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
  return documentType === 'text' || documentType === 'docx';
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
/**
 * Extract HTML content from text that may be MHTML (produced by html-docx-js).
 * MHTML wraps HTML in MIME headers/boundaries. This strips those and returns
 * just the inner HTML. If the text is already plain HTML, returns it as-is.
 */
export function extractHtmlFromMhtml(text) {
  if (!text) return '';
  const trimmed = text.trim();

  // Not MHTML — check if it's already HTML
  if (!trimmed.startsWith('MIME-Version:')) {
    // If it looks like HTML/XML, return as-is
    if (trimmed.startsWith('<') || trimmed.startsWith('<!DOCTYPE')) {
      return text;
    }
    // Otherwise might be corrupted or wrong format
    return '';
  }

  // Find the boundary string from the Content-Type header
  // Try multiple boundary patterns since they can be quoted or unquoted
  let boundaryMatch = trimmed.match(/boundary\s*=\s*"([^"]+)"/i);
  if (!boundaryMatch) {
    boundaryMatch = trimmed.match(/boundary\s*=\s*([^\s;]+)/i);
  }
  if (!boundaryMatch) {
    console.warn('Could not find MIME boundary in MHTML content');
    return '';
  }

  const boundary = boundaryMatch[1];
  const boundaryPrefix = '--' + boundary; // MIME boundaries are preceded by --

  // Split on boundary, find the part with Content-Type: text/html
  const parts = trimmed.split(boundaryPrefix);
  for (const part of parts) {
    const lowerPart = part.toLowerCase();
    if (lowerPart.includes('content-type: text/html') || lowerPart.includes('content-type:text/html')) {
      // The HTML content starts after the blank line (CRLF CRLF or LF LF)
      // that separates headers from body
      let separatorIdx = part.indexOf('\r\n\r\n');
      if (separatorIdx === -1) {
        separatorIdx = part.indexOf('\n\n');
        if (separatorIdx !== -1) separatorIdx += 2;
      } else {
        separatorIdx += 4;
      }

      if (separatorIdx > 0) {
        // Extract content after separator
        let html = part.substring(separatorIdx).trim();
        
        // Remove all boundary markers (they appear as --boundary-- at the end)
        const boundaryEnd = html.lastIndexOf('--' + boundary);
        if (boundaryEnd !== -1) {
          html = html.substring(0, boundaryEnd).trim();
        }
        
        // Remove any trailing line that might be a boundary marker
        const lines = html.split(/\r?\n/);
        while (lines.length && (lines[lines.length - 1].startsWith('--') || lines[lines.length - 1].trim() === '')) {
          lines.pop();
        }
        html = lines.join('\n').trim();
        
        if (html.length > 0) {
          return html;
        }
      }
    }
  }

  // Could not extract HTML — return empty string to avoid rendering garbage
  console.warn('Could not extract HTML from MHTML content');
  return '';
}

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
