import React, { useEffect, useState } from 'react';
import {
  UserGroupIcon,
  CubeIcon,
  CalendarDaysIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import useStore from '../store/useStore';
import { clientsAPI, inventoryAPI, scheduleAPI } from '../services/api';

export default function Dashboard() {
  const { 
    clients, setClients,
    appointments, setAppointments,
    lowStockItems, setLowStockItems,
    loading, setLoading,
    error, setError
  } = useStore();

  const [stats, setStats] = useState({
    totalClients: 0,
    todayAppointments: 0,
    lowStockCount: 0,
    recentActivity: []
  });

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const [clientsRes, appointmentsRes, lowStockRes] = await Promise.all([
        clientsAPI.getAll(),
        scheduleAPI.getAll(),
        inventoryAPI.getLowStock()
      ]);

      setClients(clientsRes.data);
      setAppointments(appointmentsRes.data);
      setLowStockItems(lowStockRes.data);

      // Calculate today's appointments
      const today = new Date().toDateString();
      const todayAppointments = appointmentsRes.data.filter(apt => 
        new Date(apt.appointment_date).toDateString() === today
      );

      setStats({
        totalClients: clientsRes.data.length,
        todayAppointments: todayAppointments.length,
        lowStockCount: lowStockRes.data.length,
        recentActivity: appointmentsRes.data.slice(0, 5) // Last 5 appointments
      });
    } catch (err) {
      setError('Failed to load dashboard data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      name: 'Total Clients',
      value: stats.totalClients,
      icon: UserGroupIcon,
      color: 'bg-blue-500',
    },
    {
      name: 'Today\'s Appointments',
      value: stats.todayAppointments,
      icon: CalendarDaysIcon,
      color: 'bg-green-500',
    },
    {
      name: 'Low Stock Items',
      value: stats.lowStockCount,
      icon: ExclamationTriangleIcon,
      color: 'bg-red-500',
    },
    {
      name: 'Total Products',
      value: '0', // Will be updated when products are loaded
      icon: CubeIcon,
      color: 'bg-purple-500',
    },
  ];

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        {statCards.map((item) => (
          <div key={item.name} className="card">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className={`${item.color} rounded-md p-3`}>
                  <item.icon className="h-6 w-6 text-white" />
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    {item.name}
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {item.value}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Appointments */}
        <div className="card">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Appointments</h3>
          {stats.recentActivity.length > 0 ? (
            <div className="space-y-3">
              {stats.recentActivity.map((appointment) => (
                <div key={appointment.id} className="flex items-center justify-between py-2 border-b border-gray-200 last:border-b-0">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      Client ID: {appointment.client_id}
                    </p>
                    <p className="text-sm text-gray-500">
                      {new Date(appointment.appointment_date).toLocaleDateString()}
                    </p>
                  </div>
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    appointment.status === 'completed' 
                      ? 'bg-green-100 text-green-800'
                      : appointment.status === 'cancelled'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {appointment.status}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-4">No recent appointments</p>
          )}
        </div>

        {/* Low Stock Alerts */}
        <div className="card">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Low Stock Alerts</h3>
          {lowStockItems.length > 0 ? (
            <div className="space-y-3">
              {lowStockItems.slice(0, 5).map((item) => (
                <div key={item.id} className="flex items-center justify-between py-2 border-b border-gray-200 last:border-b-0">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      Product ID: {item.product_id}
                    </p>
                    <p className="text-sm text-gray-500">
                      Current: {item.quantity} | Min: {item.min_stock_level}
                    </p>
                  </div>
                  <span className="px-2 py-1 text-xs rounded-full bg-red-100 text-red-800">
                    Low Stock
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-4">All items are well stocked</p>
          )}
        </div>
      </div>
    </div>
  );
}
