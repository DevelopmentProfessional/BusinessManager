/**
 * Branding Hook - Manages dynamic color theming throughout the application
 *
 * This hook loads branding colors from localStorage and applies them as CSS custom properties,
 * which are then used by Tailwind CSS for consistent theming across all components.
 */

import { useCallback, useEffect, useState } from 'react';

// Default branding values
const DEFAULT_BRANDING = {
  primaryColor: '#3B82F6',    // Blue
  secondaryColor: '#10B981',  // Emerald
  accentColor: '#8B5CF6',     // Purple
  logoUrl: '',
  companyName: 'Business Manager',
  tagline: ''
};

/**
 * Convert hex color to RGB values
 * @param {string} hex - Hex color string (e.g., "#3B82F6")
 * @returns {{ r: number, g: number, b: number }} RGB values
 */
function hexToRgb(hex) {
  // Remove # if present
  hex = hex.replace(/^#/, '');

  // Handle shorthand hex (e.g., #FFF)
  if (hex.length === 3) {
    hex = hex.split('').map(c => c + c).join('');
  }

  const result = /^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 0, g: 0, b: 0 };
}

/**
 * Convert RGB to HSL
 * @param {number} r - Red (0-255)
 * @param {number} g - Green (0-255)
 * @param {number} b - Blue (0-255)
 * @returns {{ h: number, s: number, l: number }} HSL values
 */
function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h, s;
  const l = (max + min) / 2;

  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
      default:
        h = 0;
    }
  }

  return { h: h * 360, s: s * 100, l: l * 100 };
}

/**
 * Convert HSL to RGB
 * @param {number} h - Hue (0-360)
 * @param {number} s - Saturation (0-100)
 * @param {number} l - Lightness (0-100)
 * @returns {{ r: number, g: number, b: number }} RGB values
 */
function hslToRgb(h, s, l) {
  h /= 360;
  s /= 100;
  l /= 100;

  let r, g, b;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255)
  };
}

/**
 * Generate a full color palette from a base hex color
 * Creates shades from 50 (lightest) to 950 (darkest)
 * @param {string} hexColor - Base hex color
 * @returns {Object} Color palette with shades
 */
function generateColorPalette(hexColor) {
  const rgb = hexToRgb(hexColor);
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);

  // Define lightness values for each shade
  // These are carefully tuned to match Tailwind's color palette feel
  const shades = {
    50:  { l: 97, s: hsl.s * 0.3 },
    100: { l: 94, s: hsl.s * 0.4 },
    200: { l: 88, s: hsl.s * 0.5 },
    300: { l: 78, s: hsl.s * 0.6 },
    400: { l: 65, s: hsl.s * 0.8 },
    500: { l: 50, s: hsl.s },        // Base color
    600: { l: 42, s: hsl.s * 1.05 },
    700: { l: 35, s: hsl.s * 1.1 },
    800: { l: 28, s: hsl.s * 1.1 },
    900: { l: 22, s: hsl.s * 1.05 },
    950: { l: 12, s: hsl.s * 0.9 },
  };

  const palette = {};

  for (const [shade, { l, s }] of Object.entries(shades)) {
    const rgbShade = hslToRgb(hsl.h, Math.min(100, s), l);
    palette[shade] = `${rgbShade.r} ${rgbShade.g} ${rgbShade.b}`;
  }

  return palette;
}

/**
 * Apply color palette to CSS custom properties
 * @param {string} prefix - CSS variable prefix (e.g., 'primary', 'secondary', 'accent')
 * @param {Object} palette - Color palette object
 */
function applyColorPalette(prefix, palette) {
  const root = document.documentElement;

  for (const [shade, rgbValue] of Object.entries(palette)) {
    root.style.setProperty(`--color-${prefix}-${shade}`, rgbValue);
  }
}

/**
 * Custom hook for managing application branding
 * @returns {Object} Branding state and functions
 */
export default function useBranding() {
  const [branding, setBranding] = useState(DEFAULT_BRANDING);
  const [isInitialized, setIsInitialized] = useState(false);

  /**
   * Apply branding colors to CSS custom properties
   */
  const applyBranding = useCallback((brandingData) => {
    const { primaryColor, secondaryColor, accentColor } = brandingData;

    // Generate and apply color palettes
    const primaryPalette = generateColorPalette(primaryColor || DEFAULT_BRANDING.primaryColor);
    const secondaryPalette = generateColorPalette(secondaryColor || DEFAULT_BRANDING.secondaryColor);
    const accentPalette = generateColorPalette(accentColor || DEFAULT_BRANDING.accentColor);

    applyColorPalette('primary', primaryPalette);
    applyColorPalette('secondary', secondaryPalette);
    applyColorPalette('accent', accentPalette);

    // Also set the base color references
    const root = document.documentElement;
    root.style.setProperty('--color-primary', primaryColor || DEFAULT_BRANDING.primaryColor);
    root.style.setProperty('--color-secondary', secondaryColor || DEFAULT_BRANDING.secondaryColor);
    root.style.setProperty('--color-accent', accentColor || DEFAULT_BRANDING.accentColor);
  }, []);

  /**
   * Initialize branding from localStorage
   */
  const initializeBranding = useCallback(() => {
    try {
      const savedBranding = localStorage.getItem('app_branding');
      if (savedBranding) {
        const parsed = JSON.parse(savedBranding);
        const mergedBranding = { ...DEFAULT_BRANDING, ...parsed };
        setBranding(mergedBranding);
        applyBranding(mergedBranding);
      } else {
        // Apply default branding
        applyBranding(DEFAULT_BRANDING);
      }
    } catch (error) {
      console.warn('Failed to load branding settings:', error);
      applyBranding(DEFAULT_BRANDING);
    }
    setIsInitialized(true);
  }, [applyBranding]);

  /**
   * Update branding and persist to localStorage
   */
  const updateBranding = useCallback((newBranding) => {
    const mergedBranding = { ...branding, ...newBranding };
    setBranding(mergedBranding);
    localStorage.setItem('app_branding', JSON.stringify(mergedBranding));
    applyBranding(mergedBranding);
  }, [branding, applyBranding]);

  /**
   * Reset branding to defaults
   */
  const resetBranding = useCallback(() => {
    setBranding(DEFAULT_BRANDING);
    localStorage.removeItem('app_branding');
    applyBranding(DEFAULT_BRANDING);
  }, [applyBranding]);

  // Initialize on mount
  useEffect(() => {
    initializeBranding();
  }, [initializeBranding]);

  return {
    branding,
    isInitialized,
    updateBranding,
    resetBranding,
    applyBranding,
    initializeBranding,
    DEFAULT_BRANDING
  };
}

// Export utility functions for external use
export { hexToRgb, generateColorPalette, DEFAULT_BRANDING };
