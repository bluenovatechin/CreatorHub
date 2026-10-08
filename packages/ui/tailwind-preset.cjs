/** Bluenova design tokens. Shared by web and admin. */
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#1647D8', hover: '#0F37AE', soft: '#EAF0FE',
          50: '#F3F6FF', 100: '#E4EBFF', 200: '#C6D4FE', 300: '#9DB4FC', 400: '#6386F5', 500: '#3461EA',
          600: '#1647D8', 700: '#0F37AE', 800: '#0E2E8A', 900: '#0B1F4D',
        },
        navy: { DEFAULT: '#0B1F4D', light: '#14306E' },
        accent: { DEFAULT: '#00A99D', hover: '#008F85', soft: '#E0F5F3' },
        sun: { DEFAULT: '#F5A524', soft: '#FFF4DE' },
        bg: '#F6F8FC',
        surface: '#FFFFFF',
        ink: { DEFAULT: '#0F172A', muted: '#5B6476', faint: '#94A0B4' },
        line: { DEFAULT: '#E3E8F0', strong: '#CBD3E1' },
        success: { DEFAULT: '#15803D', soft: '#DCFCE7' },
        warning: { DEFAULT: '#B45309', soft: '#FEF3C7' },
        danger: { DEFAULT: '#DC2626', soft: '#FEE2E2' },
        info: { DEFAULT: '#0369A1', soft: '#E0F2FE' },
      },
      fontFamily: {
        sans: ['Inter', '"Noto Sans Gujarati"', 'system-ui', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', '"Noto Sans Gujarati"', 'Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: { card: '18px', ctl: '12px' },
      boxShadow: {
        card: '0 1px 2px rgba(15,23,42,.04), 0 6px 24px -8px rgba(15,23,42,.08)',
        lift: '0 2px 4px rgba(15,23,42,.05), 0 18px 40px -12px rgba(22,71,216,.25)',
        btn: '0 1px 2px rgba(15,23,42,.08), 0 4px 12px -4px rgba(22,71,216,.45)',
      },
      maxWidth: { content: '1200px' },
      backgroundImage: {
        'hero-glow': 'radial-gradient(60% 60% at 80% 10%, rgba(52,97,234,.18) 0%, rgba(52,97,234,0) 70%), radial-gradient(50% 50% at 0% 100%, rgba(0,169,157,.14) 0%, rgba(0,169,157,0) 70%)',
        'brand-gradient': 'linear-gradient(135deg, #0B1F4D 0%, #1647D8 60%, #3461EA 100%)',
      },
      keyframes: {
        'fade-up': { '0%': { opacity: '0', transform: 'translateY(8px)' }, '100%': { opacity: '1', transform: 'none' } },
      },
      animation: { 'fade-up': 'fade-up .35s ease-out both' },
    },
  },
};
