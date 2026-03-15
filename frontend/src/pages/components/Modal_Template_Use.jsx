import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { XMarkIcon, PrinterIcon, PencilSquareIcon, ArrowDownTrayIcon, EnvelopeIcon } from '@heroicons/react/24/outline';
import { templatesAPI } from '../../services/api';
import Modal_Template_Editor from './Modal_Template_Editor';
import {
  renderTemplate,
  buildClientVariables,
  buildEmployeeVariables,
  buildSalesVariables,
  buildScheduleVariables,
} from './templateVariables';

const TYPE_BADGE_COLOR = {
  email: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
  invoice: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
  receipt: 'bg-teal-100 text-teal-800 dark:bg-teal-900/50 dark:text-teal-300',
  memo: 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300',
  quote: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300',
  custom: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
};

/**
 * Props:
 *  page          – 'clients' | 'employees' | 'sales' | 'schedule'
 *  entity        – client | employee | transaction | appointment object
 *  currentUser   – logged-in user object
 *  settings      – AppSettings object
 *  items         – (optional) sale transaction items for sales page
 *  client        – (optional) client for sales/schedule page
 *  employee      – (optional) employee for schedule page
 *  service       – (optional) service for schedule page
 *  filterType    – (optional) only show templates of this type (e.g. 'email', 'invoice')
 *  onClose       – callback to close this modal
 */
