import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useStore from '../services/useStore';
import useDarkMode from '../services/useDarkMode';
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
} from '@heroicons/react/24/outline';
import { employeesAPI, leaveRequestsAPI } from '../services/api';
import api from '../services/api';
import SignatureModal from './components/SignatureModal';

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
  const { user, logout, setUser } = useStore();
  const { isDarkMode, toggleDarkMode } = useDarkMode();

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

  // Leave request state
  const [openVacationAccordion, setOpenVacationAccordion] = useState(false);
  const [openSickAccordion, setOpenSickAccordion] = useState(false);
  const [vacationRequests, setVacationRequests] = useState([]);
  const [sickRequests, setSickRequests] = useState([]);
  const [leaveRequestsLoading, setLeaveRequestsLoading] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [leaveModalType, setLeaveModalType] = useState('vacation');
  const [leaveForm, setLeaveForm] = useState({ start_date: '', end_date: '', notes: '' });
  const [leaveSubmitting, setLeaveSubmitting] = useState(false);
  const [leaveError, setLeaveError] = useState('');

  // Load leave requests whenever benefits accordion opens
  useEffect(() => {
    if (openAccordion !== 'benefits' || !user?.id) return;
    let cancelled = false;
    const load = async () => {
      setLeaveRequestsLoading(true);
      try {
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
  }, [openAccordion, user?.id]);

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
      const start = new Date(leaveForm.start_date);
      const end = new Date(leaveForm.end_date);
      if (end < start) {
        setLeaveError('End date must be on or after start date.');
        setLeaveSubmitting(false);
        return;
      }
      const daysRequested = Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1;
      await leaveRequestsAPI.create({
        user_id: user.id,
        leave_type: leaveModalType,
        start_date: leaveForm.start_date,
        end_date: leaveForm.end_date,
        days_requested: daysRequested,
        notes: leaveForm.notes || null,
        status: 'pending',
      });
      setShowLeaveModal(false);
      setLeaveForm({ start_date: '', end_date: '', notes: '' });
      await refreshLeaveRequests();
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

  const vacTotal = user.vacation_days ?? 0;
  const vacUsed = user.vacation_days_used ?? 0;
  const vacRemaining = Math.max(0, vacTotal - vacUsed);
  const sickTotal = user.sick_days ?? 0;
  const sickUsed = user.sick_days_used ?? 0;
  const sickRemaining = Math.max(0, sickTotal - sickUsed);

  const openLeaveModal = (type) => {
    setLeaveModalType(type);
    setLeaveForm({ start_date: '', end_date: '', notes: '' });
    setLeaveError('');
    setShowLeaveModal(true);
  };

  return (
    <div className="container-fluid d-flex flex-column min-h-screen">
      <div className="d-flex flex-column gap-2 overflow-auto flex-grow-1">

        {/* Profile Accordion */}
        <div className="card">
          <div
            className="card-header bg-transparent d-flex justify-content-between align-items-center p-1"
            onClick={() => setOpenAccordion(openAccordion === 'profile' ? '' : 'profile')}
            style={{ cursor: 'pointer' }}
          >
            <h5 className="mb-0 fw-semibold d-flex align-items-center gap-2">
              <UserIcon className="h-5 w-5" /> Profile
            </h5>
            {openAccordion === 'profile' && <span>▼</span>}
          </div>
          {openAccordion === 'profile' && (
            <div className="card-body overflow-auto" style={{ maxHeight: 'calc(100vh - 300px)' }}>
              <div className="row g-1">
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
                  <div className="text-muted small">Supervisor</div>
                  <div className="fw-medium">{user.reports_to_name || user.reports_to || 'Not set'}</div>
                </div>
                <div className="col-sm-6">
                  <div className="text-muted small">Active</div>
                  <div className="fw-medium">{user.is_active === false ? 'No' : 'Yes'}</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Benefits Accordion */}
        <div className="card">
          <div
            className="card-header bg-transparent d-flex justify-content-between align-items-center p-1"
            onClick={() => setOpenAccordion(openAccordion === 'benefits' ? '' : 'benefits')}
            style={{ cursor: 'pointer' }}
          >
            <h5 className="mb-0 fw-semibold">Benefits</h5>
            {openAccordion === 'benefits' && <span>▼</span>}
          </div>
          {openAccordion === 'benefits' && (
            <div className="card-body overflow-auto" style={{ maxHeight: 'calc(100vh - 260px)' }}>

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

              {/* ── Vacation Days nested accordion ── */}
              <div className="border rounded mb-2">
                <div
                  className="d-flex justify-content-between align-items-center px-3 py-2"
                  onClick={() => setOpenVacationAccordion(v => !v)}
                  style={{ cursor: 'pointer', userSelect: 'none' }}
                >
                  <span className="fw-semibold small">Vacation Days</span>
                  <span className="fw-bold text-primary small">{vacTotal} days</span>
                </div>

                {openVacationAccordion && (
                  <div className="px-3 pb-3 border-top pt-2">
                    <div className="d-flex justify-content-end mb-2">
                      <button
                        type="button"
                        className="btn btn-link p-0 text-primary"
                        title="Request vacation"
                        onClick={() => openLeaveModal('vacation')}
                      >
                        <PlusCircleIcon style={{ width: '26px', height: '26px' }} />
                      </button>
                    </div>
                    <div className="card shadow-sm">
                      <div className="card-header py-2 px-3">
                        <span className="fw-semibold small">Leave History</span>
                      </div>
                      <div className="card-body p-2">
                        {leaveRequestsLoading ? (
                          <div className="text-center py-3">
                            <div className="spinner-border spinner-border-sm text-primary" role="status" />
                          </div>
                        ) : vacationRequests.length > 0 ? (
                          <div className="table-responsive">
                            <table className="table table-sm table-hover mb-0" style={{ fontSize: '0.8rem' }}>
                              <thead className="table-light">
                                <tr>
                                  <th>From</th>
                                  <th>To</th>
                                  <th>Days</th>
                                  <th>Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {vacationRequests.map(req => (
                                  <tr key={req.id}>
                                    <td>{req.start_date}</td>
                                    <td>{req.end_date}</td>
                                    <td>{req.days_requested ?? '—'}</td>
                                    <td>
                                      <span className={`badge bg-${statusColor(req.status)}`} style={{ fontSize: '0.7rem' }}>
                                        {req.status}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <p className="text-muted text-center small mb-0 py-2">No vacation requests yet.</p>
                        )}
                      </div>
                      <div className="card-footer py-2 px-3 small text-muted">
                        {vacUsed} used &bull; {vacRemaining} remaining of {vacTotal} total
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* ── Sick Days nested accordion ── */}
              <div className="border rounded">
                <div
                  className="d-flex justify-content-between align-items-center px-3 py-2"
                  onClick={() => setOpenSickAccordion(v => !v)}
                  style={{ cursor: 'pointer', userSelect: 'none' }}
                >
                  <span className="fw-semibold small">Sick Days</span>
                  <span className="fw-bold text-warning small">{sickTotal} days</span>
                </div>

                {openSickAccordion && (
                  <div className="px-3 pb-3 border-top pt-2">
                    <div className="d-flex justify-content-end mb-2">
                      <button
                        type="button"
                        className="btn btn-link p-0 text-warning"
                        title="Request sick leave"
                        onClick={() => openLeaveModal('sick')}
                      >
                        <PlusCircleIcon style={{ width: '26px', height: '26px' }} />
                      </button>
                    </div>
                    <div className="card shadow-sm">
                      <div className="card-header py-2 px-3">
                        <span className="fw-semibold small">Leave History</span>
                      </div>
                      <div className="card-body p-2">
                        {leaveRequestsLoading ? (
                          <div className="text-center py-3">
                            <div className="spinner-border spinner-border-sm text-warning" role="status" />
                          </div>
                        ) : sickRequests.length > 0 ? (
                          <div className="table-responsive">
                            <table className="table table-sm table-hover mb-0" style={{ fontSize: '0.8rem' }}>
                              <thead className="table-light">
                                <tr>
                                  <th>From</th>
                                  <th>To</th>
                                  <th>Days</th>
                                  <th>Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {sickRequests.map(req => (
                                  <tr key={req.id}>
                                    <td>{req.start_date}</td>
                                    <td>{req.end_date}</td>
                                    <td>{req.days_requested ?? '—'}</td>
                                    <td>
                                      <span className={`badge bg-${statusColor(req.status)}`} style={{ fontSize: '0.7rem' }}>
                                        {req.status}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <p className="text-muted text-center small mb-0 py-2">No sick day requests yet.</p>
                        )}
                      </div>
                      <div className="card-footer py-2 px-3 small text-muted">
                        {sickUsed} used &bull; {sickRemaining} remaining of {sickTotal} total
                      </div>
                    </div>
                  </div>
                )}
              </div>

            </div>
          )}
        </div>

        {/* Settings Accordion */}
        <div className={`card ${openAccordion === 'settings' ? 'flex-grow-1' : ''}`}>
          <div
            className="card-header bg-transparent d-flex justify-content-between align-items-center p-1"
            onClick={() => setOpenAccordion(openAccordion === 'settings' ? '' : 'settings')}
            style={{ cursor: 'pointer' }}
          >
            <h5 className="mb-0 fw-semibold d-flex align-items-center gap-2">
              <CogIcon className="h-5 w-5" /> Settings
            </h5>
            {openAccordion === 'settings' && <span>▼</span>}
          </div>
          {openAccordion === 'settings' && (
            <div className="card-body overflow-auto" style={{ maxHeight: 'calc(100vh - 300px)' }}>
              <div className="d-flex align-items-center justify-content-start flex-wrap gap-3">
                <button
                  type="button"
                  onClick={toggleDarkMode}
                  className="btn d-flex align-items-center gap-1 p-0 border-0"
                  title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
                >
                  <span style={{ fontSize: '1.5rem' }}>{isDarkMode ? '🌚' : '🌞'}</span>
                </button>
                <div className="position-relative">
                  <button
                    type="button"
                    onClick={() => { setPendingColor(employeeColor); setColorPickerOpen(prev => !prev); }}
                    className="btn d-flex align-items-center gap-1 p-0 border-0"
                    title="Calendar color"
                    aria-expanded={colorPickerOpen}
                    disabled={colorUpdating}
                  >
                    <span style={{ fontSize: '1.5rem' }}>🎨</span>
                  </button>
                  {colorPickerOpen && (
                    <div
                      className="position-absolute end-0 mt-2 p-2 border rounded bg-white shadow-sm"
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
                <button
                  type="button"
                  onClick={() => setSignatureModalOpen(true)}
                  className="btn d-flex align-items-center gap-1 p-0 border-0"
                  title="Manage signature"
                >
                  <span style={{ fontSize: '1.5rem' }}>📝</span>
                </button>
                <button
                  type="button"
                  onClick={handleAddToHomeScreen}
                  className="btn d-flex align-items-center gap-1 p-0 border-0"
                  title="Add app to home screen"
                >
                  <span style={{ fontSize: '1.5rem' }}>🏠</span>
                </button>
                <button
                  onClick={handleLogout}
                  className="btn d-flex align-items-center gap-1 p-0 border-0"
                  title="Log out"
                >
                  <span style={{ fontSize: '1.5rem' }}>🚪</span>
                </button>
              </div>
              {installMessage && <div className="small text-success mt-2">{installMessage}</div>}
              {installError && <div className="small text-danger mt-2">{installError}</div>}
              {colorMessage && (
                <div className={`small mt-2 ${colorMessage.includes('Failed') || colorMessage.includes('Error') ? 'text-danger' : 'text-success'}`}>
                  {colorMessage}
                </div>
              )}

              {/* Database Environment */}
              <hr className="my-2" />
              <div className="d-flex align-items-center flex-wrap gap-2">
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
          )}
        </div>
      </div>

      {/* Signature Modal */}
      <SignatureModal
        isOpen={signatureModalOpen}
        onClose={() => setSignatureModalOpen(false)}
        userId={user?.id}
      />

      {/* Leave Request Modal */}
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
                <h6 className="modal-title mb-0">
                  Request {leaveModalType === 'vacation' ? 'Vacation' : 'Sick'} Leave
                </h6>
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
    </div>
  );
};

export default Profile;
