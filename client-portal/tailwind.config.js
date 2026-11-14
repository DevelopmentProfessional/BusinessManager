/** @type {import('tailwindcss').Config} */
// Inherits the SAME color palette, fonts, and spacing as the internal app.
// Do NOT change brand colors here — they are defined in the internal app's
// tailwind.config.js and mirrored here to keep a unified visual identity.
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Mirror internal app brand tokens exactly
        primary:   { DEFAULT: '#4F46E5', hover: '#4338CA', light: '#EEF2FF' },
        secondary: { DEFAULT: '#0EA5E9', hover: '#0284C7', light: '#E0F2FE' },
        success:   { DEFAULT: '#22C55E', hover: '#16A34A', light: '#F0FDF4' },
        warning:   { DEFAULT: '#F59E0B', hover: '#D97706', light: '#FFFBEB' },
        danger:    { DEFAULT: '#EF4444', hover: '#DC2626', light: '#FEF2F2' },
        neutral:   { DEFAULT: '#6B7280', light: '#F9FAFB', dark: '#1F2937' },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
