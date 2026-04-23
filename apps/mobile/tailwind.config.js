/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        surface: {
          elder:          '#FBF7F0',
          'elder-raised': '#FFFFFF',
          'elder-sunken': '#F4EFE6',
          intermediary:   '#F6F5F2',
          'intermediary-raised': '#FFFFFF',
          'intermediary-sunken': '#EDEAE3',
          dark:           '#1A1714',
          'dark-raised':  '#26221E',
        },
        accent: {
          50:  '#FBF2EC',
          100: '#F2D9C9',
          500: '#D06534',
          600: '#B8552B',
          700: '#964521',
          ink: '#5A2810',
        },
        neutral: {
          50:  '#FAF8F5', 100: '#F0EDE7', 200: '#E2DDD3',
          300: '#C8C1B3', 400: '#9C9485', 500: '#736B5C',
          600: '#544D42', 700: '#3D372F', 800: '#2A2520', 900: '#1A1714',
        },
        safety: {
          critical:        '#C8392E',
          'critical-soft': '#FBE8E5',
          'critical-border': '#F4C4BE',
        },
        presence: { DEFAULT: '#7A8C4F', soft: '#EEF1E2' },
        info:     { DEFAULT: '#4A6B7A', soft: '#E0E8EC' },
      },
    },
  },
  plugins: [],
};
