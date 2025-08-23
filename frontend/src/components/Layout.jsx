import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  UserGroupIcon,
  WrenchScrewdriverIcon,
  UsersIcon,
  CalendarDaysIcon,
  ArchiveBoxIcon,
  ClockIcon,
  DocumentIcon,
  EllipsisHorizontalIcon,
  UserIcon,
  Cog6ToothIcon,
  ArrowRightOnRectangleIcon,
} from '@heroicons/react/24/outline';
import useStore from '../store/useStore';

// All navigation items (shown in bottom-right expandable menu on mobile)
const allNavigation = [
  { name: 'Dashboard', href: '/dashboard', icon: UserIcon },
  { name: 'Schedule', href: '/schedule', icon: CalendarDaysIcon, permission: 'schedule:read' },
  { name: 'Inventory', href: '/inventory', icon: ArchiveBoxIcon, permission: 'inventory:read' },
  { name: 'Clients', href: '/clients', icon: UserGroupIcon, permission: 'clients:read' },
  { name: 'Documents', href: '/documents', icon: DocumentIcon, permission: 'documents:read' },
  { name: 'Services', href: '/services', icon: WrenchScrewdriverIcon, permission: 'services:read' },
  { name: 'Employees', href: '/employees', icon: UsersIcon, permission: 'employees:read' },
  { name: 'Attendance', href: '/attendance', icon: ClockIcon, permission: 'attendance:read' },
  { name: 'Admin', href: '/admin', icon: Cog6ToothIcon, permission: 'admin:admin' },
];

function classNames(...classes) {
  return classes.filter(Boolean).join(' ');
}

export default function Layout({ children }) {
  const [expandedMenuOpen, setExpandedMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, hasPermission } = useStore();

  const handleLogout = () => {
    logout();
    // TEMPORARY: Redirect to dashboard instead of login during development
    navigate('/dashboard');
  };

  // Filter navigation items based on user permissions
  const filteredNavigation = allNavigation.filter(item => {
    if (!item.permission) return true; // Dashboard and Profile don't need specific permissions
    return hasPermission(...item.permission.split(':'));
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Development Banner */}
      <div className="bg-yellow-400 border-b border-yellow-500 px-4 py-2">
        <div className="flex items-center justify-center text-sm font-medium text-yellow-900">
          🔓 DEVELOPMENT MODE: Login bypassed - Using fake admin session
        </div>
      </div>
      
      {/* Header with user info */}
      <div className="bg-white shadow-sm border-b border-gray-200 px-4 py-3">
        <div className="flex justify-between items-center">
          <h1 className="text-lg font-semibold text-gray-900">Business Manager</h1>
          <div className="flex items-center space-x-4">
            <div className="text-sm text-gray-600">
              Welcome, {user?.first_name || 'User'}
            </div>
            <Link
              to="/profile"
              className="text-indigo-600 hover:text-indigo-900 text-sm font-medium"
            >
              Profile
            </Link>
            <button
              onClick={handleLogout}
              className="text-red-600 hover:text-red-900 text-sm font-medium flex items-center"
            >
              <ArrowRightOnRectangleIcon className="h-4 w-4 mr-1" />
              Logout
            </button>
          </div>
        </div>
      </div>

      {/* Mobile-first layout (used for all widths) */}
       
        {/* Expanded menu overlay */}
        {expandedMenuOpen && (
          <div className="fixed inset-0 z-50">
            <div 
              className="fixed inset-0 bg-black bg-opacity-25" 
              onClick={() => setExpandedMenuOpen(false)}
            />
            
            {/* Expanded menu anchored to bottom-right */}
            <div className="fixed bottom-20 right-4 bg-white rounded-xl shadow-2xl border border-gray-200 p-4 min-w-48">
              <div className="space-y-2">
                {filteredNavigation.map((item) => (
                  <Link
                    key={item.name}
                    to={item.href}
                    onClick={() => setExpandedMenuOpen(false)}
                    className={classNames(
                      location.pathname === item.href
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-gray-700 hover:bg-gray-50',
                      'flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors'
                    )}
                  >
                    <item.icon className="h-5 w-5 mr-3" />
                    {item.name}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Main content */}  
            {children} 

        {/* Expand/collapse toggle - Bottom-right */}
        <button
          onClick={() => setExpandedMenuOpen(!expandedMenuOpen)}
          className={classNames(
            expandedMenuOpen
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-600 border border-gray-200',
            'fixed bottom-10 right-4 z-50 w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-all hover:shadow-xl'
          )}
        >
          <EllipsisHorizontalIcon className="h-6 w-6" />
        </button>
      

      {/* No desktop layout; mobile-only application */}
    </div>
  );
}
