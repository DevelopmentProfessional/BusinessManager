import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import useStore from '../../services/useStore';
import { getMobileEnvironment } from '../../services/mobileEnvironment';

export default function MobileAddressBarManager() {
  const location = useLocation();
  const isAuthenticated = useStore((state) => state.isAuthenticated);

  useEffect(() => {
    const shouldHideAddressBar = isAuthenticated() && location.pathname !== '/login';
    const root = document.documentElement;

    if (!shouldHideAddressBar) {
      root.classList.remove('mobile-immersive', 'pwa-standalone', 'ios-browser-mode');
      root.removeAttribute('data-mobile-browser');
      root.removeAttribute('data-mobile-os');
      root.removeAttribute('data-mobile-standalone');
      return undefined;
    }

    const mobileEnv = getMobileEnvironment();

    if (!mobileEnv.isMobileViewport) {
      root.classList.remove('mobile-immersive', 'pwa-standalone', 'ios-browser-mode');
      root.removeAttribute('data-mobile-browser');
      root.removeAttribute('data-mobile-os');
      root.removeAttribute('data-mobile-standalone');
      return undefined;
    }

    let hideTimeoutA;
    let hideTimeoutB;
    let hideTimeoutC;

    const applyModeClasses = () => {
      const env = getMobileEnvironment();
      root.classList.toggle('pwa-standalone', env.isStandalone);
      root.classList.toggle('mobile-immersive', !env.isStandalone);
      root.classList.toggle('ios-browser-mode', env.isIOS && !env.isStandalone);
      root.setAttribute('data-mobile-browser', env.browser);
      root.setAttribute('data-mobile-os', env.isIOS ? 'ios' : env.isAndroid ? 'android' : 'other');
      root.setAttribute('data-mobile-standalone', env.isStandalone ? 'true' : 'false');
    };

    const syncViewportHeight = () => {
      const viewportHeight = window.visualViewport?.height || window.innerHeight;
      root.style.setProperty('--mobile-app-height', `${Math.round(viewportHeight)}px`);
    };

    const hideAddressBar = () => {
      const env = getMobileEnvironment();

      if (!env.canAttemptAddressBarCollapse) {
        applyModeClasses();
        syncViewportHeight();
        return;
      }

      applyModeClasses();
      syncViewportHeight();

      if (!env.isStandalone) {
        window.scrollTo(0, 1);
      }
    };

    const hideAddressBarWithRetries = () => {
      hideAddressBar();
      hideTimeoutA = window.setTimeout(hideAddressBar, 80);
      hideTimeoutB = window.setTimeout(hideAddressBar, 250);
      hideTimeoutC = window.setTimeout(hideAddressBar, 500);
    };

    const onViewportChange = () => {
      hideAddressBarWithRetries();
    };

    hideAddressBarWithRetries();

    window.addEventListener('resize', onViewportChange, { passive: true });
    window.addEventListener('orientationchange', onViewportChange, { passive: true });
    window.addEventListener('pageshow', onViewportChange, { passive: true });
    window.visualViewport?.addEventListener('resize', onViewportChange, { passive: true });

    return () => {
      window.clearTimeout(hideTimeoutA);
      window.clearTimeout(hideTimeoutB);
      window.clearTimeout(hideTimeoutC);
      root.classList.remove('mobile-immersive', 'pwa-standalone', 'ios-browser-mode');
      root.removeAttribute('data-mobile-browser');
      root.removeAttribute('data-mobile-os');
      root.removeAttribute('data-mobile-standalone');
      window.removeEventListener('resize', onViewportChange);
      window.removeEventListener('orientationchange', onViewportChange);
      window.removeEventListener('pageshow', onViewportChange);
      window.visualViewport?.removeEventListener('resize', onViewportChange);
    };
  }, [isAuthenticated, location.pathname]);

  return null;
}