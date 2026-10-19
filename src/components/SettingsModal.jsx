/* M2 — Profile: weight, wake times, weekly template, injured side. Drives the brief and the plan. */
import React, { useState } from "react";
import { Check, Scale } from "lucide-react";
import { Modal, Field, Chips, inputClass, PrimaryButton } from "./ui.jsx";
import { WEEKDAYS, SESSION_DEFAULTS, spacingConflicts, trendWeight, dateKey } from "../engine.js";

const DAY_LABEL = { mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun" };
const TEMPLATE_OPTIONS = ["upper", "lower", "football", "zone2", "rest"];
const DEFAULT_TEMPLATE = { mon: "upper", tue: "lower", wed: "football", thu: "upper", fri: "lower", sat: "football", sun: "rest" };

export default function SettingsModal({ profile, footballRecoveryH, onSave, onClose }) {
  const [p, setP] = useState(() => ({
    usualWake: "07:00", weekendWake: profile?.wakeByDay?.sat ?? "", footballKeyword: "football", injuredSide: "R",
    ...profile, template: profile?.template ?? DEFAULT_TEMPLATE,
  }));
  const [weighIn, setWeighIn] = useState("");
  const set = (k) => (v) => setP((x) => ({ ...x, [k]: v }));
  const conflicts = spacingConflicts(p, footballRecoveryH);
  const today = dateKey();
  const trend = trendWeight(p.weightLog, today);

  const addWeighIn = () => {
    const kg = parseFloat(String(weighIn).replace(",", "."));
    if (!(kg > 30 && kg < 250)) return;
    const log = [...(p.weightLog || []).filter((r) => r.date !== today), { date: today, kg }].sort((a, b) => a.date.localeCompare(b.date)).slice(-400);
    setP((x) => ({ ...x, weightLog: log, weightKg: x.weightKg ?? kg }));
    setWeighIn("");
  };

  const save = (e) => {
    e.preventDefault();
    const { weekendWake, ...rest } = p;
    onSave({ ...rest, wakeByDay: weekendWake ? { sat: weekendWake, sun: weekendWake } : {} });
  };

  return (
    <Modal eyebrow="Settings" title="Your profile" onClose={onClose} labelId="settings-title" wide>
      <form className="space-y-6" onSubmit={save}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="set-weight" label="Weight (kg)" hint="Protein, carbs and water targets use your trended weight once you've logged 3 weigh-ins.">
            <input id="set-weight" type="number" inputMode="decimal" step="0.1" value={p.weightKg ?? ""} placeholder="75"
              onChange={(e) => set("weightKg")(e.target.value === "" ? null : Number(e.target.value))} className={inputClass} />
          </Field>
          <Field id="set-weighin" label="Add today's weigh-in" hint={trend ? `Trend ${trend.kg} kg from ${trend.n} weigh-ins` : "Optional, any time"}>
            <div className="flex gap-2">
              <input id="set-weighin" type="number" inputMode="decimal" step="0.1" value={weighIn} onChange={(e) => setWeighIn(e.target.value)} className={inputClass} />
              <button type="button" onClick={addWeighIn} className="flex items-center gap-1 rounded-lg border border-white/10 px-3 text-sm text-slate-300 hover:bg-white/5"><Scale size={14} /> Add</button>
            </div>
          </Field>
          <Field id="set-wake" label="Usual wake time">
            <input id="set-wake" type="time" value={p.usualWake || ""} onChange={(e) => set("usualWake")(e.target.value)} className={inputClass} />
          </Field>
          <Field id="set-wwake" label="Weekend wake time" hint="Leave empty to use the usual time. Keep it within 1 h to limit social jetlag.">
            <input id="set-wwake" type="time" value={p.weekendWake || ""} onChange={(e) => set("weekendWake")(e.target.value)} className={inputClass} />
          </Field>
        </div>

        <div>
          <p className="text-sm font-semibold text-slate-200">Weekly training plan</p>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
            {WEEKDAYS.map((d) => (
              <label key={d} className="block">
                <span className="font-mono text-[11px] uppercase text-slate-500">{DAY_LABEL[d]}</span>
                <select value={p.template[d]} onChange={(e) => set("template")({ ...p.template, [d]: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950/60 px-2 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400/60">
                  {TEMPLATE_OPTIONS.map((o) => <option key={o} value={o}>{SESSION_DEFAULTS[o].label}</option>)}
                </select>
              </label>
            ))}
          </div>
          {conflicts.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs text-amber-200">
              {conflicts.map((c) => <li key={`${c.from}-${c.to}-${c.rule}`}>⚠ {c.text}</li>)}
            </ul>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-sm text-slate-300">Injured ankle</p>
            <Chips label="Injured ankle" value={p.injuredSide} onChange={set("injuredSide")}
              options={[{ value: "L", label: "Left" }, { value: "R", label: "Right" }]} />
          </div>
          <Field id="set-sweat" label="Sweat rate (L/h, optional)"
            hint="Weigh yourself before and after a football session without drinking: each kg lost ≈ 1 L. Divide by hours played.">
            <input id="set-sweat" type="number" inputMode="decimal" step="0.1" value={p.sweatRateLph ?? ""}
              onChange={(e) => set("sweatRateLph")(e.target.value === "" ? null : Number(e.target.value))} className={inputClass} />
          </Field>
          <Field id="set-kw" label="Football calendar keyword" hint="Your Shortcut sends a fixture time when an event title contains this. The title itself never leaves your phone.">
            <input id="set-kw" type="text" value={p.footballKeyword || ""} onChange={(e) => set("footballKeyword")(e.target.value)} className={inputClass} />
          </Field>
        </div>

        <PrimaryButton type="submit"><Check size={17} /> Save profile</PrimaryButton>
      </form>
    </Modal>
  );
}
