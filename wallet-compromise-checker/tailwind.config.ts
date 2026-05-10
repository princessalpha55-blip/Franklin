import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{js,ts,jsx,tsx}', './components/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: '#060606',
        panel: '#111111',
        border: '#303030',
        success: '#00ff8c',
        warning: '#ffd24d',
        danger: '#ff3d00',
      },
    },
  },
  plugins: [],
};

export default config;
