/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',

  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'brand': {
          sidebar: '#f8f9fa', // Light gray background for sidebar like the template
          sidebarHover: '#e9ecef',
          bg: '#f3f4f6', // Light grayish background for the main wrapper
          card: '#ffffff',
          accent: '#fd7e14', // Bright orange primary color
          accentDark: '#e8590c',
          text: '#212529',
          muted: '#6c757d',
          border: '#e9ecef',
        },
        'jio-blue': {
          50:  '#e6eef7',
          100: '#ccddef',
          200: '#99bbdf',
          300: '#6699cf',
          400: '#3377bf',
          500: '#0052A5',
          600: '#004284',
          700: '#003163',
          800: '#002142',
          900: '#001021',
        },
        'jio-red': {
          50:  '#fde8ea',
          100: '#fbd1d5',
          200: '#f7a3ab',
          300: '#f37581',
          400: '#ef4757',
          500: '#E30613',
          600: '#b6050f',
          700: '#88040b',
          800: '#5b0208',
          900: '#2d0104',
        },
      },
      fontFamily: {
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(0, 82, 165, 0.12)',
        'card': '0 4px 24px rgba(0, 0, 0, 0.08)',
      },
      backgroundImage: {
        'gradient-jio': 'linear-gradient(135deg, #0052A5 0%, #003163 100%)',
        'gradient-danger': 'linear-gradient(135deg, #E30613 0%, #88040b 100%)',
      }
    },
  },
  plugins: [],
}
