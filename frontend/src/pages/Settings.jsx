import React, { useState, useEffect, useRef } from 'react';
import {
  CogIcon,
  BellIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  CircleStackIcon,
  SwatchIcon,
  ClockIcon,
  QuestionMarkCircleIcon,
  ArrowUpTrayIcon,
  TableCellsIcon,
  DocumentTextIcon,
  ChevronDownIcon,
  InformationCircleIcon,
  ShieldCheckIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { settingsAPI, schemaAPI, insurancePlansAPI } from '../services/api';
import Manager_DatabaseConnection from './components/Manager_DatabaseConnection';
import useBranding from '../services/useBranding';

export default function Settings() {
  const [activeTab, setActiveTab] = useState('schedule');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Branding settings from global hook
  const { branding, updateBranding, resetBranding, DEFAULT_BRANDING } = useBranding();

  // Local branding state for form editing (synced with global branding)
  const [localBranding, setLocalBranding] = useState(branding);

  // Sync local branding when global branding changes
  useEffect(() => {
    setLocalBranding(branding);
  }, [branding]);

  // Database/Connection settings state
  const [dbSettings, setDbSettings] = useState({
    connectionString: '',
    apiBaseUrl: '',
    onlyofficeUrl: ''
  });

  // Schedule settings state
  const [scheduleSettings, setScheduleSettings] = useState({
    start_of_day: '06:00',
    end_of_day: '21:00',
    attendance_check_in_required: true,
    monday_enabled: true,
    tuesday_enabled: true,
    wednesday_enabled: true,
    thursday_enabled: true,
    friday_enabled: true,
    saturday_enabled: true,
    sunday_enabled: true
  });
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [activeTooltip, setActiveTooltip] = useState(null);

  // Insurance Plans state
  const [insurancePlans, setInsurancePlans] = useState([]);
  const [insurancePlansLoading, setInsurancePlansLoading] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [newPlan, setNewPlan] = useState({ name: '', description: '', is_active: true });

  // Accordion state for General settings sections
  const [openAccordions, setOpenAccordions] = useState({
    application: true,
    branding: false,
    notifications: false
  });

  const toggleAccordion = (id) => {
    setOpenAccordions(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Import state
  const [availableTables, setAvailableTables] = useState([]);
  const [selectedTable, setSelectedTable] = useState('');
  const [tableColumns, setTableColumns] = useState([]);
  const [csvData, setCsvData] = useState(null);
  const [csvHeaders, setCsvHeaders] = useState([]);
  const [columnMapping, setColumnMapping] = useState({});
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const fileInputRef = useRef(null);

  // Notification settings state
  const [notifications, setNotifications] = useState({
    emailEnabled: true,
    pushEnabled: false,
    appointmentReminders: true,
    dailyDigest: false
  });

  // Help tooltip component
  const HelpIcon = ({ id, text }) => (
    <div className="relative inline-block ml-1">
      <QuestionMarkCircleIcon
        className="h-4 w-4 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 cursor-help transition-colors"
        onClick={() => setActiveTooltip(activeTooltip === id ? null : id)}
        onMouseEnter={() => setActiveTooltip(id)}
        onMouseLeave={() => setActiveTooltip(null)}
      />
      {activeTooltip === id && (
        <div className="absolute z-10 bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 text-xs text-white bg-gray-800 dark:bg-gray-700 rounded-lg shadow-lg max-w-xs text-center">
          {text}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800 dark:border-t-gray-700"></div>
        </div>
      )}
    </div>
  );

  // Load saved settings from localStorage on mount
  // Note: Branding is now handled by useBranding hook
  useEffect(() => {
    const savedDbSettings = localStorage.getItem('app_db_settings');
    if (savedDbSettings) {
      try {
        setDbSettings(JSON.parse(savedDbSettings));
      } catch (e) {
        console.warn('Failed to parse saved db settings');
      }
    } else {
      setDbSettings({
        connectionString: '',
        apiBaseUrl: import.meta.env.VITE_API_URL || '',
        onlyofficeUrl: import.meta.env.VITE_ONLYOFFICE_URL || ''
      });
    }

    const savedNotifications = localStorage.getItem('app_notifications');
    if (savedNotifications) {
      try {
        setNotifications(JSON.parse(savedNotifications));
      } catch (e) {
        console.warn('Failed to parse saved notification settings');
      }
    }

    // Load schedule settings from backend
    const loadScheduleSettings = async () => {
      try {
        const response = await settingsAPI.getScheduleSettings();
        if (response.data) {
          setScheduleSettings({
            start_of_day: response.data.start_of_day || '06:00',
            end_of_day: response.data.end_of_day || '21:00',
            attendance_check_in_required: response.data.attendance_check_in_required ?? true,
            monday_enabled: response.data.monday_enabled ?? true,
            tuesday_enabled: response.data.tuesday_enabled ?? true,
            wednesday_enabled: response.data.wednesday_enabled ?? true,
            thursday_enabled: response.data.thursday_enabled ?? true,
            friday_enabled: response.data.friday_enabled ?? true,
            saturday_enabled: response.data.saturday_enabled ?? true,
            sunday_enabled: response.data.sunday_enabled ?? true
          });
        }
      } catch (err) {
        console.warn('Failed to load schedule settings:', err);
      }
    };
    loadScheduleSettings();
  }, []);

  // Load available tables when database tab is active
  useEffect(() => {
    if (activeTab === 'database' && availableTables.length === 0) {
      loadTables();
    }
  }, [activeTab]);

  // Load table columns when a table is selected
  useEffect(() => {
    if (selectedTable) {
      loadTableColumns(selectedTable);
    }
  }, [selectedTable]);

  const loadTables = async () => {
    try {
      const response = await schemaAPI.getTables();
      setAvailableTables(response.data || []);
    } catch (err) {
      console.warn('Failed to load tables:', err);
    }
  };

  const loadTableColumns = async (tableName) => {
    try {
      const response = await schemaAPI.getTableColumns(tableName);
      setTableColumns(response.data || []);
      // Reset mapping when table changes
      setColumnMapping({});
      setCsvData(null);
      setCsvHeaders([]);
      setImportResult(null);
    } catch (err) {
      console.warn('Failed to load table columns:', err);
      setTableColumns([]);
    }
  };

  const handleSaveBranding = () => {
    // Update global branding state (this also persists to localStorage and applies CSS)
    updateBranding(localBranding);
    setSuccess('Branding settings saved and applied throughout the application!');
    setTimeout(() => setSuccess(''), 3000);
  };

  const handleSaveDbSettings = () => {
    localStorage.setItem('app_db_settings', JSON.stringify(dbSettings));
    setSuccess('Connection settings saved! Some changes may require a page refresh.');
    setTimeout(() => setSuccess(''), 3000);
  };

  const handleSaveNotifications = () => {
    localStorage.setItem('app_notifications', JSON.stringify(notifications));
    setSuccess('Notification settings saved!');
    setTimeout(() => setSuccess(''), 3000);
  };

  const handleScheduleSettingsChange = (field, value) => {
    setScheduleSettings(prev => ({ ...prev, [field]: value }));
  };

  const handleSaveScheduleSettings = async () => {
    setScheduleLoading(true);
    setError('');
    setSuccess('');
    try {
      await settingsAPI.updateScheduleSettings(scheduleSettings);
      setSuccess('Schedule settings saved successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save schedule settings');
    } finally {
      setScheduleLoading(false);
    }
  };

  const handleBrandingChange = (field, value) => {
    setLocalBranding(prev => ({ ...prev, [field]: value }));
  };

  const handleDbSettingsChange = (field, value) => {
    setDbSettings(prev => ({ ...prev, [field]: value }));
  };

  const handleNotificationChange = (field, value) => {
    setNotifications(prev => ({ ...prev, [field]: value }));
  };

  // CSV Import Functions
  const parseCSV = (text) => {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length < 2) return { headers: [], data: [] };

    // Parse headers (first row)
    const headers = parseCSVLine(lines[0]);
    
    // Parse data rows
    const data = [];
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      if (values.length === headers.length) {
        const row = {};
        headers.forEach((header, idx) => {
          row[header] = values[idx];
        });
        data.push(row);
      }
    }

    return { headers, data };
  };

  const parseCSVLine = (line) => {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    
    return result;
  };

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      const { headers, data } = parseCSV(text);
      
      setCsvHeaders(headers);
      setCsvData(data);
      
      // Auto-map columns that match exactly
      const autoMapping = {};
      headers.forEach(header => {
        const normalizedHeader = header.toLowerCase().replace(/\s+/g, '_');
        const matchingColumn = tableColumns.find(
          col => col.name.toLowerCase() === normalizedHeader || 
                 col.display_name.toLowerCase() === header.toLowerCase()
        );
        if (matchingColumn) {
          autoMapping[header] = matchingColumn.name;
        }
      });
      setColumnMapping(autoMapping);
      setImportResult(null);
    };
    reader.readAsText(file);
  };

  const handleColumnMappingChange = (csvHeader, dbColumn) => {
    setColumnMapping(prev => ({
      ...prev,
      [csvHeader]: dbColumn || undefined
    }));
  };

  const handleImport = async () => {
    if (!csvData || csvData.length === 0) {
      setError('No data to import');
      return;
    }

    setImportLoading(true);
    setError('');
    setImportResult(null);

    try {
      // Transform data using column mapping
      const transformedData = csvData.map(row => {
        const newRow = {};
        Object.entries(columnMapping).forEach(([csvHeader, dbColumn]) => {
          if (dbColumn && row[csvHeader] !== undefined) {
            newRow[dbColumn] = row[csvHeader];
          }
        });
        return newRow;
      }).filter(row => Object.keys(row).length > 0);

      const response = await schemaAPI.bulkImport(selectedTable, transformedData);
      setImportResult(response.data);
      
      if (response.data.imported > 0) {
        setSuccess(`Successfully imported ${response.data.imported} records!`);
        setTimeout(() => setSuccess(''), 5000);
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Import failed');
    } finally {
      setImportLoading(false);
    }
  };

  const resetImport = () => {
    setCsvData(null);
    setCsvHeaders([]);
    setColumnMapping({});
    setImportResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const loadInsurancePlans = async () => {
    setInsurancePlansLoading(true);
    try {
      const res = await insurancePlansAPI.getAll();
      setInsurancePlans(res?.data ?? res ?? []);
    } catch (err) {
      setError('Failed to load insurance plans');
    } finally {
      setInsurancePlansLoading(false);
    }
  };

  const handleInsurancePlanSave = async (e) => {
    e.preventDefault();
    try {
      if (editingPlan?.id) {
        const res = await insurancePlansAPI.update(editingPlan.id, editingPlan);
        setInsurancePlans(prev => prev.map(p => p.id === editingPlan.id ? (res?.data ?? res) : p));
        setEditingPlan(null);
      } else {
        const res = await insurancePlansAPI.create(newPlan);
        setInsurancePlans(prev => [...prev, res?.data ?? res]);
        setNewPlan({ name: '', description: '', is_active: true });
      }
      setSuccess('Insurance plan saved');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save plan');
    }
  };

  const handleInsurancePlanDelete = async (id) => {
    if (!window.confirm('Delete this insurance plan?')) return;
    try {
      await insurancePlansAPI.delete(id);
      setInsurancePlans(prev => prev.filter(p => p.id !== id));
    } catch (err) {
      setError('Failed to delete plan');
    }
  };

  const handleInsurancePlanToggle = async (plan) => {
    try {
      const res = await insurancePlansAPI.update(plan.id, { is_active: !plan.is_active });
      setInsurancePlans(prev => prev.map(p => p.id === plan.id ? (res?.data ?? res) : p));
    } catch (err) {
      setError('Failed to update plan');
    }
  };

  // Load insurance plans when tab becomes active
  useEffect(() => {
    if (activeTab === 'insurance' && insurancePlans.length === 0) {
      loadInsurancePlans();
    }
  }, [activeTab]);

  const tabs = [
    { id: 'schedule', name: 'Schedule', icon: ClockIcon },
    { id: 'general', name: 'General', icon: CogIcon },
    { id: 'database', name: 'Database', icon: CircleStackIcon },
    { id: 'insurance', name: 'Insurance', icon: ShieldCheckIcon },
  ];

  return (
    <div className="min-h-screen flex flex-col pb-20">
      {/* Main Content Area */}
      <div className="flex-1 min-h-0 overflow-auto p-3 sm:p-4 flex flex-col">
        <div className="mt-auto w-full">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6 w-100">
            <div className="w-full max-w-3xl mx-auto">
          {/* Schedule Settings */}
          {activeTab === 'schedule' && (
            <div>
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white mb-4 sm:mb-6 flex items-center gap-2">
                <ClockIcon className="h-5 w-5 sm:h-6 sm:w-6" />
                Schedule Settings
              </h2>

              {/* Business Hours */}
              <div className="mb-6">
                <h3 className="text-base sm:text-lg font-medium text-gray-900 dark:text-white mb-3 sm:mb-4 flex items-center">
                  Business Hours
                  <HelpIcon id="business-hours" text="Set the visible time range for your schedule calendar" />
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="form-floating">
                    <input
                      type="time"
                      id="start_of_day"
                      value={scheduleSettings.start_of_day}
                      onChange={(e) => handleScheduleSettingsChange('start_of_day', e.target.value)}
                      className="form-control form-control-sm"
                      placeholder="Start of Day"
                    />
                    <label htmlFor="start_of_day">Start of Day</label>
                  </div>
                  <div className="form-floating">
                    <input
                      type="time"
                      id="end_of_day"
                      value={scheduleSettings.end_of_day}
                      onChange={(e) => handleScheduleSettingsChange('end_of_day', e.target.value)}
                      className="form-control form-control-sm"
                      placeholder="End of Day"
                    />
                    <label htmlFor="end_of_day">End of Day</label>
                  </div>
                </div>
              </div>

              {/* Days of Operation */}
              <div className="mb-6">
                <h3 className="text-base sm:text-lg font-medium text-gray-900 dark:text-white mb-3 sm:mb-4 flex items-center">
                  Days of Operation
                  <HelpIcon id="days-of-operation" text="Select which days your business operates. Unchecked days will not appear in the schedule calendar." />
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
                  {[
                    { key: 'monday_enabled', label: 'Mon', fullLabel: 'Monday' },
                    { key: 'tuesday_enabled', label: 'Tue', fullLabel: 'Tuesday' },
                    { key: 'wednesday_enabled', label: 'Wed', fullLabel: 'Wednesday' },
                    { key: 'thursday_enabled', label: 'Thu', fullLabel: 'Thursday' },
                    { key: 'friday_enabled', label: 'Fri', fullLabel: 'Friday' },
                    { key: 'saturday_enabled', label: 'Sat', fullLabel: 'Saturday' },
                    { key: 'sunday_enabled', label: 'Sun', fullLabel: 'Sunday' }
                  ].map(day => (
                    <div key={day.key} className="flex items-center p-2 sm:p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                      <input
                        type="checkbox"
                        id={day.key}
                        checked={scheduleSettings[day.key]}
                        onChange={(e) => handleScheduleSettingsChange(day.key, e.target.checked)}
                        className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                      />
                      <label htmlFor={day.key} className="ml-2 text-xs sm:text-sm font-medium text-gray-900 dark:text-white cursor-pointer">
                        <span className="hidden sm:inline">{day.fullLabel}</span>
                        <span className="sm:hidden">{day.label}</span>
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Attendance Settings */}
              <div className="mb-6">
                <h3 className="text-base sm:text-lg font-medium text-gray-900 dark:text-white mb-3 sm:mb-4 flex items-center">
                  Attendance
                  <HelpIcon id="attendance-section" text="Configure employee clock in/out tracking" />
                </h3>
                <div className="flex items-center justify-between p-3 sm:p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                  <div className="flex items-center min-w-0">
                    <span className="text-sm font-medium text-gray-900 dark:text-white truncate">Attendance Check-in</span>
                    <HelpIcon id="attendance" text="Show clock in/out widget on Schedule page" />
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer flex-shrink-0 ml-2">
                    <input
                      type="checkbox"
                      checked={scheduleSettings.attendance_check_in_required}
                      onChange={(e) => handleScheduleSettingsChange('attendance_check_in_required', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"></div>
                  </label>
                </div>
              </div>

              <button
                onClick={handleSaveScheduleSettings}
                disabled={scheduleLoading}
                className="w-full sm:w-auto px-6 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-400 text-white rounded-full transition-colors disabled:cursor-not-allowed text-sm sm:text-base"
              >
                {scheduleLoading ? 'Saving...' : 'Save'}
              </button>

              {/* Messages */}
              {error && (
                <div className="mt-4 p-3 sm:p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <div className="flex items-center gap-2 text-red-800 dark:text-red-300">
                    <ExclamationTriangleIcon className="h-5 w-5 flex-shrink-0" />
                    <span className="text-sm">{error}</span>
                  </div>
                </div>
              )}

              {success && (
                <div className="mt-4 p-3 sm:p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                  <div className="flex items-center gap-2 text-green-800 dark:text-green-300">
                    <CheckCircleIcon className="h-5 w-5 flex-shrink-0" />
                    <span className="text-sm">{success}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* General Settings (includes Branding & Notifications) - Accordion Layout */}
          {activeTab === 'general' && (
            <div className="space-y-4">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <CogIcon className="h-5 w-5 sm:h-6 sm:w-6" />
                General Settings
              </h2>

              {/* Application Info Accordion */}
              <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
                <button
                  onClick={() => toggleAccordion('application')}
                  className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors rounded-full"
                >
                  <div className="flex items-center gap-2">
                    <InformationCircleIcon className="h-5 w-5 text-primary-500" />
                    <span className="font-medium text-gray-900 dark:text-white">Application</span>
                  </div>
                  <ChevronDownIcon className={`h-5 w-5 text-gray-500 transition-transform duration-200 ${openAccordions.application ? 'rotate-180' : ''}`} />
                </button>
                {openAccordions.application && (
                  <div className="p-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                        <span className="text-sm font-medium text-gray-900 dark:text-white">Version</span>
                        <span className="text-sm text-gray-600 dark:text-gray-400">1.0.0</span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                        <span className="text-sm font-medium text-gray-900 dark:text-white">Environment</span>
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          {import.meta.env.DEV ? 'Development' : 'Production'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Branding Accordion */}
              <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
                <button
                  onClick={() => toggleAccordion('branding')}
                  className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors rounded-full"
                >
                  <div className="flex items-center gap-2">
                    <SwatchIcon className="h-5 w-5 text-purple-500" />
                    <span className="font-medium text-gray-900 dark:text-white">Branding</span>
                  </div>
                  <ChevronDownIcon className={`h-5 w-5 text-gray-500 transition-transform duration-200 ${openAccordions.branding ? 'rotate-180' : ''}`} />
                </button>
                {openAccordions.branding && (
                  <div className="p-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
                    <div className="space-y-4">
                      {/* Company Name & Tagline */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="form-floating">
                          <input
                            type="text"
                            id="companyName"
                            value={localBranding.companyName}
                            onChange={(e) => handleBrandingChange('companyName', e.target.value)}
                            className="form-control form-control-sm"
                            placeholder="Company Name"
                          />
                          <label htmlFor="companyName">Company Name</label>
                        </div>
                        <div className="form-floating">
                          <input
                            type="text"
                            id="tagline"
                            value={localBranding.tagline}
                            onChange={(e) => handleBrandingChange('tagline', e.target.value)}
                            className="form-control form-control-sm"
                            placeholder="Tagline"
                          />
                          <label htmlFor="tagline">Tagline</label>
                        </div>
                      </div>

                      {/* Logo URL */}
                      <div className="form-floating">
                        <input
                          type="url"
                          id="logoUrl"
                          value={localBranding.logoUrl}
                          onChange={(e) => handleBrandingChange('logoUrl', e.target.value)}
                          className="form-control form-control-sm"
                          placeholder="Logo URL"
                        />
                        <label htmlFor="logoUrl">Logo URL</label>
                      </div>

                      {/* Color Pickers - Responsive Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                          <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Primary
                            <HelpIcon id="primary-color" text="Main buttons and links" />
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={localBranding.primaryColor}
                              onChange={(e) => handleBrandingChange('primaryColor', e.target.value)}
                              className="w-10 h-10 rounded border border-gray-300 cursor-pointer flex-shrink-0"
                            />
                            <input
                              type="text"
                              value={localBranding.primaryColor}
                              onChange={(e) => handleBrandingChange('primaryColor', e.target.value)}
                              className="flex-1 min-w-0 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono text-xs sm:text-sm"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Secondary
                            <HelpIcon id="secondary-color" text="Success states and highlights" />
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={localBranding.secondaryColor}
                              onChange={(e) => handleBrandingChange('secondaryColor', e.target.value)}
                              className="w-10 h-10 rounded border border-gray-300 cursor-pointer flex-shrink-0"
                            />
                            <input
                              type="text"
                              value={localBranding.secondaryColor}
                              onChange={(e) => handleBrandingChange('secondaryColor', e.target.value)}
                              className="flex-1 min-w-0 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono text-xs sm:text-sm"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Accent
                            <HelpIcon id="accent-color" text="Special elements and badges" />
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={localBranding.accentColor}
                              onChange={(e) => handleBrandingChange('accentColor', e.target.value)}
                              className="w-10 h-10 rounded border border-gray-300 cursor-pointer flex-shrink-0"
                            />
                            <input
                              type="text"
                              value={localBranding.accentColor}
                              onChange={(e) => handleBrandingChange('accentColor', e.target.value)}
                              className="flex-1 min-w-0 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono text-xs sm:text-sm"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Live Preview */}
                      <div className="p-4 bg-gray-100 dark:bg-gray-900 rounded-lg">
                        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Live Preview</h4>
                        <div className="flex flex-wrap gap-2">
                          <button
                            style={{ backgroundColor: localBranding.primaryColor }}
                            className="px-4 py-2 text-white rounded-full text-sm font-medium shadow-sm"
                          >
                            Primary Button
                          </button>
                          <button
                            style={{ backgroundColor: localBranding.secondaryColor }}
                            className="px-4 py-2 text-white rounded-full text-sm font-medium shadow-sm"
                          >
                            Secondary Button
                          </button>
                          <button
                            style={{ backgroundColor: localBranding.accentColor }}
                            className="px-4 py-2 text-white rounded-full text-sm font-medium shadow-sm"
                          >
                            Accent Button
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-2 mt-3">
                          <span
                            style={{ backgroundColor: `${localBranding.primaryColor}20`, color: localBranding.primaryColor }}
                            className="px-2.5 py-0.5 rounded-full text-xs font-medium"
                          >
                            Primary Badge
                          </span>
                          <span
                            style={{ backgroundColor: `${localBranding.secondaryColor}20`, color: localBranding.secondaryColor }}
                            className="px-2.5 py-0.5 rounded-full text-xs font-medium"
                          >
                            Secondary Badge
                          </span>
                          <span
                            style={{ backgroundColor: `${localBranding.accentColor}20`, color: localBranding.accentColor }}
                            className="px-2.5 py-0.5 rounded-full text-xs font-medium"
                          >
                            Accent Badge
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={handleSaveBranding}
                        className="w-full sm:w-auto px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-full transition-colors text-sm"
                      >
                        Save Branding
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Notifications Accordion */}
              <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
                <button
                  onClick={() => toggleAccordion('notifications')}
                  className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors rounded-full"
                >
                  <div className="flex items-center gap-2">
                    <BellIcon className="h-5 w-5 text-amber-500" />
                    <span className="font-medium text-gray-900 dark:text-white">Notifications</span>
                  </div>
                  <ChevronDownIcon className={`h-5 w-5 text-gray-500 transition-transform duration-200 ${openAccordions.notifications ? 'rotate-180' : ''}`} />
                </button>
                {openAccordions.notifications && (
                  <div className="p-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                        <div className="flex items-center min-w-0">
                          <span className="text-sm font-medium text-gray-900 dark:text-white truncate">Email Notifications</span>
                          <HelpIcon id="email-notif" text="Receive updates via email" />
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer flex-shrink-0 ml-2">
                          <input
                            type="checkbox"
                            checked={notifications.emailEnabled}
                            onChange={(e) => handleNotificationChange('emailEnabled', e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"></div>
                        </label>
                      </div>

                      <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                        <div className="flex items-center min-w-0">
                          <span className="text-sm font-medium text-gray-900 dark:text-white truncate">Appointment Reminders</span>
                          <HelpIcon id="appt-reminders" text="Get reminded before appointments" />
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer flex-shrink-0 ml-2">
                          <input
                            type="checkbox"
                            checked={notifications.appointmentReminders}
                            onChange={(e) => handleNotificationChange('appointmentReminders', e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"></div>
                        </label>
                      </div>

                      <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                        <div className="flex items-center min-w-0">
                          <span className="text-sm font-medium text-gray-900 dark:text-white truncate">Daily Digest</span>
                          <HelpIcon id="daily-digest" text="Receive a daily summary email" />
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer flex-shrink-0 ml-2">
                          <input
                            type="checkbox"
                            checked={notifications.dailyDigest}
                            onChange={(e) => handleNotificationChange('dailyDigest', e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"></div>
                        </label>
                      </div>

                      <button
                        onClick={handleSaveNotifications}
                        className="w-full sm:w-auto mt-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-full transition-colors text-sm"
                      >
                        Save Notifications
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Success Message */}
              {success && (
                <div className="p-3 sm:p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                  <div className="flex items-center gap-2 text-green-800 dark:text-green-300">
                    <CheckCircleIcon className="h-5 w-5 flex-shrink-0" />
                    <span className="text-sm">{success}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Database Settings */}
          {activeTab === 'database' && (
            <div>
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white mb-4 sm:mb-6 flex items-center gap-2">
                <CircleStackIcon className="h-5 w-5 sm:h-6 sm:w-6" />
                Database Settings
              </h2>

              {/* Database Connection Manager */}
              <div className="mb-6 sm:mb-8">
                <Manager_DatabaseConnection />
              </div>

              {/* Data Import Section */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-4 sm:pt-6">
                <h3 className="text-base sm:text-lg font-medium text-gray-900 dark:text-white mb-3 sm:mb-4 flex items-center">
                  <ArrowUpTrayIcon className="h-5 w-5 mr-2" />
                  Data Import
                  <HelpIcon id="data-import" text="Import data from CSV files into database tables" />
                </h3>

                {/* Table Selection */}
                <div className="mb-4">
                  <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Select Table
                    <HelpIcon id="select-table" text="Choose which database table to import data into" />
                  </label>
                  <select
                    value={selectedTable}
                    onChange={(e) => setSelectedTable(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 text-sm"
                  >
                    <option value="">-- Select a table --</option>
                    {availableTables.map(table => (
                      <option key={table.name} value={table.name}>
                        {table.display_name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Table Columns Display */}
                {selectedTable && tableColumns.length > 0 && (
                  <div className="mb-4 p-3 sm:p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center">
                      <TableCellsIcon className="h-4 w-4 mr-1" />
                      Table Columns
                    </h4>
                    <div className="flex flex-wrap gap-1.5 sm:gap-2">
                      {tableColumns.filter(col => !col.auto_generated).map(col => (
                        <span
                          key={col.name}
                          className={`px-2 py-1 text-xs rounded ${
                            col.required
                              ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                              : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                          }`}
                          title={`Type: ${col.type}${col.required ? ' (Required)' : ''}`}
                        >
                          {col.display_name}
                        </span>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                      <span className="inline-block w-3 h-3 bg-red-100 dark:bg-red-900/30 rounded mr-1"></span>Required fields
                    </p>
                  </div>
                )}

                {/* CSV File Upload */}
                {selectedTable && (
                  <div className="mb-4">
                    <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Upload CSV File
                      <HelpIcon id="csv-upload" text="First row should contain column headers" />
                    </label>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".csv"
                        onChange={handleFileSelect}
                        className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 text-sm file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs sm:file:text-sm file:bg-primary-50 file:text-primary-700 dark:file:bg-primary-900/30 dark:file:text-primary-300"
                      />
                      {csvData && (
                        <button
                          onClick={resetImport}
                          className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border border-gray-300 dark:border-gray-600 rounded-full sm:border-0"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Column Mapping */}
                {csvData && csvHeaders.length > 0 && (
                  <div className="mb-4 p-3 sm:p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center">
                      <DocumentTextIcon className="h-4 w-4 mr-1" />
                      Column Mapping
                      <HelpIcon id="column-mapping" text="Match CSV columns to database columns" />
                    </h4>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {csvHeaders.map(header => (
                        <div key={header} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                          <span className="sm:w-1/3 text-xs sm:text-sm text-gray-700 dark:text-gray-300 truncate font-medium sm:font-normal" title={header}>
                            {header}
                          </span>
                          <span className="hidden sm:block text-gray-400">→</span>
                          <select
                            value={columnMapping[header] || ''}
                            onChange={(e) => handleColumnMappingChange(header, e.target.value)}
                            className="flex-1 px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          >
                            <option value="">-- Skip --</option>
                            {tableColumns.filter(col => !col.auto_generated).map(col => (
                              <option key={col.name} value={col.name}>
                                {col.display_name}
                              </option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                      {csvData.length} rows found in CSV
                    </p>
                  </div>
                )}

                {/* Import Button */}
                {csvData && Object.keys(columnMapping).filter(k => columnMapping[k]).length > 0 && (
                  <button
                    onClick={handleImport}
                    disabled={importLoading}
                    className="w-full sm:w-auto px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-full transition-colors text-sm flex items-center justify-center gap-2"
                  >
                    <ArrowUpTrayIcon className="h-4 w-4" />
                    {importLoading ? 'Importing...' : `Import ${csvData.length} Records`}
                  </button>
                )}

                {/* Import Result */}
                {importResult && (
                  <div className={`mt-4 p-3 sm:p-4 rounded-lg ${
                    importResult.errors?.length > 0
                      ? 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800'
                      : 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                  }`}>
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircleIcon className={`h-5 w-5 flex-shrink-0 ${
                        importResult.errors?.length > 0
                          ? 'text-yellow-600 dark:text-yellow-400'
                          : 'text-green-600 dark:text-green-400'
                      }`} />
                      <span className={`text-sm ${
                        importResult.errors?.length > 0
                          ? 'text-yellow-800 dark:text-yellow-300'
                          : 'text-green-800 dark:text-green-300'
                      }`}>
                        Imported {importResult.imported} of {importResult.total} records
                      </span>
                    </div>
                    {importResult.errors?.length > 0 && (
                      <div className="text-xs text-yellow-700 dark:text-yellow-400 mt-2">
                        <p className="font-medium mb-1">Errors:</p>
                        <ul className="list-disc list-inside space-y-1">
                          {importResult.errors.slice(0, 5).map((err, idx) => (
                            <li key={idx}>Row {err.row}: {err.error}</li>
                          ))}
                          {importResult.errors.length > 5 && (
                            <li>...and {importResult.errors.length - 5} more errors</li>
                          )}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {success && !importResult && (
                <div className="mt-4 p-3 sm:p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                  <div className="flex items-center gap-2 text-green-800 dark:text-green-300">
                    <CheckCircleIcon className="h-5 w-5 flex-shrink-0" />
                    <span className="text-sm">{success}</span>
                  </div>
                </div>
              )}

              {error && (
                <div className="mt-4 p-3 sm:p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <div className="flex items-center gap-2 text-red-800 dark:text-red-300">
                    <ExclamationTriangleIcon className="h-5 w-5 flex-shrink-0" />
                    <span className="text-sm">{error}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Insurance Plans */}
          {activeTab === 'insurance' && (
            <div>
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <ShieldCheckIcon className="h-5 w-5 sm:h-6 sm:w-6" />
                Insurance Plans
              </h2>

              {success && (
                <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg text-green-800 dark:text-green-300 text-sm">
                  {success}
                </div>
              )}
              {error && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg text-red-800 dark:text-red-300 text-sm">
                  {error}
                </div>
              )}

              {/* Add new plan form */}
              <div className="mb-6 p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                  {editingPlan ? 'Edit Plan' : 'Add New Plan'}
                </h3>
                <form onSubmit={handleInsurancePlanSave} className="flex flex-col gap-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="form-floating">
                      <input
                        type="text"
                        id="planName"
                        className="form-control form-control-sm"
                        placeholder="Plan name"
                        value={editingPlan ? editingPlan.name : newPlan.name}
                        onChange={e => editingPlan
                          ? setEditingPlan(prev => ({ ...prev, name: e.target.value }))
                          : setNewPlan(prev => ({ ...prev, name: e.target.value }))}
                        required
                      />
                      <label htmlFor="planName">Plan Name</label>
                    </div>
                    <div className="form-floating">
                      <input
                        type="text"
                        id="planDescription"
                        className="form-control form-control-sm"
                        placeholder="Description"
                        value={editingPlan ? (editingPlan.description || '') : newPlan.description}
                        onChange={e => editingPlan
                          ? setEditingPlan(prev => ({ ...prev, description: e.target.value }))
                          : setNewPlan(prev => ({ ...prev, description: e.target.value }))}
                      />
                      <label htmlFor="planDescription">Description (optional)</label>
                    </div>
                  </div>
                  <div className="d-flex gap-2">
                    <button type="submit" className="btn btn-sm btn-primary d-flex align-items-center gap-1">
                      <PlusIcon style={{ width: 14, height: 14 }} />
                      {editingPlan ? 'Update Plan' : 'Add Plan'}
                    </button>
                    {editingPlan && (
                      <button type="button" className="btn btn-sm btn-secondary d-flex align-items-center gap-1" onClick={() => setEditingPlan(null)}>
                        <XMarkIcon style={{ width: 14, height: 14 }} />
                        Cancel
                      </button>
                    )}
                  </div>
                </form>
              </div>

              {/* Plans list */}
              {insurancePlansLoading ? (
                <div className="text-center py-4">
                  <div className="spinner-border text-primary" role="status" />
                </div>
              ) : insurancePlans.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 text-sm text-center py-4">
                  No insurance plans yet. Add one above.
                </p>
              ) : (
                <div className="d-flex flex-column gap-2">
                  {insurancePlans.map(plan => (
                    <div key={plan.id} className={`d-flex align-items-center justify-content-between p-3 border rounded-lg ${plan.is_active ? 'border-gray-200 dark:border-gray-700' : 'border-gray-100 dark:border-gray-800 opacity-60'}`}>
                      <div>
                        <div className="fw-semibold text-gray-900 dark:text-white d-flex align-items-center gap-2">
                          {plan.name}
                          <span className={`badge ${plan.is_active ? 'bg-success' : 'bg-secondary'} text-white`}>
                            {plan.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        {plan.description && (
                          <div className="text-sm text-gray-500 dark:text-gray-400">{plan.description}</div>
                        )}
                      </div>
                      <div className="d-flex gap-2">
                        <button
                          className={`btn btn-sm ${plan.is_active ? 'btn-outline-secondary' : 'btn-outline-success'}`}
                          title={plan.is_active ? 'Deactivate' : 'Activate'}
                          onClick={() => handleInsurancePlanToggle(plan)}
                        >
                          {plan.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                        <button className="btn btn-sm btn-outline-secondary" onClick={() => setEditingPlan({ ...plan })}>
                          <PencilIcon style={{ width: 14, height: 14 }} />
                        </button>
                        <button className="btn btn-sm btn-outline-danger" onClick={() => handleInsurancePlanDelete(plan.id)}>
                          <TrashIcon style={{ width: 14, height: 14 }} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Fixed Navigation - Responsive */}
      <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 shadow-lg z-40">
        <nav className="flex justify-center gap-1 py-2 px-2 sm:px-4 max-w-md mx-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-col items-center justify-center flex-1 sm:flex-initial px-3 sm:px-4 py-2 rounded-full transition-colors ${
                  activeTab === tab.id
                    ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400'
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
                title={tab.name}
              >
                <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
                <span className="text-xs mt-1 font-medium">{tab.name}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
