import React, { useState, useEffect } from 'react';
import useStore from '../../services/useStore';

/**
 * Debug component to show current user permissions
 * This is for testing purposes only
 */
const PermissionDebug = () => {
  const { user, hasPermission } = useStore();
  const [permissions, setPermissions] = useState({});

  const pages = ['clients', 'inventory', 'services', 'employees', 'schedule', 'attendance', 'documents', 'admin'];
  const permissionTypes = ['read', 'write', 'delete', 'admin'];

  useEffect(() => {
    const currentPermissions = {};
    pages.forEach(page => {
      currentPermissions[page] = {};
      permissionTypes.forEach(perm => {
        currentPermissions[page][perm] = hasPermission(page, perm);
      });
    });
    setPermissions(currentPermissions);
  }, [user, hasPermission]);

  if (!user) return null;

  return (
    <div className="bg-gray-100 p-4 rounded-lg mb-4">
      <h3 className="text-sm font-bold mb-2">Current User Permissions (Debug)</h3>
      <div className="text-xs">
        <p><strong>User:</strong> {user.first_name} {user.last_name}</p>
        <p><strong>Role:</strong> {user.role}</p>
        <p><strong>Employee ID:</strong> {user.employee?.id || 'None'}</p>
        <div className="mt-2">
          {pages.map(page => (
            <div key={page} className="mb-1">
              <span className="font-medium">{page}:</span>
              {permissionTypes.map(perm => (
                <span key={perm} className={`ml-2 px-1 rounded ${permissions[page]?.[perm] ? 'bg-green-200' : 'bg-red-200'}`}>
                  {perm}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PermissionDebug;
