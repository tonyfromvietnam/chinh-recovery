/** @type {import('tailwindcss').Config} */
// Colours point at CSS variables set per theme in src/index.css (the same four themes as
// www.duychinhdinh.com), so every existing class follows the active theme.
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;
const scale = (name, steps) => Object.fromEntries(steps.map((s) => [s, v(`${name}-${s}`)]));

export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        white: v("white"),
        slate: scale("slate", [100, 200, 300, 400, 500, 600, 700, 800, 900, 950]),
        cyan: scale("cyan", [100, 200, 300, 400, 500]),
        emerald: scale("emerald", [100, 200, 300, 400]),
        amber: scale("amber", [200, 300]),
        rose: scale("rose", [300, 400]),
        violet: scale("violet", [100, 200, 300]),
        page: v("page"),
        surface: v("surface"),
        edge: v("edge"),
      },
      fontFamily: {
        display: ['"Geist"', "system-ui", "sans-serif"],
        mono: ['"Geist Mono"', "ui-monospace", "monospace"],
        sans: ['"Geist"', "system-ui", "sans-serif"],
      },
      // Sharp corners, like the homepage's tiles
      borderRadius: { md: "4px", lg: "4px", xl: "6px", "2xl": "6px", "3xl": "8px" },
    },
  },
  plugins: [],
};
