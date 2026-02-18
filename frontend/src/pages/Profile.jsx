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
} from '@heroicons/react/24/outline';
import { employeesAPI } from '../services/api';
import api from '../services/api';
import SignaturePad from './components/SignaturePad';

// Available database environments - shows what's possible
const DB_ENVIRONMENTS = {
  development: { name: 'Development', description: 'Development database' },
  test: { name: 'Test', description: 'Testing environment' },
  production: { name: 'Production', description: 'Live production database' }
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
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const [savedSignature, setSavedSignature] = useState(null);
  const [signatureLoading, setSignatureLoading] = useState(false);
  const [signatureMessage, setSignatureMessage] = useState('');
  const [employeeColor, setEmployeeColor] = useState(user?.color || '#3B82F6');
  const [pendingColor, setPendingColor] = useState(user?.color || '#3B82F6');
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [colorUpdating, setColorUpdating] = useState(false);
  const [colorMessage, setColorMessage] = useState('');

  const handleSwitchEnvironment = async (env) => {
    if (env === currentDbEnvironment || !user?.id) return;
    
    setDbLoading(true);
    setDbMessage('');
    setDbError('');
    
    try {
      // Update the user's profile with the new database environment
      await employeesAPI.updateUser(user.id, { db_environment: env });
      
      // Update local user state
      setUser({ ...user, db_environment: env });
      
      setDbMessage(`Database preference updated to ${DB_ENVIRONMENTS[env]?.name || env}.`);
      
      // Clear message after 3 seconds
      setTimeout(() => setDbMessage(''), 3000);
    } catch (error) {
      const detail = error?.response?.data?.detail || error?.message || 'Failed to update database preference';
      setDbError(detail);
      // Clear error after 5 seconds
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
    } catch (error) {
      setInstallError('Unable to open install prompt. Please use your browser menu to add to home screen.');
    }
  };

  const handleColorChange = async (newColor) => {
    setEmployeeColor(newColor);
    setColorUpdating(true);
    setColorMessage('');
    
    try {
      // Update the user's profile with the new color
      await employeesAPI.updateUser(user.id, { color: newColor });
      
      // Update local user state
      setUser({ ...user, color: newColor });
      
      setColorMessage('Calendar color updated!');
      
      // Clear message after 2 seconds
      setTimeout(() => setColorMessage(''), 2000);
      return true;
    } catch (error) {
      const detail = error?.response?.data?.detail || error?.message || 'Failed to update color';
      setColorMessage(detail);
      // Revert the color on error
      setEmployeeColor(user?.color || '#3B82F6');
      // Clear message after 3 seconds
      setTimeout(() => setColorMessage(''), 3000);
      return false;
    } finally {
      setColorUpdating(false);
    }
  };

  const handleColorSave = async () => {
    const ok = await handleColorChange(pendingColor);
    if (ok) {
      setColorPickerOpen(false);
    }
  };

  useEffect(() => {
    const loadSignature = async () => {
      if (!user?.id) return;
      setSignatureLoading(true);
      try {
        const res = await api.get('/auth/me/signature');
        setSavedSignature(res.data?.signature_data || null);
      } catch (error) {
        setSavedSignature(null);
      } finally {
        setSignatureLoading(false);
      }
    };
    loadSignature();
  }, [user?.id]);

  // Finalize performance report when Profile is fully loaded
  useEffect(() => {
    if (getPerformanceSessionActive()) {
      // Log key sections as they render
      const trackedSections = [
        'Employee Information Section',
        'Theme Settings Section',
        'Database Environment Section',
        'Signature Pad Section',
        'Install App Section',
        'Access Token Section'
      ];

      // Check and log sections that have rendered
      const checkSections = () => {
        const checkInterval = setInterval(() => {
          let allLoaded = true;
          trackedSections.forEach(section => {
            // Simple check if we've attempted to find the section
            if (getPerformanceSessionActive()) {
              logComponentLoad(section);
            }
          });
          clearInterval(checkInterval);
        }, 100);
      };

      checkSections();

      // Use requestAnimationFrame to ensure DOM is fully rendered before finalizing
      const rafId = requestAnimationFrame(() => {
        // Add a small delay to account for any async operations that might still be pending
        setTimeout(() => {
          finalizePerformanceReport();
        }, 300);
      });
      return () => cancelAnimationFrame(rafId);
    }
  }, [user]); // Run when user data is available

  const handleSaveSignature = async (dataUrl) => {
    setSignatureLoading(true);
    setSignatureMessage('');
    try {
      await api.put('/auth/me/signature', { signature_data: dataUrl });
      setSavedSignature(dataUrl);
      setShowSignaturePad(false);
      setSignatureMessage('Signature saved successfully');
      setTimeout(() => setSignatureMessage(''), 3000);
    } catch (error) {
      const detail = error?.response?.data?.detail || error?.message || 'Failed to save signature';
      setSignatureMessage(detail);
    } finally {
      setSignatureLoading(false);
    }
  };

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

  const currentHour = new Date().getHours();
  const greeting = currentHour < 12 ? 'Good Morning' : currentHour < 18 ? 'Good Afternoon' : 'Good Evening';

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
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

  return (
    <div className="container-fluid py-1 d-flex flex-column min-vh-100">
      <div className="mt-auto">
      {/* Employee Information */}
      <div className="card mb-1 p-2">
        <div className="card-body">
          <div className="row g-1">
            <div className="col-sm-6">
              <div className="flex wrap mb-1">
                <UserIcon className=" w-4" /> <div className="fw-medium p-1">{user.first_name} {user.last_name}</div>
              </div>
            </div>
            <div className="col-sm-6">
              <div className="flex wrap mb-1">
                <BriefcaseIcon className="w-4" /><span className={`badge bg-${getRoleBadgeColor(user.role)} text-capitalize`}>
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
        </div>
      </div>

      {/* Employee Details & Benefits */}
      <div className="card mb-1 p-2">
        <div className="card-body">
          <details className="mb-2">
            <summary className="fw-semibold">Employee Details</summary>
            <div className="row g-2 mt-2">
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
          </details>

          <details>
            <summary className="fw-semibold">Benefits</summary>
            <div className="row g-2 mt-2">
              <div className="col-sm-6">
                <div className="text-muted small">Salary</div>
                <div className="fw-medium">{user.salary != null ? `$${user.salary}` : 'Not set'}</div>
              </div>
              <div className="col-sm-6">
                <div className="text-muted small">Pay Frequency</div>
                <div className="fw-medium">{user.pay_frequency || 'Not set'}</div>
              </div>
              <div className="col-sm-6">
                <div className="text-muted small">Insurance Plan</div>
                <div className="fw-medium">{user.insurance_plan || 'Not set'}</div>
              </div>
              <div className="col-sm-6">
                <div className="text-muted small">Vacation Days</div>
                <div className="fw-medium">
                  {user.vacation_days != null ? user.vacation_days : 'Not set'}
                  {user.vacation_days_used != null ? ` (Used ${user.vacation_days_used})` : ''}
                </div>
              </div>
              <div className="col-sm-6">
                <div className="text-muted small">Sick Days</div>
                <div className="fw-medium">
                  {user.sick_days != null ? user.sick_days : 'Not set'}
                  {user.sick_days_used != null ? ` (Used ${user.sick_days_used})` : ''}
                </div>
              </div>
            </div>
          </details>
        </div>
      </div>

      {/* Personal Settings */}
      <div className="card mb-1 p-2">
        <div className="card-header bg-transparent">
          <h2 className="flex wrap h5 mb-1">
            <CogIcon className="h-5 w-5 me-2" /> Settings
          </h2>
        </div>
        <div className="card-body">
            <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
              <div className="d-flex align-items-center gap-3">
                <div className="d-flex align-items-center gap-1">
                  {isDarkMode
                  ? (<span>🌚</span>)
                  : (<span>🌞</span>)}
                  <div className="form-check form-switch">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      role="switch"
                      id="darkModeSwitch"
                      checked={isDarkMode}
                      onChange={toggleDarkMode}
                      style={{ width: '3rem', height: '1.5rem' }}/>
                  </div>
                </div>
                <div className="position-relative">
                  <button
                    type="button"
                    onClick={() => {
                      setPendingColor(employeeColor);
                      setColorPickerOpen((prev) => !prev);
                    }}
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
                          style={{
                            width: '50px',
                            height: '38px',
                            padding: '4px',
                            cursor: colorUpdating ? 'not-allowed' : 'pointer',
                            opacity: colorUpdating ? 0.6 : 1
                          }}
                          disabled={colorUpdating}
                        />
                        <span className="small text-muted">{pendingColor.toUpperCase()}</span>
                      </div>
                      <div className="d-flex gap-2 justify-content-end">
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-secondary"
                          onClick={() => {
                            setPendingColor(employeeColor);
                            setColorPickerOpen(false);
                          }}
                          disabled={colorUpdating}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-primary"
                          onClick={handleColorSave}
                          disabled={colorUpdating}
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="d-flex align-items-center gap-2">
                <button
                  type="button"
                  onClick={handleAddToHomeScreen}
                  className="btn d-flex align-items-center gap-1 p-0 border-0"
                  title="Add app to home screen"
                >
                  <span style={{ fontSize: '1.75rem' }}>🏠</span>
                </button>
                <button
                  onClick={handleLogout}
                  className="btn d-flex align-items-center gap-1 p-0 border-0"
                  title="Log out"
                >
                  <span style={{ fontSize: '1.75rem' }}>🚪</span>
                </button>
              </div>
            </div>
            {installMessage && <div className="small text-success mt-2">{installMessage}</div>}
            {installError && <div className="small text-danger mt-2">{installError}</div>}
            {colorMessage && <div className={`small mt-2 ${colorMessage.includes('Failed') || colorMessage.includes('Error') ? 'text-danger' : 'text-success'}`}>{colorMessage}</div>}

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
                    className={`badge rounded-pill px-3 py-2 ${
                      isCurrent
                        ? 'bg-primary text-white'
                        : 'bg-transparent text-secondary border'
                    }`}
                    style={{
                      cursor: isCurrent || dbLoading ? 'default' : 'pointer',
                      fontSize: '0.8rem',
                      transition: 'all 0.15s ease',
                      userSelect: 'none',
                    }}
                    onClick={() => !isCurrent && !dbLoading && handleSwitchEnvironment(key)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); !isCurrent && !dbLoading && handleSwitchEnvironment(key); }}}
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
      </div>
      {/* Signature */}
      <div className="card mb-1 p-2">
        <div className="card-header bg-transparent">
          <h2 className="flex wrap h5 mb-1 gap-1">
            Signature
          </h2>
        </div>
        <div className="card-body">
          {signatureMessage && (
            <div className={`alert py-2 small ${signatureMessage.includes('Failed') ? 'alert-danger' : 'alert-success'}`}>
              {signatureMessage}
            </div>
          )}

          {signatureLoading ? (
            <div className="text-muted">Loading signature...</div>
          ) : showSignaturePad ? (
            <SignaturePad
              onSave={handleSaveSignature}
              onCancel={() => setShowSignaturePad(false)}
              initialSignature={savedSignature}
              width={500}
              height={200}
            />
          ) : savedSignature ? (
            <div className="d-flex flex-column gap-2">
              <img
                src={savedSignature}
                alt="Saved signature"
                style={{ maxWidth: '100%', height: 'auto', border: '1px solid #e5e7eb', borderRadius: '6px' }}
              />
              <button type="button" className="btn btn-outline-secondary" onClick={() => setShowSignaturePad(true)}>
                Replace Signature
              </button>
            </div>
          ) : (
            <div className="d-flex flex-column gap-2">
              <p className="text-muted mb-0">No signature saved yet.</p>
              <button type="button" className="btn btn-outline-primary" onClick={() => setShowSignaturePad(true)}>
                Create Signature
              </button>
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  );
};

export default Profile;
