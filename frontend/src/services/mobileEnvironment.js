export const MOBILE_BREAKPOINT = 1024;

export const getMobileEnvironment = () => {
  if (typeof window === 'undefined') {
    return {
      userAgent: '',
      isTouch: false,
      isMobileViewport: false,
      isIOS: false,
      isAndroid: false,
      browser: 'unknown',
      isStandalone: false,
      supportsBeforeInstallPrompt: false,
      canAttemptAddressBarCollapse: false,
      installHint: 'Use your browser menu to Add to Home Screen.'
    };
  }

  const ua = window.navigator.userAgent || '';
  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const isMobileViewport = hasTouch && window.innerWidth <= MOBILE_BREAKPOINT;

  const isIOS = /iPad|iPhone|iPod/i.test(ua);
  const isAndroid = /Android/i.test(ua);

  const isSamsungInternet = /SamsungBrowser/i.test(ua);
  const isCriOS = /CriOS/i.test(ua);
  const isChrome = /Chrome\//i.test(ua) || isCriOS;
  const isFirefox = /Firefox\//i.test(ua) || /FxiOS/i.test(ua);
  const isEdge = /EdgA|EdgiOS/i.test(ua);
  const isOpera = /OPR\//i.test(ua) || /OPiOS/i.test(ua);
  const isSafari = /Safari/i.test(ua) && !isChrome && !isEdge && !isOpera && !isFirefox;
  const isChromiumFamily = (isChrome || isEdge || isOpera) && !isSamsungInternet;

  const browser = isSamsungInternet
    ? 'samsung-internet'
    : isFirefox
      ? 'firefox'
      : isEdge
        ? 'edge'
        : isOpera
          ? 'opera'
          : isSafari
            ? 'safari'
            : isChromiumFamily
              ? 'chromium'
              : 'generic-mobile';

  const mediaStandalone = window.matchMedia?.('(display-mode: standalone)').matches;
  const navigatorStandalone = typeof window.navigator.standalone === 'boolean' && window.navigator.standalone;
  const isStandalone = mediaStandalone || navigatorStandalone;

  const supportsBeforeInstallPrompt = 'onbeforeinstallprompt' in window;
  const canAttemptAddressBarCollapse = isMobileViewport && !isStandalone;

  let installHint = 'Use your browser menu to Add to Home Screen.';

  if (isIOS && isSafari) {
    installHint = 'Install this app: Share → Add to Home Screen.';
  } else if (isSamsungInternet) {
    installHint = 'Install this app: Menu → Add page to → Home screen.';
  } else if (isFirefox) {
    installHint = 'Install this app: Menu → Install or Add to Home screen.';
  } else if (isChromiumFamily) {
    installHint = 'Install this app: Menu → Install app or Add to Home screen.';
  }

  return {
    userAgent: ua,
    isTouch: hasTouch,
    isMobileViewport,
    isIOS,
    isAndroid,
    browser,
    isStandalone,
    supportsBeforeInstallPrompt,
    canAttemptAddressBarCollapse,
    installHint
  };
};