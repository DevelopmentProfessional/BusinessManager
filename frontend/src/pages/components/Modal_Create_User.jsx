import React from 'react';
import Modal from './Modal';
import { XMarkIcon, CheckIcon } from '@heroicons/react/24/outline';

export default function Modal_Create_User({
  isOpen,
  onClose,
  newUser,
  setNewUser,
  onSubmit,
  loading,
  roles,
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} noPadding={true} fullScreen={true}>
      <div className="d-flex flex-column bg-white dark:bg-gray-900" style={{ height: '100%' }}>
        {/* Header */}
        <div className="flex-shrink-0 p-2 border-bottom border-gray-200 dark:border-gray-700 d-flex justify-content-between align-items-center">
          <h6 className="mb-0 fw-semibold text-gray-900 dark:text-gray-100">Create User</h6>
          <button type="button" onClick={onClose} className="btn btn-link p-0 text-muted">
            <XMarkIcon style={{ width: 20, height: 20 }} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-grow-1 overflow-auto no-scrollbar px-3 pt-3">
          <form id="create-user-form" onSubmit={onSubmit}>
            <div className="form-floating mb-3">
              <input
                type="text"
                id="createUserUsername"
                value={newUser.username}
                onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                className="form-control"
                placeholder="Username"
                required
              />
              <label htmlFor="createUserUsername">Username</label>
            </div>
            <div className="form-floating mb-3">
              <input
                type="email"
                id="createUserEmail"
                value={newUser.email}
                onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                className="form-control"
                placeholder="Email"
                required
              />
              <label htmlFor="createUserEmail">Email</label>
            </div>
            <div className="form-floating mb-3">
              <input
                type="password"
                id="createUserPassword"
                value={newUser.password}
                onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                className="form-control"
                placeholder="Password"
                required
              />
              <label htmlFor="createUserPassword">Password</label>
            </div>
            <div className="form-floating mb-3">
              <input
                type="text"
                id="createUserFirstName"
                value={newUser.first_name}
                onChange={(e) => setNewUser({ ...newUser, first_name: e.target.value })}
                className="form-control"
                placeholder="First Name"
                required
              />
              <label htmlFor="createUserFirstName">First Name</label>
            </div>
            <div className="form-floating mb-3">
              <input
                type="text"
                id="createUserLastName"
                value={newUser.last_name}
                onChange={(e) => setNewUser({ ...newUser, last_name: e.target.value })}
                className="form-control"
                placeholder="Last Name"
                required
              />
              <label htmlFor="createUserLastName">Last Name</label>
            </div>
            <div className="form-floating mb-3">
              <select
                id="createUserRole"
                value={newUser.role}
                onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                className="form-select form-select-sm"
              >
                {roles.map(role => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
              <label htmlFor="createUserRole">Role</label>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 pt-2 pb-4 px-3 border-top border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
          <div className="d-flex align-items-center">
            <div style={{ width: 40 }} />
            <div className="flex-grow-1 d-flex gap-3 justify-content-center">
              <button
                type="button"
                onClick={onClose}
                className="btn btn-outline-secondary btn-sm p-1 d-flex align-items-center justify-content-center"
                style={{ width: '3rem', height: '3rem' }}
                title="Cancel"
              >
                <XMarkIcon style={{ width: 18, height: 18 }} />
              </button>
              <button
                type="submit"
                form="create-user-form"
                disabled={loading}
                className="btn btn-primary btn-sm p-1 d-flex align-items-center justify-content-center"
                style={{ width: '3rem', height: '3rem' }}
                title="Create User"
              >
                <CheckIcon style={{ width: 18, height: 18 }} />
              </button>
            </div>
            <div style={{ width: 40 }} />
          </div>
        </div>
      </div>
    </Modal>
  );
}
