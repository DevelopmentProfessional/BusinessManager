import React, { useEffect, useState, useRef } from 'react';
import { Navigate } from 'react-router-dom';
import {
  PlusIcon, TrashIcon, PencilIcon, CheckIcon, XMarkIcon,
  ClockIcon, FunnelIcon, ClipboardDocumentListIcon
} from '@heroicons/react/24/outline';
import useStore from '../services/useStore';
import { tasksAPI, employeesAPI } from '../services/api';
import Modal from './components/Modal';
import ActionFooter from './components/ActionFooter';
import IconButton from './components/IconButton';

const PRIORITY_OPTIONS = ['low', 'normal', 'high', 'urgent'];
const STATUS_OPTIONS = ['pending', 'in_progress', 'completed', 'cancelled'];

const PRIORITY_COLORS = {
  low: 'secondary',
  normal: 'primary',
  high: 'warning',
  urgent: 'danger',
};

const STATUS_COLORS = {
  pending: 'secondary',
  in_progress: 'primary',
  completed: 'success',
  cancelled: 'danger',
};

function TaskForm({ task, employees, onSubmit, onCancel, onDelete }) {
  const [formData, setFormData] = useState({
    title: task?.title || '',
    description: task?.description || '',
    status: task?.status || 'pending',
    priority: task?.priority || 'normal',
    due_date: task?.due_date ? task.due_date.slice(0, 10) : '',
    assigned_to_id: task?.assigned_to_id || '',
  });
  const [saving, setSaving] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      ...formData,
      due_date: formData.due_date ? `${formData.due_date}T00:00:00` : null,
      assigned_to_id: formData.assigned_to_id || null,
    };
    await onSubmit(payload);
    setSaving(false);
  };

  return (
    <form onSubmit={handleSubmit} className="d-flex flex-column gap-3">
      <div className="form-floating">
        <input
          type="text"
          id="title"
          name="title"
          className="form-control"
          placeholder="Task title"
          value={formData.title}
          onChange={handleChange}
          required
        />
        <label htmlFor="title">Title</label>
      </div>

      <div className="form-floating">
        <textarea
          id="description"
          name="description"
          className="form-control"
          placeholder="Description"
          style={{ height: '80px' }}
          value={formData.description}
          onChange={handleChange}
        />
        <label htmlFor="description">Description (optional)</label>
      </div>

      <div className="row g-2">
        <div className="col-6">
          <div className="form-floating">
            <select
              id="priority"
              name="priority"
              className="form-select"
              value={formData.priority}
              onChange={handleChange}
            >
              {PRIORITY_OPTIONS.map(p => (
                <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
              ))}
            </select>
            <label htmlFor="priority">Priority</label>
          </div>
        </div>
        <div className="col-6">
          <div className="form-floating">
            <select
              id="status"
              name="status"
              className="form-select"
              value={formData.status}
              onChange={handleChange}
            >
              {STATUS_OPTIONS.map(s => (
                <option key={s} value={s}>{s.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>
              ))}
            </select>
            <label htmlFor="status">Status</label>
          </div>
        </div>
      </div>

      <div className="row g-2">
        <div className="col-6">
          <div className="form-floating">
            <input
              type="date"
              id="due_date"
              name="due_date"
              className="form-control"
              value={formData.due_date}
              onChange={handleChange}
            />
            <label htmlFor="due_date">Due Date (optional)</label>
          </div>
        </div>
        <div className="col-6">
          <div className="form-floating">
            <select
              id="assigned_to_id"
              name="assigned_to_id"
              className="form-select"
              value={formData.assigned_to_id}
              onChange={handleChange}
            >
              <option value="">Unassigned</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>
                  {emp.first_name} {emp.last_name}
                </option>
              ))}
            </select>
            <label htmlFor="assigned_to_id">Assign To (optional)</label>
          </div>
        </div>
      </div>

      <ActionFooter className="justify-center">
        {task?.id && onDelete && (
          <IconButton icon={TrashIcon} label="Delete" onClick={onDelete} variant="danger" />
        )}
        <IconButton icon={XMarkIcon} label="Cancel" onClick={onCancel} variant="secondary" />
        <IconButton icon={CheckIcon} label={saving ? 'Saving…' : task?.id ? 'Update Task' : 'Create Task'} type="submit" variant="primary" />
      </ActionFooter>
    </form>
  );
}

