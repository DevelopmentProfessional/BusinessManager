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
  Cog6ToothIcon,
  ArrowRightOnRectangleIcon,
  UserCircleIcon,
  TruckIcon,
} from '@heroicons/react/24/outline';
import useStore from '../store/useStore';
import DarkModeToggle from './DarkModeToggle';

// All navigation items (shown in bottom-right expandable menu on mobile)
const allNavigation = [
  { name: 'Profile', href: '/profile', icon: UserCircleIcon },
  { name: 'Schedule', href: '/schedule', icon: CalendarDaysIcon, permission: 'schedule:read' },
  { name: 'Inventory', href: '/inventory', icon: ArchiveBoxIcon, permission: 'inventory:read' },
  { name: 'Clients', href: '/clients', icon: UserGroupIcon, permission: 'clients:read' },
  { name: 'Documents', href: '/documents', icon: DocumentIcon, permission: 'documents:read' },
  { name: 'Services', href: '/services', icon: WrenchScrewdriverIcon, permission: 'services:read' },
  { name: 'Suppliers', href: '/suppliers', icon: TruckIcon, permission: 'suppliers:read' },
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
      // Redirect to login
  navigate('/login');
  };

  // Filter navigation items based on user permissions - show if user has ANY permission for the page
  const filteredNavigation = allNavigation.filter(item => {
    if (!item.permission) return true; // Dashboard and Profile don't need specific permissions
    
    const [page, permission] = item.permission.split(':');
    
    // Check if user has any permission for this page (read, write, delete, or admin)
    return hasPermission(page, 'read') || 
           hasPermission(page, 'write') || 
           hasPermission(page, 'delete') || 
           hasPermission(page, 'admin');
  });

  return (
    <div className="min-vh-100 bg-body">

      
      {/* Header with user info */}
      <div className="bg-body-tertiary border-bottom p-1">
        <div className="d-flex justify-content-between align-items-center">
          <div className="d-flex align-items-center gap-1">
            <DarkModeToggle />
            <h1 className="h6 mb-0 text-body-emphasis">{user?.first_name || 'User'}</h1>
          </div>
         
            <button onClick={handleLogout} className="btn btn-outline-danger btn-sm d-flex align-items-center gap-1"
            >
              <ArrowRightOnRectangleIcon className="h-4 w-4" />
              <span className="d-none d-sm-inline">Logout</span>
            </button> 
        </div>
      </div>

      {/* Mobile-first layout (used for all widths) */}
       
        {/* Expanded menu overlay */}
        {expandedMenuOpen && (
          <div className="position-fixed top-0 start-0 w-100 h-100" style={{ zIndex: 1050 }}>
            <div 
              className="position-fixed top-0 start-0 w-100 h-100 bg-dark bg-opacity-25" 
              onClick={() => setExpandedMenuOpen(false)}
            />
            
            {/* Expanded menu anchored to bottom-right */}
            <div className="position-fixed bottom-0 end-0 m-1 bg-body rounded-3 shadow-lg border p-1" style={{ minWidth: '12rem', zIndex: 1051 }}>
              <div className="d-flex flex-column gap-1">
                {filteredNavigation.map((item) => (
                  <Link
                    key={item.name}
                    to={item.href}
                    onClick={() => setExpandedMenuOpen(false)}
                    className={classNames(
                      location.pathname === item.href
                        ? 'btn btn-primary btn-sm'
                        : 'btn btn-outline-secondary btn-sm',
                      'd-flex align-items-center gap-2 text-decoration-none'
                    )}
                  >
                    <item.icon className="h-4 w-4" />
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
              ? 'btn btn-primary'
              : 'btn btn-outline-secondary',
            'position-fixed end-0 rounded-circle shadow-lg d-flex align-items-center justify-content-center'
          )}
          style={{ width: '3rem', height: '3rem', zIndex: 1040, bottom: '4px', right: '16px' }}
        >
          <EllipsisHorizontalIcon className="h-5 w-5" />
        </button>
      

      {/* No desktop layout; mobile-only application */}
      

    </div>
  );
}
