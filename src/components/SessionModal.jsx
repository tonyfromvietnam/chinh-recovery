/* M3 — Log a session: type, start, minutes, RPE and how it went. Load = RPE × minutes (Foster). */
import React, { useState } from "react";
import { Check } from "lucide-react";
import { Modal, Chips, RangeField, Field, inputClass, PrimaryButton } from "./ui.jsx";
import { SESSION_DEFAULTS, sessionLoad } from "../engine.js";

const TYPES = ["upper", "lower", "football", "zone2", "other"];

export default function SessionModal({ planned, existing, onSave, onClose }) {
  const start = planned && planned !== "rest" ? planned : "upper";
  const [s, setS] = useState(() => existing || {
    type: start, start: SESSION_DEFAULTS[start].start, minutes: SESSION_DEFAULTS[start].minutes, rpe: 7, quality: 3,
    context: { competitive: false, surface: null },
  });
  const set = (k) => (v) => setS((p) => ({ ...p, [k]: v }));
  const setType = (t) => setS((p) => ({ ...p, type: t, minutes: existing ? p.minutes : SESSION_DEFAULTS[t].minutes, start: existing ? p.start : SESSION_DEFAULTS[t].start }));

  return (
    <Modal eyebrow="Training" title="Log today's session" onClose={onClose} labelId="session-title">
      <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); onSave(s); }}>
        <Chips label="Session type" value={s.type} onChange={setType}
          options={TYPES.map((t) => ({ value: t, label: SESSION_DEFAULTS[t].label }))} />
        <div className="grid grid-cols-2 gap-3">
          <Field id="s-start" label="Start">
            <input id="s-start" type="time" value={s.start || ""} onChange={(e) => set("start")(e.target.value)} className={inputClass} />
          </Field>
          <Field id="s-min" label="Minutes">
            <input id="s-min" type="number" inputMode="numeric" min={5} max={240} value={s.minutes}
              onChange={(e) => set("minutes")(Number(e.target.value) || 0)} className={inputClass} />
          </Field>
        </div>
        <RangeField id="s-rpe" label="Effort (RPE)" value={s.rpe} min={1} max={10} unit="/10" onChange={set("rpe")} hint="1 very easy · 10 maximal" />
        <RangeField id="s-quality" label="How did it go?" value={s.quality} min={1} max={5} unit="/5" onChange={set("quality")} hint="Used to check whether your score predicts good sessions" />
        {s.type === "football" && (
          <div className="space-y-3">
            <Chips label="Match type" value={!!s.context?.competitive} onChange={(v) => set("context")({ ...s.context, competitive: v })}
              options={[{ value: false, label: "Casual" }, { value: true, label: "Competitive" }]} />
            <Chips label="Surface" value={s.context?.surface ?? null} onChange={(v) => set("context")({ ...s.context, surface: v })}
              options={[{ value: "grass", label: "Grass" }, { value: "3g", label: "3G / artificial" }]} />
          </div>
        )}
        <p className="font-mono text-xs text-slate-400">Session load: <span className="text-slate-100">{sessionLoad(s)}</span> (RPE × minutes)</p>
        <PrimaryButton type="submit"><Check size={17} /> Save session</PrimaryButton>
      </form>
    </Modal>
  );
}
