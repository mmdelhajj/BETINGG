import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        background: {
          DEFAULT: '#0D1117',
          card: '#161B22',
          elevated: '#1C2128',
          hover: '#21262D',
        },
        accent: {
          DEFAULT: '#8B5CF6',
          hover: '#7C3AED',
          light: '#A78BFA',
        },
        success: {
          DEFAULT: '#10B981',
          light: '#34D399',
        },
        danger: {
          DEFAULT: '#EF4444',
          light: '#F87171',
        },
        warning: {
          DEFAULT: '#F59E0B',
          light: '#FBBF24',
        },
        info: {
          DEFAULT: '#3B82F6',
          light: '#60A5FA',
        },
        border: {
          DEFAULT: '#30363D',
          light: '#484F58',
        },
        text: {
          DEFAULT: '#E6EDF3',
          secondary: '#8B949E',
          muted: '#6E7681',
        },
        gold: '#FFD700',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        card: '8px',
        button: '6px',
        input: '4px',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'fade-in': 'fadeIn 0.2s ease-out',
        'spin-slow': 'spin 3s linear infinite',
        'bounce-in': 'bounceIn 0.5s ease-out',
        'flash-green': 'flashGreen 0.5s ease-out',
        'flash-red': 'flashRed 0.5s ease-out',
        'score-flash': 'scoreFlash 1.5s ease-out',
        'score-pop': 'scorePop 1.5s ease-out',
        'live-pulse': 'livePulse 2s ease-in-out infinite',
        'slide-up-panel': 'slideUpPanel 0.3s ease-out',
      },
      keyframes: {
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        bounceIn: {
          '0%': { transform: 'scale(0.3)', opacity: '0' },
          '50%': { transform: 'scale(1.05)' },
          '70%': { transform: 'scale(0.9)' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        flashGreen: {
          '0%': { backgroundColor: 'rgba(16,185,129,0.3)' },
          '100%': { backgroundColor: 'transparent' },
        },
        flashRed: {
          '0%': { backgroundColor: 'rgba(239,68,68,0.3)' },
          '100%': { backgroundColor: 'transparent' },
        },
        scoreFlash: {
          '0%': { borderColor: 'rgba(16,185,129,0.8)', boxShadow: '0 0 12px rgba(16,185,129,0.4)' },
          '50%': { borderColor: 'rgba(16,185,129,0.4)', boxShadow: '0 0 6px rgba(16,185,129,0.2)' },
          '100%': { borderColor: 'rgba(48,54,61,1)', boxShadow: 'none' },
        },
        scorePop: {
          '0%': { transform: 'scale(1)', textShadow: '0 0 0px transparent' },
          '15%': { transform: 'scale(1.3)', textShadow: '0 0 12px rgba(16,185,129,0.8)' },
          '40%': { transform: 'scale(1.15)', textShadow: '0 0 8px rgba(16,185,129,0.5)' },
          '100%': { transform: 'scale(1)', textShadow: '0 0 0px transparent' },
        },
        livePulse: {
          '0%': { opacity: '1' },
          '50%': { opacity: '0.4' },
          '100%': { opacity: '1' },
        },
        slideUpPanel: {
          '0%': { transform: 'translateY(100%)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
