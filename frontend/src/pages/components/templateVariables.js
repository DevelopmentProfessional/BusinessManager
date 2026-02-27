/**
 * Template variable definitions for the document template system.
 * Variables use Mustache-style {{scope.field}} placeholders.
 */

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
    { key: 'invoice.items', label: 'Line Items', description: 'List of purchased items' },
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
    date: now.toLocaleDateString('en-CA'), // YYYY-MM-DD
    time: now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
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
  const hireDate = employee?.hire_date
    ? new Date(employee.hire_date).toLocaleDateString('en-CA')
    : '';
  return {
    date: now.toLocaleDateString('en-CA'),
    time: now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
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

/** Build a flat variable dict from a sale transaction + client + current user + settings */
export function buildSalesVariables(transaction, client, currentUser, settings, items = []) {
  const now = new Date();
  const txDate = transaction?.created_at
    ? new Date(transaction.created_at).toLocaleDateString('en-CA')
    : now.toLocaleDateString('en-CA');
  const itemsHtml = items.length
    ? '<ul>' + items.map(i => `<li>${i.item_name} × ${i.quantity} — $${Number(i.line_total).toFixed(2)}</li>`).join('') + '</ul>'
    : '';
  return {
    date: now.toLocaleDateString('en-CA'),
    time: now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
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
    date: now.toLocaleDateString('en-CA'),
    time: now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
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
