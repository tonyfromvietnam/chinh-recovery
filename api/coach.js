import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { handleCoach } from "./_coach.js";
import { COACH_SCHEMA, COACH_SYSTEM } from "../src/engine.js";

/* Vercel function. Environment (Vercel → Project → Settings → Environment Variables, never in the browser):
   ANTHROPIC_API_KEY, OWNER_EMAIL, optional COACH_MODEL (default claude-opus-5-5),
   SUPABASE_URL + SUPABASE_ANON_KEY (or the VITE_ versions the app already has). No service-role key:
   the caller's own sign-in token is used, so row-level security still applies. */
export const config = { maxDuration: 60 };

const DEFAULT_MODEL = "claude-opus-5-5";

function supabaseFor(env, token) {
  const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  const key = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: token ? { Authorization: `Bearer ${token}` } : {} },
  });
}

/* One structured-output request. A refusal falls back server-side to the model Anthropic recommends. */
async function askClaude(env, input) {
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const model = env.COACH_MODEL || DEFAULT_MODEL;
  try {
    const response = await client.beta.messages.create({
      model,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: { type: "json_schema", schema: COACH_SCHEMA } },
      system: COACH_SYSTEM,
      messages: [{ role: "user", content: `Today's data (JSON):\n${JSON.stringify(input)}` }],
    });
    if (response.stop_reason === "refusal") return { error: "The AI trainer declined today. Showing the standard session." };
    if (response.stop_reason === "max_tokens") return { error: "The AI trainer's answer was cut off. Showing the standard session." };
    const text = response.content.filter((b) => b.type === "text").map((b) => b.text).join("");
    try {
      return { session: JSON.parse(text), model: response.model };
    } catch {
      return { error: "The AI trainer's answer wasn't valid. Showing the standard session." };
    }
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) return { error: "The Anthropic API key isn't valid. Check ANTHROPIC_API_KEY in Vercel." };
    if (e instanceof Anthropic.RateLimitError) return { error: "The AI trainer is busy. Try again in a minute." };
    if (e instanceof Anthropic.APIError) return { error: `The AI trainer had an error (${e.status ?? "network"}). Showing the standard session.` };
    throw e;
  }
}

export default async function handler(req, res) {
  const env = process.env;
  const anon = supabaseFor(env, null);
  try {
    const { status, json } = await handleCoach({
      method: req.method, headers: req.headers, body: req.body, env,
      verifyUser: anon && (async (token) => {
        const { data, error } = await anon.auth.getUser(token);
        return error ? null : data.user;
      }),
      claim: anon && (async (token, kind) => {
        const { data, error } = await supabaseFor(env, token).rpc("claim_coach_request", { kind });
        if (error) throw error;
        return data === true;
      }),
      askClaude: (input) => askClaude(env, input),
    });
    res.status(status).json(json);
  } catch (e) {
    // Message only: never the request body or any health numbers
    console.error("coach failed:", e?.message);
    res.status(500).json({ error: "The AI trainer couldn't run. Showing the standard session." });
  }
}
