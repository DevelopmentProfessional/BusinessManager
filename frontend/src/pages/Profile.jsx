import React, { useState, useEffect } from 'react';
import useStore from '../store/useStore';
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
  EyeSlashIcon
} from '@heroicons/react/24/outline';

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
      const response = await attendanceAPI.checkEmployee();
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
      <div className="p-6 max-w-4xl mx-auto">
        <div className="bg-white shadow rounded-lg p-6">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
            <h2 className="text-lg font-medium text-gray-900 mb-2">Loading Profile...</h2>
            <p className="text-sm text-gray-500">Please wait while we load your profile information.</p>
            <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-700 mb-3">
                <strong>Debug Info:</strong> User data not loaded. This might be due to authentication issues.
              </p>

            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="bg-white shadow rounded-lg">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
        </div>

        <div className="p-6 space-y-8">
          {/* User Information */}
          <div>
            <h2 className="text-lg font-medium text-gray-900 mb-4">Personal Information</h2>
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex items-center space-x-3">
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                      <UserIcon className="w-5 h-5 text-indigo-600" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Full Name</label>
                    <p className="mt-1 text-sm text-gray-900 font-medium">{userData.first_name} {userData.last_name}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                      <UserIcon className="w-5 h-5 text-green-600" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Username</label>
                    <p className="mt-1 text-sm text-gray-900 font-medium">{userData.username}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <EnvelopeIcon className="w-5 h-5 text-blue-600" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Email Address</label>
                    <p className="mt-1 text-sm text-gray-900 font-medium">{userData.email}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                      <ShieldCheckIcon className="w-5 h-5 text-purple-600" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Role</label>
                    <p className="mt-1 text-sm text-gray-900 font-medium capitalize">{userData.role}</p>
                  </div>
                </div>
              </div>
              <div className="mt-6 pt-6 border-t border-gray-200">
                <div className="flex items-center space-x-3">
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                      <CalendarIcon className="w-5 h-5 text-gray-600" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Account Created</label>
                    <p className="mt-1 text-sm text-gray-900 font-medium">
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

          {/* Password Change */}
          <div>
            <h2 className="text-lg font-medium text-gray-900 mb-4">Security</h2>
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <p className="text-sm text-gray-600 mb-4">
                Keep your account secure by regularly updating your password. 
                Your new password must be at least 6 characters long.
              </p>
              {!showPasswordChange ? (
                <button
                  onClick={() => setShowPasswordChange(true)}
                  className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition-colors duration-200"
                >
                  <KeyIcon className="w-4 h-4 inline mr-2" />
                  Change Password
                </button>
              ) : (
                <form onSubmit={handlePasswordUpdate} className="space-y-4 max-w-md">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Current Password</label>
                    <input
                      type="password"
                      name="current_password"
                      value={passwordData.current_password}
                      onChange={handlePasswordChange}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder="Enter your current password"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">New Password</label>
                    <input
                      type="password"
                      name="new_password"
                      value={passwordData.new_password}
                      onChange={handlePasswordChange}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder="Enter your new password"
                      required
                    />
                    <p className="mt-1 text-xs text-gray-500">Minimum 6 characters</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Confirm New Password</label>
                    <input
                      type="password"
                      name="confirm_password"
                      value={passwordData.confirm_password}
                      onChange={handlePasswordChange}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder="Confirm your new password"
                      required
                    />
                  </div>
                  <div className="flex space-x-3">
                    <button
                      type="submit"
                      disabled={loading}
                      className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 disabled:opacity-50 transition-colors duration-200"
                    >
                      {loading ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Updating...
                        </>
                      ) : (
                        'Update Password'
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowPasswordChange(false)}
                      className="bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400 transition-colors duration-200"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>

          {/* Attendance */}
          <div>
            <h2 className="text-lg font-medium text-gray-900 mb-4">Attendance</h2>
            <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
              <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4">
                <button
                  onClick={clockIn}
                  disabled={!hasEmployeeProfile}
                  className={`flex items-center justify-center px-6 py-3 rounded-md transition-colors duration-200 ${
                    hasEmployeeProfile 
                      ? 'bg-green-600 text-white hover:bg-green-700' 
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  <ClockIcon className="w-5 h-5 mr-2" />
                  Clock In
                </button>
                <button
                  onClick={clockOut}
                  disabled={!hasEmployeeProfile}
                  className={`flex items-center justify-center px-6 py-3 rounded-md transition-colors duration-200 ${
                    hasEmployeeProfile 
                      ? 'bg-red-600 text-white hover:bg-red-700' 
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  <ClockIcon className="w-5 h-5 mr-2" />
                  Clock Out
                </button>
              </div>
              {!hasEmployeeProfile ? (
                <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-center">
                    <ExclamationTriangleIcon className="w-5 h-5 text-yellow-600 mr-2" />
                    <p className="text-sm text-yellow-700">
                      <strong>No Employee Profile:</strong> Your user account is not linked to an employee profile. 
                      Attendance tracking is not available. Please contact your administrator to set up an employee profile.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center">
                    <InformationCircleIcon className="w-5 h-5 text-blue-600 mr-2" />
                    <p className="text-sm text-blue-700">
                      <strong>Note:</strong> Attendance tracking requires an employee profile to be linked to your user account. 
                      If you don't see any attendance records, please contact your administrator.
                    </p>
                  </div>
                </div>
              )}
            </div>
            
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Clock In</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Clock Out</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Hours</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {attendanceRecords.length === 0 ? (
                      <tr>
                        <td colSpan="4" className="px-6 py-8 text-center text-sm text-gray-500">
                          <DocumentTextIcon className="mx-auto h-12 w-12 text-gray-400" />
                          <p className="mt-2">No attendance records found</p>
                        </td>
                      </tr>
                    ) : (
                      attendanceRecords.map((record) => (
                        <tr key={record.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                            {formatDate(record.date)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {record.clock_in ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                {formatTime(record.clock_in)}
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {record.clock_out ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                {formatTime(record.clock_out)}
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {record.total_hours ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                {record.total_hours}h
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
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

          {/* Messages */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <ExclamationTriangleIcon className="h-5 w-5 text-red-400" />
                </div>
                <div className="ml-3">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              </div>
            </div>
          )}
          
          {success && (
            <div className="bg-green-50 border border-green-200 rounded-md p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <CheckCircleIcon className="h-5 w-5 text-green-400" />
                </div>
                <div className="ml-3">
                  <p className="text-sm text-green-700">{success}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Profile;
