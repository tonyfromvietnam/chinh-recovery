# CHINH technical spec: build plan for Claude Code

The build plan for everything in `FEATURE_RESEARCH.md` and `PERSONALISATION.md`, split into milestones. **One milestone = one PR**, done in order. Each milestone lists the data changes, engine API, UI, Shortcut changes, tests and acceptance criteria.

**How to use it:** tell Claude Code *"Implement M1 from docs/TECH_SPEC.md and open a PR."* Each milestone also has a GitHub issue.

Background reading: `FEATURE_RESEARCH.md` (the science), `PERSONALISATION.md` (what's learned from you), `SIMILAR_PRODUCTS.md` (what others do).

---

## 0. Ground rules (apply to every milestone)

1. **Engine stays pure.** All logic goes in `src/engine.js` (or new `src/engine/*.js` modules re-exported from it) with no React, no `Date.now()` inside logic (pass `now`/`today` in), and no I/O.
2. **Every engine change has a test** in `tests/` (`node:test`, no new dev dependencies). `npm test` must pass.
3. **Tunable numbers live in config objects,** like `THRESHOLDS`. Never inline a magic number in a rule. New configs: `TARGETS`, `LEARNING`, `CONFIDENCE`.
4. **Project rules from `CLAUDE.md` stay intact:**
   - weights 35/35/20/10
   - archetype cut-offs
   - ankle counts double
   - the four required drills
   - every direction states its action and its number
5. **Every write to a day stamps `updatedAt`** (sync merge depends on it).
6. **Backwards compatible:**
   - **Old days:** may lack any new field; every function must treat a missing field as "unknown", never as 0.
   - **Old Shortcut links:** must keep working.
7. **No personal data in the repo.** Examples use invented values.
8. **British English** in all copy. Times are 24-hour `HH:MM`.
9. **Supabase:** a day's whole record lives in `days.data` (jsonb), so new day fields sync with no schema change. New *tables* need SQL in `supabase/schema.sql` plus a line in `docs/SUPABASE_SETUP.md`.
10. **Engine size:** when `engine.js` passes ~900 lines, split it into `src/engine/{sync,baselines,score,directions,schedule,brief,load,learning}.js` and re-export from `src/engine.js`. Keep the import path stable for the UI and tests.

---

## 1. Data model

### 1.1 Day record (`history[]`, `days.data`)

Existing fields stay. New fields are marked with their milestone.

| Field | Type | Since | Notes |
|---|---|---|---|
| `date` | `"YYYY-MM-DD"` | — | key |
| `hrv`, `rhr`, `sleepHours`, `sleepQuality`, `upper`, `lower`, `ankleHip`, `energy`, `score` | number | — | as today |
| `directives` | string[] | — | ids fired |
| `blocksDone`, `blocksTotal`, `drillsDone` | number | — | adherence |
| `ratedOn`, `source`, `updatedAt` | — | — | as today |
| `hrvCount` | number | M0 | HRV readings the value is averaged from |
| `hrvWindow` | `"overnight"` \| `"24h"` | M0 | how the Shortcut measured it; old days = `"24h"` |
| `sleepQualityRatedOn` | date | M0 | when quality was last actually rated |
| `bedTime`, `wakeTime` | `"HH:MM"` | M0 | main sleep block only |
| `override` | `"ill"` \| `"stress"` \| null | M1 | Go-Gentler-style override |
| `confidence` | `"high"` \| `"medium"` \| `"low"` | M1 | computed and stored for history |
| `busy` | `[{start,end}]` minutes from midnight | M1 | calendar busy blocks, no titles |
| `fixtures` | `[{type:"football", start}]` | M1 | from the calendar keyword |
| `evening` | object | M1 | see 1.3 |
| `session` | object \| null | M3 | see 1.4 |
| `ankleTest` | object \| null | M4 | see 1.5 |
| `experiment` | `{id, arm}` \| null | M6 | condition assigned for the day |

### 1.2 Profile (new, M2)

- **localStorage:** key `chinh-profile`.
- **Supabase:** new table `profile` (one row per user, same RLS pattern as `days`: `user_id` PK, `data` jsonb, `updated_at`).
- **Merge:** newest `updatedAt` wins.

```js
{
  weightKg: 75,                 // updated weekly; trend kept in weightLog
  weightLog: [{ date, kg }],    // optional daily/weekly weigh-ins (M2 trend)
  usualWake: "07:00",
  wakeByDay: { sat: "08:30", sun: "08:30" },   // optional overrides
  template: { mon: "upper", tue: "lower", wed: "football", thu: "upper",
              fri: "lower", sat: "football", sun: "rest" },
  footballKeyword: "football",  // calendar event title match (never stored/sent)
  location: { lat: 51.51, lon: -0.13 },        // for weather; London default
  sweatRateLph: null,           // from the one-off weigh test (M2)
  learned: {                    // written by M5; null until confident
    sleepNeedH: null, chronotypeMSF: null, socialJetlagH: null,
    footballRecoveryH: null, updatedOn: null
  },
  updatedAt
}
```

### 1.3 Evening check-out (M1)

```js
evening: { stress: 1-5, alcohol: 0|1|2,   // 0 none, 1 = 1–2 drinks, 2 = 3+
           lastCaffeine: "HH:MM"|null, lastMeal: "HH:MM"|null,
           tags: ["late-screen", ...],    // optional custom tags
           at: ISO }
```

### 1.4 Session (M3)

```js
session: { type: "upper"|"lower"|"football"|"zone2"|"other",
           start: "HH:MM", minutes: 60, rpe: 1-10, quality: 1-5,
           context: { competitive: bool, surface: "grass"|"3g"|null } }
```

### 1.5 Ankle test (M4)

```js
ankleTest: { k2wL: cm, k2wR: cm, balL: s, balR: s, hopL: 0-5, hopR: 0-5, injured: "L"|"R" }
```

---

## 2. Shortcut contract v2

All parameters are optional, and v1 links keep working. The engine parses everything in `parseSyncHash`, validates each field and drops anything out of range.

| Param | Example | Range / format | Milestone |
|---|---|---|---|
| `hrv` | `58` | 5–300 ms | existing |
| `rhr` | `54` | 25–120 bpm | existing |
| `sleep` | `26640` | h / min / s, normalised to h | existing |
| `sq` | `7` | 1–10 | existing |
| `hrvn` | `3` | 0–50, count of HRV samples | M0 |
| `hw` | `o` | `o` = overnight window, else 24 h | M0 |
| `bed` | `23:12` | `HH:MM` | M0 |
| `wake` | `07:04` | `HH:MM` | M0 |
| `busy` | `0930-1030,1400-1500` | comma list of `HHMM-HHMM` | M1 |
| `fb` | `1900` | `HHMM`; football fixture start | M1 |

**Shortcut changes** (update `docs/APPLE_HEALTH_SHORTCUT.md` in the same PR):

- **HRV (M0):** Start Date **is after** *Start of Today* (since midnight; the sync runs at wake). Add **Count** → `hrvn`. Append `&hw=o`.
- **Sleep (M0):** Start Date **is after** *yesterday 18:00*: Date → Start of Day → Subtract 6 hours. This excludes afternoon naps.
  - `bed` = earliest Start Date (Sort Start Date ascending, Limit 1, Format Date `HH:mm`).
  - `wake` = latest End Date (Sort End Date latest first, Limit 1, `HH:mm`).
- **Calendar (M1):** **Find Calendar Events** where Start Date is today, Calendar is the chosen calendars. **Repeat with each:** if Title contains the football keyword, set `fb`. Otherwise add `HHmm-HHmm` to a list. Combine with `,`. Only times leave the phone, never titles.
- **BackFill (M0):**
  - HRV window becomes 00:00–10:00 of each day. Add `hrvn` as a 5th column and `bed`/`wake` as 6th/7th.
  - `parseBackfillHash` must accept 4-, 5- and 7-column rows.

---

## M0 — Fix the five gaps

**Goal:** stop the data limiting what CHINH can learn. No new UI except one prompt.

### Engine
1. `HISTORY_MAX_DAYS = 730` and `upsertDay` slices to it. Test: 800 inserts keep the newest 730.
2. **ln(HRV) baselines.** In `computeBaselines`, compute mean and SD of `Math.log(hrv)`.
   - Expose `hrv.mean` as `Math.exp(lnMean)` (geometric mean, for display) and `hrv.lnMean`, `hrv.lnSd`.
   - `calculateRecovery` z-score = `(ln(c.hrv) − lnMean) / lnSd`.
   - Floor `lnSd` at `0.05` (replaces the 5 %-of-mean floor).
   - Manual-baseline fallback: `lnMean = ln(manual.hrvBaseline)`, `lnSd = 0.1`.
   - Tests: existing tests still pass after updating expected numbers; a symmetric pair of values (e.g. 50 and 72 around 60) gives z-scores of opposite sign and similar size.
3. **Overnight HRV.** `parseSyncHash` reads `hrvn` → `hrvCount` and `hw` → `hrvWindow`.
4. **Bed and wake.** `parseSyncHash` reads `bed`/`wake` → `bedTime`/`wakeTime` (validate `HH:MM`, 00:00–23:59).
5. **Stale sleep quality.** `sleepQualityRatedOn` is stamped whenever quality comes from the form or the new prompt.
   - In `calculateRecovery`, if quality is stale (`sleepQualityRatedOn` ≠ the check-in date), the sleep component uses **duration only**: `value = clamp01(sleepHours / sleepNeed)`.
   - It's still 35 % of the score, so the weights rule holds.
   - Return `sleepQualityStale: true` so the UI can say so.

### UI
- **Post-sync prompt:** after a no-form sync, the notice shows **"How rested do you feel?"** with three buttons: **Poor (3) · OK (6) · Great (9)**. One tap sets `sleepQuality` and `sleepQualityRatedOn`, then re-scores. Dismissing keeps the duration-only score.

### Docs
- Update the Shortcut guide (HRV since midnight + count, sleep from 18:00, bed/wake, BackFill columns).
- Note in `CLAUDE.md` that baselines use ln(HRV).

### Tests (new)
- `history: keeps 730 days`
- `baselines: ln-HRV z-scores are symmetric`
- `sync link: reads hrvn, hw, bed, wake`
- `backfill: accepts 4, 5 and 7 columns`
- `score: stale sleep quality falls back to duration only`

**Done when:** all tests pass, an old v1 link still checks in, and the weekly review shows no change in behaviour beyond the ln switch.

---

## M1 — Data foundations

**Goal:** collect the signals every later feature learns from.

### 1. Data confidence
```js
export const CONFIDENCE = { highMinHrvCount: 2 };
export function dataConfidence(day) // → { level: "high"|"medium"|"low", reasons: string[] }
```
| Level | Rule |
|---|---|
| **high** | `hrvWindow === "overnight"` and `hrvCount ≥ 2` and sleep present |
| **medium** | HRV present but 24 h window or count 1, or sleep missing |
| **low** | no HRV, or `override` set |

- `computeBaselines` **excludes `low` days and override days**.
- `planDay` returns `confidence`, stored on the day.

### 2. "Feeling ill / high stress" override (from Gentler Streak)
- A toggle on the check-in.
- When set: archetype is forced to `restore`, directions add `{ id: "override", level: "stop", why: "You marked today as ill/high stress." }`, and the day is excluded from baselines and learning.

### 3. Calendar-aware schedule
```js
export function parseBusy(str)                      // "0930-1030,1400-1500" → [{start:570,end:630}, …]
export function fitScheduleToCalendar(schedule, busy, fixtures) // → { schedule, moved: [...], dropped: [...] }
```
- **Block types:**
  - **Movable:** `focus`, `study`, `mobility`, `breath`, `errands`, `training`.
  - **Fixed:** `sun`, `fuel`, `wind`.
- **Moving rules:**
  - Each movable block that overlaps a busy block moves to the nearest free slot of equal length between 07:00 and 21:00.
  - **Deep work** gets the longest free block before 13:00 if one exists.
  - If there's no slot, the block is shortened down to 50 % (minimum 15 min); otherwise it's dropped and listed in `dropped`.
- **Football fixture:** the training block becomes the fixture. Also insert a **FIFA 11+ warm-up** 20 min before it, and a **pre-match meal** block 2.5 h before.
- **Wired in:** `planDay({checkin, history, today, busy, fixtures})` calls it after `generateSchedule`.

### 4. Evening check-out
- **When:** shown after 19:00 if `evening` isn't set for today.
- **Fields:** stress 1–5, alcohol 0/1/2, last caffeine `HH:MM` (with a "none" button), last meal `HH:MM`.
- **Effort:** under 10 seconds. Saves to `day.evening` with `updatedAt`.
- **Engine helper:** `export function eveningTags(day) → string[]`, for example:
  - `"alcohol"`
  - `"late-caffeine"` (after the cut-off from M2, or 14:00 before M2 exists)
  - `"late-meal"` (within 3 h of bed, or after 21:00 before M2)
  - `"high-stress"` (stress ≥ 4)

### UI
- Confidence badge on the recovery card (dot + tooltip listing the reasons).
- Override toggle on the check-in.
- Evening card.
- "Moved/dropped" note on the schedule.
- **Baseline initialising state** (from Garmin): "Learning your baseline: 12/19 nights" until 19 high/medium nights exist.

### Tests
- `confidence: overnight with 2+ readings is high`
- `confidence: override is low and excluded from baselines`
- `calendar: block overlapping a meeting moves to the nearest free slot`
- `calendar: deep work takes the longest morning gap`
- `calendar: football fixture adds 11+ warm-up and pre-match meal`
- `calendar: no free slot shortens then drops`
- `evening: tags derive from check-out`

**Done when:** a sync link with `busy` and `fb` produces a schedule with no overlaps, and the evening check-out persists and syncs.

---

## M2 — Morning brief (V1.2)

**Goal:** answer today's questions directly: train, water, food, bedtime, focus, fact.

### Profile & settings
- **Settings modal:** weight, usual wake time, weekend wake, weekly template (7 dropdowns), football calendar keyword.
- **Weigh-ins:** optional; adds to `weightLog`.
- **Storage:** `profile` table + localStorage (see 1.2).
- **Engine helper:** `export function trendWeight(weightLog, today)`. An exponentially weighted moving average (α = 0.1, the MacroFactor-style trend) used for every per-kg target, never a single weigh-in.

### Targets (`TARGETS` config)
```js
export const TARGETS = {
  sleepNeedH: 8, sleepLatencyMin: 15, debtRepayMinPerNight: 30, hardTomorrowMin: 15, maxShiftEarlierMin: 45,
  caffeineCutoffH: 8.8, preworkoutCutoffH: 13.2, lastMealBeforeBedH: 3, showerBeforeBedH: [1, 2], screensOffMin: 60,
  waterBaseL: 2.0, waterPerTrainingHourL: [0.5, 0.75], warmDayC: 25, warmDayExtraL: 0.5, rhrFlagExtraL: 0.5,
  proteinGPerKg: 1.6, proteinMeals: 4,
  carbsGPerKg: { rest: [3, 4], lift: [4, 5], football: [5, 7] },
};
```

### Engine functions
```js
export function targetBedtime({ wakeTomorrow, sleepNeedH, debtH, hardTomorrow, avgBed7 }) // → { time:"HH:MM", reason }
//   bed = wake − need − latency − min(debtH*60, debtRepay) − (hardTomorrow ? hardTomorrowMin : 0)
//   clamp to avgBed7 − maxShiftEarlierMin … avgBed7 + 30 (if avgBed7 known)
export function eveningCutoffs(bedtime)   // → { coffee, preworkout, lastMeal, shower:[from,to], screensOff }
export function waterTarget({ weightKg, sessionMinutes, maxTempC, rhrFlag, sweatRateLph }) // → { litres, parts:[{label,litres}] }
export function nutritionTargets({ weightKg, dayType })   // → { proteinG, perMealG, carbsG:[lo,hi], mealTimes:{...} }
export function plannedSession(profile, today)          // → "upper"|"lower"|"football"|"rest"|…
export function dailyFocus({ result, baselines, debt, trend, ankle, load }) // → one { id, title, why, action }
export function factOfTheDay(ctx, seed)                 // → { text, source } chosen from FACTS whose when(ctx) is true
```
- **`waterTarget`:** with `sweatRateLph` set, training litres = `sweatRateLph × hours × 1.25`. Parts always add up to the total.
- **`nutritionTargets` meal times:**
  - **Pre-training meal:** session start − 2.5 h.
  - **Post-training protein:** within 2 h after the session.
  - **Dinner:** by the `lastMeal` cut-off.
  - **Pre-sleep protein:** only if `dayType` is lift or football.
- **`FACTS`:** an array of `{ id, when(ctx), text(ctx), source }`, at least 15 entries, every one with a source from `FEATURE_RESEARCH.md`.
  - `seed` = date, so the fact is stable for the whole day.
  - Prefer a fact whose `when` matches today's data; fall back to a general one.
- **Weather:** fetched in the UI from Open-Meteo (`https://api.open-meteo.com/v1/forecast?latitude=…&longitude=…&daily=temperature_2m_max&timezone=Europe/London`). No key. On failure, `maxTempC = null`.

### UI: `BriefCard` at the top of the page
- **Headline:** "Balanced Flow, 68 %" plus one sentence.
- **Five rows, each with its number:**
  - **Train:** planned session + matrix decision. Until M3, use the archetype and directions.
  - **Water:** total + parts.
  - **Food:** protein per meal, carbs range, meal times.
  - **Tonight:** bedtime + coffee/meal cut-offs.
  - **Focus:** the daily focus.
- **Footer:** "Did you know?" fact with its source link.
- **Plan coupling:** the schedule's `wind` block uses `targetBedtime − 60 min` instead of fixed times, and `fuel` blocks use the meal times.

### Tests
- `bedtime: debt moves it earlier by at most the clamp`
- `bedtime: hard session tomorrow adds 15 min`
- `cutoffs: coffee is 8.8 h before bed`
- `water: parts add up; sweat-rate overrides the default`
- `nutrition: 75 kg lift day gives 120 g protein in 4 × 30 g`
- `trend weight ignores a single spike`
- `fact: same date gives the same fact; prefers a matching when()`
- `focus: picks the single weakest pillar`

**Done when:** with a profile set, the brief shows all five rows with numbers and the schedule's evening blocks follow the bedtime.

---

## M3 — Training load & decision matrix

**Goal:** heavy / as planned / reduce / recover, using trend, plan and load.

### Engine
```js
export function hrvTrend(history, today) // 7-day mean ln(HRV) vs normal range (LEARNING.normalRangeDays = 60, ±0.5 SD)
//   → { avg7, low, high, band:"above"|"in"|"below"|"unknown", cv7, nights }
export function sessionLoad(session)     // rpe × minutes
export function loadSummary(history, today)
//   → { week, chronic4wkAvg, ratio, spike:boolean, monotony, strain }   spike = ratio > THRESHOLDS.loadSpikeRatio (1.5), advisory only
export function spacingConflicts(profile) // heavy lower within THRESHOLDS.lowerBeforeFootballH (48) of football → list
export function trainingDecision({ trend, result, planned, ankle, rhrFlagDays, load, freshness })
//   → { decision:"push"|"as-planned"|"cap"|"reduce"|"recover", detail, why }
export function freshness(history, today) // upper / lower / ankle-chain → "fresh"|"recovering", from sessions in the last 48–72 h (Fitbod-style)
export function rhrFlagDays(history, today) // consecutive mornings with RHR ≥ baseline + rhrStopDelta
```
- **Matrix:** `FEATURE_RESEARCH.md` §2.
- **Illness rule:** RHR flag needs **2 consecutive days**. A single day stays an "adjust".
- **Load:** the ratio is shown as advisory text, never a stop on its own (the ACWR critique).
- **Wiring:** `generateSchedule` uses `trainingDecision` for the training block's title and detail. `planDay` returns `decision`.

### UI
- **Session tap after training:** type (pre-filled from the template), minutes, RPE, quality (1–5), and for football: competitive, surface.
- **`LoadCard`:** 4-week bars of daily load, with this week's ratio and monotony as text.
- **Template warning** in settings if a spacing conflict exists.

### Tests
- `trend: 7-day avg below range → band below`
- `decision: single low morning with normal trend → cap, not reduce`
- `decision: below range + RHR flag 2 days → recover`
- `decision: ankle ≥ 4 blocks football whatever readiness`
- `load: spike flagged at ratio > 1.5 but decision unchanged`
- `monotony: identical daily loads → high`
- `spacing: heavy lower 24 h before football is flagged`

---

## M4 — Ankle numbers

### Engine
```js
export function ankleSummary(history) // per test: latest L/R, asymmetry, 4-week slope; worsening2wk:boolean
```
- **Worsening:** the injured side got worse for 2 consecutive weekly tests → direction `{ id:"ankle-physio", level:"adjust", title:"Book a physio check", why:"Knee-to-wall dropped 1.5 cm over 2 weeks on the injured side." }`.
- **Clearance:** hop & stick 5/5 on both sides and balance symmetry within 20 % → the football block can show "cleared by your ankle tests".

### UI
- **Weekly reminder (Sunday).** A 3-minute guided modal (knee-to-wall cm both sides, balance seconds, hop count) with clear instructions.
- **`AnkleCard`:** line chart per test, injured vs good side, gap shaded.

### Tests
- `ankle: asymmetry and slope`
- `ankle: two worsening weeks triggers physio direction`
- `ankle: clearance needs hop 5/5 both sides`

---

## M5 — Learning about you

Values are written to `profile.learned` only when the confidence rules below are met. The UI shows default vs learned ("Sleep need: 8 h default → 8 h 25 m learned from 9 nights").

```js
export const LEARNING = {
  normalRangeDays: 60, initNights: 19,
  sleepNeedMinNights: 20, sleepNeedQualifyEnergy: 4,
  chronotypeMinFree: 4, chronotypeMinWork: 8,
  tagMinEach: 8, tagWindowDays: 90,
  predictiveMinSessions: 20,
  cusumK: 0.5, cusumH: 5,
};
export function estimateSleepNeed(history)        // passive: median sleep on nights followed by energy ≥ 4 and HRV in range; needs 20
export function chronotype(history, profile)      // MSW, MSF, MSFsc, socialJetlagH; free days = template "rest" or weekend with no busy blocks
export function footballRecoveryProfile(history)  // per match: hours until first morning with ln-HRV in range and RHR ≤ baseline+2; median + n
export function tagEffects(history, { outcome:"nextHrvPct"|"nextRhr"|"nextScore"|"sessionQuality", lag:1|3 })
//   → [{ tag, nWith, nWithout, diff, ci95:[lo,hi], verdict:"helps"|"hurts"|"no clear effect"|"not enough data" }]
//   Welch's t interval; verdict only if the CI excludes 0 and both n ≥ tagMinEach (stricter than WHOOP 5/5 and Bearable 3/3)
export function predictiveCheck(history)          // Spearman r of each score part vs next session quality; needs 20 sessions
export function baselineShift(history)            // CUSUM on 7-day ln-HRV and RHR → { shifted:boolean, direction, sinceDate, pct }
```
- **Weights stay 35/35/20/10.** `predictiveCheck` only *reports*; changing weights needs the owner and a `CLAUDE.md` edit.
- **Who uses the learned values:**
  - `sleepNeedH` feeds `targetBedtime` and `sleepDebt`.
  - `footballRecoveryH` replaces the 48 h in `spacingConflicts` and the freshness of `lower`.
  - Chronotype shifts free-day templates by `clamp(MSFsc − 03:30, 0, 60 min)`.

### UI
- **`InsightsCard` ("What CHINH has learned about you"):**
  - learned values with their n
  - tag effects (next day / next 3 days toggle, the Bearable idea)
  - a "Your fitness is improving" banner on an upward shift
- **Not-enough-data rows** show the progress, e.g. "Late dinner: 5/8 days".

### Tests
- One test per function.
- Plus `tag effects: CI crossing 0 → no clear effect` and `learning: values stay null until thresholds are met`.

---

## M6 — Personal experiments

```js
export const EXPERIMENTS = [
  { id:"caffeine-noon", arms:["12:00","15:00"], unit:"week", outcomes:["sleepHours","nextHrvPct"] },
  { id:"late-dinner",   arms:["before 19:30","after 21:00"], unit:"day", outcomes:["nextHrvPct","nextRhr"] },
  { id:"screens-out",   arms:["phone out of bedroom","normal"], unit:"week", outcomes:["bedTimeDrift","energy"] },
  { id:"presleep-protein", arms:["30–40 g","none"], unit:"day", onlyOn:["lift","football"], outcomes:["nextLowerSoreness"] },
  { id:"morning-light", arms:["10 min outside before 09:00","none"], unit:"day", outcomes:["bedTime","sleepHours"] },
];
export function assignArm(experiment, startDate, date)   // balanced alternation with a seeded shuffle per block of 2 units
export function experimentResult(history, experiment)     // reuses tagEffects maths on arms; needs ≥ 8 units per arm
```
- **Rules:** one experiment at a time. Days with `override` or low confidence are excluded.
- **UI:** `ExperimentsCard`:
  - start an experiment
  - today's condition shown in the brief ("Today: dinner before 19:30")
  - an evening tap to confirm you followed it (non-compliant days are excluded)
  - the result with its CI, or "inconclusive"

---

## M7 — Later (separate PRs, specs to expand when started)

- **Blood markers:**
  - **Entry & storage:** a `labs` table (date, marker, value, unit, refLow, refHigh) and an entry form.
  - **Card:** markers with a trend.
  - **Rules:** vitamin D low → daily item Oct–Mar; ferritin low → food suggestions + "discuss with your GP". Never diagnose.
- **Hevy import (optional, needs Hevy Pro API key):**
  - **Where:** a Supabase Edge Function, so the key never sits in the repo.
  - **What:** e1RM (Epley) per main lift, weekly sets per muscle group, top-set vs readiness band.
- **Ask CHINH:**
  - **Where:** a Supabase Edge Function calls the Claude API with the engine's computed summary (not raw history).
  - **Behaviour:** answers questions but **never** changes numbers or rules.
  - **Settings:** opt-in, with a page stating exactly what's sent. Memory is visible and editable (the WHOOP lesson).
- **Native iPhone app (Expo + HealthKit):** background sync, a widget, an evening reminder. It reuses `engine.js` unchanged.

---

## PR order & prompts

| PR | Prompt for Claude Code |
|---|---|
| M0 | "Implement M0 from docs/TECH_SPEC.md (fix the five gaps), update the Shortcut guide, open a PR." |
| M1 | "Implement M1 from docs/TECH_SPEC.md: confidence, override, calendar, evening check-out." |
| M2 | "Implement M2 from docs/TECH_SPEC.md: profile, morning brief, targets, facts, weather." |
| M3 | "Implement M3 from docs/TECH_SPEC.md: session tap, load, HRV trend, decision matrix." |
| M4 | "Implement M4 from docs/TECH_SPEC.md: weekly ankle tests and chart." |
| M5 | "Implement M5 from docs/TECH_SPEC.md: learning functions and the Insights card." |
| M6 | "Implement M6 from docs/TECH_SPEC.md: personal experiments." |

After each merge: run the morning Shortcut once to check the live site, and update `CLAUDE.md` if an architecture note changed.
