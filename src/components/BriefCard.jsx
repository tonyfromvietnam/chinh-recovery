/* M2 — Morning brief: answers today's questions with a number on every row. */
import React from "react";
import { Dumbbell, Droplet, Utensils, Moon, Target, Lightbulb, FlaskConical, Settings } from "lucide-react";
import { Card, Eyebrow, GhostButton } from "./ui.jsx";
import { SESSION_DEFAULTS } from "../engine.js";

const DECISION_TONE = {
  push: "#22e58b", "as-planned": "#22d3ee", cap: "#facc15", reduce: "#f97316", recover: "#fb5a6e",
};

function Row({ icon: Icon, label, children }) {
  return (
    <div className="grid grid-cols-[28px_1fr] gap-3 border-t border-white/[0.06] py-3 first:border-t-0">
      <Icon size={18} className="mt-0.5 text-cyan-300" />
      <div className="min-w-0">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-slate-500">{label}</p>
        <div className="mt-0.5 text-sm text-slate-200">{children}</div>
      </div>
    </div>
  );
}

export function BriefSetupCard({ onOpenSettings }) {
  return (
    <Card className="p-5 sm:p-6">
      <Eyebrow>Morning brief</Eyebrow>
      <h2 className="mt-1 font-display text-2xl font-semibold text-slate-100">Set up your brief</h2>
      <p className="mt-2 max-w-2xl text-sm text-slate-300">
        Add your weight, wake time and weekly training plan. CHINH then answers each morning: what to train, how much water,
        what and when to eat, when to go to bed, and the one thing to focus on.
      </p>
      <GhostButton onClick={onOpenSettings} className="mt-4 w-fit"><Settings size={15} /> Open settings</GhostButton>
    </Card>
  );
}

export default function BriefCard({ brief, archetype, result, onLogSession, onOpenSettings }) {
  const { decision, planned, water, nutrition, bedtime, cutoffs, focus, fact, experiment } = brief;
  const plannedLabel = planned ? SESSION_DEFAULTS[planned]?.label ?? planned : null;
  const tone = DECISION_TONE[decision?.decision] ?? "#94a3b8";
  return (
    <Card className="p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Eyebrow>Morning brief</Eyebrow>
          <h2 className="mt-1 font-display text-3xl font-semibold" style={{ color: archetype.color }}>
            {archetype.label.replace(" DAY", "")} · {result.score}%
          </h2>
          <p className="text-sm text-slate-300">{focus.title}: {focus.action}</p>
        </div>
        <div className="flex gap-2">
          <GhostButton onClick={onLogSession}><Dumbbell size={15} /> Log session</GhostButton>
          <button onClick={onOpenSettings} aria-label="Settings" className="rounded-lg border border-white/10 p-2 text-slate-400 hover:bg-white/5 hover:text-slate-100">
            <Settings size={16} />
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-x-8 lg:grid-cols-2">
        <div>
          <Row icon={Dumbbell} label={`Train${plannedLabel ? ` · ${plannedLabel} planned` : ""}`}>
            {decision ? (
              <>
                <p><span className="rounded-md px-1.5 py-0.5 font-mono text-xs font-semibold" style={{ color: tone, background: `${tone}1f` }}>{decision.label}</span> {decision.detail}</p>
                <p className="mt-1 font-mono text-[11px] text-slate-500">{decision.why.join(" · ")}</p>
              </>
            ) : (
              <p className="text-slate-400">Add your weekly plan in settings to get a train / cap / reduce / recover call.</p>
            )}
          </Row>
          <Row icon={Droplet} label="Water">
            <p><span className="font-display text-xl font-semibold tabular-nums text-slate-100">{water.litres} L</span>{" "}
              <span className="text-slate-400">{water.parts.map((p) => `${p.litres} ${p.label.toLowerCase()}`).join(" + ")}</span></p>
            <p className="font-mono text-[11px] text-slate-500">500 ml on waking · taper after 20:00 · pale-straw urine</p>
          </Row>
          <Row icon={Utensils} label={`Food · ${nutrition.dayType} day`}>
            {nutrition.proteinG ? (
              <p><span className="tabular-nums">{nutrition.proteinG} g protein</span> ({nutrition.perMealG} g × 4) ·{" "}
                <span className="tabular-nums">{nutrition.carbsG[0]}–{nutrition.carbsG[1]} g carbs</span></p>
            ) : (
              <p className="text-slate-400">Add your weight in settings for protein and carb targets.</p>
            )}
            <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 font-mono text-[11px] text-slate-400">
              {nutrition.meals.map((m) => <li key={m.id}><span className="text-slate-200">{m.time}</span> {m.label}</li>)}
            </ul>
          </Row>
        </div>
        <div>
          <Row icon={Moon} label="Tonight">
            <p>In bed by <span className="font-display text-xl font-semibold tabular-nums text-slate-100">{bedtime.time}</span>
              {brief.sleepNeedLearned && <span className="ml-2 rounded bg-emerald-400/10 px-1.5 font-mono text-[10px] uppercase text-emerald-300">your sleep need</span>}</p>
            <ul className="mt-1 grid grid-cols-2 gap-x-4 gap-y-0.5 font-mono text-[11px] text-slate-400">
              <li>Last coffee <span className="text-slate-200">{cutoffs.coffee}</span></li>
              <li>Dinner done <span className="text-slate-200">{cutoffs.lastMeal}</span></li>
              <li>Warm shower <span className="text-slate-200">{cutoffs.shower[0]}–{cutoffs.shower[1]}</span></li>
              <li>Screens off <span className="text-slate-200">{cutoffs.screensOff}</span></li>
            </ul>
            <p className="mt-1 font-mono text-[11px] text-slate-500">{bedtime.reason}</p>
          </Row>
          <Row icon={Target} label={`Focus · ${focus.title}`}>
            <p>{focus.action}</p>
            <p className="font-mono text-[11px] text-slate-500">{focus.why}</p>
          </Row>
          {experiment && (
            <Row icon={FlaskConical} label="Experiment today">
              <p>{experiment.label}</p>
            </Row>
          )}
        </div>
      </div>

      <div className="mt-3 flex gap-3 rounded-xl border border-white/[0.06] bg-slate-900/40 p-3">
        <Lightbulb size={18} className="mt-0.5 shrink-0 text-amber-300" />
        <div className="min-w-0">
          <p className="text-sm text-slate-200"><span className="font-semibold">Did you know?</span> {fact.text}</p>
          <p className="font-mono text-[11px] text-slate-500">{fact.source}</p>
        </div>
      </div>
    </Card>
  );
}
