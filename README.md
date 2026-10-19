# CHINH – Health & Recovery

A dark-mode daily recovery dashboard that turns last night's data into directions and an hour-by-hour action plan.

**Live:** https://chinh-recovery.vercel.app/

## The pipeline

```
Helio Strap → Zepp → Apple Health → iOS Shortcut → CHINH
                                     (#hrv=…&rhr=…&sleep=…)
   → history on this device → 30-day rolling baselines → score
   → day archetype → directions (stop / adjust / go) → schedule + mobility
```

Set-up guide for the Shortcut: [docs/APPLE_HEALTH_SHORTCUT.md](docs/APPLE_HEALTH_SHORTCUT.md).

## What it does

- **Apple Health sync:** the Shortcut fills in sleep, HRV and resting HR. You rate soreness and energy.
- **Personal baselines:** after 5 check-ins, HRV and resting HR are scored against your own 30-day mean and spread.
- **Recovery score (0–100%):** Sleep 35% · HRV & RHR 35% · Soreness 20% · Mental energy 10%. Ankle/hip stiffness counts double during sprain rehab.
- **Day archetype:** High Output (≥ 80%), Balanced Flow (50–79%), Active Restoration (< 50%).
- **Directions:** each tells you what to do and shows the number that triggered it. Covers HRV drops, raised resting HR, 3-night sleep debt, ankle flares, lower-body soreness, low energy and 3-day falling trends.
- **Adaptive schedule:** swaps training on low-HRV days, moves wind-down earlier under sleep debt, blocks football on ankle flares.
- **Mobility panel** ranked by stiffness: Knee-to-Wall Pulses, 90/90 Hip Switches, Cossack Squats, World's Greatest Stretch, plus loaded drills on higher-recovery days.

## Run it

```bash
npm install
npm run dev     # http://localhost:5173/
npm test        # engine unit tests, no extra packages needed
```

Every push to `main` is tested and deployed by Vercel (`vercel.json` runs `npm test` before the build). GitHub Actions tests and builds every pull request.

## Project layout

```
src/
  engine.js            sync parsing, baselines, score, directions, schedule, mobility (pure JS)
  CHINHDashboard.jsx   UI
  main.jsx, index.css
tests/engine.test.js   node:test suite for the engine
docs/                  Apple Health Shortcut guide
```

## Roadmap

- [x] Apple Health sync via Shortcut
- [x] Rolling personal baselines and data-driven directions
- [x] One-time 30-day backfill from Apple Health
- [x] Sync history across devices (Supabase)
- [x] M0 Data fixes: 2 years of history, ln(HRV) baselines, overnight HRV, bed/wake times, stale-quality guard
- [x] M1 Data confidence, ill / high-stress override, calendar-aware plan, evening check-out
- [x] M2 Morning brief: train call, water, food, bedtime and cut-offs, daily focus, fact of the day
- [x] M3 Session log, training load, 7-day HRV trend, train / cap / reduce / recover decision
- [x] M4 Weekly ankle tests, left vs right
- [x] M5 Learned sleep need, chronotype, football recovery, habit effects, score check, baseline shifts
- [x] M6 Personal experiments
- [ ] M7 More from the Helio Strap: heart-rate training load, steps & active energy, overnight blood oxygen, sleep stages (see `docs/TECH_SPEC.md`)

**Scope:** CHINH only uses what the Amazfit Helio Strap measures (via Zepp → Apple Health) plus quick self-ratings. It stays a website, hosted on Vercel; there's no native app, blood-test tracking or third-party app imports.

## Privacy

This repo is public; your data never enters it. Health numbers travel in the part of the link after `#`, which browsers don't send to servers, and history is stored only in your browser. Personal exports belong in `data/`, which is git-ignored.
