import { useEffect } from 'react';
import useStore from '../store/useStore';

/**
 * Custom hook to automatically refresh user permissions when component mounts
 * and when the user changes. This ensures permission changes are immediately reflected.
 */
export const usePermissionRefresh = () => {
  const { refreshUserPermissions, user } = useStore();

  useEffect(() => {
    // Refresh permissions when component mounts
    refreshUserPermissions();
  }, [refreshUserPermissions]);

  useEffect(() => {
    // Refresh permissions when user changes
    if (user) {
      refreshUserPermissions();
    }
  }, [user?.id, refreshUserPermissions]);

  useEffect(() => {
    // Listen for permission change events
    const handlePermissionChange = () => {
      refreshUserPermissions();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('permissionsChanged', handlePermissionChange);
      
      return () => {
        window.removeEventListener('permissionsChanged', handlePermissionChange);
      };
    }
  }, [refreshUserPermissions]);

  return { refreshUserPermissions };
};
