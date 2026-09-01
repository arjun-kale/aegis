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
          // WCAG AA text-safe variant of `red` (4.55:1 on #1E2226 vs 3.27:1
          // for the base color). Use for readable text; keep `red` for
          // fills/borders/bars, which only need the 3:1 non-text threshold
          // and already clear it.
          redText: '#D06C59',
          teal: '#3E7C79',
          // WCAG AA text-safe variant of `teal` (4.50:1 on #1E2226 vs
          // 3.33:1 for the base color). Same rule as redText above.
          tealText: '#5D918E',
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
