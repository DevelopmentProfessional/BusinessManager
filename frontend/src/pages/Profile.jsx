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
import { employeesAPI, leaveRequestsAPI, onboardingRequestsAPI, offboardingRequestsAPI } from '../services/api';
import api from '../services/api';
import Modal_Signature from './components/Modal_Signature';

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
  }
`;

// Add styles to document
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.textContent = accordionStyles;
  if (!document.head.querySelector('style[data-accordion-popup]')) {
    styleSheet.setAttribute('data-accordion-popup', 'true');
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

  const toNumber = (value) => {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
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

  return (
    <div className="d-flex flex-column min-h-screen">
      
      {/* Main Content Area */}
      <div className="flex-grow-1"></div>

      {/* Floating Content Panels */}
      {/* Profile Content */}
      {openAccordion === 'profile' && (
        <div 
          className="accordion-popup" 
          style={{ 
            position: 'fixed',
            bottom: '84px',
            left: 0,
            right: 0,
            width: '100%',
            maxHeight: 'calc(100vh - 164px)',
            overflowY: 'auto',
            backgroundColor: 'var(--bs-card-bg, white)',
            zIndex: 1000,
            padding: '1rem',
            boxShadow: '0 -2px 10px rgba(0,0,0,0.1)',
            border: '1px solid var(--bs-card-border-color, #dee2e6)',
            borderBottom: 'none',
            borderTopLeftRadius: '0.375rem',
            borderTopRightRadius: '0.375rem'
          }}
        >
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
        )}

      {/* Benefits Content */}
      {openAccordion === 'benefits' && (
        <div 
          className="accordion-popup" 
          style={{ 
            position: 'fixed',
            bottom: '60px',
            left: 0,
            right: 0,
            width: '100%',
            maxHeight: 'calc(100vh - 140px)',
            overflowY: 'auto',
            backgroundColor: 'var(--bs-card-bg, white)',
            zIndex: 1000,
            padding: '1rem',
            boxShadow: '0 -2px 10px rgba(0,0,0,0.1)',
            border: '1px solid var(--bs-card-border-color, #dee2e6)',
            borderBottom: 'none',
            borderTopLeftRadius: '0.375rem',
            borderTopRightRadius: '0.375rem'
          }}
        >

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
                        <div style={{ overflowX: 'auto' }}>
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
        )}

      {/* Settings Content */}
      {openAccordion === 'settings' && (
        <div 
          className="accordion-popup" 
          style={{ 
            position: 'fixed',
            bottom: '60px',
            left: 0,
            right: 0,
            width: '100%',
            maxHeight: 'calc(100vh - 140px)',
            overflowY: 'auto',
            backgroundColor: 'var(--bs-card-bg, white)',
            zIndex: 1000,
            padding: '1rem',
            boxShadow: '0 -2px 10px rgba(0,0,0,0.1)',
            border: '1px solid var(--bs-card-border-color, #dee2e6)',
            borderBottom: 'none',
            borderTopLeftRadius: '0.375rem',
            borderTopRightRadius: '0.375rem'
          }}
        >
          <div className="d-flex align-items-center justify-content-start flex-wrap gap-3">
                <button
                  type="button"
                  onClick={toggleDarkMode}
                  className="btn d-flex align-items-center gap-2 p-0 border-0 text-body-emphasis"
                  title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
                >
                  <span style={{ fontSize: '1.5rem' }}>{isDarkMode ? '🌚' : '🌞'}</span>
                  <span className="small fw-medium text-body-emphasis">{isDarkMode ? 'Light mode' : 'Dark mode'}</span>
                </button>
                <div className="position-relative">
                  <button
                    type="button"
                    onClick={() => { setPendingColor(employeeColor); setColorPickerOpen(prev => !prev); }}
                    className="btn d-flex align-items-center gap-2 p-0 border-0 text-body-emphasis"
                    title="Calendar color"
                    aria-expanded={colorPickerOpen}
                    disabled={colorUpdating}
                  >
                    <span style={{ fontSize: '1.5rem' }}>🎨</span>
                    <span className="small fw-medium text-body-emphasis">Calendar Color</span>
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
                  className="btn d-flex align-items-center gap-2 p-0 border-0 text-body-emphasis"
                  title="Manage signature"
                >
                  <span style={{ fontSize: '1.5rem' }}>📝</span>
                  <span className="small fw-medium text-body-emphasis">Signature</span>
                </button>
                <button
                  type="button"
                  onClick={handleAddToHomeScreen}
                  className="btn d-flex align-items-center gap-2 p-0 border-0 text-body-emphasis"
                  title="Add app to home screen"
                >
                  <span style={{ fontSize: '1.5rem' }}>🏠</span>
                  <span className="small fw-medium text-body-emphasis">Download</span>
                </button>
                <button
                  onClick={handleLogout}
                  className="btn d-flex align-items-center gap-2 p-0 border-0 text-body-emphasis"
                  title="Log out"
                >
                  <span style={{ fontSize: '1.5rem' }}>🚪</span>
                  <span className="small fw-medium text-body-emphasis">Logout</span>
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

      {/* Leave Management Panel */}
      {leaveManagementOpen && (
        <div 
          style={{
            position: 'fixed',
            bottom: '60px',
            left: 0,
            right: 0,
            maxHeight: 'calc(100vh - 164px)',
            overflowY: 'auto',
            backgroundColor: 'var(--bs-card-bg, white)',
            borderTop: '1px solid var(--bs-card-border-color, #dee2e6)',
            boxShadow: '0 -2px 10px rgba(0,0,0,0.1)',
            zIndex: 50,
            borderTopLeftRadius: 'var(--bs-border-radius, 0.375rem)',
            borderTopRightRadius: 'var(--bs-border-radius, 0.375rem)',
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
                      <div style={{ overflowX: 'auto' }}>
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
        className="d-flex gap-1 p-2 bg-body border-top position-fixed bottom-0 start-0 end-0"
        style={{ zIndex: 100, minHeight: '84px', paddingRight: '5rem', alignItems: 'center' }}
      >
        {/* Profile Tab */}
        <button
          className={`btn flex-shrink-0 d-flex align-items-center gap-1 ${openAccordion === 'profile' ? 'btn-primary' : 'btn-outline-secondary'}`}
          style={{ fontSize: '0.875rem', padding: '0.5rem 0.75rem' }}
          onClick={() => setOpenAccordion(openAccordion === 'profile' ? '' : 'profile')}
        >
          <UserIcon className="h-4 w-4" />
          <span className="small">Profile</span>
        </button>

        {/* Benefits Tab */}
        <button
          className={`btn flex-shrink-0 d-flex align-items-center gap-1 ${openAccordion === 'benefits' ? 'btn-primary' : 'btn-outline-secondary'}`}
          style={{ fontSize: '0.875rem', padding: '0.5rem 0.75rem' }}
          onClick={() => setOpenAccordion(openAccordion === 'benefits' ? '' : 'benefits')}
        >
          <i className="bi bi-bag-heart"></i>
          <span className="small">Benefits</span>
        </button>

        {/* Settings Tab */}
        <button
          className={`btn flex-shrink-0 d-flex align-items-center gap-1 ${openAccordion === 'settings' ? 'btn-primary' : 'btn-outline-secondary'}`}
          style={{ fontSize: '0.875rem', padding: '0.5rem 0.75rem' }}
          onClick={() => setOpenAccordion(openAccordion === 'settings' ? '' : 'settings')}
        >
          <CogIcon className="h-4 w-4" />
          <span className="small">Settings</span>
        </button>
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


    </div>
  );
};

export default Profile;
