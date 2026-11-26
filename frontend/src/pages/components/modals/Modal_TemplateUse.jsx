import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { XMarkIcon, PrinterIcon, PencilSquareIcon, ArrowDownTrayIcon, EnvelopeIcon, DocumentTextIcon } from "../../../icons";
import { templatesAPI, clientsAPI, clientCartAPI, inventoryAPI, purchaseOrdersAPI, emailAPI, settingsAPI } from "../../../services/api";
import Modal from "./Modal";
import Modal_Template_Editor from "./Modal_TemplateEdit";
import Button_Toolbar from "../buttons/Button_Toolbar";
import Footer_Actions from "../footers/Footer_Actions";
import useStore from "../../../services/useStore";
import Accordion from "../accordions/Accordion";
import EmailComposer from "./EmailComposer";
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

const usesCatalogueVariables = (template) => (
  template?.template_type === "catalogue"
  || template?.content?.includes("{{#catalogue.items}}")
  || template?.content?.includes("{{catalogue.")
  || template?.content?.includes("{{catalogue_item.")
);

const createPrintableDocument = (html, title) => `<!DOCTYPE html><html><head>
  <meta charset="utf-8"/>
  <title>${title}</title>
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
</head><body>${html}</body></html>`;

const createContactEntry = (type, record) => {
  const name = record?.name
    || (type === "employee" ? `${record?.first_name || ""} ${record?.last_name || ""}`.trim() : "");
  if (!record?.id || !record?.email || !name) return null;
  return {
    type,
    id: String(record.id),
    name,
    email: record.email,
    email_verified: Boolean(record.email_verified),
  };
};

/**
 * Props:
 *  page          – 'clients' | 'employees' | 'sales' | 'schedule' | 'suppliers'
 *  entity        – client | employee | transaction | appointment object
 *  currentUser   – logged-in user object
 *  settings      – AppSettings object
 *  items         – (optional) sale transaction items for sales page
 *  catalogueItems – (optional) selected services or products for a catalogue
 *  selectedEntities – (optional) selected page records to combine in one document
 *  client        – (optional) client for sales/schedule page
 *  employee      – (optional) employee for schedule page
 *  service       – (optional) service for schedule page
 *  filterType    – (optional) only show templates of this type (e.g. 'email', 'invoice')
 *  initialTemplateType – (optional) select this type first without filtering other templates
 *  onClose       – callback to close this modal
 */
