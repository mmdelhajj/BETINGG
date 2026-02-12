import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    screens: {
      xs: '375px',   // Mobile - iPhone SE, small Android
      sm: '480px',   // Large mobile
      md: '768px',   // Tablet
      lg: '1024px',  // Desktop
      xl: '1280px',  // Large desktop
      '2xl': '1536px', // Extra large desktop
    },
    extend: {
      colors: {
        brand: {
          50: '#f3eaff',
          100: '#e4d1ff',
          200: '#cba5ff',
          300: '#b07aef',
          400: '#9d63e0',
          500: '#8D52DA', // Primary purple
          600: '#7a42c4',
          700: '#6633a8',
          800: '#52278c',
          900: '#3d1c6e',
          950: '#2a1050',
        },
        accent: {
          green: '#30E000',      // Win/success green
          red: '#FF494A',        // Loss/error red
          yellow: '#FFD641',     // Warning/pending yellow
          orange: '#f97316',     // Alternative accent
          purple: '#8D52DA',     // Brand purple
          lime: '#BFFF00',       // Live/highlight lime
          foreground: '#E0E0E0', // Foreground text
        },
        surface: {
          deepest: '#0F0F12',    // Deepest background (Cloudbet dark)
          DEFAULT: '#111214',    // Default background
          secondary: '#1A1B1F',  // Cards, panels (Cloudbet surface)
          tertiary: '#222328',   // Elevated elements
          hover: '#2A2B30',      // Hover states
        },
        border: {
          DEFAULT: 'rgba(255, 255, 255, 0.08)',     // Default border
          dim: 'rgba(255, 255, 255, 0.04)',         // Subtle border
          selected: 'rgba(224, 232, 255, 0.1)',     // Selected state border
        },
        text: {
          primary: '#FFFFFF',                       // Primary text
          secondary: 'rgba(255, 255, 255, 0.6)',    // Secondary text
          dim: 'rgba(224, 232, 255, 0.3)',          // Dimmed text
          muted: 'rgba(255, 255, 255, 0.4)',        // Muted text
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
        mono: ['JetBrains Mono', 'Menlo', 'Monaco', 'Courier New', 'monospace'],
      },
      fontSize: {
        // Fluid typography with clamp() - scales between mobile and desktop
        'fluid-xs': ['clamp(0.75rem, 0.7rem + 0.25vw, 0.875rem)', { lineHeight: '1.4' }],
        'fluid-sm': ['clamp(0.875rem, 0.85rem + 0.125vw, 1rem)', { lineHeight: '1.5' }],
        'fluid-base': ['clamp(1rem, 0.95rem + 0.25vw, 1.125rem)', { lineHeight: '1.6' }],
        'fluid-lg': ['clamp(1.125rem, 1.05rem + 0.375vw, 1.25rem)', { lineHeight: '1.5' }],
        'fluid-xl': ['clamp(1.25rem, 1.15rem + 0.5vw, 1.5rem)', { lineHeight: '1.4' }],
        'fluid-2xl': ['clamp(1.5rem, 1.3rem + 1vw, 2rem)', { lineHeight: '1.3' }],
        'fluid-3xl': ['clamp(1.875rem, 1.5rem + 1.875vw, 2.5rem)', { lineHeight: '1.2' }],

        // Fixed sizes for precise control
        h1: ['32px', { lineHeight: '1.2', fontWeight: '700' }],
        h2: ['24px', { lineHeight: '1.3', fontWeight: '600' }],
        h3: ['18px', { lineHeight: '1.4', fontWeight: '600' }],
        h4: ['16px', { lineHeight: '1.4', fontWeight: '600' }],
        body: ['14px', { lineHeight: '1.6', fontWeight: '400' }],
        label: ['13px', { lineHeight: '1.4', fontWeight: '400' }],
        small: ['12px', { lineHeight: '1.4', fontWeight: '400' }],
        button: ['14px', { lineHeight: '1.4', fontWeight: '600' }],
      },
      spacing: {
        // 4px/8px grid system (professional spacing scale)
        '0.5': '2px',
        '1': '4px',
        '1.5': '6px',
        '2': '8px',
        '2.5': '10px',
        '3': '12px',
        '3.5': '14px',
        '4': '16px',
        '5': '20px',
        '6': '24px',
        '7': '28px',
        '8': '32px',
        '9': '36px',
        '10': '40px',
        '11': '44px', // Touch target size
        '12': '48px',
        '14': '56px',
        '16': '64px',
        '18': '72px',
        '20': '80px',
        '24': '96px',
        '28': '112px',
        '32': '128px',
        '36': '144px',
        '40': '160px',
        '44': '176px',
        '48': '192px',
        '52': '208px',
        '56': '224px',
        '60': '240px',
        '64': '256px',
        '72': '288px',
        '80': '320px',
        '96': '384px',

        // Safe area spacing
        'safe-top': 'var(--safe-area-top)',
        'safe-bottom': 'var(--safe-area-bottom)',
        'safe-left': 'var(--safe-area-left)',
        'safe-right': 'var(--safe-area-right)',
      },
      borderRadius: {
        btn: '4px',
        card: '8px',
        modal: '8px',
        pill: '9999px',
        'game-card': '12px',
      },
      boxShadow: {
        'connect-btn': '0px 4px 12px rgba(0, 0, 0, 0.1)',
        card: '0px 4px 12px rgba(0, 0, 0, 0.1)',
        dialog: '0px 8px 32px rgba(0, 0, 0, 0.32)',
        'card-hover': '0px 2px 6px rgba(0, 0, 0, 0.24)',
        'btn-hover': '0px 4px 12px rgba(0, 0, 0, 0.2)',
        'inner-glow': 'inset 0 0 8px rgba(141, 82, 218, 0.3)',
      },
      animation: {
        // Existing animations
        'slide-in': 'slideIn 0.3s ease-out',
        'fade-in': 'fadeIn 0.2s ease-out',
        'bounce-in': 'bounceIn 0.5s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
        'flash-green': 'flashGreen 2s ease-out',
        'flash-red': 'flashRed 2s ease-out',
        'pulse-slow': 'pulse 3s infinite',
        'slideUp': 'slideUp 0.3s ease-out',

        // Additional smooth animations
        'spin-slow': 'spin 3s linear infinite',
        'ping-slow': 'ping 2s cubic-bezier(0, 0, 0.2, 1) infinite',
        'slide-down': 'slideDown 0.3s ease-out',
        'slide-left': 'slideLeft 0.3s ease-out',
        'slide-right': 'slideRight 0.3s ease-out',
        'fade-in-up': 'fadeInUp 0.4s ease-out',
        'fade-out': 'fadeOut 0.2s ease-out',
        'skeleton': 'skeleton-pulse 1.5s ease-in-out infinite',
      },
      keyframes: {
        slideIn: {
          from: { transform: 'translateX(100%)' },
          to: { transform: 'translateX(0)' },
        },
        slideDown: {
          from: { transform: 'translateY(-100%)', opacity: '0' },
          to: { transform: 'translateY(0)', opacity: '1' },
        },
        slideLeft: {
          from: { transform: 'translateX(-100%)', opacity: '0' },
          to: { transform: 'translateX(0)', opacity: '1' },
        },
        slideRight: {
          from: { transform: 'translateX(100%)', opacity: '0' },
          to: { transform: 'translateX(0)', opacity: '1' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        fadeOut: {
          from: { opacity: '1' },
          to: { opacity: '0' },
        },
        fadeInUp: {
          from: { opacity: '0', transform: 'translateY(20px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        bounceIn: {
          '0%': { transform: 'scale(0.9)', opacity: '0' },
          '50%': { transform: 'scale(1.05)' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        scaleIn: {
          from: { transform: 'scale(0)', opacity: '0' },
          to: { transform: 'scale(1)', opacity: '1' },
        },
        flashGreen: {
          '0%': { backgroundColor: 'rgba(48, 224, 0, 0.25)' },
          '100%': { backgroundColor: 'transparent' },
        },
        flashRed: {
          '0%': { backgroundColor: 'rgba(255, 73, 74, 0.25)' },
          '100%': { backgroundColor: 'transparent' },
        },
        slideUp: {
          from: { transform: 'translateY(100%)', opacity: '0' },
          to: { transform: 'translateY(0)', opacity: '1' },
        },
        pulse: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
        'skeleton-pulse': {
          '0%, 100%': { opacity: '0.4' },
          '50%': { opacity: '0.7' },
        },
      },
      transitionDuration: {
        '0': '0ms',
        '75': '75ms',
        '100': '100ms',
        '150': '150ms',
        '200': '200ms',
        '300': '300ms',
        '500': '500ms',
        '700': '700ms',
        '1000': '1000ms',
      },
      transitionTimingFunction: {
        'in-expo': 'cubic-bezier(0.95, 0.05, 0.795, 0.035)',
        'out-expo': 'cubic-bezier(0.19, 1, 0.22, 1)',
        'bounce': 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
      },
      zIndex: {
        '1': '1',
        '10': '10',
        '20': '20',
        '30': '30',
        '40': '40',
        '50': '50',
        'dropdown': '1000',
        'sticky': '1020',
        'fixed': '1030',
        'modal-backdrop': '1040',
        'modal': '1050',
        'popover': '1060',
        'tooltip': '1070',
      },
      minHeight: {
        'touch': '44px', // WCAG touch target minimum
        'touch-sm': '36px',
        'touch-lg': '48px',
      },
      minWidth: {
        'touch': '44px', // WCAG touch target minimum
        'touch-sm': '36px',
        'touch-lg': '48px',
      },
    },
  },
  plugins: [
    // Custom plugin for safe-area utilities
    function ({ addUtilities }: any) {
      const newUtilities = {
        '.pt-safe': {
          paddingTop: 'env(safe-area-inset-top, 0px)',
        },
        '.pb-safe': {
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        },
        '.pl-safe': {
          paddingLeft: 'env(safe-area-inset-left, 0px)',
        },
        '.pr-safe': {
          paddingRight: 'env(safe-area-inset-right, 0px)',
        },
        '.px-safe': {
          paddingLeft: 'env(safe-area-inset-left, 0px)',
          paddingRight: 'env(safe-area-inset-right, 0px)',
        },
        '.py-safe': {
          paddingTop: 'env(safe-area-inset-top, 0px)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        },
        '.mt-safe': {
          marginTop: 'env(safe-area-inset-top, 0px)',
        },
        '.mb-safe': {
          marginBottom: 'env(safe-area-inset-bottom, 0px)',
        },
        '.ml-safe': {
          marginLeft: 'env(safe-area-inset-left, 0px)',
        },
        '.mr-safe': {
          marginRight: 'env(safe-area-inset-right, 0px)',
        },
      };
      addUtilities(newUtilities);
    },
  ],
};

export default config;
