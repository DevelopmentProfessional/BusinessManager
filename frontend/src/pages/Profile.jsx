import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useStore from '../services/useStore';
import useDarkMode from '../services/useDarkMode';
import {
  UserIcon,
  CogIcon,
  EnvelopeIcon,
  PhoneIcon,
  BriefcaseIcon,
  CalendarDaysIcon,
  SunIcon,
  MoonIcon,
  ClockIcon,
  CircleStackIcon,
  CheckCircleIcon,
  ArrowRightOnRectangleIcon,
} from '@heroicons/react/24/outline';
import { employeesAPI } from '../services/api';

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

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Database environment from user profile - defaults to development if not set
  const currentDbEnvironment = user?.db_environment || 'development';
  const [dbLoading, setDbLoading] = useState(false);
  const [dbMessage, setDbMessage] = useState('');
  const [dbError, setDbError] = useState('');

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

      {/* Personal Settings */}
      <div className="card mb-1 p-2">
        <div className="card-header bg-transparent">
          <h2 className="flex wrap h5 mb-1">
            <CogIcon className="h-5 w-5 me-2" /> Settings
          </h2>
        </div>
        <div className="card-body"> 
            <div className="d-flex align-items-center justify-content-between">
              <div className="d-flex align-items-center gap-1">
                {isDarkMode 
                ? (<MoonIcon className="h-6 w-6 text-primary" />) 
                : (<SunIcon className="h-6 w-6 text-warning" />)}                  
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
              <button 
                onClick={handleLogout} 
                className="btn btn-outline-danger btn-sm d-flex align-items-center gap-1" 
                title="Log out"
              >
                <ArrowRightOnRectangleIcon className="h-4 w-4" />
                Logout
              </button>
            </div>
        </div>
      </div>

      {/* Database Environment Preference */}
      <div className="card mb-1 p-2">
        <div className="card-header bg-transparent">
          <h2 className="flex wrap h5 mb-1 gap-1">
            <CircleStackIcon className="h-5 w-5 me-2" /> Database Environment
          </h2>
        </div>
        <div className="card-body">
          
          {dbMessage && (
            <div className="alert alert-success d-flex align-items-center mb-2 py-2" role="alert">
              <CheckCircleIcon className="h-5 w-5 me-2" />
              <div>{dbMessage}</div>
            </div>
          )}
          
          {dbError && (
            <div className="alert alert-danger d-flex align-items-center mb-2 py-2" role="alert">
              <div>{dbError}</div>
            </div>
          )}

          <div className="row g-2">
            {Object.entries(DB_ENVIRONMENTS).map(([key, env]) => {
              const isCurrent = key === currentDbEnvironment;
              return (
                <div key={key} className="col-md-4">
                  <div 
                    className={`p-2 border rounded text-center transition ${
                      isCurrent 
                        ? 'border-primary bg-primary bg-opacity-10' 
                        : 'hover-shadow cursor-pointer'
                    }`}
                    style={{ cursor: isCurrent ? 'default' : 'pointer' }}
                    onClick={() => !isCurrent && !dbLoading && handleSwitchEnvironment(key)}
                  >
                    <CircleStackIcon className={`h-6 w-6 mx-auto mb-1 ${
                      isCurrent ? 'text-primary' : 'text-secondary'
                    }`} />
                    <div className="fw-medium">{env.name}</div>
                    <div className="small">
                      {isCurrent ? (
                        <span className="badge bg-primary">Selected</span>
                      ) : (
                        <span className="text-muted">{env.description}</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {dbLoading && (
            <div className="text-center mt-2">
              <div className="spinner-border spinner-border-sm text-primary" role="status">
                <span className="visually-hidden">Updating...</span>
              </div>
              <span className="ms-2 text-muted">Updating preference...</span>
            </div>
          )}
          
          <div className="text-muted small mt-2">
            Your database environment preference is stored in your profile.
          </div>
 
        </div>
      </div>
      </div>
    </div>
  );
};

export default Profile;
