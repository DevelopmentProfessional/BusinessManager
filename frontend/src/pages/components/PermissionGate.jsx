import React, { useEffect, useState } from 'react';
import useStore from '../services/useStore';

/**
 * PermissionGate component for conditional rendering based on permissions
 * 
 * @param {string} page - The page/module name (e.g., 'clients', 'inventory')
 * @param {string} permission - The permission type (e.g., 'read', 'write', 'delete', 'admin')
 * @param {React.ReactNode} children - Content to render if permission is granted
 * @param {React.ReactNode} fallback - Optional fallback content to render if permission is denied
 * @param {boolean} hide - If true, renders nothing when permission is denied (default: true)
 */
const PermissionGate = ({ 
  page, 
  permission, 
  children, 
  fallback = null, 
  hide = true 
}) => {
  const { hasPermission } = useStore();
  const [hasAccess, setHasAccess] = useState(() => hasPermission(page, permission));
  
  // Update access when permissions change
  useEffect(() => {
    const checkAccess = () => {
      setHasAccess(hasPermission(page, permission));
    };
    
    // Check access immediately
    checkAccess();
    
    // Listen for permission change events
    if (typeof window !== 'undefined') {
      window.addEventListener('permissionsChanged', checkAccess);
      
      return () => {
        window.removeEventListener('permissionsChanged', checkAccess);
      };
    }
  }, [page, permission, hasPermission]);
  
  if (hasAccess) {
    return <>{children}</>;
  }
  
  if (!hide) {
    return <>{fallback}</>;
  }
  
  return null;
};

export default PermissionGate;
