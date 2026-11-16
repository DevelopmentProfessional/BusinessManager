/**
 * Template variable definitions for the document template system.
 * Variables use Mustache-style {{scope.field}} placeholders.
 */
import { formatDateISO, formatTime } from "../../../utils/dateFormatters";

export const TEMPLATE_VARIABLES = {
  system: [
    { key: "date", label: "Today's Date", description: "Current date (YYYY-MM-DD)" },
    { key: "time", label: "Current Time", description: "Current time (HH:MM)" },
  ],
  company: [
    { key: "company.name", label: "Company Name", description: "Business name from settings" },
    { key: "company.email", label: "Company Email", description: "Business email from settings" },
    { key: "company.phone", label: "Company Phone", description: "Business phone from settings" },
    { key: "company.address", label: "Company Address", description: "Business address from settings" },
    { key: "company.logo", label: "Company Logo", description: "Company logo image", isLayout: true },
  ],
  sender: [
    { key: "sender.first_name", label: "Sender First Name", description: "Logged-in user first name" },
    { key: "sender.last_name", label: "Sender Last Name", description: "Logged-in user last name" },
    { key: "sender.email", label: "Sender Email", description: "Logged-in user email" },
  ],
  client: [
    { key: "client.name", label: "Client Name", description: "Full name of the client" },
    { key: "client.email", label: "Client Email", description: "Client email address" },
    { key: "client.phone", label: "Client Phone", description: "Client phone number" },
    { key: "client.membership_tier", label: "Membership Tier", description: "Client membership level" },
  ],
  employee: [
    { key: "employee.first_name", label: "Employee First Name", description: "Employee first name" },
    { key: "employee.last_name", label: "Employee Last Name", description: "Employee last name" },
    { key: "employee.role", label: "Employee Role", description: "Employee job role" },
    { key: "employee.hire_date", label: "Hire Date", description: "Employee hire date" },
  ],
  payslip: [
    { key: "payslip.number", label: "Pay Slip Number", description: "Short pay slip identifier" },
    { key: "payslip.paid_at", label: "Paid Date and Time", description: "When payment was recorded" },
    { key: "payslip.period_start", label: "Period Start", description: "Pay period start date" },
    { key: "payslip.period_end", label: "Period End", description: "Pay period end date" },
    { key: "payslip.gross", label: "Gross Pay", description: "Gross wage amount" },
    { key: "payslip.insurance_deduction", label: "Insurance Deduction", description: "Insurance deduction amount" },
    { key: "payslip.other_deductions", label: "Other Deductions", description: "Other deduction amount" },
    { key: "payslip.net", label: "Net Pay", description: "Final paid amount" },
    { key: "payslip.service_revenue", label: "Service Revenue", description: "Paid service revenue for the period" },
    { key: "payslip.base_pay", label: "Base Pay", description: "Base pay used in the calculation" },
    { key: "payslip.compensation_percentage", label: "Compensation Percentage", description: "Compensation rate used" },
  ],
  invoice: [
    { key: "invoice.number", label: "Invoice Number", description: "Transaction ID" },
    { key: "invoice.date", label: "Invoice Date", description: "Transaction date" },
    { key: "invoice.total", label: "Total", description: "Total amount" },
    { key: "invoice.subtotal", label: "Subtotal", description: "Subtotal before tax" },
    { key: "invoice.tax", label: "Tax", description: "Tax amount" },
    { key: "invoice.items", label: "Line Items (list)", description: "Purchased items as a bullet list" },
    { key: "invoice.items.table", label: "Line Items (table)", description: "Purchased items as a formatted table", isLayout: true },
    { key: "invoice.items.compact_feature_table", label: "Line Items (compact feature table)", description: "Purchased items with descriptive features stacked compactly under each product", isLayout: true },
    { key: "invoice.items.dense_table", label: "Line Items (dense table)", description: "Purchased items in an extra-tight print layout for longer orders", isLayout: true },
    { key: "invoice.items.feature_table", label: "Line Items (feature table)", description: "Purchased items with descriptive feature columns", isLayout: true },
    { key: "invoice.payment_method", label: "Payment Method", description: "Cash or card" },
  ],
  appointment: [
    { key: "appointment.date", label: "Appointment Date", description: "Formatted date (e.g. Monday, March 15, 2026)" },
    { key: "appointment.time", label: "Appointment Time", description: "Time (e.g. 10:30 AM)" },
    { key: "appointment.day", label: "Day of Week", description: "Day name (e.g. Monday)" },
    { key: "appointment.service", label: "Service Name", description: "Name of the booked service" },
    { key: "appointment.duration", label: "Duration", description: "Appointment duration (e.g. 1 hour 30 min)" },
    { key: "appointment.notes", label: "Notes", description: "Appointment notes" },
    { key: "appointment.employee_name", label: "Employee Name", description: "Full name of the assigned employee" },
  ],
  service: [
    { key: "service.name", label: "Service Name", description: "Name of the service" },
    { key: "service.description", label: "Service Description", description: "Client-facing service description" },
    { key: "service.category", label: "Service Category", description: "Service category" },
    { key: "service.price", label: "Service Price", description: "Formatted service price" },
    { key: "service.duration", label: "Service Duration", description: "Formatted service duration" },
    { key: "service.image", label: "Service Image", description: "Service image for catalogs and proposals", isLayout: true },
  ],
  inventory: [
    { key: "inventory.sku", label: "SKU", description: "Inventory item SKU" },
    { key: "inventory.name", label: "Item Name", description: "Inventory item name" },
    { key: "inventory.description", label: "Item Description", description: "Client-facing item description" },
    { key: "inventory.category", label: "Item Category", description: "Inventory category" },
    { key: "inventory.price", label: "Item Price", description: "Formatted item price" },
    { key: "inventory.image", label: "Item Image", description: "Primary inventory image for catalogs and proposals", isLayout: true },
  ],
  supplier: [
    { key: "supplier.name", label: "Supplier Name", description: "Supplier name" },
    { key: "supplier.contact_person", label: "Supplier Contact", description: "Supplier contact person" },
    { key: "supplier.email", label: "Supplier Email", description: "Supplier email address" },
    { key: "supplier.phone", label: "Supplier Phone", description: "Supplier phone number" },
    { key: "supplier.address", label: "Supplier Address", description: "Supplier mailing address" },
  ],
  purchase_order: [
    { key: "purchase_order.number", label: "Purchase Order Number", description: "Selected draft purchase order number" },
    { key: "purchase_order.date", label: "Purchase Order Date", description: "Selected purchase order date" },
    { key: "purchase_order.expected_delivery", label: "Expected Delivery", description: "Expected supplier delivery date" },
    { key: "purchase_order.status", label: "Purchase Order Status", description: "Selected purchase order status" },
    { key: "purchase_order.total", label: "Purchase Order Total", description: "Selected purchase order total" },
    { key: "purchase_order.items", label: "Purchase Order Items", description: "Item names, quantities, and totals" },
    { key: "purchase_order.items.table", label: "Purchase Order Items Table", description: "Formatted purchase-order line item table", isLayout: true },
  ],
};

