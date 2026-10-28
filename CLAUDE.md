# CHINH – notes for Claude Code

Personal recovery dashboard: morning data → recovery score → directions → hour-by-hour plan.
Looks like the owner's homepage (www.duychinhdinh.com): four colour themes (Sand by default, Linen, Espresso, Night), Geist and Geist Mono, sharp 6 px tiles with hairline edges. British English in all copy.

## Commands

- `npm run dev` – local server at http://localhost:5173/
- `npm test` – engine tests in `tests/*.test.js` (node:test, no extra packages)
- `npm run build` – production build. Hosting is **Vercel**: it deploys every push to `main` and runs `npm test` first (`vercel.json`). GitHub Actions tests and builds every PR. Live: https://www.duychinhdinh.com/chinh-recovery. The owner's website (repo `tonyfromvietnam/website`, Vercel project `website`, domain www.duychinhdinh.com) rewrites `/chinh-recovery` and `/assets/` to this app's Vercel project (https://chinh-recovery.vercel.app), so the app keeps building at the root (`base: "/"`). Links, the Shortcut and Supabase's Site URL use the website address.

## Architecture

- `src/engine.js` – all logic, pure functions, no React. Any change to scoring, directions or the schedule goes here, with a test in `tests/engine.test.js`.
- Direction triggers live in `THRESHOLDS` in `src/engine.js`. Tune there, not inline.
- `weeklyReview(history, today)` – last 7 days vs the 7 before, focus items for next week, and a count of which directions fired (the evidence for tuning `THRESHOLDS`).
- `src/engine/*.js` – feature modules, re-exported from `src/engine.js` (always import from there): `util`, `confidence` (M1), `brief` (M2, `TARGETS`, `FACTS`), `load` (M3, `LOAD`: HRV trend + training decision), `learning` (M5, `LEARNING`, incl. football recovery from auto-detected sessions), `strap` (M7: `HR` heart-rate load, `ACTIVITY` steps/energy, `SPO2`, sleep stages), `exercises` (M8.1: `EXERCISES` library, `TRAINING` config, `buildSession`, `mobilityExtras`; old `upper`/`lower` plan days run as Full A/B via `dayTypeOf`. M8.2: `nextRung` progression, `applyWorkoutLog`, `markExtraDone`, `daySession`). New modules import from `./util.js`; keep top-level code free of imported values (the engine re-exports form an import cycle that is safe only for function bodies).
- HRV baselines are on ln(HRV): `hrv.mean` is the geometric mean for display; `hrv.lnMean`/`hrv.lnSd` drive z-scores. Override days are excluded from baselines and everything learned.
- `src/CHINHDashboard.jsx` – UI only. Calls `planDay({ checkin, history, today, profile })` and renders the result (incl. `session`, today's strength session, shown by `TrainingCard`). New cards live in `src/components/`. The per-day `override` is stored on the day record, never in the carried-over check-in. The profile (`chinh-profile`, Supabase `profile` table) holds wake times and the weekly training plan; `learned` values are recomputed from history and never stored. Older day records may still carry retired fields (`evening`, `ankleTest`, `experiment`, `busy`, and hand-logged `session`s without `auto`); ignore them. M7 strap fields: yesterday's `hrZones` (minutes per zone), `hrMax`, `steps`, `activeKcal` and an automatic `session: { type, auto: true, minutes, load }` are written to **yesterday's** record by `applyYesterday`; overnight `spo2`, `spo2Min` and `stages` go on today's record and are passed to `planDay` in the checkin, never carried over. Blood oxygen only ever supports the `rhr-high` direction; sleep stages are display only. M8.2 day fields: `workout = { dayType, exercises: [{ id, rung, extra, reps, last }], minutes, updatedAt }` (the session log; it sets the session type, the HR session keeps minutes and load) and `extrasDone = { balance|calf: { id, rung } }` (mobility-panel ticks). Today's session and mobility extras are planned from days before today only, so logging never re-plans today.
- **Server:** `api/ingest.js` (Vercel function; core in `api/_ingest.js`, tested in `tests/api-ingest.test.js`). The Shortcut can POST its link there instead of opening Safari; it runs the same `ingestSync` as the browser's sync link (`src/engine/ingest.js`: `carryOverCheckin`, `checkinDay`, `ingestSync`, `buildDecision`, `londonDate`), so app and server can't disagree. Every scoring writes an immutable row to Supabase `decisions` (`buildDecision`: inputs, baselines, parts, directions with their numbers, training decision, session, drills, `ENGINE_VERSION`). Bump `ENGINE_VERSION` when scoring, directions or the plan change. Server env vars live in Vercel only (`SUPABASE_SERVICE_ROLE_KEY`, `OWNER_USER_ID`, `INGEST_TOKEN`); never log health numbers. Day field `syncedAt` = when today's Apple Health data arrived (app or server).
- **AI trainer (M8.4):** `src/engine/coach.js` (`COACH`, `coachInput`, `coachConstraints`, `validateSession`, `sessionFromCoach`, `COACH_SCHEMA`, `COACH_SYSTEM`; tests in `tests/coach.test.js`). `buildSession` returns a `context` (kit, ankle limit, leg-power gate, football tomorrow, failure allowed, power count) so the AI is checked against the same limits as the rule-based session. `api/coach.js` (core `api/_coach.js`): owner-only (`OWNER_EMAIL`, checked via the caller's Supabase token before anything that costs money), `claim_coach_request` counts 1 plan + 3 regenerations a London day, then one structured-output Claude request (`COACH_MODEL`, default `claude-opus-5-5`, server-side refusal fallback). The answer is stored on today's record as `coach = { session, model, at }` and re-validated on every render; if it fails, the card shows the rule-based session. The M8.3-dependent Sunday note isn't built yet.
- **Public stats:** `api/stats.js` (core `api/_stats.js`, `tests/api-stats.test.js`) serves the website's homepage: latest score and day type, 30 daily scores, and HRV / RHR / sleep only as 7-day rolling averages. Nothing else leaves (no ratings, directions, override reasons or single readings). Off unless `PUBLIC_STATS=on` in Vercel; cached 15 min at the edge.
- Data arrives from an iOS Shortcut as `#hrv=…&rhr=…&sleep=…` (see `docs/APPLE_HEALTH_SHORTCUT.md`). A sync checks in straight away with no form: soreness, energy and sleep quality carry over from the last time they were rated (`ratedOn`); the check-in form is only for days something changed. History lives in `localStorage` on the device and, when signed in, syncs to Supabase (`src/supabase.js`, table `days`, setup in `docs/SUPABASE_SETUP.md`). Merge rules (`mergeHistories`, newest `updatedAt` wins) are pure functions in the engine; every write to a day must stamp `updatedAt`; each check-in also stores the direction ids that fired and how much of the plan and mobility list was ticked off.

## Scope

- Data sources: only what the Amazfit Helio Strap measures (via Zepp → Apple Health → Shortcut) plus the quick check-in ratings (soreness, ankle/hip, energy, sleep quality, ill / high-stress). Settings hold wake times, the weekly plan, equipment and session length (M8).
- Removed on 19 Oct 2026 and not to be re-added without the owner asking: evening check-out, session logging, ankle tests, experiments, weight/water/food targets, calendar and weather, blood tests, third-party app imports, AI chat, native app. CHINH is a website.
- Brought back on 22 Oct 2026 at the owner's request (M8): a quick session log and an AI trainer that picks exercises. The AI never changes the score, the training decision or the mobility list, and every AI session must pass `validateSession` or fall back to the rule-based session. Goal: strong for his size, springy and mobile, not bulk. Training is calisthenics with a pull-up bar, dip bars and resistance bands: `docs/knowledge/calisthenics-and-bands.md`.

## Rules the engine must keep

- Recovery weights: Sleep 35 · HRV & RHR 35 · Soreness 20 · Mental energy 10.
- Archetypes: High Output ≥ 80, Balanced Flow 50–79, Active Restoration < 50.
- HRV and RHR are scored against 30-day rolling baselines once 5 days exist; manual baselines before that. HRV uses ln(HRV).
- A stale sleep-quality rating (not rated today) means sleep is scored on duration only; it is still 35 %.
- Learned values (sleep need, chronotype) never change the score weights.
- Ankle/hip stiffness counts double (ongoing ankle sprain rehab).
- Mobility list always includes Knee-to-Wall Dynamic Pulses, 90/90 Hip Switches, World's Greatest Stretch and Cossack Squats. From M8.1 it also carries the daily `balance` drill (rungs 1–3 on an ankle flare).
- Every direction states the action and the number that triggered it.

## Reference

- Mobility drills and dosing: @docs/knowledge/mobility-and-movement.md
- Calisthenics and band exercises, ladders and progression: @docs/knowledge/calisthenics-and-bands.md
- Original scoring and schedule spec: @docs/knowledge/recovery-algorithm.md
- Feature research and roadmap (read before building new features): `docs/FEATURE_RESEARCH.md`
- Personalisation plan (population defaults → values learned from the owner's data): `docs/PERSONALISATION.md`
- **Build plan: `docs/TECH_SPEC.md`** — milestones M0–M8, one PR each, in order. Follow its ground rules.
- What similar products do and what to copy or avoid: `docs/SIMILAR_PRODUCTS.md`
- Personal training context lives in `CLAUDE.local.md` (git-ignored, on the owner's machine only).

## Conventions

- **Theme:** colours come from the active theme, shared with the homepage (same `theme` storage key, same domain). Tailwind's colour names keep their roles and each theme sets their values in `src/index.css` (slate-100 = main text, slate-950 = page, white = overlay tint, cyan = accent, emerald / amber / rose = high / balanced / restore). Colours set in code (charts, rings, status) must go through `tone()` from `src/theme.js`, which maps the original palette to the active theme; module-level colour tables use getters so they're read at render time. Cards use the `chinh-tile` class.

- React + Tailwind + lucide-react + Recharts. Small components, no new dependencies without a reason.
- Public repo: never commit personal health data. Exports go in `data/` (git-ignored).
