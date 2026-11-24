/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Viral Instagram invitation palette: mint-ivory backgrounds,
        // deep emerald text and buttons, sage-green section washes,
        // champagne gold kept only as the shining accent.
        gold: { DEFAULT: '#D6B56D', light: '#E8D5A8', dark: '#A8873F' },
        mint: '#F2F8F1',
        sage: { DEFAULT: '#E4EFE3', light: '#EDF4EC', dark: '#52705C' },
        emerald: { DEFAULT: '#0F5132', light: '#1B7A4D', dark: '#0A3D24' },
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
