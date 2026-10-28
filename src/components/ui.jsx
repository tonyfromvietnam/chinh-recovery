/* Shared building blocks for the dashboard and its cards. */
import React from "react";
import { Check, X } from "lucide-react";
import { tone } from "../theme.js";

export const Card = ({ className = "", children }) => (
  <section className={`chinh-tile ${className}`}>{children}</section>
);

export const Eyebrow = ({ children }) => (
  <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-slate-400">{children}</p>
);

export const CardHeader = ({ eyebrow, title, sub, right }) => (
  <div className="flex flex-wrap items-start justify-between gap-3">
    <div className="min-w-0">
      <Eyebrow>{eyebrow}</Eyebrow>
      {title && <h2 className="mt-1 font-display text-2xl font-semibold text-slate-100">{title}</h2>}
      {sub && <p className="text-xs text-slate-400">{sub}</p>}
    </div>
    {right}
  </div>
);

export function MiniRing({ pct, color }) {
  const r = 18, c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 44 44" className="h-11 w-11 -rotate-90">
      <circle cx="22" cy="22" r={r} fill="none" stroke="rgba(148,163,184,0.18)" strokeWidth="5" />
      <circle cx="22" cy="22" r={r} fill="none" stroke={tone(color)} strokeWidth="5" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - Math.max(0, Math.min(1, pct)))} style={{ transition: "stroke-dashoffset 500ms" }} />
    </svg>
  );
}

export function Checkbox({ checked, onChange, color = "#22e58b", label }) {
  return (
    <button type="button" role="checkbox" aria-checked={checked} aria-label={label} onClick={onChange}
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
      style={{ borderColor: checked ? tone(color) : "rgba(148,163,184,0.5)", background: checked ? tone(color) : "transparent" }}>
      {checked && <Check size={15} strokeWidth={3.5} color={tone("#0b1220")} />}
    </button>
  );
}

export function Modal({ eyebrow, title, onClose, children, labelId = "modal-title", wide = false }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/80 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose} role="dialog" aria-modal="true" aria-labelledby={labelId}>
      <div onClick={(e) => e.stopPropagation()}
        className={`max-h-[92vh] w-full ${wide ? "max-w-2xl" : "max-w-xl"} overflow-y-auto rounded-t-xl border border-edge bg-surface p-5 shadow-2xl sm:rounded-xl sm:p-7`}
        style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom, 0px))" }}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <Eyebrow>{eyebrow}</Eyebrow>
            <h2 id={labelId} className="mt-1 font-display text-3xl font-semibold text-slate-100">{title}</h2>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-full p-2 text-slate-400 hover:bg-white/5 hover:text-slate-100 focus-visible:ring-2 focus-visible:ring-cyan-300">
            <X size={20} />
          </button>
        </div>
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}

export function Chips({ options, value, onChange, label }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button key={String(o.value)} type="button" role="radio" aria-checked={active} onClick={() => onChange(o.value)}
            className={`rounded-lg border px-3 py-1.5 text-sm transition focus-visible:ring-2 focus-visible:ring-cyan-300 ${active
              ? "border-cyan-400/60 bg-cyan-400/15 text-cyan-100" : "border-white/10 text-slate-300 hover:bg-white/5"}`}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Field({ id, label, hint, children }) {
  return (
    <div>
      <label htmlFor={id} className="text-sm text-slate-300">{label}</label>
      <div className="mt-1">{children}</div>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export const inputClass = "w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 font-mono text-slate-100 outline-none focus:border-cyan-400/60";

export function RangeField({ id, label, value, min, max, step = 1, unit = "", onChange, hint }) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <label htmlFor={id} className="text-sm text-slate-300">{label}</label>
        <span className="font-mono text-sm tabular-nums text-cyan-300">{value}{unit}</span>
      </div>
      <input id={id} type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))} className="chinh-range mt-2 w-full" />
      {hint && <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-slate-500">{hint}</p>}
    </div>
  );
}

export const PrimaryButton = ({ children, onClick, type = "button", className = "" }) => (
  <button type={type} onClick={onClick}
    className={`flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-400 py-3 font-semibold text-slate-950 shadow-[0_8px_24px_-12px_rgb(var(--cyan-400))] transition hover:-translate-y-px hover:brightness-110 focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-page ${className}`}>
    {children}
  </button>
);

export const GhostButton = ({ children, onClick, className = "" }) => (
  <button type="button" onClick={onClick}
    className={`flex items-center justify-center gap-1.5 rounded-lg border border-cyan-400/40 bg-cyan-400/10 px-3 py-1.5 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-400/20 focus-visible:ring-2 focus-visible:ring-cyan-300 ${className}`}>
    {children}
  </button>
);

export const VERDICT_TONE = {
  helps: "text-emerald-300 bg-emerald-400/10",
  hurts: "text-rose-300 bg-rose-400/10",
  "no clear effect": "text-slate-300 bg-white/5",
  inconclusive: "text-slate-300 bg-white/5",
  "not enough data": "text-slate-500 bg-white/[0.03]",
};
