/* M6 — Personal experiments: run an alternating protocol instead of guessing from patterns.
   One experiment at a time; override and low-confidence days don't count; non-compliant days are excluded. */
import { isNum, round1, shiftKey, daysBetween, hashSeed, welch } from "./util.js";
import { usableForLearning } from "./confidence.js";
import { baselineMap, outcomeAfter, OUTCOMES, LEARNING } from "./learning.js";

export const EXPERIMENTS = [
  { id: "caffeine-noon", title: "Caffeine cut-off", question: "Does a 12:00 coffee cut-off improve your sleep and HRV?",
    arms: ["Last coffee by 12:00", "Last coffee by 15:00"], unit: "week", outcomes: ["sleepHours", "nextHrvPct"] },
  { id: "late-dinner", title: "Dinner timing", question: "Does eating late lower your next-morning recovery?",
    arms: ["Dinner finished before 19:30", "Dinner after 21:00"], unit: "day", outcomes: ["nextHrvPct", "nextRhr"] },
  { id: "screens-out", title: "Phone out of the bedroom", question: "Does keeping your phone out of the bedroom bring bedtime forward?",
    arms: ["Phone out of the bedroom", "Phone as normal"], unit: "week", outcomes: ["bedTime", "energy"] },
  { id: "presleep-protein", title: "Pre-sleep protein", question: "Does 30–40 g slow protein before bed reduce next-day soreness?",
    arms: ["30–40 g casein / Greek yoghurt before bed", "No pre-sleep protein"], unit: "day", onlyOn: ["upper", "lower", "football"],
    outcomes: ["nextLowerSoreness"] },
  { id: "morning-light", title: "Morning light", question: "Does 10 minutes outside before 09:00 bring your bedtime forward?",
    arms: ["10 min outside before 09:00", "No deliberate morning light"], unit: "day", outcomes: ["bedTime", "sleepHours"] },
];

export const EXPERIMENT_MIN_UNITS = LEARNING.tagMinEach; // per arm

export const experimentById = (id) => EXPERIMENTS.find((e) => e.id === id) || null;

/* Balanced alternation: each block of two units contains both arms, in a seeded order */
export function assignArm(experiment, startDate, date, planned = null) {
  if (!experiment || !startDate || date < startDate) return null;
  if (experiment.onlyOn && !experiment.onlyOn.includes(planned)) return null;
  const days = daysBetween(startDate, date);
  const unitIndex = experiment.unit === "week" ? Math.floor(days / 7) : days;
  const block = Math.floor(unitIndex / 2);
  const flip = hashSeed(`${experiment.id}|${startDate}|${block}`) % 2;
  const arm = (unitIndex % 2) ^ flip;
  return { id: experiment.id, arm, label: experiment.arms[arm], unitIndex };
}

export function experimentResult(history, experiment, today) {
  const bmap = baselineMap(history);
  const byDate = new Map(history.map((h) => [h.date, h]));
  const days = history.filter((d) => d.experiment?.id === experiment.id && d.experiment.complied === true && d.date < today && usableForLearning(d));
  const units = [new Set(), new Set()];
  days.forEach((d) => units[d.experiment.arm].add(d.experiment.unitIndex ?? d.date));
  const enough = units[0].size >= EXPERIMENT_MIN_UNITS && units[1].size >= EXPERIMENT_MIN_UNITS;

  const outcomes = experiment.outcomes.map((key) => {
    const a = [], b = [];
    for (const d of days) {
      const v = outcomeAfter(key, d.date, byDate, bmap, 1);
      if (isNum(v)) (d.experiment.arm === 0 ? a : b).push(v);
    }
    const stat = welch(a, b);
    const meta = OUTCOMES[key];
    let verdict = "not enough data";
    if (enough && stat) {
      const [lo, hi] = stat.ci;
      verdict = lo <= 0 && hi >= 0 ? "inconclusive" : (stat.diff > 0) === meta.higherBetter ? `${experiment.arms[0]} is better` : `${experiment.arms[1]} is better`;
    }
    return { key, label: meta.label, unit: meta.unit, nA: a.length, nB: b.length,
      diff: stat ? round1(stat.diff) : null, ci95: stat ? stat.ci.map(round1) : null, verdict };
  });
  return { id: experiment.id, unitsA: units[0].size, unitsB: units[1].size, needed: EXPERIMENT_MIN_UNITS, enough, outcomes };
}

