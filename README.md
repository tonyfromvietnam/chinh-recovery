# CHINH – Health & Recovery

A dark-mode daily recovery dashboard that turns a morning check-in into an hour-by-hour action plan.

## What it does

- **Morning check-in:** sleep duration and quality, HRV and resting heart rate against your own baselines, soreness (upper, lower, ankle/hips) and mental energy.
- **Recovery score (0–100%):** Sleep 35% · HRV & RHR 35% · Soreness 20% · Mental energy 10%. Ankle/hip stiffness counts double during sprain rehab.
- **Day archetype**
  - **High Output** (≥ 80%): heavy lifting or football, deep focus blocks
  - **Balanced Flow** (50–79%): technique-focused hypertrophy, structured work, mobility
  - **Active Restoration** (< 50%): breathwork, foam rolling, errands, passive study
- **Time-blocked schedule** with checkboxes and a completion ring.
- **Mobility panel** ranked by stiffness: Knee-to-Wall Pulses, 90/90 Hip Switches, Cossack Squats, World's Greatest Stretch, plus loaded drills on higher-recovery days.

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:5173.

## Stack

Vite · React 18 · Tailwind CSS · Recharts · lucide-react

## Project layout

```
src/
  CHINHDashboard.jsx   recovery engine, schedule generator, mobility engine and UI
  main.jsx             entry point
  index.css            Tailwind + slider styles
```

The engine functions (`calculateRecovery`, `getArchetype`, `generateSchedule`, `buildMobility`) are exported so they can move into their own module and get unit tests.

## Roadmap

- [ ] Import Zepp data (CSV export → parse sleep, resting HR, HRV)
- [ ] Persist check-in history (Supabase) and replace the example 7-day trend
- [ ] PWA install for phone check-ins
- [ ] TypeScript migration and engine unit tests

## Privacy

This repo is public. Personal health exports belong in `data/`, which is git-ignored. Never commit them.
