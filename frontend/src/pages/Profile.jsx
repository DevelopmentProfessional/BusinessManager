import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useStore from '../services/useStore';
import useDarkMode from '../services/useDarkMode';
import useViewMode from '../services/useViewMode';
import Button_Toolbar from './components/Button_Toolbar';
import { getMobileEnvironment } from '../services/mobileEnvironment';
import { logComponentLoad, finalizePerformanceReport, getPerformanceSessionActive } from '../services/performanceTracker';
import {
  UserIcon,
  CogIcon,
  EnvelopeIcon,
  PhoneIcon,
  BriefcaseIcon,
  CalendarDaysIcon,
  ClockIcon,
  PlusCircleIcon,
  HeartIcon,
  SunIcon,
  MoonIcon,
  PencilIcon,
  ArrowLeftOnRectangleIcon,
  BellIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  CircleStackIcon,
  SwatchIcon,
  ArrowUpTrayIcon,
  TableCellsIcon,
  DocumentTextIcon,
  ChevronDownIcon,
  InformationCircleIcon,
  QuestionMarkCircleIcon,
  CurrencyDollarIcon,
  AcademicCapIcon,
  Squares2X2Icon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { PencilSquareIcon } from '@heroicons/react/24/solid';
import { employeesAPI, leaveRequestsAPI, onboardingRequestsAPI, offboardingRequestsAPI, settingsAPI, schemaAPI, payrollAPI, preloadMajorTables } from '../services/api';
import api from '../services/api';
import Modal_Signature from './components/Modal_Signature';
import Manager_DatabaseConnection from './components/Manager_DatabaseConnection';
import useBranding from '../services/useBranding';

// CSS for accordion pop-up animation
const accordionStyles = `
  @keyframes popUp {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  .accordion-popup {
    animation: popUp 0.3s ease-out;
    scrollbar-width: none !important; /* Firefox */
    -ms-overflow-style: none !important; /* IE and Edge */
  }
  
  .accordion-popup::-webkit-scrollbar {
    display: none !important; /* Chrome, Safari, Opera */
    width: 0 !important;
    height: 0 !important;
  }
  
  .accordion-popup * {
    scrollbar-width: none !important;
    -ms-overflow-style: none !important;
  }

  .accordion-popup *::-webkit-scrollbar {
    display: none !important;
    width: 0 !important;
    height: 0 !important;
  }

  /* Blanket no-scrollbar for everything inside the Profile page */
  .profile-page * {
    scrollbar-width: none !important;
    -ms-overflow-style: none !important;
  }

  .profile-page *::-webkit-scrollbar {
    display: none !important;
    width: 0 !important;
    height: 0 !important;
  }
`;

// Add animation styles (shared with Settings — only inject once)
if (typeof document !== 'undefined') {
  if (!document.head.querySelector('style[data-accordion-popup]')) {
    const styleSheet = document.createElement('style');
    styleSheet.textContent = accordionStyles;
    styleSheet.setAttribute('data-accordion-popup', 'true');
    document.head.appendChild(styleSheet);
  }
}

// Always inject profile-specific no-scrollbar styles (own unique tag, never blocked)
if (typeof document !== 'undefined') {
  const existing = document.head.querySelector('style[data-profile-no-scrollbar]');
  if (!existing) {
    const styleSheet = document.createElement('style');
    styleSheet.setAttribute('data-profile-no-scrollbar', 'true');
    styleSheet.textContent = `
      .profile-page * {
        scrollbar-width: none !important;
        -ms-overflow-style: none !important;
      }
      .profile-page *::-webkit-scrollbar {
        display: none !important;
        width: 0 !important;
        height: 0 !important;
      }
    `;
    document.head.appendChild(styleSheet);
  }
}

// Available database environments - shows what's possible
const DB_ENVIRONMENTS = {
  development: { name: 'Development', description: 'Development database' },
  test: { name: 'Test', description: 'Testing environment' },
  production: { name: 'Production', description: 'Live production database' }
};

const statusColor = (status) => {
  if (status === 'approved') return 'success';
  if (status === 'denied') return 'danger';
  return 'warning';
};

const Profile = () => {
  const navigate = useNavigate();
  const { user, logout, setUser, hasPermission } = useStore();
  const { isDarkMode, toggleDarkMode } = useDarkMode();
  const { isTrainingMode, toggleViewMode } = useViewMode();

  // Log Profile component mount if performance session is active
  useEffect(() => {
    if (getPerformanceSessionActive()) {
      logComponentLoad('Profile Component');
    }
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Database environment from user profile - defaults to development if not set
  const currentDbEnvironment = user?.db_environment || 'development';
  const [dbLoading, setDbLoading] = useState(false);
  const [dbMessage, setDbMessage] = useState('');
  const [dbError, setDbError] = useState('');
  const [installMessage, setInstallMessage] = useState('');
  const [installError, setInstallError] = useState('');
  const [signatureModalOpen, setSignatureModalOpen] = useState(false);
  const [employeeColor, setEmployeeColor] = useState(user?.color || '#3B82F6');
  const [pendingColor, setPendingColor] = useState(user?.color || '#3B82F6');
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [colorUpdating, setColorUpdating] = useState(false);
  const [colorMessage, setColorMessage] = useState('');
  const [openAccordion, setOpenAccordion] = useState('settings');
  const [leaveManagementOpen, setLeaveManagementOpen] = useState(false);

  // Leave request state
  const [vacationRequests, setVacationRequests] = useState([]);
  const [sickRequests, setSickRequests] = useState([]);
  const [leaveRequestsLoading, setLeaveRequestsLoading] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [leaveModalType, setLeaveModalType] = useState('vacation');
  const [leaveForm, setLeaveForm] = useState({ start_date: '', end_date: '', notes: '' });
  const [leaveSubmitting, setLeaveSubmitting] = useState(false);
  const [leaveError, setLeaveError] = useState('');

  // Wages / payroll state
  const [paySlips, setPaySlips] = useState([]);
  const [paySlipsLoading, setPaySlipsLoading] = useState(false);
  const [selectedSlip, setSelectedSlip] = useState(null);

  const row1Ref = useRef(null);
  const [row1Height, setRow1Height] = useState(80);
  const [row2Height, setRow2Height] = useState(0);
  const row2ObsRef = useRef(null);

  // ── Settings state ──────────────────────────────────────────────────────────
  const [settingsError, setSettingsError] = useState('');
  const [settingsSuccess, setSettingsSuccess] = useState('');
  const [syncLoading, setSyncLoading] = useState(false);

  const { branding, updateBranding } = useBranding();
  const [localBranding, setLocalBranding] = useState(branding);

  const [dbSettings, setDbSettings] = useState({
    connectionString: '',
    apiBaseUrl: '',
    onlyofficeUrl: '',
  });

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
    sunday_enabled: true,
  });
  const [scheduleLoading, setScheduleLoading] = useState(false);

  // Company info state
  const [companyInfo, setCompanyInfo] = useState({
    company_name: '',
    company_email: '',
    company_phone: '',
    company_address: '',
  });
  const [companyLoading, setCompanyLoading] = useState(false);
  const [activeTooltip, setActiveTooltip] = useState(null);

  const [openAccordions, setOpenAccordions] = useState({
    application: true,
    branding: false,
    notifications: false,
  });

  const [availableTables, setAvailableTables] = useState([]);
  const [selectedTable, setSelectedTable] = useState('');
  const [tableColumns, setTableColumns] = useState([]);
  const [csvData, setCsvData] = useState(null);
  const [csvHeaders, setCsvHeaders] = useState([]);
  const [columnMapping, setColumnMapping] = useState({});
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const csvFileInputRef = useRef(null);

  const [notifications, setNotifications] = useState({
    emailEnabled: true,
    pushEnabled: false,
    appointmentReminders: true,
    dailyDigest: false,
  });

  useEffect(() => {
    if (!row1Ref.current) return;
    const update = () => setRow1Height(row1Ref.current.offsetHeight);
    update();
    const obs = new ResizeObserver(update);
    obs.observe(row1Ref.current);
    return () => obs.disconnect();
  }, []);

  // Callback ref for Row 2 — sets up/tears down ResizeObserver as Row 2 mounts/unmounts
  const handleRow2Ref = useCallback((el) => {
    if (row2ObsRef.current) {
      row2ObsRef.current.disconnect();
      row2ObsRef.current = null;
    }
    if (!el) { setRow2Height(0); return; }
    const update = () => setRow2Height(el.offsetHeight);
    update();
    const obs = new ResizeObserver(update);
    obs.observe(el);
    row2ObsRef.current = obs;
  }, []);

  // Sync local branding when global branding changes
  useEffect(() => { setLocalBranding(branding); }, [branding]);

  // Load saved settings + schedule from backend on mount
  useEffect(() => {
    const savedDb = localStorage.getItem('app_db_settings');
    if (savedDb) {
      try { setDbSettings(JSON.parse(savedDb)); } catch { /* ignore */ }
    } else {
      setDbSettings({
        connectionString: '',
        apiBaseUrl: import.meta.env.VITE_API_URL || '',
        onlyofficeUrl: import.meta.env.VITE_ONLYOFFICE_URL || '',
      });
    }
    const savedNotif = localStorage.getItem('app_notifications');
    if (savedNotif) {
      try { setNotifications(JSON.parse(savedNotif)); } catch { /* ignore */ }
    }
    const loadSchedule = async () => {
      try {
        const res = await settingsAPI.getScheduleSettings();
        if (res.data) {
          setScheduleSettings({
            start_of_day: res.data.start_of_day || '06:00',
            end_of_day: res.data.end_of_day || '21:00',
            attendance_check_in_required: res.data.attendance_check_in_required ?? true,
            monday_enabled: res.data.monday_enabled ?? true,
            tuesday_enabled: res.data.tuesday_enabled ?? true,
            wednesday_enabled: res.data.wednesday_enabled ?? true,
            thursday_enabled: res.data.thursday_enabled ?? true,
            friday_enabled: res.data.friday_enabled ?? true,
            saturday_enabled: res.data.saturday_enabled ?? true,
            sunday_enabled: res.data.sunday_enabled ?? true,
          });
          setCompanyInfo({
            company_name: res.data.company_name || '',
            company_email: res.data.company_email || '',
            company_phone: res.data.company_phone || '',
            company_address: res.data.company_address || '',
          });
        }
      } catch { /* silently degrade */ }
    };
    loadSchedule();
  }, []);

  // Load available tables when database tab opens
  useEffect(() => {
    if (openAccordion === 'database' && availableTables.length === 0) {
      loadTables();
    }
  }, [openAccordion]);

  // Load table columns when table selected
  useEffect(() => {
    if (selectedTable) loadTableColumns(selectedTable);
  }, [selectedTable]);

  const toNumber = (value) => {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  // ── Settings helpers ─────────────────────────────────────────────────────────
  const HelpIcon = ({ id, text }) => (
    <div className="relative inline-block ml-1">
      <QuestionMarkCircleIcon
        className="h-4 w-4 text-gray-400 hover:text-gray-600 cursor-help transition-colors"
        onClick={() => setActiveTooltip(activeTooltip === id ? null : id)}
        onMouseEnter={() => setActiveTooltip(id)}
        onMouseLeave={() => setActiveTooltip(null)}
      />
      {activeTooltip === id && (
        <div className="absolute z-10 bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 text-xs text-white bg-gray-800 rounded-lg shadow-lg max-w-xs text-center">
          {text}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800"></div>
        </div>
      )}
    </div>
  );

  const toggleAccordion = (id) => setOpenAccordions(prev => ({ ...prev, [id]: !prev[id] }));

  const handleSaveBranding = () => {
    updateBranding(localBranding);
    setSettingsSuccess('Branding saved!');
    setTimeout(() => setSettingsSuccess(''), 3000);
  };
  const handleBrandingChange = (field, value) => setLocalBranding(prev => ({ ...prev, [field]: value }));

  const handleSaveDbSettings = () => {
    localStorage.setItem('app_db_settings', JSON.stringify(dbSettings));
    setSettingsSuccess('Connection settings saved!');
    setTimeout(() => setSettingsSuccess(''), 3000);
  };
  const handleDbSettingsChange = (field, value) => setDbSettings(prev => ({ ...prev, [field]: value }));

  const handleSaveNotifications = () => {
    localStorage.setItem('app_notifications', JSON.stringify(notifications));
    setSettingsSuccess('Notification settings saved!');
    setTimeout(() => setSettingsSuccess(''), 3000);
  };
  const handleNotificationChange = (field, value) => setNotifications(prev => ({ ...prev, [field]: value }));

  const handleScheduleSettingsChange = (field, value) => setScheduleSettings(prev => ({ ...prev, [field]: value }));

  const handleSaveScheduleSettings = async () => {
    setScheduleLoading(true);
    setSettingsError('');
    setSettingsSuccess('');
    try {
      await settingsAPI.updateScheduleSettings(scheduleSettings);
      setSettingsSuccess('Schedule settings saved!');
      setTimeout(() => setSettingsSuccess(''), 3000);
    } catch (err) {
      setSettingsError(err.response?.data?.detail || 'Failed to save schedule settings');
    } finally {
      setScheduleLoading(false);
    }
  };

  const handleCompanyInfoChange = (field, value) => setCompanyInfo(prev => ({ ...prev, [field]: value }));

  const handleSaveCompanyInfo = async () => {
    setCompanyLoading(true);
    setSettingsError('');
    setSettingsSuccess('');
    try {
      await settingsAPI.updateSettings(companyInfo);
      setSettingsSuccess('Company info saved!');
      setTimeout(() => setSettingsSuccess(''), 3000);
    } catch (err) {
      setSettingsError(err.response?.data?.detail || 'Failed to save company info');
    } finally {
      setCompanyLoading(false);
    }
  };

  const handleManualSync = async () => {
    setSyncLoading(true);
    setSettingsError('');
    setSettingsSuccess('');
    try {
      if (typeof window !== 'undefined' && typeof window.clearApiCache === 'function') {
        window.clearApiCache();
      }

      await preloadMajorTables();

      try {
        await settingsAPI.getScheduleSettings();
      } catch {
        // best-effort ping only
      }

      setSettingsSuccess('Sync complete. Latest server data has been refreshed.');
      setTimeout(() => setSettingsSuccess(''), 3000);
    } catch (err) {
      setSettingsError('Sync failed. Please try again.');
    } finally {
      setSyncLoading(false);
    }
  };

  const loadTables = async () => {
    try {
      const res = await schemaAPI.getTables();
      setAvailableTables(res.data || []);
    } catch { /* silently degrade */ }
  };

  const loadTableColumns = async (tableName) => {
    try {
      const res = await schemaAPI.getTableColumns(tableName);
      setTableColumns(res.data || []);
      setColumnMapping({});
      setCsvData(null);
      setCsvHeaders([]);
      setImportResult(null);
    } catch { setTableColumns([]); }
  };

  const parseCSVLine = (line) => {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') { inQuotes = !inQuotes; }
      else if (char === ',' && !inQuotes) { result.push(current.trim()); current = ''; }
      else { current += char; }
    }
    result.push(current.trim());
    return result;
  };

  const parseCSV = (text) => {
    const lines = text.split('\n').filter(l => l.trim());
    if (lines.length < 2) return { headers: [], data: [] };
    const headers = parseCSVLine(lines[0]);
    const data = [];
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      if (values.length === headers.length) {
        const row = {};
        headers.forEach((h, idx) => { row[h] = values[idx]; });
        data.push(row);
      }
    }
    return { headers, data };
  };

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const { headers, data } = parseCSV(e.target.result);
      setCsvHeaders(headers);
      setCsvData(data);
      const autoMapping = {};
      headers.forEach(header => {
        const norm = header.toLowerCase().replace(/\s+/g, '_');
        const match = tableColumns.find(col => col.name.toLowerCase() === norm || col.display_name.toLowerCase() === header.toLowerCase());
        if (match) autoMapping[header] = match.name;
      });
      setColumnMapping(autoMapping);
      setImportResult(null);
    };
    reader.readAsText(file);
  };

  const handleColumnMappingChange = (csvHeader, dbColumn) => {
    setColumnMapping(prev => ({ ...prev, [csvHeader]: dbColumn || undefined }));
  };

  const handleImport = async () => {
    if (!csvData || csvData.length === 0) { setSettingsError('No data to import'); return; }
    setImportLoading(true);
    setSettingsError('');
    setImportResult(null);
    try {
      const transformedData = csvData.map(row => {
        const newRow = {};
        Object.entries(columnMapping).forEach(([csvH, dbCol]) => {
          if (dbCol && row[csvH] !== undefined) newRow[dbCol] = row[csvH];
        });
        return newRow;
      }).filter(row => Object.keys(row).length > 0);
      const res = await schemaAPI.bulkImport(selectedTable, transformedData);
      setImportResult(res.data);
      if (res.data.imported > 0) {
        setSettingsSuccess(`Imported ${res.data.imported} records!`);
        setTimeout(() => setSettingsSuccess(''), 5000);
      }
    } catch (err) {
      setSettingsError(err.response?.data?.detail || 'Import failed');
    } finally {
      setImportLoading(false);
    }
  };

  const resetImport = () => {
    setCsvData(null); setCsvHeaders([]); setColumnMapping({}); setImportResult(null);
    if (csvFileInputRef.current) csvFileInputRef.current.value = '';
  };

  const syncCurrentUser = async () => {
    if (!user?.id) return;
    try {
      const response = await employeesAPI.getUserData(user.id);
      const refreshedUser = response?.data ?? response;
      if (!refreshedUser || typeof refreshedUser !== 'object') return;
      const mergedUser = { ...user, ...refreshedUser };
      setUser(mergedUser);
      if (localStorage.getItem('user')) localStorage.setItem('user', JSON.stringify(mergedUser));
      if (sessionStorage.getItem('user')) sessionStorage.setItem('user', JSON.stringify(mergedUser));
    } catch {
      // silently degrade
    }
  };

  // Load pay slips when wages accordion opens
  useEffect(() => {
    if (openAccordion !== 'wages' || !user?.id) return;
    let cancelled = false;
    const load = async () => {
      setPaySlipsLoading(true);
      try {
        const res = await payrollAPI.getByEmployee(user.id);
        if (!cancelled) setPaySlips(Array.isArray(res?.data) ? res.data : []);
      } catch {
        // silently degrade
      } finally {
        if (!cancelled) setPaySlipsLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [openAccordion, user?.id]);

  // Load leave requests whenever benefits accordion opens or Leave Management modal opens
  useEffect(() => {
    if ((openAccordion !== 'benefits' && !leaveManagementOpen) || !user?.id) return;
    let cancelled = false;
    const load = async () => {
      setLeaveRequestsLoading(true);
      try {
        await syncCurrentUser();
        const [vacRes, sickRes] = await Promise.all([
          leaveRequestsAPI.getByUser(user.id, 'vacation'),
          leaveRequestsAPI.getByUser(user.id, 'sick'),
        ]);
        if (cancelled) return;
        setVacationRequests(Array.isArray(vacRes?.data) ? vacRes.data : []);
        setSickRequests(Array.isArray(sickRes?.data) ? sickRes.data : []);
      } catch {
        // silently degrade
      } finally {
        if (!cancelled) setLeaveRequestsLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [openAccordion, leaveManagementOpen, user?.id]);

  const refreshLeaveRequests = async () => {
    if (!user?.id) return;
    setLeaveRequestsLoading(true);
    try {
      const [vacRes, sickRes] = await Promise.all([
        leaveRequestsAPI.getByUser(user.id, 'vacation'),
        leaveRequestsAPI.getByUser(user.id, 'sick'),
      ]);
      setVacationRequests(Array.isArray(vacRes?.data) ? vacRes.data : []);
      setSickRequests(Array.isArray(sickRes?.data) ? sickRes.data : []);
    } catch {
      // silently degrade
    } finally {
      setLeaveRequestsLoading(false);
    }
  };

  const handleLeaveSubmit = async (e) => {
    e.preventDefault();
    if (!user?.id) return;
    setLeaveSubmitting(true);
    setLeaveError('');
    try {
      const isLeave = leaveModalType === 'vacation' || leaveModalType === 'sick';

      if (isLeave) {
        const start = new Date(leaveForm.start_date);
        const end = new Date(leaveForm.end_date);
        if (end < start) {
          setLeaveError('End date must be on or after start date.');
          setLeaveSubmitting(false);
          return;
        }
        const daysRequested = Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1;

        if (leaveModalType === 'vacation') {
          const remaining = Math.max(0, toNumber(user.vacation_days) - toNumber(user.vacation_days_used));
          if (daysRequested > remaining) {
            setLeaveError(`You only have ${remaining} vacation day(s) remaining.`);
            setLeaveSubmitting(false);
            return;
          }
        } else {
          const remaining = Math.max(0, toNumber(user.sick_days) - toNumber(user.sick_days_used));
          if (daysRequested > remaining) {
            setLeaveError(`You only have ${remaining} sick day(s) remaining.`);
            setLeaveSubmitting(false);
            return;
          }
        }

        await leaveRequestsAPI.create({
          user_id: user.id,
          supervisor_id: user.reports_to || null,
          leave_type: leaveModalType,
          start_date: leaveForm.start_date,
          end_date: leaveForm.end_date,
          days_requested: daysRequested,
          notes: leaveForm.notes || null,
          status: 'pending',
        });
        await refreshLeaveRequests();
      } else if (leaveModalType === 'onboarding') {
        await onboardingRequestsAPI.create({
          user_id: user.id,
          supervisor_id: user.reports_to || null,
          request_date: leaveForm.start_date || null,
          notes: leaveForm.notes || null,
          status: 'pending',
        });
      } else if (leaveModalType === 'offboarding') {
        await offboardingRequestsAPI.create({
          user_id: user.id,
          supervisor_id: user.reports_to || null,
          request_date: leaveForm.start_date || null,
          notes: leaveForm.notes || null,
          status: 'pending',
        });
      }

      setShowLeaveModal(false);
      setLeaveForm({ start_date: '', end_date: '', notes: '' });
    } catch (err) {
      setLeaveError(err?.response?.data?.detail || 'Failed to submit request.');
    } finally {
      setLeaveSubmitting(false);
    }
  };

  const handleSwitchEnvironment = async (env) => {
    if (env === currentDbEnvironment || !user?.id) return;
    setDbLoading(true);
    setDbMessage('');
    setDbError('');
    try {
      await employeesAPI.updateUser(user.id, { db_environment: env });
      setUser({ ...user, db_environment: env });
      setDbMessage(`Database preference updated to ${DB_ENVIRONMENTS[env]?.name || env}.`);
      setTimeout(() => setDbMessage(''), 3000);
    } catch (error) {
      const detail = error?.response?.data?.detail || error?.message || 'Failed to update database preference';
      setDbError(detail);
      setTimeout(() => setDbError(''), 5000);
    } finally {
      setDbLoading(false);
    }
  };

  const handleAddToHomeScreen = async () => {
    setInstallMessage('');
    setInstallError('');
    const mobileEnv = getMobileEnvironment();
    if (!mobileEnv.isMobileViewport) {
      setInstallError('Add to Home Screen is available on mobile devices.');
      return;
    }
    if (mobileEnv.isStandalone) {
      setInstallMessage('This app is already installed on your home screen.');
      return;
    }
    const deferredPrompt = window.__pwaDeferredPrompt;
    if (!deferredPrompt) {
      setInstallMessage(mobileEnv.installHint);
      return;
    }
    try {
      deferredPrompt.prompt();
      const result = await deferredPrompt.userChoice;
      if (result?.outcome === 'accepted') {
        setInstallMessage('Installation started. Open the app from your home screen once complete.');
      } else {
        setInstallMessage(mobileEnv.installHint);
      }
    } catch {
      setInstallError('Unable to open install prompt. Please use your browser menu to add to home screen.');
    }
  };

  const handleColorChange = async (newColor) => {
    setEmployeeColor(newColor);
    setColorUpdating(true);
    setColorMessage('');
    try {
      await employeesAPI.updateUser(user.id, { color: newColor });
      setUser({ ...user, color: newColor });
      setColorMessage('Calendar color updated!');
      setTimeout(() => setColorMessage(''), 2000);
      return true;
    } catch (error) {
      const detail = error?.response?.data?.detail || error?.message || 'Failed to update color';
      setColorMessage(detail);
      setEmployeeColor(user?.color || '#3B82F6');
      setTimeout(() => setColorMessage(''), 3000);
      return false;
    } finally {
      setColorUpdating(false);
    }
  };

  const handleColorSave = async () => {
    const ok = await handleColorChange(pendingColor);
    if (ok) setColorPickerOpen(false);
  };

  // Finalize performance report when Profile is fully loaded
  useEffect(() => {
    if (getPerformanceSessionActive()) {
      const trackedSections = [
        'Employee Information Section',
        'Theme Settings Section',
        'Database Environment Section',
        'Install App Section',
        'Access Token Section'
      ];
      const checkSections = () => {
        const checkInterval = setInterval(() => {
          trackedSections.forEach(section => {
            if (getPerformanceSessionActive()) logComponentLoad(section);
          });
          clearInterval(checkInterval);
        }, 100);
      };
      checkSections();
      const rafId = requestAnimationFrame(() => {
        setTimeout(() => { finalizePerformanceReport(); }, 300);
      });
      return () => cancelAnimationFrame(rafId);
    }
  }, [user]);

  if (!user) {
    return (
      <div className="container-fluid py-1">
        <div className="card">
          <div className="card-body text-center">
            <div className="spinner-border text-primary mb-3" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <h2 className="h5 mb-2">Loading...</h2>
          </div>
        </div>
      </div>
    );
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric'
    });
  };

  const getRoleBadgeColor = (role) => {
    switch (role?.toLowerCase()) {
      case 'admin': return 'danger';
      case 'manager': return 'warning';
      case 'employee': return 'primary';
      case 'viewer': return 'secondary';
      default: return 'secondary';
    }
  };

  const vacTotal = toNumber(user.vacation_days);
  const vacUsed = toNumber(user.vacation_days_used);
  const vacRemaining = Math.max(0, vacTotal - vacUsed);
  const sickTotal = toNumber(user.sick_days);
  const sickUsed = toNumber(user.sick_days_used);
  const sickRemaining = Math.max(0, sickTotal - sickUsed);

  const openLeaveModal = (type) => {
    const defaultType = type || (vacRemaining > 0 ? 'vacation' : (sickRemaining > 0 ? 'sick' : 'onboarding'));
    setLeaveModalType(defaultType);
    setLeaveForm({ start_date: '', end_date: '', notes: '' });
    setLeaveError('');
    setShowLeaveModal(true);
  };

  const canAccessSettings = hasPermission('settings', 'read');

  // All panels clear the entire footer so every tab row stays visible and tappable.
  const totalFooterHeight = row1Height + row2Height;
  const row1PanelBottom = totalFooterHeight;

  // Shared panel style for all settings panels
  const settingsPanelStyle = {
    position: 'fixed',
    top: 0,
    bottom: `${totalFooterHeight}px`,
    left: 0,
    right: 0,
    width: '100%',
    height: `calc(100dvh - ${totalFooterHeight}px)`,
    overflowY: 'auto',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
    backgroundColor: 'var(--bs-body-bg)',
    zIndex: 1000,
    paddingTop: '1rem',
    paddingLeft: '1rem',
    paddingRight: '1rem',
    paddingBottom: '0.25rem',
    display: 'flex',
    flexDirection: 'column',
  };

  return (
    <div className="profile-page d-flex flex-column overflow-hidden" style={{ height: '100dvh' }}>
      
      {/* Main Content Area */}
      <div className="flex-grow-1"></div>

      {/* Floating Content Panels */}
      {/* Profile Content */}
      {openAccordion === 'profile' && (
        <div 
          className="accordion-popup" 
          style={{ 
            position: 'fixed',
            top: 0,
            bottom: `${row1PanelBottom}px`,
            left: 0,
            right: 0,
            width: '100%',
            height: `calc(100dvh - ${row1PanelBottom}px)`,
            overflowY: 'auto',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            backgroundColor: 'var(--bs-body-bg)',
            zIndex: 1000,
            paddingTop: '1rem',
            paddingLeft: '1rem',
            paddingRight: '1rem',
            paddingBottom: '0.25rem',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          <div style={{ flexGrow: 1 }} />
          <div style={{ flexShrink: 0 }}>
              <div className="row">
                <div className="col-sm-6">
                  <div className="flex wrap mb-1">
                    <UserIcon className="w-4" /> <div className="fw-medium p-1">{user.first_name} {user.last_name}</div>
                  </div>
                </div>
                <div className="col-sm-6">
                  <div className="flex wrap mb-1">
                    <BriefcaseIcon className="w-4" />
                    <span className={`badge bg-${getRoleBadgeColor(user.role)} text-capitalize`}>
                      {user.role || 'Employee'}
                    </span>
                  </div>
                </div>
                <div className="col-sm-6">
                  <div className="flex wrap mb-1">
                    <EnvelopeIcon className="w-4" /><div className="fw-medium p-1">{user.email || 'Not set'}</div>
                  </div>
                </div>
                <div className="col-sm-6">
                  <div className="flex wrap mb-1">
                    <PhoneIcon className="w-4" /><div className="fw-medium p-1">{user.phone || 'Not set'}</div>
                  </div>
                </div>
                <div className="col-sm-6">
                  <div className="flex wrap mb-1">
                    <CalendarDaysIcon className="w-4" /><div className="fw-medium p-1">{formatDate(user.hire_date)}</div>
                  </div>
                </div>
                <div className="col-sm-6">
                  <div className="flex wrap mb-1">
                    <ClockIcon className="w-4" /><div className="fw-medium p-1">{formatDate(user.last_login)}</div>
                  </div>
                </div>
              </div>
              <hr className="my-2" />
              <h6 className="fw-semibold mb-2">Details</h6>
              <div className="row g-2">
                <div className="col-sm-6">
                  <div className="text-muted small">Username</div>
                  <div className="fw-medium">{user.username || 'Not set'}</div>
                </div>
                <div className="col-sm-6">
                  <div className="text-muted small">Employee ID</div>
                  <div className="fw-medium">{user.id || 'N/A'}</div>
                </div>
                <div className="col-sm-6">
                  <div className="text-muted small">Location</div>
                  <div className="fw-medium">{user.location || 'Not set'}</div>
                </div>
                <div className="col-sm-6">
                  <div className="text-muted small">IOD Number</div>
                  <div className="fw-medium">{user.iod_number || 'Not set'}</div>
                </div>
                <div className="col-sm-6">
                  <div className="text-muted small">Reports To</div>
                  <div className="fw-medium">{user.reports_to_name || user.reports_to || 'Not set'}</div>
                </div>
                <div className="col-sm-6">
                  <div className="text-muted small">Active</div>
                  <div className="fw-medium">{user.is_active === false ? 'No' : 'Yes'}</div>
                </div>
              </div>
            </div>
          </div>
        )}

      {/* Benefits Content */}
      {openAccordion === 'benefits' && (
        <div 
          className="accordion-popup" 
          style={{ 
            position: 'fixed',
            top: 0,
            bottom: `${row1PanelBottom}px`,
            left: 0,
            right: 0,
            width: '100%',
            height: `calc(100dvh - ${row1PanelBottom}px)`,
            overflowY: 'auto',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            backgroundColor: 'var(--bs-body-bg)',
            zIndex: 1000,
            paddingTop: '1rem',
            paddingLeft: '1rem',
            paddingRight: '1rem',
            paddingBottom: '0.25rem',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          <div style={{ flexGrow: 1 }} />
          <div style={{ flexShrink: 0 }}>

              {/* Salary / Pay / Insurance */}
              <div className="row g-2 mb-3">
                <div className="col-sm-6">
                  <div className="text-muted small">Salary</div>
                  <div className="fw-medium">
                    {user.salary != null ? `$${Number(user.salary).toLocaleString()}` : 'Not set'}
                  </div>
                </div>
                <div className="col-sm-6">
                  <div className="text-muted small">Pay Frequency</div>
                  <div className="fw-medium" style={{ textTransform: 'capitalize' }}>
                    {user.pay_frequency || 'Not set'}
                  </div>
                </div>
                <div className="col-sm-6">
                  <div className="text-muted small">Insurance Plan</div>
                  <div className="fw-medium">{user.insurance_plan || 'Not set'}</div>
                </div>
              </div>

              {/* Leave Management */}
              <div className="border-top pt-3">
                <h6 className="fw-semibold mb-3">Leave Management</h6>
                
                {leaveRequestsLoading ? (
                  <div className="text-center py-4">
                    <div className="spinner-border spinner-border-sm text-primary" role="status" />
                  </div>
                ) : (
                  <>
                    {/* Leave Summary */}
                    <div className="row g-2 mb-3">
                      <div className="col-6">
                        <div className="bg-light rounded p-2 small">
                          <div className="fw-semibold text-primary">Vacation Days</div>
                          <div className="text-muted small mb-1">{vacUsed} / {vacTotal} used</div>
                          <div className="progress" style={{ height: '4px' }}>
                            <div className="progress-bar bg-primary" style={{
                              width: `${vacTotal > 0 ? Math.min(100, (vacUsed / vacTotal) * 100) : 0}%`
                            }} />
                          </div>
                          <div className="text-muted small mt-1">{vacRemaining} remaining</div>
                        </div>
                      </div>
                      <div className="col-6">
                        <div className="bg-light rounded p-2 small">
                          <div className="fw-semibold text-warning">Sick Days</div>
                          <div className="text-muted small mb-1">{sickUsed} / {sickTotal} used</div>
                          <div className="progress" style={{ height: '4px' }}>
                            <div className="progress-bar bg-warning" style={{
                              width: `${sickTotal > 0 ? Math.min(100, (sickUsed / sickTotal) * 100) : 0}%`
                            }} />
                          </div>
                          <div className="text-muted small mt-1">{sickRemaining} remaining</div>
                        </div>
                      </div>
                    </div>

                    {/* Pending Requests Table */}
                    <div className="mb-3">
                      <h6 className="small fw-semibold mb-2">Pending Requests</h6>
                      {vacationRequests.filter(r => r.status === 'pending').length === 0 && sickRequests.filter(r => r.status === 'pending').length === 0 ? (
                        <p className="text-muted small mb-0">No pending requests</p>
                      ) : (
                        <div style={{ overflowX: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                          <table className="table table-sm table-hover mb-0" style={{ fontSize: '0.8rem' }}>
                            <thead className="table-light">
                              <tr>
                                <th>Type</th>
                                <th>From</th>
                                <th>To</th>
                                <th>Days</th>
                                <th>Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {[...vacationRequests, ...sickRequests]
                                .filter(r => r.status === 'pending')
                                .map(req => (
                                  <tr key={req.id}>
                                    <td>{req.leave_type === 'vacation' ? '🏖️ Vacation' : '🤒 Sick'}</td>
                                    <td>{req.start_date}</td>
                                    <td>{req.end_date}</td>
                                    <td>{req.days_requested ?? '—'}</td>
                                    <td>
                                      <span className={`badge bg-${statusColor(req.status)}`} style={{ fontSize: '0.7rem' }}>
                                        {req.status}
                                      </span>
                                    </td>
                                  </tr>
                                ))
                              }
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    {/* Action Button */}
                    <button
                      type="button"
                      className="btn btn-primary btn-sm w-100"
                      onClick={() => openLeaveModal()}
                    >
                      <PlusCircleIcon className="h-4 w-4 me-1" style={{ display: 'inline' }} />
                      Request Leave
                    </button>
                  </>
                )}
              </div>

            </div>
          </div>
        )}

      {/* Wages Content */}
      {openAccordion === 'wages' && (
        <div
          className="accordion-popup"
          style={{
            position: 'fixed',
            top: 0,
            bottom: `${row1PanelBottom}px`,
            left: 0,
            right: 0,
            width: '100%',
            height: `calc(100dvh - ${row1PanelBottom}px)`,
            overflowY: 'auto',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            backgroundColor: 'var(--bs-body-bg)',
            zIndex: 1000,
            paddingTop: '1rem',
            paddingLeft: '1rem',
            paddingRight: '1rem',
            paddingBottom: '0.25rem',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ flexGrow: 1 }} />
          <div style={{ flexShrink: 0 }}>
            <h6 className="fw-semibold mb-3">Wage History</h6>
            {paySlipsLoading ? (
              <div className="text-center py-4">
                <div className="spinner-border spinner-border-sm text-primary" role="status" />
              </div>
            ) : paySlips.length === 0 ? (
              <p className="text-muted small">No pay slips on record.</p>
            ) : (
              <div style={{ overflowX: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                <table className="table table-sm table-hover mb-0" style={{ fontSize: '0.8rem' }}>
                  <thead className="table-light">
                    <tr>
                      <th>Period</th>
                      <th className="text-end">Gross</th>
                      <th className="text-end">Deductions</th>
                      <th className="text-end">Net</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {paySlips.map(slip => (
                      <tr key={slip.id}>
                        <td>{slip.pay_period_start ? new Date(slip.pay_period_start).toLocaleDateString() : '—'}</td>
                        <td className="text-end">${Number(slip.gross_amount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        <td className="text-end text-danger">-${Number((slip.insurance_deduction ?? 0) + (slip.other_deductions ?? 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        <td className="text-end fw-semibold">${Number(slip.net_amount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-secondary py-0 px-1"
                            style={{ fontSize: '0.7rem' }}
                            onClick={() => setSelectedSlip(slip)}
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Settings Content */}
      {openAccordion === 'settings' && (
        <div 
          className="accordion-popup" 
          style={{ 
            position: 'fixed',
            top: 0,
            bottom: `${row1PanelBottom}px`,
            left: 0,
            right: 0,
            width: '100%',
            height: `calc(100dvh - ${row1PanelBottom}px)`,
            overflowY: 'auto',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            backgroundColor: 'var(--bs-body-bg)',
            zIndex: 1000,
            paddingTop: '1rem',
            paddingLeft: '1rem',
            paddingRight: '1rem',
            paddingBottom: '0.25rem',
            boxShadow: '0 -2px 10px rgba(0,0,0,0.1)',
            
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          {/* Database Environment - Top */}
          <div>
            <div className="d-flex align-items-center flex-wrap gap-1 mb-2">
              <span className="text-muted small me-1">Environment</span>
              {Object.entries(DB_ENVIRONMENTS).map(([key, env]) => {
                const isCurrent = key === currentDbEnvironment;
                return (
                  <span
                    key={key}
                    role="radio"
                    aria-checked={isCurrent}
                    tabIndex={0}
                    className={`badge rounded-pill px-3 py-2 ${isCurrent ? 'bg-primary text-white' : 'bg-transparent text-secondary border'}`}
                    style={{ cursor: isCurrent || dbLoading ? 'default' : 'pointer', fontSize: '0.8rem', transition: 'all 0.15s ease', userSelect: 'none' }}
                    onClick={() => !isCurrent && !dbLoading && handleSwitchEnvironment(key)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); !isCurrent && !dbLoading && handleSwitchEnvironment(key); } }}
                  >
                    {env.name}
                  </span>
                );
              })}
              {dbLoading && (
                <div className="spinner-border spinner-border-sm text-primary" role="status">
                  <span className="visually-hidden">Updating...</span>
                </div>
              )}
            </div>
            {dbMessage && <div className="small text-success mt-1">{dbMessage}</div>}
            {dbError && <div className="small text-danger mt-1">{dbError}</div>}
          </div>

          {/* Spacer */}
          <div style={{ flexGrow: 1 }}></div>

          {/* Action Buttons - Bottom */}
          <div className="d-flex align-items-center justify-content-start gap-1 mb-3 flex-wrap" style={{ minHeight: '3rem' }}>
            {/* Dark Mode Toggle */}
            <Button_Toolbar
              icon={isDarkMode ? MoonIcon : SunIcon}
              label={isDarkMode ? 'Light Mode' : 'Dark Mode'}
              onClick={toggleDarkMode}
              className={isDarkMode ? 'text-white' : ''}
              style={{ backgroundColor: isDarkMode ? '#3B82F6' : '#F59E0B', border: 'none' }}
            />

            {/* Calendar Color */}
            <div className="position-relative">
              <Button_Toolbar
                icon={CalendarDaysIcon}
                label="Calendar Color"
                onClick={() => { setPendingColor(employeeColor); setColorPickerOpen(prev => !prev); }}
                className=""
                style={{ backgroundColor: employeeColor, border: '2px solid var(--bs-border-color, #dee2e6)', color: 'white' }}
                disabled={colorUpdating}
                aria-expanded={colorPickerOpen}
              />
              {colorPickerOpen && (
                <div
                  className="position-absolute bottom-100 mb-2 start-0 p-2 border rounded bg-white dark:bg-gray-800 shadow-lg"
                  style={{ minWidth: '210px', zIndex: 10 }}
                >
                  <div className="d-flex align-items-center gap-2 mb-2">
                    <input
                      type="color"
                      value={pendingColor}
                      onChange={(e) => setPendingColor(e.target.value)}
                      className="form-control form-control-sm"
                      style={{ width: '50px', height: '38px', padding: '4px', cursor: colorUpdating ? 'not-allowed' : 'pointer', opacity: colorUpdating ? 0.6 : 1 }}
                      disabled={colorUpdating}
                    />
                    <span className="small text-muted">{pendingColor.toUpperCase()}</span>
                  </div>
                  <div className="d-flex gap-2 justify-content-end">
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-secondary"
                      onClick={() => { setPendingColor(employeeColor); setColorPickerOpen(false); }}
                      disabled={colorUpdating}
                    >Cancel</button>
                    <button
                      type="button"
                      className="btn btn-sm btn-primary"
                      onClick={handleColorSave}
                      disabled={colorUpdating}
                    >Save</button>
                  </div>
                </div>
              )}
            </div>

            {/* Signature */}
            <Button_Toolbar
              icon={user?.signature_data || user?.signature_url ? PencilSquareIcon : PencilIcon}
              label="Signature"
              onClick={() => setSignatureModalOpen(true)}
              className="btn-outline-secondary"
            />

            {/* Training / Compact Mode Toggle */}
            <button
              type="button"
              onClick={toggleViewMode}
              className="btn btn-sm btn-outline-secondary rounded-pill px-2 d-flex align-items-center gap-1"
              style={{ height: '2.25rem' }}
              title={isTrainingMode ? 'Switch to compact mode' : 'Switch to training mode'}
            >
              {isTrainingMode
                ? <Squares2X2Icon className="h-4 w-4" />
                : <AcademicCapIcon className="h-4 w-4" />}
              <span style={{ fontSize: '0.78rem' }}>{isTrainingMode ? 'Compact' : 'Training'}</span>
            </button>

            {/* Logout */}
            <Button_Toolbar
              icon={ArrowLeftOnRectangleIcon}
              label="Log out"
              onClick={handleLogout}
              className="btn-outline-secondary"
            />
          </div>

          {colorMessage && (
            <div className={`small mb-2 ${colorMessage.includes('Failed') || colorMessage.includes('Error') ? 'text-danger' : 'text-success'}`}>
              {colorMessage}
            </div>
          )}
        </div>
        )}

      {/* ── Schedule Panel ────────────────────────────────────────────────────── */}
      {openAccordion === 'schedule' && canAccessSettings && (
        <div className="accordion-popup" style={settingsPanelStyle}>
          <div style={{ flexGrow: 1 }} />
          <div style={{ flexShrink: 0, width: '100%' }}>

            {/* Company Info */}
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <BriefcaseIcon className="h-5 w-5" /> Company Info
            </h2>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="form-floating">
                <input type="text" id="company_name" value={companyInfo.company_name}
                  onChange={(e) => handleCompanyInfoChange('company_name', e.target.value)}
                  className="form-control form-control-sm" placeholder="Company Name" />
                <label htmlFor="company_name">Company Name</label>
              </div>
              <div className="form-floating">
                <input type="email" id="company_email" value={companyInfo.company_email}
                  onChange={(e) => handleCompanyInfoChange('company_email', e.target.value)}
                  className="form-control form-control-sm" placeholder="Company Email" />
                <label htmlFor="company_email">Company Email</label>
              </div>
              <div className="form-floating">
                <input type="text" id="company_phone" value={companyInfo.company_phone}
                  onChange={(e) => handleCompanyInfoChange('company_phone', e.target.value)}
                  className="form-control form-control-sm" placeholder="Company Phone" />
                <label htmlFor="company_phone">Company Phone</label>
              </div>
              <div className="form-floating">
                <input type="text" id="company_address" value={companyInfo.company_address}
                  onChange={(e) => handleCompanyInfoChange('company_address', e.target.value)}
                  className="form-control form-control-sm" placeholder="Company Address" />
                <label htmlFor="company_address">Company Address</label>
              </div>
            </div>
            <div className="mb-6">
              <button
                type="button"
                onClick={handleSaveCompanyInfo}
                className="btn btn-primary btn-sm"
                disabled={companyLoading}
              >
                {companyLoading ? 'Saving...' : 'Save Company Info'}
              </button>
            </div>

            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <ClockIcon className="h-5 w-5" /> Schedule Settings
            </h2>

            {/* Business Hours */}
            <div className="mb-6">
              <h3 className="text-base font-medium text-gray-900 dark:text-white mb-3 flex items-center">
                Business Hours <HelpIcon id="business-hours" text="Set the visible time range for your schedule calendar" />
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="form-floating">
                  <input type="time" id="start_of_day" value={scheduleSettings.start_of_day}
                    onChange={(e) => handleScheduleSettingsChange('start_of_day', e.target.value)}
                    className="form-control form-control-sm" placeholder="Start of Day" />
                  <label htmlFor="start_of_day">Start of Day</label>
                </div>
                <div className="form-floating">
                  <input type="time" id="end_of_day" value={scheduleSettings.end_of_day}
                    onChange={(e) => handleScheduleSettingsChange('end_of_day', e.target.value)}
                    className="form-control form-control-sm" placeholder="End of Day" />
                  <label htmlFor="end_of_day">End of Day</label>
                </div>
              </div>
            </div>

            {/* Days of Operation */}
            <div className="mb-6">
              <h3 className="text-base font-medium text-gray-900 dark:text-white mb-3 flex items-center">
                Days of Operation <HelpIcon id="days-of-operation" text="Select which days your business operates" />
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { key: 'monday_enabled', label: 'Mon', fullLabel: 'Monday' },
                  { key: 'tuesday_enabled', label: 'Tue', fullLabel: 'Tuesday' },
                  { key: 'wednesday_enabled', label: 'Wed', fullLabel: 'Wednesday' },
                  { key: 'thursday_enabled', label: 'Thu', fullLabel: 'Thursday' },
                  { key: 'friday_enabled', label: 'Fri', fullLabel: 'Friday' },
                  { key: 'saturday_enabled', label: 'Sat', fullLabel: 'Saturday' },
                  { key: 'sunday_enabled', label: 'Sun', fullLabel: 'Sunday' },
                ].map(day => (
                  <div key={day.key} className="flex items-center p-2 bg-gray-50 dark:bg-gray-900 rounded-lg">
                    <input type="checkbox" id={day.key} checked={scheduleSettings[day.key]}
                      onChange={(e) => handleScheduleSettingsChange(day.key, e.target.checked)}
                      className="h-4 w-4 rounded" />
                    <label htmlFor={day.key} className="ml-2 text-sm font-medium cursor-pointer">
                      <span className="hidden sm:inline">{day.fullLabel}</span>
                      <span className="sm:hidden">{day.label}</span>
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* Attendance */}
            <div className="mb-6">
              <h3 className="text-base font-medium text-gray-900 dark:text-white mb-3 flex items-center">
                Attendance <HelpIcon id="attendance-section" text="Configure employee clock in/out tracking" />
              </h3>
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <div className="flex items-center">
                  <span className="text-sm font-medium">Attendance Check-in</span>
                  <HelpIcon id="attendance" text="Show clock in/out widget on Schedule page" />
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" checked={scheduleSettings.attendance_check_in_required}
                    onChange={(e) => handleScheduleSettingsChange('attendance_check_in_required', e.target.checked)}
                    className="sr-only peer" />
                  <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>

            <button onClick={handleSaveScheduleSettings} disabled={scheduleLoading}
              className="btn btn-primary btn-sm px-4">
              {scheduleLoading ? 'Saving…' : 'Save'}
            </button>

            {settingsError && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-800 text-sm">
                <ExclamationTriangleIcon className="h-4 w-4 flex-shrink-0" />{settingsError}
              </div>
            )}
            {settingsSuccess && (
              <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-800 text-sm">
                <CheckCircleIcon className="h-4 w-4 flex-shrink-0" />{settingsSuccess}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── General Panel ─────────────────────────────────────────────────────── */}
      {openAccordion === 'general' && canAccessSettings && (
        <div className="accordion-popup" style={settingsPanelStyle}>
          <div style={{ flexGrow: 1 }} />
          <div style={{ flexShrink: 0, width: '100%' }}>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <CogIcon className="h-5 w-5" /> General Settings
            </h2>

            {/* Application */}
            <div className="mb-2">
              <button onClick={() => toggleAccordion('application')}
                className="w-full d-flex align-items-center justify-content-between py-3 bg-transparent text-start"
                style={{ border: 'none', borderBottom: '1px solid var(--bs-border-color)' }}>
                <div className="d-flex align-items-center gap-2">
                  <InformationCircleIcon className="h-5 w-5 text-blue-500" />
                  <span className="fw-medium">Application</span>
                </div>
                <ChevronDownIcon className="h-4 w-4 text-gray-500"
                  style={{ transition: 'transform 0.2s', transform: openAccordions.application ? 'rotate(180deg)' : 'none' }} />
              </button>
              {openAccordions.application && (
                <div className="accordion-popup py-3">
                  <div className="row g-2">
                    <div className="col-6">
                      <div className="d-flex align-items-center justify-content-between p-2 bg-light rounded">
                        <span className="small fw-medium">Version</span>
                        <span className="small text-muted">1.0.0</span>
                      </div>
                    </div>
                    <div className="col-6">
                      <div className="d-flex align-items-center justify-content-between p-2 bg-light rounded">
                        <span className="small fw-medium">Environment</span>
                        <span className="small text-muted">{import.meta.env.DEV ? 'Development' : 'Production'}</span>
                      </div>
                    </div>
                    <div className="col-12">
                      <button
                        type="button"
                        onClick={handleManualSync}
                        disabled={syncLoading}
                        className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-2"
                      >
                        <ArrowPathIcon className="h-4 w-4" />
                        <span>{syncLoading ? 'Syncing…' : 'Sync Now'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Branding */}
            <div className="mb-2">
              <button onClick={() => toggleAccordion('branding')}
                className="w-full d-flex align-items-center justify-content-between py-3 bg-transparent text-start"
                style={{ border: 'none', borderBottom: '1px solid var(--bs-border-color)' }}>
                <div className="d-flex align-items-center gap-2">
                  <SwatchIcon className="h-5 w-5 text-purple-500" />
                  <span className="fw-medium">Branding</span>
                </div>
                <ChevronDownIcon className="h-4 w-4 text-gray-500"
                  style={{ transition: 'transform 0.2s', transform: openAccordions.branding ? 'rotate(180deg)' : 'none' }} />
              </button>
              {openAccordions.branding && (
                <div className="accordion-popup py-3 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="form-floating">
                      <input type="text" id="companyName" value={localBranding.companyName}
                        onChange={(e) => handleBrandingChange('companyName', e.target.value)}
                        className="form-control form-control-sm" placeholder="Company Name" />
                      <label htmlFor="companyName">Company Name</label>
                    </div>
                    <div className="form-floating">
                      <input type="text" id="tagline" value={localBranding.tagline}
                        onChange={(e) => handleBrandingChange('tagline', e.target.value)}
                        className="form-control form-control-sm" placeholder="Tagline" />
                      <label htmlFor="tagline">Tagline</label>
                    </div>
                  </div>
                  <div className="form-floating">
                    <input type="url" id="logoUrl" value={localBranding.logoUrl}
                      onChange={(e) => handleBrandingChange('logoUrl', e.target.value)}
                      className="form-control form-control-sm" placeholder="Logo URL" />
                    <label htmlFor="logoUrl">Logo URL</label>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { key: 'primaryColor', label: 'Primary', helpId: 'primary-color', helpText: 'Main buttons and links' },
                      { key: 'secondaryColor', label: 'Secondary', helpId: 'secondary-color', helpText: 'Success states and highlights' },
                      { key: 'accentColor', label: 'Accent', helpId: 'accent-color', helpText: 'Special elements and badges' },
                    ].map(({ key, label, helpId, helpText }) => (
                      <div key={key}>
                        <label className="flex items-center text-sm font-medium mb-1">
                          {label} <HelpIcon id={helpId} text={helpText} />
                        </label>
                        <div className="flex items-center gap-2">
                          <input type="color" value={localBranding[key]}
                            onChange={(e) => handleBrandingChange(key, e.target.value)}
                            className="rounded border cursor-pointer flex-shrink-0" style={{ width: '2.5rem', height: '2.5rem' }} />
                          <input type="text" value={localBranding[key]}
                            onChange={(e) => handleBrandingChange(key, e.target.value)}
                            className="flex-1 min-w-0 px-2 py-1 border rounded text-xs font-mono" />
                        </div>
                      </div>
                    ))}
                  </div>
                  <button onClick={handleSaveBranding} className="btn btn-primary btn-sm px-4">
                    Save Branding
                  </button>
                </div>
              )}
            </div>

            {/* Notifications */}
            <div className="mb-2">
              <button onClick={() => toggleAccordion('notifications')}
                className="w-full d-flex align-items-center justify-content-between py-3 bg-transparent text-start"
                style={{ border: 'none', borderBottom: '1px solid var(--bs-border-color)' }}>
                <div className="d-flex align-items-center gap-2">
                  <BellIcon className="h-5 w-5 text-amber-500" />
                  <span className="fw-medium">Notifications</span>
                </div>
                <ChevronDownIcon className="h-4 w-4 text-gray-500"
                  style={{ transition: 'transform 0.2s', transform: openAccordions.notifications ? 'rotate(180deg)' : 'none' }} />
              </button>
              {openAccordions.notifications && (
                <div className="accordion-popup py-3 space-y-3">
                  {[
                    { key: 'emailEnabled', label: 'Email Notifications', helpId: 'email-notif', helpText: 'Receive updates via email' },
                    { key: 'appointmentReminders', label: 'Appointment Reminders', helpId: 'appt-reminders', helpText: 'Get reminded before appointments' },
                    { key: 'dailyDigest', label: 'Daily Digest', helpId: 'daily-digest', helpText: 'Receive a daily summary email' },
                  ].map(({ key, label, helpId, helpText }) => (
                    <div key={key} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                      <div className="flex items-center">
                        <span className="text-sm font-medium">{label}</span>
                        <HelpIcon id={helpId} text={helpText} />
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" checked={notifications[key]}
                          onChange={(e) => handleNotificationChange(key, e.target.checked)}
                          className="sr-only peer" />
                        <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>
                  ))}
                  <button onClick={handleSaveNotifications} className="btn btn-primary btn-sm px-4">
                    Save Notifications
                  </button>
                </div>
              )}
            </div>

            {settingsSuccess && (
              <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-800 text-sm">
                <CheckCircleIcon className="h-4 w-4 flex-shrink-0" />{settingsSuccess}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Database Panel ─────────────────────────────────────────────────────── */}
      {openAccordion === 'database' && canAccessSettings && (
        <div className="accordion-popup" style={settingsPanelStyle}>
          <div style={{ flexGrow: 1 }} />
          <div style={{ flexShrink: 0, width: '100%' }}>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <CircleStackIcon className="h-5 w-5" /> Database Settings
            </h2>

            <div className="mb-6">
              <Manager_DatabaseConnection />
            </div>

            <div className="border-t border-gray-200 pt-4">
              <h3 className="text-base font-medium mb-3 flex items-center">
                <ArrowUpTrayIcon className="h-5 w-5 mr-2" />
                Data Import
                <HelpIcon id="data-import" text="Import data from CSV files into database tables" />
              </h3>

              {/* Table Selection */}
              <div className="mb-3">
                <label className="flex items-center text-sm font-medium mb-1">
                  Select Table <HelpIcon id="select-table" text="Choose which database table to import data into" />
                </label>
                <select value={selectedTable} onChange={(e) => setSelectedTable(e.target.value)}
                  className="form-select form-select-sm">
                  <option value="">-- Select a table --</option>
                  {availableTables.map(t => (
                    <option key={t.name} value={t.name}>{t.display_name}</option>
                  ))}
                </select>
              </div>

              {/* Table Columns */}
              {selectedTable && tableColumns.length > 0 && (
                <div className="mb-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                  <h4 className="text-sm font-medium mb-2 flex items-center">
                    <TableCellsIcon className="h-4 w-4 mr-1" /> Table Columns
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {tableColumns.filter(col => !col.auto_generated).map(col => (
                      <span key={col.name}
                        className={`px-2 py-1 text-xs rounded ${col.required ? 'bg-red-100 text-red-700' : 'bg-gray-200 text-gray-700'}`}
                        title={`Type: ${col.type}${col.required ? ' (Required)' : ''}`}>
                        {col.display_name}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    <span className="inline-block w-3 h-3 bg-red-100 rounded mr-1"></span>Required fields
                  </p>
                </div>
              )}

              {/* CSV Upload */}
              {selectedTable && (
                <div className="mb-3">
                  <label className="flex items-center text-sm font-medium mb-1">
                    Upload CSV File <HelpIcon id="csv-upload" text="First row should contain column headers" />
                  </label>
                  <div className="d-flex align-items-center gap-2">
                    <input ref={csvFileInputRef} type="file" accept=".csv" onChange={handleFileSelect}
                      className="form-control form-control-sm flex-1" />
                    {csvData && (
                      <button onClick={resetImport} className="btn btn-outline-secondary btn-sm">Clear</button>
                    )}
                  </div>
                </div>
              )}

              {/* Column Mapping */}
              {csvData && csvHeaders.length > 0 && (
                <div className="mb-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                  <h4 className="text-sm font-medium mb-2 flex items-center">
                    <DocumentTextIcon className="h-4 w-4 mr-1" />
                    Column Mapping <HelpIcon id="column-mapping" text="Match CSV columns to database columns" />
                  </h4>
                  <div className="space-y-2" style={{ maxHeight: '12rem', overflowY: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                    {csvHeaders.map(header => (
                      <div key={header} className="d-flex align-items-center gap-2">
                        <span className="small fw-medium text-truncate" style={{ minWidth: '8rem', maxWidth: '8rem' }}>{header}</span>
                        <span className="text-muted">→</span>
                        <select value={columnMapping[header] || ''} onChange={(e) => handleColumnMappingChange(header, e.target.value)}
                          className="form-select form-select-sm flex-1">
                          <option value="">-- Skip --</option>
                          {tableColumns.filter(col => !col.auto_generated).map(col => (
                            <option key={col.name} value={col.name}>{col.display_name}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">{csvData.length} rows found in CSV</p>
                </div>
              )}

              {/* Import Button */}
              {csvData && Object.keys(columnMapping).filter(k => columnMapping[k]).length > 0 && (
                <button onClick={handleImport} disabled={importLoading}
                  className="btn btn-success btn-sm d-flex align-items-center gap-2">
                  <ArrowUpTrayIcon className="h-4 w-4" />
                  {importLoading ? 'Importing…' : `Import ${csvData.length} Records`}
                </button>
              )}

              {/* Import Result */}
              {importResult && (
                <div className={`mt-3 p-3 rounded-lg border ${importResult.errors?.length > 0 ? 'bg-yellow-50 border-yellow-200' : 'bg-green-50 border-green-200'}`}>
                  <div className="d-flex align-items-center gap-2 mb-2">
                    <CheckCircleIcon className={`h-5 w-5 flex-shrink-0 ${importResult.errors?.length > 0 ? 'text-yellow-600' : 'text-green-600'}`} />
                    <span className="small">Imported {importResult.imported} of {importResult.total} records</span>
                  </div>
                  {importResult.errors?.length > 0 && (
                    <div className="text-xs text-yellow-700 mt-1">
                      <p className="fw-medium mb-1">Errors:</p>
                      <ul className="list-unstyled mb-0">
                        {importResult.errors.slice(0, 5).map((err, idx) => (
                          <li key={idx}>Row {err.row}: {err.error}</li>
                        ))}
                        {importResult.errors.length > 5 && <li>…and {importResult.errors.length - 5} more</li>}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {settingsError && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg d-flex align-items-center gap-2 text-danger text-sm">
                  <ExclamationTriangleIcon className="h-4 w-4 flex-shrink-0" />{settingsError}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Leave Management Panel */}
      {leaveManagementOpen && (
        <div 
          style={{
            position: 'fixed',
            bottom: `${row1PanelBottom}px`,
            left: 0,
            right: 0,
            maxHeight: 'calc(100vh - 164px)',
            overflowY: 'auto',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            backgroundColor: 'var(--bs-body-bg)',  
            zIndex: 1000,
          }}
          className="accordion-popup"
        >
          <div className="card border-0 rounded-0" style={{ minHeight: '200px' }}>
            <div className="card-body">
              <h6 className="card-title mb-3">Leave Management</h6>
              
              {leaveRequestsLoading ? (
                <div className="text-center py-4">
                  <div className="spinner-border spinner-border-sm text-primary" role="status" />
                </div>
              ) : (
                <>
                  {/* Leave Summary */}
                  <div className="row g-2 mb-3">
                    <div className="col-6">
                      <div className="bg-light rounded p-2 small">
                        <div className="fw-semibold text-primary">Vacation Days</div>
                        <div className="text-muted small mb-1">{vacUsed} / {vacTotal} used</div>
                        <div className="progress" style={{ height: '4px' }}>
                          <div className="progress-bar bg-primary" style={{
                            width: `${vacTotal > 0 ? Math.min(100, (vacUsed / vacTotal) * 100) : 0}%`
                          }} />
                        </div>
                        <div className="text-muted small mt-1">{vacRemaining} remaining</div>
                      </div>
                    </div>
                    <div className="col-6">
                      <div className="bg-light rounded p-2 small">
                        <div className="fw-semibold text-warning">Sick Days</div>
                        <div className="text-muted small mb-1">{sickUsed} / {sickTotal} used</div>
                        <div className="progress" style={{ height: '4px' }}>
                          <div className="progress-bar bg-warning" style={{
                            width: `${sickTotal > 0 ? Math.min(100, (sickUsed / sickTotal) * 100) : 0}%`
                          }} />
                        </div>
                        <div className="text-muted small mt-1">{sickRemaining} remaining</div>
                      </div>
                    </div>
                  </div>

                  {/* Pending Requests Table */}
                  <div className="mb-3">
                    <h6 className="small fw-semibold mb-2">Pending Requests</h6>
                    {vacationRequests.filter(r => r.status === 'pending').length === 0 && sickRequests.filter(r => r.status === 'pending').length === 0 ? (
                      <p className="text-muted small mb-0">No pending requests</p>
                    ) : (
                      <div style={{ overflowX: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                        <table className="table table-sm table-hover mb-0" style={{ fontSize: '0.8rem' }}>
                          <thead className="table-light">
                            <tr>
                              <th>Type</th>
                              <th>From</th>
                              <th>To</th>
                              <th>Days</th>
                              <th>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {[...vacationRequests, ...sickRequests]
                              .filter(r => r.status === 'pending')
                              .map(req => (
                                <tr key={req.id}>
                                  <td>{req.leave_type === 'vacation' ? '🏖️ Vacation' : '🤒 Sick'}</td>
                                  <td>{req.start_date}</td>
                                  <td>{req.end_date}</td>
                                  <td>{req.days_requested ?? '—'}</td>
                                  <td>
                                    <span className={`badge bg-${statusColor(req.status)}`} style={{ fontSize: '0.7rem' }}>
                                      {req.status}
                                    </span>
                                  </td>
                                </tr>
                              ))
                            }
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Action Button */}
                  <div className="d-flex gap-2">
                    <button
                      type="button"
                      className="btn btn-primary btn-sm flex-grow-1"
                      onClick={() => openLeaveModal()}
                    >
                      <PlusCircleIcon className="h-4 w-4 me-1" style={{ display: 'inline' }} />
                      Request Leave
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-sm"
                      onClick={() => setLeaveManagementOpen(false)}
                    >
                      Close
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Footer Tabs */}
      <div
        className="flex-shrink-0 bg-body profile-footer-nav"
        style={{ zIndex: 10 }}
      >
        {/* Row 1 — Personal: Profile, Benefits, Settings */}
        <div ref={row1Ref} className="d-flex align-items-center gap-1 ps-3 pe-3 pt-2 flex-wrap">
          {[
            { id: 'profile',   Icon: UserIcon,           title: 'Profile'   },
            { id: 'benefits',  Icon: HeartIcon,          title: 'Benefits'  },
            { id: 'wages',     Icon: CurrencyDollarIcon, title: 'Wages'     },
            { id: 'settings',  Icon: CogIcon,            title: 'Settings'  },
          ].map(({ id, Icon, title }) => (
            <Button_Toolbar
              key={id}
              icon={Icon}
              label={title}
              onClick={() => setOpenAccordion(openAccordion === id ? '' : id)}
              className={`btn btn-sm flex-shrink-0 d-flex align-items-center justify-content-center ${openAccordion === id ? 'btn-primary' : 'btn-outline-secondary'}`}
              data-active={openAccordion === id}
            />
          ))}
        </div>

        {/* Row 2 — Admin/Settings: Schedule, General, Database */}
        {canAccessSettings && (
          <div ref={handleRow2Ref} className="d-flex align-items-center gap-1 p-4 ps-3 pe-3 pt-1 flex-wrap
          "
          >
            {[
              { id: 'schedule', Icon: ClockIcon,        title: 'Schedule' },
              { id: 'general',  Icon: CogIcon,          title: 'General'  },
              { id: 'database', Icon: CircleStackIcon,  title: 'Database' },
            ].map(({ id, Icon, title }) => (
              <Button_Toolbar
                key={id}
                icon={Icon}
                label={title}
                onClick={() => setOpenAccordion(openAccordion === id ? '' : id)}
                className={`btn btn-sm flex-shrink-0 d-flex align-items-center justify-content-center ${openAccordion === id ? 'btn-primary' : 'btn-outline-secondary'}`}
                data-active={openAccordion === id}
              />
            ))}
          </div>
        )}
      </div>

      {/* Signature Modal */}
      <Modal_Signature
        isOpen={signatureModalOpen}
        onClose={() => setSignatureModalOpen(false)}
        userId={user?.id}
      />

      {/* Request Modal */}
      {showLeaveModal && (
        <div
          className="modal d-block"
          tabIndex="-1"
          style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
          onClick={(e) => { if (e.target === e.currentTarget) { setShowLeaveModal(false); setLeaveError(''); } }}
        >
          <div className="modal-dialog modal-sm modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header py-2">
                <h6 className="modal-title mb-0">New Request</h6>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => { setShowLeaveModal(false); setLeaveError(''); }}
                />
              </div>
              <form onSubmit={handleLeaveSubmit}>
                <div className="modal-body py-3">
                  {leaveError && (
                    <div className="alert alert-danger py-1 small mb-2">{leaveError}</div>
                  )}
                  <div className="mb-2">
                    <label className="form-label small mb-1">Request Type</label>
                    <select
                      className="form-select form-select-sm"
                      value={leaveModalType}
                      onChange={e => {
                        setLeaveModalType(e.target.value);
                        setLeaveForm({ start_date: '', end_date: '', notes: '' });
                        setLeaveError('');
                      }}
                    >
                      <option value="vacation">Vacation Leave</option>
                      <option value="sick">Sick Leave</option>
                      <option value="onboarding">Onboarding</option>
                      <option value="offboarding">Offboarding</option>
                    </select>
                  </div>
                  {(leaveModalType === 'vacation' || leaveModalType === 'sick') ? (
                    <>
                      <div className="mb-2">
                        <label className="form-label small mb-1">Start Date</label>
                        <input
                          type="date"
                          className="form-control form-control-sm"
                          value={leaveForm.start_date}
                          onChange={e => setLeaveForm(f => ({ ...f, start_date: e.target.value }))}
                          required
                        />
                      </div>
                      <div className="mb-2">
                        <label className="form-label small mb-1">End Date</label>
                        <input
                          type="date"
                          className="form-control form-control-sm"
                          value={leaveForm.end_date}
                          min={leaveForm.start_date || undefined}
                          onChange={e => setLeaveForm(f => ({ ...f, end_date: e.target.value }))}
                          required
                        />
                      </div>
                    </>
                  ) : (
                    <div className="mb-2">
                      <label className="form-label small mb-1">Requested Date (optional)</label>
                      <input
                        type="date"
                        className="form-control form-control-sm"
                        value={leaveForm.start_date}
                        onChange={e => setLeaveForm(f => ({ ...f, start_date: e.target.value }))}
                      />
                    </div>
                  )}
                  <div className="mb-0">
                    <label className="form-label small mb-1">Notes (optional)</label>
                    <textarea
                      className="form-control form-control-sm"
                      rows="2"
                      value={leaveForm.notes}
                      onChange={e => setLeaveForm(f => ({ ...f, notes: e.target.value }))}
                      placeholder="Reason or additional info..."
                    />
                  </div>
                </div>
                <div className="modal-footer py-2">
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm"
                    onClick={() => { setShowLeaveModal(false); setLeaveError(''); }}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary btn-sm" disabled={leaveSubmitting}>
                    {leaveSubmitting ? 'Submitting…' : 'Submit Request'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Pay Slip Detail Modal */}
      {selectedSlip && (
        <div
          className="modal d-block"
          tabIndex="-1"
          style={{ backgroundColor: 'rgba(0,0,0,0.55)', zIndex: 2000 }}
          onClick={(e) => { if (e.target === e.currentTarget) setSelectedSlip(null); }}
        >
          <div className="modal-dialog modal-dialog-centered modal-sm">
            <div className="modal-content" id="pay-slip-print-area">
              <div className="modal-header py-2">
                <h6 className="modal-title mb-0">Pay Slip</h6>
                <button type="button" className="btn-close" onClick={() => setSelectedSlip(null)} />
              </div>
              <div className="modal-body" style={{ fontSize: '0.85rem' }}>
                <div className="text-center mb-3">
                  <div className="fw-bold fs-6">{user?.first_name} {user?.last_name}</div>
                  <div className="text-muted small">{user?.role}</div>
                </div>
                <hr className="my-2" />
                <div className="row g-1 mb-2">
                  <div className="col-6 text-muted">Pay Period</div>
                  <div className="col-6 text-end">{selectedSlip.pay_period_start ? new Date(selectedSlip.pay_period_start).toLocaleDateString() : '—'} – {selectedSlip.pay_period_end ? new Date(selectedSlip.pay_period_end).toLocaleDateString() : '—'}</div>
                  <div className="col-6 text-muted">Type</div>
                  <div className="col-6 text-end" style={{ textTransform: 'capitalize' }}>{selectedSlip.employment_type || '—'}</div>
                  {selectedSlip.employment_type === 'hourly' && (
                    <>
                      <div className="col-6 text-muted">Hours</div>
                      <div className="col-6 text-end">{selectedSlip.hours_worked ?? '—'}</div>
                      <div className="col-6 text-muted">Rate</div>
                      <div className="col-6 text-end">${Number(selectedSlip.hourly_rate_snapshot ?? 0).toFixed(2)}/hr</div>
                    </>
                  )}
                  <div className="col-6 text-muted">Pay Frequency</div>
                  <div className="col-6 text-end" style={{ textTransform: 'capitalize' }}>{selectedSlip.pay_frequency || '—'}</div>
                </div>
                <hr className="my-2" />
                <div className="row g-1">
                  <div className="col-6 text-muted">Gross Pay</div>
                  <div className="col-6 text-end">${Number(selectedSlip.gross_amount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                  {selectedSlip.insurance_plan_name && (
                    <>
                      <div className="col-6 text-muted small">Insurance ({selectedSlip.insurance_plan_name})</div>
                      <div className="col-6 text-end text-danger small">-${Number(selectedSlip.insurance_deduction ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                    </>
                  )}
                  {(selectedSlip.other_deductions ?? 0) > 0 && (
                    <>
                      <div className="col-6 text-muted small">Other Deductions</div>
                      <div className="col-6 text-end text-danger small">-${Number(selectedSlip.other_deductions).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                    </>
                  )}
                  <div className="col-6 fw-bold border-top pt-1 mt-1">Net Pay</div>
                  <div className="col-6 fw-bold text-end border-top pt-1 mt-1 text-success">${Number(selectedSlip.net_amount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                </div>
                {selectedSlip.notes && (
                  <div className="mt-2 text-muted small">Notes: {selectedSlip.notes}</div>
                )}
              </div>
              <div className="modal-footer py-2">
                <button
                  type="button"
                  className="btn btn-sm btn-outline-primary"
                  onClick={() => {
                    const el = document.getElementById('pay-slip-print-area');
                    if (el) {
                      const w = window.open('', '_blank');
                      w.document.write('<html><head><title>Pay Slip</title><link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css"></head><body class="p-3">' + el.innerHTML + '</body></html>');
                      w.document.close();
                      w.focus();
                      setTimeout(() => { w.print(); }, 500);
                    }
                  }}
                >
                  Print
                </button>
                <button type="button" className="btn btn-sm btn-secondary" onClick={() => setSelectedSlip(null)}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}


    </div>
  );
};

export default Profile;
