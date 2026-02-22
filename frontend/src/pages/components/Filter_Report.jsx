import React from 'react';
import { CalendarIcon, ChartBarIcon, FunnelIcon } from '@heroicons/react/24/outline';

const DATE_RANGE_OPTIONS = [
  { value: 'last7days', label: 'Last 7 Days' },
  { value: 'last30days', label: 'Last 30 Days' },
  { value: 'last3months', label: 'Last 3 Months' },
  { value: 'last6months', label: 'Last 6 Months' },
  { value: 'lastyear', label: 'Last Year' },
  { value: 'custom', label: 'Custom Range' }
];

const GROUP_BY_OPTIONS = [
  { value: 'day', label: 'Daily' },
  { value: 'week', label: 'Weekly' },
  { value: 'month', label: 'Monthly' },
  { value: 'quarter', label: 'Quarterly' }
];

const CHART_TYPE_ICONS = {
  line: '📈',
  bar: '📊',
  pie: '🥧',
  doughnut: '🍩',
  area: '📊'
};

const Filter_Report = ({ filters, availableChartTypes, onFilterChange }) => {
  const handleFilterUpdate = (key, value) => {
    const newFilters = { ...filters, [key]: value };
    onFilterChange(newFilters);
  };

  const handleDateRangeChange = (e) => {
    const value = e.target.value;
    handleFilterUpdate('dateRange', value);
    
    // Clear custom dates if not custom range
    if (value !== 'custom') {
      handleFilterUpdate('startDate', null);
      handleFilterUpdate('endDate', null);
    }
  };

  return (
    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-2 mb-4">
        <FunnelIcon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
        <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">Report Filters</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Date Range */}
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            <CalendarIcon className="h-3 w-3 inline mr-1" />
            Date Range
          </label>
          <select
            value={filters.dateRange}
            onChange={handleDateRangeChange}
            className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {DATE_RANGE_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* Custom Date Inputs */}
        {filters.dateRange === 'custom' && (
          <>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={filters.startDate || ''}
                onChange={(e) => handleFilterUpdate('startDate', e.target.value)}
                className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                End Date
              </label>
              <input
                type="date"
                value={filters.endDate || ''}
                onChange={(e) => handleFilterUpdate('endDate', e.target.value)}
                className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </>
        )}

        {/* Group By */}
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            Group By
          </label>
          <select
            value={filters.groupBy}
            onChange={(e) => handleFilterUpdate('groupBy', e.target.value)}
            className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {GROUP_BY_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* Chart Type */}
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            <ChartBarIcon className="h-3 w-3 inline mr-1" />
            Chart Type
          </label>
          <div className="flex gap-1">
            {availableChartTypes.map(chartType => (
              <button
                key={chartType}
                onClick={() => handleFilterUpdate('chartType', chartType)}
                className={`flex-1 text-xs px-2 py-2 rounded-md border transition-colors ${
                  filters.chartType === chartType
                    ? 'bg-blue-500 text-white border-blue-500'
                    : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
                }`}
                title={chartType.charAt(0).toUpperCase() + chartType.slice(1)}
              >
                <span className="block text-center">
                  {CHART_TYPE_ICONS[chartType] || '📊'}
                </span>
                <span className="block text-center capitalize mt-1">
                  {chartType}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Additional Filters Row */}
      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Status Filter (for appointment reports) */}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Status Filter
            </label>
            <select
              value={filters.status || 'all'}
              onChange={(e) => handleFilterUpdate('status', e.target.value)}
              className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Statuses</option>
              <option value="scheduled">Scheduled</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          {/* Service Category Filter */}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Service Category
            </label>
            <select
              value={filters.category || 'all'}
              onChange={(e) => handleFilterUpdate('category', e.target.value)}
              className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Categories</option>
              <option value="hair">Hair Services</option>
              <option value="nail">Nail Services</option>
              <option value="beauty">Beauty Services</option>
              <option value="spa">Spa Services</option>
            </select>
          </div>

          {/* Employee Filter */}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Employee
            </label>
            <select
              value={filters.employeeId || 'all'}
              onChange={(e) => handleFilterUpdate('employeeId', e.target.value)}
              className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Employees</option>
              {/* These would be populated from actual employee data */}
              <option value="emp1">Employee 1</option>
              <option value="emp2">Employee 2</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Filter_Report;