/** Which variable scopes are available per page context */
export const PAGE_VARIABLE_SCOPES = {
  clients: ["system", "company", "sender", "client", "service", "inventory", "invoice"],
  employees: ["system", "company", "sender", "employee", "payslip"],
  sales: ["system", "company", "sender", "client", "service", "inventory", "invoice"],
  schedule: ["system", "company", "sender", "client", "service", "appointment"],
  services: ["system", "company", "sender", "service", "inventory"],
  inventory: ["system", "company", "sender", "inventory", "supplier", "service"],
  suppliers: ["system", "company", "sender", "supplier", "purchase_order"],
};

/**
 * Metadata about each scope — which pages it is populated on,
 * so the editor can surface this to the user.
 */
export const SCOPE_PAGE_CONTEXT = {
  system: { label: "System", pages: ["clients", "employees", "sales", "schedule", "services", "inventory", "suppliers"], color: "gray" },
  company: { label: "Company", pages: ["clients", "employees", "sales", "schedule", "services", "inventory", "suppliers"], color: "gray" },
  sender: { label: "Sender", pages: ["clients", "employees", "sales", "schedule", "services", "inventory", "suppliers"], color: "gray" },
  client: { label: "Client", pages: ["clients", "sales", "schedule"], color: "blue" },
  employee: { label: "Employee", pages: ["employees"], color: "green" },
  payslip: { label: "Pay Slip", pages: ["employees"], color: "green" },
  invoice: { label: "Invoice / Sales", pages: ["clients", "sales"], color: "amber" },
  appointment: { label: "Appointment", pages: ["schedule"], color: "purple" },
  service: { label: "Service", pages: ["clients", "sales", "schedule", "services"], color: "purple" },
  inventory: { label: "Inventory / Product", pages: ["clients", "sales", "services", "inventory"], color: "amber" },
  supplier: { label: "Supplier", pages: ["inventory", "suppliers"], color: "gray" },
  purchase_order: { label: "Purchase Order", pages: ["suppliers"], color: "amber" },
};

/**
 * Pre-built layout blocks that can be inserted into templates.
 * `html` is inserted verbatim into the editor.
 * `pages` indicates which pages supply the required data.
 */
