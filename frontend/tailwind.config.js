/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class', // toggled via ThemeContext, see src/context/ThemeContext.jsx
  theme: {
    extend: {
      colors: {
        // ----------------------------------------------------
        // DESIGN SYSTEM — from project brief
        // Neutral base + one brand accent + semantic states.
        // Dark mode is the default; light mode is the alt.
        // ----------------------------------------------------
        bg: {
          dark: '#0B1220',
          light: '#F8FAFC',
        },
        surface: {
          dark: '#111827',
          light: '#FFFFFF',
        },
        brand: {
          DEFAULT: '#4F46E5', // primary
          accent: '#06B6D4',  // secondary accent
        },
        status: {
          success: '#22C55E',
          warning: '#F59E0B',
          error: '#EF4444',
        },
        muted: {
          text: '#94A3B8',
          border: '#E2E8F0',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
