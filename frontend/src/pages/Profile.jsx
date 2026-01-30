import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import useStore from '../services/useStore';
import useDarkMode from '../services/useDarkMode';
import {
  UserIcon,
  CalendarIcon,
  DocumentTextIcon,
  UserGroupIcon,
  CogIcon,
  ChartBarIcon,
  ArchiveBoxIcon,
  WrenchScrewdriverIcon,
  EnvelopeIcon,
  PhoneIcon,
  BriefcaseIcon,
  CalendarDaysIcon,
  SunIcon,
  MoonIcon,
  BellIcon,
  CheckCircleIcon,
  ClockIcon,
  CircleStackIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';
import { scheduleAPI, dbEnvironmentAPI } from '../services/api';

const Profile = () => {
  const { user } = useStore();
  const { isDarkMode, toggleDarkMode } = useDarkMode();
  const [todayStats, setTodayStats] = useState({ appointments: 0, completed: 0 });
  const [loading, setLoading] = useState(true);
  
  // Database environment state
  const [dbEnvironment, setDbEnvironment] = useState('development');
  const [dbEnvironments, setDbEnvironments] = useState({});
  const [dbLoading, setDbLoading] = useState(false);
  const [dbMessage, setDbMessage] = useState('');
  const [dbError, setDbError] = useState('');

  // Load database environment on mount
  useEffect(() => {
    const fetchDbEnvironment = async () => {
      try {
        const response = await dbEnvironmentAPI.getCurrent();
        const data = response?.data || response;
        setDbEnvironment(data.current || 'development');
        setDbEnvironments(data.environments || {});
      } catch (error) {
        console.error('Failed to fetch database environment:', error);
        // Default to development if API fails
        setDbEnvironments({
          development: { name: 'Development', configured: true, is_current: true },
          test: { name: 'Test', configured: false, is_current: false },
          production: { name: 'Production', configured: false, is_current: false }
        });
      }
    };
    fetchDbEnvironment();
  }, []);

  const handleSwitchEnvironment = async (env) => {
    if (env === dbEnvironment) return;
    
    setDbLoading(true);
    setDbMessage('');
    setDbError('');
    
    try {
      const response = await dbEnvironmentAPI.switch(env);
      const data = response?.data || response;
      setDbEnvironment(env);
      setDbMessage(data.message || `Switched to ${env}. Please restart the application.`);
      
      // Update the environments state
      setDbEnvironments(prev => {
        const updated = { ...prev };
        Object.keys(updated).forEach(key => {
          updated[key] = { ...updated[key], is_current: key === env };
        });
        return updated;
      });
    } catch (error) {
      const detail = error?.response?.data?.detail || error?.message || 'Failed to switch environment';
      setDbError(detail);
    } finally {
      setDbLoading(false);
    }
  };

  useEffect(() => {
    const fetchTodayStats = async () => {
      if (!user) return;
      try {
        const response = await scheduleAPI.getAll();
        const appointments = response?.data || [];
        const today = new Date().toISOString().split('T')[0];

        const todayAppointments = appointments.filter(apt => {
          const aptDate = new Date(apt.appointment_date).toISOString().split('T')[0];
          return aptDate === today && apt.employee_id === user.id;
        });

        const completed = todayAppointments.filter(apt => apt.status === 'completed').length;

        setTodayStats({
          appointments: todayAppointments.length,
          completed: completed
        });
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTodayStats();
  }, [user]);

  const quickLinks = [
    { name: 'Schedule', href: '/schedule', icon: CalendarIcon, color: 'primary', description: 'View and manage appointments' },
    { name: 'Clients', href: '/clients', icon: UserGroupIcon, color: 'success', description: 'Manage client information' },
    { name: 'Inventory', href: '/inventory', icon: ArchiveBoxIcon, color: 'warning', description: 'Track products and stock' },
    { name: 'Services', href: '/services', icon: WrenchScrewdriverIcon, color: 'info', description: 'Manage service offerings' },
    { name: 'Reports', href: '/reports', icon: ChartBarIcon, color: 'danger', description: 'View business analytics' },
    { name: 'Documents', href: '/documents', icon: DocumentTextIcon, color: 'secondary', description: 'Access documents' },
  ];

  if (!user) {
    return (
      <div className="container-fluid py-4">
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
    <div className="container-fluid py-4">
      {/* Welcome Section */}
      <div className="card mb-4">
        <div className="card-body">
          <div className="d-flex align-items-center gap-3">
            <div className="flex-shrink-0">
              <div className="bg-primary bg-opacity-10 rounded-circle d-flex align-items-center justify-content-center" style={{ width: '4rem', height: '4rem' }}>
                <UserIcon className="h-8 w-8 text-primary" />
              </div>
            </div>
            <div className="flex-grow-1">
              <h1 className="h3 mb-1">{greeting}, {user.first_name}!</h1>
              <p className="text-muted mb-0">Welcome to your business management dashboard</p>
            </div>
            <Link to="/settings" className="btn btn-outline-secondary">
              <CogIcon className="h-5 w-5 me-2" />
              Settings
            </Link>
          </div>
        </div>
      </div>

      {/* Employee Info & Quick Stats Row */}
      <div className="row g-4 mb-4">
        {/* Employee Information */}
        <div className="col-lg-6">
          <div className="card h-100">
            <div className="card-header bg-transparent">
              <h2 className="h5 mb-0">
                <UserIcon className="h-5 w-5 me-2" />
                My Information
              </h2>
            </div>
            <div className="card-body">
              <div className="row g-3">
                <div className="col-sm-6">
                  <div className="d-flex align-items-center gap-2 text-muted small mb-1">
                    <UserIcon className="h-4 w-4" />
                    Full Name
                  </div>
                  <div className="fw-medium">{user.first_name} {user.last_name}</div>
                </div>
                <div className="col-sm-6">
                  <div className="d-flex align-items-center gap-2 text-muted small mb-1">
                    <BriefcaseIcon className="h-4 w-4" />
                    Role
                  </div>
                  <span className={`badge bg-${getRoleBadgeColor(user.role)} text-capitalize`}>
                    {user.role || 'Employee'}
                  </span>
                </div>
                <div className="col-sm-6">
                  <div className="d-flex align-items-center gap-2 text-muted small mb-1">
                    <EnvelopeIcon className="h-4 w-4" />
                    Email
                  </div>
                  <div className="fw-medium">{user.email || 'Not set'}</div>
                </div>
                <div className="col-sm-6">
                  <div className="d-flex align-items-center gap-2 text-muted small mb-1">
                    <PhoneIcon className="h-4 w-4" />
                    Phone
                  </div>
                  <div className="fw-medium">{user.phone || 'Not set'}</div>
                </div>
                <div className="col-sm-6">
                  <div className="d-flex align-items-center gap-2 text-muted small mb-1">
                    <CalendarDaysIcon className="h-4 w-4" />
                    Hire Date
                  </div>
                  <div className="fw-medium">{formatDate(user.hire_date)}</div>
                </div>
                <div className="col-sm-6">
                  <div className="d-flex align-items-center gap-2 text-muted small mb-1">
                    <ClockIcon className="h-4 w-4" />
                    Last Login
                  </div>
                  <div className="fw-medium">{formatDate(user.last_login)}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="col-lg-6">
          <div className="card h-100">
            <div className="card-header bg-transparent">
              <h2 className="h5 mb-0">
                <ChartBarIcon className="h-5 w-5 me-2" />
                Today's Overview
              </h2>
            </div>
            <div className="card-body">
              <div className="row g-3">
                <div className="col-6">
                  <div className="card bg-primary bg-opacity-10 border-0">
                    <div className="card-body text-center py-4">
                      <CalendarIcon className="h-8 w-8 text-primary mx-auto mb-2" />
                      <div className="h3 mb-0 text-primary">
                        {loading ? '...' : todayStats.appointments}
                      </div>
                      <div className="text-muted small">Today's Appointments</div>
                    </div>
                  </div>
                </div>
                <div className="col-6">
                  <div className="card bg-success bg-opacity-10 border-0">
                    <div className="card-body text-center py-4">
                      <CheckCircleIcon className="h-8 w-8 text-success mx-auto mb-2" />
                      <div className="h3 mb-0 text-success">
                        {loading ? '...' : todayStats.completed}
                      </div>
                      <div className="text-muted small">Completed</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Personal Settings */}
      <div className="card mb-4">
        <div className="card-header bg-transparent">
          <h2 className="h5 mb-0">
            <CogIcon className="h-5 w-5 me-2" />
            Personal Settings
          </h2>
        </div>
        <div className="card-body">
          <div className="row g-3">
            <div className="col-md-6">
              <div className="d-flex align-items-center justify-content-between p-3 border rounded">
                <div className="d-flex align-items-center gap-3">
                  {isDarkMode ? (
                    <MoonIcon className="h-6 w-6 text-primary" />
                  ) : (
                    <SunIcon className="h-6 w-6 text-warning" />
                  )}
                  <div>
                    <div className="fw-medium">Dark Mode</div>
                    <div className="text-muted small">
                      {isDarkMode ? 'Dark theme enabled' : 'Light theme enabled'}
                    </div>
                  </div>
                </div>
                <div className="form-check form-switch">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    role="switch"
                    id="darkModeSwitch"
                    checked={isDarkMode}
                    onChange={toggleDarkMode}
                    style={{ width: '3rem', height: '1.5rem' }}
                  />
                </div>
              </div>
            </div>
            <div className="col-md-6">
              <div className="d-flex align-items-center justify-content-between p-3 border rounded">
                <div className="d-flex align-items-center gap-3">
                  <BellIcon className="h-6 w-6 text-info" />
                  <div>
                    <div className="fw-medium">Notifications</div>
                    <div className="text-muted small">Manage notification preferences</div>
                  </div>
                </div>
                <Link to="/settings" className="btn btn-sm btn-outline-secondary">
                  Configure
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Database Environment Switcher */}
      <div className="card mb-4">
        <div className="card-header bg-transparent">
          <h2 className="h5 mb-0">
            <CircleStackIcon className="h-5 w-5 me-2" />
            Database Environment
          </h2>
        </div>
        <div className="card-body">
          <p className="text-muted small mb-3">
            Switch between different database environments for development, testing, or production.
            Changes require an application restart to take effect.
          </p>
          
          {dbMessage && (
            <div className="alert alert-success d-flex align-items-center mb-3" role="alert">
              <CheckCircleIcon className="h-5 w-5 me-2" />
              <div>{dbMessage}</div>
            </div>
          )}
          
          {dbError && (
            <div className="alert alert-danger d-flex align-items-center mb-3" role="alert">
              <div>{dbError}</div>
            </div>
          )}

          <div className="row g-3">
            {Object.entries(dbEnvironments).map(([key, env]) => (
              <div key={key} className="col-md-4">
                <div 
                  className={`p-3 border rounded text-center cursor-pointer transition ${
                    env.is_current 
                      ? 'border-primary bg-primary bg-opacity-10' 
                      : env.configured 
                        ? 'hover-shadow' 
                        : 'opacity-50'
                  }`}
                  style={{ cursor: env.configured && !env.is_current ? 'pointer' : 'default' }}
                  onClick={() => env.configured && !env.is_current && handleSwitchEnvironment(key)}
                >
                  <CircleStackIcon className={`h-8 w-8 mx-auto mb-2 ${
                    env.is_current ? 'text-primary' : env.configured ? 'text-secondary' : 'text-muted'
                  }`} />
                  <div className="fw-medium">{env.name}</div>
                  <div className="small">
                    {env.is_current ? (
                      <span className="badge bg-primary">Current</span>
                    ) : env.configured ? (
                      <span className="text-muted">Available</span>
                    ) : (
                      <span className="text-muted">Not Configured</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {dbLoading && (
            <div className="text-center mt-3">
              <div className="spinner-border spinner-border-sm text-primary" role="status">
                <span className="visually-hidden">Switching...</span>
              </div>
              <span className="ms-2 text-muted">Switching environment...</span>
            </div>
          )}

          <div className="mt-3 p-3 bg-light rounded">
            <div className="d-flex align-items-center gap-2 text-muted small">
              <ArrowPathIcon className="h-4 w-4" />
              <span>
                <strong>Note:</strong> After switching environments, restart the backend server for changes to take effect.
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Links */}
      <div className="mb-4">
        <h2 className="h5 mb-3">Quick Access</h2>
        <div className="row g-3">
          {quickLinks.map((link) => {
            const Icon = link.icon;
            return (
              <div key={link.name} className="col-md-6 col-lg-4">
                <Link to={link.href} className="text-decoration-none">
                  <div className="card h-100 hover-shadow transition">
                    <div className="card-body">
                      <div className="d-flex align-items-start gap-3">
                        <div className="flex-shrink-0">
                          <div className={`bg-${link.color} bg-opacity-10 rounded-circle d-flex align-items-center justify-content-center`} style={{ width: '3rem', height: '3rem' }}>
                            <Icon className={`h-6 w-6 text-${link.color}`} />
                          </div>
                        </div>
                        <div className="flex-grow-1">
                          <h3 className="h6 mb-1">{link.name}</h3>
                          <p className="text-muted small mb-0">{link.description}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Profile;