export const LAYOUT_TEMPLATES = [
  {
    id: "invoice_items_table",
    label: "Invoice Line Items Table",
    description: "Default compact cart table with descriptive features tucked under each product row",
    pages: ["clients", "sales"],
    scopeHint: "invoice",
    html: "{{invoice.items.compact_feature_table}}",
  },
  {
    id: "invoice_items_plain_table",
    label: "Invoice Plain Table",
    description: "A standard line-items table without the compact feature badges",
    pages: ["clients", "sales"],
    scopeHint: "invoice",
    html: "{{invoice.items.table}}",
  },
  {
    id: "invoice_items_compact_feature_table",
    label: "Invoice Compact Feature Table",
    description: "A compact cart table that lists descriptive product features under each item without adding extra columns",
    pages: ["clients", "sales"],
    scopeHint: "invoice",
    html: "{{invoice.items.compact_feature_table}}",
  },
  {
    id: "invoice_items_dense_table",
    label: "Invoice Dense Print Table",
    description: "An ultra-dense print layout for longer orders that keeps rows tight and feature text inline",
    pages: ["clients", "sales"],
    scopeHint: "invoice",
    html: "{{invoice.items.dense_table}}",
  },
  {
    id: "invoice_items_feature_table",
    label: "Invoice Feature Table",
    description: "A formatted table of purchased items with descriptive feature columns",
    pages: ["clients", "sales"],
    scopeHint: "invoice",
    html: "{{invoice.items.feature_table}}",
  },
  {
    id: "invoice_summary",
    label: "Invoice Totals Summary",
    description: "Subtotal, tax, and grand total block",
    pages: ["clients", "sales"],
    scopeHint: "invoice",
    html: `<table style="width:100%;border-collapse:collapse;margin-top:1rem;font-family:inherit;">
  <tr><td style="padding:4px 8px;text-align:right;">Subtotal:</td><td style="padding:4px 8px;text-align:right;">{{invoice.subtotal}}</td></tr>
  <tr><td style="padding:4px 8px;text-align:right;">Tax:</td><td style="padding:4px 8px;text-align:right;">{{invoice.tax}}</td></tr>
  <tr style="border-top:2px solid #000;font-weight:bold;"><td style="padding:8px;text-align:right;">Total:</td><td style="padding:8px;text-align:right;">{{invoice.total}}</td></tr>
</table>`,
  },
  {
    id: "invoice_header",
    label: "Invoice Header Block",
    description: "Invoice number, date, client, and payment method in a clean header",
    pages: ["clients", "sales"],
    scopeHint: "invoice",
    html: `<table style="width:100%;border-collapse:collapse;margin-bottom:1.5rem;font-family:inherit;">
  <tr>
    <td style="padding:4px 0;font-weight:600;width:140px;">Invoice #</td>
    <td style="padding:4px 0;">{{invoice.number}}</td>
    <td style="padding:4px 0;font-weight:600;width:140px;">Date</td>
    <td style="padding:4px 0;">{{invoice.date}}</td>
  </tr>
  <tr>
    <td style="padding:4px 0;font-weight:600;">Client</td>
    <td style="padding:4px 0;">{{client.name}}</td>
    <td style="padding:4px 0;font-weight:600;">Payment</td>
    <td style="padding:4px 0;">{{invoice.payment_method}}</td>
  </tr>
</table>`,
  },
  {
    id: "company_header",
    label: "Company Header",
    description: "Company name, address, email, and phone at the top of a document",
    pages: ["clients", "employees", "sales", "schedule"],
    scopeHint: "company",
    html: `<div style="margin-bottom:1.5rem;font-family:inherit;">
  <h2 style="margin:0 0 4px;font-size:1.4rem;font-weight:700;">{{company.name}}</h2>
  <p style="margin:0;font-size:0.875rem;color:#6b7280;">{{company.address}}</p>
  <p style="margin:0;font-size:0.875rem;color:#6b7280;">{{company.email}} · {{company.phone}}</p>
</div>`,
  },
  {
    id: "service_card",
    label: "Service Card",
    description: "Service image, description, duration, and price in a reusable card",
    pages: ["services", "schedule", "clients", "sales"],
    scopeHint: "service",
    html: `<div style="display:flex;gap:1rem;align-items:flex-start;padding:1rem;border:1px solid #e5e7eb;border-radius:8px;font-family:inherit;">
  <div style="flex:0 0 120px;">{{service.image}}</div>
  <div><h3 style="margin:0 0 0.35rem;">{{service.name}}</h3><p style="margin:0 0 0.5rem;">{{service.description}}</p><div style="color:#6b7280;">{{service.duration}} · {{service.price}}</div></div>
</div>`,
  },
  {
    id: "inventory_card",
    label: "Product Card",
    description: "Inventory image, SKU, description, and price in a reusable card",
    pages: ["inventory", "services", "clients", "sales"],
    scopeHint: "inventory",
    html: `<div style="display:flex;gap:1rem;align-items:flex-start;padding:1rem;border:1px solid #e5e7eb;border-radius:8px;font-family:inherit;">
  <div style="flex:0 0 120px;">{{inventory.image}}</div>
  <div><h3 style="margin:0 0 0.35rem;">{{inventory.name}}</h3><div style="color:#6b7280;margin-bottom:0.35rem;">SKU: {{inventory.sku}}</div><p style="margin:0 0 0.5rem;">{{inventory.description}}</p><strong>{{inventory.price}}</strong></div>
</div>`,
  },
  {
    id: "client_info",
    label: "Client Info Block",
    description: "Client name, email, and phone as a compact block",
    pages: ["clients", "sales", "schedule"],
    scopeHint: "client",
    html: `<div style="margin-bottom:1rem;font-family:inherit;">
  <p style="margin:0;font-weight:600;">{{client.name}}</p>
  <p style="margin:0;font-size:0.875rem;color:#6b7280;">{{client.email}}</p>
  <p style="margin:0;font-size:0.875rem;color:#6b7280;">{{client.phone}}</p>
</div>`,
  },
  {
    id: "appointment_summary",
    label: "Appointment Summary",
    description: "Date, time, service, employee, and notes in a table",
    pages: ["schedule"],
    scopeHint: "appointment",
    html: `<table style="width:100%;border-collapse:collapse;margin-bottom:1rem;font-family:inherit;">
  <tr><td style="padding:4px 0;font-weight:600;width:140px;">Date</td><td style="padding:4px 0;">{{appointment.date}}</td></tr>
  <tr><td style="padding:4px 0;font-weight:600;">Time</td><td style="padding:4px 0;">{{appointment.time}}</td></tr>
  <tr><td style="padding:4px 0;font-weight:600;">Service</td><td style="padding:4px 0;">{{appointment.service}}</td></tr>
  <tr><td style="padding:4px 0;font-weight:600;">Duration</td><td style="padding:4px 0;">{{appointment.duration}}</td></tr>
  <tr><td style="padding:4px 0;font-weight:600;">Employee</td><td style="padding:4px 0;">{{appointment.employee_name}}</td></tr>
  <tr><td style="padding:4px 0;font-weight:600;">Notes</td><td style="padding:4px 0;">{{appointment.notes}}</td></tr>
</table>`,
  },
  {
    id: "purchase_order_items_table",
    label: "Purchase Order Line Items Table",
    description: "Selected draft purchase order items, pack quantities, unit prices, and line totals",
    pages: ["suppliers"],
    scopeHint: "purchase_order",
    html: "{{purchase_order.items.table}}",
  },
];

