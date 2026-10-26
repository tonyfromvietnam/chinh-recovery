/* =========================================================================
   POST /api/ingest — the morning sync without a browser.
   The Shortcut sends the same link it would open in Safari (or the readings as JSON). This scores the
   day with the same engine the app uses, saves the day records and keeps an immutable decision record.
   Storage is passed in (`db`) so this file is tested with node:test and no network.
   Health numbers are never logged.
   ========================================================================= */
import { timingSafeEqual } from "node:crypto";
import {
  parseSyncHash, carryOverCheckin, ingestSync, buildDecision, decisionSummary, londonDate, ENGINE_VERSION,
} from "../src/engine.js";

const reply = (status, json) => ({ status, json });

function tokenOk(header, expected) {
  const given = String(header || "").replace(/^Bearer\s+/i, "");
  const a = Buffer.from(given), b = Buffer.from(String(expected));
  return a.length === b.length && timingSafeEqual(a, b);
}

/* Accepts {link: "https://…/#hrv=58&rhr=54&sleep=26640"}, {hash}, {query}, a raw string,
   or flat JSON {hrv: 58, rhr: 54, sleep: 26640}. Returns the "#…" fragment parseSyncHash reads. */
export function toHash(body) {
  if (body == null) return null;
  const raw = typeof body === "string" ? body : body.link ?? body.hash ?? body.query ?? null;
  if (raw != null) {
    const s = String(raw).trim();
    const at = s.indexOf("#") >= 0 ? s.indexOf("#") : s.indexOf("?");
    return `#${at >= 0 ? s.slice(at + 1) : s}`;
  }
  if (typeof body !== "object") return null;
  const params = Object.entries(body).filter(([, v]) => v != null && typeof v !== "object").map(([k, v]) => [k, String(v)]);
  return params.length ? `#${new URLSearchParams(params).toString()}` : null;
}

export async function handleIngest({ method, headers = {}, body, env = {}, db, now }) {
  if (method !== "POST") return reply(405, { error: "Use POST." });
  if (!env.INGEST_TOKEN || !env.OWNER_USER_ID || !db) {
    return reply(500, { error: "Server sync isn't set up yet (see docs/SUPABASE_SETUP.md, section 7)." });
  }
  if (!tokenOk(headers.authorization ?? headers.Authorization, env.INGEST_TOKEN)) return reply(401, { error: "Wrong or missing token." });

  let parsedBody = body;
  if (typeof body === "string" && body.trim().startsWith("{")) {
    try { parsedBody = JSON.parse(body); } catch { return reply(400, { error: "Body isn't valid JSON." }); }
  }
  const synced = parseSyncHash(toHash(parsedBody));
  if (!synced) return reply(400, { error: "No readings found. Send the CHINH link, or hrv / rhr / sleep." });

  const userId = env.OWNER_USER_ID;
  const today = londonDate(now);
  const [history, profile] = await Promise.all([db.loadDays(userId), db.loadProfile(userId)]);
  const out = ingestSync({ history, checkin: carryOverCheckin(history), synced, today, profile, now });

  const version = env.VERCEL_GIT_COMMIT_SHA ? `${ENGINE_VERSION}+${env.VERCEL_GIT_COMMIT_SHA.slice(0, 7)}` : ENGINE_VERSION;
  const decision = buildDecision({ plan: out.plan, checkin: { ...out.checkin, ...(synced.overnight || {}) }, today, source: "shortcut", now, version });
  await db.saveDays(userId, out.changedDates.map((d) => out.history.find((h) => h.date === d)).filter(Boolean));
  await db.saveDecision(userId, decision);

  const top = out.plan.directives[0] || null;
  return reply(200, {
    ok: true, date: today, score: out.plan.result.score, archetype: out.plan.archetype.label,
    summary: decisionSummary(out.plan),
    top: top && { title: top.title, why: top.why, action: top.action },
    baseline: out.plan.baselines.source,
  });
}

/* The Supabase storage used in production (service-role client, owner's rows only) */
export function supabaseDb(client) {
  return {
    async loadDays(userId) {
      const { data, error } = await client.from("days").select("data").eq("user_id", userId).order("date");
      if (error) throw error;
      return data.map((r) => r.data);
    },
    async loadProfile(userId) {
      const { data, error } = await client.from("profile").select("data").eq("user_id", userId).maybeSingle();
      if (error) throw error;
      return data?.data ?? null;
    },
    async saveDays(userId, days) {
      if (!days.length) return;
      const rows = days.map((d) => ({ user_id: userId, date: d.date, data: d, updated_at: new Date().toISOString() }));
      const { error } = await client.from("days").upsert(rows, { onConflict: "user_id,date" });
      if (error) throw error;
    },
    async saveDecision(userId, decision) {
      const { error } = await client.from("decisions").insert({ user_id: userId, date: decision.date, source: decision.source, data: decision });
      if (error) throw error;
    },
  };
}
