/* =========================================================================
   GET /api/stats — the public summary for www.duychinhdinh.com.
   Only the recovery score, the day type and the 30-day pattern, plus HRV, resting HR and sleep as
   7-day rolling averages: never a single day's reading, ratings, directions, notes or why a day was off.
   Off unless PUBLIC_STATS=on is set in Vercel. Storage is passed in, so this is tested with no network.
   ========================================================================= */
import { getArchetype, londonDate, shiftKey, isNum, round1 } from "../src/engine.js";

export const PUBLIC = {
  scoreDays: 30,
  trendDays: 7, // each trend point is the average of the 7 days up to it
  minPerWindow: 3, // a 7-day average needs at least 3 readings
  cacheSec: 900, // Vercel's edge keeps the answer 15 min
  dayNames: { high: "High Output", balanced: "Balanced Flow", restore: "Active Restoration" },
  metrics: { hrv: { key: "hrv", unit: "ms", dp: 0 }, rhr: { key: "rhr", unit: "bpm", dp: 0 }, sleep: { key: "sleepHours", unit: "h", dp: 1 } },
};

const avg = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);
const fix = (v, dp) => (v == null ? null : dp ? round1(v) : Math.round(v));

/* Pure: the public summary from the day records (today = Europe/London date) */
export function publicStats(history, today) {
  const byDate = new Map(history.filter((h) => h.date <= today).map((h) => [h.date, h]));
  const scored = [...byDate.values()].filter((h) => isNum(h.score)).sort((a, b) => a.date.localeCompare(b.date));
  const latest = scored.at(-1);
  if (!latest) return null;

  const days = (n, end = today) => Array.from({ length: n }, (_, i) => shiftKey(end, i - n + 1));
  const last30 = days(PUBLIC.scoreDays).map((d) => (isNum(byDate.get(d)?.score) ? Math.round(byDate.get(d).score) : null));
  const scores = last30.filter(isNum);

  const rolling = (key, end) => {
    const vals = days(PUBLIC.trendDays, end).map((d) => byDate.get(d)?.[key]).filter(isNum);
    return vals.length >= PUBLIC.minPerWindow ? avg(vals) : null;
  };
  const trends = {};
  for (const [name, m] of Object.entries(PUBLIC.metrics)) {
    const week = days(PUBLIC.trendDays).map((d) => fix(rolling(m.key, d), m.dp));
    const now = rolling(m.key, today), before = rolling(m.key, shiftKey(today, -PUBLIC.trendDays));
    trends[name] = { unit: m.unit, avg7: fix(now, m.dp), change: now != null && before != null ? fix(now - before, m.dp) : null, week };
  }

  return {
    updated: latest.date,
    today: { score: Math.round(latest.score), day: PUBLIC.dayNames[getArchetype(latest.score).id], date: latest.date },
    last30, avg30: scores.length ? Math.round(avg(scores)) : null,
    trends,
  };
}

export async function handleStats({ method, env = {}, db, now }) {
  if (method !== "GET") return { status: 405, json: { error: "Use GET." } };
  if (env.PUBLIC_STATS !== "on") return { status: 404, json: { error: "Public stats are switched off." } };
  if (!env.OWNER_USER_ID || !db) return { status: 503, json: { error: "Stats aren't set up yet." } };
  const stats = publicStats(await db.loadDays(env.OWNER_USER_ID), londonDate(now));
  return stats ? { status: 200, json: stats } : { status: 404, json: { error: "No scored days yet." } };
}
