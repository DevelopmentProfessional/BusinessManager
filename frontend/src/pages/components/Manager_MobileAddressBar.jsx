import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import useStore from '../../services/useStore';
import { getMobileEnvironment } from '../../services/mobileEnvironment';

export default function MobileAddressBarManager() {
  const location = useLocation();
  const isAuthenticated = useStore((state) => state.isAuthenticated);

  useEffect(() => {
    const root = document.documentElement;
    let focusActive = false;

    const updateKeyboardOffset = () => {
      if (!focusActive) {
        root.style.setProperty('--keyboard-offset', '0px');
        root.classList.remove('keyboard-open');
        return;
      }

      const viewport = window.visualViewport;
      const viewportHeight = viewport?.height || window.innerHeight;
      const offsetTop = viewport?.offsetTop || 0;
      const offset = Math.max(0, Math.round(window.innerHeight - viewportHeight - offsetTop));

      root.style.setProperty('--keyboard-offset', `${offset}px`);
      root.classList.toggle('keyboard-open', offset > 0);
    };

    const onFocusIn = (event) => {
      const target = event.target;
      if (target && target.classList?.contains('app-search-input')) {
        focusActive = true;
        root.classList.add('search-focus');
        updateKeyboardOffset();
        window.setTimeout(updateKeyboardOffset, 0);
      }
    };

    const onFocusOut = (event) => {
      const target = event.target;
      if (target && target.classList?.contains('app-search-input')) {
        focusActive = false;
        root.classList.remove('search-focus');
        updateKeyboardOffset();
      }
    };

    const onViewportChange = () => {
      if (focusActive) {
        updateKeyboardOffset();
      }
    };

    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', onFocusOut);
    window.addEventListener('resize', onViewportChange, { passive: true });
    window.visualViewport?.addEventListener('resize', onViewportChange, { passive: true });
    window.visualViewport?.addEventListener('scroll', onViewportChange, { passive: true });

    return () => {
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', onFocusOut);
      window.removeEventListener('resize', onViewportChange);
      window.visualViewport?.removeEventListener('resize', onViewportChange);
      window.visualViewport?.removeEventListener('scroll', onViewportChange);
      root.style.setProperty('--keyboard-offset', '0px');
      root.classList.remove('keyboard-open', 'search-focus');
    };
  }, []);

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