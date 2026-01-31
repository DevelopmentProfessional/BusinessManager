import React, { useState, useEffect } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { documentsAPI, documentCategoriesAPI, employeesAPI } from '../../services/api';
import CustomDropdown from './CustomDropdown';

export default function DocumentEditModal({ isOpen, onClose, document, onSave }) {
  const [description, setDescription] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [reviewDate, setReviewDate] = useState('');
  const [assignments, setAssignments] = useState([]);
  const [assignEmployeeId, setAssignEmployeeId] = useState('');
  const [categories, setCategories] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Load meta lists only when modal opens
  useEffect(() => {
    if (!isOpen) return;

    const loadMetaLists = async () => {
      try {
        const [catsRes, empRes] = await Promise.all([
          documentCategoriesAPI.list(),
          employeesAPI.getAll(),
        ]);
        setCategories(catsRes.data || []);
        setEmployees(empRes.data || []);
      } catch (err) {
        console.warn('Failed to load categories or employees', err);
      }
    };
    loadMetaLists();
  }, [isOpen]);

  // Initialize form when document changes
  useEffect(() => {
    if (document) {
      setDescription(document.description || '');
      setOwnerId(document.owner_id || '');
      setCategoryId(document.category_id || '');
      setReviewDate(formatDateInput(document.review_date));
      loadAssignments(document.id);
    }
  }, [document]);

  const formatDateInput = (value) => {
    if (!value) return '';
    try {
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) return '';
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    } catch {
      return '';
    }
  };

  const loadAssignments = async (documentId) => {
    try {
      const res = await documentsAPI.listAssignments(documentId);
      setAssignments(res.data || []);
    } catch (err) {
      console.warn('Failed to load assignments', err);
      setAssignments([]);
    }
  };

  const handleAddAssignment = async () => {
    if (!document || !assignEmployeeId) return;
    try {
      await documentsAPI.addAssignment(document.id, assignEmployeeId);
      setAssignEmployeeId('');
      await loadAssignments(document.id);
    } catch (err) {
      console.error('Failed to add assignment', err);
    }
  };

  const handleRemoveAssignment = async (employee_id) => {
    if (!document) return;
    try {
      await documentsAPI.removeAssignment(document.id, employee_id);
      await loadAssignments(document.id);
    } catch (err) {
      console.error('Failed to remove assignment', err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!document) return;

    setSaving(true);
    setError('');

    try {
      const body = {
        description: description,
        owner_id: ownerId || null,
        category_id: categoryId || null,
        review_date: reviewDate || null,
      };
      const res = await documentsAPI.update(document.id, body);
      if (onSave) {
        onSave(res.data);
      }
      onClose();
    } catch (err) {
      setError('Failed to update document');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen || !document) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        {/* Overlay */}
        <div
          className="fixed inset-0 bg-gray-500 dark:bg-gray-900 bg-opacity-75 dark:bg-opacity-75 transition-opacity"
          onClick={onClose}
        />

        {/* Modal */}
        <div className="inline-block align-bottom bg-white dark:bg-gray-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          <form onSubmit={handleSubmit}>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                Edit Document
              </h3>
              <button
                type="button"
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            {/* Body */}
            <div className="px-4 py-4 space-y-4">
              {error && (
                <div className="text-red-600 bg-red-50 dark:bg-red-900/20 p-3 rounded text-sm">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Filename
                </label>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {document.original_filename}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Description
                </label>
                <textarea
                  className="input-field mt-1"
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Document description"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Owner
                  </label>
                  <CustomDropdown
                    value={ownerId || ''}
                    onChange={(e) => setOwnerId(e.target.value)}
                    options={[
                      { value: '', label: 'Unassigned' },
                      ...employees.map((emp) => ({
                        value: emp.id,
                        label: emp.first_name
                          ? `${emp.first_name} ${emp.last_name || ''}`.trim()
                          : emp.name || emp.email || emp.id,
                      })),
                    ]}
                    placeholder="Select owner"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Review Date
                  </label>
                  <input
                    type="date"
                    className="input-field mt-1"
                    value={reviewDate}
                    onChange={(e) => setReviewDate(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Category
                </label>
                <CustomDropdown
                  value={categoryId || ''}
                  onChange={(e) => setCategoryId(e.target.value)}
                  options={[
                    { value: '', label: 'None' },
                    ...categories.map((cat) => ({
                      value: cat.id,
                      label: cat.name,
                    })),
                  ]}
                  placeholder="Select category"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Assignments
                </label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {assignments.length === 0 && (
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      No assigned employees
                    </span>
                  )}
                  {assignments.map((a) => {
                    const emp = employees.find((e) => e.id === a.employee_id);
                    const label = emp
                      ? emp.first_name
                        ? `${emp.first_name} ${emp.last_name || ''}`.trim()
                        : emp.name || emp.email || a.employee_id
                      : a.employee_id;
                    return (
                      <span
                        key={a.employee_id}
                        className="inline-flex items-center px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                      >
                        {label}
                        <button
                          type="button"
                          onClick={() => handleRemoveAssignment(a.employee_id)}
                          className="ml-2 text-red-600 hover:text-red-800"
                        >
                          ×
                        </button>
                      </span>
                    );
                  })}
                </div>
                <div className="flex gap-2">
                  <CustomDropdown
                    value={assignEmployeeId}
                    onChange={(e) => setAssignEmployeeId(e.target.value)}
                    options={employees.map((emp) => ({
                      value: emp.id,
                      label: emp.first_name
                        ? `${emp.first_name} ${emp.last_name || ''}`.trim()
                        : emp.name || emp.email || emp.id,
                    }))}
                    placeholder="Select employee"
                    className="flex-1"
                  />
                  <button
                    type="button"
                    onClick={handleAddAssignment}
                    className="btn-secondary"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
              <button type="button" onClick={onClose} className="btn-secondary">
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
