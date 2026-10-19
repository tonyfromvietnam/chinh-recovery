/* M6 — Personal experiments: start one, follow today's condition, confirm, see the result. */
import React, { useMemo } from "react";
import { FlaskConical, Play, Square } from "lucide-react";
import { Card, CardHeader, GhostButton, VERDICT_TONE } from "./ui.jsx";
import { EXPERIMENTS, experimentById, experimentResult } from "../engine.js";

export default function ExperimentsCard({ active, today, assignment, complied, history, onStart, onStop, onComply }) {
  const exp = active ? experimentById(active.id) : null;
  const result = useMemo(() => (exp ? experimentResult(history, exp, today) : null), [exp, history, today]);

  if (!exp) {
    return (
      <Card className="p-5 sm:p-6">
        <CardHeader eyebrow="Personal experiments" title="Test what works for you" right={<FlaskConical size={20} className="text-cyan-300" />}
          sub="CHINH alternates two conditions and compares your mornings. One experiment at a time; about 2–4 weeks each." />
        <ul className="mt-4 space-y-2">
          {EXPERIMENTS.map((e) => (
            <li key={e.id} className="flex items-start justify-between gap-3 rounded-xl border border-white/[0.05] bg-slate-900/40 p-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-100">{e.title}</p>
                <p className="text-xs text-slate-400">{e.question}</p>
                <p className="mt-0.5 font-mono text-[11px] text-slate-500">Alternates by {e.unit}: {e.arms.join(" vs ")}</p>
              </div>
              <GhostButton onClick={() => onStart(e.id)}><Play size={14} /> Start</GhostButton>
            </li>
          ))}
        </ul>
      </Card>
    );
  }

  return (
    <Card className="p-5 sm:p-6">
      <CardHeader eyebrow={`Experiment · since ${active.start}`} title={exp.title} sub={exp.question}
        right={<GhostButton onClick={onStop}><Square size={14} /> Stop</GhostButton>} />
      <div className="mt-4 rounded-xl border border-cyan-400/20 bg-cyan-400/5 p-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-cyan-300">Today's condition</p>
        {assignment ? (
          <>
            <p className="mt-1 text-lg font-semibold text-slate-100">{assignment.label}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
              <span className="text-slate-400">Did you follow it?</span>
              {[true, false].map((v) => (
                <button key={String(v)} onClick={() => onComply(v)}
                  className={`rounded-lg border px-3 py-1 ${complied === v ? "border-cyan-400/60 bg-cyan-400/15 text-cyan-100" : "border-white/10 text-slate-300 hover:bg-white/5"}`}>
                  {v ? "Yes" : "No"}
                </button>
              ))}
              <span className="text-xs text-slate-500">Only followed days count.</span>
            </div>
          </>
        ) : (
          <p className="mt-1 text-sm text-slate-300">Not an experiment day (this one only runs on training days).</p>
        )}
      </div>
      <div className="mt-4">
        <p className="text-sm font-semibold text-slate-200">Result so far</p>
        <p className="font-mono text-[11px] text-slate-500">{exp.arms[0]}: {result.unitsA}/{result.needed} {exp.unit}s · {exp.arms[1]}: {result.unitsB}/{result.needed}</p>
        <ul className="mt-2 space-y-1.5">
          {result.outcomes.map((o) => (
            <li key={o.key} className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-lg bg-slate-900/40 px-3 py-2 text-sm">
              <div className="min-w-0">
                <span className="text-slate-200">{o.label}</span>
                {o.diff != null && <span className="ml-2 font-mono text-[11px] text-slate-500">difference {o.diff > 0 ? "+" : ""}{o.diff} {o.unit} (95 % CI {o.ci95[0]} to {o.ci95[1]})</span>}
              </div>
              <span className={`rounded-md px-2 py-0.5 font-mono text-[11px] ${VERDICT_TONE[o.verdict] || "text-emerald-300 bg-emerald-400/10"}`}>{o.verdict}</span>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}
