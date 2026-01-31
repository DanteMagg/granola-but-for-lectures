/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Modern Tech Palette
        background: '#ffffff',
        foreground: '#09090b', // zinc-950
        
        primary: {
          DEFAULT: '#18181b', // zinc-900
          foreground: '#fafafa', // zinc-50
          hover: '#27272a', // zinc-800
        },
        
        secondary: {
          DEFAULT: '#f4f4f5', // zinc-100
          foreground: '#18181b', // zinc-900
          hover: '#e4e4e7', // zinc-200
        },
        
        muted: {
          DEFAULT: '#f4f4f5', // zinc-100
          foreground: '#71717a', // zinc-500
        },
        
        accent: {
          DEFAULT: '#f4f4f5', // zinc-100
          foreground: '#18181b', // zinc-900
        },
        
        destructive: {
          DEFAULT: '#ef4444', // red-500
          foreground: '#fafafa', // zinc-50
        },
        
        border: '#e4e4e7', // zinc-200
        input: '#e4e4e7', // zinc-200
        ring: '#18181b', // zinc-900
        
        // Semantic aliases for the old code to transition smoothly
        // We map the old "earthy" colors to the new "tech" palette
        cream: {
          50: '#ffffff',
          100: '#fafafa', // zinc-50
          200: '#f4f4f5', // zinc-100
          300: '#e4e4e7', // zinc-200
          400: '#d4d4d8', // zinc-300
          500: '#a1a1aa', // zinc-400
        },
        sage: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e', // green-500 (keep green for success/active states but cleaner)
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
        },
        // Re-mapping ink to zinc for neutral grays
        ink: {
          50: '#fafafa',
          100: '#f4f4f5',
          200: '#e4e4e7',
          300: '#d4d4d8',
          400: '#a1a1aa',
          500: '#71717a',
          600: '#52525b',
          700: '#3f3f46',
          800: '#27272a',
          900: '#18181b',
        },
        // Bark is mostly used for accents, let's map it to zinc or a warm gray if needed, 
        // but for "tech" we usually want cool neutrals.
        bark: {
          400: '#a1a1aa',
          600: '#52525b',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Inter', 'system-ui', 'sans-serif'], // Unify fonts for cleaner look
        mono: ['JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        'sm': '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        'DEFAULT': '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
        'md': '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
        'lg': '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
        'xl': '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
        'inner': 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-in-right': 'slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        'pulse-subtle': 'pulseSubtle 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(8px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideInRight: {
          '0%': { transform: 'translateX(16px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        pulseSubtle: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.8' },
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
