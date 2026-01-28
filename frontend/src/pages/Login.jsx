import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  EyeIcon, 
  EyeSlashIcon, 
  UserIcon, 
  LockClosedIcon, 
  ExclamationTriangleIcon, 
  CheckCircleIcon,
  ArrowPathIcon 
} from '@heroicons/react/24/outline';
import useStore from '../services/useStore';
import useDarkMode from '../services/useDarkMode';
import api from '../services/api';

const Login = () => {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    remember_me: false
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [resetData, setResetData] = useState({
    username: '',
    new_password: '',
    confirm_password: ''
  });
  
  const navigate = useNavigate();
  const { setUser, setToken, setPermissions } = useStore();
  const { setDarkMode } = useDarkMode();

  // Set dark mode by default on login page
  useEffect(() => {
    setDarkMode(true);
  }, [setDarkMode]);

  const getCookie = (name) => {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
  };

  useEffect(() => {
    // Check cookies for saved parameters
    const savedRememberMe = getCookie('rememberMe') === 'true';
    const savedUsername = getCookie('savedUsername');
    const savedPassword = getCookie('savedPassword');
    
    console.log('Saved data found in cookies:', { savedRememberMe, savedUsername, savedPassword });
    
    // If remember me is true, set the form values
    if (savedRememberMe) {
      setFormData({
        username: savedUsername || '',
        password: savedPassword || '',
        remember_me: true
      });
    }

    // Check if user is already logged in
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    if (token) {
      navigate('/profile');
    }
  }, [navigate]);

  const validateForm = () => {
    const errors = {};
    
    if (!formData.username.trim()) {
      errors.username = 'Username is required';
    } else if (formData.username.length < 2) {
      errors.username = 'Username must be at least 2 characters';
    }
    
    if (!formData.password) {
      errors.password = 'Password is required';
    } else if (formData.password.length < 3) {
      errors.password = 'Password must be at least 3 characters';
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    
    // Clear validation errors when user types
    if (validationErrors[name]) {
      setValidationErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
    
    // Clear general error when user makes changes
    if (error) setError('');
    if (success) setSuccess('');
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const saveUserCredentials = (username, password, rememberMe) => {
    try {
      if (rememberMe) {
        console.log('Saving user credentials:', { username, rememberMe });
        const expireDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toUTCString();
        document.cookie = `rememberMe=true; expires=${expireDate}; path=/; secure; samesite=strict`;
        document.cookie = `savedUsername=${encodeURIComponent(username)}; expires=${expireDate}; path=/; secure; samesite=strict`;
        document.cookie = `savedPassword=${encodeURIComponent(password)}; expires=${expireDate}; path=/; secure; samesite=strict`;
        console.log('Data saved to cookies');
      } else {
        console.log('Clearing saved credentials');
        document.cookie = 'rememberMe=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
        document.cookie = 'savedUsername=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
        document.cookie = 'savedPassword=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
      }
      return true;
    } catch (error) {
      console.error('Failed to save credentials:', error);
      return false;
    }
  };

  const handleResetInputChange = (e) => {
    const { name, value } = e.target;
    setResetData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    
    // Clear previous states
    setError('');
    setSuccess('');
    setValidationErrors({});
    
    // Validate form before submission
    if (!validateForm()) {
      setError('Please fix the validation errors below.');
      return;
    }
    
    setLoading(true);
    const selectedStorage = formData.remember_me ? localStorage : sessionStorage;
    
    const loginData = {
      username: formData.username.trim(),
      password: formData.password,
    };

    try {
      const backendUrl = `${api.defaults.baseURL}/auth/login`;
      
      const response = await fetch(backendUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(loginData),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = 'Login failed. Please check your credentials.';
        
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.detail || errorMessage;
        } catch (parseError) {
          if (response.status === 401) {
            errorMessage = 'Invalid username or password.';
          } else if (response.status >= 500) {
            errorMessage = 'Server error. Please try again later.';
          }
        }
        
        setError(errorMessage);
        return;
      }
      
      const data = await response.json();

      if (data.access_token && data.user) {
        // Store authentication data
        selectedStorage.setItem('token', data.access_token);
        selectedStorage.setItem('user', JSON.stringify(data.user));
        
        // Update Zustand store
        setToken(data.access_token);
        setUser(data.user);
        if (data.permissions) {
          selectedStorage.setItem('permissions', JSON.stringify(data.permissions));
          setPermissions(data.permissions);
        }
        
        // Save credentials if remember me is checked
        saveUserCredentials(formData.username.trim(), formData.password, formData.remember_me);
        
        // Show success message briefly
        setSuccess('Login successful! Redirecting...');
        
        // Navigate to profile after a brief delay
        setTimeout(() => {
          navigate('/profile');
        }, 1000);
      } else {
        throw new Error('Invalid response format');
      }
    } catch (error) {
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        setError('Cannot connect to server. Please check if the server is running.');
      } else {
        setError(error.message || 'An unexpected error occurred. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async (e) => {
    e.preventDefault();
    
    if (resetData.new_password !== resetData.confirm_password) {
      setError('Passwords do not match');
      return;
    }
    
    if (resetData.new_password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }
    
    setLoading(true);
    setError('');

    try {
      await api.post('/auth/reset-password', {
        username: resetData.username,
        new_password: resetData.new_password
      });
      
      setError('');
      setShowPasswordReset(false);
      setResetData({ username: '', new_password: '', confirm_password: '' });
      alert('Password reset successfully! You can now login with your new password.');
      
    } catch (err) {
      setError(err.response?.data?.detail || 'Password reset failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-gray-800 dark:bg-gray-800 border border-gray-700 p-8 rounded-2xl shadow-xl">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 flex items-center justify-center rounded-xl bg-indigo-900/50 mb-4">
            <svg className="h-6 w-6 text-indigo-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m2.25-18h15.75m-18 0l19.5 0m-19.5 0v18m0 0h2.25m15.75-18v18m0 0h2.25" />
            </svg>
          </div>
          <h2 className="text-3xl font-bold text-white dark:text-white mb-2">
            Business Manager
          </h2>
          <p className="text-sm text-gray-300 dark:text-gray-300">
            Sign in to your account to get started
          </p>
        </div>
        
        {!showPasswordReset ? (
          <form className="mt-8 space-y-6" onSubmit={handleLogin}>
            {/* Success Message */}
            {success && (
              <div className="rounded-lg bg-green-900/30 border border-green-700 p-4">
                <div className="flex">
                  <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <p className="ml-3 text-sm font-medium text-green-300">{success}</p>
                </div>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="rounded-lg bg-red-900/30 border border-red-700 p-4">
                <div className="flex">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <p className="ml-3 text-sm font-medium text-red-300">{error}</p>
                </div>
              </div>
            )}

            <div className="space-y-4">
              {/* Username Field */}
              <div>
                <label htmlFor="username" className="block text-sm font-medium text-gray-200 dark:text-gray-200 mb-2">
                  Username
                </label>
                <input
                  id="username"
                  name="username"
                  type="text"
                  required
                  className={`w-full px-4 py-3 border rounded-lg shadow-sm placeholder-gray-500 bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors ${
                    validationErrors.username ? 'border-red-500 bg-red-900/20' : 'border-gray-600'
                  }`}
                  placeholder="Enter your username"
                  value={formData.username}
                  onChange={handleInputChange}
                />
                {validationErrors.username && (
                  <p className="mt-1 text-sm text-red-400">{validationErrors.username}</p>
                )}
              </div>

              {/* Password Field */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-200 dark:text-gray-200 mb-2">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    className={`w-full px-4 py-3 pr-12 border rounded-lg shadow-sm placeholder-gray-500 bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors ${
                      validationErrors.password ? 'border-red-500 bg-red-900/20' : 'border-gray-600'
                    }`}
                    placeholder="Enter your password"
                    value={formData.password}
                    onChange={handleInputChange}
                  />
                  <button
                    type="button"
                    onClick={togglePasswordVisibility}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-300 transition-colors"
                  >
                    {showPassword ? (
                      <EyeSlashIcon className="h-5 w-5" />
                    ) : (
                      <EyeIcon className="h-5 w-5" />
                    )}
                  </button>
                </div>
                {validationErrors.password && (
                  <p className="mt-1 text-sm text-red-400">{validationErrors.password}</p>
                )}
              </div>
            </div>

            {/* Remember Me & Forgot Password */}
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="remember_me"
                  name="remember_me"
                  type="checkbox"
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-500 bg-gray-700 rounded"
                  checked={formData.remember_me}
                  onChange={handleInputChange}
                />
                <label htmlFor="remember_me" className="ml-2 block text-sm text-gray-200 dark:text-gray-200">
                  Remember me for 30 days
                </label>
              </div>

              <button
                type="button"
                onClick={() => setShowPasswordReset(true)}
                className="text-sm font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                Forgot password?
              </button>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              {loading ? (
                <div className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Signing in...
                </div>
              ) : (
                'Sign in to Business Manager'
              )}
            </button>
          </form>
        ) : (
          <div className="mt-8">
            <div className="mb-6 text-center">
              <h3 className="text-lg font-medium text-white dark:text-white">Reset Password</h3>
              <p className="mt-1 text-sm text-gray-300 dark:text-gray-300">Enter your username and new password</p>
            </div>
            
            <form className="space-y-6" onSubmit={handlePasswordReset}>
              {/* Error Message */}
              {error && (
                <div className="rounded-lg bg-red-900/30 border border-red-700 p-4">
                  <div className="flex">
                    <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    <p className="ml-3 text-sm font-medium text-red-300">{error}</p>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                {/* Username Field */}
                <div>
                  <label htmlFor="reset-username" className="block text-sm font-medium text-gray-200 dark:text-gray-200 mb-2">
                    Username
                  </label>
                  <input
                    id="reset-username"
                    name="username"
                    type="text"
                    required
                    className="w-full px-4 py-3 border border-gray-600 bg-gray-700 text-white rounded-lg shadow-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
                    placeholder="Enter your username"
                    value={resetData.username}
                    onChange={handleResetInputChange}
                  />
                </div>

                {/* New Password Field */}
                <div>
                  <label htmlFor="new-password" className="block text-sm font-medium text-gray-200 dark:text-gray-200 mb-2">
                    New Password
                  </label>
                  <input
                    id="new-password"
                    name="new_password"
                    type="password"
                    required
                    className="w-full px-4 py-3 border border-gray-600 bg-gray-700 text-white rounded-lg shadow-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
                    placeholder="Enter new password (min 6 characters)"
                    value={resetData.new_password}
                    onChange={handleResetInputChange}
                  />
                </div>

                {/* Confirm Password Field */}
                <div>
                  <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-200 dark:text-gray-200 mb-2">
                    Confirm Password
                  </label>
                  <input
                    id="confirm-password"
                    name="confirm_password"
                    type="password"
                    required
                    className="w-full px-4 py-3 border border-gray-600 bg-gray-700 text-white rounded-lg shadow-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
                    placeholder="Confirm new password"
                    value={resetData.confirm_password}
                    onChange={handleResetInputChange}
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowPasswordReset(false);
                    setError('');
                    setResetData({ username: '', new_password: '', confirm_password: '' });
                  }}
                  className="flex-1 py-3 px-4 border border-gray-600 rounded-lg shadow-sm text-sm font-medium text-gray-200 bg-gray-700 hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
                >
                  Back to Login
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                >
                  {loading ? (
                    <div className="flex items-center justify-center">
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Resetting...
                    </div>
                  ) : (
                    'Reset Password'
                  )}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default Login;
