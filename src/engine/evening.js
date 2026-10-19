/* M1 — Evening check-out: four taps that become the tags every personal insight learns from. */
import { toMin, isHHMM } from "./util.js";

export const EVENING = {
  fallbackCaffeineCutoff: "14:00", // before a personal bedtime exists
  fallbackLastMeal: "21:00",
  highStress: 4,
};

export const TAG_LABELS = {
  alcohol: "Alcohol",
  "alcohol-heavy": "3+ drinks",
  "late-caffeine": "Late caffeine",
  "late-meal": "Late dinner",
  "high-stress": "High stress",
  football: "Football",
  "late-bed": "Late bedtime",
};

/* evening = { stress, alcohol, lastCaffeine, lastMeal, tags }; cutoffs = eveningCutoffs(bedtime) or null */
export function eveningTags(evening, cutoffs = null) {
  if (!evening) return [];
  const tags = new Set((evening.tags || []).filter((t) => typeof t === "string"));
  if (evening.alcohol >= 1) tags.add("alcohol");
  if (evening.alcohol >= 2) tags.add("alcohol-heavy");
  if (evening.stress >= EVENING.highStress) tags.add("high-stress");

  const coffeeCut = toMin(cutoffs?.coffee ?? EVENING.fallbackCaffeineCutoff);
  if (isHHMM(evening.lastCaffeine) && toMin(evening.lastCaffeine) > coffeeCut) tags.add("late-caffeine");

  const mealCut = toMin(cutoffs?.lastMeal ?? EVENING.fallbackLastMeal);
  // Meals after midnight count as late
  if (isHHMM(evening.lastMeal) && (toMin(evening.lastMeal) > mealCut || toMin(evening.lastMeal) < 300)) tags.add("late-meal");

  return [...tags].sort();
}
