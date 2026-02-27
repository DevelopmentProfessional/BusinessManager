import React, { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import {
  ChartBarIcon,
  CalendarIcon,
  UsersIcon,
  BanknotesIcon,
  CurrencyDollarIcon,
  WrenchScrewdriverIcon,
  ArchiveBoxIcon,
  ClockIcon,
  ArrowPathIcon,
  ArrowDownTrayIcon
} from '@heroicons/react/24/outline';
import useStore from '../services/useStore';
import { reportsAPI, employeesAPI, servicesAPI } from '../services/api';
import useBranding from '../services/useBranding';
import Chart_Report from './components/Chart_Report';
import Button_Toolbar from './components/Button_Toolbar';

const AVAILABLE_REPORTS = [
  {
    id: 'appointments',
    title: 'Appointments Over Time',
    description: 'Track appointment trends and patterns',
    icon: CalendarIcon,
    color: 'blue',
    tables: ['schedule', 'clients', 'services', 'user'],
    chartTypes: ['line', 'bar', 'pie']
  },
  {
    id: 'revenue',
    title: 'Revenue Analysis',
    description: 'Monitor earnings and financial performance',
    icon: BanknotesIcon,
    color: 'green',
    tables: ['schedule', 'services'],
    chartTypes: ['line', 'bar', 'area']
  },
  {
    id: 'clients',
    title: 'Client Activity',
    description: 'Analyze client engagement and retention',
    icon: UsersIcon,
    color: 'purple',
    tables: ['clients', 'schedule'],
    chartTypes: ['bar', 'pie', 'doughnut']
  },
  {
    id: 'services',
    title: 'Service Performance',
    description: 'Compare service popularity and profitability',
    icon: WrenchScrewdriverIcon,
    color: 'orange',
    tables: ['services', 'schedule'],
    chartTypes: ['pie', 'bar', 'doughnut']
  },
  {
    id: 'sales',
    title: 'Sales Trends',
    description: 'Track transaction totals over time',
    icon: CurrencyDollarIcon,
    color: 'emerald',
    tables: ['sale_transaction', 'user', 'client'],
    chartTypes: ['line', 'bar', 'area']
  },
  {
    id: 'payroll',
    title: 'Payroll Summary',
    description: 'Monitor payroll payouts by period',
    icon: BanknotesIcon,
    color: 'teal',
    tables: ['pay_slip', 'user'],
    chartTypes: ['bar', 'line', 'area']
  },
  {
    id: 'inventory',
    title: 'Inventory Analytics',
    description: 'Track stock levels and usage patterns',
    icon: ArchiveBoxIcon,
    color: 'red',
    tables: ['inventory', 'item', 'supplier'],
    chartTypes: ['bar', 'line']
  },
  {
    id: 'employees',
    title: 'Employee Performance',
    description: 'Monitor staff productivity and schedules',
    icon: ClockIcon,
    color: 'indigo',
    tables: ['user', 'schedule', 'attendance'],
    chartTypes: ['bar', 'line']
  },
  {
    id: 'attendance',
    title: 'Attendance Tracking',
    description: 'View employee attendance patterns',
    icon: ClockIcon,
    color: 'gray',
    tables: ['attendance', 'user'],
    chartTypes: ['line', 'bar']
  }
];

const DATE_RANGE_OPTIONS = [
  { value: 'last7days', label: '7D' },
  { value: 'last30days', label: '30D' },
  { value: 'last3months', label: '3M' },
  { value: 'last6months', label: '6M' },
  { value: 'lastyear', label: '1Y' },
  { value: 'custom', label: 'Custom' }
];

const GROUP_BY_OPTIONS = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' }
];

