import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { ClockIcon, PlayIcon, StopIcon } from '@heroicons/react/24/outline';
import useStore from '../services/useStore';
import { attendanceAPI, employeesAPI } from '../services/api';
import Modal from './components/Modal';
import MobileTable from './components/MobileTable';
import CustomDropdown from './components/CustomDropdown';
import PermissionGate from './components/PermissionGate';

function AttendanceForm({ onSubmit, onCancel }) {
  const { employees } = useStore();
  const [formData, setFormData] = useState({
    employee_id: '',
    date: new Date().toISOString().split('T')[0],
    clock_in: '',
    clock_out: '',
    notes: ''
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const submitData = {
      employee_id: formData.employee_id,
      date: new Date(formData.date).toISOString(),
      clock_in: formData.clock_in ? new Date(`${formData.date}T${formData.clock_in}`).toISOString() : null,
      clock_out: formData.clock_out ? new Date(`${formData.date}T${formData.clock_out}`).toISOString() : null,
      notes: formData.notes
    };
    onSubmit(submitData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="mb-4">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Add Attendance Record</h3>
      </div>

      <div>
        <label htmlFor="employee_id" className="block text-sm font-medium text-gray-700">
          Employee *
        </label>
        <CustomDropdown
          name="employee_id"
          value={formData.employee_id}
          onChange={handleChange}
          options={employees.map((employee) => ({
            value: employee.id,
            label: `${employee.first_name} ${employee.last_name}`
          }))}
          placeholder="Select an employee"
          required
        />
      </div>

      <div>
        <label htmlFor="date" className="block text-sm font-medium text-gray-700">
          Date *
        </label>
        <input
          type="date"
          id="date"
          name="date"
          required
          value={formData.date}
          onChange={handleChange}
          className="input-field mt-1"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="clock_in" className="block text-sm font-medium text-gray-700">
            Clock In
          </label>
          <input
            type="time"
            id="clock_in"
            name="clock_in"
            value={formData.clock_in}
            onChange={handleChange}
            className="input-field mt-1"
          />
        </div>

        <div>
          <label htmlFor="clock_out" className="block text-sm font-medium text-gray-700">
            Clock Out
          </label>
          <input
            type="time"
            id="clock_out"
            name="clock_out"
            value={formData.clock_out}
            onChange={handleChange}
            className="input-field mt-1"
          />
        </div>
      </div>

      <div>
        <label htmlFor="notes" className="block text-sm font-medium text-gray-700">
          Notes
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          value={formData.notes}
          onChange={handleChange}
          className="input-field mt-1"
          placeholder="Additional notes"
        />
      </div>

      <div className="flex justify-end space-x-3 pt-4">
        <button type="button" onClick={onCancel} className="btn-secondary">
          Cancel
        </button>
        <button type="submit" className="btn-primary">
          Add Record
        </button>
      </div>
    </form>
  );
}

export default function Attendance() {
  const { 
    attendanceRecords, setAttendanceRecords, addAttendanceRecord,
    employees, setEmployees,
    loading, setLoading, error, setError, clearError,
    isModalOpen, modalContent, openModal, closeModal, hasPermission,
    user
  } = useStore();

  const [isClockedIn, setIsClockedIn] = useState(false);
  const [currentRecord, setCurrentRecord] = useState(null);
  const [clockActionLoading, setClockActionLoading] = useState(false);

  // Check permissions at page level
  if (!hasPermission('attendance', 'read') && 
      !hasPermission('attendance', 'write') && 
      !hasPermission('attendance', 'delete') && 
      !hasPermission('attendance', 'admin')) {
    return <Navigate to="/profile" replace />;
  }

  useEffect(() => {
    loadAttendanceData();
    checkClockStatus();
  }, []);

  // Check clock status whenever attendance records change
  useEffect(() => {
    checkClockStatus();
  }, [attendanceRecords, user]);

  const loadAttendanceData = async () => {
    setLoading(true);
    try {
      const [attendanceRes, employeesRes] = await Promise.all([
        attendanceAPI.getAll(),
        employeesAPI.getAll()
      ]);

      // Handle both direct data and response.data formats
      const attendanceData = attendanceRes?.data ?? attendanceRes;
      const employeesData = employeesRes?.data ?? employeesRes;

      if (Array.isArray(attendanceData)) {
        setAttendanceRecords(attendanceData);
      } else {
        console.error('Invalid attendance data format:', attendanceData);
        setAttendanceRecords([]);
      }

      if (Array.isArray(employeesData)) {
        setEmployees(employeesData);
      } else {
        console.error('Invalid employees data format:', employeesData);
        setEmployees([]);
      }

      clearError();
    } catch (err) {
      setError('Failed to load attendance data');
      console.error('Error loading attendance:', err);
      setAttendanceRecords([]);
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  };

  const checkClockStatus = async () => {
    if (!user?.id) return;
    
    try {
      // Check if user has an open attendance record for today
      const response = await attendanceAPI.checkUser();
      
      if (response?.data) {
        // The checkUser endpoint should return current clock status
        const isCurrentlyClockedIn = response.data.is_clocked_in || false;
        setIsClockedIn(isCurrentlyClockedIn);
        
        if (isCurrentlyClockedIn && response.data.current_record) {
          setCurrentRecord(response.data.current_record);
        } else {
          setCurrentRecord(null);
        }
      } else {
        // Fallback: check attendance records for today
        const today = new Date().toISOString().split('T')[0];
        const meResponse = await attendanceAPI.me();
        
        if (meResponse?.data && Array.isArray(meResponse.data)) {
          const todayRecord = meResponse.data.find(record => {
            const recordDate = new Date(record.date).toISOString().split('T')[0];
            return recordDate === today && record.clock_in && !record.clock_out;
          });
          
          if (todayRecord) {
            setIsClockedIn(true);
            setCurrentRecord(todayRecord);
          } else {
            setIsClockedIn(false);
            setCurrentRecord(null);
          }
        }
      }
    } catch (error) {
      console.error('Error checking clock status:', error);
      // Fallback: try me() endpoint
      try {
        const meResponse = await attendanceAPI.me();
        if (meResponse?.data && Array.isArray(meResponse.data)) {
          const today = new Date().toISOString().split('T')[0];
          const todayRecord = meResponse.data.find(record => {
            const recordDate = new Date(record.date).toISOString().split('T')[0];
            return recordDate === today && record.clock_in && !record.clock_out;
          });
          setIsClockedIn(!!todayRecord);
          setCurrentRecord(todayRecord || null);
        }
      } catch (fallbackError) {
        console.error('Fallback clock status check failed:', fallbackError);
        setIsClockedIn(false);
        setCurrentRecord(null);
      }
    }
  };

  const handleCheckInOut = async () => {
    if (!user?.id) {
      setError('You must be logged in to clock in/out');
      return;
    }

    if (!hasPermission('attendance', 'write')) {
      setError('You do not have permission to clock in/out');
      return;
    }

    setClockActionLoading(true);
    clearError();

    try {
      if (isClockedIn) {
        // Clock out
        const clockOutResponse = await attendanceAPI.clockOut();
        setIsClockedIn(false);
        setCurrentRecord(null);
        // Reload attendance data to show updated record
        await loadAttendanceData();
        // Refresh clock status
        await checkClockStatus();
      } else {
        // Clock in
        const clockInResponse = await attendanceAPI.clockIn();
        setIsClockedIn(true);
        // Reload attendance data to get the new record
        await loadAttendanceData();
        // Refresh clock status to get the new record
        await checkClockStatus();
      }
    } catch (err) {
      const errorMessage = err.response?.data?.detail || 
                          (isClockedIn ? 'Failed to clock out' : 'Failed to clock in');
      setError(errorMessage);
      console.error('Clock in/out error:', err);
    } finally {
      setClockActionLoading(false);
    }
  };

  const handleCreateRecord = () => {
    if (!hasPermission('attendance', 'write')) {
      setError('You do not have permission to create attendance records');
      return;
    }
    openModal('attendance-form');
  };

  const handleSubmitRecord = async (recordData) => {
    try {
      const response = await attendanceAPI.create(recordData);
      addAttendanceRecord(response.data);
      closeModal();
      clearError();
    } catch (err) {
      setError('Failed to save attendance record');
      console.error(err);
    }
  };

  const getEmployeeName = (employeeId) => {
    if (!employeeId) return 'Unknown Employee';
    const employee = employees.find(e => e.id === employeeId);
    return employee ? `${employee.first_name} ${employee.last_name}` : 'Unknown Employee';
  };

  const calculateHours = (clockIn, clockOut) => {
    if (!clockIn || !clockOut) return '-';
    const start = new Date(clockIn);
    const end = new Date(clockOut);
    const hours = (end - start) / (1000 * 60 * 60);
    return hours.toFixed(2) + ' hrs';
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Attendance</h1>
      </div>

      {error && (
        <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Mobile view */}
      <div className="mt-6 md:hidden flex-1">
        <MobileTable
          data={attendanceRecords}
          columns={[
            { key: 'employee', title: 'Employee', render: (_, r) => getEmployeeName(r.user_id || r.employee_id) },
            { key: 'date', title: 'Date', render: (v, r) => new Date(r.date).toLocaleDateString() },
            { key: 'clock_in', title: 'In', render: (v) => (v ? new Date(v).toLocaleTimeString() : '-') },
            { key: 'clock_out', title: 'Out', render: (v) => (v ? new Date(v).toLocaleTimeString() : '-') },
            { key: 'hours', title: 'Hours', render: (_, r) => (r.total_hours ? `${r.total_hours.toFixed(2)} hrs` : calculateHours(r.clock_in, r.clock_out)) },
            { key: 'notes', title: 'Notes', render: (v, r) => r.notes || '-' },
          ]}
          emptyMessage="No attendance records found"
        />
      </div>

      {/* Desktop table */}
      <div className="mt-8 flow-root hidden md:block flex-1">
        <div className="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
          <div className="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
            <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
              <table className="min-w-full divide-y divide-gray-300">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Employee
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Clock In
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Clock Out
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total Hours
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Notes
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {attendanceRecords.map((record) => (
                    <tr key={record.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {getEmployeeName(record.user_id || record.employee_id)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(record.date).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {record.clock_in ? new Date(record.clock_in).toLocaleTimeString() : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {record.clock_out ? new Date(record.clock_out).toLocaleTimeString() : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {record.total_hours ? record.total_hours.toFixed(2) + ' hrs' : calculateHours(record.clock_in, record.clock_out)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {record.notes || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {attendanceRecords.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-gray-500">No attendance records found. Add your first record to get started.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Check In/Out Button - Bottom Center (Mobile) */}
      <PermissionGate page="attendance" permission="write">
        <button
          onClick={handleCheckInOut}
          disabled={clockActionLoading || !user?.id}
          className={`
            fixed bottom-24 left-1/2 transform -translate-x-1/2 z-30
            ${isClockedIn 
              ? 'bg-red-600 hover:bg-red-700' 
              : 'bg-green-600 hover:bg-green-700'
            }
            text-white
            px-6 py-3 rounded-full shadow-lg hover:shadow-xl
            flex items-center gap-2 transition-all
            font-medium text-sm
            disabled:opacity-50 disabled:cursor-not-allowed
            md:hidden
          `}
        >
          {clockActionLoading ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              <span>Processing...</span>
            </>
          ) : isClockedIn ? (
            <>
              <StopIcon className="h-5 w-5" />
              <span>Check Out</span>
            </>
          ) : (
            <>
              <PlayIcon className="h-5 w-5" />
              <span>Check In</span>
            </>
          )}
        </button>
      </PermissionGate>

      {/* Check In/Out Button - Desktop (Top Right) */}
      <PermissionGate page="attendance" permission="write">
        <div className="hidden md:block fixed top-20 right-4 z-30">
          <button
            onClick={handleCheckInOut}
            disabled={clockActionLoading || !user?.id}
            className={`
              ${isClockedIn 
                ? 'bg-red-600 hover:bg-red-700' 
                : 'bg-green-600 hover:bg-green-700'
              }
              text-white
              px-4 py-2 rounded-lg shadow-lg hover:shadow-xl
              flex items-center gap-2 transition-all
              font-medium text-sm
              disabled:opacity-50 disabled:cursor-not-allowed
            `}
          >
            {clockActionLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Processing...</span>
              </>
            ) : isClockedIn ? (
              <>
                <StopIcon className="h-4 w-4" />
                <span>Check Out</span>
              </>
            ) : (
              <>
                <PlayIcon className="h-4 w-4" />
                <span>Check In</span>
              </>
            )}
          </button>
        </div>
      </PermissionGate>

      {/* Modal for Attendance Form */}
      <Modal isOpen={isModalOpen && modalContent === 'attendance-form'} onClose={closeModal}>
        {isModalOpen && modalContent === 'attendance-form' && (
          <AttendanceForm
            onSubmit={handleSubmitRecord}
            onCancel={closeModal}
          />
        )}
      </Modal>
    </div>
  );
}
