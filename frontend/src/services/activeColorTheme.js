const DEFAULT_ACTIVE_COLOR = '#3B82F6';
const ACTIVE_COLOR_STORAGE_KEY = 'app_active_color';

function isValidHexColor(value) {
  return typeof value === 'string' && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim());
}

function normalizeHexColor(value) {
  if (!isValidHexColor(value)) return DEFAULT_ACTIVE_COLOR;
  let normalized = value.trim().toUpperCase();
  if (normalized.length === 4) {
    normalized = `#${normalized[1]}${normalized[1]}${normalized[2]}${normalized[2]}${normalized[3]}${normalized[3]}`;
  }
  return normalized;
}

function hexToRgb(hex) {
  const normalized = normalizeHexColor(hex);
  return {
    r: parseInt(normalized.slice(1, 3), 16),
    g: parseInt(normalized.slice(3, 5), 16),
    b: parseInt(normalized.slice(5, 7), 16),
  };
}

function shiftChannel(channelValue, amount) {
  return Math.max(0, Math.min(255, Math.round(channelValue + amount)));
}

function createHoverColor(hex) {
  const { r, g, b } = hexToRgb(hex);
  const hovered = {
    r: shiftChannel(r, -16),
    g: shiftChannel(g, -16),
    b: shiftChannel(b, -16),
  };
  return `#${hovered.r.toString(16).padStart(2, '0')}${hovered.g.toString(16).padStart(2, '0')}${hovered.b.toString(16).padStart(2, '0')}`.toUpperCase();
}

export function getStoredActiveColor() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(ACTIVE_COLOR_STORAGE_KEY);
}

export function applyActiveColorTheme(color) {
  if (typeof document === 'undefined') return DEFAULT_ACTIVE_COLOR;

  const resolvedColor = normalizeHexColor(color || getStoredActiveColor() || DEFAULT_ACTIVE_COLOR);
  const hoverColor = createHoverColor(resolvedColor);
  const { r, g, b } = hexToRgb(resolvedColor);

  const root = document.documentElement;
  const body = document.body;
  const applyVars = (target) => {
    if (!target) return;
    target.style.setProperty('--app-active-color', resolvedColor);
    target.style.setProperty('--app-active-color-hover', hoverColor);
    target.style.setProperty('--app-active-color-rgb', `${r}, ${g}, ${b}`);
    target.style.setProperty('--bs-primary', resolvedColor);
    target.style.setProperty('--bs-primary-rgb', `${r}, ${g}, ${b}`);
  };

  applyVars(root);
  applyVars(body);

  if (typeof window !== 'undefined') {
    localStorage.setItem(ACTIVE_COLOR_STORAGE_KEY, resolvedColor);
  }

  return resolvedColor;
}

export function initializeActiveColorTheme(userColor) {
  return applyActiveColorTheme(userColor || getStoredActiveColor() || DEFAULT_ACTIVE_COLOR);
}

export { DEFAULT_ACTIVE_COLOR, ACTIVE_COLOR_STORAGE_KEY, normalizeHexColor };
