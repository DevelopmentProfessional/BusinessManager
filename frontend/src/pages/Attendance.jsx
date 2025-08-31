import React, { useEffect, useState } from 'react';
import { ClockIcon, PlusIcon } from '@heroicons/react/24/outline';
import useStore from '../store/useStore';
import { usePermissionRefresh } from '../hooks/usePermissionRefresh';
import { attendanceAPI, employeesAPI } from '../services/api';
import Modal from '../components/Modal';
import MobileTable from '../components/MobileTable';
import MobileAddButton from '../components/MobileAddButton';
import ClockInOut from '../components/ClockInOut';
import PermissionGate from '../components/PermissionGate';

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
        <select
          id="employee_id"
          name="employee_id"
          required
          value={formData.employee_id}
          onChange={handleChange}
          className="input-field mt-1"
        >
          <option value="">Select an employee</option>
          {employees.map((employee) => (
            <option key={employee.id} value={employee.id}>
              {employee.first_name} {employee.last_name}
            </option>
          ))}
        </select>
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
    isModalOpen, modalContent, openModal, closeModal, hasPermission
  } = useStore();

  // Use the permission refresh hook
  usePermissionRefresh();

  useEffect(() => {
    loadAttendanceData();
  }, []);

  const loadAttendanceData = async () => {
    setLoading(true);
    try {
      const [attendanceRes, employeesRes] = await Promise.all([
        attendanceAPI.getAll(),
        employeesAPI.getAll()
      ]);

      setAttendanceRecords(attendanceRes.data);
      setEmployees(employeesRes.data);
      clearError();
    } catch (err) {
      setError('Failed to load attendance data');
      console.error(err);
    } finally {
      setLoading(false);
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
    <div>
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-bold text-gray-900">Attendance</h1>
        </div>
        <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
          <PermissionGate page="attendance" permission="write">
            <button 
              type="button" 
              onClick={handleCreateRecord}
              className="btn-primary flex items-center"
            >
              <PlusIcon className="h-5 w-5 mr-2" />
              Add Record
            </button>
          </PermissionGate>
        </div>
      </div>

      {/* Clock In/Out Section */}
      <div className="mt-6 mb-6">
        <ClockInOut />
      </div>

      {error && (
        <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Mobile view */}
      <div className="mt-6 md:hidden">
        <MobileTable
          data={attendanceRecords}
          columns={[
            { key: 'employee', title: 'Employee', render: (_, r) => getEmployeeName(r.employee_id) },
            { key: 'date', title: 'Date', render: (v, r) => new Date(r.date).toLocaleDateString() },
            { key: 'clock_in', title: 'In', render: (v) => (v ? new Date(v).toLocaleTimeString() : '-') },
            { key: 'clock_out', title: 'Out', render: (v) => (v ? new Date(v).toLocaleTimeString() : '-') },
            { key: 'hours', title: 'Hours', render: (_, r) => (r.total_hours ? `${r.total_hours.toFixed(2)} hrs` : calculateHours(r.clock_in, r.clock_out)) },
            { key: 'notes', title: 'Notes', render: (v, r) => r.notes || '-' },
          ]}
          emptyMessage="No attendance records found"
        />
        <PermissionGate page="attendance" permission="write">
          <MobileAddButton onClick={handleCreateRecord} label="Add" />
        </PermissionGate>
      </div>

      {/* Desktop table */}
      <div className="mt-8 flow-root hidden md:block">
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
                        {getEmployeeName(record.employee_id)}
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
