/* M1 — How much to trust a day's numbers. Low-confidence and override days stay out of
   baselines and everything CHINH learns, so one bad reading can't shape a month of advice. */
import { isNum } from "./util.js";

export const CONFIDENCE = {
  highMinHrvCount: 2, // overnight readings needed for "high"
  spo2ArtefactMin: 88, // one overnight oxygen minimum under this is most likely a loose strap (M7.3)
};

/* Data-quality notes that don't change the level */
function notesFor(day) {
  return isNum(day.spo2Min) && day.spo2Min < CONFIDENCE.spo2ArtefactMin
    ? [`Overnight oxygen dipped to ${day.spo2Min} % once: most likely a loose strap, not a health reading.`]
    : [];
}

// "rest" is what public viewers see instead of ill / high stress (api/_public.js keeps the reason private)
export const OVERRIDE_LABELS = { ill: "ill", stress: "high stress", rest: "a rest day" };

export function dataConfidence(day) {
  if (!day) return { level: "low", reasons: ["No data"], notes: [] };
  const notes = notesFor(day);
  if (day.override) return { level: "low", reasons: [`Marked as ${OVERRIDE_LABELS[day.override] || day.override}`], notes };
  if (!isNum(day.hrv)) return { level: "low", reasons: ["No HRV synced"], notes };

  const reasons = [];
  if (day.hrvWindow !== "overnight") {
    reasons.push(day.hrvWindow === "24h" ? "HRV averaged over 24 h (includes daytime)" : "HRV entered by hand or from an older sync");
  } else if (!isNum(day.hrvCount) || day.hrvCount < CONFIDENCE.highMinHrvCount) {
    reasons.push(isNum(day.hrvCount) ? `Only ${day.hrvCount} overnight HRV reading${day.hrvCount === 1 ? "" : "s"}` : "HRV reading count unknown");
  }
  if (!isNum(day.sleepHours)) reasons.push("No sleep data");

  return reasons.length ? { level: "medium", reasons, notes } : { level: "high", reasons: [`${day.hrvCount} overnight HRV readings and a full sleep record`], notes };
}

/* A day that may feed baselines and learning */
export const usableForLearning = (day) => !!day && !day.override && dataConfidence(day).level !== "low";
