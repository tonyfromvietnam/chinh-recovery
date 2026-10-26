import { createClient } from "@supabase/supabase-js";
import { handleIngest, supabaseDb } from "./_ingest.js";

/* Vercel function. Environment (Vercel → Project → Settings → Environment Variables, never in the browser):
   SUPABASE_URL (or VITE_SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY, INGEST_TOKEN, OWNER_USER_ID. */
export default async function handler(req, res) {
  const env = process.env;
  const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  const db = url && env.SUPABASE_SERVICE_ROLE_KEY
    ? supabaseDb(createClient(url, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } }))
    : null;
  try {
    const { status, json } = await handleIngest({ method: req.method, headers: req.headers, body: req.body, env, db, now: Date.now() });
    res.status(status).json(json);
  } catch (e) {
    // Message only: never the request body or any health numbers
    console.error("ingest failed:", e?.message);
    res.status(500).json({ error: "Couldn't save today's sync. Try again, or open CHINH to sync from the browser." });
  }
}
