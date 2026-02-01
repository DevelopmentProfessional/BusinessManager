import React, { useState, useEffect } from 'react';
import { 
  CogIcon, 
  ServerIcon,
  BellIcon,
  ShieldCheckIcon,
  PaintBrushIcon,
  UserIcon,
  EnvelopeIcon,
  CalendarIcon,
  KeyIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  CircleStackIcon,
  SwatchIcon
} from '@heroicons/react/24/outline';
import useStore from '../services/useStore';
import api from '../services/api';
import DarkModeToggle from './components/DarkModeToggle';
import ApiDebugInfo from './components/ApiDebugInfo';

export default function Settings() {
  const { user } = useStore();
  const [activeTab, setActiveTab] = useState('account');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [passwordData, setPasswordData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  });

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
      // Initialize with current env values
      setDbSettings({
        connectionString: '',
        apiBaseUrl: import.meta.env.VITE_API_URL || '',
        onlyofficeUrl: import.meta.env.VITE_ONLYOFFICE_URL || ''
      });
    }
  }, []);

  const handleSaveBranding = () => {
    localStorage.setItem('app_branding', JSON.stringify(branding));
    // Apply CSS variables for immediate effect
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

  const handleBrandingChange = (field, value) => {
    setBranding(prev => ({ ...prev, [field]: value }));
  };

  const handleDbSettingsChange = (field, value) => {
    setDbSettings(prev => ({ ...prev, [field]: value }));
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

  const tabs = [
    { id: 'account', name: 'Account', icon: UserIcon },
    { id: 'branding', name: 'Branding', icon: SwatchIcon },
    { id: 'database', name: 'Database', icon: CircleStackIcon },
    { id: 'general', name: 'General', icon: CogIcon },
    { id: 'api', name: 'API & Debug', icon: ServerIcon },
    { id: 'notifications', name: 'Notifications', icon: BellIcon },
  ];

  return (
    <div className="p-6">
      <div className="mb-1">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <CogIcon className="h-8 w-8" />
          Settings
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Manage your application preferences and configuration
        </p>
      </div>

      <div className="flex gap-6">
        {/* Sidebar Navigation */}
        <div className="w-64 flex-shrink-0">
          <nav className="space-y-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
                    activeTab === tab.id
                      ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 font-medium'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  {tab.name}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Content Area */}
        <div className="flex-1">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            
            {/* Account Settings */}
            {activeTab === 'account' && (
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-1">
                  Account Settings
                </h2>
                
                {/* Personal Information */}
                <div className="mb-1">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">Personal Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
                    <div className="p-1 bg-gray-50 dark:bg-gray-900 rounded-lg">
                      <div className="flex items-center gap-1">
                        <div className="flex-shrink-0">
                          <div className="bg-blue-100 dark:bg-blue-900/30 rounded-full p-2">
                            <UserIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                          </div>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Full Name</p>
                          <p className="font-medium text-gray-900 dark:text-white">{user?.first_name} {user?.last_name}</p>
                        </div>
                      </div>
                    </div>
                    <div className="p-1 bg-gray-50 dark:bg-gray-900 rounded-lg">
                      <div className="flex items-center gap-1">
                        <div className="flex-shrink-0">
                          <div className="bg-green-100 dark:bg-green-900/30 rounded-full p-2">
                            <UserIcon className="h-5 w-5 text-green-600 dark:text-green-400" />
                          </div>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Username</p>
                          <p className="font-medium text-gray-900 dark:text-white">{user?.username}</p>
                        </div>
                      </div>
                    </div>
                    <div className="p-1 bg-gray-50 dark:bg-gray-900 rounded-lg">
                      <div className="flex items-center gap-1">
                        <div className="flex-shrink-0">
                          <div className="bg-purple-100 dark:bg-purple-900/30 rounded-full p-2">
                            <EnvelopeIcon className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                          </div>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Email</p>
                          <p className="font-medium text-gray-900 dark:text-white">{user?.email}</p>
                        </div>
                      </div>
                    </div>
                    <div className="p-1 bg-gray-50 dark:bg-gray-900 rounded-lg">
                      <div className="flex items-center gap-1">
                        <div className="flex-shrink-0">
                          <div className="bg-yellow-100 dark:bg-yellow-900/30 rounded-full p-2">
                            <ShieldCheckIcon className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                          </div>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Role</p>
                          <p className="font-medium text-gray-900 dark:text-white capitalize">{user?.role}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Appearance */}
                <div className="mb-1">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">Appearance</h3>
                  <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-white">Dark Mode</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Toggle between light and dark theme</p>
                    </div>
                    <DarkModeToggle />
                  </div>
                </div>

                {/* Password Change */}
                <div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">Security</h3>
                  <div className="p-1 bg-gray-50 dark:bg-gray-900 rounded-lg">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1">
                        <div className="flex-shrink-0">
                          <div className="bg-red-100 dark:bg-red-900/30 rounded-full p-2">
                            <KeyIcon className="h-5 w-5 text-red-600 dark:text-red-400" />
                          </div>
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-900 dark:text-white">Password</h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400">Update your password to keep your account secure</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setShowPasswordChange(!showPasswordChange)}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                      >
                        Change Password
                      </button>
                    </div>

                    {showPasswordChange && (
                      <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
                        <form onSubmit={handlePasswordUpdate} className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                              Current Password
                            </label>
                            <input
                              type="password"
                              name="current_password"
                              value={passwordData.current_password}
                              onChange={handlePasswordChange}
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              placeholder="Enter your current password"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                              New Password
                            </label>
                            <input
                              type="password"
                              name="new_password"
                              value={passwordData.new_password}
                              onChange={handlePasswordChange}
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              placeholder="Enter your new password"
                              required
                            />
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Minimum 6 characters</p>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                              Confirm New Password
                            </label>
                            <input
                              type="password"
                              name="confirm_password"
                              value={passwordData.confirm_password}
                              onChange={handlePasswordChange}
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              placeholder="Confirm your new password"
                              required
                            />
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="submit"
                              disabled={loading}
                              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg transition-colors disabled:cursor-not-allowed"
                            >
                              {loading ? 'Updating...' : 'Update Password'}
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
                                setError('');
                                setSuccess('');
                              }}
                              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </form>
                      </div>
                    )}
                  </div>
                </div>

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

            {/* Branding Settings */}
            {activeTab === 'branding' && (
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-1">
                  Branding Settings
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                  Customize the look and feel of the application for all users.
                </p>

                {/* Company Info */}
                <div className="mb-1">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">Company Information</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Company Name
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
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Tagline
                      </label>
                      <input
                        type="text"
                        value={branding.tagline}
                        onChange={(e) => handleBrandingChange('tagline', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                        placeholder="Your company tagline"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Logo URL
                      </label>
                      <input
                        type="url"
                        value={branding.logoUrl}
                        onChange={(e) => handleBrandingChange('logoUrl', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                        placeholder="https://example.com/logo.png"
                      />
                      {branding.logoUrl && (
                        <div className="mt-2 p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
                          <img 
                            src={branding.logoUrl} 
                            alt="Logo preview" 
                            className="h-12 object-contain"
                            onError={(e) => e.target.style.display = 'none'}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Color Scheme */}
                <div className="mb-1">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">Color Scheme</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Primary Color
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={branding.primaryColor}
                          onChange={(e) => handleBrandingChange('primaryColor', e.target.value)}
                          className="w-12 h-10 rounded border border-gray-300 cursor-pointer"
                        />
                        <input
                          type="text"
                          value={branding.primaryColor}
                          onChange={(e) => handleBrandingChange('primaryColor', e.target.value)}
                          className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-mono text-sm"
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">Used for buttons, links, and accents</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Secondary Color
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={branding.secondaryColor}
                          onChange={(e) => handleBrandingChange('secondaryColor', e.target.value)}
                          className="w-12 h-10 rounded border border-gray-300 cursor-pointer"
                        />
                        <input
                          type="text"
                          value={branding.secondaryColor}
                          onChange={(e) => handleBrandingChange('secondaryColor', e.target.value)}
                          className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-mono text-sm"
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">Used for success states and highlights</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Accent Color
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={branding.accentColor}
                          onChange={(e) => handleBrandingChange('accentColor', e.target.value)}
                          className="w-12 h-10 rounded border border-gray-300 cursor-pointer"
                        />
                        <input
                          type="text"
                          value={branding.accentColor}
                          onChange={(e) => handleBrandingChange('accentColor', e.target.value)}
                          className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-mono text-sm"
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">Used for special elements and badges</p>
                    </div>
                  </div>
                </div>

                {/* Preview */}
                <div className="mb-1">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">Preview</h3>
                  <div className="p-1 bg-gray-50 dark:bg-gray-900 rounded-lg">
                    <div className="flex items-center gap-4 mb-4">
                      {branding.logoUrl && (
                        <img src={branding.logoUrl} alt="Logo" className="h-8 object-contain" onError={(e) => e.target.style.display = 'none'} />
                      )}
                      <div>
                        <h4 className="font-bold" style={{ color: branding.primaryColor }}>{branding.companyName || 'Company Name'}</h4>
                        {branding.tagline && <p className="text-sm text-gray-500">{branding.tagline}</p>}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        className="px-4 py-2 text-white rounded-lg"
                        style={{ backgroundColor: branding.primaryColor }}
                      >
                        Primary Button
                      </button>
                      <button 
                        className="px-4 py-2 text-white rounded-lg"
                        style={{ backgroundColor: branding.secondaryColor }}
                      >
                        Secondary
                      </button>
                      <span 
                        className="px-3 py-2 text-white rounded-full text-sm"
                        style={{ backgroundColor: branding.accentColor }}
                      >
                        Accent Badge
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleSaveBranding}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  Save Branding Settings
                </button>

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

            {/* Database/Connection Settings */}
            {activeTab === 'database' && (
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-1">
                  Database & Connection Settings
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                  Configure database connection and external service URLs. Changes require admin privileges.
                </p>

                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6">
                  <div className="flex items-start gap-2">
                    <ExclamationTriangleIcon className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-yellow-800 dark:text-yellow-300">Important</h4>
                      <p className="text-sm text-yellow-700 dark:text-yellow-400">
                        These settings are stored locally and override environment variables. 
                        For production deployments, configure these via environment variables instead.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  {/* Database Connection String */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Database Connection String
                    </label>
                    <input
                      type="password"
                      value={dbSettings.connectionString}
                      onChange={(e) => handleDbSettingsChange('connectionString', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                      placeholder="postgresql://user:password@host:port/database"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      PostgreSQL connection string for the backend database
                    </p>
                  </div>

                  {/* API Base URL */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      API Base URL
                    </label>
                    <input
                      type="url"
                      value={dbSettings.apiBaseUrl}
                      onChange={(e) => handleDbSettingsChange('apiBaseUrl', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                      placeholder="http://localhost:8000/api/v1"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Base URL for the backend API (VITE_API_URL)
                    </p>
                  </div>

                  {/* OnlyOffice URL */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      OnlyOffice Document Server URL
                    </label>
                    <input
                      type="url"
                      value={dbSettings.onlyofficeUrl}
                      onChange={(e) => handleDbSettingsChange('onlyofficeUrl', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                      placeholder="http://localhost:8082"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      URL for OnlyOffice Document Server for document editing (VITE_ONLYOFFICE_URL)
                    </p>
                  </div>

                  {/* Current Environment Info */}
                  <div className="p-1 bg-gray-50 dark:bg-gray-900 rounded-lg">
                    <h4 className="font-medium text-gray-900 dark:text-white mb-2">Current Environment</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">VITE_API_URL:</span>
                        <code className="text-gray-900 dark:text-white bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded">
                          {import.meta.env.VITE_API_URL || '(not set)'}
                        </code>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">VITE_ONLYOFFICE_URL:</span>
                        <code className="text-gray-900 dark:text-white bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded">
                          {import.meta.env.VITE_ONLYOFFICE_URL || '(not set)'}
                        </code>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Environment:</span>
                        <code className="text-gray-900 dark:text-white bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded">
                          {import.meta.env.DEV ? 'Development' : 'Production'}
                        </code>
                      </div>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleSaveDbSettings}
                  className="mt-6 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  Save Connection Settings
                </button>

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

            {/* General Settings */}
            {activeTab === 'general' && (
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-1">
                  General Settings
                </h2>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                    <div>
                      <h3 className="font-medium text-gray-900 dark:text-white">Application Version</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">1.0.0</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                    <div>
                      <h3 className="font-medium text-gray-900 dark:text-white">Environment</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {import.meta.env.DEV ? 'Development' : 'Production'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* API & Debug Settings */}
            {activeTab === 'api' && (
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-1">
                  API & Debug Information
                </h2>
                <ApiDebugInfo />
              </div>
            )}

            {/* Notifications Settings */}
            {activeTab === 'notifications' && (
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-1">
                  Notification Settings
                </h2>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                    <div>
                      <h3 className="font-medium text-gray-900 dark:text-white">Email Notifications</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Receive email updates about appointments and changes
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" defaultChecked />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                </div>
              </div>
            )}


          </div>
        </div>
      </div>
    </div>
  );
}