export default function Modal_TemplateUse({ page, entity, currentUser, settings, items = [], catalogueItems = [], selectedEntities = [], client, employee, service, filterType = null, initialTemplateType = null, purchaseOrderId = null, onClose }) {
  const { hasPermission } = useStore();
  const canEditTemplates = hasPermission("templates", "write");
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [renderedHtml, setRenderedHtml] = useState("");
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editorTemplate, setEditorTemplate] = useState(null);
  const [isDocumentPreviewOpen, setIsDocumentPreviewOpen] = useState(false);
  const [isEmailComposerOpen, setIsEmailComposerOpen] = useState(false);
  const [emailDrafts, setEmailDrafts] = useState([]);
  const [emailDraftsLoading, setEmailDraftsLoading] = useState(false);
  const [emailDraftLoadError, setEmailDraftLoadError] = useState("");
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [sendingDraftId, setSendingDraftId] = useState("");
  const [verificationLoadingDraftId, setVerificationLoadingDraftId] = useState("");
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
  const isMultiEntitySelection = selectedEntities.length > 1;
  const recipientEmail = (client?.email || entity?.email || employee?.email || "").trim();
  const isPayslip = filterType === "payslip";
  const isPurchaseOrderTemplate = page === "suppliers" && selected?.template_type === "purchase_order";

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
    if (page !== "suppliers" || !entity?.id || isMultiEntitySelection) {
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
  }, [page, entity?.id, purchaseOrderId, isMultiEntitySelection]);

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
      if (page !== "clients" || !entity?.id || isMultiEntitySelection) {
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
  }, [page, entity?.id, isMultiEntitySelection]);

  const buildVars = useCallback((targetEntity = entity) => {
    const templateSettings = { ...emailSettings, ...(settings || {}) };
    if (usesCatalogueVariables(selected) && catalogueItems.length > 0) {
      return buildCatalogueVariables(catalogueItems, page, currentUser, templateSettings);
    }
    if (page === "clients") {
      const baseVars = buildClientVariables(targetEntity, currentUser, templateSettings);
      if (isMultiEntitySelection) {
        return {
          ...baseVars,
          "invoice.number": "",
          "invoice.date": "",
          "invoice.subtotal": "",
          "invoice.discount": "",
          "invoice.discount_amount": "",
          "invoice.tax": "",
          "invoice.total": "",
          "invoice.totals_table": "",
          "invoice.items": "",
          "invoice.items.table": "",
          "invoice.items.compact_feature_table": "",
          "invoice.items.dense_table": "",
          "invoice.items.feature_table": "",
          "invoice.payment_method": "",
        };
      }
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
        const taxRate = toTaxRateDecimal(templateSettings?.tax_rate);
        const taxAmount = subtotal * taxRate;
        txForInvoice = {
          id: `CART-${targetEntity?.id || "CLIENT"}`,
          created_at: new Date().toISOString(),
          subtotal,
          tax_amount: taxAmount,
          total: subtotal + taxAmount,
          payment_method: "pending",
        };
        itemsForInvoice = cartItems;
      }

      const invoiceVars = buildSalesVariables(txForInvoice, targetEntity, currentUser, templateSettings, itemsForInvoice);
      return { ...invoiceVars, ...baseVars };
    }
    if (page === "employees" && filterType === "payslip") return buildPayslipVariables(targetEntity, employee || currentUser, currentUser, templateSettings);
    if (page === "employees") return buildEmployeeVariables(targetEntity, currentUser, templateSettings);
    if (page === "sales") return buildSalesVariables(targetEntity, client || targetEntity, currentUser, templateSettings, items);
    if (page === "schedule") return buildScheduleVariables(targetEntity, client, employee, service, currentUser, templateSettings);
    if (page === "services") return buildServiceVariables(targetEntity, currentUser, templateSettings);
    if (page === "inventory") return buildInventoryVariables(targetEntity, currentUser, templateSettings);
    if (page === "suppliers") return buildPurchaseOrderVariables(isMultiEntitySelection ? null : purchaseOrder, targetEntity, currentUser, templateSettings, inventoryItems);
    return {};
  }, [page, entity, currentUser, settings, emailSettings, selected, items, catalogueItems, selectedEntities, isMultiEntitySelection, client, employee, service, filterType, clientCartItems, clientInvoiceTx, clientInvoiceItems, parseSelectedOptions, toTaxRateDecimal, purchaseOrder, inventoryItems]);

  useEffect(() => {
    if (!selected) {
      setRenderedHtml("");
      return;
    }
    const isCombinedCatalogue = usesCatalogueVariables(selected) && catalogueItems.length > 0;
    if (isMultiEntitySelection && !isCombinedCatalogue) {
      const rendered = selectedEntities.map((record, index) => {
        const pageBreak = index === 0 ? "" : ' style="break-before:page;page-break-before:always;"';
        return `<div${pageBreak}>${renderTemplate(selected.content, buildVars(record))}</div>`;
      }).join("");
      setRenderedHtml(normalizeImageAlignment(rendered));
      return;
    }
    setRenderedHtml(normalizeImageAlignment(renderTemplate(selected.content, buildVars())));
  }, [selected, buildVars, normalizeImageAlignment, selectedEntities, catalogueItems, isMultiEntitySelection]);

  const pdfFileName = useMemo(() => {
    const safeName = (selected?.name || companyName || "invoice")
      .replace(/[^a-z0-9\-_\s]/gi, "")
      .trim()
      .replace(/\s+/g, "_")
      .toLowerCase();
    const purchaseOrderSuffix = isPurchaseOrderTemplate && purchaseOrder?.po_number
      ? `_${String(purchaseOrder.po_number).replace(/[^a-z0-9\-_]/gi, "")}`
      : "";
    const selectionSuffix = isMultiEntitySelection ? `_selected_${selectedEntities.length}` : "";
    return `${safeName || "invoice"}${purchaseOrderSuffix}${selectionSuffix}.pdf`;
  }, [selected?.name, companyName, isPurchaseOrderTemplate, purchaseOrder?.po_number, isMultiEntitySelection, selectedEntities.length]);

  // Build the full HTML document for print / preview iframe
  const iframeContent = useMemo(() => {
    if (!renderedHtml) return "";
    return createPrintableDocument(renderedHtml, companyName);
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

  const createEmailDocumentHtml = useCallback((records, itemsForCatalogue = []) => {
    let html;
    if (usesCatalogueVariables(selected) && itemsForCatalogue.length > 0) {
      const templateSettings = { ...emailSettings, ...(settings || {}) };
      html = renderTemplate(
        selected.content,
        buildCatalogueVariables(itemsForCatalogue, page, currentUser, templateSettings)
      );
    } else {
      html = records.map((record, index) => {
        const pageBreak = index === 0 ? "" : ' style="break-before:page;page-break-before:always;"';
        return `<div${pageBreak}>${renderTemplate(selected.content, buildVars(record))}</div>`;
      }).join("");
    }
    return createPrintableDocument(normalizeImageAlignment(html), companyName);
  }, [selected, emailSettings, settings, page, currentUser, buildVars, normalizeImageAlignment, companyName]);

  const openEmailComposer = async () => {
    if (!selected) return;
    setIsEmailComposerOpen(true);
    setEmailDrafts([]);
    setEmailDraftsLoading(true);
    setEmailDraftLoadError("");

    try {
      const records = selectedEntities.length > 0 ? selectedEntities : entity ? [entity] : [];
      let groups = [];
      if (page === "inventory") {
        const itemsForSelection = catalogueItems.length > 0 ? catalogueItems : records;
        const grouped = new Map();
        itemsForSelection.forEach((item) => {
          const supplierId = item?.supplier_id ? String(item.supplier_id) : "unassigned";
          if (!grouped.has(supplierId)) {
            grouped.set(supplierId, {
              id: `inventory:${supplierId}`,
              label: item?.supplier_name || "Items without a supplier",
              records: [],
              catalogueItems: [],
              supplierId: supplierId === "unassigned" ? "" : supplierId,
            });
          }
          const group = grouped.get(supplierId);
          group.records.push(item);
          group.catalogueItems.push(item);
        });
        groups = [...grouped.values()];
      } else if (records.length > 1 && ["clients", "employees", "suppliers"].includes(page)) {
        groups = records.map((record) => ({
          id: `${page}:${record.id}`,
          label: record.name || `${record.first_name || ""} ${record.last_name || ""}`.trim() || "Selected record",
          records: [record],
          catalogueItems: [],
        }));
      } else {
        groups = [{
          id: `${page}:document`,
          label: selected.name || "Document",
          records: records.length > 0 ? records : [entity].filter(Boolean),
          catalogueItems,
        }];
      }

      const supplierIds = page === "inventory"
        ? groups.map((group) => group.supplierId).filter(Boolean)
        : [];
      const managerIds = page === "employees"
        ? groups.map((group) => group.records[0]?.reports_to).filter(Boolean).map(String)
        : [];
      const lookupResults = await Promise.all([
        supplierIds.length > 0
          ? emailAPI.getContactsByIds("supplier", [...new Set(supplierIds)], page)
          : Promise.resolve({ data: { contacts: [] } }),
        managerIds.length > 0
          ? emailAPI.getContactsByIds("employee", [...new Set(managerIds)], page)
          : Promise.resolve({ data: { contacts: [] } }),
      ].map((request) => request.then(
        (response) => ({ response }),
        (error) => ({ error })
      )));
      const lookupContacts = lookupResults.map((result) => result.response?.data?.contacts || []);
      const lookupError = lookupResults.find((result) => result.error)?.error;
      if (lookupError) {
        setEmailDraftLoadError(
          lookupError?.response?.data?.detail || lookupError?.message || "Some automatic recipient details could not be loaded."
        );
      }
      const suppliersById = new Map(lookupContacts[0].map((contact) => [String(contact.id), contact]));
      const employeesById = new Map(lookupContacts[1].map((contact) => [String(contact.id), contact]));

      const drafts = groups.map((group) => {
        const record = group.records[0] || entity || {};
        const supplierContact = group.supplierId ? suppliersById.get(group.supplierId) : null;
        if (supplierContact?.name) group.label = supplierContact.name;
        const recipientType = page === "inventory" || page === "suppliers"
          ? "supplier"
          : page === "employees"
            ? "employee"
            : page === "clients"
              ? "client"
              : client?.id
                ? "client"
                : employee?.id
                  ? "employee"
                  : "";
        const primaryRecipient = page === "inventory"
          ? supplierContact
          : page === "clients" || page === "employees" || page === "suppliers"
            ? record
            : client || employee || entity;
        const to = recipientType && primaryRecipient
          ? [createContactEntry(recipientType, primaryRecipient)].filter(Boolean)
          : recipientEmail && recipientType
            ? [{ type: recipientType, id: record.id ? String(record.id) : undefined, name: record.name || "", email: recipientEmail }]
            : [];
        const manager = page === "employees" && record.reports_to
          ? employeesById.get(String(record.reports_to))
          : null;
        const cc = manager ? [createContactEntry("employee", manager)].filter(Boolean) : [];
        const greetingName = page === "inventory"
          ? supplierContact?.name || group.label
          : page === "employees"
            ? `${record.first_name || ""} ${record.last_name || ""}`.trim()
            : record.contact_person || record.name || client?.name || "there";
        const body = isPurchaseOrderTemplate
          ? [
              `Hello ${greetingName || "there"},`,
              "",
              `Please review the attached purchase order${purchaseOrder?.po_number ? ` ${purchaseOrder.po_number}` : ""}.`,
              "Please confirm receipt and let us know if any changes are needed.",
              "",
              "Thanks,",
              companyName,
            ].join("\n")
          : [
              `Hello ${greetingName || "there"},`,
              "",
              `Please find the attached ${selected.name || "document"} from ${companyName}.`,
              "If you have any questions, reply to this email and we will help right away.",
              "",
              "Thanks,",
              companyName,
            ].join("\n");
        const safeRecipient = String(group.label || "document")
          .replace(/[^a-z0-9_\s-]/gi, "")
          .trim()
          .replace(/\s+/g, "_")
          .toLowerCase();
        const baseName = pdfFileName.replace(/\.pdf$/i, "");
        const documentHtml = createEmailDocumentHtml(group.records, group.catalogueItems);
        const verification = null;
        return {
          id: group.id,
          label: group.label,
          documentHtml,
          attachmentName: `${baseName}_${safeRecipient || "document"}.pdf`,
          value: {
            to,
            cc,
            subject: isPurchaseOrderTemplate && purchaseOrder?.po_number
              ? `Purchase Order ${purchaseOrder.po_number} from ${companyName}`
              : `${selected.name || "Document"} from ${companyName}`,
            body,
          },
          error: "",
          success: "",
          verification,
          verificationCode: "",
          verificationStatus: "",
        };
      });
      setEmailDrafts(drafts);
    } catch (error) {
      setEmailDraftLoadError(error?.response?.data?.detail || error?.message || "Unable to prepare the email drafts.");
    } finally {
      setEmailDraftsLoading(false);
    }
  };

  const updateEmailDraft = (draftId, patch) => {
    setEmailDrafts((previous) => previous.map((draft) => (
      draft.id === draftId ? { ...draft, ...patch } : draft
    )));
  };

  const handleSendEmail = async (draft) => {
    if (!selected || !draft) return;
    if (emailSettingsLoading || !emailSettings?.sending_email || !emailSettings?.sending_email_verified) {
      updateEmailDraft(draft.id, {
        error: "Verify the company's Sending Email in Profile > General Settings before sending.",
        success: "",
      });
      return;
    }
    if (isPurchaseOrderTemplate && (!purchaseOrder || purchaseOrderLoading || purchaseOrderError)) return;

    setSendingDraftId(draft.id);
    updateEmailDraft(draft.id, { error: "", success: "", verification: null });
    try {
      const cacheKey = `${pdfCacheKey}:${draft.id}`;
      let blob = pdfCacheRef.current.get(cacheKey);
      if (!blob) {
        blob = await createPdfBlob(draft.documentHtml);
        pdfCacheRef.current.set(cacheKey, blob);
      }
      const attachmentBase64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
        reader.onerror = () => reject(reader.error || new Error("Unable to read the generated PDF attachment."));
        reader.readAsDataURL(blob);
      });
      const toApiRecipient = ({ type, id, email }) => ({
        recipient_type: type,
        ...(id ? { recipient_id: id } : {}),
        email,
      });
      await emailAPI.send({
        page,
        recipients: draft.value.to.map(toApiRecipient),
        cc_recipients: draft.value.cc.map(toApiRecipient),
        subject: draft.value.subject,
        text_body: draft.value.body,
        attachment_name: draft.attachmentName,
        attachment_base64: attachmentBase64,
      });
      updateEmailDraft(draft.id, { success: "Email sent successfully.", error: "" });
    } catch (error) {
      const detail = error?.response?.data?.detail;
      const allRecipients = [...draft.value.to, ...draft.value.cc];
      const verifyTarget = detail?.recipient || (
        detail?.code === "recipient_email_unverified"
          ? allRecipients.find((recipient) =>
              ["client", "supplier"].includes(recipient.type)
              && recipient.id
              && !recipient.email_verified
            )
          : null
      );
      updateEmailDraft(draft.id, {
        error: detail?.message || (typeof detail === "string" ? detail : error?.message || "Unable to send email."),
        success: "",
        verification: detail?.code === "recipient_email_unverified" && verifyTarget
          ? { type: verifyTarget.type || verifyTarget.recipient_type, id: verifyTarget.id || verifyTarget.recipient_id }
          : null,
        verificationCode: "",
        verificationStatus: "",
      });
    } finally {
      setSendingDraftId("");
    }
  };

  const handleRequestRecipientVerification = async (draft) => {
    if (!draft?.verification) return;
    setVerificationLoadingDraftId(draft.id);
    updateEmailDraft(draft.id, { verificationStatus: "" });
    try {
      await emailAPI.requestContactEmailVerification(draft.verification.type, draft.verification.id);
      updateEmailDraft(draft.id, { verificationStatus: "Verification code sent to the recipient." });
    } catch (error) {
      const detail = error?.response?.data?.detail;
      updateEmailDraft(draft.id, {
        verificationStatus: typeof detail === "string" ? detail : error?.message || "Unable to send a verification code.",
      });
    } finally {
      setVerificationLoadingDraftId("");
    }
  };

  const handleConfirmRecipientVerification = async (draft) => {
    if (!draft?.verification || draft.verificationCode.length !== 8) return;
    setVerificationLoadingDraftId(draft.id);
    updateEmailDraft(draft.id, { verificationStatus: "" });
    try {
      await emailAPI.confirmContactEmailVerification(
        draft.verification.type,
        draft.verification.id,
        draft.verificationCode
      );
      const markVerified = (recipients) => recipients.map((recipient) => (
        recipient.type === draft.verification.type
        && recipient.id === draft.verification.id
          ? { ...recipient, email_verified: true }
          : recipient
      ));
      updateEmailDraft(draft.id, {
        value: {
          ...draft.value,
          to: markVerified(draft.value.to),
          cc: markVerified(draft.value.cc),
        },
        verification: null,
        verificationCode: "",
        verificationStatus: "Recipient email verified. Send the email again to continue.",
        error: "",
      });
    } catch (error) {
      const detail = error?.response?.data?.detail;
      updateEmailDraft(draft.id, {
        verificationStatus: typeof detail === "string" ? detail : error?.message || "Unable to verify the recipient email.",
      });
    } finally {
      setVerificationLoadingDraftId("");
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
  const getTemplateUnavailableReason = useCallback((template) => {
    if (page === "employees" && selectedEntities.length > 0 && template.template_type === "payslip") {
      return "Select a pay slip from the employee profile to use this template.";
    }
    if (page === "clients" && isMultiEntitySelection && ["invoice", "receipt"].includes(template.template_type)) {
      return "Select one client or use a Sales transaction to generate transaction documents.";
    }
    if (page === "suppliers" && isMultiEntitySelection && template.template_type === "purchase_order") {
      return "Select one supplier to choose a purchase order for this template.";
    }
    if (page === "inventory" && selectedEntities.length > 0 && usesCatalogueVariables(template) && catalogueItems.length === 0) {
      return "Select at least one product to generate a catalogue.";
    }
    return "";
  }, [page, selectedEntities.length, isMultiEntitySelection, catalogueItems.length]);

  useEffect(() => {
    if (!loading && visibleTemplates.length > 0 && !selected) {
      setSelected(
        visibleTemplates.find((template) => template.template_type === initialTemplateType && !getTemplateUnavailableReason(template))
        || visibleTemplates.find((template) => !getTemplateUnavailableReason(template))
        || null
      );
    }
  }, [loading, selected, visibleTemplates, initialTemplateType, getTemplateUnavailableReason]);

  const selectedEntityKey = selectedEntities.map((record) => record?.id ?? record?.name ?? "").join(",");
  const pdfCacheKey = isPurchaseOrderTemplate && purchaseOrder?.id
    ? `${selected?.id}:${purchaseOrder.id}:${selectedEntityKey}`
    : `${selected?.id}:${selectedEntityKey}`;
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
        noPadding={false}
        footer={
          <Footer_Actions
            start={
              <>
                {!isPayslip && (
                  <div className="app-dropup position-relative" ref={templateDropupRef}>
                    <Button_Toolbar
                      icon={DocumentTextIcon}
                      label="Templates"
                      onClick={() => setTemplateDropupOpen((v) => !v)}
                      className="btn-outline-secondary app-menu-trigger"
                      aria-expanded={templateDropupOpen}
                      aria-haspopup="listbox"
                      title="Choose template"
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
                              aria-disabled={Boolean(getTemplateUnavailableReason(tpl))}
                              onClick={() => {
                                if (getTemplateUnavailableReason(tpl)) return;
                                setSelected(tpl);
                                setTemplateDropupOpen(false);
                              }}
                              title={getTemplateUnavailableReason(tpl) || tpl.name}
                              className={`app-menu-item d-flex align-items-center justify-content-between gap-2 px-2 py-1 rounded ${
                                getTemplateUnavailableReason(tpl)
                                  ? "cursor-not-allowed opacity-50 text-muted"
                                  : selected?.id === tpl.id
                                    ? "bg-primary text-white cursor-pointer"
                                    : "hover:bg-gray-100 dark:hover:bg-gray-800 text-body cursor-pointer"
                              }`}
                              style={{ cursor: getTemplateUnavailableReason(tpl) ? "not-allowed" : "pointer" }}
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
                <Button_Toolbar
                  icon={DocumentTextIcon}
                  label="Preview"
                  onClick={() => setIsDocumentPreviewOpen(true)}
                  disabled={!selected || !iframeContent || purchaseOrderActionDisabled}
                  className="btn-outline-secondary"
                  title="Preview the selected records as a document"
                />
                <Button_Toolbar
                  icon={PrinterIcon}
                  label=""
                  compact
                  onClick={handlePrint}
                  disabled={!selected || purchaseOrderActionDisabled}
                  className="btn-outline-secondary"
                  title="Print"
                />
                <Button_Toolbar
                  icon={ArrowDownTrayIcon}
                  label=""
                  compact
                  onClick={handleDownloadPdf}
                  disabled={!selected || isDownloadingPdf || purchaseOrderActionDisabled}
                  className="btn-outline-secondary"
                  title={isDownloadingPdf ? "Downloading PDF" : "Download PDF"}
                />
                {!isPayslip && (
                  <Button_Toolbar
                    icon={EnvelopeIcon}
                    label=""
                    compact
                    onClick={openEmailComposer}
                    disabled={!selected || purchaseOrderActionDisabled}
                    className="btn-outline-secondary"
                    title="Compose an email with the generated PDF"
                  />
                )}
                {!isPayslip && canEditTemplates && (
                  <Button_Toolbar
                    icon={PencilSquareIcon}
                    label=""
                    compact
                    onClick={handleOpenTemplateEditor}
                    disabled={!selected}
                    className="btn-outline-secondary"
                    title={selected?.is_standard ? "Customize template" : "Edit template"}
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

        <div
          className="bg-white border-bottom dark:bg-gray-800 mb-2 py-2"
          style={{ position: "sticky", top: 0, zIndex: 30 }}
        >
          <div className="fw-semibold min-w-0 text-body text-truncate">
            {selected?.name || (loading ? "Loading templates..." : "Select a template")}
          </div>
        </div>

        {isMultiEntitySelection && (
          <div className="alert alert-info py-1 small" role="status">
            This document combines {selectedEntities.length} selected records. Email drafts are separated by supplier, employee, or client when applicable.
          </div>
        )}

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

      {isDocumentPreviewOpen && selected && (
        <Modal
          isOpen={isDocumentPreviewOpen}
          onClose={() => setIsDocumentPreviewOpen(false)}
          title="Document Preview"
          headerActions={
            <div className="align-items-center d-flex gap-2">
              <Button_Toolbar
                icon={PrinterIcon}
                label="Print"
                onClick={handlePrint}
                disabled={!iframeContent || purchaseOrderActionDisabled}
                className="btn-outline-secondary"
                title="Print the selected records"
              />
              <Button_Toolbar
                icon={ArrowDownTrayIcon}
                label="Download PDF"
                onClick={handleDownloadPdf}
                disabled={!iframeContent || isDownloadingPdf || purchaseOrderActionDisabled}
                className="btn-outline-secondary"
                title="Download the selected records as a PDF"
              />
            </div>
          }
          footer={
            <Button_Toolbar icon={XMarkIcon} label="Close" onClick={() => setIsDocumentPreviewOpen(false)} className="btn-outline-secondary" title="Close preview" />
          }
        >
          <iframe
            srcDoc={iframeContent}
            title="Preview of the selected template output"
            className="border-0 w-100"
            style={{ minHeight: "70vh", background: "#fff" }}
          />
        </Modal>
      )}

      {isEmailComposerOpen && selected && (
        <Modal
          isOpen={isEmailComposerOpen}
          onClose={() => setIsEmailComposerOpen(false)}
          title="Compose Email"
          footer={
            <Button_Toolbar
              icon={XMarkIcon}
              label="Close"
              onClick={() => setIsEmailComposerOpen(false)}
              className="btn-outline-secondary"
              title="Close email composer"
            />
          }
        >
          <div className="d-flex flex-column gap-2">
            {emailDraftsLoading && <div className="small text-muted">Preparing recipient drafts…</div>}
            {emailDraftLoadError && <div className="alert alert-warning py-2 small" role="status">{emailDraftLoadError}</div>}
            {!emailDraftsLoading && emailDrafts.length === 0 && !emailDraftLoadError && (
              <div className="alert alert-info py-2 small">There are no selected records to prepare an email for.</div>
            )}
            {emailDrafts.map((draft, index) => (
              <Accordion
                key={draft.id}
                variant="settings"
                header={
                  <span className="align-items-center d-flex gap-2">
                    <span>{draft.label}</span>
                    {draft.success && <span className="badge bg-success">Sent</span>}
                    {!draft.value.to.length && <span className="badge bg-warning text-dark">Add recipient</span>}
                  </span>
                }
                defaultOpen={index === 0}
              >
                <EmailComposer
                  page={page}
                  value={draft.value}
                  onChange={(value) => updateEmailDraft(draft.id, { value, error: "", success: "" })}
                  fromEmail={emailSettings?.sending_email}
                  senderVerified={Boolean(emailSettings?.sending_email && emailSettings?.sending_email_verified)}
                  attachmentName={draft.attachmentName}
                  sending={sendingDraftId === draft.id}
                  error={draft.error}
                  success={draft.success}
                  verification={draft.verification}
                  verificationCode={draft.verificationCode}
                  verificationStatus={draft.verificationStatus}
                  verificationLoading={verificationLoadingDraftId === draft.id}
                  onVerificationCodeChange={(verificationCode) => updateEmailDraft(draft.id, { verificationCode })}
                  onRequestVerification={() => handleRequestRecipientVerification(draft)}
                  onConfirmVerification={() => handleConfirmRecipientVerification(draft)}
                  onSend={() => handleSendEmail(draft)}
                />
              </Accordion>
            ))}
          </div>
        </Modal>
      )}
    </>
  );
}