export default function Reports() {
  const {
    loading, setLoading, error, setError, clearError,
    hasPermission
  } = useStore();

  if (!hasPermission('reports', 'read') && 
      !hasPermission('schedule', 'read') &&
      !hasPermission('clients', 'read') &&
      !hasPermission('services', 'read')) {
    return <Navigate to="/profile" replace />;
  }

  const { branding } = useBranding();

  const [selectedReportId, setSelectedReportId] = useState('');
  const [reportData, setReportData] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [services, setServices] = useState([]);
  const [reportFilters, setReportFilters] = useState({
    dateRange: 'last30days',
    startDate: null,
    endDate: null,
    groupBy: 'day',
    chartType: 'line',
    status: 'all',
    employeeId: 'all',
    serviceId: 'all'
  });

  const accessibleReports = AVAILABLE_REPORTS.filter(report => {
    return report.tables.some(table => {
      const pageMap = {
        'schedule': 'schedule',
        'clients': 'clients', 
        'services': 'services',
        'user': 'employees',
        'inventory': 'inventory',
        'item': 'inventory',
        'supplier': 'suppliers',
        'attendance': 'attendance',
        'sale_transaction': 'sales',
        'pay_slip': 'profile'
      };
      const page = pageMap[table];
      if (page === 'profile') return true;
      return page && (hasPermission(page, 'read') || hasPermission(page, 'write') || hasPermission(page, 'admin'));
    });
  });

  const selectedReport = useMemo(
    () => accessibleReports.find((r) => r.id === selectedReportId) || null,
    [accessibleReports, selectedReportId]
  );

  const handleReportSelect = (reportId) => {
    const report = accessibleReports.find((r) => r.id === reportId);
    if (!report) return;
    setSelectedReportId(report.id);
    setReportFilters((prev) => ({ ...prev, chartType: report.chartTypes[0] || 'line' }));
  };

  const loadReportData = async (reportId, filters = reportFilters) => {
    if (!reportId) return;
    setLoading(true);
    try {
      let response;
      const apiParams = {
        start_date: getStartDate(filters.dateRange, filters.startDate),
        end_date: getEndDate(filters.dateRange, filters.endDate),
        group_by: filters.groupBy,
        ...(filters.status && filters.status !== 'all' ? { status: filters.status } : {}),
        ...(filters.employeeId && filters.employeeId !== 'all' ? { employee_id: filters.employeeId } : {}),
        ...(filters.serviceId && filters.serviceId !== 'all' ? { service_id: filters.serviceId } : {})
      };

      switch (reportId) {
        case 'appointments':
          response = await reportsAPI.getAppointmentsReport(apiParams);
          setReportData(transformAppointmentsData(response.data, filters.chartType));
          break;
        case 'revenue':
          response = await reportsAPI.getRevenueReport(apiParams);
          setReportData(transformRevenueData(response.data, filters.chartType));
          break;
        case 'clients':
          response = await reportsAPI.getClientsReport(apiParams);
          setReportData(transformClientsData(response.data, filters.chartType));
          break;
        case 'services':
          response = await reportsAPI.getServicesReport(apiParams);
          setReportData(transformServicesData(response.data, filters.chartType));
          break;
        case 'inventory':
          response = await reportsAPI.getInventoryReport();
          setReportData(transformInventoryData(response.data, filters.chartType));
          break;
        case 'employees':
          response = await reportsAPI.getEmployeesReport(apiParams);
          setReportData(transformEmployeesData(response.data, filters.chartType));
          break;
        case 'attendance':
          response = await reportsAPI.getAttendanceReport(apiParams);
          setReportData(transformAttendanceData(response.data, filters.chartType));
          break;
        case 'sales':
          response = await reportsAPI.getSalesReport(apiParams);
          setReportData(transformSalesData(response.data, filters.chartType));
          break;
        case 'payroll':
          response = await reportsAPI.getPayrollReport(apiParams);
          setReportData(transformPayrollData(response.data, filters.chartType));
          break;
        default:
          setReportData({ labels: [], datasets: [] });
      }
      clearError();
    } catch (err) {
      setError('Failed to load report data');
      console.error(err);
      setReportData({ labels: [], datasets: [] });
    } finally {
      setLoading(false);
    }
  };

  // Helper functions for date handling
  const getStartDate = (dateRange, customStart) => {
    if (dateRange === 'custom' && customStart) return customStart;
    
    const now = new Date();
    switch (dateRange) {
      case 'last7days':
        return new Date(now.setDate(now.getDate() - 7)).toISOString().split('T')[0];
      case 'last30days':
        return new Date(now.setDate(now.getDate() - 30)).toISOString().split('T')[0];
      case 'last3months':
        return new Date(now.setMonth(now.getMonth() - 3)).toISOString().split('T')[0];
      case 'last6months':
        return new Date(now.setMonth(now.getMonth() - 6)).toISOString().split('T')[0];
      case 'lastyear':
        return new Date(now.setFullYear(now.getFullYear() - 1)).toISOString().split('T')[0];
      default:
        return new Date(now.setDate(now.getDate() - 30)).toISOString().split('T')[0];
    }
  };

  const getEndDate = (dateRange, customEnd) => {
    if (dateRange === 'custom' && customEnd) return customEnd;
    return new Date().toISOString().split('T')[0];
  };

  const getPalette = (count, alpha = 0.5) =>
    Array.from({ length: Math.max(count, 1) }, (_, i) => `hsla(${Math.round((i * 360) / Math.max(count, 1))}, 70%, 55%, ${alpha})`);

  const transformAppointmentsData = (data, chartType) => ({
    labels: data.labels,
    datasets: [{
      label: 'Appointments',
      data: data.data,
      backgroundColor: chartType === 'pie' || chartType === 'doughnut' ? 
        data.data.map((_, i) => `hsl(${(i * 360) / data.data.length}, 70%, 60%)`) : 
        'rgba(59, 130, 246, 0.5)',
      borderColor: 'rgb(59, 130, 246)',
      borderWidth: 2
    }]
  });

  const transformRevenueData = (data, chartType) => ({
    labels: data.labels,
    datasets: [{
      label: 'Revenue ($)',
      data: data.data,
      backgroundColor: chartType === 'pie' || chartType === 'doughnut' ? 
        data.data.map((_, i) => `hsl(${(i * 360) / data.data.length}, 70%, 60%)`) : 
        'rgba(34, 197, 94, 0.5)',
      borderColor: 'rgb(34, 197, 94)',
      borderWidth: 2
    }]
  });

  const transformClientsData = (data, chartType) => ({
    labels: data.labels,
    datasets: [{
      label: 'Clients',
      data: data.data,
      backgroundColor: [
        'rgba(147, 51, 234, 0.5)',
        'rgba(59, 130, 246, 0.5)',
        'rgba(107, 114, 128, 0.5)'
      ],
      borderColor: [
        'rgb(147, 51, 234)',
        'rgb(59, 130, 246)',
        'rgb(107, 114, 128)'
      ],
      borderWidth: 2
    }]
  });

  const transformServicesData = (data, chartType) => ({
    labels: data.labels,
    datasets: [{
      label: 'Service Usage',
      data: data.data || [],
      backgroundColor: chartType === 'pie' || chartType === 'doughnut' ? 
        getPalette((data.labels || []).length) : 
        'rgba(251, 146, 60, 0.5)',
      borderColor: 'rgb(251, 146, 60)',
      borderWidth: 2
    }]
  });

  const transformInventoryData = (data, chartType) => ({
    labels: data.labels,
    datasets: [{
      label: 'Current Stock',
      data: data.data || [],
      backgroundColor: 'rgba(239, 68, 68, 0.5)',
      borderColor: 'rgb(239, 68, 68)',
      borderWidth: 2
    }]
  });

  const transformEmployeesData = (data, chartType) => ({
    labels: data.labels,
    datasets: [{
      label: 'Appointments',
      data: data.data || [],
      backgroundColor: 'rgba(99, 102, 241, 0.5)',
      borderColor: 'rgb(99, 102, 241)',
      borderWidth: 2
    }]
  });

  const transformAttendanceData = (data, chartType) => ({
    labels: data.labels,
    datasets: [{
      label: 'Attendance Records',
      data: data.data || [],
      backgroundColor: 'rgba(75, 85, 99, 0.5)',
      borderColor: 'rgb(75, 85, 99)',
      borderWidth: 2
    }]
  });

  const transformSalesData = (data, chartType) => ({
    labels: data.labels,
    datasets: [{
      label: 'Sales Total ($)',
      data: data.data || [],
      backgroundColor: 'rgba(16, 185, 129, 0.5)',
      borderColor: 'rgb(16, 185, 129)',
      borderWidth: 2
    }]
  });

  const transformPayrollData = (data, chartType) => ({
    labels: data.labels,
    datasets: [{
      label: 'Payroll Net ($)',
      data: data.data || [],
      backgroundColor: 'rgba(20, 184, 166, 0.5)',
      borderColor: 'rgb(20, 184, 166)',
      borderWidth: 2
    }]
  });

  useEffect(() => {
    if (accessibleReports.length > 0 && !selectedReportId) {
      setSelectedReportId(accessibleReports[0].id);
    }
  }, [accessibleReports, selectedReportId]);

  useEffect(() => {
    const loadOptions = async () => {
      try {
        const [empRes, svcRes] = await Promise.all([
          employeesAPI.getAll(),
          servicesAPI.getAll(),
        ]);
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
  }, [selectedReport?.id, reportFilters.dateRange, reportFilters.startDate, reportFilters.endDate, reportFilters.groupBy, reportFilters.chartType, reportFilters.status, reportFilters.employeeId, reportFilters.serviceId]);

  const canUseStatus = selectedReport?.id === 'appointments';
  const canUseService = ['appointments', 'services', 'revenue'].includes(selectedReport?.id || '');
  const canUseEmployee = ['appointments', 'employees', 'attendance'].includes(selectedReport?.id || '');

  const handleExportPdf = () => {
    if (!selectedReport) return;

    const reportEl = document.getElementById('report-export-section');
    if (!reportEl) return;

    const chartCanvas = reportEl.querySelector('canvas');
    const chartImg = chartCanvas ? chartCanvas.toDataURL('image/png') : '';

    const prettyRange = reportFilters.dateRange === 'custom'
      ? `${reportFilters.startDate || 'N/A'} to ${reportFilters.endDate || 'N/A'}`
      : reportFilters.dateRange;

    const printWindow = window.open('', '_blank', 'width=1000,height=800');
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
            <div><strong>Range:</strong> ${prettyRange}</div>
            <div><strong>Group:</strong> ${reportFilters.groupBy}</div>
            <div><strong>Chart:</strong> ${reportFilters.chartType}</div>
            <div><strong>Generated:</strong> ${new Date().toLocaleString()}</div>
          </div>
          <div class="chart-wrap">
            ${chartImg ? `<img src="${chartImg}" alt="${selectedReport.title}" />` : '<p>Chart preview unavailable.</p>'}
          </div>
          <div class="footer">${branding.companyName || 'Business Manager'}</div>
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  if (loading && !selectedReport) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div
      className="h-full flex flex-col reports-page"
      style={{ minHeight: 0 }}
    >
      <style>{`.reports-page::-webkit-scrollbar{display:none!important}`}</style>
      <div className="px-3 pt-3 pb-2 border-bottom border-gray-200 dark:border-gray-700">
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-1">Reports & Analytics</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Live reports powered by your current database data.</p>
        <div className="d-flex gap-1 flex-wrap">
          {accessibleReports.map((report) => (
            <button
              key={report.id}
              type="button"
              className={`btn btn-sm ${selectedReportId === report.id ? 'btn-primary' : 'btn-outline-secondary'} d-flex align-items-center gap-1`}
              onClick={() => handleReportSelect(report.id)}
            >
              <report.icon className="h-4 w-4" />
              <span>{report.title}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex-grow-1 overflow-auto p-3" style={{ minHeight: 0, scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        {error && (
          <div className="mb-3 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded">
            {error}
          </div>
        )}

        {!selectedReport ? (
          <div className="text-center py-12">
            <ChartBarIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No reports available</h3>
            <p className="mt-1 text-sm text-gray-500">You don't have permissions to view reports.</p>
          </div>
        ) : (
          <>
            <div className="d-flex align-items-center justify-content-between gap-2 mb-2">
              <div className="d-flex align-items-center gap-2">
                <selectedReport.icon className="h-5 w-5 text-primary-600" />
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-0">{selectedReport.title}</h2>
              </div>
              <Button_Toolbar
                icon={ArrowDownTrayIcon}
                label="Export PDF"
                onClick={handleExportPdf}
                className="btn-outline-secondary"
              />
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{selectedReport.description}</p>
            <div id="report-export-section" className="h-[60vh] min-h-[320px] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
              <Chart_Report
                data={reportData}
                type={reportFilters.chartType}
                title={selectedReport.title}
                loading={loading}
              />
            </div>

            <div className="mt-3 pt-2 border-top border-gray-200 dark:border-gray-700 d-flex flex-wrap align-items-center justify-content-between gap-2">
              <div className="d-flex align-items-center gap-2">
                {branding.logoUrl && <img src={branding.logoUrl} alt="logo" style={{ height: '1rem', objectFit: 'contain' }} />}
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">{branding.companyName || 'Business Manager'}</span>
              </div>
              <span className="text-xs text-gray-500 dark:text-gray-400">Generated {new Date().toLocaleDateString()}</span>
            </div>
          </>
        )}
      </div>

      {selectedReport && (
        <div className="flex-shrink-0 border-top border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-2 pb-4">
          <div className="d-flex flex-wrap align-items-center gap-2">
            <select
              className="form-select form-select-sm"
              style={{ width: 'auto' }}
              value={reportFilters.dateRange}
              onChange={(e) => setReportFilters((prev) => ({ ...prev, dateRange: e.target.value }))}
            >
              {DATE_RANGE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>

            {reportFilters.dateRange === 'custom' && (
              <>
                <input
                  type="date"
                  className="form-control form-control-sm"
                  style={{ width: 'auto' }}
                  value={reportFilters.startDate || ''}
                  onChange={(e) => setReportFilters((prev) => ({ ...prev, startDate: e.target.value }))}
                />
                <input
                  type="date"
                  className="form-control form-control-sm"
                  style={{ width: 'auto' }}
                  value={reportFilters.endDate || ''}
                  onChange={(e) => setReportFilters((prev) => ({ ...prev, endDate: e.target.value }))}
                />
              </>
            )}

            <select
              className="form-select form-select-sm"
              style={{ width: 'auto' }}
              value={reportFilters.groupBy}
              onChange={(e) => setReportFilters((prev) => ({ ...prev, groupBy: e.target.value }))}
            >
              {GROUP_BY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>

            <select
              className="form-select form-select-sm"
              style={{ width: 'auto' }}
              value={reportFilters.chartType}
              onChange={(e) => setReportFilters((prev) => ({ ...prev, chartType: e.target.value }))}
            >
              {selectedReport.chartTypes.map((chartType) => (
                <option key={chartType} value={chartType}>{chartType}</option>
              ))}
            </select>

            {canUseStatus && (
              <select
                className="form-select form-select-sm"
                style={{ width: 'auto' }}
                value={reportFilters.status}
                onChange={(e) => setReportFilters((prev) => ({ ...prev, status: e.target.value }))}
              >
                <option value="all">All Statuses</option>
                <option value="scheduled">Scheduled</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            )}

            {canUseService && (
              <select
                className="form-select form-select-sm"
                style={{ width: 'auto' }}
                value={reportFilters.serviceId}
                onChange={(e) => setReportFilters((prev) => ({ ...prev, serviceId: e.target.value }))}
              >
                <option value="all">All Services</option>
                {services.map((service) => (
                  <option key={service.id} value={service.id}>{service.name}</option>
                ))}
              </select>
            )}

            {canUseEmployee && (
              <select
                className="form-select form-select-sm"
                style={{ width: 'auto' }}
                value={reportFilters.employeeId}
                onChange={(e) => setReportFilters((prev) => ({ ...prev, employeeId: e.target.value }))}
              >
                <option value="all">All Employees</option>
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>{`${employee.first_name || ''} ${employee.last_name || ''}`.trim() || employee.username}</option>
                ))}
              </select>
            )}

            <button
              type="button"
              onClick={() => loadReportData(selectedReport.id, reportFilters)}
              className="btn btn-primary btn-sm d-flex align-items-center gap-1"
            >
              <ArrowPathIcon className="h-4 w-4" />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}