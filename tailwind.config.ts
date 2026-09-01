import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#14171A',
        surface: {
          DEFAULT: '#1E2226',
          raised: '#262B30',
          border: '#333A42',
          muted: '#181B1E',
        },
        foreground: {
          DEFAULT: '#E8E3DA',
          muted: '#8E99A2',
          subtle: '#5C646D',
        },
        accent: {
          amber: '#D98A2B',
          red: '#C4472F',
          teal: '#3E7C79',
          cyan: '#00E5FF',
          green: '#2ECC71',
        },
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
