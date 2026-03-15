/**
 * Template variable definitions for the document template system.
 * Variables use Mustache-style {{scope.field}} placeholders.
 */
import { formatDateISO, formatTime } from '../../utils/dateFormatters';

export const TEMPLATE_VARIABLES = {
  system: [
    { key: 'date', label: 'Today\'s Date', description: 'Current date (YYYY-MM-DD)' },
    { key: 'time', label: 'Current Time', description: 'Current time (HH:MM)' },
  ],
  company: [
    { key: 'company.name', label: 'Company Name', description: 'Business name from settings' },
    { key: 'company.email', label: 'Company Email', description: 'Business email from settings' },
    { key: 'company.phone', label: 'Company Phone', description: 'Business phone from settings' },
    { key: 'company.address', label: 'Company Address', description: 'Business address from settings' },
  ],
  sender: [
    { key: 'sender.first_name', label: 'Sender First Name', description: 'Logged-in user first name' },
    { key: 'sender.last_name', label: 'Sender Last Name', description: 'Logged-in user last name' },
    { key: 'sender.email', label: 'Sender Email', description: 'Logged-in user email' },
  ],
  client: [
    { key: 'client.name', label: 'Client Name', description: 'Full name of the client' },
    { key: 'client.email', label: 'Client Email', description: 'Client email address' },
    { key: 'client.phone', label: 'Client Phone', description: 'Client phone number' },
    { key: 'client.membership_tier', label: 'Membership Tier', description: 'Client membership level' },
  ],
  employee: [
    { key: 'employee.first_name', label: 'Employee First Name', description: 'Employee first name' },
    { key: 'employee.last_name', label: 'Employee Last Name', description: 'Employee last name' },
    { key: 'employee.role', label: 'Employee Role', description: 'Employee job role' },
    { key: 'employee.hire_date', label: 'Hire Date', description: 'Employee hire date' },
  ],
  invoice: [
    { key: 'invoice.number', label: 'Invoice Number', description: 'Transaction ID' },
    { key: 'invoice.date', label: 'Invoice Date', description: 'Transaction date' },
    { key: 'invoice.total', label: 'Total', description: 'Total amount' },
    { key: 'invoice.subtotal', label: 'Subtotal', description: 'Subtotal before tax' },
    { key: 'invoice.tax', label: 'Tax', description: 'Tax amount' },
    { key: 'invoice.items', label: 'Line Items (list)', description: 'Purchased items as a bullet list' },
    { key: 'invoice.items.table', label: 'Line Items (table)', description: 'Purchased items as a formatted table', isLayout: true },
    { key: 'invoice.payment_method', label: 'Payment Method', description: 'Cash or card' },
  ],
  appointment: [
    { key: 'appointment.date', label: 'Appointment Date', description: 'Formatted date (e.g. Monday, March 15, 2026)' },
    { key: 'appointment.time', label: 'Appointment Time', description: 'Time (e.g. 10:30 AM)' },
    { key: 'appointment.day', label: 'Day of Week', description: 'Day name (e.g. Monday)' },
    { key: 'appointment.service', label: 'Service Name', description: 'Name of the booked service' },
    { key: 'appointment.duration', label: 'Duration', description: 'Appointment duration (e.g. 1 hour 30 min)' },
    { key: 'appointment.notes', label: 'Notes', description: 'Appointment notes' },
    { key: 'appointment.employee_name', label: 'Employee Name', description: 'Full name of the assigned employee' },
  ],
};

/** Which variable scopes are available per page context */
export const PAGE_VARIABLE_SCOPES = {
  clients: ['system', 'company', 'sender', 'client'],
  employees: ['system', 'company', 'sender', 'employee'],
  sales: ['system', 'company', 'sender', 'client', 'invoice'],
  schedule: ['system', 'company', 'sender', 'client', 'appointment'],
};

/**
 * Metadata about each scope — which pages it is populated on,
 * so the editor can surface this to the user.
 */
