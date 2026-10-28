import { createClient } from "@supabase/supabase-js";
import { supabaseDb } from "./_ingest.js";
import { handleStats, PUBLIC } from "./_stats.js";

/* Vercel function: the public summary the website shows. Environment (Vercel only):
   PUBLIC_STATS=on to publish, plus the SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and OWNER_USER_ID that api/ingest.js uses. */
export default async function handler(req, res) {
  const env = process.env;
  const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  const db = url && env.SUPABASE_SERVICE_ROLE_KEY
    ? supabaseDb(createClient(url, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } }))
    : null;
  try {
    const { status, json } = await handleStats({ method: req.method, env, db, now: Date.now() });
    if (status === 200) res.setHeader("Cache-Control", `public, s-maxage=${PUBLIC.cacheSec}, stale-while-revalidate=3600`);
    res.status(status).json(json);
  } catch (e) {
    console.error("stats failed:", e?.message);
    res.status(500).json({ error: "Stats are unavailable right now." });
  }
}