/**
 * Replace all {{key}} placeholders in html with values from the variables dict.
 * Unreplaced keys are left as-is.
 */
export function renderTemplate(html, variables) {
  if (!html) return "";
  return Object.entries(variables).reduce((acc, [key, val]) => acc.replaceAll(`{{${key}}}`, val != null ? String(val) : `{{${key}}}`), html);
}

/** Build a flat variable dict from a client object + current user + settings */
export function buildClientVariables(client, currentUser, settings) {
  const now = new Date();
  return {
    date: formatDateISO(now),
    time: formatTime(now),
    "company.name": settings?.company_name || "",
    "company.email": settings?.company_email || "",
    "company.phone": settings?.company_phone || "",
    "company.address": settings?.company_address || "",
    "sender.first_name": currentUser?.first_name || "",
    "sender.last_name": currentUser?.last_name || "",
    "sender.email": currentUser?.email || "",
    "client.name": client?.name || "",
    "client.email": client?.email || "",
    "client.phone": client?.phone || "",
    "client.membership_tier": client?.membership_tier || "none",
  };
}

/** Build a flat variable dict from an employee object + current user + settings */
export function buildEmployeeVariables(employee, currentUser, settings) {
  const now = new Date();
  const hireDate = employee?.hire_date ? formatDateISO(employee.hire_date) : "";
  return {
    date: formatDateISO(now),
    time: formatTime(now),
    "company.name": settings?.company_name || "",
    "company.email": settings?.company_email || "",
    "company.phone": settings?.company_phone || "",
    "company.address": settings?.company_address || "",
    "sender.first_name": currentUser?.first_name || "",
    "sender.last_name": currentUser?.last_name || "",
    "sender.email": currentUser?.email || "",
    "employee.first_name": employee?.first_name || "",
    "employee.last_name": employee?.last_name || "",
    "employee.role": employee?.role || "",
    "employee.hire_date": hireDate,
  };
}

/** Build employee, company, and payment variables for a pay slip document. */
export function buildPayslipVariables(paySlip, employee, currentUser, settings) {
  const variables = buildEmployeeVariables(employee, currentUser, settings);
  const money = (value) => `$${Number(value || 0).toFixed(2)}`;
  const paidAt = paySlip?.created_at ? new Date(paySlip.created_at).toLocaleString() : "";
  const logoUrl = String(settings?.company_logo_data_url || "").trim();
  return {
    ...variables,
    "company.logo": logoUrl ? `<img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(settings?.company_name || "Company")} logo" style="max-width:180px;max-height:80px;object-fit:contain;" />` : "",
    "payslip.number": paySlip?.id ? String(paySlip.id).slice(0, 8).toUpperCase() : "",
    "payslip.paid_at": paidAt,
    "payslip.period_start": paySlip?.pay_period_start ? new Date(paySlip.pay_period_start).toLocaleDateString() : "",
    "payslip.period_end": paySlip?.pay_period_end ? new Date(paySlip.pay_period_end).toLocaleDateString() : "",
    "payslip.gross": money(paySlip?.gross_amount),
    "payslip.insurance_deduction": money(paySlip?.insurance_deduction),
    "payslip.other_deductions": money(paySlip?.other_deductions),
    "payslip.net": money(paySlip?.net_amount),
    "payslip.service_revenue": money(paySlip?.service_revenue),
    "payslip.base_pay": money(paySlip?.base_pay_snapshot),
    "payslip.compensation_percentage": `${Number(paySlip?.compensation_percentage_snapshot || 0).toFixed(2)}%`,
  };
}

