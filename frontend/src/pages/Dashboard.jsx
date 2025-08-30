import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import useStore from '../store/useStore';
import { usePermissionRefresh } from '../hooks/usePermissionRefresh';
import { clientsAPI, inventoryAPI, employeesAPI, scheduleAPI, documentsAPI, servicesAPI } from '../services/api';
import {
  UserGroupIcon,
  ArchiveBoxIcon,
  UsersIcon,
  CalendarDaysIcon,
  ClockIcon,
  DocumentIcon,
  WrenchScrewdriverIcon,
} from '@heroicons/react/24/outline';
import PermissionDebug from '../components/PermissionDebug';

const Dashboard = () => {
  const { user, hasPermission } = useStore();
  
  // Use the permission refresh hook
  usePermissionRefresh();
  
  const [stats, setStats] = useState({
    clients: 0,
    inventory: 0,
    employees: 0,
    appointments: 0,
    documents: 0,
    services: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Only fetch stats if we haven't loaded them yet
    if (stats.clients === 0 && stats.inventory === 0 && stats.employees === 0 && 
        stats.appointments === 0 && stats.documents === 0 && stats.services === 0) {
      fetchStats();
    }
  }, []);

  const fetchStats = async () => {
    try {
      const promises = [];
      
      if (hasPermission('clients', 'read')) {
        promises.push(clientsAPI.getAll().then(res => ({ clients: res.data.length })));
      }
      
      if (hasPermission('inventory', 'read')) {
        promises.push(inventoryAPI.getAll().then(res => ({ inventory: res.data.length })));
      }
      
      if (hasPermission('employees', 'read')) {
        promises.push(employeesAPI.getAll().then(res => ({ employees: res.data.length })));
      }
      
      if (hasPermission('schedule', 'read')) {
        promises.push(scheduleAPI.getAll().then(res => ({ appointments: res.data.length })));
      }
      
      if (hasPermission('documents', 'read')) {
        promises.push(documentsAPI.getAll().then(res => ({ documents: res.data.length })));
      }
      
      if (hasPermission('services', 'read')) {
        promises.push(servicesAPI.getAll().then(res => ({ services: res.data.length })));
      }

      const results = await Promise.all(promises);
      const combinedStats = results.reduce((acc, result) => ({ ...acc, ...result }), {});
      setStats(combinedStats);
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const quickActions = [
    {
      name: 'Clients',
      href: '/clients',
      icon: UserGroupIcon,
      permission: 'clients:read',
      color: 'bg-blue-500',
    },
    {
      name: 'Inventory',
      href: '/inventory',
      icon: ArchiveBoxIcon,
      permission: 'inventory:read',
      color: 'bg-green-500',
    },
    {
      name: 'Employees',
      href: '/employees',
      icon: UsersIcon,
      permission: 'employees:read',
      color: 'bg-purple-500',
    },
    {
      name: 'Schedule',
      href: '/schedule',
      icon: CalendarDaysIcon,
      permission: 'schedule:read',
      color: 'bg-yellow-500',
    },
    {
      name: 'Attendance',
      href: '/attendance',
      icon: ClockIcon,
      permission: 'attendance:read',
      color: 'bg-red-500',
    },
    {
      name: 'Documents',
      href: '/documents',
      icon: DocumentIcon,
      permission: 'documents:read',
      color: 'bg-indigo-500',
    },
    {
      name: 'Services',
      href: '/services',
      icon: WrenchScrewdriverIcon,
      permission: 'services:read',
      color: 'bg-pink-500',
    },
  ];

  const filteredQuickActions = quickActions.filter(action => 
    hasPermission(...action.permission.split(':'))
  );

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      
      {/* Debug Component - Remove in production */}
      <PermissionDebug />

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {hasPermission('clients', 'read') && (
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <UserGroupIcon className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Clients</p>
                <p className="text-2xl font-bold text-gray-900">{stats.clients}</p>
              </div>
            </div>
          </div>
        )}

        {hasPermission('inventory', 'read') && (
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <ArchiveBoxIcon className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Inventory Items</p>
                <p className="text-2xl font-bold text-gray-900">{stats.inventory}</p>
              </div>
            </div>
          </div>
        )}

        {hasPermission('employees', 'read') && (
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <UsersIcon className="h-6 w-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Employees</p>
                <p className="text-2xl font-bold text-gray-900">{stats.employees}</p>
              </div>
            </div>
          </div>
        )}

        {hasPermission('schedule', 'read') && (
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <CalendarDaysIcon className="h-6 w-6 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Appointments</p>
                <p className="text-2xl font-bold text-gray-900">{stats.appointments}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredQuickActions.map((action) => (
            <Link
              key={action.name}
              to={action.href}
              className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center">
                <div className={`p-3 ${action.color} rounded-lg`}>
                  <action.icon className="h-6 w-6 text-white" />
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-medium text-gray-900">{action.name}</h3>
                  <p className="text-sm text-gray-600">Manage {action.name.toLowerCase()}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Recent Activity</h2>
        <div className="space-y-4">
          <div className="flex items-center text-sm text-gray-600">
            <div className="w-2 h-2 bg-green-400 rounded-full mr-3"></div>
            <span>You logged in successfully</span>
            <span className="ml-auto text-gray-400">Just now</span>
          </div>
          <div className="flex items-center text-sm text-gray-600">
            <div className="w-2 h-2 bg-blue-400 rounded-full mr-3"></div>
            <span>System is running smoothly</span>
            <span className="ml-auto text-gray-400">Today</span>
          </div>
          <div className="flex items-center text-sm text-gray-600">
            <div className="w-2 h-2 bg-yellow-400 rounded-full mr-3"></div>
            <span>Welcome to Business Manager</span>
            <span className="ml-auto text-gray-400">Today</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
