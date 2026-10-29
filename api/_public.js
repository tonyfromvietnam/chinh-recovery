/* =========================================================================
   GET /api/public — the owner's dashboard data for visitors, read-only.
   The owner chose to publish everything except two things, removed HERE (on the server) so they never
   leave it: bed and wake times (days and settings), and the reason for a rest day (ill / high stress
   becomes "rest"). Off unless PUBLIC_DASHBOARD=on in Vercel. Decision records are never served.
   Storage is passed in, so this is tested with no network.
   ========================================================================= */
import { londonDate, learnProfile } from "../src/engine.js";

export const PUBLIC_DASHBOARD = {
  cacheSec: 60, // Vercel's edge keeps the answer a minute
  privateDayKeys: ["bedTime", "wakeTime"],
  privateProfileKeys: ["usualWake", "wakeByDay", "weekendWake"],
};

/* Pure: what a visitor may see */
export function publicDay(day) {
  const out = { ...day };
  for (const k of PUBLIC_DASHBOARD.privateDayKeys) delete out[k];
  if (out.override) out.override = "rest";
  return out;
}

export function publicProfile(profile) {
  if (!profile) return null;
  const out = { ...profile };
  for (const k of PUBLIC_DASHBOARD.privateProfileKeys) delete out[k];
  return out;
}

/* Values learned from the full history (bed and wake times included) that are safe to share, so a visitor's
   score matches the owner's. Sleep need feeds the score; chronotype would reveal sleep timing, so it stays here. */
export function publicLearned(days, today) {
  const l = learnProfile(days, today);
  return { sleepNeedH: l.sleepNeedH, sleepNeedN: l.sleepNeedN, footballRecoveryH: l.footballRecoveryH, footballN: l.footballN };
}

export async function handlePublic({ method, env = {}, db, now }) {
  if (method !== "GET") return { status: 405, json: { error: "Use GET." } };
  if (env.PUBLIC_DASHBOARD !== "on") return { status: 404, json: { error: "The public dashboard is switched off." } };
  if (!env.OWNER_USER_ID || !db) return { status: 503, json: { error: "The public dashboard isn't set up yet." } };
  const [days, profile] = await Promise.all([db.loadDays(env.OWNER_USER_ID), db.loadProfile(env.OWNER_USER_ID)]);
  const today = londonDate(now);
  return { status: 200, json: { days: days.map(publicDay), profile: publicProfile(profile), learned: publicLearned(days, today), served: today } };
}
