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
        pink: {
          checker: '#f5b8c9',
        },
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
    },
  },
  plugins: [],
}