export const SCOPE_PAGE_CONTEXT = {
  system:      { label: 'System',      pages: ['clients', 'employees', 'sales', 'schedule'], color: 'gray' },
  company:     { label: 'Company',     pages: ['clients', 'employees', 'sales', 'schedule'], color: 'gray' },
  sender:      { label: 'Sender',      pages: ['clients', 'employees', 'sales', 'schedule'], color: 'gray' },
  client:      { label: 'Client',      pages: ['clients', 'sales', 'schedule'], color: 'blue' },
  employee:    { label: 'Employee',    pages: ['employees'], color: 'green' },
  invoice:     { label: 'Invoice / Sales', pages: ['sales'], color: 'amber' },
  appointment: { label: 'Appointment', pages: ['schedule'], color: 'purple' },
};

/**
 * Pre-built layout blocks that can be inserted into templates.
 * `html` is inserted verbatim into the editor.
 * `pages` indicates which pages supply the required data.
 */
export const LAYOUT_TEMPLATES = [
  {
    id: 'invoice_items_table',
    label: 'Invoice Line Items Table',
    description: 'A formatted table of purchased items (Item, Qty, Unit Price, Total)',
    pages: ['sales'],
    scopeHint: 'invoice',
    html: '{{invoice.items.table}}',
  },
  {
    id: 'invoice_summary',
    label: 'Invoice Totals Summary',
    description: 'Subtotal, tax, and grand total block',
    pages: ['sales'],
    scopeHint: 'invoice',
    html: `<table style="width:100%;border-collapse:collapse;margin-top:1rem;font-family:inherit;">
  <tr><td style="padding:4px 8px;text-align:right;">Subtotal:</td><td style="padding:4px 8px;text-align:right;">{{invoice.subtotal}}</td></tr>
  <tr><td style="padding:4px 8px;text-align:right;">Tax:</td><td style="padding:4px 8px;text-align:right;">{{invoice.tax}}</td></tr>
  <tr style="border-top:2px solid #000;font-weight:bold;"><td style="padding:8px;text-align:right;">Total:</td><td style="padding:8px;text-align:right;">{{invoice.total}}</td></tr>
</table>`,
  },
  {
    id: 'invoice_header',
    label: 'Invoice Header Block',
    description: 'Invoice number, date, client, and payment method in a clean header',
    pages: ['sales'],
    scopeHint: 'invoice',
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
    id: 'company_header',
    label: 'Company Header',
    description: 'Company name, address, email, and phone at the top of a document',
    pages: ['clients', 'employees', 'sales', 'schedule'],
    scopeHint: 'company',
    html: `<div style="margin-bottom:1.5rem;font-family:inherit;">
  <h2 style="margin:0 0 4px;font-size:1.4rem;font-weight:700;">{{company.name}}</h2>
  <p style="margin:0;font-size:0.875rem;color:#6b7280;">{{company.address}}</p>
  <p style="margin:0;font-size:0.875rem;color:#6b7280;">{{company.email}} · {{company.phone}}</p>
</div>`,
  },
  {
    id: 'client_info',
    label: 'Client Info Block',
    description: 'Client name, email, and phone as a compact block',
    pages: ['clients', 'sales', 'schedule'],
    scopeHint: 'client',
    html: `<div style="margin-bottom:1rem;font-family:inherit;">
  <p style="margin:0;font-weight:600;">{{client.name}}</p>
  <p style="margin:0;font-size:0.875rem;color:#6b7280;">{{client.email}}</p>
  <p style="margin:0;font-size:0.875rem;color:#6b7280;">{{client.phone}}</p>
</div>`,
  },
  {
    id: 'appointment_summary',
    label: 'Appointment Summary',
    description: 'Date, time, service, employee, and notes in a table',
    pages: ['schedule'],
    scopeHint: 'appointment',
    html: `<table style="width:100%;border-collapse:collapse;margin-bottom:1rem;font-family:inherit;">
  <tr><td style="padding:4px 0;font-weight:600;width:140px;">Date</td><td style="padding:4px 0;">{{appointment.date}}</td></tr>
  <tr><td style="padding:4px 0;font-weight:600;">Time</td><td style="padding:4px 0;">{{appointment.time}}</td></tr>
  <tr><td style="padding:4px 0;font-weight:600;">Service</td><td style="padding:4px 0;">{{appointment.service}}</td></tr>
  <tr><td style="padding:4px 0;font-weight:600;">Duration</td><td style="padding:4px 0;">{{appointment.duration}}</td></tr>
  <tr><td style="padding:4px 0;font-weight:600;">Employee</td><td style="padding:4px 0;">{{appointment.employee_name}}</td></tr>
  <tr><td style="padding:4px 0;font-weight:600;">Notes</td><td style="padding:4px 0;">{{appointment.notes}}</td></tr>
</table>`,
  },
];

