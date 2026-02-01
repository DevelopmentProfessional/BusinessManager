import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import {
  ChartBarIcon,
  CalendarIcon,
  UsersIcon,
  BanknotesIcon,
  TruckIcon,
  WrenchScrewdriverIcon,
  ArchiveBoxIcon,
  DocumentIcon,
  ClockIcon,
  EyeIcon,
  FunnelIcon,
  ArrowPathIcon,
  PlusIcon,
  TrashIcon,
  PencilIcon,
  TableCellsIcon,
  LinkIcon
} from '@heroicons/react/24/outline';
import useStore from '../services/useStore';
import { reportsAPI } from '../services/api';
import PermissionGate from './components/PermissionGate';
import Modal from './components/Modal';
import ReportChart from './components/ReportChart';
import ReportFilter from './components/ReportFilter';

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

export default function Reports() {
  const {
    loading, setLoading, error, setError, clearError,
    isModalOpen, modalContent, openModal, closeModal, hasPermission
  } = useStore();

  // Use the permission refresh hook

  // Check permissions at page level
  if (!hasPermission('reports', 'read') && 
      !hasPermission('schedule', 'read') &&
      !hasPermission('clients', 'read') &&
      !hasPermission('services', 'read')) {
    return <Navigate to="/profile" replace />;
  }

  const [selectedReport, setSelectedReport] = useState(null);
  const [reportData, setReportData] = useState(null);
  const [reportFilters, setReportFilters] = useState({
    dateRange: 'last30days',
    startDate: null,
    endDate: null,
    groupBy: 'day',
    chartType: 'line'
  });

  // Filter available reports based on user permissions
  const accessibleReports = AVAILABLE_REPORTS.filter(report => {
    return report.tables.some(table => {
      // Map table names to permission page names
      const pageMap = {
        'schedule': 'schedule',
        'clients': 'clients', 
        'services': 'services',
        'user': 'employees',
        'inventory': 'inventory',
        'item': 'inventory',
        'supplier': 'suppliers',
        'attendance': 'attendance'
      };
      const page = pageMap[table];
      return page && hasPermission(page, 'read');
    });
  });

  const handleReportSelect = (report) => {
    setSelectedReport(report);
    setReportFilters(prev => ({
      ...prev,
      chartType: report.chartTypes[0] // Default to first available chart type
    }));
    openModal('report-view');
  };

  const handleFilterChange = (newFilters) => {
    setReportFilters(newFilters);
    // Trigger data refresh when filters change
    if (selectedReport) {
      loadReportData(selectedReport.id, newFilters);
    }
  };

  const loadReportData = async (reportId, filters = reportFilters) => {
    setLoading(true);
    try {
      let response;
      const apiParams = {
        start_date: getStartDate(filters.dateRange, filters.startDate),
        end_date: getEndDate(filters.dateRange, filters.endDate),
        group_by: filters.groupBy,
        ...(filters.status && filters.status !== 'all' ? { status: filters.status } : {}),
        ...(filters.employeeId && filters.employeeId !== 'all' ? { employee_id: filters.employeeId } : {}),
        ...(filters.category && filters.category !== 'all' ? { service_id: filters.category } : {})
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
        default:
          // Fallback to mock data
          const mockData = generateMockReportData(reportId, filters);
          setReportData(mockData);
      }
      clearError();
    } catch (err) {
      setError('Failed to load report data');
      console.error(err);
      // Fallback to mock data on API error
      const mockData = generateMockReportData(reportId, filters);
      setReportData(mockData);
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

  // Data transformation functions
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
      data: data.usage_data,
      backgroundColor: chartType === 'pie' || chartType === 'doughnut' ? 
        data.labels.map((_, i) => `hsl(${(i * 360) / data.labels.length}, 70%, 60%)`) : 
        'rgba(251, 146, 60, 0.5)',
      borderColor: 'rgb(251, 146, 60)',
      borderWidth: 2
    }]
  });

  const transformInventoryData = (data, chartType) => ({
    labels: data.labels,
    datasets: [{
      label: 'Current Stock',
      data: data.quantities,
      backgroundColor: 'rgba(239, 68, 68, 0.5)',
      borderColor: 'rgb(239, 68, 68)',
      borderWidth: 2
    }, {
      label: 'Minimum Level',
      data: data.min_levels,
      backgroundColor: 'rgba(107, 114, 128, 0.3)',
      borderColor: 'rgb(107, 114, 128)',
      borderWidth: 1,
      borderDash: [5, 5]
    }]
  });

  const transformEmployeesData = (data, chartType) => ({
    labels: data.labels,
    datasets: [{
      label: 'Appointments',
      data: data.appointment_counts,
      backgroundColor: 'rgba(99, 102, 241, 0.5)',
      borderColor: 'rgb(99, 102, 241)',
      borderWidth: 2
    }]
  });

  // Mock data generator - replace with real API calls
  const generateMockReportData = (reportId, filters) => {
    const dataPoints = filters.groupBy === 'day' ? 30 : filters.groupBy === 'week' ? 12 : 6;
    const labels = Array.from({ length: dataPoints }, (_, i) => {
      if (filters.groupBy === 'day') return `Day ${i + 1}`;
      if (filters.groupBy === 'week') return `Week ${i + 1}`;
      return `Month ${i + 1}`;
    });

    switch (reportId) {
      case 'appointments':
        return {
          labels,
          datasets: [{
            label: 'Appointments',
            data: labels.map(() => Math.floor(Math.random() * 50) + 10),
            backgroundColor: 'rgba(59, 130, 246, 0.5)',
            borderColor: 'rgb(59, 130, 246)',
            borderWidth: 2
          }]
        };
      case 'revenue':
        return {
          labels,
          datasets: [{
            label: 'Revenue ($)',
            data: labels.map(() => Math.floor(Math.random() * 5000) + 1000),
            backgroundColor: 'rgba(34, 197, 94, 0.5)',
            borderColor: 'rgb(34, 197, 94)',
            borderWidth: 2
          }]
        };
      case 'clients':
        return {
          labels: ['New Clients', 'Returning Clients', 'Inactive Clients'],
          datasets: [{
            label: 'Client Status',
            data: [25, 45, 10],
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
        };
      default:
        return {
          labels,
          datasets: [{
            label: 'Data',
            data: labels.map(() => Math.floor(Math.random() * 100)),
            backgroundColor: 'rgba(107, 114, 128, 0.5)',
            borderColor: 'rgb(107, 114, 128)',
            borderWidth: 2
          }]
        };
    }
  };

  useEffect(() => {
    if (selectedReport && isModalOpen) {
      loadReportData(selectedReport.id);
    }
  }, [selectedReport, isModalOpen]);

  if (loading && !selectedReport) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-1">
      {/* Header */}
      <div className="mb-1">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Reports & Analytics</h1>
        <p className="text-gray-600">
          Generate insights from your business data with interactive charts and reports.
        </p>
      </div>

      {error && (
        <div className="mb-1 bg-red-50 border border-red-200 text-red-700 px-1 py-1 rounded">
          {error}
        </div>
      )}

      {/* Report Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-1">
        {accessibleReports.map((report) => (
          <div
            key={report.id}
            className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => handleReportSelect(report)}
          >
            <div className="p-1">
              <div className="flex items-center justify-between mb-1">
                <div className={`p-3 rounded-lg bg-${report.color}-100`}>
                  <report.icon className={`h-6 w-6 text-${report.color}-600`} />
                </div>
                <EyeIcon className="h-5 w-5 text-gray-400" />
              </div>
              
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {report.title}
              </h3>
              
              <p className="text-sm text-gray-600 mb-1">
                {report.description}
              </p>
              
              <div className="flex flex-wrap gap-1">
                {report.tables.map((table) => (
                  <span
                    key={table}
                    className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-700"
                  >
                    {table}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {accessibleReports.length === 0 && (
        <div className="text-center py-1">
          <ChartBarIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No reports available</h3>
          <p className="mt-1 text-sm text-gray-500">
            You don't have permissions to view any reports.
          </p>
        </div>
      )}

      {/* Report Modal */}
      <Modal 
        isOpen={isModalOpen && modalContent === 'report-view'} 
        onClose={() => {
          closeModal();
          setSelectedReport(null);
          setReportData(null);
        }}
      >
        {selectedReport && (
          <div className="p-1">
            {/* Modal Header */}
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1">
                <div className={`p-2 rounded-lg bg-${selectedReport.color}-100`}>
                  <selectedReport.icon className={`h-5 w-5 text-${selectedReport.color}-600`} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    {selectedReport.title}
                  </h2>
                  <p className="text-sm text-gray-600">
                    {selectedReport.description}
                  </p>
                </div>
              </div>
              <button
                onClick={() => loadReportData(selectedReport.id)}
                className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100"
                title="Refresh data"
              >
                <ArrowPathIcon className="h-5 w-5" />
              </button>
            </div>

            {/* Filters */}
            <ReportFilter
              filters={reportFilters}
              availableChartTypes={selectedReport.chartTypes}
              onFilterChange={handleFilterChange}
            />

            {/* Chart */}
            <div className="mt-1 h-96">
              {reportData ? (
                <ReportChart
                  data={reportData}
                  type={reportFilters.chartType}
                  title={selectedReport.title}
                  loading={loading}
                />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}