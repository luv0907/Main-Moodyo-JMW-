import type { Config } from 'tailwindcss';

const config = {
  darkMode: ['class'],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  prefix: '',
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px',
      },
    },
    extend: {
      fontFamily: {
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
        display: ['Clash Display', 'sans-serif'],
      },
      colors: {
        /* === ELEVATED CREAM BASE === */
        'cream': '#F9F8F4',
        'cream-surface': '#FFFFFF',
        'cream-card': '#F2EFE8',
        'cream-elevated': '#FFFFFF',

        /* === MOOD AURA COLORS (via CSS vars) === */
        'mood-primary': 'var(--mood-primary)',
        'mood-secondary': 'var(--mood-secondary)',

        /* === SHADCN COMPATIBILITY === */
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      borderRadius: {
        'pill': '9999px',
        lg: 'var(--radius-lg)',
        md: 'var(--radius-md)',
        sm: 'var(--radius-sm)',
        xl: 'var(--radius-xl)',
        DEFAULT: 'var(--radius)',
      },
      spacing: {
        'page-padding': 'var(--page-padding)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        'aura-pulse': {
          '0%, 100%': { transform: 'scale(1.0)', opacity: '0.7' },
          '50%': { transform: 'scale(1.08)', opacity: '1.0' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'ping-gentle': {
          '0%': { transform: 'scale(1)', opacity: '0.5' },
          '70%, 100%': { transform: 'scale(1.5)', opacity: '0' },
        },
        'rotate-ring': {
          from: { transform: 'rotate(0deg)' },
          to: { transform: 'rotate(360deg)' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'aura-pulse': 'aura-pulse 4s ease-in-out infinite',
        'float': 'float 3s ease-in-out infinite',
        'shimmer': 'shimmer 1.5s infinite',
        'ping-gentle': 'ping-gentle 2s ease-out infinite',
        'rotate-ring': 'rotate-ring 4s linear infinite',
      },
      backdropBlur: {
        xs: '2px',
      },
      screens: {
        'xs': '375px',
        '3xl': '1800px',
        '4k': '2560px',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
} satisfies Config;

export default config;
