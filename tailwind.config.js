/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        gold: { DEFAULT: '#D6B56D', light: '#E8D5A8', dark: '#A8873F' },
        ivory: '#FFF9F0',
        cream: '#F6EBDD',
        brown: { DEFAULT: '#49372F', light: '#6B5348' },
        rose: { DEFAULT: '#D9A6A0', light: '#F2D7D3' },
      },
      fontFamily: {
        serif: ['"Cormorant Garamond"', 'Georgia', "'Times New Roman'", 'serif'],
        script: ['"Great Vibes"', '"Cormorant Garamond"', 'cursive'],
        sans: ['Jost', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
