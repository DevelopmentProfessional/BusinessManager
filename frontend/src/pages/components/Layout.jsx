import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  UserGroupIcon,
  WrenchScrewdriverIcon,
  UsersIcon,
  CalendarDaysIcon,
  ArchiveBoxIcon,
  DocumentIcon,
  EllipsisHorizontalIcon,
  Cog6ToothIcon,
  UserCircleIcon,
  ChartBarIcon,
  ShoppingCartIcon,
  SparklesIcon,
  ClipboardDocumentListIcon,
} from '@heroicons/react/24/outline';
import useStore from '../../services/useStore';

// All navigation items (shown in bottom-right expandable menu on mobile)
// Order: Profile, Reports, Inventory, Clients, Employees, Documents, Sales, Services, Schedule, Settings
const allNavigation = [
  { name: 'Profile', href: '/profile', icon: UserCircleIcon },
  { name: 'Reports', href: '/reports', icon: ChartBarIcon, permission: 'reports:read' },
  { name: 'Inventory', href: '/inventory', icon: ArchiveBoxIcon, permission: 'inventory:read' },
  { name: 'Clients', href: '/clients', icon: UserGroupIcon, permission: 'clients:read' },
  { name: 'Employees', href: '/employees', icon: UsersIcon, permission: 'employees:read' },
  { name: 'Documents', href: '/documents', icon: DocumentIcon, permission: 'documents:read' },
  { name: 'Sales', href: '/sales', icon: ShoppingCartIcon, permission: 'services:read' },
  { name: 'Services', href: '/services', icon: SparklesIcon, permission: 'services:read' },
  { name: 'Schedule', href: '/schedule', icon: CalendarDaysIcon, permission: 'schedule:read' },
  { name: 'Tasks', href: '/tasks', icon: ClipboardDocumentListIcon },
  { name: 'Settings', href: '/settings', icon: Cog6ToothIcon },
];

function classNames(...classes) {
  return classes.filter(Boolean).join(' ');
}

export default function Layout({ children }) {
  const [expandedMenuOpen, setExpandedMenuOpen] = useState(false);
  const location = useLocation();
  const { hasPermission } = useStore();

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
    <div className="app-shell bg-body d-flex flex-column">
      {/* Main content - min-h-0 so children can use overflow without making page scroll */}
      <main className="app-shell-main flex-grow-1 d-flex flex-column min-h-0 overflow-hidden">
        {children}
      </main>

      {/* Navigation menu overlay */}
      {expandedMenuOpen && (
        <div className="position-fixed top-0 start-0 w-100 h-100" style={{ zIndex: 1050 }}>
          {/* Backdrop */}
          <div 
            className="position-fixed top-0 start-0 w-100 h-100 bg-dark bg-opacity-25" 
            onClick={() => setExpandedMenuOpen(false)}
          />
          
          {/* Menu positioned bottom-right */}
          <div 
            className="position-fixed bg-body rounded-3 shadow-lg border p-2" 
            style={{ 
              minWidth: '12rem', 
              zIndex: 1051, 
              bottom: '5rem', 
              right: '1rem' 
            }}
          >
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

      {/* Navigation toggle button - Bottom-right circle */}
      <button
        onClick={() => setExpandedMenuOpen(!expandedMenuOpen)}
        title={expandedMenuOpen ? 'Close menu' : 'Open menu'}
        aria-label={expandedMenuOpen ? 'Close menu' : 'Open menu'}
        className={classNames(
          expandedMenuOpen
            ? 'btn btn-primary'
            : 'btn btn-outline-secondary',
          'position-fixed rounded-circle shadow-lg d-flex align-items-center justify-content-center'
        )}
        style={{ 
          width: '3rem', 
          height: '3rem', 
          zIndex: 1040, 
          bottom: '1rem', 
          right: '1rem' 
        }}
      >
        <EllipsisHorizontalIcon className="h-5 w-5" />
      </button>

    </div>
  );
}
