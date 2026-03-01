import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  UserGroupIcon,
  WrenchScrewdriverIcon,
  UsersIcon,
  CalendarDaysIcon,
  ArchiveBoxIcon,
  DocumentIcon,
  EllipsisHorizontalIcon,
  UserCircleIcon,
  ChartBarIcon,
  ShoppingCartIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import useStore from '../../services/useStore';
import useViewMode from '../../services/useViewMode';

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
];

function classNames(...classes) {
  return classes.filter(Boolean).join(' ');
}

export default function Layout({ children }) {
  const [expandedMenuOpen, setExpandedMenuOpen] = useState(false);
  const location = useLocation();
  const { hasPermission, isOnline, setOnline } = useStore();
  const { isTrainingMode } = useViewMode();

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.body.classList.toggle('training-mode', isTrainingMode);
  }, [isTrainingMode]);

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [setOnline]);

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
      {/* Offline banner */}
      {!isOnline && (
        <div
          className="position-fixed start-0 end-0 top-0 d-flex align-items-center justify-content-center gap-2 px-3 py-2 text-sm"
          style={{ zIndex: 2000, backgroundColor: '#f59e0b', color: '#1c1917' }}
        >
          <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>
            You are offline — changes cannot be saved.
          </span>
        </div>
      )}

      {/* Main content - min-h-0 so children can use overflow without making page scroll */}
      <main
        className="app-shell-main flex-grow-1 d-flex flex-column min-h-0 overflow-hidden"
        style={!isOnline ? { paddingTop: '2rem' } : undefined}
      >
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
            className="position-fixed rounded-3 ps-2" 
            style={{ 
              minWidth: isTrainingMode ? '12rem' : '3.5rem', 
              zIndex: 1051, 
              bottom: '5rem', 
              right: '1rem' 
            }}
          >
            <div className="d-flex flex-column gap-2">
              {filteredNavigation.map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    onClick={() => setExpandedMenuOpen(false)}
                    className={classNames(
                      isActive ? 'btn btn-primary' : 'btn btn-outline-secondary',
                      'd-flex align-items-center text-decoration-none',
                      isTrainingMode ? 'btn-sm rounded-pill gap-2 px-3' : 'rounded-circle justify-content-center p-0'
                    )}
                    style={{
                      ...(isTrainingMode ? {} : { width: '3rem', height: '3rem' }),
                      backgroundColor: isActive ? 'var(--bs-primary)' : 'var(--bs-tertiary-bg)',
                      color: isActive ? 'var(--bs-white)' : 'var(--bs-body-color)',
                      borderColor: isActive ? 'var(--bs-primary)' : 'var(--bs-border-color)',
                    }}
                    title={item.name}
                  >
                    <item.icon className={classNames('flex-shrink-0', isTrainingMode ? 'h-4 w-4' : 'h-5 w-5')} />
                    {isTrainingMode && <span>{item.name}</span>}
                  </Link>
                );
              })}
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
          zIndex: 1100, 
          bottom: '1.5rem', 
          right: '1rem',
          backgroundColor: expandedMenuOpen ? 'var(--bs-primary)' : 'var(--bs-tertiary-bg)',
          color: expandedMenuOpen ? 'var(--bs-white)' : 'var(--bs-body-color)',
          borderColor: expandedMenuOpen ? 'var(--bs-primary)' : 'var(--bs-border-color)',
        }}
      >
        <EllipsisHorizontalIcon className="h-5 w-5" />
      </button>

    </div>
  );
}
