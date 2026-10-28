/* =========================================================================
   POST /api/coach — the AI trainer (TECH_SPEC M8.4).
   The app sends today's summary (`coachInput`) and limits (`coachConstraints`); this checks the caller is the
   owner, claims one of today's requests, asks Claude for a session and runs the validator on the answer.
   Auth, the usage counter and Claude are passed in, so this file is tested with node:test and no network.
   Health numbers are never logged.
   ========================================================================= */
import { validateSession } from "../src/engine.js";

const reply = (status, json) => ({ status, json });
const KINDS = ["plan", "regenerate"];

export async function handleCoach({ method, headers = {}, body, env = {}, verifyUser, claim, askClaude }) {
  if (method !== "POST") return reply(405, { error: "Use POST." });
  if (!env.ANTHROPIC_API_KEY || !env.OWNER_EMAIL || !verifyUser || !claim || !askClaude) {
    return reply(500, { error: "The AI trainer isn't set up yet (see docs/SUPABASE_SETUP.md, section 8)." });
  }

  // Owner only, checked before anything that costs money
  const token = String(headers.authorization ?? headers.Authorization ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return reply(401, { error: "Sign in to use the AI trainer." });
  const user = await verifyUser(token);
  if (!user) return reply(401, { error: "Your sign-in has expired. Sign in again." });
  if (String(user.email || "").toLowerCase() !== String(env.OWNER_EMAIL).trim().toLowerCase()) {
    return reply(403, { error: "The AI trainer is for the owner only." });
  }

  let parsed = body;
  if (typeof body === "string") {
    try { parsed = JSON.parse(body); } catch { return reply(400, { error: "Body isn't valid JSON." }); }
  }
  const { kind = "plan", input, constraints } = parsed || {};
  if (!KINDS.includes(kind)) return reply(400, { error: "kind must be plan or regenerate." });
  if (!input || !constraints) return reply(400, { error: "Send today's input and constraints." });

  if (!(await claim(token, kind))) {
    return reply(429, { error: kind === "plan" ? "Today's plan is already made. Use New plan to try another." : "Today's plans are used up." });
  }

  const answer = await askClaude(input);
  if (!answer.session) return reply(502, { error: answer.error || "The AI trainer didn't answer. Showing the standard session." });
  const check = validateSession(answer.session, constraints);
  return reply(200, { ok: check.ok, errors: check.errors, session: answer.session, model: answer.model ?? null });
}
