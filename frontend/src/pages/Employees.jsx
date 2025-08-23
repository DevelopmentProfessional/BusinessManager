import React, { useEffect, useState } from 'react';
import { PlusIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline';
import useStore from '../store/useStore';
import { employeesAPI } from '../services/api';
import Modal from '../components/Modal';
import EmployeeForm from '../components/EmployeeForm';
import MobileTable from '../components/MobileTable';
import MobileAddButton from '../components/MobileAddButton';
import { useLocation, useNavigate } from 'react-router-dom';

export default function Employees() {
  const { 
    employees, setEmployees, addEmployee, updateEmployee, removeEmployee,
    loading, setLoading, error, setError, clearError,
    isModalOpen, openModal, closeModal
  } = useStore();

  const [editingEmployee, setEditingEmployee] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    loadEmployees();
  }, []);

  // Auto-open create modal when navigated with ?new=1 and then clean the URL
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('new') === '1') {
      setEditingEmployee(null);
      openModal('employee-form');
      params.delete('new');
      navigate({ pathname: location.pathname, search: params.toString() ? `?${params.toString()}` : '' }, { replace: true });
    }
  }, [location.search]);

  const loadEmployees = async () => {
    setLoading(true);
    try {
      const response = await employeesAPI.getAll();
      setEmployees(response.data);
      clearError();
    } catch (err) {
      setError('Failed to load employees');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateEmployee = () => {
    setEditingEmployee(null);
    openModal('employee-form');
  };

  const handleEditEmployee = (employee) => {
    setEditingEmployee(employee);
    openModal('employee-form');
  };

  const handleDeleteEmployee = async (employeeId) => {
    if (!window.confirm('Are you sure you want to deactivate this employee?')) return;

    try {
      await employeesAPI.delete(employeeId);
      removeEmployee(employeeId);
      clearError();
    } catch (err) {
      setError('Failed to deactivate employee');
      console.error(err);
    }
  };

  const handleSubmitEmployee = async (employeeData) => {
    try {
      if (editingEmployee) {
        const response = await employeesAPI.update(editingEmployee.id, employeeData);
        updateEmployee(editingEmployee.id, response.data);
      } else {
        const response = await employeesAPI.create(employeeData);
        addEmployee(response.data);
      }
      closeModal();
      clearError();
    } catch (err) {
      setError('Failed to save employee');
      console.error(err);
    }
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
          <h1 className="text-2xl font-bold text-gray-900">Employees</h1>
        </div>
        <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
          <button 
            type="button" 
            onClick={handleCreateEmployee}
            className="btn-primary flex items-center"
          >
            <PlusIcon className="h-5 w-5 mr-2" />
            Add Employee
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Mobile view */}
      <div className="mt-6 md:hidden">
        <MobileTable
          data={employees}
          columns={[
            { key: 'first_name', title: 'Name', render: (_, item) => `${item.first_name} ${item.last_name}` },
            { key: 'email', title: 'Email' },
            { key: 'role', title: 'Role' },
            { key: 'is_active', title: 'Status', render: (v) => (v ? 'Active' : 'Inactive') },
          ]}
          onEdit={(item) => handleEditEmployee(item)}
          onDelete={(item) => handleDeleteEmployee(item.id)}
          emptyMessage="No employees found"
        />
        <MobileAddButton onClick={handleCreateEmployee} label="Add" />
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
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Role
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Hire Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="relative px-6 py-3">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {employees.map((employee) => (
                    <tr key={employee.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {employee.first_name} {employee.last_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {employee.email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {employee.role}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(employee.hire_date).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          employee.is_active 
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {employee.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-4">
                        <button
                          onClick={() => handleDeleteEmployee(employee.id)}
                          className="text-red-600 hover:text-red-900"
                          title="Delete"
                        >
                          <TrashIcon className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => handleEditEmployee(employee)}
                          className="text-indigo-600 hover:text-indigo-900"
                          title="Edit"
                        >
                          <PencilIcon className="h-5 w-5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {employees.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-gray-500">No employees found. Add your first employee to get started.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal for Employee Form */}
      <Modal isOpen={isModalOpen} onClose={closeModal}>
        {isModalOpen && (
          <EmployeeForm
            employee={editingEmployee}
            onSubmit={handleSubmitEmployee}
            onCancel={closeModal}
          />
        )}
      </Modal>
    </div>
  );
}
