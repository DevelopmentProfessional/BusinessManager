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
  DocumentTextIcon
} from '@heroicons/react/24/outline';
import { settingsAPI, schemaAPI } from '../services/api';

export default function Settings() {
  const [activeTab, setActiveTab] = useState('schedule');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Branding settings state
  const [branding, setBranding] = useState({
    primaryColor: '#3B82F6',
    secondaryColor: '#10B981',
    accentColor: '#8B5CF6',
    logoUrl: '',
    companyName: 'Business Manager',
    tagline: ''
  });

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
    attendance_check_in_required: true
  });
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [activeTooltip, setActiveTooltip] = useState(null);

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
  useEffect(() => {
    const savedBranding = localStorage.getItem('app_branding');
    if (savedBranding) {
      try {
        setBranding(JSON.parse(savedBranding));
      } catch (e) {
        console.warn('Failed to parse saved branding settings');
      }
    }

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
            attendance_check_in_required: response.data.attendance_check_in_required ?? true
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
    localStorage.setItem('app_branding', JSON.stringify(branding));
    document.documentElement.style.setProperty('--color-primary', branding.primaryColor);
    document.documentElement.style.setProperty('--color-secondary', branding.secondaryColor);
    document.documentElement.style.setProperty('--color-accent', branding.accentColor);
    setSuccess('Branding settings saved successfully!');
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
    setBranding(prev => ({ ...prev, [field]: value }));
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

  const tabs = [
    { id: 'schedule', name: 'Schedule', icon: ClockIcon },
    { id: 'general', name: 'General', icon: CogIcon },
    { id: 'database', name: 'Database', icon: CircleStackIcon },
  ];

  return (
    <div className="h-full flex flex-col pb-16">
      {/* Main Content Area */}
      <div className="flex-1 overflow-auto p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          {/* Schedule Settings */}
          {activeTab === 'schedule' && (
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                <ClockIcon className="h-6 w-6" />
                Schedule Settings
              </h2>

              {/* Business Hours */}
              <div className="mb-6">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center">
                  Business Hours
                  <HelpIcon id="business-hours" text="Set the visible time range for your schedule calendar" />
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Start of Day
                      <HelpIcon id="start-of-day" text="Earliest time shown on the schedule calendar" />
                    </label>
                    <input
                      type="time"
                      value={scheduleSettings.start_of_day}
                      onChange={(e) => handleScheduleSettingsChange('start_of_day', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      End of Day
                      <HelpIcon id="end-of-day" text="Latest time shown on the schedule calendar" />
                    </label>
                    <input
                      type="time"
                      value={scheduleSettings.end_of_day}
                      onChange={(e) => handleScheduleSettingsChange('end_of_day', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Attendance Settings */}
              <div className="mb-6">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center">
                  Attendance
                  <HelpIcon id="attendance-section" text="Configure employee clock in/out tracking" />
                </h3>
                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                  <div className="flex items-center">
                    <span className="font-medium text-gray-900 dark:text-white">Attendance Check-in</span>
                    <HelpIcon id="attendance" text="Show clock in/out widget on Schedule page" />
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={scheduleSettings.attendance_check_in_required}
                      onChange={(e) => handleScheduleSettingsChange('attendance_check_in_required', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                  </label>
                </div>
              </div>

              <button
                onClick={handleSaveScheduleSettings}
                disabled={scheduleLoading}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg transition-colors disabled:cursor-not-allowed"
              >
                {scheduleLoading ? 'Saving...' : 'Save'}
              </button>

              {/* Messages */}
              {error && (
                <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <div className="flex items-center gap-2 text-red-800 dark:text-red-300">
                    <ExclamationTriangleIcon className="h-5 w-5" />
                    <span>{error}</span>
                  </div>
                </div>
              )}

              {success && (
                <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                  <div className="flex items-center gap-2 text-green-800 dark:text-green-300">
                    <CheckCircleIcon className="h-5 w-5" />
                    <span>{success}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* General Settings (includes Branding & Notifications) */}
          {activeTab === 'general' && (
            <div className="space-y-8">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                <CogIcon className="h-6 w-6" />
                General Settings
              </h2>

              {/* Application Info */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center">
                  Application
                  <HelpIcon id="app-info" text="Basic application information" />
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                    <span className="font-medium text-gray-900 dark:text-white">Version</span>
                    <span className="text-gray-600 dark:text-gray-400">1.0.0</span>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                    <span className="font-medium text-gray-900 dark:text-white">Environment</span>
                    <span className="text-gray-600 dark:text-gray-400">
                      {import.meta.env.DEV ? 'Development' : 'Production'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Branding Section */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center">
                  <SwatchIcon className="h-5 w-5 mr-2" />
                  Branding
                  <HelpIcon id="branding" text="Customize the look and feel of your application" />
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Company Name
                      <HelpIcon id="company-name" text="Displayed in the header and login page" />
                    </label>
                    <input
                      type="text"
                      value={branding.companyName}
                      onChange={(e) => handleBrandingChange('companyName', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                      placeholder="Your Company Name"
                    />
                  </div>
                  <div>
                    <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Tagline
                      <HelpIcon id="tagline" text="Optional subtitle for your company" />
                    </label>
                    <input
                      type="text"
                      value={branding.tagline}
                      onChange={(e) => handleBrandingChange('tagline', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                      placeholder="Your company tagline"
                    />
                  </div>
                </div>

                <div className="mb-4">
                  <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Logo URL
                    <HelpIcon id="logo-url" text="URL to your company logo image" />
                  </label>
                  <input
                    type="url"
                    value={branding.logoUrl}
                    onChange={(e) => handleBrandingChange('logoUrl', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    placeholder="https://example.com/logo.png"
                  />
                </div>

                {/* Color Pickers */}
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Primary
                      <HelpIcon id="primary-color" text="Main buttons and links" />
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={branding.primaryColor}
                        onChange={(e) => handleBrandingChange('primaryColor', e.target.value)}
                        className="w-10 h-10 rounded border border-gray-300 cursor-pointer"
                      />
                      <input
                        type="text"
                        value={branding.primaryColor}
                        onChange={(e) => handleBrandingChange('primaryColor', e.target.value)}
                        className="flex-1 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-mono text-sm"
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
                        value={branding.secondaryColor}
                        onChange={(e) => handleBrandingChange('secondaryColor', e.target.value)}
                        className="w-10 h-10 rounded border border-gray-300 cursor-pointer"
                      />
                      <input
                        type="text"
                        value={branding.secondaryColor}
                        onChange={(e) => handleBrandingChange('secondaryColor', e.target.value)}
                        className="flex-1 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-mono text-sm"
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
                        value={branding.accentColor}
                        onChange={(e) => handleBrandingChange('accentColor', e.target.value)}
                        className="w-10 h-10 rounded border border-gray-300 cursor-pointer"
                      />
                      <input
                        type="text"
                        value={branding.accentColor}
                        onChange={(e) => handleBrandingChange('accentColor', e.target.value)}
                        className="flex-1 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-mono text-sm"
                      />
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleSaveBranding}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm"
                >
                  Save Branding
                </button>
              </div>

              {/* Notifications Section */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center">
                  <BellIcon className="h-5 w-5 mr-2" />
                  Notifications
                  <HelpIcon id="notifications" text="Configure how you receive notifications" />
                </h3>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                    <div className="flex items-center">
                      <span className="font-medium text-gray-900 dark:text-white">Email Notifications</span>
                      <HelpIcon id="email-notif" text="Receive updates via email" />
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={notifications.emailEnabled}
                        onChange={(e) => handleNotificationChange('emailEnabled', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                    <div className="flex items-center">
                      <span className="font-medium text-gray-900 dark:text-white">Appointment Reminders</span>
                      <HelpIcon id="appt-reminders" text="Get reminded before appointments" />
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={notifications.appointmentReminders}
                        onChange={(e) => handleNotificationChange('appointmentReminders', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                    <div className="flex items-center">
                      <span className="font-medium text-gray-900 dark:text-white">Daily Digest</span>
                      <HelpIcon id="daily-digest" text="Receive a daily summary email" />
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={notifications.dailyDigest}
                        onChange={(e) => handleNotificationChange('dailyDigest', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                </div>

                <button
                  onClick={handleSaveNotifications}
                  className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm"
                >
                  Save Notifications
                </button>
              </div>

              {success && (
                <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                  <div className="flex items-center gap-2 text-green-800 dark:text-green-300">
                    <CheckCircleIcon className="h-5 w-5" />
                    <span>{success}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Database Settings */}
          {activeTab === 'database' && (
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                <CircleStackIcon className="h-6 w-6" />
                Database Settings
              </h2>

              {/* Connection Settings */}
              <div className="mb-8">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center">
                  Connection
                  <HelpIcon id="connection" text="Database and API connection settings" />
                </h3>

                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 mb-4">
                  <div className="flex items-start gap-2">
                    <ExclamationTriangleIcon className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-yellow-700 dark:text-yellow-400">
                      These settings are stored locally. For production, use environment variables.
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Database Connection String
                      <HelpIcon id="db-conn" text="PostgreSQL connection URL" />
                    </label>
                    <input
                      type="password"
                      value={dbSettings.connectionString}
                      onChange={(e) => handleDbSettingsChange('connectionString', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                      placeholder="postgresql://user:password@host:port/database"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        API Base URL
                        <HelpIcon id="api-url" text="Backend API endpoint" />
                      </label>
                      <input
                        type="url"
                        value={dbSettings.apiBaseUrl}
                        onChange={(e) => handleDbSettingsChange('apiBaseUrl', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                        placeholder="http://localhost:8000/api/v1"
                      />
                    </div>
                    <div>
                      <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        OnlyOffice URL
                        <HelpIcon id="onlyoffice" text="Document editor server URL" />
                      </label>
                      <input
                        type="url"
                        value={dbSettings.onlyofficeUrl}
                        onChange={(e) => handleDbSettingsChange('onlyofficeUrl', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                        placeholder="http://localhost:8082"
                      />
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleSaveDbSettings}
                  className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm"
                >
                  Save Connection
                </button>
              </div>

              {/* Data Import Section */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center">
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
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
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
                  <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center">
                      <TableCellsIcon className="h-4 w-4 mr-1" />
                      Table Columns
                    </h4>
                    <div className="flex flex-wrap gap-2">
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
                    <div className="flex items-center gap-2">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".csv"
                        onChange={handleFileSelect}
                        className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 text-sm file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:text-sm file:bg-blue-50 file:text-blue-700 dark:file:bg-blue-900/30 dark:file:text-blue-300"
                      />
                      {csvData && (
                        <button
                          onClick={resetImport}
                          className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Column Mapping */}
                {csvData && csvHeaders.length > 0 && (
                  <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center">
                      <DocumentTextIcon className="h-4 w-4 mr-1" />
                      Column Mapping
                      <HelpIcon id="column-mapping" text="Match CSV columns to database columns" />
                    </h4>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {csvHeaders.map(header => (
                        <div key={header} className="flex items-center gap-2">
                          <span className="w-1/3 text-sm text-gray-700 dark:text-gray-300 truncate" title={header}>
                            {header}
                          </span>
                          <span className="text-gray-400">→</span>
                          <select
                            value={columnMapping[header] || ''}
                            onChange={(e) => handleColumnMappingChange(header, e.target.value)}
                            className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
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
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-lg transition-colors text-sm flex items-center gap-2"
                  >
                    <ArrowUpTrayIcon className="h-4 w-4" />
                    {importLoading ? 'Importing...' : `Import ${csvData.length} Records`}
                  </button>
                )}

                {/* Import Result */}
                {importResult && (
                  <div className={`mt-4 p-4 rounded-lg ${
                    importResult.errors?.length > 0 
                      ? 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800'
                      : 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                  }`}>
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircleIcon className={`h-5 w-5 ${
                        importResult.errors?.length > 0 
                          ? 'text-yellow-600 dark:text-yellow-400'
                          : 'text-green-600 dark:text-green-400'
                      }`} />
                      <span className={
                        importResult.errors?.length > 0 
                          ? 'text-yellow-800 dark:text-yellow-300'
                          : 'text-green-800 dark:text-green-300'
                      }>
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
                <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                  <div className="flex items-center gap-2 text-green-800 dark:text-green-300">
                    <CheckCircleIcon className="h-5 w-5" />
                    <span>{success}</span>
                  </div>
                </div>
              )}

              {error && (
                <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <div className="flex items-center gap-2 text-red-800 dark:text-red-300">
                    <ExclamationTriangleIcon className="h-5 w-5" />
                    <span>{error}</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Fixed Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 shadow-lg z-40">
        <nav className="flex justify-center gap-1 py-2 px-4 max-w-md mx-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-col items-center justify-center px-4 py-2 rounded-lg transition-colors ${
                  activeTab === tab.id
                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
                title={tab.name}
              >
                <Icon className="h-6 w-6" />
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
