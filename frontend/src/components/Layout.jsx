import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  UserGroupIcon,
  CubeIcon,
  WrenchScrewdriverIcon,
  UsersIcon,
  CalendarDaysIcon,
  ArchiveBoxIcon,
  ComputerDesktopIcon,
  ClockIcon,
  DocumentIcon,
  Bars3Icon,
  XMarkIcon,
  EllipsisHorizontalIcon,
} from '@heroicons/react/24/outline';

// All navigation items (shown in bottom-right expandable menu on mobile)
const allNavigation = [
  { name: 'Schedule', href: '/schedule', icon: CalendarDaysIcon },
  { name: 'Inventory', href: '/inventory', icon: ArchiveBoxIcon },
  { name: 'Products', href: '/products', icon: CubeIcon },
  { name: 'Clients', href: '/clients', icon: UserGroupIcon },
  { name: 'Documents', href: '/documents', icon: DocumentIcon },
  { name: 'Services', href: '/services', icon: WrenchScrewdriverIcon },
  { name: 'Employees', href: '/employees', icon: UsersIcon },
  { name: 'Assets', href: '/assets', icon: ComputerDesktopIcon },
  { name: 'Attendance', href: '/attendance', icon: ClockIcon },
];

function classNames(...classes) {
  return classes.filter(Boolean).join(' ');
}

export default function Layout({ children }) {
  const [expandedMenuOpen, setExpandedMenuOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="min-h-screen bg-gray-50">
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
                {allNavigation.map((item) => (
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
