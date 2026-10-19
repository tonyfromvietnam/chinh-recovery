# CHINH – notes for Claude Code

Personal recovery dashboard: morning data → recovery score → directions → hour-by-hour plan.
Dark athletic UI inspired by WHOOP and Bevel. British English in all copy.

## Commands

- `npm run dev` – local server at http://localhost:5173/chinh-recovery/
- `npm test` – engine tests in `tests/*.test.js` (node:test, no extra packages)
- `npm run build` – production build; every push to `main` tests, builds and deploys to GitHub Pages

## Architecture

- `src/engine.js` – all logic, pure functions, no React. Any change to scoring, directions or the schedule goes here, with a test in `tests/engine.test.js`.
- Direction triggers live in `THRESHOLDS` in `src/engine.js`. Tune there, not inline.
- `weeklyReview(history, today)` – last 7 days vs the 7 before, focus items for next week, and a count of which directions fired (the evidence for tuning `THRESHOLDS`).
- `src/engine/*.js` – feature modules, re-exported from `src/engine.js` (always import from there): `util`, `confidence` (M1), `calendar` (M1), `evening` (M1), `brief` (M2, `TARGETS`, `FACTS`), `load` (M3, `LOAD`), `ankle` (M4), `learning` (M5, `LEARNING`), `experiments` (M6). New modules import from `./util.js`; keep top-level code free of imported values (the engine re-exports form an import cycle that is safe only for function bodies).
- HRV baselines are on ln(HRV): `hrv.mean` is the geometric mean for display; `hrv.lnMean`/`hrv.lnSd` drive z-scores. Override days are excluded from baselines and everything learned.
- `src/CHINHDashboard.jsx` – UI only. Calls `planDay({ checkin, history, today, profile, busy, fixtures, maxTempC })` and renders the result. New cards live in `src/components/`. Per-day fields (`busy`, `fixtures`, `override`, `evening`, `session`, `ankleTest`, `experiment`) are stored on the day record, never in the carried-over check-in. The profile (`chinh-profile`, Supabase `profile` table) holds weight, wake times, weekly template and the active experiment; `learned` values are recomputed from history and never stored.
- Data arrives from an iOS Shortcut as `#hrv=…&rhr=…&sleep=…` (see `docs/APPLE_HEALTH_SHORTCUT.md`). A sync checks in straight away with no form: soreness, energy and sleep quality carry over from the last time they were rated (`ratedOn`); the check-in form is only for days something changed. History lives in `localStorage` on the device and, when signed in, syncs to Supabase (`src/supabase.js`, table `days`, setup in `docs/SUPABASE_SETUP.md`). Merge rules (`mergeHistories`, newest `updatedAt` wins) are pure functions in the engine; every write to a day must stamp `updatedAt`; each check-in also stores the direction ids that fired and how much of the plan and mobility list was ticked off.

## Rules the engine must keep

- Recovery weights: Sleep 35 · HRV & RHR 35 · Soreness 20 · Mental energy 10.
- Archetypes: High Output ≥ 80, Balanced Flow 50–79, Active Restoration < 50.
- HRV and RHR are scored against 30-day rolling baselines once 5 days exist; manual baselines before that. HRV uses ln(HRV).
- A stale sleep-quality rating (not rated today) means sleep is scored on duration only; it is still 35 %.
- Learned values (sleep need, football recovery, chronotype) never change the score weights; `predictiveCheck` only reports.
- Ankle/hip stiffness counts double (ongoing ankle sprain rehab).
- Mobility list always includes Knee-to-Wall Dynamic Pulses, 90/90 Hip Switches, World's Greatest Stretch and Cossack Squats.
- Every direction states the action and the number that triggered it.

## Reference

- Mobility drills and dosing: @docs/knowledge/mobility-and-movement.md
- Original scoring and schedule spec: @docs/knowledge/recovery-algorithm.md
- Feature research and roadmap (read before building new features): `docs/FEATURE_RESEARCH.md`
- Personalisation plan (population defaults → values learned from the owner's data): `docs/PERSONALISATION.md`
- **Build plan: `docs/TECH_SPEC.md`** — milestones M0–M7, one PR each, in order. Follow its ground rules.
- What similar products do and what to copy or avoid: `docs/SIMILAR_PRODUCTS.md`
- Personal training context lives in `CLAUDE.local.md` (git-ignored, on the owner's machine only).

## Conventions

- React + Tailwind + lucide-react + Recharts. Small components, no new dependencies without a reason.
- Public repo: never commit personal health data. Exports go in `data/` (git-ignored).
