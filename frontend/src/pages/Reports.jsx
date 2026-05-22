/*
 * ============================================================
 * FILE: Reports.jsx
 *
 * PURPOSE:
 *   Analytics and reporting page that lets users select a report type, configure
 *   date-range and grouping filters, and view the results as an interactive chart.
 *   Permission-gated: only reports whose underlying tables the user can read are
 *   shown. Supports PDF export via the browser print dialog.
 *
 * FUNCTIONAL PARTS:
 *   [1] Imports & module-level constants — heroicons, API services, report/filter config arrays
 *   [2] Component setup & permission guard — useStore hooks, early redirect if no permissions
 *   [3] State declarations — selected report, report data, filter state, employee/service lists
 *   [4] Derived state — accessibleReports (permission-filtered), selectedReport memo
 *   [5] Report selection handler — handleReportSelect resets filters to report defaults
 *   [6] Data loading / API fetch — loadReportData dispatches to the correct report endpoint
 *   [7] Date range helpers — getStartDate / getEndDate compute ISO date strings
 *   [8] Data transform functions — one transform per report type maps API response to Chart.js shape
 *   [9] useEffect / lifecycle hooks — default report selection, load employees/services, reload on filter change
 *   [10] PDF export handler — handleExportPdf opens a print window with the chart snapshot
 *   [11] Render — header, chart area, filter footer row, report dropup selector
 *
 * CHANGE LOG — all modifications to this file must be recorded here:
 *   Format : YYYY-MM-DD | Author | Description
 *   ─────────────────────────────────────────────────────────────
 *   2026-03-01 | Claude  | Added section comments and top-level documentation
 *   2026-03-01 | Claude  | P10-A: KPI summary cards; P10-B: collapsible data table; P10-C: CSV export
 *   2026-05-15 | Copilot | Shortened standalone report action labels for compact training-mode layouts
 * ============================================================
 */

