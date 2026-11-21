import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { XMarkIcon, PrinterIcon, PencilSquareIcon, ArrowDownTrayIcon, EnvelopeIcon, CheckIcon, DocumentTextIcon } from "../../../icons";
import { templatesAPI, clientsAPI, clientCartAPI, inventoryAPI, purchaseOrdersAPI, emailAPI, settingsAPI } from "../../../services/api";
import Modal from "./Modal";
import Modal_Template_Editor from "./Modal_TemplateEdit";
import Button_Toolbar from "../buttons/Button_Toolbar";
import Footer_Actions from "../footers/Footer_Actions";
import useStore from "../../../services/useStore";
import {
  renderTemplate,
  buildClientVariables,
  buildEmployeeVariables,
  buildPayslipVariables,
  buildSalesVariables,
  buildScheduleVariables,
  buildServiceVariables,
  buildInventoryVariables,
  buildCatalogueVariables,
  buildPurchaseOrderVariables,
} from "../utils/Utils_TemplateVariables";
import Dropdown_Custom from "../dropdowns/Dropdown_Custom";

const TYPE_BADGE_COLOR = {
  email: "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300",
  invoice: "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300",
  receipt: "bg-teal-100 text-teal-800 dark:bg-teal-900/50 dark:text-teal-300",
  payslip: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300",
  memo: "bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300",
  quote: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300",
  catalogue: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300",
  custom: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
};

/**
 * Props:
 *  page          – 'clients' | 'employees' | 'sales' | 'schedule' | 'suppliers'
 *  entity        – client | employee | transaction | appointment object
 *  currentUser   – logged-in user object
 *  settings      – AppSettings object
 *  items         – (optional) sale transaction items for sales page
 *  catalogueItems – (optional) selected services or products for a catalogue
 *  client        – (optional) client for sales/schedule page
 *  employee      – (optional) employee for schedule page
 *  service       – (optional) service for schedule page
 *  filterType    – (optional) only show templates of this type (e.g. 'email', 'invoice')
 *  initialTemplateType – (optional) select this type first without filtering other templates
 *  onClose       – callback to close this modal
 */