/** Format duration in minutes to a human-readable string */
function formatDuration(minutes) {
  if (!minutes) return "";
  const m = parseInt(minutes, 10);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem > 0 ? `${h} hour ${rem} min` : `${h} hour${h !== 1 ? "s" : ""}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatMoney(value) {
  return value == null || value === "" ? "" : `$${Number(value).toFixed(2)}`;
}

function buildImageHtml(url, alt) {
  const safeUrl = String(url || "").trim();
  if (!safeUrl) return "";
  return `<img src="${escapeHtml(safeUrl)}" alt="${escapeHtml(alt || "Image")}" style="max-width:120px;max-height:120px;object-fit:contain;" />`;
}

function getPrimaryInventoryImage(inventory) {
  const images = Array.isArray(inventory?.images) ? inventory.images : [];
  const primary = images.find((image) => image?.is_primary) || images[0];
  return primary?.image_url || primary?.file_path || inventory?.image_url || "";
}

/** Build company, sender, and mapped communication fields for a service. */
export function buildServiceVariables(service, currentUser, settings) {
  const now = new Date();
  return {
    date: formatDateISO(now),
    time: formatTime(now),
    "company.name": settings?.company_name || "",
    "company.email": settings?.company_email || "",
    "company.phone": settings?.company_phone || "",
    "company.address": settings?.company_address || "",
    "sender.first_name": currentUser?.first_name || "",
    "sender.last_name": currentUser?.last_name || "",
    "sender.email": currentUser?.email || "",
    "service.name": service?.name || "",
    "service.description": service?.description || "",
    "service.category": service?.category || "",
    "service.price": formatMoney(service?.price),
    "service.duration": formatDuration(service?.duration_minutes),
    "service.image": buildImageHtml(service?.image_url, service?.name || "Service"),
  };
}

/** Build company, sender, and mapped communication fields for an inventory item. */
export function buildInventoryVariables(inventory, currentUser, settings) {
  const now = new Date();
  return {
    date: formatDateISO(now),
    time: formatTime(now),
    "company.name": settings?.company_name || "",
    "company.email": settings?.company_email || "",
    "company.phone": settings?.company_phone || "",
    "company.address": settings?.company_address || "",
    "sender.first_name": currentUser?.first_name || "",
    "sender.last_name": currentUser?.last_name || "",
    "sender.email": currentUser?.email || "",
    "inventory.sku": inventory?.sku || "",
    "inventory.name": inventory?.name || "",
    "inventory.description": inventory?.description || "",
    "inventory.category": inventory?.category || "",
    "inventory.price": formatMoney(inventory?.price),
    "inventory.image": buildImageHtml(getPrimaryInventoryImage(inventory), inventory?.name || "Inventory item"),
    "supplier.name": inventory?.supplier?.name || "",
    "supplier.contact_person": inventory?.supplier?.contact_person || "",
    "supplier.email": inventory?.supplier?.email || "",
    "supplier.phone": inventory?.supplier?.phone || "",
    "supplier.address": inventory?.supplier?.address || "",
  };
}

/** Build supplier-facing fields and item rows from a selected draft purchase order. */
export function buildPurchaseOrderVariables(purchaseOrder, supplier, currentUser, settings, inventoryItems = []) {
  const now = new Date();
  const inventoryById = new Map(inventoryItems.map((item) => [String(item.id), item]));
  const lines = Array.isArray(purchaseOrder?.line_items) ? purchaseOrder.line_items : [];
  const rows = lines.map((line) => {
    const item = inventoryById.get(String(line.inventory_id));
    const quantity = Number(line.quantity_ordered) || 0;
    const unitPrice = Number(line.unit_price) || 0;
    const lineTotal = Number(line.line_total) || quantity * unitPrice;
    const itemName = item?.name || "Inventory item";
    const pack = Number(line.units_per_purchase_unit) || 1;
    const purchaseUnit = line.purchase_unit || "unit";
    return {
      itemName,
      quantity,
      purchaseUnit,
      pack,
      unitPrice,
      lineTotal,
      text: `${itemName} — ${quantity} ${purchaseUnit}${quantity === 1 ? "" : "s"} at ${formatMoney(unitPrice)} each; ${lineTotal.toFixed(2)}`,
      html: `<tr><td style="padding:6px;border:1px solid #d1d5db;">${escapeHtml(itemName)}</td><td style="padding:6px;border:1px solid #d1d5db;text-align:right;">${quantity} ${escapeHtml(purchaseUnit)}${pack > 1 ? ` (${pack} per unit)` : ""}</td><td style="padding:6px;border:1px solid #d1d5db;text-align:right;">${formatMoney(unitPrice)}</td><td style="padding:6px;border:1px solid #d1d5db;text-align:right;">${formatMoney(lineTotal)}</td></tr>`,
    };
  });
  const table = `<table style="width:100%;border-collapse:collapse;"><thead><tr><th style="padding:6px;border:1px solid #d1d5db;text-align:left;">Item</th><th style="padding:6px;border:1px solid #d1d5db;text-align:right;">Quantity</th><th style="padding:6px;border:1px solid #d1d5db;text-align:right;">Unit Price</th><th style="padding:6px;border:1px solid #d1d5db;text-align:right;">Total</th></tr></thead><tbody>${rows.map((row) => row.html).join("")}</tbody></table>`;

  return {
    date: formatDateISO(now),
    time: formatTime(now),
    "company.name": settings?.company_name || "",
    "company.email": settings?.company_email || "",
    "company.phone": settings?.company_phone || "",
    "company.address": settings?.company_address || "",
    "sender.first_name": currentUser?.first_name || "",
    "sender.last_name": currentUser?.last_name || "",
    "sender.email": currentUser?.email || "",
    "supplier.name": supplier?.name || "",
    "supplier.contact_person": supplier?.contact_person || "",
    "supplier.email": supplier?.email || "",
    "supplier.phone": supplier?.phone || "",
    "supplier.address": supplier?.address || "",
    "purchase_order.number": purchaseOrder?.po_number || "",
    "purchase_order.date": purchaseOrder?.order_date ? formatDateISO(purchaseOrder.order_date) : "",
    "purchase_order.expected_delivery": purchaseOrder?.expected_delivery_date ? formatDateISO(purchaseOrder.expected_delivery_date) : "",
    "purchase_order.status": purchaseOrder?.status || "",
    "purchase_order.total": formatMoney(purchaseOrder?.total_amount),
    "purchase_order.items": rows.map((row) => row.text).join("\n"),
    "purchase_order.items.table": table,
  };
}

function getNormalizedSelectedOptions(item) {
  const rawOptions = item?.selectedOptions ?? item?.options_json ?? null;
  if (!Array.isArray(rawOptions)) return [];

  return rawOptions
    .map((option) => ({
      featureName: option?.featureName ?? option?.feature_name ?? "",
      optionName: option?.optionName ?? option?.option_name ?? "",
    }))
    .filter((option) => option.featureName || option.optionName);
}

function buildCompactFeatureSummaryHtml(item) {
  const options = getNormalizedSelectedOptions(item);
  if (!options.length) return "";

  const optionBadges = options
    .map((option) => {
      const label = option.featureName && option.optionName ? `${option.featureName}: ${option.optionName}` : option.optionName || option.featureName;
      return `<span style="display:inline-block;margin:2px 6px 2px 0;padding:2px 8px;border-radius:999px;background:#eef2ff;color:#4338ca;font-size:0.72rem;line-height:1.2;white-space:normal;">${escapeHtml(label)}</span>`;
    })
    .join("");

  return `<div style="margin-top:4px;line-height:1.3;">${optionBadges}</div>`;
}

/** Build a styled HTML table for invoice line items with feature columns */
function buildItemsFeatureTableHtml(items) {
  if (!items.length) return '<p style="color:#6b7280;font-size:0.875rem;">No items</p>';

  const featureNames = [];
  items.forEach((item) => {
    const opts = getNormalizedSelectedOptions(item);
    opts.forEach((opt) => {
      const featureName = opt.featureName ?? opt.feature_name;
      if (featureName && !featureNames.includes(featureName)) {
        featureNames.push(featureName);
      }
    });
  });

  if (!featureNames.length) {
    return buildItemsTableHtml(items);
  }

  const headerCells = [
    '<th style="padding:6px 8px;text-align:left;font-weight:600;">Item</th>',
    ...featureNames.map((name) => `<th style="padding:6px 8px;text-align:left;font-weight:600;">${name}</th>`),
    '<th style="padding:6px 8px;text-align:center;font-weight:600;">Qty</th>',
    '<th style="padding:6px 8px;text-align:right;font-weight:600;">Unit Price</th>',
    '<th style="padding:6px 8px;text-align:right;font-weight:600;">Total</th>',
  ].join("");

  const rows = items
    .map((item) => {
      const optionMap = Object.create(null);
      const opts = getNormalizedSelectedOptions(item);
      opts.forEach((opt) => {
        const featureName = opt.featureName ?? opt.feature_name;
        const optionName = opt.optionName ?? opt.option_name;
        if (featureName) optionMap[featureName] = optionName || "";
      });
      const qty = item.quantity ?? "";
      const unit = item.unit_price != null ? `$${Number(item.unit_price).toFixed(2)}` : "";
      const total = item.line_total != null ? `$${Number(item.line_total).toFixed(2)}` : "";
      const featureCells = featureNames.map((name) => `<td style="padding:6px 8px;">${optionMap[name] || "—"}</td>`).join("");
      return `<tr style="border-bottom:1px solid #e5e7eb;">
    <td style="padding:6px 8px;">${item.item_name || ""}</td>
    ${featureCells}
    <td style="padding:6px 8px;text-align:center;">${qty}</td>
    <td style="padding:6px 8px;text-align:right;white-space:nowrap;">${unit}</td>
    <td style="padding:6px 8px;text-align:right;white-space:nowrap;font-weight:500;">${total}</td>
  </tr>`;
    })
    .join("");

  return `<table style="width:100%;border-collapse:collapse;table-layout:auto;font-family:inherit;font-size:0.9rem;">
    <thead>
      <tr style="border-bottom:2px solid #d1d5db;background:#f9fafb;">
        ${headerCells}
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function buildItemsCompactFeatureTableHtml(items) {
  if (!items.length) return '<p style="color:#6b7280;font-size:0.875rem;">No items</p>';
  const rows = items
    .map((item) => {
      const qty = item.quantity ?? "";
      const unit = item.unit_price != null ? `$${Number(item.unit_price).toFixed(2)}` : "";
      const total = item.line_total != null ? `$${Number(item.line_total).toFixed(2)}` : "";
      const featureSummary = buildCompactFeatureSummaryHtml(item);
      return `<tr style="border-bottom:1px solid #e5e7eb;page-break-inside:avoid;break-inside:avoid;">
  <td style="padding:7px 8px;">
    <div style="font-weight:500;line-height:1.35;">${escapeHtml(item.item_name || "")}</div>
    ${featureSummary}
  </td>
  <td style="padding:7px 8px;text-align:center;width:50px;vertical-align:top;">${qty}</td>
  <td style="padding:7px 8px;text-align:right;width:90px;white-space:nowrap;vertical-align:top;">${unit}</td>
  <td style="padding:7px 8px;text-align:right;width:90px;white-space:nowrap;font-weight:500;vertical-align:top;">${total}</td>
</tr>`;
    })
    .join("");
  return `<table style="width:100%;border-collapse:collapse;table-layout:fixed;font-family:inherit;font-size:0.9rem;">
  <colgroup>
    <col/>
    <col style="width:50px;"/>
    <col style="width:90px;"/>
    <col style="width:90px;"/>
  </colgroup>
  <thead>
    <tr style="border-bottom:2px solid #d1d5db;background:#f9fafb;">
      <th style="padding:6px 8px;text-align:left;font-weight:600;">Item</th>
      <th style="padding:6px 8px;text-align:center;font-weight:600;">Qty</th>
      <th style="padding:6px 8px;text-align:right;font-weight:600;">Unit Price</th>
      <th style="padding:6px 8px;text-align:right;font-weight:600;">Total</th>
    </tr>
  </thead>
  <tbody>${rows}</tbody>
</table>`;
}

function buildItemsDenseTableHtml(items) {
  if (!items.length) return '<p style="color:#6b7280;font-size:0.8rem;">No items</p>';
  const rows = items
    .map((item) => {
      const qty = item.quantity ?? "";
      const unit = item.unit_price != null ? `$${Number(item.unit_price).toFixed(2)}` : "";
      const total = item.line_total != null ? `$${Number(item.line_total).toFixed(2)}` : "";
      const options = getNormalizedSelectedOptions(item);
      const featureLine = options.length
        ? `<div style="margin-top:2px;color:#475569;font-size:0.68rem;line-height:1.2;">${escapeHtml(
            options
              .map((option) => {
                const label = option.featureName && option.optionName ? `${option.featureName}: ${option.optionName}` : option.optionName || option.featureName;
                return label;
              })
              .join(" | ")
          )}</div>`
        : "";

      return `<tr style="border-bottom:1px solid #e2e8f0;page-break-inside:avoid;break-inside:avoid;">
  <td style="padding:4px 6px;vertical-align:top;line-height:1.2;">
    <div style="font-weight:500;">${escapeHtml(item.item_name || "")}</div>
    ${featureLine}
  </td>
  <td style="padding:4px 6px;text-align:center;width:42px;vertical-align:top;">${qty}</td>
  <td style="padding:4px 6px;text-align:right;width:78px;white-space:nowrap;vertical-align:top;">${unit}</td>
  <td style="padding:4px 6px;text-align:right;width:78px;white-space:nowrap;font-weight:600;vertical-align:top;">${total}</td>
</tr>`;
    })
    .join("");

  return `<table style="width:100%;border-collapse:collapse;table-layout:fixed;font-family:inherit;font-size:0.78rem;line-height:1.2;">
  <colgroup>
    <col/>
    <col style="width:42px;"/>
    <col style="width:78px;"/>
    <col style="width:78px;"/>
  </colgroup>
  <thead>
    <tr style="border-bottom:2px solid #cbd5e1;background:#f8fafc;">
      <th style="padding:4px 6px;text-align:left;font-weight:700;">Item</th>
      <th style="padding:4px 6px;text-align:center;font-weight:700;">Qty</th>
      <th style="padding:4px 6px;text-align:right;font-weight:700;">Unit</th>
      <th style="padding:4px 6px;text-align:right;font-weight:700;">Total</th>
    </tr>
  </thead>
  <tbody>${rows}</tbody>
</table>`;
}

/** Build a styled HTML table for invoice line items */
function buildItemsTableHtml(items) {
  if (!items.length) return '<p style="color:#6b7280;font-size:0.875rem;">No items</p>';
  const rows = items
    .map((i) => {
      const qty = i.quantity ?? "";
      const unit = i.unit_price != null ? `$${Number(i.unit_price).toFixed(2)}` : "";
      const total = i.line_total != null ? `$${Number(i.line_total).toFixed(2)}` : "";
      const optionsLine = buildCompactFeatureSummaryHtml(i);
      return `<tr style="border-bottom:1px solid #e5e7eb;">
  <td style="padding:6px 8px;">${i.item_name || ""}${optionsLine}</td>
  <td style="padding:6px 8px;text-align:center;width:50px;">${qty}</td>
  <td style="padding:6px 8px;text-align:right;width:90px;white-space:nowrap;">${unit}</td>
  <td style="padding:6px 8px;text-align:right;width:90px;white-space:nowrap;font-weight:500;">${total}</td>
</tr>`;
    })
    .join("");
  return `<table style="width:100%;border-collapse:collapse;table-layout:fixed;font-family:inherit;font-size:0.9rem;">
  <colgroup>
    <col/>
    <col style="width:50px;"/>
    <col style="width:90px;"/>
    <col style="width:90px;"/>
  </colgroup>
  <thead>
    <tr style="border-bottom:2px solid #d1d5db;background:#f9fafb;">
      <th style="padding:6px 8px;text-align:left;font-weight:600;">Item</th>
      <th style="padding:6px 8px;text-align:center;font-weight:600;">Qty</th>
      <th style="padding:6px 8px;text-align:right;font-weight:600;">Unit Price</th>
      <th style="padding:6px 8px;text-align:right;font-weight:600;">Total</th>
    </tr>
  </thead>
  <tbody>${rows}</tbody>
</table>`;
}

/** Build a flat variable dict from a sale transaction + client + current user + settings */
export function buildSalesVariables(transaction, client, currentUser, settings, items = []) {
  const now = new Date();
  const txDate = transaction?.created_at ? formatDateISO(transaction.created_at) : formatDateISO(now);
  const itemsTableHtml = buildItemsTableHtml(items);
  const itemsCompactFeatureTableHtml = buildItemsCompactFeatureTableHtml(items);
  const itemsDenseTableHtml = buildItemsDenseTableHtml(items);
  const itemsFeatureTableHtml = buildItemsFeatureTableHtml(items);
  const itemsHtml = itemsTableHtml;
  return {
    date: formatDateISO(now),
    time: formatTime(now),
    "company.name": settings?.company_name || "",
    "company.email": settings?.company_email || "",
    "company.phone": settings?.company_phone || "",
    "company.address": settings?.company_address || "",
    "sender.first_name": currentUser?.first_name || "",
    "sender.last_name": currentUser?.last_name || "",
    "sender.email": currentUser?.email || "",
    "client.name": client?.name || "",
    "client.email": client?.email || "",
    "client.phone": client?.phone || "",
    "client.membership_tier": client?.membership_tier || "none",
    "invoice.number": transaction?.id ? String(transaction.id).slice(0, 8).toUpperCase() : "",
    "invoice.date": txDate,
    "invoice.total": transaction?.total != null ? `$${Number(transaction.total).toFixed(2)}` : "",
    "invoice.subtotal": transaction?.subtotal != null ? `$${Number(transaction.subtotal).toFixed(2)}` : "",
    "invoice.tax": transaction?.tax_amount != null ? `$${Number(transaction.tax_amount).toFixed(2)}` : "",
    "invoice.items": itemsHtml,
    "invoice.items.table": itemsTableHtml,
    "invoice.items.compact_feature_table": itemsCompactFeatureTableHtml,
    "invoice.items.dense_table": itemsDenseTableHtml,
    "invoice.items.feature_table": itemsFeatureTableHtml,
    "invoice.payment_method": transaction?.payment_method || "",
  };
}

/** Build a flat variable dict from a schedule appointment + related objects */
export function buildScheduleVariables(appointment, client, employee, service, currentUser, settings) {
  const now = new Date();
  let apptDate = "";
  let apptTime = "";
  let apptDay = "";
  if (appointment?.appointment_date) {
    const d = new Date(appointment.appointment_date);
    if (!Number.isNaN(d.getTime())) {
      apptDate = d.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
      apptTime = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
      apptDay = d.toLocaleDateString("en-US", { weekday: "long" });
    }
  }
  const employeeName = employee ? `${employee.first_name || ""} ${employee.last_name || ""}`.trim() : "";
  return {
    date: formatDateISO(now),
    time: formatTime(now),
    "company.name": settings?.company_name || "",
    "company.email": settings?.company_email || "",
    "company.phone": settings?.company_phone || "",
    "company.address": settings?.company_address || "",
    "sender.first_name": currentUser?.first_name || "",
    "sender.last_name": currentUser?.last_name || "",
    "sender.email": currentUser?.email || "",
    "client.name": client?.name || "",
    "client.email": client?.email || "",
    "client.phone": client?.phone || "",
    "client.membership_tier": client?.membership_tier || "none",
    "service.name": service?.name || "",
    "service.description": service?.description || "",
    "service.category": service?.category || "",
    "service.price": formatMoney(service?.price),
    "service.duration": formatDuration(service?.duration_minutes),
    "service.image": buildImageHtml(service?.image_url, service?.name || "Service"),
    "appointment.date": apptDate,
    "appointment.time": apptTime,
    "appointment.day": apptDay,
    "appointment.service": service?.name || "",
    "appointment.duration": formatDuration(appointment?.duration_minutes),
    "appointment.notes": appointment?.notes || "",
    "appointment.employee_name": employeeName,
  };
}
