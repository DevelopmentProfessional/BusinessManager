import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import useStore from '../../services/useStore';

export default function InstallAppPrompt() {
  const location = useLocation();
  const isAuthenticated = useStore((state) => state.isAuthenticated);

  useEffect(() => {
    const canCapturePrompt = isAuthenticated() && location.pathname !== '/login';

    if (!canCapturePrompt) {
      window.__pwaDeferredPrompt = null;
      return undefined;
    }

    const onBeforeInstallPrompt = (event) => {
      event.preventDefault();
      window.__pwaDeferredPrompt = event;
    };

    const onAppInstalled = () => {
      window.__pwaDeferredPrompt = null;
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);

    return () => {
      window.__pwaDeferredPrompt = null;
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, [isAuthenticated, location.pathname]);

  return null;
}