/**
 * Replace all {{key}} placeholders in html with values from the variables dict.
 * Unreplaced keys are left as-is.
 */
export function renderTemplate(html, variables) {
  if (!html) return '';
  return Object.entries(variables).reduce(
    (acc, [key, val]) => acc.replaceAll(`{{${key}}}`, val != null ? String(val) : `{{${key}}}`),
    html
  );
}

/** Build a flat variable dict from a client object + current user + settings */
export function buildClientVariables(client, currentUser, settings) {
  const now = new Date();
  return {
    date: formatDateISO(now),
    time: formatTime(now),
    'company.name': settings?.company_name || '',
    'company.email': settings?.company_email || '',
    'company.phone': settings?.company_phone || '',
    'company.address': settings?.company_address || '',
    'sender.first_name': currentUser?.first_name || '',
    'sender.last_name': currentUser?.last_name || '',
    'sender.email': currentUser?.email || '',
    'client.name': client?.name || '',
    'client.email': client?.email || '',
    'client.phone': client?.phone || '',
    'client.membership_tier': client?.membership_tier || 'none',
  };
}

/** Build a flat variable dict from an employee object + current user + settings */
export function buildEmployeeVariables(employee, currentUser, settings) {
  const now = new Date();
  const hireDate = employee?.hire_date ? formatDateISO(employee.hire_date) : '';
  return {
    date: formatDateISO(now),
    time: formatTime(now),
    'company.name': settings?.company_name || '',
    'company.email': settings?.company_email || '',
    'company.phone': settings?.company_phone || '',
    'company.address': settings?.company_address || '',
    'sender.first_name': currentUser?.first_name || '',
    'sender.last_name': currentUser?.last_name || '',
    'sender.email': currentUser?.email || '',
    'employee.first_name': employee?.first_name || '',
    'employee.last_name': employee?.last_name || '',
    'employee.role': employee?.role || '',
    'employee.hire_date': hireDate,
  };
}

/** Format duration in minutes to a human-readable string */
function formatDuration(minutes) {
  if (!minutes) return '';
  const m = parseInt(minutes, 10);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem > 0 ? `${h} hour ${rem} min` : `${h} hour${h !== 1 ? 's' : ''}`;
}

