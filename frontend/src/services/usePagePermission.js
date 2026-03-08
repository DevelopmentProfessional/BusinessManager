import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function usePagePermission(pageName, hasPermission) {
  const navigate = useNavigate();
  useEffect(() => {
    if (!hasPermission(pageName, 'read') &&
        !hasPermission(pageName, 'write') &&
        !hasPermission(pageName, 'delete') &&
        !hasPermission(pageName, 'admin')) {
      navigate('/profile', { replace: true });
    }
  }, []);
}