function TaskCard({ task, employees, onEdit, onDelete, onStatusChange }) {
  const assignee = employees.find(e => e.id === task.assigned_to_id);
  const isOverdue = task.due_date && task.status !== 'completed' && task.status !== 'cancelled'
    && new Date(task.due_date) < new Date();

  return (
    <div className={`card mb-2 border-start border-4 border-${PRIORITY_COLORS[task.priority] || 'secondary'}`}>
      <div className="card-body py-2 px-3">
        <div className="d-flex align-items-start justify-content-between gap-2">
          <div className="flex-grow-1 min-w-0">
            <div className="d-flex align-items-center gap-2 flex-wrap">
              <span className="fw-semibold text-truncate">{task.title}</span>
              <span className={`badge bg-${STATUS_COLORS[task.status] || 'secondary'} text-white`}>
                {task.status.replace('_', ' ')}
              </span>
              <span className={`badge bg-${PRIORITY_COLORS[task.priority] || 'secondary'} bg-opacity-25 text-${PRIORITY_COLORS[task.priority] || 'secondary'}`}>
                {task.priority}
              </span>
            </div>
            {task.description && (
              <p className="text-muted small mb-1 mt-1 text-truncate">{task.description}</p>
            )}
            <div className="d-flex align-items-center gap-3 flex-wrap">
              {task.due_date && (
                <span className={`small d-flex align-items-center gap-1 ${isOverdue ? 'text-danger' : 'text-muted'}`}>
                  <ClockIcon style={{ width: 12, height: 12 }} />
                  {new Date(task.due_date).toLocaleDateString()}
                  {isOverdue && ' (overdue)'}
                </span>
              )}
              {assignee && (
                <span className="small text-muted">
                  → {assignee.first_name} {assignee.last_name}
                </span>
              )}
            </div>
          </div>
          <div className="d-flex gap-1 flex-shrink-0">
            {task.status !== 'completed' && (
              <button
                className="btn btn-sm btn-outline-success"
                title="Mark Complete"
                onClick={() => onStatusChange(task, 'completed')}
              >
                <CheckIcon style={{ width: 14, height: 14 }} />
              </button>
            )}
            <button className="btn btn-sm btn-outline-secondary" onClick={() => onEdit(task)}>
              <PencilIcon style={{ width: 14, height: 14 }} />
            </button>
            <button className="btn btn-sm btn-outline-danger" onClick={() => onDelete(task)}>
              <TrashIcon style={{ width: 14, height: 14 }} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Tasks() {
  const { hasPermission, loading, setLoading, error, setError, clearError } = useStore();
  const [tasks, setTasks] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [editingTask, setEditingTask] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const hasFetched = useRef(false);

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [tasksRes, empRes] = await Promise.all([
        tasksAPI.getAll(),
        employeesAPI.getAll(),
      ]);
      setTasks(tasksRes?.data ?? tasksRes ?? []);
      setEmployees(empRes?.data ?? empRes ?? []);
      clearError();
    } catch (err) {
      setError('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingTask(null);
    setShowModal(true);
  };

  const handleEdit = (task) => {
    setEditingTask(task);
    setShowModal(true);
  };

  const handleDelete = async (task) => {
    if (!window.confirm(`Delete task "${task.title}"?`)) return;
    try {
      await tasksAPI.delete(task.id);
      setTasks(prev => prev.filter(t => t.id !== task.id));
    } catch (err) {
      setError('Failed to delete task');
    }
  };

  const handleStatusChange = async (task, newStatus) => {
    try {
      const updated = await tasksAPI.update(task.id, { status: newStatus });
      const updatedTask = updated?.data ?? updated;
      setTasks(prev => prev.map(t => t.id === task.id ? updatedTask : t));
    } catch (err) {
      setError('Failed to update task');
    }
  };

  const handleFormSubmit = async (formData) => {
    try {
      if (editingTask?.id) {
        const res = await tasksAPI.update(editingTask.id, formData);
        const updatedTask = res?.data ?? res;
        setTasks(prev => prev.map(t => t.id === editingTask.id ? updatedTask : t));
      } else {
        const res = await tasksAPI.create(formData);
        const newTask = res?.data ?? res;
        setTasks(prev => [newTask, ...prev]);
      }
      setShowModal(false);
      clearError();
    } catch (err) {
      setError('Failed to save task');
    }
  };

  const filtered = tasks.filter(t => {
    if (statusFilter !== 'all' && t.status !== statusFilter) return false;
    if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
    if (searchTerm && !t.title.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !t.description?.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  const pendingCount = tasks.filter(t => t.status === 'pending').length;
  const inProgressCount = tasks.filter(t => t.status === 'in_progress').length;
  const overdueCount = tasks.filter(t =>
    t.due_date && t.status !== 'completed' && t.status !== 'cancelled' && new Date(t.due_date) < new Date()
  ).length;

  // Permission check after all hooks
  if (!hasPermission('tasks', 'read') && !hasPermission('employees', 'read') && !hasPermission('schedule', 'read')) {
    return <Navigate to="/profile" replace />;
  }

  return (
    <div className="d-flex flex-column h-100 overflow-hidden">
      {/* Header */}
      <div className="px-3 pt-3 pb-2 border-bottom flex-shrink-0">
        <div className="d-flex align-items-center justify-content-between mb-2">
          <div className="d-flex align-items-center gap-2">
            <ClipboardDocumentListIcon style={{ width: 22, height: 22 }} className="text-primary" />
            <h5 className="mb-0 fw-bold">Tasks</h5>
            <span className="badge bg-primary">{tasks.length}</span>
          </div>
          <button className="btn btn-primary btn-sm d-flex align-items-center gap-1" onClick={handleCreate}>
            <PlusIcon style={{ width: 14, height: 14 }} />
            New Task
          </button>
        </div>

        {/* Summary badges */}
        <div className="d-flex gap-2 mb-2 flex-wrap">
          {pendingCount > 0 && (
            <span className="badge bg-secondary">{pendingCount} pending</span>
          )}
          {inProgressCount > 0 && (
            <span className="badge bg-primary">{inProgressCount} in progress</span>
          )}
          {overdueCount > 0 && (
            <span className="badge bg-danger">{overdueCount} overdue</span>
          )}
        </div>

        {/* Filters */}
        <div className="d-flex gap-2 flex-wrap align-items-center">
          <div className="input-group input-group-sm" style={{ maxWidth: 200 }}>
            <span className="input-group-text"><FunnelIcon style={{ width: 12, height: 12 }} /></span>
            <input
              type="text"
              placeholder="Search tasks..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="form-control form-control-sm app-search-input"
            />
          </div>
          <select
            className="form-select form-select-sm"
            style={{ width: 'auto' }}
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
          >
            <option value="all">All Statuses</option>
            {STATUS_OPTIONS.map(s => (
              <option key={s} value={s}>{s.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>
            ))}
          </select>
          <select
            className="form-select form-select-sm"
            style={{ width: 'auto' }}
            value={priorityFilter}
            onChange={e => setPriorityFilter(e.target.value)}
          >
            <option value="all">All Priorities</option>
            {PRIORITY_OPTIONS.map(p => (
              <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Task list */}
      <div className="flex-grow-1 overflow-auto p-3">
        {error && (
          <div className="alert alert-danger alert-dismissible mb-2" role="alert">
            {error}
            <button className="btn-close" onClick={clearError} />
          </div>
        )}
        {loading ? (
          <div className="text-center py-5">
            <div className="spinner-border text-primary" role="status" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-5 text-muted">
            <ClipboardDocumentListIcon style={{ width: 48, height: 48 }} className="mx-auto mb-3 opacity-50" />
            <p className="mb-1">No tasks found</p>
            <p className="small">Create a new task to get started</p>
          </div>
        ) : (
          filtered.map(task => (
            <TaskCard
              key={task.id}
              task={task}
              employees={employees}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onStatusChange={handleStatusChange}
            />
          ))
        )}
      </div>

      {/* Task form modal */}
      <Modal isOpen={showModal} title={editingTask ? 'Edit Task' : 'New Task'} onClose={() => setShowModal(false)}>
        <TaskForm
          task={editingTask}
          employees={employees}
          onSubmit={handleFormSubmit}
          onCancel={() => setShowModal(false)}
          onDelete={editingTask ? () => { handleDelete(editingTask); setShowModal(false); } : null}
        />
      </Modal>
    </div>
  );
}
