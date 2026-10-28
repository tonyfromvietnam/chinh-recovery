/* Colour themes shared with www.duychinhdinh.com: same names, same palettes, same saved choice.
   CHINH runs under that domain (/chinh-recovery), so a theme picked on the homepage carries over here.
   Tailwind classes follow the theme through CSS variables (src/index.css, tailwind.config.js).
   Colours set in code (charts, rings, status colours) go through `tone()`, which swaps the original
   dark palette for the active theme's; the dashboard re-renders on every theme change. */

export const THEMES = [
  { id: "sand", name: "Sand", bg: "#ece4d6", fg: "#b4471b" },
  { id: "linen", name: "Linen", bg: "#e7e3d7", fg: "#2f6b4a" },
  { id: "espresso", name: "Espresso", bg: "#12100d", fg: "#e6c38e" },
  { id: "night", name: "Night", bg: "#07080a", fg: "#2ff0a0" },
];
export const DEFAULT_THEME = "sand";
export const THEME_KEY = "theme";

// Original dark-palette colour → the same role in each theme
const ROLES = {
  "#22d3ee": "accent", "#22e58b": "high", "#fb5a6e": "restore", "#facc15": "balanced", "#fbbf24": "sun",
  "#a78bfa": "violet", "#94a3b8": "muted", "#5eead4": "teal", "#f97316": "orange", "#fda4af": "rose",
  "#818cf8": "indigo", "#6366f1": "indigoDeep", "#38bdf8": "sky", "#f472b6": "pink", "#64748b": "axis",
  "#0f172a": "surface", "#0b1220": "onFill", "#f1f5f9": "text", "rgba(255,255,255,0.1)": "edge",
};

const PALETTES = {
  sand: { accent: "#b4471b", high: "#2f7a4a", restore: "#b8332f", balanced: "#a0700c", sun: "#a8640a", violet: "#6d4bb3",
    muted: "#6c6355", teal: "#2a7a70", orange: "#b4531b", rose: "#b5485e", indigo: "#4a4fb0", indigoDeep: "#3b3f99",
    sky: "#2e5d86", pink: "#a83f7a", axis: "#6c6355", surface: "#f6f1e7", onFill: "#fff7ec", text: "#1d1a16", edge: "#d0c3ad" },
  linen: { accent: "#2f6b4a", high: "#2f7a4a", restore: "#b03a30", balanced: "#9a6a0c", sun: "#9a6510", violet: "#66509f",
    muted: "#666a5d", teal: "#2a7068", orange: "#a8561c", rose: "#a84a5c", indigo: "#4a529f", indigoDeep: "#3a428a",
    sky: "#2e5a80", pink: "#9c4274", axis: "#666a5d", surface: "#f4f1e8", onFill: "#f4f1e8", text: "#1a1c17", edge: "#cbc4b1" },
  espresso: { accent: "#e6c38e", high: "#8fd3a8", restore: "#ef7a6a", balanced: "#f0b85a", sun: "#eba066", violet: "#c4a6e8",
    muted: "#9d917f", teal: "#9fc8b5", orange: "#eba066", rose: "#f0a8a0", indigo: "#a9a6e8", indigoDeep: "#8b86d8",
    sky: "#9fc8b5", pink: "#e8a0c0", axis: "#8a7f6f", surface: "#1b1713", onFill: "#1b140a", text: "#f2eadc", edge: "#352d23" },
  night: { accent: "#2ff0a0", high: "#2ff0a0", restore: "#ff5c72", balanced: "#ffd34d", sun: "#ffb84d", violet: "#b4a0ff",
    muted: "#8a929c", teal: "#5eead4", orange: "#ff8a3d", rose: "#fda4af", indigo: "#818cf8", indigoDeep: "#6366f1",
    sky: "#5ccbff", pink: "#f472b6", axis: "#6b7480", surface: "#0e1013", onFill: "#03140c", text: "#f4f6f8", edge: "#23272e" },
};

export const currentTheme = () => {
  const t = typeof document !== "undefined" ? document.documentElement.dataset.theme : null;
  return PALETTES[t] ? t : DEFAULT_THEME;
};

/* The active theme's version of an original palette colour (unknown colours pass through) */
export function tone(color) {
  const role = ROLES[String(color).toLowerCase()];
  return role ? PALETTES[currentTheme()][role] : color;
}

/* Remember and apply a theme; listeners (the dashboard) re-render on "themechange" */
export function applyTheme(id) {
  if (!PALETTES[id]) return;
  document.documentElement.dataset.theme = id;
  try { localStorage.setItem(THEME_KEY, id); } catch { /* storage unavailable */ }
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", THEMES.find((t) => t.id === id).bg);
  window.dispatchEvent(new Event("themechange"));
}
