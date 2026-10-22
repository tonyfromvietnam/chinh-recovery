/* M2 + M8.1 — Profile: wake times, the weekly training plan, your kit and session length. */
import React, { useState } from "react";
import { Check } from "lucide-react";
import { Modal, Field, inputClass, PrimaryButton, Chips } from "./ui.jsx";
import { WEEKDAYS, SESSION_DEFAULTS, TRAINING, spacingConflicts } from "../engine.js";

const DAY_LABEL = { mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun" };
const TEMPLATE_OPTIONS = ["full-a", "full-b", "football", "zone2", "rest"];
const LEGACY_OPTIONS = ["upper", "lower"]; // shown only while an old plan still uses them
// Suggested week (TECH_SPEC M8.1): two 30-min full-body sessions, two football, Sunday mobility only
const SUGGESTED_WEEK = { mon: "full-a", tue: "rest", wed: "football", thu: "full-b", fri: "rest", sat: "football", sun: "rest" };
const KIT = [{ key: "bands", label: "Resistance bands" }, { key: "bar", label: "Pull-up bar" }, { key: "dip", label: "Dip bars" }];

export default function SettingsModal({ profile, footballRecoveryH = null, onSave, onClose }) {
  const [p, setP] = useState(() => ({
    usualWake: "07:00", weekendWake: profile?.wakeByDay?.sat ?? "",
    ...profile, template: profile?.template ?? SUGGESTED_WEEK,
    equipment: Array.isArray(profile?.equipment) ? profile.equipment : TRAINING.defaultEquipment,
    sessionMinutes: profile?.sessionMinutes ?? TRAINING.defaultMinutes,
  }));
  const options = [...TEMPLATE_OPTIONS, ...LEGACY_OPTIONS.filter((o) => Object.values(p.template).includes(o))];
  const toggleKit = (k) => set("equipment")(p.equipment.includes(k) ? p.equipment.filter((x) => x !== k) : [...p.equipment, k]);
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
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm font-semibold text-slate-200">Weekly training plan</p>
            <button type="button" onClick={() => set("template")(SUGGESTED_WEEK)} className="text-xs text-cyan-300 hover:text-cyan-200">
              Use the suggested week
            </button>
          </div>
          <p className="mt-0.5 text-xs text-slate-500">Full A and Full B are 30-min calisthenics sessions with bars and bands. Suggested: Full A Mon, Full B Thu, football Wed and Sat, mobility only on the other days.</p>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
            {WEEKDAYS.map((d) => (
              <label key={d} className="block">
                <span className="font-mono text-[11px] uppercase text-slate-500">{DAY_LABEL[d]}</span>
                <select value={p.template[d]} onChange={(e) => set("template")({ ...p.template, [d]: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950/60 px-2 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400/60">
                  {options.map((o) => <option key={o} value={o}>{SESSION_DEFAULTS[o].label}{LEGACY_OPTIONS.includes(o) ? " (old: runs as Full " + (o === "upper" ? "A" : "B") + ")" : ""}</option>)}
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
            <p className="text-sm font-semibold text-slate-200">Your kit</p>
            <p className="text-xs text-slate-500">Switch off what you don't have with you; exercises fall back to an easier rung without it.</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {KIT.map((k) => {
                const on = p.equipment.includes(k.key);
                return (
                  <button key={k.key} type="button" role="checkbox" aria-checked={on} onClick={() => toggleKit(k.key)}
                    className={`rounded-lg border px-3 py-1.5 text-sm transition focus-visible:ring-2 focus-visible:ring-cyan-300 ${on
                      ? "border-cyan-400/60 bg-cyan-400/15 text-cyan-100" : "border-white/10 text-slate-400 hover:bg-white/5"}`}>
                    {k.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-200">Session length</p>
            <p className="text-xs text-slate-500">Rounds per superset: 20 min = 2, 30 = 3, 45 = 4.</p>
            <div className="mt-2">
              <Chips label="Session length" value={p.sessionMinutes} onChange={set("sessionMinutes")}
                options={[20, 30, 45].map((m) => ({ value: m, label: `${m} min` }))} />
            </div>
          </div>
        </div>

        <PrimaryButton type="submit"><Check size={17} /> Save profile</PrimaryButton>
      </form>
    </Modal>
  );
}
