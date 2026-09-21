/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './layout/**/*.liquid',
    './sections/**/*.liquid',
    './snippets/**/*.liquid',
    './blocks/**/*.liquid',
    './templates/**/*.liquid',
    './templates/**/*.json',
  ],
  theme: {
    extend: {
      colors: {
        background: 'var(--color-background)',
        foreground: 'var(--color-foreground)',
        accent: 'var(--color-accent)',
        muted: 'var(--color-muted)',
      },
      fontFamily: {
        primary: ['Oswald', 'sans-serif'],
      },
      maxWidth: {
        page: 'var(--page-width)',
      },
      spacing: {
        page: 'var(--page-margin)',
      },
      borderRadius: {
        input: 'var(--style-border-radius-inputs)',
        pill: '50px',
      },
      boxShadow: {
        hard: '4px 4px 0 var(--color-foreground)',
        small: '1px 1px 0 var(--color-foreground)',
      },
      keyframes: {
        'hero-marquee': {
          from: { transform: 'translateX(0)' },
          to: { transform: 'translateX(-50%)' },
        },
        'gallery-scroll-up': {
          from: { transform: 'translateY(0)' },
          to: { transform: 'translateY(-50%)' },
        },
        'gallery-scroll-down': {
          from: { transform: 'translateY(-50%)' },
          to: { transform: 'translateY(0)' },
        },
      },
      animation: {
        'hero-marquee': 'hero-marquee 22s linear infinite',
        'gallery-up': 'gallery-scroll-up 30s linear infinite',
        'gallery-down': 'gallery-scroll-down 30s linear infinite',
      },
    },
  },
  plugins: [],
}
