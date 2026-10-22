/* M8.1 + M8.2 — Today's strength session (power primer, supersets with a loaded stretch in each rest, why)
   and the 30-second log: each exercise pre-filled with its target, tick it, change a number if it differs,
   and say how the last set felt. */
import React, { useState } from "react";
import { Dumbbell, Zap, Timer, Info, ClipboardCheck, Check, ArrowUp, ArrowDown } from "lucide-react";
import { Card, CardHeader, Chips, Checkbox, PrimaryButton, GhostButton } from "./ui.jsx";
import { formatDose, exerciseById } from "../engine.js";

const CHANGE = {
  up: { icon: ArrowUp, text: "new rung", tone: "text-emerald-300 bg-emerald-400/10" },
  half: { icon: ArrowUp, text: "heavier band / more weight", tone: "text-emerald-300 bg-emerald-400/10" },
  down: { icon: ArrowDown, text: "eased off", tone: "text-amber-200 bg-amber-300/10" },
};

function ExerciseRow({ e }) {
  const c = CHANGE[e.change];
  return (
    <li className="flex items-baseline justify-between gap-3">
      <span className="min-w-0 text-sm text-slate-100">
        {e.name}
        {e.extra > 0 && <span className="ml-1.5 font-mono text-[10px] text-slate-400">+{e.extra} band/weight</span>}
        {c && <span className={`ml-1.5 inline-flex items-center gap-0.5 rounded px-1 font-mono text-[10px] ${c.tone}`}><c.icon size={10} />{c.text}</span>}
      </span>
      <span className="shrink-0 font-mono text-xs tabular-nums text-cyan-200/80">{formatDose(exerciseById(e.id), e.sets)}</span>
    </li>
  );
}

/* One entry per exercise, pre-filled with the top of its target (or what was logged earlier today) */
function initialRows(session, logged) {
  const items = [...session.power, ...session.blocks.flatMap((b) => b.pair)];
  return items.map((e) => {
    const prev = logged?.exercises?.find((x) => x.id === e.id);
    const top = e.reps[1];
    return { id: e.id, name: e.name, rung: e.rung, extra: e.extra ?? 0, unit: e.unit, side: e.side, done: logged ? !!prev : true,
      reps: prev?.reps ?? Array.from({ length: e.sets }, () => top), last: prev?.last ?? "right" };
  });
}

function LogForm({ session, logged, onSave, onCancel }) {
  const [rows, setRows] = useState(() => initialRows(session, logged));
  const update = (i, patch) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const save = () => onSave({
    dayType: session.type, minutes: session.minutes,
    exercises: rows.filter((r) => r.done).map(({ id, rung, extra, reps, last }) => ({ id, rung, extra, reps: reps.map((n) => Math.max(0, Math.round(Number(n) || 0))), last })),
  });
  return (
    <div className="mt-4 space-y-2">
      <p className="text-xs text-slate-400">Pre-filled with each target. Untick anything you skipped, change a number if it differs, then say how the last set felt.</p>
      <ul className="space-y-2">
        {rows.map((r, i) => (
          <li key={r.id} className={`rounded-xl border border-white/[0.06] p-3 ${r.done ? "bg-slate-900/40" : "bg-slate-900/10 opacity-60"}`}>
            <div className="flex items-center gap-3">
              <Checkbox checked={r.done} onChange={() => update(i, { done: !r.done })} color="#22d3ee" label={`Did ${r.name}`} />
              <span className="min-w-0 flex-1 text-sm text-slate-100">{r.name}</span>
            </div>
            {r.done && (
              <div className="mt-2 flex flex-wrap items-center gap-2 pl-9">
                {r.reps.map((n, k) => (
                  <label key={k} className="flex items-center gap-1 font-mono text-[11px] text-slate-500">
                    {k + 1}
                    <input type="number" inputMode="numeric" min="0" value={n} aria-label={`${r.name} set ${k + 1} ${r.unit === "s" ? "seconds" : "reps"}`}
                      onChange={(e) => update(i, { reps: r.reps.map((x, j) => (j === k ? e.target.value : x)) })}
                      className="w-14 rounded-md border border-white/10 bg-slate-950/60 px-2 py-1 text-center text-sm text-slate-100 outline-none focus:border-cyan-400/60" />
                  </label>
                ))}
                <span className="font-mono text-[11px] text-slate-500">{r.unit === "s" ? "s" : "reps"}{r.side ? " / side" : ""}</span>
                <div className="ml-auto">
                  <Chips label={`How the last set of ${r.name} felt`} value={r.last} onChange={(v) => update(i, { last: v })}
                    options={[{ value: "easy", label: "Easy" }, { value: "right", label: "Right" }, { value: "failed", label: "Failed" }]} />
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
      <div className="flex gap-2 pt-1">
        <PrimaryButton onClick={save}><Check size={17} /> Save log</PrimaryButton>
        <button type="button" onClick={onCancel} className="rounded-xl border border-white/10 px-4 text-sm text-slate-300 hover:bg-white/5">Cancel</button>
      </div>
    </div>
  );
}

export default function TrainingCard({ session, logged = null, onSaveLog, onOpenSettings }) {
  const [logging, setLogging] = useState(false);
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

      {logging ? (
        <LogForm session={session} logged={logged} onCancel={() => setLogging(false)}
          onSave={(w) => { onSaveLog(w); setLogging(false); }} />
      ) : (
        <>
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

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] pt-4">
            <p className="text-xs text-slate-400">
              {logged
                ? `Logged: ${logged.exercises.length} exercise${logged.exercises.length === 1 ? "" : "s"}. Next session's rungs follow from it.`
                : "After training, log it in about 30 seconds. That's what moves you up the ladders."}
            </p>
            <GhostButton onClick={() => setLogging(true)}><ClipboardCheck size={15} /> {logged ? "Edit log" : "Log session"}</GhostButton>
          </div>
        </>
      )}
    </Card>
  );
}
