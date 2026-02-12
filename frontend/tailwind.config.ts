import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f3eaff',
          100: '#e4d1ff',
          200: '#cba5ff',
          300: '#b07aef',
          400: '#9d63e0',
          500: '#8D52DA',
          600: '#7a42c4',
          700: '#6633a8',
          800: '#52278c',
          900: '#3d1c6e',
          950: '#2a1050',
        },
        accent: {
          green: '#30E000',
          red: '#FF494A',
          yellow: '#FFD641',
          orange: '#f97316',
          purple: '#8D52DA',
          foreground: '#E0E0E0',
        },
        surface: {
          DEFAULT: '#111214',
          secondary: '#1A1B1F',
          tertiary: '#222328',
          hover: '#2A2B30',
        },
        border: {
          DEFAULT: 'rgba(255, 255, 255, 0.08)',
          dim: 'rgba(255, 255, 255, 0.04)',
          hover: 'rgba(224, 232, 255, 0.1)',
        },
        text: {
          primary: '#FFFFFF',
          secondary: 'rgba(255, 255, 255, 0.6)',
          dim: 'rgba(224, 232, 255, 0.3)',
          muted: 'rgba(255, 255, 255, 0.4)',
        },
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'Helvetica',
          'Arial',
          'sans-serif',
        ],
        mono: ['JetBrains Mono', 'monospace'],
      },
      fontSize: {
        h1: ['32px', { lineHeight: '1.2', fontWeight: '700' }],
        h2: ['24px', { lineHeight: '1.3', fontWeight: '600' }],
        h3: ['18px', { lineHeight: '1.4', fontWeight: '600' }],
        h4: ['16px', { lineHeight: '1.4', fontWeight: '600' }],
        body: ['14px', { lineHeight: '1.6', fontWeight: '400' }],
        label: ['13px', { lineHeight: '1.4', fontWeight: '400' }],
        small: ['12px', { lineHeight: '1.4', fontWeight: '400' }],
        button: ['14px', { lineHeight: '1.4', fontWeight: '600' }],
      },
      borderRadius: {
        btn: '4px',
        card: '8px',
        modal: '8px',
      },
      boxShadow: {
        card: '0px 4px 12px rgba(0, 0, 0, 0.1)',
        dialog: '0px 8px 32px rgba(0, 0, 0, 0.32)',
        'btn-hover': '0px 4px 12px rgba(0, 0, 0, 0.2)',
      },
      animation: {
        'slide-in': 'slideIn 0.3s ease-out',
        'fade-in': 'fadeIn 0.2s ease-out',
        'pulse-slow': 'pulse 3s infinite',
        'bounce-in': 'bounceIn 0.5s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
        'flash-green': 'flashGreen 2s ease-out',
        'flash-red': 'flashRed 2s ease-out',
      },
      keyframes: {
        slideIn: {
          from: { transform: 'translateX(100%)' },
          to: { transform: 'translateX(0)' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        bounceIn: {
          '0%': { transform: 'scale(0.9)', opacity: '0' },
          '50%': { transform: 'scale(1.05)' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        scaleIn: {
          from: { transform: 'scale(0)' },
          to: { transform: 'scale(1)' },
        },
        flashGreen: {
          '0%': { backgroundColor: 'rgba(48, 224, 0, 0.25)' },
          '100%': { backgroundColor: 'transparent' },
        },
        flashRed: {
          '0%': { backgroundColor: 'rgba(255, 73, 74, 0.25)' },
          '100%': { backgroundColor: 'transparent' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