// ─── 1 IMPORTS & MODULE-LEVEL CONSTANTS ──────────────────────────────────────
import React, { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { ChartBarIcon, CalendarIcon, UsersIcon, BanknotesIcon, CurrencyDollarIcon, WrenchScrewdriverIcon, ArchiveBoxIcon, ClockIcon, ArrowDownTrayIcon, ChevronUpDownIcon, CalculatorIcon, ShoppingCartIcon, ClipboardDocumentCheckIcon, Cog6ToothIcon } from "@heroicons/react/24/outline";

import useStore from "../services/useStore";
import { reportsAPI, employeesAPI, servicesAPI } from "../services/api";
import useBranding from "../services/useBranding";
import Chart_Report from "./components/Chart_Report";
import Button_Toolbar from "./components/Button_Toolbar";
import Report_Selector_Dropup from "./components/Report_Selector_Dropup";
import useViewMode from "../services/useViewMode";
import Modal_Forecast_Calculator from "./components/Modal_Forecast_Calculator";
import Modal from "./components/Modal";
import PageControlsModal from "./components/Page_Controls_Modal";
import PageTableFooter from "./components/Page_Table_Footer";
import FinancialDashboard from "./components/FinancialDashboard";

const AVAILABLE_REPORTS = [
  {
    id: "appointments",
    title: "Events",
    description: "Track events, meetings, and appointments over time",
    icon: CalendarIcon,
    color: "blue",
    tables: ["schedule", "clients", "services", "user"],
    chartTypes: ["line", "bar", "pie"],
    supportsEventType: true,
  },
  {
    id: "revenue",
    title: "Revenue Analysis",
    description: "Monitor earnings and financial performance",
    icon: BanknotesIcon,
    color: "green",
    tables: ["schedule", "services"],
    chartTypes: ["line", "bar", "area"],
  },
  {
    id: "clients",
    title: "Client Activity",
    description: "Analyze client engagement and retention",
    icon: UsersIcon,
    color: "purple",
    tables: ["clients", "schedule"],
    chartTypes: ["bar", "pie", "doughnut"],
  },
  {
    id: "services",
    title: "Service Performance",
    description: "Compare service popularity and profitability",
    icon: WrenchScrewdriverIcon,
    color: "orange",
    tables: ["services", "schedule"],
    chartTypes: ["pie", "bar", "doughnut"],
  },
  {
    id: "sales",
    title: "Sales Trends",
    description: "Track transaction totals over time",
    icon: CurrencyDollarIcon,
    color: "emerald",
    tables: ["sale_transaction", "user", "client"],
    chartTypes: ["line", "bar", "area"],
  },
  {
    id: "payroll",
    title: "Payroll Summary",
    description: "Monitor payroll payouts by period",
    icon: BanknotesIcon,
    color: "teal",
    tables: ["pay_slip", "user"],
    chartTypes: ["bar", "line", "area"],
  },
  {
    id: "expenses",
    title: "Expense Analysis",
    description: "Track one-time and recurring inventory expenses",
    icon: CurrencyDollarIcon,
    color: "rose",
    tables: ["inventory"],
    chartTypes: ["line", "bar", "area"],
  },
  {
    id: "inventory",
    title: "Inventory Analytics",
    description: "Track stock levels and usage patterns",
    icon: ArchiveBoxIcon,
    color: "red",
    tables: ["inventory", "item", "supplier"],
    chartTypes: ["bar", "line"],
  },
  {
    id: "employees",
    title: "Employee Performance",
    description: "Monitor staff productivity and schedules",
    icon: ClockIcon,
    color: "indigo",
    tables: ["user", "schedule", "attendance"],
    chartTypes: ["bar", "line"],
  },
  {
    id: "attendance",
    title: "Attendance Tracking",
    description: "View employee attendance patterns",
    icon: ClockIcon,
    color: "gray",
    tables: ["attendance", "user"],
    chartTypes: ["line", "bar"],
  },
  {
    id: "orders",
    title: "Portal Orders",
    description: "Track order volume and revenue from the client portal",
    icon: ShoppingCartIcon,
    color: "cyan",
    tables: ["sale_transaction", "client"],
    chartTypes: ["bar", "line", "area"],
  },
  {
    id: "tasks",
    title: "Task Completion",
    description: "Monitor completed vs open tasks over time",
    icon: ClipboardDocumentCheckIcon,
    color: "violet",
    tables: ["user", "schedule"],
    chartTypes: ["bar", "line"],
  },
];

const DATE_RANGE_OPTIONS = [
  { value: "last7days", label: "7D" },
  { value: "last30days", label: "1M" },
  { value: "last3months", label: "3M" },
  { value: "last6months", label: "6M" },
  { value: "lastyear", label: "1Y" },
];

const GROUP_BY_OPTIONS = [
  { value: "day", label: "1D" },
  { value: "week", label: "2W" },
  { value: "month", label: "1M" },
];

const DATE_RANGE_DURATION_LABELS = {
  last7days: "7 Days",
  last30days: "1 Month",
  last3months: "3 Months",
  last6months: "6 Months",
  lastyear: "1 Year",
};

const formatPdfDate = (isoDate) => {
  if (!isoDate) return "—";
  return new Date(`${isoDate}T12:00:00`).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const formatChartTypeLabel = (chartType) => {
  if (!chartType) return "—";
  if (chartType === "doughnut") return "Ring";
  return chartType.charAt(0).toUpperCase() + chartType.slice(1);
};

function buildPdfMetaHtml({ filters, reportId, startDate, endDate, employees, services, user }) {
  const lines = [];
  const duration = DATE_RANGE_DURATION_LABELS[filters.dateRange] || filters.dateRange;
  lines.push(`<div><strong>Range:</strong> From ${formatPdfDate(startDate)} to ${formatPdfDate(endDate)} totaling ${escapeHtml(duration)}</div>`);
  lines.push(`<div><strong>Chart Type:</strong> ${escapeHtml(formatChartTypeLabel(filters.chartType))}</div>`);

  const generatedBy = `${user?.first_name || ""} ${user?.last_name || ""}`.trim() || user?.username || "—";
  lines.push(`<div><strong>Generated By:</strong> ${escapeHtml(generatedBy)}</div>`);

  const now = new Date();
  lines.push(`<div><strong>Generated on:</strong> ${now.toLocaleDateString()}</div>`);
  lines.push(`<div><strong>Generated at:</strong> ${now.toLocaleTimeString()}</div>`);

  if (FILTER_CONFIG.status.condition(reportId)) {
    const opt = FILTER_CONFIG.status.options.find((o) => o.value === filters.status);
    if (opt) lines.push(`<div><strong>Status:</strong> ${escapeHtml(opt.label)}</div>`);
  }
  if (FILTER_CONFIG.eventType.condition(reportId)) {
    const opt = FILTER_CONFIG.eventType.options.find((o) => o.value === filters.eventType);
    if (opt) lines.push(`<div><strong>Events:</strong> ${escapeHtml(opt.label)}</div>`);
  }
  if (FILTER_CONFIG.employee.condition(reportId)) {
    if (filters.employeeId === "all") {
      lines.push("<div><strong>Employees:</strong> All Employees</div>");
    } else {
      const emp = employees.find((e) => String(e.id) === String(filters.employeeId));
      const name = emp ? FILTER_CONFIG.employee.labelKey(emp) : filters.employeeId;
      lines.push(`<div><strong>Employees:</strong> ${escapeHtml(name)}</div>`);
    }
  }
  if (FILTER_CONFIG.service.condition(reportId)) {
    if (filters.serviceId === "all") {
      lines.push("<div><strong>Services:</strong> All Services</div>");
    } else {
      const svc = services.find((s) => String(s.id) === String(filters.serviceId));
      const name = svc ? svc[FILTER_CONFIG.service.labelKey] : filters.serviceId;
      lines.push(`<div><strong>Services:</strong> ${escapeHtml(name)}</div>`);
    }
  }

  return lines.join("\n");
}

// ─── REUSABLE STYLE CONSTANTS ───────────────────────────────────────────────
const CIRCULAR_SELECT_STYLE = {
  width: "3rem",
  height: "3rem",
  minWidth: "3rem",
  borderRadius: "50%",
  paddingLeft: 0,
  paddingRight: 0,
  textAlign: "center",
  appearance: "none",
  backgroundImage: "none",
};

const INLINE_SELECT_STYLE = {
  width: "auto",
  appearance: "none",
  backgroundImage: "none",
};

// ─── DYNAMIC FILTER CONFIGURATION ─────────────────────────────────────────────
// Defines which filters appear for which report types, eliminating repetitive JSX
const FILTER_CONFIG = {
  status: {
    key: "status",
    condition: (reportId) => ["appointments", "attendance", "tasks", "orders"].includes(reportId),
    options: [
      { value: "all", label: "All Statuses" },
      { value: "scheduled", label: "Scheduled" },
      { value: "completed", label: "Completed" },
      { value: "cancelled", label: "Cancelled" },
    ],
  },
  eventType: {
    key: "eventType",
    condition: (reportId) => reportId === "appointments",
    options: [
      { value: "all", label: "All Events" },
      { value: "meeting", label: "Meeting" },
      { value: "call", label: "Call" },
      { value: "appointment", label: "Appointment" },
      { value: "task", label: "Task" },
      { value: "reminder", label: "Reminder" },
    ],
  },
  service: {
    key: "serviceId",
    condition: (reportId) => ["appointments", "revenue", "services"].includes(reportId),
    dataSource: "services",
    labelKey: "name",
    allLabel: "All Services",
  },
  employee: {
    key: "employeeId",
    condition: (reportId) => ["appointments", "revenue", "attendance", "payroll", "tasks"].includes(reportId),
    dataSource: "employees",
    labelKey: (e) => `${e.first_name || ""} ${e.last_name || ""}`.trim() || e.username,
    allLabel: "All Employees",
  },
};

// ─── REPORT API & TRANSFORM MAPPING ─────────────────────────────────────────
// Eliminates repetitive switch statement cases
const REPORT_HANDLERS = {
  appointments: { api: (p) => reportsAPI.getAppointmentsReport(p), transform: "transformAppointmentsData" },
  revenue: { api: (p) => reportsAPI.getRevenueReport(p), transform: "transformRevenueData" },
  clients: { api: (p) => reportsAPI.getClientsReport(p), transform: "transformClientsData" },
  services: { api: (p) => reportsAPI.getServicesReport(p), transform: "transformServicesData" },
  inventory: { api: () => reportsAPI.getInventoryReport(), transform: "transformInventoryData" },
  employees: { api: (p) => reportsAPI.getEmployeesReport(p), transform: "transformEmployeesData" },
  attendance: { api: (p) => reportsAPI.getAttendanceReport(p), transform: "transformAttendanceData" },
  sales: { api: (p) => reportsAPI.getSalesReport(p), transform: "transformSalesData" },
  payroll: { api: (p) => reportsAPI.getPayrollReport(p), transform: "transformPayrollData" },
  expenses: { api: (p) => reportsAPI.getExpensesReport(p), transform: "transformMultiDatasetData" },
  orders: { api: (p) => reportsAPI.getOrdersReport(p), transform: "transformMultiDatasetData" },
  tasks: { api: (p) => reportsAPI.getTasksReport(p), transform: "transformMultiDatasetData" },
};

export default function Reports() {
  // ─── 2 COMPONENT SETUP & PERMISSION GUARD ──────────────────────────────
  const { user, loading, setLoading, error, setError, clearError, hasPageAccess } = useStore();

  const { branding } = useBranding();
  const { isTrainingMode, buttonTextSize } = useViewMode();

  // ─── 3 STATE DECLARATIONS ────────────────────────────────────────────────
  // NOTE: permission guard is evaluated AFTER all hooks to comply with React's Rules of Hooks
  const [selectedReportId, setSelectedReportId] = useState("");
  const [reportData, setReportData] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [services, setServices] = useState([]);
  const [reportMenuOpen, setReportMenuOpen] = useState(false);
  const [showForecastCalculator, setShowForecastCalculator] = useState(false);
  const [showFinancialDashboard, setShowFinancialDashboard] = useState(false);
  const [showPageControls, setShowPageControls] = useState(false);
  const [reportFilters, setReportFilters] = useState({
    dateRange: "last30days",
    groupBy: "month",
    chartType: "line",
    status: "all",
    employeeId: "all",
    serviceId: "all",
    eventType: "all",
  });
  const [savedFilters, setSavedFilters] = useState([]);
  const [savedFiltersMenuOpen, setSavedFiltersMenuOpen] = useState(false);
  const [showSaveFilterModal, setShowSaveFilterModal] = useState(false);
  const [saveFilterName, setSaveFilterName] = useState("");
  const [currentPeriodOffset, setCurrentPeriodOffset] = useState(0);
  const [fullScreenMode, setFullScreenMode] = useState(false);

  // ─── 4 DERIVED STATE — permission-filtered report list & selected report ─
  const accessibleReports = AVAILABLE_REPORTS.filter((report) => {
    return report.tables.some((table) => {
      const pageMap = {
        schedule: "schedule",
        clients: "clients",
        services: "services",
        user: "employees",
        inventory: "inventory",
        item: "inventory",
        supplier: "suppliers",
        attendance: "attendance",
        sale_transaction: "sales",
        pay_slip: "profile",
        client_order: "clients",
        task: "employees",
      };
      const page = pageMap[table];
      if (page === "profile") return true;
      return page && hasPageAccess(page);
    });
  });

  const selectedReport = useMemo(() => accessibleReports.find((r) => r.id === selectedReportId) || null, [accessibleReports, selectedReportId]);

  // ─── 5 REPORT SELECTION HANDLER ──────────────────────────────────────────
  const handleReportSelect = (reportId) => {
    const report = accessibleReports.find((r) => r.id === reportId);
    if (!report) return;
    setSelectedReportId(report.id);
    setReportFilters((prev) => ({
      ...prev,
      groupBy: "month",
      chartType: report.chartTypes[0] || "line",
    }));
    setReportMenuOpen(false);
  };

  // ─── 6 DATA LOADING / API FETCH ──────────────────────────────────────────
  const loadReportData = async (reportId, filters = reportFilters) => {
    if (!reportId) return;
    setLoading(true);
    try {
      let response;
      const apiParams = {
        start_date: getStartDate(filters.dateRange, currentPeriodOffset),
        end_date: getEndDate(filters.dateRange, currentPeriodOffset),
        group_by: filters.groupBy,
        ...(filters.status && filters.status !== "all" ? { status: filters.status } : {}),
        ...(filters.employeeId && filters.employeeId !== "all" ? { employee_id: filters.employeeId } : {}),
        ...(filters.serviceId && filters.serviceId !== "all" ? { service_id: filters.serviceId } : {}),
        ...(filters.eventType && filters.eventType !== "all" ? { event_type: filters.eventType } : {}),
      };

      const handler = REPORT_HANDLERS[reportId];
      if (!handler) {
        setReportData({ labels: [], datasets: [] });
      } else {
        response = await handler.api(apiParams);
        const transformFn = {
          transformAppointmentsData,
          transformRevenueData,
          transformClientsData,
          transformServicesData,
          transformInventoryData,
          transformEmployeesData,
          transformAttendanceData,
          transformSalesData,
          transformPayrollData,
          transformMultiDatasetData,
        }[handler.transform];
        setReportData(transformFn(response.data, filters.chartType));
      }
      clearError();
    } catch (err) {
      setError("Failed to load report data");
      console.error(err);
      setReportData({ labels: [], datasets: [] });
    } finally {
      setLoading(false);
    }
  };

  // ─── SAVED FILTERS HANDLERS ────────────────────────────────────────────
  const loadSavedFilters = async () => {
    try {
      const response = await reportsAPI.getSavedFilters();
      setSavedFilters(response.data || []);
    } catch (err) {
      console.error("Failed to load saved filters:", err);
    }
  };

  const handleSaveFilter = async () => {
    if (!saveFilterName.trim() || !selectedReport) return;
    try {
      await reportsAPI.createSavedFilter({
        name: saveFilterName.trim(),
        report_id: selectedReport.id,
        date_range: reportFilters.dateRange,
        group_by: reportFilters.groupBy,
        chart_type: reportFilters.chartType,
        status_filter: reportFilters.status,
        employee_id: reportFilters.employeeId,
        service_id: reportFilters.serviceId,
        event_type: reportFilters.eventType,
      });
      setSaveFilterName("");
      setShowSaveFilterModal(false);
      await loadSavedFilters();
    } catch (err) {
      setError("Failed to save filter");
      console.error(err);
    }
  };

  const handleLoadFilter = (filter) => {
    setReportFilters({
      dateRange: filter.date_range || "last30days",
      groupBy: filter.group_by || "month",
      chartType: filter.chart_type || "line",
      status: filter.status_filter || "all",
      employeeId: filter.employee_id || "all",
      serviceId: filter.service_id || "all",
      eventType: filter.event_type || "all",
    });
    setCurrentPeriodOffset(0);
    setSavedFiltersMenuOpen(false);
  };

  const handleDeleteFilter = async (filterId) => {
    try {
      await reportsAPI.deleteSavedFilter(filterId);
      await loadSavedFilters();
    } catch (err) {
      console.error("Failed to delete filter:", err);
    }
  };

  // ─── TIME NAVIGATION ─────────────────────────────────────────────────────
  const handleNavigatePeriod = (direction) => {
    setCurrentPeriodOffset((prev) => prev + direction);
  };

  const handleResetPeriod = () => {
    setCurrentPeriodOffset(0);
  };

  // ─── 7 DATE RANGE HELPERS ────────────────────────────────────────────────
  const getPeriodDuration = (dateRange) => {
    switch (dateRange) {
      case "last7days":
        return { days: 7 };
      case "last30days":
        return { days: 30 };
      case "last3months":
        return { months: 3 };
      case "last6months":
        return { months: 6 };
      case "lastyear":
        return { years: 1 };
      default:
        return { days: 30 };
    }
  };

  const getStartDate = (dateRange, offset = 0) => {
    const duration = getPeriodDuration(dateRange);
    const base = new Date();

    // Apply offset first
    if (offset !== 0) {
      if (duration.days) base.setDate(base.getDate() - duration.days * offset);
      else if (duration.months) base.setMonth(base.getMonth() - duration.months * offset);
      else if (duration.years) base.setFullYear(base.getFullYear() - duration.years * offset);
    }

    // Then go back one period for the start date
    if (duration.days) base.setDate(base.getDate() - duration.days);
    else if (duration.months) base.setMonth(base.getMonth() - duration.months);
    else if (duration.years) base.setFullYear(base.getFullYear() - duration.years);

    return base.toISOString().split("T")[0];
  };

  const getEndDate = (dateRange, offset = 0) => {
    if (offset === 0) return new Date().toISOString().split("T")[0];

    const duration = getPeriodDuration(dateRange);
    const base = new Date();

    if (duration.days) base.setDate(base.getDate() - duration.days * offset);
    else if (duration.months) base.setMonth(base.getMonth() - duration.months * offset);
    else if (duration.years) base.setFullYear(base.getFullYear() - duration.years * offset);

    return base.toISOString().split("T")[0];
  };

  // ─── 8 DATA TRANSFORM FUNCTIONS — map API responses to Chart.js datasets ─
  const getPalette = (count, alpha = 0.5) => Array.from({ length: Math.max(count, 1) }, (_, i) => `hsla(${Math.round((i * 360) / Math.max(count, 1))}, 70%, 55%, ${alpha})`);

  const transformAppointmentsData = (data, chartType) => ({
    labels: data.labels,
    datasets: [
      {
        label: "Appointments",
        data: data.data,
        backgroundColor: chartType === "pie" || chartType === "doughnut" ? data.data.map((_, i) => `hsl(${(i * 360) / data.data.length}, 70%, 60%)`) : "rgba(59, 130, 246, 0.5)",
        borderColor: "rgb(59, 130, 246)",
        borderWidth: 2,
      },
    ],
  });

  const transformRevenueData = (data, chartType) => ({
    labels: data.labels,
    datasets:
      Array.isArray(data.datasets) && data.datasets.length > 0
        ? data.datasets.map((dataset, idx) => {
            const hue = [142, 204, 25, 276][idx % 4];
            const values = dataset.data || [];
            return {
              label: dataset.label || `Revenue ${idx + 1}`,
              data: values,
              backgroundColor: chartType === "pie" || chartType === "doughnut" ? getPalette(Math.max(values.length, 1), 0.6) : `hsla(${hue}, 70%, 55%, 0.35)`,
              borderColor: `hsl(${hue}, 70%, 45%)`,
              borderWidth: 2,
            };
          })
        : [
            {
              label: "Revenue ($)",
              data: data.data || [],
              backgroundColor: chartType === "pie" || chartType === "doughnut" ? (data.data || []).map((_, i) => `hsl(${(i * 360) / Math.max((data.data || []).length, 1)}, 70%, 60%)`) : "rgba(34, 197, 94, 0.5)",
              borderColor: "rgb(34, 197, 94)",
              borderWidth: 2,
            },
          ],
  });

  const transformClientsData = (data, chartType) => ({
    labels: data.labels,
    datasets:
      Array.isArray(data.datasets) && data.datasets.length > 0
        ? data.datasets.map((dataset, idx) => {
            const palette = getPalette((data.labels || []).length, chartType === "pie" || chartType === "doughnut" ? 0.6 : 0.35);
            const hue = (idx * 120) % 360;
            return {
              label: dataset.label || `Series ${idx + 1}`,
              data: dataset.data || [],
              backgroundColor: chartType === "pie" || chartType === "doughnut" ? palette : `hsla(${hue}, 70%, 55%, 0.35)`,
              borderColor: `hsl(${hue}, 70%, 45%)`,
              borderWidth: 2,
            };
          })
        : [
            {
              label: "Clients",
              data: data.data || [],
              backgroundColor: ["rgba(147, 51, 234, 0.5)", "rgba(59, 130, 246, 0.5)", "rgba(107, 114, 128, 0.5)"],
              borderColor: ["rgb(147, 51, 234)", "rgb(59, 130, 246)", "rgb(107, 114, 128)"],
              borderWidth: 2,
            },
          ],
  });

  const transformServicesData = (data, chartType) => ({
    labels: data.labels,
    datasets: [
      {
        label: "Service Usage",
        data: data.data || [],
        backgroundColor: chartType === "pie" || chartType === "doughnut" ? getPalette((data.labels || []).length) : "rgba(251, 146, 60, 0.5)",
        borderColor: "rgb(251, 146, 60)",
        borderWidth: 2,
      },
    ],
  });

  const transformInventoryData = (data, chartType) => ({
    labels: data.labels,
    datasets: [
      {
        label: "Current Stock",
        data: data.data || [],
        backgroundColor: "rgba(239, 68, 68, 0.5)",
        borderColor: "rgb(239, 68, 68)",
        borderWidth: 2,
      },
    ],
  });

  const transformEmployeesData = (data, chartType) => ({
    labels: data.labels,
    datasets: [
      {
        label: "Appointments",
        data: data.data || [],
        backgroundColor: "rgba(99, 102, 241, 0.5)",
        borderColor: "rgb(99, 102, 241)",
        borderWidth: 2,
      },
    ],
  });

  const transformAttendanceData = (data, chartType) => ({
    labels: data.labels,
    datasets: [
      {
        label: "Attendance Records",
        data: data.data || [],
        backgroundColor: "rgba(75, 85, 99, 0.5)",
        borderColor: "rgb(75, 85, 99)",
        borderWidth: 2,
      },
    ],
  });

  const transformSalesData = (data, chartType) => ({
    labels: data.labels,
    datasets:
      Array.isArray(data.datasets) && data.datasets.length > 0
        ? data.datasets.map((dataset, idx) => {
            const hue = [160, 205, 285][idx % 3];
            const values = dataset.data || [];
            return {
              label: dataset.label || `Sales ${idx + 1}`,
              data: values,
              backgroundColor: chartType === "pie" || chartType === "doughnut" ? getPalette(Math.max(values.length, 1), 0.6) : `hsla(${hue}, 70%, 55%, 0.35)`,
              borderColor: `hsl(${hue}, 70%, 45%)`,
              borderWidth: 2,
            };
          })
        : [
            {
              label: "Sales Total ($)",
              data: data.data || [],
              backgroundColor: "rgba(16, 185, 129, 0.5)",
              borderColor: "rgb(16, 185, 129)",
              borderWidth: 2,
            },
          ],
  });

  const transformPayrollData = (data, chartType) => ({
    labels: data.labels,
    datasets: [
      {
        label: "Payroll Net ($)",
        data: data.data || [],
        backgroundColor: "rgba(20, 184, 166, 0.5)",
        borderColor: "rgb(20, 184, 166)",
        borderWidth: 2,
      },
    ],
  });

  // Generic multi-dataset transform for reports that already return datasets array
  const transformMultiDatasetData = (data, chartType) => {
    if (!Array.isArray(data.datasets) || data.datasets.length === 0) {
      return { labels: data.labels || [], datasets: [] };
    }
    const palette = [
      { bg: "rgba(59,130,246,0.5)", border: "rgb(59,130,246)" },
      { bg: "rgba(239,68,68,0.5)", border: "rgb(239,68,68)" },
      { bg: "rgba(16,185,129,0.5)", border: "rgb(16,185,129)" },
      { bg: "rgba(245,158,11,0.5)", border: "rgb(245,158,11)" },
    ];
    return {
      labels: data.labels,
      datasets: data.datasets.map((dataset, idx) => {
        const colors = palette[idx % palette.length];
        const values = dataset.data || [];
        return {
          label: dataset.label || `Series ${idx + 1}`,
          data: values,
          backgroundColor: chartType === "pie" || chartType === "doughnut" ? getPalette(values.length, 0.6) : colors.bg,
          borderColor: colors.border,
          borderWidth: 2,
        };
      }),
    };
  };

  // ─── 9 LIFECYCLE HOOKS ───────────────────────────────────────────────────
  useEffect(() => {
    if (accessibleReports.length > 0 && !selectedReportId) {
      setSelectedReportId(accessibleReports[0].id);
    }
  }, [accessibleReports, selectedReportId]);

  useEffect(() => {
    const loadOptions = async () => {
      try {
        const [empRes, svcRes] = await Promise.all([employeesAPI.getAll(), servicesAPI.getAll()]);
        setEmployees(empRes.data || []);
        setServices(svcRes.data || []);
      } catch {
        setEmployees([]);
        setServices([]);
      }
    };
    loadOptions();
  }, []);

  useEffect(() => {
    if (selectedReport) {
      loadReportData(selectedReport.id, reportFilters);
    }
  }, [selectedReport?.id, reportFilters.dateRange, reportFilters.groupBy, reportFilters.chartType, reportFilters.status, reportFilters.employeeId, reportFilters.serviceId, reportFilters.eventType, currentPeriodOffset]);

  useEffect(() => {
    loadSavedFilters();
  }, []);

  const canUseStatus = selectedReport?.id === "appointments";
  const canUseEventType = selectedReport?.id === "appointments";
  const canUseService = ["appointments", "services", "revenue"].includes(selectedReport?.id || "");
  const canUseEmployee = ["appointments", "employees", "attendance"].includes(selectedReport?.id || "");

  const [showDataTable, setShowDataTable] = useState(false);

  // Derive KPI summary cards from current chart data
  const kpis = useMemo(() => {
    const values = reportData?.datasets?.[0]?.data;
    if (!values?.length) return null;
    const nums = values.map(Number);
    const labels = reportData.labels || [];
    const total = nums.reduce((s, v) => s + v, 0);
    const avg = total / nums.length;
    const maxVal = Math.max(...nums);
    const maxIdx = nums.indexOf(maxVal);
    const isCurrency = (reportData.datasets[0].label || "").includes("($)");
    const fmt = (n) => (isCurrency ? `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : n.toLocaleString("en-US", { maximumFractionDigits: 1 }));
    return [
      { label: "Total", value: fmt(total) },
      { label: "Avg / Period", value: fmt(avg) },
      { label: "Peak", value: fmt(maxVal), sub: labels[maxIdx] || "" },
      { label: "Periods", value: nums.length },
    ];
  }, [reportData]);

  // ─── 10 PDF EXPORT HANDLER ───────────────────────────────────────────────
  const handleExportPdf = () => {
    if (!selectedReport) return;

    const reportEl = document.getElementById("report-export-section");
    if (!reportEl) return;

    const chartCanvas = reportEl.querySelector("canvas");
    const chartImg = chartCanvas ? chartCanvas.toDataURL("image/png") : "";

    const startDate = getStartDate(reportFilters.dateRange, currentPeriodOffset);
    const endDate = getEndDate(reportFilters.dateRange, currentPeriodOffset);
    const metaHtml = buildPdfMetaHtml({
      filters: reportFilters,
      reportId: selectedReport.id,
      startDate,
      endDate,
      employees,
      services,
      user,
    });

    const printWindow = window.open("", "_blank", "width=1000,height=800");
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>${selectedReport.title} - PDF Export</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 24px; color: #111827; }
            h1 { margin: 0 0 8px; font-size: 24px; }
            p { margin: 0 0 6px; color: #4b5563; }
            .meta { margin: 12px 0 18px; font-size: 12px; color: #6b7280; }
            .chart-wrap { border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; }
            .chart-wrap img { width: 100%; height: auto; display: block; }
            .footer { margin-top: 18px; font-size: 12px; color: #6b7280; }
          </style>
        </head>
        <body>
          <h1>${selectedReport.title}</h1>
          <p>${selectedReport.description}</p>
          <div class="meta">
            ${metaHtml}
          </div>
          <div class="chart-wrap">
            ${chartImg ? `<img src="${chartImg}" alt="${selectedReport.title}" />` : "<p>Chart preview unavailable.</p>"}
          </div>
          <div class="footer">${branding.companyName || "Business Manager"}</div>
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  // ─── 11 CSV EXPORT HANDLER ───────────────────────────────────────────────
  const handleExportCsv = () => {
    if (!reportData?.labels?.length || !selectedReport) return;
    const datasets = Array.isArray(reportData.datasets) && reportData.datasets.length > 0 ? reportData.datasets : [{ label: "Value", data: [] }];
    const header = ["Period", ...datasets.map((dataset) => dataset.label || "Value")];
    const rows = [header, ...reportData.labels.map((label, i) => [label, ...datasets.map((dataset) => dataset?.data?.[i] ?? "")])];
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selectedReport.id}-${reportFilters.dateRange}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ─── 12 RENDER ───────────────────────────────────────────────────────────
  // Permission guard — placed after all hooks to comply with React's Rules of Hooks
  if (!hasPageAccess("reports")) {
    return <Navigate to="/profile" replace />;
  }

  if (loading && !selectedReport) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className={`h-full flex flex-col reports-page${fullScreenMode ? " reports-page--full" : ""}`} style={{ minHeight: 0 }}>
      <style>{`.reports-page::-webkit-scrollbar{display:none!important}`}</style>
      {!fullScreenMode && (
        <div className="p-1 border-bottom border-gray-200 dark:border-gray-700 d-flex justify-content-between align-items-center">
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-1">Reports</h1>
          <div className="d-flex align-items-center gap-2">
            <Button_Toolbar icon={ArrowDownTrayIcon} label="PDF" onClick={handleExportPdf} className="btn-outline-secondary" />
            <Button_Toolbar icon={ArrowDownTrayIcon} label="CSV" onClick={handleExportCsv} className="btn-outline-secondary" />
            <Button_Toolbar icon={Cog6ToothIcon} label="Settings" onClick={() => setShowPageControls(true)} className="btn-outline-secondary" title="Page settings" />
          </div>
        </div>
      )}

      <div className={`flex-grow-1 reports-page__chart-area ${fullScreenMode ? "overflow-hidden p-1 d-flex flex-column" : "overflow-auto p-3"}`} style={{ minHeight: 0, scrollbarWidth: "none", msOverflowStyle: "none" }}>
        {error && <div className="mb-3 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded">{error}</div>}

        {!selectedReport ? (
          <div className="text-center py-12">
            <ChartBarIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No reports available</h3>
            <p className="mt-1 text-sm text-gray-500">You don't have permissions to view reports.</p>
          </div>
        ) : (
          <>
            {/* ── KPI SUMMARY CARDS ── */}
            {!fullScreenMode && kpis && (
              <div className="d-flex flex-wrap gap-2 mb-3">
                {kpis.map((kpi) => (
                  <div key={kpi.label} className="flex-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-center" style={{ minWidth: "6rem" }}>
                    <div className="text-lg font-bold text-gray-900 dark:text-white leading-tight">{kpi.value}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{kpi.label}</div>
                    {kpi.sub && <div className="text-xs text-gray-400 dark:text-gray-500 truncate">{kpi.sub}</div>}
                  </div>
                ))}
              </div>
            )}

            <div
              id="report-export-section"
              className={fullScreenMode ? "flex-grow-1 min-h-0 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-2 d-flex flex-column" : "h-[60vh] min-h-[320px] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-3"}
            >
              <div className={fullScreenMode ? "flex-grow-1 min-h-0 h-100 position-relative" : "h-100 position-relative"} style={{ minHeight: fullScreenMode ? 0 : "280px" }}>
                <div className="position-absolute top-0 end-0 m-2" style={{ zIndex: 12 }}>
                  <button
                    type="button"
                    onClick={() => setFullScreenMode((v) => !v)}
                    className={`btn btn-sm ${fullScreenMode ? "btn-primary" : "btn-outline-secondary"}`}
                    style={{ fontSize: "0.875rem", whiteSpace: "nowrap" }}
                    title={fullScreenMode ? "Exit full screen report view" : "Full screen report view"}
                  >
                    Full
                  </button>
                </div>
                <Chart_Report data={reportData} type={reportFilters.chartType} title={selectedReport.title} loading={loading} />
              </div>
            </div>

            {/* ── DATA TABLE TOGGLE + TABLE ── */}
            {!fullScreenMode && reportData?.labels?.length > 0 && (
              <div className="mt-3">
                <button type="button" onClick={() => setShowDataTable((v) => !v)} className="btn btn-outline-secondary d-flex align-items-center gap-1" style={{ fontSize: `var(--app-btn-label-font-size, 0.875rem)` }}>
                  <ChevronUpDownIcon className="h-4 w-4" />
                  {showDataTable ? "Hide" : "Show"}
                </button>
                {showDataTable && (
                  <div className="mt-2 overflow-auto rounded-lg border border-gray-200 dark:border-gray-700" style={{ maxHeight: "16rem" }}>
                    <table className="table table-sm mb-0">
                      <thead className="sticky-top bg-white dark:bg-gray-900">
                        <tr>
                          <th className="text-xs text-gray-600 dark:text-gray-400 fw-semibold">Period</th>
                          {(reportData.datasets || []).map((dataset, idx) => (
                            <th key={`col-${idx}`} className="text-xs text-gray-600 dark:text-gray-400 fw-semibold text-end">
                              {dataset?.label || `Value ${idx + 1}`}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {reportData.labels.map((label, i) => (
                          <tr key={i}>
                            <td className="text-sm text-gray-700 dark:text-gray-300">{label}</td>
                            {(reportData.datasets || []).map((dataset, idx) => (
                              <td key={`row-${i}-col-${idx}`} className="text-sm text-gray-900 dark:text-white text-end font-medium">
                                {dataset?.data?.[i] ?? "—"}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {selectedReport && (
        <PageTableFooter
          hideSearch
          searchTerm=""
          onSearch={() => {}}
          beforeSearch={
            <div className="d-flex flex-wrap align-items-center gap-2 w-100">
              <select className="form-select form-select-sm" style={CIRCULAR_SELECT_STYLE} value={reportFilters.dateRange} onChange={(e) => setReportFilters((prev) => ({ ...prev, dateRange: e.target.value }))}>
                {DATE_RANGE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>

              <select className="form-select form-select-sm" style={CIRCULAR_SELECT_STYLE} value={reportFilters.groupBy} onChange={(e) => setReportFilters((prev) => ({ ...prev, groupBy: e.target.value }))}>
                {GROUP_BY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>

              <select className="form-select form-select-sm" style={CIRCULAR_SELECT_STYLE} value={reportFilters.chartType} onChange={(e) => setReportFilters((prev) => ({ ...prev, chartType: e.target.value }))}>
                {selectedReport.chartTypes.map((chartType) => (
                  <option key={chartType} value={chartType}>
                    {chartType === "doughnut" ? "Ring" : chartType}
                  </option>
                ))}
              </select>

              {canUseStatus && (
                <select className="form-select form-select-sm" style={INLINE_SELECT_STYLE} value={reportFilters.status} onChange={(e) => setReportFilters((prev) => ({ ...prev, status: e.target.value }))}>
                  {FILTER_CONFIG.status.options.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              )}

              {canUseService && (
                <select className="form-select form-select-sm" style={INLINE_SELECT_STYLE} value={reportFilters.serviceId} onChange={(e) => setReportFilters((prev) => ({ ...prev, serviceId: e.target.value }))}>
                  <option value="all">{FILTER_CONFIG.service.allLabel}</option>
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s[FILTER_CONFIG.service.labelKey]}
                    </option>
                  ))}
                </select>
              )}

              {canUseEmployee && (
                <select className="form-select form-select-sm" style={INLINE_SELECT_STYLE} value={reportFilters.employeeId} onChange={(e) => setReportFilters((prev) => ({ ...prev, employeeId: e.target.value }))}>
                  <option value="all">{FILTER_CONFIG.employee.allLabel}</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {FILTER_CONFIG.employee.labelKey(e)}
                    </option>
                  ))}
                </select>
              )}

              {canUseEventType && (
                <select className="form-select form-select-sm" style={INLINE_SELECT_STYLE} value={reportFilters.eventType} onChange={(e) => setReportFilters((prev) => ({ ...prev, eventType: e.target.value }))}>
                  {FILTER_CONFIG.eventType.options.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              )}

              {/* Time Navigation */}
              {currentPeriodOffset !== 0 && (
                <button type="button" onClick={handleResetPeriod} className="btn btn-sm btn-outline-secondary" title="Reset to current period">
                  Today
                </button>
              )}
            </div>
          }
        >
          <div className="d-flex justify-content-between align-items-center w-100 position-relative">
            {/* Left: Time Navigation */}
            <div className="d-flex align-items-center gap-1">
              <button type="button" onClick={() => handleNavigatePeriod(1)} className="btn btn-sm btn-outline-secondary" title="Previous period">
                ←
              </button>
              <button type="button" onClick={() => handleNavigatePeriod(-1)} disabled={currentPeriodOffset <= 0} className="btn btn-sm btn-outline-secondary" title="Next period">
                →
              </button>
            </div>

            {/* Center: Report Selector */}
            <Report_Selector_Dropup open={reportMenuOpen} onToggle={setReportMenuOpen} selectedTitle={selectedReport?.title} reports={accessibleReports} selectedReportId={selectedReportId} onSelectReport={handleReportSelect} onOpenFinancial={() => setShowFinancialDashboard(true)} />

            {/* Right: Saved Filters + Save */}
            <div className="d-flex align-items-center gap-1 position-relative">
              {/* Saved Filters Dropup */}
              <div className="position-relative">
                <Button_Toolbar icon={ChevronUpDownIcon} label={isTrainingMode ? "Filters" : ""} onClick={() => setSavedFiltersMenuOpen((prev) => !prev)} className="btn-outline-secondary" />

                {savedFiltersMenuOpen && (
                  <div className="position-absolute bottom-100 end-0 mb-2 border border-gray-200 dark:border-gray-700 rounded-3 shadow-sm bg-white dark:bg-gray-900 p-1" style={{ minWidth: isTrainingMode ? "16rem" : "12rem", maxHeight: "20rem", overflow: "auto", zIndex: 20 }}>
                    {savedFilters.filter((f) => f.report_id === selectedReport?.id).length === 0 ? (
                      <div className="px-3 py-2 text-sm text-gray-500">No saved filters</div>
                    ) : (
                      savedFilters
                        .filter((f) => f.report_id === selectedReport?.id)
                        .map((filter) => (
                          <div key={filter.id} className="d-flex align-items-center justify-content-between gap-2 px-2 py-1">
                            <button type="button" onClick={() => handleLoadFilter(filter)} className="btn btn-sm btn-outline-secondary flex-grow-1 text-start text-truncate" style={{ fontSize: `var(--app-btn-label-font-size, 0.875rem)` }}>
                              {filter.name}
                            </button>
                            <button type="button" onClick={() => handleDeleteFilter(filter.id)} className="btn btn-sm btn-outline-danger" title="Delete">
                              ×
                            </button>
                          </div>
                        ))
                    )}
                  </div>
                )}
              </div>

              {/* Save Filter Button */}
              <Button_Toolbar icon={ArrowDownTrayIcon} label={isTrainingMode ? "Save" : ""} onClick={() => setShowSaveFilterModal(true)} className="btn-outline-secondary" title="Save current filter" />
            </div>
          </div>
        </PageTableFooter>
      )}

      {/* Forecast Calculator Modal */}
      <Modal_Forecast_Calculator isOpen={showForecastCalculator} onClose={() => setShowForecastCalculator(false)} />

      <Modal isOpen={showFinancialDashboard} onClose={() => setShowFinancialDashboard(false)} fullScreen={true} noPadding={true}>
        <div className="p-4 bg-gray-50 h-full overflow-auto">
          <div className="d-flex align-items-center justify-content-between mb-3">
            <h2 className="text-xl font-bold text-gray-900 mb-0">Financial Controls</h2>
            <Button_Toolbar icon={ChartBarIcon} label="Close" onClick={() => setShowFinancialDashboard(false)} className="btn-outline-secondary" />
          </div>
          <FinancialDashboard />
        </div>
      </Modal>

      <PageControlsModal isOpen={showPageControls} onClose={() => setShowPageControls(false)} title="Report Page Controls">
        <div className="small text-muted">Use these controls to configure reports and exports.</div>
        <div className="small">Choose report, period, chart type, and export options using the toolbar controls.</div>
      </PageControlsModal>

      {/* Save Filter Modal */}
      <Modal isOpen={showSaveFilterModal} onClose={() => setShowSaveFilterModal(false)} title="Save Filter">
        <div className="p-3">
          <label className="form-label">Filter Name</label>
          <input
            type="text"
            className="form-control"
            value={saveFilterName}
            onChange={(e) => setSaveFilterName(e.target.value)}
            placeholder="Enter a name for this filter..."
            onKeyDown={(e) => {
              if (e.key === "Enter" && saveFilterName.trim()) {
                handleSaveFilter();
              }
            }}
            autoFocus
          />
          <div className="d-flex justify-content-end gap-2 mt-3">
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={() => {
                setShowSaveFilterModal(false);
                setSaveFilterName("");
              }}
            >
              Cancel
            </button>
            <button type="button" className="btn btn-primary" onClick={handleSaveFilter} disabled={!saveFilterName.trim()}>
              Save
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
