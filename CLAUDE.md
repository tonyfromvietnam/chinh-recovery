# CHINH – notes for Claude Code

Personal recovery dashboard: morning data → recovery score → directions → hour-by-hour plan.
Dark athletic UI inspired by WHOOP and Bevel. British English in all copy.

## Commands

- `npm run dev` – local server at http://localhost:5173/chinh-recovery/
- `npm test` – engine tests (node:test, no extra packages)
- `npm run build` – production build; every push to `main` tests, builds and deploys to GitHub Pages

## Architecture

- `src/engine.js` – all logic, pure functions, no React. Any change to scoring, directions or the schedule goes here, with a test in `tests/engine.test.js`.
- `src/CHINHDashboard.jsx` – UI only. Calls `planDay({ checkin, history, today })` and renders the result.
- Data arrives from an iOS Shortcut as `#hrv=…&rhr=…&sleep=…` (see `docs/APPLE_HEALTH_SHORTCUT.md`). History lives in `localStorage` on the device.

## Rules the engine must keep

- Recovery weights: Sleep 35 · HRV & RHR 35 · Soreness 20 · Mental energy 10.
- Archetypes: High Output ≥ 80, Balanced Flow 50–79, Active Restoration < 50.
- HRV and RHR are scored against 30-day rolling baselines once 5 days exist; manual baselines before that.
- Ankle/hip stiffness counts double (ongoing ankle sprain rehab).
- Mobility list always includes Knee-to-Wall Dynamic Pulses, 90/90 Hip Switches, World's Greatest Stretch and Cossack Squats.
- Every direction states the action and the number that triggered it.

## Reference

- Mobility drills and dosing: @docs/knowledge/mobility-and-movement.md
- Original scoring and schedule spec: @docs/knowledge/recovery-algorithm.md
- Personal training context lives in `CLAUDE.local.md` (git-ignored, on the owner's machine only).

## Conventions

- React + Tailwind + lucide-react + Recharts. Small components, no new dependencies without a reason.
- Public repo: never commit personal health data. Exports go in `data/` (git-ignored).
