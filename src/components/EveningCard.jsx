/* M1 — Evening check-out: stress, alcohol, last caffeine, last meal. Under 10 seconds. */
import React, { useState } from "react";
import { Sunset, Check } from "lucide-react";
import { Card, CardHeader, Chips, RangeField, inputClass, PrimaryButton } from "./ui.jsx";
import { TAG_LABELS } from "../engine.js";

export default function EveningCard({ evening, cutoffs, onSave }) {
  const [editing, setEditing] = useState(!evening);
  const [f, setF] = useState(() => ({ stress: 2, alcohol: 0, lastCaffeine: "", lastMeal: "", ...evening }));
  const set = (k) => (v) => setF((p) => ({ ...p, [k]: v }));

  if (!editing && evening) {
    return (
      <Card className="p-5 sm:p-6">
        <CardHeader eyebrow="Evening check-out" title="Logged for tonight"
          right={<button onClick={() => setEditing(true)} className="text-sm text-cyan-300 hover:text-cyan-200">Edit</button>} />
        <p className="mt-3 text-sm text-slate-300">
          Stress {evening.stress}/5 · {["No alcohol", "1–2 drinks", "3+ drinks"][evening.alcohol]} ·
          last coffee {evening.lastCaffeine || "none"} · last meal {evening.lastMeal || "–"}
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {(evening.tags || []).length ? evening.tags.map((t) => (
            <span key={t} className="rounded-md bg-amber-300/10 px-2 py-0.5 font-mono text-[11px] text-amber-200">{TAG_LABELS[t] || t}</span>
          )) : <span className="font-mono text-[11px] text-emerald-300">No tags: a clean evening</span>}
        </div>
        <p className="mt-3 text-xs text-slate-500">Tags feed "What CHINH has learned": after 8 days with and 8 without, you'll see each one's effect on your next morning.</p>
      </Card>
    );
  }

  return (
    <Card className="p-5 sm:p-6">
      <CardHeader eyebrow="Evening check-out" title="How was today?"
        sub={cutoffs ? `Tonight's cut-offs: coffee ${cutoffs.coffee}, dinner ${cutoffs.lastMeal}` : null}
        right={<Sunset size={20} className="text-amber-300" />} />
      <form className="mt-4 space-y-4" onSubmit={(e) => { e.preventDefault(); onSave({ ...f, lastCaffeine: f.lastCaffeine || null, lastMeal: f.lastMeal || null }); setEditing(false); }}>
        <RangeField id="ev-stress" label="Stress today" value={f.stress} min={1} max={5} unit="/5" onChange={set("stress")} hint="1 calm · 5 overwhelmed" />
        <div>
          <p className="mb-2 text-sm text-slate-300">Alcohol</p>
          <Chips label="Alcohol" value={f.alcohol} onChange={set("alcohol")}
            options={[{ value: 0, label: "None" }, { value: 1, label: "1–2 drinks" }, { value: 2, label: "3+" }]} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="ev-caffeine" className="text-sm text-slate-300">Last caffeine</label>
            <div className="mt-1 flex gap-2">
              <input id="ev-caffeine" type="time" value={f.lastCaffeine || ""} onChange={(e) => set("lastCaffeine")(e.target.value)} className={inputClass} />
              <button type="button" onClick={() => set("lastCaffeine")("")} className="rounded-lg border border-white/10 px-2 text-xs text-slate-400 hover:bg-white/5">None</button>
            </div>
          </div>
          <div>
            <label htmlFor="ev-meal" className="text-sm text-slate-300">Last meal</label>
            <input id="ev-meal" type="time" value={f.lastMeal || ""} onChange={(e) => set("lastMeal")(e.target.value)} className={`mt-1 ${inputClass}`} />
          </div>
        </div>
        <PrimaryButton type="submit"><Check size={17} /> Save check-out</PrimaryButton>
      </form>
    </Card>
  );
}
