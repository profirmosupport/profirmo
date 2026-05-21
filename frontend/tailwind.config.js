/** @type {import('tailwindcss').Config} */

// Pro Firmo brand palette
//   Primary  #D97706 (hover #B45309, light #FFEDD5, bg #FFF7ED)
//   Secondary (dark) #111827 / soft #1F2937
//   AI accent #14B8A6 (light #CCFBF1)
//   Neutrals: warm gray — text #111827, muted #6B7280, border #E5E7EB
// Legacy color names are remapped to this palette so the whole app is
// themed from this single file.

const primary = {
  50: '#fff7ed',
  100: '#ffedd5',
  200: '#fed7aa',
  300: '#fdba74',
  400: '#fb923c',
  500: '#f59e0b',
  600: '#d97706',
  700: '#b45309',
  800: '#92400e',
  900: '#78350f',
  950: '#451a03',
};

const teal = {
  50: '#f0fdfa',
  100: '#ccfbf1',
  200: '#99f6e4',
  300: '#5eead4',
  400: '#2dd4bf',
  500: '#14b8a6',
  600: '#0d9488',
  700: '#0f766e',
  800: '#115e59',
  900: '#134e4a',
  950: '#042f2e',
};

const gray = {
  50: '#f9fafb',
  100: '#f3f4f6',
  200: '#e5e7eb',
  300: '#d1d5db',
  400: '#9ca3af',
  500: '#6b7280',
  600: '#4b5563',
  700: '#374151',
  800: '#1f2937',
  900: '#111827',
  950: '#111827',
};

module.exports = {
  content: ['./app/**/*.{js,jsx}', './components/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary,
        accent: teal,
        teal,
        gray,
        // Primary (amber) family
        brand: primary,
        orange: primary,
        blue: primary,
        indigo: primary,
        sky: primary,
        purple: primary,
        violet: primary,
        // AI accent (teal) family
        green: teal,
        emerald: teal,
        cyan: teal,
        // Warm-gray neutrals
        slate: gray,
      },
      fontFamily: {
        sans: [
          'var(--font-inter)',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'sans-serif',
        ],
      },
      boxShadow: {
        glow: '0 0 55px -16px rgba(217, 119, 6, 0.45)',
        'glow-sm': '0 0 30px -12px rgba(217, 119, 6, 0.40)',
        'glow-cyan': '0 0 48px -16px rgba(20, 184, 166, 0.42)',
        card: '0 12px 40px -18px rgba(17, 24, 39, 0.16)',
        'card-lg': '0 26px 60px -26px rgba(17, 24, 39, 0.22)',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-14px)' },
        },
        floatSlow: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-24px)' },
        },
        pulseGlow: {
          '0%, 100%': { opacity: '0.4', transform: 'scale(1)' },
          '50%': { opacity: '0.85', transform: 'scale(1.07)' },
        },
        marquee: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        gradientShift: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(22px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        typingDot: {
          '0%, 60%, 100%': { opacity: '0.25', transform: 'translateY(0)' },
          '30%': { opacity: '1', transform: 'translateY(-3px)' },
        },
        spinSlow: {
          to: { transform: 'rotate(360deg)' },
        },
        riseBar: {
          '0%': { transform: 'scaleY(0.2)' },
          '100%': { transform: 'scaleY(1)' },
        },
      },
      animation: {
        float: 'float 6s ease-in-out infinite',
        'float-slow': 'floatSlow 9s ease-in-out infinite',
        'pulse-glow': 'pulseGlow 5s ease-in-out infinite',
        marquee: 'marquee 38s linear infinite',
        gradient: 'gradientShift 8s ease infinite',
        shimmer: 'shimmer 2.6s linear infinite',
        'fade-up': 'fadeUp 0.7s ease-out both',
        typing: 'typingDot 1.4s ease-in-out infinite',
        'spin-slow': 'spinSlow 22s linear infinite',
        'rise-bar': 'riseBar 1.1s ease-out both',
      },
      backgroundSize: {
        200: '200% 200%',
      },
    },
  },
  plugins: [],
};
