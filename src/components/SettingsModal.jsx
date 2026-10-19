/* M2 — Profile: wake times and the weekly training plan. Drives the brief and the plan. */
import React, { useState } from "react";
import { Check } from "lucide-react";
import { Modal, Field, inputClass, PrimaryButton } from "./ui.jsx";
import { WEEKDAYS, SESSION_DEFAULTS, spacingConflicts } from "../engine.js";

const DAY_LABEL = { mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun" };
const TEMPLATE_OPTIONS = ["upper", "lower", "football", "zone2", "rest"];
const DEFAULT_TEMPLATE = { mon: "upper", tue: "lower", wed: "football", thu: "upper", fri: "lower", sat: "football", sun: "rest" };

export default function SettingsModal({ profile, footballRecoveryH = null, onSave, onClose }) {
  const [p, setP] = useState(() => ({
    usualWake: "07:00", weekendWake: profile?.wakeByDay?.sat ?? "",
    ...profile, template: profile?.template ?? DEFAULT_TEMPLATE,
  }));
  const set = (k) => (v) => setP((x) => ({ ...x, [k]: v }));
  const conflicts = spacingConflicts(p, footballRecoveryH ?? undefined); // your learned football recovery, once known

  const save = (e) => {
    e.preventDefault();
    // Drop fields from features that were removed (weight, sweat rate, injured side, calendar keyword)
    const { weekendWake, weightKg, weightLog, sweatRateLph, injuredSide, footballKeyword, experiment, ...rest } = p;
    onSave({ ...rest, wakeByDay: weekendWake ? { sat: weekendWake, sun: weekendWake } : {} });
  };

  return (
    <Modal eyebrow="Settings" title="Your profile" onClose={onClose} labelId="settings-title" wide>
      <form className="space-y-6" onSubmit={save}>
        <div className="grid gap-4 sm:grid-cols-2">
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

        <PrimaryButton type="submit"><Check size={17} /> Save profile</PrimaryButton>
      </form>
    </Modal>
  );
}
