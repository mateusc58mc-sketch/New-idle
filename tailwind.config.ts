import type { Config } from 'tailwindcss';

/**
 * Tema dark/fantasy. Os tokens de raridade vivem em `src/styles/rarity.css`
 * como CSS variables para poderem ser lidos pelo Paperdoll (glow) sem passar
 * por classes condicionais no JS.
 */
const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        void: {
          950: '#07070c',
          900: '#0b0b14',
          800: '#12121f',
          700: '#1a1a2e',
          600: '#242440',
        },
        arcane: {
          400: '#7dd3fc',
          500: '#38bdf8',
          600: '#0ea5e9',
        },
        ember: {
          400: '#fb923c',
          500: '#f97316',
          600: '#ea580c',
        },
        rarity: {
          common: 'rgb(var(--rarity-common) / <alpha-value>)',
          uncommon: 'rgb(var(--rarity-uncommon) / <alpha-value>)',
          rare: 'rgb(var(--rarity-rare) / <alpha-value>)',
          epic: 'rgb(var(--rarity-epic) / <alpha-value>)',
          legendary: 'rgb(var(--rarity-legendary) / <alpha-value>)',
          mythic: 'rgb(var(--rarity-mythic) / <alpha-value>)',
        },
      },
      fontFamily: {
        display: ['var(--font-display)', 'Georgia', 'serif'],
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'glow-common': '0 0 8px 0 rgb(var(--rarity-common) / 0.35)',
        'glow-rare': '0 0 12px 0 rgb(var(--rarity-rare) / 0.45)',
        'glow-epic': '0 0 16px 2px rgb(var(--rarity-epic) / 0.5)',
        'glow-legendary': '0 0 22px 4px rgb(var(--rarity-legendary) / 0.55)',
        'glow-mythic': '0 0 28px 6px rgb(var(--rarity-mythic) / 0.6)',
      },
      keyframes: {
        'float-up': {
          '0%': { transform: 'translateY(0)', opacity: '1' },
          '100%': { transform: 'translateY(-48px)', opacity: '0' },
        },
        'pulse-slow': {
          '0%, 100%': { opacity: '0.6' },
          '50%': { opacity: '1' },
        },
        'hp-drain': {
          '0%': { width: 'var(--hp-from)' },
          '100%': { width: 'var(--hp-to)' },
        },
      },
      animation: {
        'float-up': 'float-up 900ms ease-out forwards',
        'pulse-slow': 'pulse-slow 2.4s ease-in-out infinite',
        'hp-drain': 'hp-drain 240ms ease-out',
      },
    },
  },
  plugins: [],
};

export default config;
