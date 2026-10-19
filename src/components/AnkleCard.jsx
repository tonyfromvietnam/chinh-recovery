/* M4 — Weekly ankle tests, charted injured vs good side. */
import React, { useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Ruler, Check } from "lucide-react";
import { Card, CardHeader, Modal, Chips, Field, inputClass, PrimaryButton, GhostButton } from "./ui.jsx";
import { ANKLE_TESTS } from "../engine.js";

const sideName = (s) => (s === "L" ? "left" : "right");

function AnkleTestModal({ injured, onSave, onClose }) {
  const [t, setT] = useState({ injured, k2wL: "", k2wR: "", balL: "", balR: "", hopL: 5, hopR: 5 });
  const set = (k) => (v) => setT((p) => ({ ...p, [k]: v }));
  const num = (v) => (v === "" ? null : Number(String(v).replace(",", ".")));
  const save = (e) => {
    e.preventDefault();
    onSave({ injured: t.injured, k2wL: num(t.k2wL), k2wR: num(t.k2wR), balL: num(t.balL), balR: num(t.balR), hopL: t.hopL, hopR: t.hopR });
  };
  const pair = (key, label, hint, step = "0.5") => (
    <div>
      <p className="text-sm text-slate-300">{label}</p>
      <p className="text-xs text-slate-500">{hint}</p>
      <div className="mt-2 grid grid-cols-2 gap-3">
        {["L", "R"].map((s) => (
          <Field key={s} id={`at-${key}${s}`} label={`${s === "L" ? "Left" : "Right"}${s === t.injured ? " (injured)" : ""}`}>
            <input id={`at-${key}${s}`} type="number" inputMode="decimal" step={step} value={t[`${key}${s}`]}
              onChange={(e) => set(`${key}${s}`)(e.target.value)} className={inputClass} />
          </Field>
        ))}
      </div>
    </div>
  );
  return (
    <Modal eyebrow="Ankle test · 3 minutes" title="This week's numbers" onClose={onClose} labelId="ankle-title">
      <form className="space-y-5" onSubmit={save}>
        <Chips label="Injured side" value={t.injured} onChange={set("injured")} options={[{ value: "L", label: "Left injured" }, { value: "R", label: "Right injured" }]} />
        {pair("k2w", "Knee-to-wall (cm)", "Furthest distance from big toe to wall where the knee still touches with the heel down.")}
        {pair("bal", "Single-leg balance, eyes closed (s)", "Seconds until the lifted foot or an arm moves to catch you. Cap at 60.", "1")}
        <div>
          <p className="text-sm text-slate-300">Hop & stick (out of 5)</p>
          <p className="text-xs text-slate-500">Five forward hops on one leg; count landings held still for 2 seconds.</p>
          <div className="mt-2 grid grid-cols-2 gap-3">
            {["L", "R"].map((s) => (
              <div key={s}>
                <p className="mb-1 text-xs text-slate-400">{s === "L" ? "Left" : "Right"}</p>
                <Chips label={`Hop ${s}`} value={t[`hop${s}`]} onChange={set(`hop${s}`)} options={[0, 1, 2, 3, 4, 5].map((n) => ({ value: n, label: String(n) }))} />
              </div>
            ))}
          </div>
        </div>
        <PrimaryButton type="submit"><Check size={17} /> Save test</PrimaryButton>
      </form>
    </Modal>
  );
}

export default function AnkleCard({ ankle, onSaveTest }) {
  const [open, setOpen] = useState(false);
  const k2w = ankle.metrics.k2w;
  return (
    <Card className="p-5 sm:p-6">
      <CardHeader eyebrow="Ankle rehab" title="Left vs right"
        sub={ankle.tests ? `${ankle.tests} weekly test${ankle.tests === 1 ? "" : "s"} · injured side: ${sideName(ankle.injured)}` : "No tests yet"}
        right={<GhostButton onClick={() => setOpen(true)}><Ruler size={15} /> {ankle.due ? "Do this week's test" : "Retest"}</GhostButton>} />

      {ankle.tests === 0 ? (
        <p className="mt-4 text-sm text-slate-300">A 3-minute weekly test turns rehab into numbers: knee-to-wall distance, eyes-closed balance and hop & stick, both sides.
          Balance training cut repeat sprains by 35 % in a BMJ trial; this shows whether yours is working.</p>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {Object.entries(ANKLE_TESTS).map(([key, meta]) => {
              const m = ankle.metrics[key];
              return (
                <div key={key} className="rounded-xl border border-white/[0.05] bg-slate-900/40 p-3">
                  <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-slate-500">{meta.label}</p>
                  <p className="mt-1 font-display text-xl font-semibold tabular-nums text-slate-100">
                    {m?.injured ?? "–"}<span className="text-sm text-slate-500"> / {m?.good ?? "–"} {meta.unit}</span>
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {m?.gap != null ? (m.gap > 0 ? `${m.gap} ${meta.unit} behind` : "Level") : "–"}
                    {m?.slopePerWeek != null ? ` · ${m.slopePerWeek > 0 ? "+" : ""}${m.slopePerWeek}/wk` : ""}
                  </p>
                </div>
              );
            })}
          </div>
          {k2w?.series?.length > 1 && (
            <div className="mt-3 h-32">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={k2w.series.map((s) => ({ ...s, label: s.date.slice(5) }))} margin={{ top: 6, right: 8, left: -24, bottom: 0 }}>
                  <XAxis dataKey="label" tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, fontSize: 12 }} labelStyle={{ color: "#94a3b8" }} />
                  <Line type="monotone" dataKey="good" name="Good side (cm)" stroke="#64748b" strokeWidth={2} dot={{ r: 2 }} />
                  <Line type="monotone" dataKey="injured" name="Injured side (cm)" stroke="#22d3ee" strokeWidth={2.5} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
          <p className={`mt-3 text-sm ${ankle.worsening ? "text-amber-200" : ankle.cleared ? "text-emerald-300" : "text-slate-400"}`}>
            {ankle.worsening ? `Getting worse two weeks running on the ${sideName(ankle.injured)} side: book a physio check.`
              : ankle.cleared ? "Cleared by your tests: hop & stick 5/5 both sides and balance within 20 %."
              : "Football clearance needs hop & stick 5/5 on both sides and balance within 20 % of your good side."}
          </p>
        </>
      )}
      {open && <AnkleTestModal injured={ankle.injured} onClose={() => setOpen(false)} onSave={(t) => { onSaveTest(t); setOpen(false); }} />}
    </Card>
  );
}
