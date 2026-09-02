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
        // Light theme. `red` and `teal` pass WCAG AA (4.5:1+) as text
        // directly against white unmodified — the reverse of the dark
        // theme, where they needed lightened Text variants. `amber`,
        // `cyan`, and `green` don't (2.1-2.8:1 on white) and are darkened
        // here; redText/tealText alias to their base color since a
        // separate lighter shade is no longer needed on a light surface.
        background: '#F6F7F9',
        surface: {
          DEFAULT: '#FFFFFF',
          raised: '#EEF0F3',
          border: '#DDE1E6',
          muted: '#F1F2F5',
        },
        foreground: {
          DEFAULT: '#1B1F24',
          muted: '#5B6470',
          subtle: '#6B7280',
        },
        accent: {
          amber: '#B8650E',
          red: '#C4472F',
          redText: '#C4472F',
          teal: '#3E7C79',
          tealText: '#3E7C79',
          cyan: '#0B7C8F',
          green: '#178048',
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
