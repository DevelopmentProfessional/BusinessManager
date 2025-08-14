import React, { useEffect, useMemo, useState } from 'react';
import { PlusIcon, PencilIcon, CheckIcon, XMarkIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import useStore from '../store/useStore';
import { scheduleAPI, clientsAPI, servicesAPI, employeesAPI } from '../services/api';
import Modal from '../components/Modal';
import ScheduleForm from '../components/ScheduleForm';
import MobileAddButton from '../components/MobileAddButton';

export default function Schedule() {
  const { 
    appointments, setAppointments, addAppointment, updateAppointment,
    clients, setClients, services, setServices, employees, setEmployees,
    loading, setLoading, error, setError, clearError,
    isModalOpen, openModal, closeModal
  } = useStore();

  const [editingAppointment, setEditingAppointment] = useState(null);
  const [weekStart, setWeekStart] = useState(() => {
    const d = new Date();
    // Start week on Monday
    const day = d.getDay(); // 0 = Sun, 1 = Mon ...
    const diff = (day === 0 ? -6 : 1) - day; // move to Monday
    const monday = new Date(d);
    monday.setDate(d.getDate() + diff);
    monday.setHours(0,0,0,0);
    return monday;
  });

  useEffect(() => {
    loadScheduleData();
  }, []);

  const loadScheduleData = async () => {
    setLoading(true);
    try {
      const [appointmentsRes, clientsRes, servicesRes, employeesRes] = await Promise.all([
        scheduleAPI.getAll(),
        clientsAPI.getAll(),
        servicesAPI.getAll(),
        employeesAPI.getAll()
      ]);

      setAppointments(appointmentsRes.data);
      setClients(clientsRes.data);
      setServices(servicesRes.data);
      setEmployees(employeesRes.data);
      clearError();
    } catch (err) {
      setError('Failed to load schedule data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAppointment = () => {
    setEditingAppointment(null);
    openModal('appointment-form');
  };

  const handleEditAppointment = (appointment) => {
    setEditingAppointment(appointment);
    openModal('appointment-form');
  };

  const handleUpdateStatus = async (appointmentId, status) => {
    try {
      const response = await scheduleAPI.update(appointmentId, { status });
      updateAppointment(appointmentId, response.data);
      clearError();
    } catch (err) {
      setError('Failed to update appointment status');
      console.error(err);
    }
  };

  const handleSubmitAppointment = async (appointmentData) => {
    try {
      if (editingAppointment) {
        const response = await scheduleAPI.update(editingAppointment.id, appointmentData);
        updateAppointment(editingAppointment.id, response.data);
      } else {
        const response = await scheduleAPI.create(appointmentData);
        addAppointment(response.data);
      }
      closeModal();
      clearError();
    } catch (err) {
      setError('Failed to save appointment');
      console.error(err);
    }
  };

  const getClientName = (clientId) => {
    const client = clients.find(c => c.id === clientId);
    return client ? client.name : 'Unknown Client';
  };

  const getServiceName = (serviceId) => {
    const service = services.find(s => s.id === serviceId);
    return service ? service.name : 'Unknown Service';
  };

  const getEmployeeName = (employeeId) => {
    const employee = employees.find(e => e.id === employeeId);
    return employee ? `${employee.first_name} ${employee.last_name}` : 'Unknown Employee';
  };

  const daysOfWeek = useMemo(() => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      days.push(d);
    }
    return days;
  }, [weekStart]);

  const appointmentsByDay = useMemo(() => {
    const map = new Map();
    daysOfWeek.forEach(d => map.set(d.toDateString(), []));
    appointments.forEach(a => {
      const ad = new Date(a.appointment_date);
      const key = new Date(ad.getFullYear(), ad.getMonth(), ad.getDate()).toDateString();
      if (map.has(key)) {
        map.get(key).push(a);
      }
    });
    // sort each day's appointments by time
    for (const key of map.keys()) {
      map.get(key).sort((a, b) => new Date(a.appointment_date) - new Date(b.appointment_date));
    }
    return map;
  }, [appointments, daysOfWeek]);

  const goPrevWeek = () => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() - 7);
    setWeekStart(d);
  };
  const goNextWeek = () => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + 7);
    setWeekStart(d);
  };
  const goThisWeek = () => {
    const d = new Date();
    const day = d.getDay();
    const diff = (day === 0 ? -6 : 1) - day;
    const monday = new Date(d);
    monday.setDate(d.getDate() + diff);
    monday.setHours(0,0,0,0);
    setWeekStart(monday);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-bold text-gray-900">Schedule</h1>
        </div>
        <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
          <button 
            type="button" 
            onClick={handleCreateAppointment}
            className="btn-primary flex items-center"
          >
            <PlusIcon className="h-5 w-5 mr-2" />
            Book Appointment
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Calendar Header */}
      <div className="mt-6 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <button onClick={goPrevWeek} className="btn-secondary p-2 flex items-center">
            <ChevronLeftIcon className="h-5 w-5" />
          </button>
          <button onClick={goThisWeek} className="btn-secondary px-3 py-2">This week</button>
          <button onClick={goNextWeek} className="btn-secondary p-2 flex items-center">
            <ChevronRightIcon className="h-5 w-5" />
          </button>
        </div>
        <div className="text-sm text-gray-600">
          {daysOfWeek[0].toLocaleDateString()} - {daysOfWeek[6].toLocaleDateString()}
        </div>
      </div>

      {/* Weekly calendar grid */}
      <div className="mt-4">
        {/* Desktop: 7 columns */}
        <div className="hidden md:grid grid-cols-7 gap-4">
          {daysOfWeek.map((day) => (
            <div key={day.toDateString()} className="bg-white rounded-lg border border-gray-200 p-3 min-h-[280px] flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-medium text-gray-700">
                  {day.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                </div>
              </div>
              <div className="space-y-2 overflow-auto">
                {(appointmentsByDay.get(new Date(day.getFullYear(), day.getMonth(), day.getDate()).toDateString()) || []).map((a) => (
                  <div key={a.id} className="border rounded-lg p-2 hover:shadow-sm">
                    <div className="text-xs text-gray-500">
                      {new Date(a.appointment_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div className="text-sm font-medium text-gray-900 truncate">{getClientName(a.client_id)}</div>
                    <div className="text-xs text-gray-500 truncate">{getServiceName(a.service_id)}</div>
                    <div className="mt-1 flex items-center justify-between">
                      <span className={`px-2 py-0.5 text-[10px] rounded-full ${
                        a.status === 'completed'
                          ? 'bg-green-100 text-green-800'
                          : a.status === 'cancelled'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>{a.status}</span>
                      <div className="space-x-2">
                        <button onClick={() => handleEditAppointment(a)} className="text-indigo-600 hover:text-indigo-900" title="Edit">
                          <PencilIcon className="h-4 w-4 inline" />
                        </button>
                        {a.status === 'scheduled' && (
                          <>
                            <button onClick={() => handleUpdateStatus(a.id, 'completed')} className="text-green-600 hover:text-green-900" title="Complete">
                              <CheckIcon className="h-4 w-4 inline" />
                            </button>
                            <button onClick={() => handleUpdateStatus(a.id, 'cancelled')} className="text-red-600 hover:text-red-900" title="Cancel">
                              <XMarkIcon className="h-4 w-4 inline" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Mobile: horizontal scroll day columns */}
        <div className="md:hidden overflow-x-auto">
          <div className="flex space-x-3 min-w-max pr-4">
            {daysOfWeek.map((day) => (
              <div key={day.toDateString()} className="w-64 flex-shrink-0 bg-white rounded-lg border border-gray-200 p-3">
                <div className="text-sm font-medium text-gray-700 mb-2">
                  {day.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                </div>
                <div className="space-y-2">
                  {(appointmentsByDay.get(new Date(day.getFullYear(), day.getMonth(), day.getDate()).toDateString()) || []).map((a) => (
                    <div key={a.id} className="border rounded-lg p-2">
                      <div className="text-xs text-gray-500">
                        {new Date(a.appointment_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <div className="text-sm font-medium text-gray-900 truncate">{getClientName(a.client_id)}</div>
                      <div className="text-xs text-gray-500 truncate">{getServiceName(a.service_id)}</div>
                      <div className="mt-1 flex items-center justify-between">
                        <span className={`px-2 py-0.5 text-[10px] rounded-full ${
                          a.status === 'completed' ? 'bg-green-100 text-green-800' : a.status === 'cancelled' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
                        }`}>{a.status}</span>
                        <div className="space-x-2">
                          <button onClick={() => handleEditAppointment(a)} className="text-indigo-600" title="Edit">
                            <PencilIcon className="h-4 w-4 inline" />
                          </button>
                          {a.status === 'scheduled' && (
                            <>
                              <button onClick={() => handleUpdateStatus(a.id, 'completed')} className="text-green-600" title="Complete">
                                <CheckIcon className="h-4 w-4 inline" />
                              </button>
                              <button onClick={() => handleUpdateStatus(a.id, 'cancelled')} className="text-red-600" title="Cancel">
                                <XMarkIcon className="h-4 w-4 inline" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Modal for Appointment Form */}
      <Modal isOpen={isModalOpen} onClose={closeModal}>
        {isModalOpen && (
          <ScheduleForm
            appointment={editingAppointment}
            onSubmit={handleSubmitAppointment}
            onCancel={closeModal}
          />
        )}
      </Modal>

      {/* Bottom-center add button for mobile */}
      <div className="md:hidden">
        <MobileAddButton onClick={handleCreateAppointment} label="Book" />
      </div>
    </div>
  );
}
