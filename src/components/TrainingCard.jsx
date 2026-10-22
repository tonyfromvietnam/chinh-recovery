/* M8.1 — Today's strength session: power primer, supersets with a loaded stretch in each rest, and why. */
import React from "react";
import { Dumbbell, Zap, Timer, Info } from "lucide-react";
import { Card, CardHeader } from "./ui.jsx";
import { formatDose, exerciseById } from "../engine.js";

function ExerciseRow({ e }) {
  return (
    <li className="flex items-baseline justify-between gap-3">
      <span className="min-w-0 text-sm text-slate-100">{e.name}</span>
      <span className="shrink-0 font-mono text-xs tabular-nums text-cyan-200/80">{formatDose(exerciseById(e.id), e.sets)}</span>
    </li>
  );
}

export default function TrainingCard({ session, onOpenSettings }) {
  if (session.recovery) {
    return (
      <Card className="p-5 sm:p-6">
        <CardHeader eyebrow="Training · today" title={`${session.label}: recovery instead`} />
        <p className="mt-3 flex items-start gap-2 text-sm text-slate-300"><Info size={16} className="mt-0.5 shrink-0 text-slate-400" />{session.why}</p>
      </Card>
    );
  }
  const effort = session.blocks[0]?.pair[0]?.effort;
  return (
    <Card className="p-5 sm:p-6">
      <CardHeader eyebrow="Training · today" title={`${session.label} · ${session.minutes} min`}
        sub={`Supersets: do the pair back to back, rest ${session.blocks[0]?.restSec ?? 60} s, repeat. Effort: ${effort}.`}
        right={<button onClick={onOpenSettings} className="font-mono text-[11px] text-slate-400 underline-offset-2 hover:text-slate-200 hover:underline">
          {session.sessionMinutes}-min plan · kit</button>} />

      {session.power.length > 0 && (
        <div className="mt-4 rounded-xl border border-amber-300/15 bg-amber-300/[0.04] p-3">
          <p className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-amber-200/90">
            <Zap size={13} /> Warm-up, then power · 5 min
          </p>
          <p className="mt-1 text-xs text-slate-400">Knee-to-Wall Pulses and World's Greatest Stretch, then fast reps while you're fresh. Stop when they slow.</p>
          <ul className="mt-2 space-y-1">{session.power.map((e) => <ExerciseRow key={e.id} e={e} />)}</ul>
        </div>
      )}

      <ol className="mt-3 space-y-3">
        {session.blocks.map((b, i) => (
          <li key={b.pair.map((p) => p.id).join("+")} className="rounded-xl border border-white/[0.06] bg-slate-900/40 p-3">
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-slate-400">
                <Dumbbell size={13} /> {b.pair.length > 1 ? `Superset ${i + 1}` : `Block ${i + 1}`}
              </p>
              <span className="font-mono text-[11px] text-slate-500">{b.rounds} round{b.rounds === 1 ? "" : "s"}</span>
            </div>
            <ul className="mt-2 space-y-1">{b.pair.map((e) => <ExerciseRow key={e.id} e={e} />)}</ul>
            {b.range && (
              <p className="mt-2 flex items-start gap-1.5 text-xs text-slate-400">
                <Timer size={13} className="mt-0.5 shrink-0" /> In the rest: {b.range.name}, {b.range.dose}
              </p>
            )}
          </li>
        ))}
      </ol>

      <p className="mt-3 text-xs text-slate-500">{session.why}</p>
    </Card>
  );
}
