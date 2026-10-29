import { createClient } from "@supabase/supabase-js";
import { supabaseDb } from "./_ingest.js";
import { handlePublic, PUBLIC_DASHBOARD } from "./_public.js";

/* Vercel function: the read-only public dashboard. Environment (Vercel only): PUBLIC_DASHBOARD=on to publish,
   plus the SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and OWNER_USER_ID that api/ingest.js uses. */
export default async function handler(req, res) {
  const env = process.env;
  const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  const db = url && env.SUPABASE_SERVICE_ROLE_KEY
    ? supabaseDb(createClient(url, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } }))
    : null;
  try {
    const { status, json } = await handlePublic({ method: req.method, env, db, now: Date.now() });
    if (status === 200) res.setHeader("Cache-Control", `public, s-maxage=${PUBLIC_DASHBOARD.cacheSec}, stale-while-revalidate=300`);
    res.status(status).json(json);
  } catch (e) {
    console.error("public failed:", e?.message);
    res.status(500).json({ error: "The public dashboard is unavailable right now." });
  }
}