export default function Modal_TemplateUse({ page, entity, currentUser, settings, items = [], catalogueItems = [], client, employee, service, filterType = null, initialTemplateType = null, purchaseOrderId = null, onClose }) {
  const { hasPermission } = useStore();
  const canEditTemplates = hasPermission("templates", "write");
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [renderedHtml, setRenderedHtml] = useState("");
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editorTemplate, setEditorTemplate] = useState(null);
  const [isEmailPreviewOpen, setIsEmailPreviewOpen] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailSendError, setEmailSendError] = useState("");
  const [recipientVerificationRequired, setRecipientVerificationRequired] = useState(false);
  const [recipientVerificationCode, setRecipientVerificationCode] = useState("");
  const [recipientVerificationStatus, setRecipientVerificationStatus] = useState("");
  const [recipientVerificationLoading, setRecipientVerificationLoading] = useState(false);
  const [recipientEmailVerified, setRecipientEmailVerified] = useState(Boolean(entity?.email_verified || client?.email_verified));
  const [emailSettings, setEmailSettings] = useState(settings || {});
  const [emailSettingsLoading, setEmailSettingsLoading] = useState(true);
  const [clientInvoiceTx, setClientInvoiceTx] = useState(null);
  const [clientInvoiceItems, setClientInvoiceItems] = useState([]);
  const [clientCartItems, setClientCartItems] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [purchaseOrdersLoading, setPurchaseOrdersLoading] = useState(false);
  const [selectedPurchaseOrderId, setSelectedPurchaseOrderId] = useState("");
  const [purchaseOrder, setPurchaseOrder] = useState(null);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [purchaseOrderLoading, setPurchaseOrderLoading] = useState(false);
  const [purchaseOrderError, setPurchaseOrderError] = useState("");
  const [templateDropupOpen, setTemplateDropupOpen] = useState(false);
  const templateDropupRef = useRef(null);
  const printIframeRef = useRef(null);
  const pdfCacheRef = useRef(new Map());
  const companyName = emailSettings?.company_name?.trim() || emailSettings?.business_name?.trim() || "Invoice";
  const recipientEmail = (client?.email || entity?.email || employee?.email || "").trim();
  const recipientType = page === "clients" ? "client"
    : page === "suppliers" ? "supplier"
      : page === "employees" ? "employee"
        : client?.id ? "client"
          : employee?.id ? "employee"
            : "external";
  const recipientId = page === "clients" || page === "suppliers" || page === "employees"
    ? entity?.id
    : client?.id || employee?.id;
  const canVerifyRecipient = ["client", "supplier"].includes(recipientType) && Boolean(recipientId);
  const isPayslip = filterType === "payslip";
  const isPurchaseOrderTemplate = page === "suppliers" && selected?.template_type === "purchase_order";

  useEffect(() => {
    setRecipientEmailVerified(Boolean(entity?.email_verified || client?.email_verified));
    setRecipientVerificationRequired(false);
    setRecipientVerificationCode("");
    setRecipientVerificationStatus("");
    setEmailSendError("");
  }, [recipientId, recipientEmail, entity?.email_verified, client?.email_verified]);

  useEffect(() => {
    let active = true;
    settingsAPI.getSettings()
      .then((response) => {
        if (active) {
          const data = response?.data ?? response ?? {};
          setEmailSettings((previous) => ({ ...previous, ...data }));
        }
      })
      .catch(() => {
        if (active) setEmailSettings((previous) => ({ ...previous, ...(settings || {}) }));
      })
      .finally(() => {
        if (active) setEmailSettingsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!settings) return;
    setEmailSettings((previous) => ({ ...previous, ...settings }));
  }, [
    settings?.sending_email,
    settings?.sending_email_verified,
    settings?.company_name,
    settings?.business_name,
  ]);

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
    if (page !== "suppliers" || !entity?.id) {
      setPurchaseOrders([]);
      setSelectedPurchaseOrderId("");
      setPurchaseOrdersLoading(false);
      return undefined;
    }

    if (purchaseOrderId) {
      setPurchaseOrders([]);
      setSelectedPurchaseOrderId(String(purchaseOrderId));
      setPurchaseOrdersLoading(false);
      setPurchaseOrderError("");
      return undefined;
    }

    setPurchaseOrdersLoading(true);
    setPurchaseOrderError("");
    purchaseOrdersAPI
      .getDraftsForSupplier(entity.id)
      .then((response) => {
        if (cancelled) return;
        const rows = Array.isArray(response?.data) ? response.data : [];
        setPurchaseOrders(rows);
        setSelectedPurchaseOrderId((current) =>
          rows.some((order) => String(order.id) === current)
            ? current
            : rows.length === 1
              ? String(rows[0].id)
              : ""
        );
        setPurchaseOrderError("");
      })
      .catch((error) => {
        if (cancelled) return;
        setPurchaseOrders([]);
        setSelectedPurchaseOrderId("");
        setPurchaseOrderError(error?.response?.data?.detail || error?.message || "Unable to load draft purchase orders.");
      })
      .finally(() => {
        if (!cancelled) setPurchaseOrdersLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [page, entity?.id, purchaseOrderId]);

  useEffect(() => {
    let cancelled = false;
    const activePurchaseOrderId = purchaseOrderId ? String(purchaseOrderId) : selectedPurchaseOrderId;
    if (page !== "suppliers" || !activePurchaseOrderId) {
      setPurchaseOrder(null);
      setInventoryItems([]);
      setPurchaseOrderLoading(false);
      return undefined;
    }

    setPurchaseOrderLoading(true);
    setPurchaseOrder(null);
    setInventoryItems([]);
    setPurchaseOrderError("");
    Promise.all([
      purchaseOrdersAPI.getById(activePurchaseOrderId),
      inventoryAPI.getAll(),
    ])
      .then(([orderResponse, inventoryResponse]) => {
        if (cancelled) return;
        const order = orderResponse?.data ?? orderResponse;
        const rows = Array.isArray(inventoryResponse?.data) ? inventoryResponse.data : inventoryResponse;
        if (!order || String(order.supplier_id) !== String(entity?.id)) {
          throw new Error("The selected purchase order does not belong to this supplier.");
        }
        if (!purchaseOrderId && String(order.status || "").toLowerCase() !== "draft") {
          throw new Error("This purchase order is no longer a draft. Refresh the supplier's purchase orders and choose another.");
        }
        if (!Array.isArray(rows)) {
          throw new Error("Inventory details could not be loaded for the purchase order.");
        }
        setPurchaseOrder(order);
        setInventoryItems(rows);
      })
      .catch((error) => {
        if (cancelled) return;
        setPurchaseOrder(null);
        setInventoryItems([]);
        setPurchaseOrderError(error?.response?.data?.detail || error?.message || "Unable to load the selected purchase order.");
      })
      .finally(() => {
        if (!cancelled) setPurchaseOrderLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [page, purchaseOrderId, selectedPurchaseOrderId, entity?.id]);

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
    if (catalogueItems.length > 0) return buildCatalogueVariables(catalogueItems, page, currentUser, settings);
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
    if (page === "services") return buildServiceVariables(entity, currentUser, settings);
    if (page === "inventory") return buildInventoryVariables(entity, currentUser, settings);
    if (page === "suppliers") return buildPurchaseOrderVariables(purchaseOrder, entity, currentUser, settings, inventoryItems);
    return {};
  }, [page, entity, currentUser, settings, items, catalogueItems, client, employee, service, filterType, clientCartItems, clientInvoiceTx, clientInvoiceItems, parseSelectedOptions, toTaxRateDecimal, purchaseOrder, inventoryItems]);

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
    const purchaseOrderSuffix = isPurchaseOrderTemplate && purchaseOrder?.po_number
      ? `_${String(purchaseOrder.po_number).replace(/[^a-z0-9\-_]/gi, "")}`
      : "";
    return `${safeName || "invoice"}${purchaseOrderSuffix}.pdf`;
  }, [selected?.name, companyName, isPurchaseOrderTemplate, purchaseOrder?.po_number]);

  const emailSubject = useMemo(
    () => isPurchaseOrderTemplate && purchaseOrder?.po_number
      ? `Purchase Order ${purchaseOrder.po_number} from ${companyName}`
      : `${selected?.name || "Document"} from ${companyName}`,
    [selected?.name, companyName, isPurchaseOrderTemplate, purchaseOrder?.po_number]
  );

  const emailBody = useMemo(() => {
    if (isPurchaseOrderTemplate) {
      return [
        `Hello ${entity?.contact_person || entity?.name || "there"},`,
        "",
        `Please review the attached purchase order${purchaseOrder?.po_number ? ` ${purchaseOrder.po_number}` : ""}.`,
        "Please confirm receipt and let us know if any changes are needed.",
        "",
        `Thanks,`,
        companyName,
      ].join("\n");
    }
    const customerName = client?.name || entity?.name || "there";
    return [`Hello ${customerName},`, "", `Please find your document from ${companyName} attached.`, "If you have any questions, reply to this email and we will help right away.", "", `Thanks,`, companyName].join("\n");
  }, [client?.name, entity?.name, entity?.contact_person, companyName, isPurchaseOrderTemplate, purchaseOrder?.po_number]);

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
      if (isPurchaseOrderTemplate && (!purchaseOrder || purchaseOrderLoading || purchaseOrderError)) return;
      const cacheKey = pdfCacheKey;
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

  const handleSendEmail = async () => {
    if (!selected) return;
    setEmailSendError("");
    if (emailSettingsLoading) {
      setEmailSendError("Company email settings are still loading. Please try again.");
      return;
    }
    if (!emailSettings?.sending_email || !emailSettings?.sending_email_verified) {
      setEmailSendError("Add and verify the company's Sending Email in Profile > General Settings before sending.");
      return;
    }
    if (!recipientEmail) {
      setEmailSendError("Add an email address to this recipient before sending.");
      return;
    }
    try {
      if (isPurchaseOrderTemplate && (!purchaseOrder || purchaseOrderLoading || purchaseOrderError)) return;
      setIsSendingEmail(true);
      let blob = pdfCacheRef.current.get(pdfCacheKey);
      if (!blob && iframeContent) {
        blob = await createPdfBlob(iframeContent);
        pdfCacheRef.current.set(pdfCacheKey, blob);
      }

      let attachmentBase64;
      if (blob) {
        attachmentBase64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
          reader.onerror = () => reject(reader.error || new Error("Unable to read the generated PDF attachment."));
          reader.readAsDataURL(blob);
        });
      }

      await emailAPI.send({
        page,
        recipient_type: recipientType,
        ...(recipientId ? { recipient_id: recipientId } : {}),
        recipient_email: recipientEmail,
        subject: emailSubject,
        text_body: emailBody,
        ...(attachmentBase64 ? { attachment_name: pdfFileName, attachment_base64: attachmentBase64 } : {}),
      });
      setIsEmailPreviewOpen(false);
      onClose?.();
    } catch (error) {
      const detail = error?.response?.data?.detail;
      if (detail?.code === "recipient_email_unverified") {
        setRecipientVerificationRequired(true);
        setEmailSendError(detail.message || "Verify this recipient's email before sending.");
      } else if (detail?.code === "sender_email_unverified") {
        setEmailSendError(detail.message || "Add and verify the company's Sending Email in Profile > General Settings before sending.");
      } else {
        setEmailSendError(typeof detail === "string" ? detail : error?.message || "Unable to send email.");
      }
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleRequestRecipientVerification = async () => {
    if (!canVerifyRecipient) return;
    setRecipientVerificationLoading(true);
    setRecipientVerificationStatus("");
    try {
      await emailAPI.requestContactEmailVerification(recipientType, recipientId);
      setRecipientVerificationStatus("Verification code sent to the recipient.");
      setRecipientVerificationCode("");
    } catch (error) {
      const detail = error?.response?.data?.detail;
      setRecipientVerificationStatus(typeof detail === "string" ? detail : error?.message || "Unable to send a verification code.");
    } finally {
      setRecipientVerificationLoading(false);
    }
  };

  const handleConfirmRecipientVerification = async () => {
    if (!canVerifyRecipient || recipientVerificationCode.length !== 8) return;
    setRecipientVerificationLoading(true);
    setRecipientVerificationStatus("");
    try {
      await emailAPI.confirmContactEmailVerification(recipientType, recipientId, recipientVerificationCode);
      setRecipientEmailVerified(true);
      setRecipientVerificationRequired(false);
      setRecipientVerificationCode("");
      setRecipientVerificationStatus("Recipient email verified. Send the email again to continue.");
      setEmailSendError("");
    } catch (error) {
      const detail = error?.response?.data?.detail;
      setRecipientVerificationStatus(typeof detail === "string" ? detail : error?.message || "Unable to verify the recipient email.");
    } finally {
      setRecipientVerificationLoading(false);
    }
  };

  const handleSaveTemplate = async (data) => {
    if (!selected) return;
    // Invalidate cached PDF for this template
    pdfCacheRef.current.clear();
    const isCopy = selected.is_standard;
    const res = isCopy
      ? await templatesAPI.create({ ...data, is_standard: false })
      : await templatesAPI.update(selected.id, data);
    const updated = res?.data ?? res;
    setTemplates((prev) => isCopy ? [updated, ...prev] : prev.map((tpl) => (tpl.id === selected.id ? updated : tpl)));
    setSelected(updated);
    setIsEditorOpen(false);
    setEditorTemplate(null);
  };

  const handleOpenTemplateEditor = () => {
    if (!selected) return;
    setEditorTemplate(
      selected.is_standard
        ? { ...selected, id: null, is_standard: false, name: `${selected.name} (Copy)` }
        : selected
    );
    setIsEditorOpen(true);
  };

  const visibleTemplates = filterType ? templates.filter((t) => t.template_type === filterType) : templates;

  useEffect(() => {
    if (!loading && visibleTemplates.length > 0 && !selected) {
      setSelected(visibleTemplates.find((template) => template.template_type === initialTemplateType) || visibleTemplates[0]);
    }
  }, [loading, selected, visibleTemplates, initialTemplateType]);

  const handleUseAction = () => {
    if (!selected) return;
    if (isPurchaseOrderTemplate || selected.template_type === "email" || recipientEmail) {
      setIsEmailPreviewOpen(true);
    } else {
      handlePrint();
    }
  };

  const pdfCacheKey = isPurchaseOrderTemplate && purchaseOrder?.id
    ? `${selected?.id}:${purchaseOrder.id}`
    : selected?.id;
  const purchaseOrderActionDisabled = isPurchaseOrderTemplate
    && (purchaseOrdersLoading || purchaseOrderLoading || !purchaseOrder || Boolean(purchaseOrderError));

  return (
    <>
      <Modal
        isOpen={true}
        onClose={onClose}
        title={
          <div className="align-items-center d-flex gap-2 min-w-0">
            <span className="text-truncate">{isPayslip ? "Pay Slip" : "Use Template"}</span>
            {selected && (
              <span className={`px-1.5 py-0.5 rounded text-xs font-medium flex-shrink-0 ${TYPE_BADGE_COLOR[selected.template_type] || TYPE_BADGE_COLOR.custom}`}>
                {selected.template_type}
              </span>
            )}
          </div>
        }
        headerActions={
          !isPurchaseOrderTemplate && (
            <div className="align-items-center d-flex gap-2">
            <Button_Toolbar
              icon={PrinterIcon}
              label=""
              compact
              onClick={handlePrint}
              disabled={!selected || purchaseOrderActionDisabled}
              className="btn-outline-secondary rounded-circle"
              title="Print"
            />
            <Button_Toolbar
              icon={ArrowDownTrayIcon}
              label=""
              compact
              onClick={handleDownloadPdf}
              disabled={!selected || isDownloadingPdf || purchaseOrderActionDisabled}
              className="btn-outline-secondary rounded-circle"
              title={isDownloadingPdf ? "Downloading..." : "Download PDF"}
            />
            {!isPayslip && canEditTemplates && (
              <Button_Toolbar
                icon={PencilSquareIcon}
                label=""
                compact
                onClick={handleOpenTemplateEditor}
                disabled={!selected}
                className="btn-outline-secondary rounded-circle"
                title={selected?.is_standard ? "Customize template" : "Edit template"}
              />
            )}
            </div>
          )
        }
        noPadding={false}
        footer={
          <Footer_Actions
            start={
              <>
                {isPurchaseOrderTemplate && (
                  <>
                    <Button_Toolbar
                      icon={PrinterIcon}
                      label="Print"
                      onClick={handlePrint}
                      disabled={!selected || purchaseOrderActionDisabled}
                      className="btn-outline-secondary"
                      title="Print purchase order"
                    />
                    <Button_Toolbar
                      icon={ArrowDownTrayIcon}
                      label={isDownloadingPdf ? "Downloading…" : "Download PDF"}
                      onClick={handleDownloadPdf}
                      disabled={!selected || isDownloadingPdf || purchaseOrderActionDisabled}
                      className="btn-outline-secondary"
                      title="Download purchase order as PDF"
                    />
                  </>
                )}
              </>
            }
            center={
              <>
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
            </>}
            end={
              <>

            {!isPayslip && (
              <Button_Toolbar
                icon={selected?.template_type === "email" || isPurchaseOrderTemplate ? EnvelopeIcon : CheckIcon}
                label={isPurchaseOrderTemplate ? "Prepare email" : selected?.template_type === "email" ? "Send" : "Use"}
                onClick={handleUseAction}
                disabled={!selected || purchaseOrderActionDisabled}
                className="btn-primary"
                title={isPurchaseOrderTemplate ? "Review the purchase order and prepare a manual email draft" : selected?.template_type === "email" ? "Send message" : "Use template"}
              />
            )}

            <Button_Toolbar
              icon={XMarkIcon}
              label="Cancel"
              onClick={onClose}
              className="btn-outline-secondary"
              title="Cancel"
            />
              </>
            }
          />
        }
      >
        {/* Hidden iframe used solely for native window.print() */}
        <iframe ref={printIframeRef} srcDoc={iframeContent} style={{ display: "none" }} title="Print frame" />

        {page === "suppliers" && selected?.template_type === "purchase_order" && (
          <div className="border-bottom mb-2 pb-2">
            {purchaseOrderId ? (
              <>
                <div className="form-label fw-medium mb-1">Purchase order</div>
                <div className="small text-muted">
                  {purchaseOrderLoading ? "Loading purchase order…" : purchaseOrder?.po_number || "Selected purchase order"}
                  {purchaseOrder?.status ? ` · ${String(purchaseOrder.status).replaceAll("_", " ")}` : ""}
                </div>
              </>
            ) : (
              <>
            <label className="form-label fw-medium mb-1" htmlFor="supplier-purchase-order-select">Draft purchase order</label>
            {purchaseOrdersLoading ? (
              <div className="small text-muted">Loading draft purchase orders...</div>
            ) : purchaseOrders.length > 0 ? (
              <Dropdown_Custom
                id="supplier-purchase-order-select"
                value={selectedPurchaseOrderId}
                onChange={(event) => setSelectedPurchaseOrderId(event.target.value)}
                options={purchaseOrders.map((order) => ({
                  value: String(order.id),
                  label: `${order.po_number || "Purchase order"} · ${Number(order.total_amount || 0).toFixed(2)}`,
                }))}
                placeholder="Select a draft purchase order"
                searchable
                closeOnSelect
              />
            ) : (
              <div className="small text-muted">No draft purchase orders are available for this supplier.</div>
            )}
            {purchaseOrderError && <div className="alert alert-danger mt-2 py-1 small" role="alert">{purchaseOrderError}</div>}
            {!purchaseOrdersLoading && purchaseOrders.length === 0 && !purchaseOrderError && (
              <div className="small text-muted mt-1">Create or extend a draft purchase order before preparing a supplier email.</div>
            )}
              </>
            )}
          </div>
        )}

        {/* Natural template preview: content dictates height, expanding modal upward until max-height */}
        <div className="template-use-preview bg-white dark:bg-gray-900 rounded p-2 text-gray-900 dark:text-gray-100" style={{ minHeight: "80px" }}>
          {selected ? (
            <div
              className="template-rendered-content"
              style={{ fontSize: "13px", lineHeight: "1.6", color: "inherit", overflow: "visible" }}
              dangerouslySetInnerHTML={{ __html: renderedHtml }}
            />
          ) : (
            <div className="flex items-center justify-center text-gray-400 text-sm py-4">
              {loading ? "Loading templates..." : "Select a template to preview"}
            </div>
          )}
        </div>
      </Modal>

      {isEditorOpen && editorTemplate && <Modal_Template_Editor template={editorTemplate} onSave={handleSaveTemplate} onClose={() => { setIsEditorOpen(false); setEditorTemplate(null); }} />}

      {isEmailPreviewOpen && selected && (
        <Modal
          isOpen={isEmailPreviewOpen}
          onClose={() => setIsEmailPreviewOpen(false)}
          title="Email Preview"
          footer={
            <div className="align-items-center d-flex gap-2 justify-content-start">
              <Button_Toolbar
                icon={EnvelopeIcon}
                label={emailSettingsLoading ? "Loading settings..." : isSendingEmail ? "Sending..." : "Send email"}
                onClick={handleSendEmail}
                disabled={!selected || isSendingEmail || emailSettingsLoading}
                className="btn-primary"
                title="Send this email with the generated PDF attachment"
              />
              <Button_Toolbar icon={XMarkIcon} label="Close" onClick={() => setIsEmailPreviewOpen(false)} className="btn-outline-secondary" title="Close" />
            </div>
          }
        >
          <div className="d-flex flex-column flex-grow-1 min-h-0 text-gray-900 dark:text-gray-100">
            <div className="bg-gray-50 border-bottom border-gray-200 dark:bg-gray-800 dark:border-gray-700 px-1 py-1">
              <div className="mb-1 small text-gray-500">To</div>
              <div className="dark:text-white text-gray-900 text-sm">{recipientEmail || "No recipient email available"}</div>
              {emailSendError && <div className="alert alert-danger mt-2 py-2 small" role="alert">{emailSendError}</div>}
              {recipientVerificationRequired && canVerifyRecipient && (
                <div className="border rounded mt-2 p-2">
                  <div className="align-items-center d-flex flex-wrap gap-2 mb-2">
                    <span className={`badge ${recipientEmailVerified ? "bg-success" : "bg-secondary"}`}>
                      {recipientEmailVerified ? "Recipient email verified" : "Recipient email not verified"}
                    </span>
                    <Button_Toolbar
                      icon={EnvelopeIcon}
                      label={recipientVerificationLoading ? "Sending..." : "Send verification code"}
                      onClick={handleRequestRecipientVerification}
                      disabled={recipientVerificationLoading || recipientEmailVerified}
                      className="btn-outline-primary"
                      title="Send an email verification code to this contact"
                    />
                  </div>
                  {!recipientEmailVerified && (
                    <div className="align-items-center d-flex flex-wrap gap-2">
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={8}
                        value={recipientVerificationCode}
                        onChange={(event) => setRecipientVerificationCode(event.target.value.replace(/\D/g, "").slice(0, 8))}
                        className="form-control form-control-sm"
                        placeholder="8-digit code"
                        aria-label="Recipient email verification code"
                      />
                      <Button_Toolbar
                        icon={CheckIcon}
                        label="Verify"
                        onClick={handleConfirmRecipientVerification}
                        disabled={recipientVerificationLoading || recipientVerificationCode.length !== 8}
                        className="btn-outline-success"
                        title="Verify the recipient email address"
                      />
                    </div>
                  )}
                  {recipientVerificationStatus && (
                    <div className={`small mt-2 ${/sent|verified/i.test(recipientVerificationStatus) ? "text-success" : "text-danger"}`} role="status">
                      {recipientVerificationStatus}
                    </div>
                  )}
                </div>
              )}

              <div className="mb-1 mt-3 small text-gray-500">Subject</div>
              <div className="dark:text-white text-gray-900 text-sm">{emailSubject}</div>

              <div className="mb-1 mt-3 small text-gray-500">Attachment</div>
              <div className="dark:text-white text-gray-900 text-sm">
                {isPurchaseOrderTemplate ? `${pdfFileName} (share with attachment or download to attach manually)` : `${pdfFileName} (generated on send)`}
              </div>
            </div>

            <div className="bg-white dark:bg-gray-900 px-1 py-1">
              <div className="mb-2 small text-gray-500">Body</div>
              <pre className="dark:text-gray-200 m-0 text-gray-800 text-sm" style={{ whiteSpace: "pre-wrap", fontFamily: "inherit" }}>
                {emailBody}
              </pre>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
