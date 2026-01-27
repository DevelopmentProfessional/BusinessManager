import React, { useState, useEffect } from 'react';
import useStore from '../services/useStore';
import useDarkMode from '../services/useDarkMode';
import api, { attendanceAPI } from '../services/api';
import { 
  UserIcon, 
  EnvelopeIcon, 
  ShieldCheckIcon, 
  CalendarIcon, 
  KeyIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  ClockIcon,
  DocumentTextIcon,
  UserGroupIcon,
  CogIcon,
  ArrowRightIcon,
  LockClosedIcon,
  EyeIcon,
  EyeSlashIcon,
  SunIcon
} from '@heroicons/react/24/outline';
import DarkModeToggle from './components/DarkModeToggle';

const Profile = () => {
  const { user, setUser } = useStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [passwordData, setPasswordData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  });
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [hasEmployeeProfile, setHasEmployeeProfile] = useState(true);
  const [userData, setUserData] = useState(null);

  useEffect(() => {
    // Only load user data if not already loaded
    if (!userData && user) {
      setUserData(user);
    } else if (!userData && !user) {
      // Try to get from localStorage as fallback
      try {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
          const currentUser = JSON.parse(storedUser);
          setUserData(currentUser);
          setUser(currentUser);
        }
      } catch (err) {
        console.error('Error parsing stored user data:', err);
      }
    }
  }, [user, setUser, userData]);

  // Only fetch attendance data when userData is available and we haven't loaded it yet
  useEffect(() => {
    if (userData && attendanceRecords.length === 0) {
      fetchAttendanceRecords();
    }
  }, [userData]);

  const checkEmployeeProfile = async () => {
    try {
      const response = await attendanceAPI.checkUser();
      const hasProfile = response.data.has_employee_profile;
      setHasEmployeeProfile(hasProfile);
      return hasProfile;
    } catch (err) {
      console.error('Error checking employee profile:', err);
      setHasEmployeeProfile(false);
      return false;
    }
  };

  const fetchAttendanceRecords = async () => {
    try {
      // Only fetch if we haven't already loaded the data
      if (attendanceRecords.length > 0) return;
      
      // First check if user has an employee profile
      const hasProfile = await checkEmployeeProfile();
      
      if (!hasProfile) {
        setAttendanceRecords([]);
        return;
      }
      
      // Fetch attendance for the current user (backend resolves linked employee)
      const response = await attendanceAPI.me();
      setAttendanceRecords(response.data);
    } catch (err) {
      console.error('Error fetching attendance records:', err);
      // If user doesn't have an employee profile, that's okay - just show empty list
      setAttendanceRecords([]);
      setHasEmployeeProfile(false);
    }
  };

  const fetchLeaveRequests = async () => {
    try {
      // This would be implemented when leave management is added
      // const response = await api.get(`/leave/employee/${user.id}`);
      // setLeaveRequests(response.data);
    } catch (err) {
      console.error('Error fetching leave requests:', err);
    }
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handlePasswordUpdate = async (e) => {
    e.preventDefault();
    
    if (passwordData.new_password !== passwordData.confirm_password) {
      setError('New passwords do not match');
      return;
    }
    
    if (passwordData.new_password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }
    
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await api.post('/auth/change-password', {
        current_password: passwordData.current_password,
        new_password: passwordData.new_password
      });
      
      setSuccess('Password updated successfully!');
      setShowPasswordChange(false);
      setPasswordData({
        current_password: '',
        new_password: '',
        confirm_password: ''
      });
      
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  const clockIn = async () => {
    if (!hasEmployeeProfile) {
      setError('No employee profile linked to your account. Please contact your administrator.');
      return;
    }
    
    try {
      await attendanceAPI.clockIn();
      setSuccess('Clocked in successfully!');
      fetchAttendanceRecords();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to clock in');
    }
  };

  const clockOut = async () => {
    if (!hasEmployeeProfile) {
      setError('No employee profile linked to your account. Please contact your administrator.');
      return;
    }
    
    try {
      await attendanceAPI.clockOut();
      setSuccess('Clocked out successfully!');
      fetchAttendanceRecords();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to clock out');
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString();
  };

  const formatTime = (dateString) => {
    return new Date(dateString).toLocaleTimeString();
  };

  if (!userData) {
    return (
      <div className="container-fluid py-4">
        <div className="card">
          <div className="card-body text-center">
            <div className="spinner-border text-primary mb-3" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <h2 className="h5 mb-2">Loading Profile...</h2>
            <p className="text-muted">Please wait while we load your profile information.</p>
            <div className="alert alert-warning mt-3">
              <p className="mb-0 small">
                <strong>Debug Info:</strong> User data not loaded. This might be due to authentication issues.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container-fluid py-4">
      <div className="card">
        {/* Header */}
        <div className="card-header">
          <h1 className="h3 mb-0">My Profile</h1>
        </div>

        <div className="card-body">
          <div className="row g-4">
            {/* User Information */}
            <div className="col-12">
              <h2 className="h5 mb-3">Personal Information</h2>
              <div className="card">
                <div className="card-body">
                  <div className="row g-3">
                    <div className="col-md-6">
                      <div className="d-flex align-items-center gap-3">
                        <div className="flex-shrink-0">
                          <div className="bg-primary bg-opacity-10 rounded-circle d-flex align-items-center justify-content-center" style={{ width: '2.5rem', height: '2.5rem' }}>
                            <UserIcon className="h-5 w-5 text-primary" />
                          </div>
                        </div>
                        <div>
                          <label className="form-label small text-muted mb-1">Full Name</label>
                          <p className="mb-0 fw-medium">{userData.first_name} {userData.last_name}</p>
                        </div>
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="d-flex align-items-center gap-3">
                        <div className="flex-shrink-0">
                          <div className="bg-success bg-opacity-10 rounded-circle d-flex align-items-center justify-content-center" style={{ width: '2.5rem', height: '2.5rem' }}>
                            <UserIcon className="h-5 w-5 text-success" />
                          </div>
                        </div>
                        <div>
                          <label className="form-label small text-muted mb-1">Username</label>
                          <p className="mb-0 fw-medium">{userData.username}</p>
                        </div>
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="d-flex align-items-center gap-3">
                        <div className="flex-shrink-0">
                          <div className="bg-info bg-opacity-10 rounded-circle d-flex align-items-center justify-content-center" style={{ width: '2.5rem', height: '2.5rem' }}>
                            <EnvelopeIcon className="h-5 w-5 text-info" />
                          </div>
                        </div>
                        <div>
                          <label className="form-label small text-muted mb-1">Email Address</label>
                          <p className="mb-0 fw-medium">{userData.email}</p>
                        </div>
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="d-flex align-items-center gap-3">
                        <div className="flex-shrink-0">
                          <div className="bg-warning bg-opacity-10 rounded-circle d-flex align-items-center justify-content-center" style={{ width: '2.5rem', height: '2.5rem' }}>
                            <ShieldCheckIcon className="h-5 w-5 text-warning" />
                          </div>
                        </div>
                        <div>
                          <label className="form-label small text-muted mb-1">Role</label>
                          <p className="mb-0 fw-medium text-capitalize">{userData.role}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="border-top pt-3 mt-3">
                    <div className="col-12">
                      <div className="d-flex align-items-center gap-3">
                        <div className="flex-shrink-0">
                          <div className="bg-secondary bg-opacity-10 rounded-circle d-flex align-items-center justify-content-center" style={{ width: '2.5rem', height: '2.5rem' }}>
                            <CalendarIcon className="h-5 w-5 text-secondary" />
                          </div>
                        </div>
                        <div>
                          <label className="form-label small text-muted mb-1">Account Created</label>
                          <p className="mb-0 fw-medium">
                            {userData.created_at ? new Date(userData.created_at).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            }) : 'N/A'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Dark Mode Preference */}
            <div className="col-12">
              <h2 className="h5 mb-3">Appearance Settings</h2>
              <div className="card">
                <div className="card-body">
                  <div className="d-flex align-items-center justify-content-between">
                    <div className="d-flex align-items-center gap-3">
                      <div className="flex-shrink-0">
                        <div className="bg-warning bg-opacity-10 rounded-circle d-flex align-items-center justify-content-center" style={{ width: '2.5rem', height: '2.5rem' }}>
                          <SunIcon className="h-5 w-5 text-warning" />
                        </div>
                      </div>
                      <div>
                        <label className="form-label small text-muted mb-1">Dark Mode</label>
                        <p className="mb-0 small">Toggle between light and dark theme</p>
                      </div>
                    </div>
                    <DarkModeToggle />
                  </div>
                </div>
              </div>
            </div>

            {/* Password Change */}
            <div className="col-12">
              <h2 className="h5 mb-3">Security</h2>
              <div className="card">
                <div className="card-body">
                  <div className="d-flex align-items-center justify-content-between mb-3">
                    <div className="d-flex align-items-center gap-3">
                      <div className="flex-shrink-0">
                        <div className="bg-danger bg-opacity-10 rounded-circle d-flex align-items-center justify-content-center" style={{ width: '2.5rem', height: '2.5rem' }}>
                          <KeyIcon className="h-5 w-5 text-danger" />
                        </div>
                      </div>
                      <div>
                        <h3 className="h6 mb-1">Password</h3>
                        <p className="mb-0 small text-muted">Update your password to keep your account secure</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowPasswordChange(!showPasswordChange)}
                      className="btn btn-primary"
                    >
                      Change Password
                    </button>
                  </div>

                  {showPasswordChange && (
                    <div className="border-top pt-3">
                      <form onSubmit={handlePasswordUpdate}>
                        <div className="row g-3">
                          <div className="col-md-6">
                            <label className="form-label">Current Password</label>
                            <input
                              type="password"
                              name="current_password"
                              value={passwordData.current_password}
                              onChange={handlePasswordChange}
                              className="form-control"
                              placeholder="Enter your current password"
                              required
                            />
                          </div>
                          <div className="col-md-6">
                            <label className="form-label">New Password</label>
                            <input
                              type="password"
                              name="new_password"
                              value={passwordData.new_password}
                              onChange={handlePasswordChange}
                              className="form-control"
                              placeholder="Enter your new password"
                              required
                            />
                            <div className="form-text">Minimum 6 characters</div>
                          </div>
                          <div className="col-md-6">
                            <label className="form-label">Confirm New Password</label>
                            <input
                              type="password"
                              name="confirm_password"
                              value={passwordData.confirm_password}
                              onChange={handlePasswordChange}
                              className="form-control"
                              placeholder="Confirm your new password"
                              required
                            />
                          </div>
                          <div className="col-12">
                            <div className="d-flex gap-2">
                              <button
                                type="submit"
                                disabled={loading}
                                className="btn btn-primary"
                              >
                                {loading ? (
                                  <>
                                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                                    Updating...
                                  </>
                                ) : (
                                  'Update Password'
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setShowPasswordChange(false);
                                  setPasswordData({
                                    current_password: '',
                                    new_password: '',
                                    confirm_password: ''
                                  });
                                }}
                                className="btn btn-outline-secondary"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        </div>
                      </form>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Attendance */}
            <div className="col-12">
              <h2 className="h5 mb-3">Attendance</h2>
              <div className="card">
                <div className="card-body">
                  <div className="d-flex align-items-center justify-content-between mb-3">
                    <div className="d-flex align-items-center gap-3">
                      <div className="flex-shrink-0">
                        <div className="bg-info bg-opacity-10 rounded-circle d-flex align-items-center justify-content-center" style={{ width: '2.5rem', height: '2.5rem' }}>
                          <ClockIcon className="h-5 w-5 text-info" />
                        </div>
                      </div>
                      <div>
                        <h3 className="h6 mb-1">Time Tracking</h3>
                        <p className="mb-0 small text-muted">Clock in and out of your shifts</p>
                      </div>
                    </div>
                    <div className="d-flex gap-2">
                      <button
                        onClick={clockIn}
                        disabled={!hasEmployeeProfile}
                        className="btn btn-success btn-sm"
                      >
                        <ClockIcon className="h-4 w-4 me-1" />
                        Clock In
                      </button>
                      <button
                        onClick={clockOut}
                        disabled={!hasEmployeeProfile}
                        className="btn btn-danger btn-sm"
                      >
                        <ClockIcon className="h-4 w-4 me-1" />
                        Clock Out
                      </button>
                    </div>
                  </div>

                  {!hasEmployeeProfile ? (
                    <div className="alert alert-warning">
                      <div className="d-flex align-items-center">
                        <ExclamationTriangleIcon className="h-5 w-5 text-warning me-2" />
                        <div>
                          <strong>No Employee Profile:</strong> Your user account is not linked to an employee profile. 
                          Attendance tracking is not available. Please contact your administrator to set up an employee profile.
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="alert alert-info">
                      <div className="d-flex align-items-center">
                        <InformationCircleIcon className="h-5 w-5 text-info me-2" />
                        <div>
                          <strong>Note:</strong> Attendance tracking requires an employee profile to be linked to your user account. 
                          If you don't see any attendance records, please contact your administrator.
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="table-responsive">
                    <table className="table table-striped">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Clock In</th>
                          <th>Clock Out</th>
                          <th>Total Hours</th>
                        </tr>
                      </thead>
                      <tbody>
                        {attendanceRecords.length === 0 ? (
                          <tr>
                            <td colSpan="4" className="text-center py-4">
                              <DocumentTextIcon className="h-12 w-12 text-muted mx-auto mb-2" />
                              <p className="text-muted">No attendance records found</p>
                            </td>
                          </tr>
                        ) : (
                          attendanceRecords.map((record) => (
                            <tr key={record.id}>
                              <td className="fw-medium">{formatDate(record.date)}</td>
                              <td>
                                {record.clock_in ? (
                                  <span className="badge bg-success">
                                    {formatTime(record.clock_in)}
                                  </span>
                                ) : (
                                  <span className="text-muted">-</span>
                                )}
                              </td>
                              <td>
                                {record.clock_out ? (
                                  <span className="badge bg-danger">
                                    {formatTime(record.clock_out)}
                                  </span>
                                ) : (
                                  <span className="text-muted">-</span>
                                )}
                              </td>
                              <td>
                                {record.total_hours ? (
                                  <span className="badge bg-primary">
                                    {record.total_hours}h
                                  </span>
                                ) : (
                                  <span className="text-muted">-</span>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Messages */}
          {error && (
            <div className="alert alert-danger mt-3">
              <div className="d-flex align-items-center">
                <ExclamationTriangleIcon className="h-5 w-5 text-danger me-2" />
                <div>{error}</div>
              </div>
            </div>
          )}
          
          {success && (
            <div className="alert alert-success mt-3">
              <div className="d-flex align-items-center">
                <CheckCircleIcon className="h-5 w-5 text-success me-2" />
                <div>{success}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Profile;
