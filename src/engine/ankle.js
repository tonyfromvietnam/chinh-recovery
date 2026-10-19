/* M4 — Ankle rehab in numbers: weekly knee-to-wall, eyes-closed balance and hop & stick, left vs right. */
import { isNum, mean, round1, daysBetween } from "./util.js";

export const ANKLE = {
  testEveryDays: 7,
  balanceSymmetry: 0.8, // injured ÷ good side, for clearance
  hopsRequired: 5,
  slopeTests: 4,
};

export const ANKLE_TESTS = {
  k2w: { label: "Knee-to-wall", unit: "cm", higherBetter: true },
  bal: { label: "Balance, eyes closed", unit: "s", higherBetter: true },
  hop: { label: "Hop & stick", unit: "/5", higherBetter: true },
};

const side = (t, key, s) => t?.[`${key}${s}`];

/* Least-squares slope of y over days, expressed per week */
function weeklySlope(points) {
  if (points.length < 2) return null;
  const xs = points.map((p) => p.x), ys = points.map((p) => p.y);
  const mx = mean(xs), my = mean(ys);
  const den = xs.reduce((s, x) => s + (x - mx) ** 2, 0);
  if (!den) return null;
  return round1((xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0) / den) * 7);
}

export function ankleSummary(history, today, injuredSide = null) {
  const tests = history.filter((h) => h.ankleTest && h.date <= today).sort((a, b) => a.date.localeCompare(b.date));
  const last = tests[tests.length - 1];
  const injured = injuredSide || last?.ankleTest?.injured || "R";
  const good = injured === "L" ? "R" : "L";
  const daysSince = last ? daysBetween(last.date, today) : null;
  const out = { tests: tests.length, injured, good, lastDate: last?.date ?? null, due: !last || daysSince >= ANKLE.testEveryDays, metrics: {} };
  if (!last) return { ...out, worsening: null, cleared: false };

  for (const key of Object.keys(ANKLE_TESTS)) {
    const series = tests.filter((t) => isNum(side(t.ankleTest, key, injured)));
    const inj = side(last.ankleTest, key, injured), gd = side(last.ankleTest, key, good);
    const recent = series.slice(-ANKLE.slopeTests);
    out.metrics[key] = {
      injured: isNum(inj) ? inj : null, good: isNum(gd) ? gd : null,
      gap: isNum(inj) && isNum(gd) ? round1(gd - inj) : null,
      slopePerWeek: weeklySlope(recent.map((t) => ({ x: daysBetween(recent[0].date, t.date), y: side(t.ankleTest, key, injured) }))),
      series: series.map((t) => ({ date: t.date, injured: side(t.ankleTest, key, injured), good: side(t.ankleTest, key, good) ?? null })),
    };
  }

  // Worse on two weekly tests in a row on the injured side (knee-to-wall or balance)
  let worsening = null;
  for (const key of ["k2w", "bal"]) {
    const s = tests.filter((t) => isNum(side(t.ankleTest, key, injured))).slice(-3).map((t) => side(t.ankleTest, key, injured));
    if (s.length === 3 && s[2] < s[1] && s[1] < s[0]) {
      worsening = { key, values: s, unit: ANKLE_TESTS[key].unit, label: ANKLE_TESTS[key].label };
      break;
    }
  }

  const t = last.ankleTest;
  const balOk = isNum(t.balL) && isNum(t.balR) && Math.min(t.balL, t.balR) / Math.max(t.balL, t.balR, 1) >= ANKLE.balanceSymmetry;
  const cleared = t.hopL >= ANKLE.hopsRequired && t.hopR >= ANKLE.hopsRequired && balOk;
  return { ...out, worsening, cleared };
}

export function anklePhysioDirective(summary) {
  const w = summary?.worsening;
  if (!w) return null;
  return {
    id: "ankle-physio", level: "adjust", title: "Book a physio check",
    why: `${w.label} on your ${summary.injured === "L" ? "left" : "right"} side: ${w.values.join(" → ")} ${w.unit} over the last 2 weekly tests.`,
    action: "Keep the drills gentle and get the ankle assessed before more football.",
  };
}
