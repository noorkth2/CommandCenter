/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: {
          base: '#0e0e10',
          surface: '#16161a',
          elevated: '#1e1e24',
          hover: '#26262e',
        },
        border: {
          DEFAULT: 'rgba(255,255,255,0.08)',
          strong: 'rgba(255,255,255,0.14)',
        },
        text: {
          primary: '#e8e6f0',
          secondary: '#8a8799',
          muted: '#5a5870',
        },
        brand: {
          blue: '#5b6af8',
          green: '#3ecf8e',
          amber: '#f5a623',
          red: '#e85d4a',
          purple: '#9d8ff5',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        '2xs': '11px',
        xs: '12px',
        sm: '13px',
        base: '14px',
        md: '16px',
        lg: '18px',
        xl: '22px',
      },
      borderRadius: {
        sm: '4px',
        DEFAULT: '8px',
        md: '10px',
        lg: '12px',
        xl: '16px',
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.3)',
        elevated: '0 4px 16px rgba(0,0,0,0.5)',
        overlay: '0 20px 60px rgba(0,0,0,0.6)',
      },
      transitionTimingFunction: {
        smooth: 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
    },
  },
  plugins: [],
};