/** Build a styled HTML table for invoice line items */
function buildItemsTableHtml(items) {
  if (!items.length) return '<p style="color:#6b7280;font-size:0.875rem;">No items</p>';
  const rows = items.map((i) => {
    const qty = i.quantity ?? '';
    const unit = i.unit_price != null ? `$${Number(i.unit_price).toFixed(2)}` : '';
    const total = i.line_total != null ? `$${Number(i.line_total).toFixed(2)}` : '';
    return `<tr style="border-bottom:1px solid #e5e7eb;">
  <td style="padding:6px 8px;">${i.item_name || ''}</td>
  <td style="padding:6px 8px;text-align:center;">${qty}</td>
  <td style="padding:6px 8px;text-align:right;">${unit}</td>
  <td style="padding:6px 8px;text-align:right;font-weight:500;">${total}</td>
</tr>`;
  }).join('');
  return `<table style="width:100%;border-collapse:collapse;font-family:inherit;font-size:0.9rem;">
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

function buildInvoiceTotalsHtml(transaction) {
  const subtotal = transaction?.subtotal != null ? `$${Number(transaction.subtotal).toFixed(2)}` : '$0.00';
  const tax = transaction?.tax_amount != null ? `$${Number(transaction.tax_amount).toFixed(2)}` : '$0.00';
  const total = transaction?.total != null ? `$${Number(transaction.total).toFixed(2)}` : '$0.00';
  return `<table style="width:100%;border-collapse:collapse;margin-top:0.75rem;font-family:inherit;font-size:0.9rem;">
  <tbody>
    <tr>
      <td style="padding:4px 8px;text-align:right;color:#374151;">Subtotal</td>
      <td style="padding:4px 8px;text-align:right;white-space:nowrap;">${subtotal}</td>
    </tr>
    <tr>
      <td style="padding:4px 8px;text-align:right;color:#374151;">Tax</td>
      <td style="padding:4px 8px;text-align:right;white-space:nowrap;">${tax}</td>
    </tr>
    <tr style="border-top:2px solid #111827;">
      <td style="padding:6px 8px;text-align:right;font-weight:700;">Total</td>
      <td style="padding:6px 8px;text-align:right;font-weight:700;white-space:nowrap;">${total}</td>
    </tr>
  </tbody>
</table>`;
}

/** Build a flat variable dict from a sale transaction + client + current user + settings */
export function buildSalesVariables(transaction, client, currentUser, settings, items = []) {
  const now = new Date();
  const txDate = transaction?.created_at ? formatDateISO(transaction.created_at) : formatDateISO(now);
  const itemsTableHtml = buildItemsTableHtml(items);
  const itemsHtml = `${itemsTableHtml}${buildInvoiceTotalsHtml(transaction)}`;
  return {
    date: formatDateISO(now),
    time: formatTime(now),
    'company.name': settings?.company_name || '',
    'company.email': settings?.company_email || '',
    'company.phone': settings?.company_phone || '',
    'company.address': settings?.company_address || '',
    'sender.first_name': currentUser?.first_name || '',
    'sender.last_name': currentUser?.last_name || '',
    'sender.email': currentUser?.email || '',
    'client.name': client?.name || '',
    'client.email': client?.email || '',
    'client.phone': client?.phone || '',
    'client.membership_tier': client?.membership_tier || 'none',
    'invoice.number': transaction?.id ? String(transaction.id).slice(0, 8).toUpperCase() : '',
    'invoice.date': txDate,
    'invoice.total': transaction?.total != null ? `$${Number(transaction.total).toFixed(2)}` : '',
    'invoice.subtotal': transaction?.subtotal != null ? `$${Number(transaction.subtotal).toFixed(2)}` : '',
    'invoice.tax': transaction?.tax_amount != null ? `$${Number(transaction.tax_amount).toFixed(2)}` : '',
    'invoice.items': itemsHtml,
    'invoice.items.table': itemsTableHtml,
    'invoice.payment_method': transaction?.payment_method || '',
  };
}

/** Build a flat variable dict from a schedule appointment + related objects */
export function buildScheduleVariables(appointment, client, employee, service, currentUser, settings) {
  const now = new Date();
  let apptDate = '';
  let apptTime = '';
  let apptDay = '';
  if (appointment?.appointment_date) {
    const d = new Date(appointment.appointment_date);
    if (!Number.isNaN(d.getTime())) {
      apptDate = d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      apptTime = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
      apptDay = d.toLocaleDateString('en-US', { weekday: 'long' });
    }
  }
  const employeeName = employee
    ? `${employee.first_name || ''} ${employee.last_name || ''}`.trim()
    : '';
  return {
    date: formatDateISO(now),
    time: formatTime(now),
    'company.name': settings?.company_name || '',
    'company.email': settings?.company_email || '',
    'company.phone': settings?.company_phone || '',
    'company.address': settings?.company_address || '',
    'sender.first_name': currentUser?.first_name || '',
    'sender.last_name': currentUser?.last_name || '',
    'sender.email': currentUser?.email || '',
    'client.name': client?.name || '',
    'client.email': client?.email || '',
    'client.phone': client?.phone || '',
    'client.membership_tier': client?.membership_tier || 'none',
    'appointment.date': apptDate,
    'appointment.time': apptTime,
    'appointment.day': apptDay,
    'appointment.service': service?.name || '',
    'appointment.duration': formatDuration(appointment?.duration_minutes),
    'appointment.notes': appointment?.notes || '',
    'appointment.employee_name': employeeName,
  };
}
