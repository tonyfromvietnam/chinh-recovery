/* Palette picker, the same as the homepage's: the chosen theme spreads out from the tapped swatch
   (View Transitions API) and is remembered, so CHINH and www.duychinhdinh.com stay on the same theme. */
import React, { useEffect, useRef, useState } from "react";
import { THEMES, currentTheme, applyTheme } from "../theme.js";

const Swatch = ({ t }) => (
  <span className="relative block h-6 w-6 shrink-0 overflow-hidden rounded-full border border-black/15" style={{ background: t.bg }} aria-hidden="true">
    <span className="absolute inset-y-0 right-0 w-1/2" style={{ background: t.fg }} />
  </span>
);

export default function ThemeSwitch() {
  const [theme, setTheme] = useState(currentTheme);
  const [open, setOpen] = useState(false);
  const box = useRef(null);

  useEffect(() => {
    const sync = () => setTheme(currentTheme());
    window.addEventListener("themechange", sync);
    return () => window.removeEventListener("themechange", sync);
  }, []);
  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (e.type === "keydown" ? e.key === "Escape" : !box.current?.contains(e.target)) setOpen(false); };
    window.addEventListener("pointerdown", close); window.addEventListener("keydown", close);
    return () => { window.removeEventListener("pointerdown", close); window.removeEventListener("keydown", close); };
  }, [open]);

  const pick = (id, e) => {
    setOpen(false);
    if (id === theme) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!document.startViewTransition || still) return applyTheme(id);
    const { clientX: x, clientY: y } = e;
    const r = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
    document.startViewTransition(() => applyTheme(id)).ready.then(() => {
      document.documentElement.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
        { duration: 650, easing: "cubic-bezier(.2,.7,.2,1)", pseudoElement: "::view-transition-new(root)" },
      );
    });
  };

  const current = THEMES.find((t) => t.id === theme) || THEMES[0];
  return (
    <div ref={box} className="relative">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="true" aria-label={`Colour theme: ${current.name}`}
        className="grid h-11 w-11 place-items-center rounded-md border border-white/10 transition hover:border-cyan-400/60 focus-visible:ring-2 focus-visible:ring-cyan-300">
        <Swatch t={current} />
      </button>
      {open && (
        <div role="radiogroup" aria-label="Colour theme" className="chinh-tile absolute right-0 top-[calc(100%+8px)] z-40 w-48 p-1.5 shadow-xl">
          {THEMES.map((t) => (
            <button key={t.id} type="button" role="radio" aria-checked={t.id === theme} onClick={(e) => pick(t.id, e)}
              className={`flex min-h-11 w-full items-center gap-3 rounded-md px-2.5 text-left text-sm font-medium transition hover:bg-white/[0.06] ${t.id === theme ? "text-slate-100" : "text-slate-300"}`}>
              <Swatch t={t} />
              <span className="flex-1">{t.name}</span>
              {t.id === theme && <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" aria-hidden="true" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
