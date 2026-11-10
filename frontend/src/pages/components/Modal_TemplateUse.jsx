import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { XMarkIcon, PrinterIcon, PencilSquareIcon, ArrowDownTrayIcon, EnvelopeIcon, DocumentTextIcon, CheckIcon } from "@heroicons/react/24/outline";
import { templatesAPI, clientsAPI, clientCartAPI } from "../../services/api";
import Modal_Template_Editor from "./Modal_TemplateEdit";
import Button_Toolbar from "./Button_Toolbar";
import { renderTemplate, buildClientVariables, buildEmployeeVariables, buildPayslipVariables, buildSalesVariables, buildScheduleVariables } from "./Utils_TemplateVariables";

const TYPE_BADGE_COLOR = {
  email: "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300",
  invoice: "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300",
  receipt: "bg-teal-100 text-teal-800 dark:bg-teal-900/50 dark:text-teal-300",
  payslip: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300",
  memo: "bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300",
  quote: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300",
  custom: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
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
export default function Modal_TemplateUse({ page, entity, currentUser, settings, items = [], client, employee, service, filterType = null, onClose }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [renderedHtml, setRenderedHtml] = useState("");
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isEmailPreviewOpen, setIsEmailPreviewOpen] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [clientInvoiceTx, setClientInvoiceTx] = useState(null);
  const [clientInvoiceItems, setClientInvoiceItems] = useState([]);
  const [clientCartItems, setClientCartItems] = useState([]);
  const [templateDropupOpen, setTemplateDropupOpen] = useState(false);
  const templateDropupRef = useRef(null);
  const printIframeRef = useRef(null);
  const pdfCacheRef = useRef(new Map());
  const companyName = settings?.company_name?.trim() || settings?.business_name?.trim() || "Invoice";
  const recipientEmail = (client?.email || entity?.email || "").trim();
  const isPayslip = filterType === "payslip";

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (templateDropupRef.current && !templateDropupRef.current.contains(e.target)) {
        setTemplateDropupOpen(false);
      }
    };
    if (templateDropupOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [templateDropupOpen]);

  const parseSelectedOptions = useCallback((item) => {
    if (Array.isArray(item?.selectedOptions)) {
      return item.selectedOptions;
    }

    if (Array.isArray(item?.options_json)) {
      return item.options_json;
    }

    if (typeof item?.options_json === "string" && item.options_json.trim()) {
      try {
        const parsed = JSON.parse(item.options_json);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }

    return [];
  }, []);

  const normalizeImageAlignment = useCallback((html) => {
    if (!html) return "";
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");

      // Fix image alignment
      doc.querySelectorAll("img[data-float]").forEach((img) => {
        const imageFloat = img.getAttribute("data-float") || "none";
        img.style.display = "block";
        if (imageFloat === "left") {
          img.style.margin = "0.5rem auto 0.5rem 0";
        } else if (imageFloat === "right") {
          img.style.margin = "0.5rem 0 0.5rem auto";
        } else {
          img.style.margin = "0.5rem auto";
        }
      });

      // Unwrap block elements (table, hr, div, ul, ol) from <p> tags.
      // Invalid HTML like <p><table>…</table></p> is auto-corrected by the
      // browser in unpredictable ways, leaving empty <p> tags that add
      // unwanted spacing. Pull them out so the DOM is clean.
      doc.querySelectorAll("p > table, p > hr, p > div, p > ul, p > ol").forEach((block) => {
        const p = block.parentNode;
        p.parentNode.insertBefore(block, p);
        if (!p.textContent.trim() && !p.querySelector("*")) {
          p.parentNode.removeChild(p);
        }
      });

      return doc.body.innerHTML;
    } catch {
      return html;
    }
  }, []);

  const toTaxRateDecimal = useCallback((value) => {
    const num = Number(value);
    if (!Number.isFinite(num) || num <= 0) return 0;
    return num > 1 ? num / 100 : num;
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    templatesAPI
      .getAll(page)
      .then((res) => {
        if (!cancelled) setTemplates(res.data || []);
      })
      .catch(() => {
        if (!cancelled) setTemplates([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [page]);

  useEffect(() => {
    let cancelled = false;

    const loadLatestClientInvoice = async () => {
      if (page !== "clients" || !entity?.id) {
        setClientInvoiceTx(null);
        setClientInvoiceItems([]);
        setClientCartItems([]);
        return;
      }

      try {
        const [txRes, cartRes] = await Promise.all([clientsAPI.getTransactions(entity.id), clientCartAPI.getItems(entity.id)]);

        const txList = Array.isArray(txRes?.data) ? txRes.data : Array.isArray(txRes) ? txRes : [];
        const cartList = Array.isArray(cartRes?.data) ? cartRes.data : Array.isArray(cartRes) ? cartRes : [];
        if (!cancelled) setClientCartItems(cartList);

        if (!txList.length) {
          if (!cancelled) {
            setClientInvoiceTx(null);
            setClientInvoiceItems([]);
          }
          return;
        }

        const sorted = [...txList].sort((a, b) => {
          const aTs = new Date(a?.created_at || 0).getTime();
          const bTs = new Date(b?.created_at || 0).getTime();
          return bTs - aTs;
        });
        const latestTx = sorted[0] || null;

        let lineItems = [];
        if (latestTx?.id != null) {
          const itemsRes = await clientsAPI.getTransactionItems(latestTx.id);
          lineItems = Array.isArray(itemsRes?.data) ? itemsRes.data : Array.isArray(itemsRes) ? itemsRes : [];
        }

        if (!cancelled) {
          setClientInvoiceTx(latestTx);
          setClientInvoiceItems(lineItems);
        }
      } catch {
        if (!cancelled) {
          setClientInvoiceTx(null);
          setClientInvoiceItems([]);
          setClientCartItems([]);
        }
      }
    };

    loadLatestClientInvoice();
    return () => {
      cancelled = true;
    };
  }, [page, entity?.id]);

  const buildVars = useCallback(() => {
    if (page === "clients") {
      const baseVars = buildClientVariables(entity, currentUser, settings);
      const cartItems = (clientCartItems || []).map((item) => {
        const qty = Number(item?.quantity) || 1;
        const unitPrice = Number(item?.unit_price ?? item?.price) || 0;
        return {
          item_name: item?.item_name || item?.name || "",
          item_type: item?.item_type || item?.itemType || "",
          quantity: qty,
          unit_price: unitPrice,
          line_total: unitPrice * qty,
          selectedOptions: parseSelectedOptions(item),
        };
      });

      let txForInvoice = clientInvoiceTx;
      let itemsForInvoice = clientInvoiceItems;

      if (cartItems.length > 0) {
        const subtotal = cartItems.reduce((sum, item) => sum + (Number(item.line_total) || 0), 0);
        const taxRate = toTaxRateDecimal(settings?.tax_rate);
        const taxAmount = subtotal * taxRate;
        txForInvoice = {
          id: `CART-${entity?.id || "CLIENT"}`,
          created_at: new Date().toISOString(),
          subtotal,
          tax_amount: taxAmount,
          total: subtotal + taxAmount,
          payment_method: "pending",
        };
        itemsForInvoice = cartItems;
      }

      const invoiceVars = buildSalesVariables(txForInvoice, entity, currentUser, settings, itemsForInvoice);
      return { ...invoiceVars, ...baseVars };
    }
    if (page === "employees" && filterType === "payslip") return buildPayslipVariables(entity, employee || currentUser, currentUser, settings);
    if (page === "employees") return buildEmployeeVariables(entity, currentUser, settings);
    if (page === "sales") return buildSalesVariables(entity, client || entity, currentUser, settings, items);
    if (page === "schedule") return buildScheduleVariables(entity, client, employee, service, currentUser, settings);
    return {};
  }, [page, entity, currentUser, settings, items, client, employee, service, filterType, clientCartItems, clientInvoiceTx, clientInvoiceItems, parseSelectedOptions, toTaxRateDecimal]);

  useEffect(() => {
    if (!selected) {
      setRenderedHtml("");
      return;
    }
    const vars = buildVars();
    const rendered = renderTemplate(selected.content, vars);
    setRenderedHtml(normalizeImageAlignment(rendered));
  }, [selected, buildVars, normalizeImageAlignment]);

  const pdfFileName = useMemo(() => {
    const safeName = (selected?.name || companyName || "invoice")
      .replace(/[^a-z0-9\-_\s]/gi, "")
      .trim()
      .replace(/\s+/g, "_")
      .toLowerCase();
    return `${safeName || "invoice"}.pdf`;
  }, [selected?.name, companyName]);

  const emailSubject = useMemo(() => `${selected?.name || "Document"} from ${companyName}`, [selected?.name, companyName]);

  const emailBody = useMemo(() => {
    const customerName = client?.name || entity?.name || "there";
    return [`Hello ${customerName},`, "", `Please find your document from ${companyName} attached.`, "If you have any questions, reply to this email and we will help right away.", "", `Thanks,`, companyName].join("\n");
  }, [client?.name, entity?.name, companyName]);

  // Build the full HTML document for print / preview iframe
  const iframeContent = useMemo(() => {
    if (!renderedHtml) return "";
    return `<!DOCTYPE html><html><head>
      <meta charset="utf-8"/>
      <title>${companyName}</title>
      <style>
        * { box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
               font-size: 13px; line-height: 1.6; padding: 32px; margin: 0;
               color: #111; background: #fff; }
        img { max-width: 100%; height: auto; display: block; }
        table { border-collapse: collapse; }
        td, th { vertical-align: top; word-break: break-word; }
        @page { margin: 20mm; }
        @media print {
          body { padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      </style>
    </head><body>${renderedHtml}</body></html>`;
  }, [renderedHtml, companyName]);

  const createPdfBlob = useCallback(async (fullHtml) => {
    const html2pdf = (await import("html2pdf.js")).default;

    // Render the full HTML document in a hidden iframe so all styles apply correctly.
    // z-index: -1 keeps it behind the modal; no opacity tricks that would make html2canvas capture blank pages.
    const iframe = document.createElement("iframe");
    iframe.style.cssText = "position:fixed;left:0;top:0;width:794px;height:1px;z-index:-1;pointer-events:none;border:none;visibility:hidden;";
    document.body.appendChild(iframe);

    try {
      const doc = iframe.contentDocument || iframe.contentWindow.document;
      doc.open();
      doc.write(fullHtml);
      doc.close();

      // Let fonts and layout settle
      try {
        await iframe.contentWindow.document.fonts?.ready;
      } catch {}
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

      // Wait for images
      const imgs = Array.from(doc.querySelectorAll("img"));
      await Promise.all(
        imgs.map((img) => {
          if (img.complete) return Promise.resolve();
          return new Promise((resolve) => {
            img.addEventListener("load", resolve, { once: true });
            img.addEventListener("error", resolve, { once: true });
            setTimeout(resolve, 3000);
          });
        })
      );

      const contentHeight = Math.max(doc.body.scrollHeight, 1123);
      iframe.style.height = `${contentHeight}px`;
      iframe.style.visibility = "visible";

      // One more frame after resizing so layout is finalised
      await new Promise((resolve) => requestAnimationFrame(resolve));

      const blob = await html2pdf()
        .set({
          margin: [20, 20, 35, 20],
          image: { type: "jpeg", quality: 0.98 },
          html2canvas: {
            scale: 2,
            useCORS: true,
            backgroundColor: "#ffffff",
            logging: false,
            windowWidth: 794,
            windowHeight: contentHeight,
          },
          jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
          pagebreak: { mode: ["css", "legacy"] },
        })
        .from(doc.body)
        .outputPdf("blob");

      if (!blob || blob.size < 2500) {
        throw new Error("PDF output appears empty");
      }
      return blob;
    } finally {
      document.body.removeChild(iframe);
    }
  }, []);

  const downloadBlob = useCallback((blob, filename) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
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
      console.error("Failed to generate PDF:", error);
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
        const file = new File([blob], pdfFileName, { type: "application/pdf" });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ title: emailSubject, text: emailBody, files: [file] });
          return;
        }
      }

      const to = recipientEmail ? encodeURIComponent(recipientEmail) : "";
      const subject = encodeURIComponent(emailSubject);
      const body = encodeURIComponent(`${emailBody}\n\nAttachment: ${pdfFileName}`);
      window.open(`mailto:${to}?subject=${subject}&body=${body}`, "_self");
    } catch (error) {
      console.error("Failed to prepare email draft:", error);
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

  const visibleTemplates = filterType ? templates.filter((t) => t.template_type === filterType) : templates;

  useEffect(() => {
    if (!loading && visibleTemplates.length > 0 && !selected) {
      setSelected(visibleTemplates[0]);
    }
  }, [loading, selected, visibleTemplates]);

  const handleUseAction = () => {
    if (!selected) return;
    if (selected.template_type === "email" || recipientEmail) {
      setIsEmailPreviewOpen(true);
    } else {
      handlePrint();
    }
  };

  return (
    <div className="bg-white dark:bg-gray-900 fixed flex flex-col inset-0 z-50">
      {/* Header */}
      <div className="align-items-center bg-white border-b border-gray-200 d-flex dark:bg-gray-800 dark:border-gray-700 flex-shrink-0 justify-content-between px-3 py-2">
        <div className="align-items-center d-flex gap-2 min-w-0">
          <h2 className="app-modal-title text-truncate">{isPayslip ? "Pay Slip" : "Use Template"}</h2>
          {selected && (
            <span className={`px-1.5 py-0.5 rounded text-xs font-medium flex-shrink-0 ${TYPE_BADGE_COLOR[selected.template_type] || TYPE_BADGE_COLOR.custom}`}>
              {selected.template_type}
            </span>
          )}
        </div>

        {/* Top-right: Print and Download icon buttons */}
        <div className="align-items-center d-flex gap-2">
          <Button_Toolbar
            icon={PrinterIcon}
            label=""
            compact
            onClick={handlePrint}
            disabled={!selected}
            className="btn-outline-secondary rounded-circle"
            title="Print"
          />
          <Button_Toolbar
            icon={ArrowDownTrayIcon}
            label=""
            compact
            onClick={handleDownloadPdf}
            disabled={!selected || isDownloadingPdf}
            className="btn-outline-secondary rounded-circle"
            title={isDownloadingPdf ? "Downloading..." : "Download PDF"}
          />
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Full-width preview area */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {selected ? (
            <div className="bg-gray-100 dark:bg-gray-800 flex-1 overflow-hidden p-2">
              <div className="bg-white h-full overflow-hidden rounded shadow-sm">
                <iframe ref={printIframeRef} srcDoc={iframeContent} className="border-0 h-full w-full" title="Template preview" sandbox="allow-same-origin allow-modals" />
              </div>
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center text-gray-400 text-sm">
              {loading ? "Loading templates..." : "Select a template to preview"}
            </div>
          )}
        </div>
      </div>

      {/* Footer actions: Edit, Temp (dropup), Use on left; Close floating in center */}
      <div className="bg-white border-gray-200 border-t dark:bg-gray-800 dark:border-gray-700 flex-shrink-0 px-3 py-2">
        <div className="align-items-center d-flex justify-content-between position-relative" style={{ minHeight: "2.5rem" }}>
          {/* Left: Edit, Temp dropup, Use */}
          <div className="align-items-center d-flex gap-2">
            {!isPayslip && (
              <Button_Toolbar
                icon={PencilSquareIcon}
                label="Edit"
                onClick={() => setIsEditorOpen(true)}
                disabled={!selected}
                className="btn-outline-secondary"
                title="Edit template"
              />
            )}

            {!isPayslip && (
              <div className="app-dropup position-relative" ref={templateDropupRef}>
                <Button_Toolbar
                  icon={DocumentTextIcon}
                  label={selected?.name ? `Temp: ${selected.name}` : "Temp"}
                  onClick={() => setTemplateDropupOpen((v) => !v)}
                  className="btn-outline-secondary app-menu-trigger"
                  aria-expanded={templateDropupOpen}
                  aria-haspopup="listbox"
                  title={selected?.name || "Template options"}
                />

                {templateDropupOpen && (
                  <div
                    className="app-menu-panel bg-white bottom-100 dark:bg-gray-900 mb-2 p-1 position-absolute shadow-lg start-0"
                    style={{
                      zIndex: 900,
                      minWidth: "14rem",
                      maxWidth: "22rem",
                      maxHeight: "min(50vh, 22rem)",
                      overflowY: "auto",
                    }}
                    role="listbox"
                  >
                    {visibleTemplates.length === 0 ? (
                      <div className="px-2 py-1 text-gray-500 text-xs">No templates available</div>
                    ) : (
                      visibleTemplates.map((tpl) => (
                        <div
                          key={tpl.id}
                          role="option"
                          tabIndex={0}
                          aria-selected={selected?.id === tpl.id}
                          onClick={() => {
                            setSelected(tpl);
                            setTemplateDropupOpen(false);
                          }}
                          className={`app-menu-item d-flex align-items-center justify-content-between gap-2 px-2 py-1 rounded cursor-pointer ${
                            selected?.id === tpl.id ? "bg-primary text-white" : "hover:bg-gray-100 dark:hover:bg-gray-800 text-body"
                          }`}
                          style={{ cursor: "pointer" }}
                        >
                          <span className="text-truncate text-xs font-medium">{tpl.name}</span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-xxs font-medium flex-shrink-0 ${
                              selected?.id === tpl.id ? "bg-white/20 text-white" : TYPE_BADGE_COLOR[tpl.template_type] || TYPE_BADGE_COLOR.custom
                            }`}
                          >
                            {tpl.template_type}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}

            {!isPayslip && (
              <Button_Toolbar
                icon={selected?.template_type === "email" ? EnvelopeIcon : CheckIcon}
                label={selected?.template_type === "email" ? "Send" : "Use"}
                onClick={handleUseAction}
                disabled={!selected}
                className="btn-primary"
                title={selected?.template_type === "email" ? "Send message" : "Use template"}
              />
            )}

            <Button_Toolbar
              icon={XMarkIcon}
              label="Close"
              onClick={onClose}
              className="btn-outline-secondary"
              title="Close"
            />
          </div>
        </div>
      </div>

      {isEditorOpen && selected && <Modal_Template_Editor template={selected} onSave={handleSaveTemplate} onClose={() => setIsEditorOpen(false)} />}

      {isEmailPreviewOpen && selected && (
        <div className="align-items-center bg-black/50 d-flex fixed inset-0 justify-content-center px-1 z-[60]">
          <div className="bg-white border border-gray-200 dark:bg-gray-900 dark:border-gray-700 rounded w-100" style={{ maxWidth: "760px" }}>
            <div className="bg-white border-b border-gray-200 dark:bg-gray-800 dark:border-gray-700 px-1 py-1">
              <h3 className="dark:text-white font-semibold mb-0 text-gray-900 text-sm">Email Preview</h3>
            </div>

            <div className="bg-gray-50 border-bottom border-gray-200 dark:bg-gray-800 dark:border-gray-700 px-1 py-1">
              <div className="mb-1 small text-gray-500">To</div>
              <div className="dark:text-white text-gray-900 text-sm">{recipientEmail || "No client email available"}</div>

              <div className="mb-1 mt-3 small text-gray-500">Subject</div>
              <div className="dark:text-white text-gray-900 text-sm">{emailSubject}</div>

              <div className="mb-1 mt-3 small text-gray-500">Attachment</div>
              <div className="dark:text-white text-gray-900 text-sm">{pdfFileName} (generated on send)</div>
            </div>

            <div className="bg-white dark:bg-gray-900 px-1 py-1" style={{ maxHeight: "42vh", overflowY: "auto" }}>
              <div className="mb-2 small text-gray-500">Body</div>
              <pre className="dark:text-gray-200 m-0 text-gray-800 text-sm" style={{ whiteSpace: "pre-wrap", fontFamily: "inherit" }}>
                {emailBody}
              </pre>
            </div>

            <div className="bg-white border-gray-200 border-t dark:bg-gray-800 dark:border-gray-700 px-1 py-1">
              <div className="align-items-center d-flex position-relative" style={{ minHeight: "2.5rem" }}>
                <button type="button" onClick={handleOpenEmailDraft} disabled={!selected} className="align-items-center btn btn-primary d-flex gap-1">
                  <EnvelopeIcon className="ui-icon-4" />
                  Email
                </button>

                <button type="button" onClick={() => setIsEmailPreviewOpen(false)} className="align-items-center btn btn-outline-secondary d-flex gap-1 position-absolute" style={{ left: "50%", transform: "translateX(-50%)" }}>
                  <XMarkIcon className="ui-icon-4" />
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
