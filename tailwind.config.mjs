/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: {
          base: 'rgba(var(--bg-base-rgb), <alpha-value>)',
          surface: 'rgba(var(--bg-surface-rgb), <alpha-value>)',
          elevated: 'rgba(var(--bg-elevated-rgb), <alpha-value>)',
        },
        border: {
          DEFAULT: 'rgba(var(--border-rgb), <alpha-value>)',
          hover: 'rgba(var(--border-hover-rgb), <alpha-value>)',
        },
        text: {
          primary: 'rgba(var(--text-primary-rgb), <alpha-value>)',
          secondary: 'rgba(var(--text-secondary-rgb), <alpha-value>)',
          muted: 'rgba(var(--text-muted-rgb), <alpha-value>)',
        },
        accent: {
          DEFAULT: 'rgba(var(--accent-rgb), <alpha-value>)',
          hover: 'rgba(var(--accent-hover-rgb), <alpha-value>)',
          bg: 'rgba(124, 110, 245, 0.12)',
        },
        success: 'rgba(var(--success-rgb), <alpha-value>)',
        warning: 'rgba(var(--warning-rgb), <alpha-value>)',
        danger: 'rgba(var(--danger-rgb), <alpha-value>)',
        tint: {
          neutral: 'rgba(255,255,255,0.03)',
          green: 'rgba(200,255,200,0.04)',
          amber: 'rgba(255,240,180,0.05)',
          purple: 'rgba(220,200,255,0.05)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        '3xs': '10px',
        '2xs': '11px',
        xs: '12px',
        sm: '13px',
        base: '14px',
        md: '16px',
        lg: '18px',
        xl: '22px',
        '2xl': '24px',
        '3xl': '32px',
      },
      borderRadius: {
        sm: '4px',
        DEFAULT: '8px',
        md: '10px',
        lg: '12px',
        xl: '16px',
      },
      spacing: {
        sidebar: '200px',
        topbar: '52px',
      },
    },
  },
  plugins: [],
};