export default function Modal_Template_Use({
  page,
  entity,
  currentUser,
  settings,
  items = [],
  client,
  employee,
  service,
  filterType = null,
  onClose,
}) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [renderedHtml, setRenderedHtml] = useState('');
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isEmailPreviewOpen, setIsEmailPreviewOpen] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const printIframeRef = useRef(null);
  const pdfCacheRef = useRef(new Map());
  const companyName = settings?.company_name?.trim() || settings?.business_name?.trim() || 'Invoice';
  const recipientEmail = (client?.email || entity?.email || '').trim();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    templatesAPI.getAll(page)
      .then((res) => {
        if (!cancelled) setTemplates(res.data || []);
      })
      .catch(() => {
        if (!cancelled) setTemplates([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [page]);

  useEffect(() => {
    if (!selected) { setRenderedHtml(''); return; }
    const vars = buildVars();
    setRenderedHtml(renderTemplate(selected.content, vars));
  }, [selected]);

  const buildVars = () => {
    if (page === 'clients') return buildClientVariables(entity, currentUser, settings);
    if (page === 'employees') return buildEmployeeVariables(entity, currentUser, settings);
    if (page === 'sales') return buildSalesVariables(entity, client || entity, currentUser, settings, items);
    if (page === 'schedule') return buildScheduleVariables(entity, client, employee, service, currentUser, settings);
    return {};
  };

  const pdfFileName = useMemo(() => {
    const safeName = (selected?.name || companyName || 'invoice')
      .replace(/[^a-z0-9\-_\s]/gi, '')
      .trim()
      .replace(/\s+/g, '_')
      .toLowerCase();
    return `${safeName || 'invoice'}.pdf`;
  }, [selected?.name, companyName]);

  const emailSubject = useMemo(
    () => `${selected?.name || 'Document'} from ${companyName}`,
    [selected?.name, companyName]
  );

  const emailBody = useMemo(() => {
    const customerName = client?.name || entity?.name || 'there';
    return [
      `Hello ${customerName},`,
      '',
      `Please find your document from ${companyName} attached.`,
      'If you have any questions, reply to this email and we will help right away.',
      '',
      `Thanks,`,
      companyName,
    ].join('\n');
  }, [client?.name, entity?.name, companyName]);

  // Build the full HTML document for print / preview iframe
  const iframeContent = useMemo(() => {
    if (!renderedHtml) return '';
    return `<!DOCTYPE html><html><head>
      <meta charset="utf-8"/>
      <title>${companyName}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
               font-size: 14px; line-height: 1.6; padding: 32px; margin: 0; color: #111; background: #fff; }
        h1,h2,h3 { margin: 0.5em 0; }
        p { margin: 0.4em 0; }
        hr { border: none; border-top: 1px solid #ccc; margin: 1em 0; }
        ul,ol { padding-left: 1.5em; }
        table { width: 100%; border-collapse: collapse; }
        th, td { vertical-align: top; }
        @page { margin: 12mm; }
        @media print {
          html, body { margin: 0; padding: 0; }
          body { padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      </style>
    </head><body>${renderedHtml}</body></html>`;
  }, [renderedHtml, companyName]);

  const createPdfBlob = useCallback(async (fullHtml) => {
    const html2pdf = (await import('html2pdf.js')).default;

    // Render the full HTML document in a hidden iframe so all styles apply correctly.
    // z-index: -1 keeps it behind the modal; no opacity tricks that would make html2canvas capture blank pages.
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;left:0;top:0;width:794px;height:1px;z-index:-1;pointer-events:none;border:none;visibility:hidden;';
    document.body.appendChild(iframe);

    try {
      const doc = iframe.contentDocument || iframe.contentWindow.document;
      doc.open();
      doc.write(fullHtml);
      doc.close();

      // Let fonts and layout settle
      try { await iframe.contentWindow.document.fonts?.ready; } catch {}
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

      // Wait for images
      const imgs = Array.from(doc.querySelectorAll('img'));
      await Promise.all(imgs.map((img) => {
        if (img.complete) return Promise.resolve();
        return new Promise((resolve) => {
          img.addEventListener('load', resolve, { once: true });
          img.addEventListener('error', resolve, { once: true });
          setTimeout(resolve, 3000);
        });
      }));

      const contentHeight = Math.max(doc.body.scrollHeight, 1123);
      iframe.style.height = `${contentHeight}px`;
      iframe.style.visibility = 'visible';

      // One more frame after resizing so layout is finalised
      await new Promise((resolve) => requestAnimationFrame(resolve));

      const blob = await html2pdf()
        .set({
          margin: 0,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: {
            scale: 2,
            useCORS: true,
            backgroundColor: '#ffffff',
            logging: false,
            windowWidth: 794,
            windowHeight: contentHeight,
          },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
          pagebreak: { mode: ['css', 'legacy'] },
        })
        .from(doc.body)
        .outputPdf('blob');

      if (!blob || blob.size < 2500) {
        throw new Error('PDF output appears empty');
      }
      return blob;
    } finally {
      document.body.removeChild(iframe);
    }
  }, []);

  const downloadBlob = useCallback((blob, filename) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, []);

  const handlePrint = () => {
    const iframe = printIframeRef.current;
    if (!iframe?.contentWindow) return;
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
  };

  const handleDownloadPdf = async () => {
    if (!selected || !iframeContent || isDownloadingPdf) return;
    setIsDownloadingPdf(true);
    try {
      const cacheKey = selected.id;
      let blob = pdfCacheRef.current.get(cacheKey);
      if (!blob) {
        blob = await createPdfBlob(iframeContent);
        pdfCacheRef.current.set(cacheKey, blob);
      }
      downloadBlob(blob, pdfFileName);
    } catch (error) {
      console.error('Failed to generate PDF:', error);
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const handleOpenEmailDraft = async () => {
    if (!selected) return;
    try {
      let blob = pdfCacheRef.current.get(selected.id);
      if (!blob && iframeContent) {
        blob = await createPdfBlob(iframeContent);
        pdfCacheRef.current.set(selected.id, blob);
      }

      if (blob && navigator.share && navigator.canShare) {
        const file = new File([blob], pdfFileName, { type: 'application/pdf' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ title: emailSubject, text: emailBody, files: [file] });
          return;
        }
      }

      const to = recipientEmail ? encodeURIComponent(recipientEmail) : '';
      const subject = encodeURIComponent(emailSubject);
      const body = encodeURIComponent(`${emailBody}\n\nAttachment: ${pdfFileName}`);
      window.open(`mailto:${to}?subject=${subject}&body=${body}`, '_self');
    } catch (error) {
      console.error('Failed to prepare email draft:', error);
    }
  };

  const handleSaveTemplate = async (data) => {
    if (!selected?.id) return;
    // Invalidate cached PDF for this template
    pdfCacheRef.current.delete(selected.id);
    const res = await templatesAPI.update(selected.id, data);
    const updated = res?.data ?? res;
    setTemplates((prev) => prev.map((tpl) => (tpl.id === selected.id ? updated : tpl)));
    setSelected(updated);
    setIsEditorOpen(false);
  };

  const visibleTemplates = filterType
    ? templates.filter((t) => t.template_type === filterType)
    : templates;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">
          Use Template
        </h2>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left: template list */}
        <div
          className="flex-shrink-0 border-r border-gray-200 dark:border-gray-700 overflow-y-auto"
          style={{ width: '200px' }}
        >
          {loading ? (
            <div className="p-4 text-sm text-gray-500">Loading...</div>
          ) : visibleTemplates.length === 0 ? (
            <div className="p-4 text-sm text-gray-500">No templates available for this page.</div>
          ) : (
            <ul className="py-1">
              {visibleTemplates.map((tpl) => (
                <li key={tpl.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(tpl)}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
                      selected?.id === tpl.id
                        ? 'bg-primary-50 dark:bg-primary-900/20 border-r-2 border-primary-500'
                        : ''
                    }`}
                  >
                    <div className="font-medium text-gray-900 dark:text-white text-xs leading-tight">
                      {tpl.name}
                    </div>
                    <span
                      className={`inline-block mt-1 px-1.5 py-0.5 rounded text-xs font-medium ${
                        TYPE_BADGE_COLOR[tpl.template_type] || TYPE_BADGE_COLOR.custom
                      }`}
                    >
                      {tpl.template_type}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Right: preview */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {selected ? (
            <>
              {/* Preview title bar */}
              <div className="flex-shrink-0 flex items-center gap-2 px-3 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300 flex-1 truncate">
                  {selected.name}
                </span>
                <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${TYPE_BADGE_COLOR[selected.template_type] || TYPE_BADGE_COLOR.custom}`}>
                  {selected.template_type}
                </span>
              </div>

              {/* Live HTML preview in iframe — same content used by Print */}
              <div className="flex-1 overflow-hidden bg-gray-100 dark:bg-gray-800 p-3">
                <div className="h-full rounded shadow-sm overflow-hidden bg-white">
                  <iframe
                    ref={printIframeRef}
                    srcDoc={iframeContent}
                    className="w-full h-full border-0"
                    title="Template preview"
                    sandbox="allow-same-origin allow-modals"
                  />
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-sm text-gray-400">
              Select a template to preview
            </div>
          )}
        </div>
      </div>

      {/* Footer actions */}
      <div className="flex-shrink-0 px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="position-relative d-flex align-items-center" style={{ minHeight: '3rem' }}>
          <div className="d-flex gap-2">
            <button
              type="button"
              onClick={() => setIsEditorOpen(true)}
              disabled={!selected}
              className="btn btn-outline-secondary d-flex align-items-center gap-1"
            >
              <PencilSquareIcon className="h-4 w-4" />
              Edit
            </button>
            <button
              type="button"
              onClick={handlePrint}
              disabled={!selected}
              className="btn btn-primary d-flex align-items-center gap-1"
            >
              <PrinterIcon className="h-4 w-4" />
              Print
            </button>
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={!selected || isDownloadingPdf}
              className="btn btn-outline-primary d-flex align-items-center gap-1"
            >
              <ArrowDownTrayIcon className="h-4 w-4" />
              {isDownloadingPdf ? 'Downloading...' : 'Download'}
            </button>
            <button
              type="button"
              onClick={() => setIsEmailPreviewOpen(true)}
              disabled={!selected}
              className="btn btn-outline-secondary d-flex align-items-center gap-1"
            >
              <EnvelopeIcon className="h-4 w-4" />
              Email
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="btn btn-outline-secondary d-flex align-items-center gap-1 position-absolute"
            style={{ left: '50%', transform: 'translateX(-50%)' }}
          >
            <XMarkIcon className="h-4 w-4" />
            Close
          </button>
        </div>
      </div>

      {isEditorOpen && selected && (
        <Modal_Template_Editor
          template={selected}
          onSave={handleSaveTemplate}
          onClose={() => setIsEditorOpen(false)}
        />
      )}

      {isEmailPreviewOpen && selected && (
        <div className="fixed inset-0 z-[60] d-flex align-items-center justify-content-center bg-black/50 px-3">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded w-100" style={{ maxWidth: '760px' }}>
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-0">Email Preview</h3>
            </div>

            <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800 border-bottom border-gray-200 dark:border-gray-700">
              <div className="small text-gray-500 mb-1">To</div>
              <div className="text-sm text-gray-900 dark:text-white">{recipientEmail || 'No client email available'}</div>

              <div className="small text-gray-500 mt-3 mb-1">Subject</div>
              <div className="text-sm text-gray-900 dark:text-white">{emailSubject}</div>

              <div className="small text-gray-500 mt-3 mb-1">Attachment</div>
              <div className="text-sm text-gray-900 dark:text-white">
                {pdfFileName} (generated on send)
              </div>
            </div>

            <div className="px-4 py-3 bg-white dark:bg-gray-900" style={{ maxHeight: '42vh', overflowY: 'auto' }}>
              <div className="small text-gray-500 mb-2">Body</div>
              <pre className="m-0 text-sm text-gray-800 dark:text-gray-200" style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>
                {emailBody}
              </pre>
            </div>

            <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
              <div className="position-relative d-flex align-items-center" style={{ minHeight: '2.5rem' }}>
                <button
                  type="button"
                  onClick={handleOpenEmailDraft}
                  disabled={!selected}
                  className="btn btn-primary d-flex align-items-center gap-1"
                >
                  <EnvelopeIcon className="h-4 w-4" />
                  Open Email Draft
                </button>

                <button
                  type="button"
                  onClick={() => setIsEmailPreviewOpen(false)}
                  className="btn btn-outline-secondary d-flex align-items-center gap-1 position-absolute"
                  style={{ left: '50%', transform: 'translateX(-50%)' }}
                >
                  <XMarkIcon className="h-4 w-4" />
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
