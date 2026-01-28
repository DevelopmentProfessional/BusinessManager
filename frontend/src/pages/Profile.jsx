import React from 'react';
import { Link } from 'react-router-dom';
import useStore from '../services/useStore';
import { 
  UserIcon, 
  CalendarIcon,
  ClockIcon,
  DocumentTextIcon,
  UserGroupIcon,
  CogIcon,
  ChartBarIcon,
  ArchiveBoxIcon,
  WrenchScrewdriverIcon
} from '@heroicons/react/24/outline';

const Profile = () => {
  const { user } = useStore();

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

      {/* Info Card */}
      <div className="card">
        <div className="card-body">
          <h2 className="h5 mb-3">Getting Started</h2>
          <p className="text-muted mb-3">
            Use the navigation menu to access different sections of your business management system. 
            Click the menu button in the bottom-right corner to see all available options.
          </p>
          <div className="d-flex gap-2">
            <Link to="/settings" className="btn btn-primary">
              <CogIcon className="h-5 w-5 me-2" />
              Account Settings
            </Link>
            <Link to="/schedule" className="btn btn-outline-primary">
              <CalendarIcon className="h-5 w-5 me-2" />
              View Schedule
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
