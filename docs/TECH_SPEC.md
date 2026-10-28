# CHINH technical spec: build plan for Claude Code

The build plan for everything in `FEATURE_RESEARCH.md` and `PERSONALISATION.md`, split into milestones. **One milestone = one PR**, done in order. Each milestone lists the data changes, engine API, UI, Shortcut changes, tests and acceptance criteria.

**How to use it:** tell Claude Code *"Implement M1 from docs/TECH_SPEC.md and open a PR."* Each milestone also has a GitHub issue.

Background reading: `FEATURE_RESEARCH.md` (the science), `PERSONALISATION.md` (what's learned from you), `SIMILAR_PRODUCTS.md` (what others do).

> **Scope change, 19 Oct 2026.** CHINH now uses only what the Helio Strap measures plus the quick check-in ratings. These parts of M1–M6 were built and then **removed**; their sections below are kept as history only. Do not rebuild them.
> - **M1:** calendar-aware schedule, evening check-out.
> - **M2:** water, protein/carb and meal targets, weight, weather.
> - **M3:** session logging, RPE load, monotony, freshness.
> - **M4:** ankle tests (all of it).
> - **M5:** football recovery profile (returns in M7.1 from heart rate), score-vs-session check, evening-tag habit effects. Habit effects now use strap-derived tags only.
> - **M6:** experiments (all of it).

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
10. **Data sources:** only what the Helio Strap measures (via Apple Health) plus the quick self-ratings already in the app. No blood tests, third-party app imports, AI chat or native app.
11. **Engine size:** when `engine.js` passes ~900 lines, split it into `src/engine/{sync,baselines,score,directions,schedule,brief,load,learning}.js` and re-export from `src/engine.js`. Keep the import path stable for the UI and tests.

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
| `hrZones` | `[z1…z5]` minutes | M7.1 | yesterday's HR-zone minutes, stored on that day |
| `hrMax` | bpm | M7.1 | that day's highest HR sample |
| `session` (auto) | `{type, auto: true, minutes, load}` \| null | M7.1 | set when the day's TRIMP ≥ `HR.sessionMin` |
| `steps`, `activeKcal` | number | M7.2 | that day's totals |
| `spo2`, `spo2Min` | % | M7.3 | last night's average and minimum |
| `stages` | `{deep, core, rem}` minutes | M7.4 | last night, display only |

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

## M7 — More from your Helio Strap (strap data only)

**Status:** M7.1–M7.4 built (`src/engine/strap.js`, `tests/strap.test.js`, `HrLoadCard`, vitals, sleep-stage bar; Shortcut guide section 2c). `profile.maxHr` is honoured by the engine but has no settings field, since settings stay wake times + weekly plan.

**Scope rule from here on:** new data comes only from what the Amazfit Helio Strap measures, via Zepp → Apple Health → Shortcut.
- **Removed from the plan:** blood tests, Hevy or other training-app imports, phone jump tests, an AI chat, a native iPhone app. CHINH stays a website (hosted on Vercel).
- **Kept:** the quick check-in ratings (soreness, ankle/hip, energy, sleep quality, ill / high-stress). They are 30 % of the score and the only signal for muscle fatigue.

**What the strap can give us through Apple Health:**

| Signal | Readable by Shortcuts? | Status |
|---|---|---|
| Heart-rate samples (incl. during workouts) | Yes | **M7.1** |
| HRV, resting HR, sleep, bed/wake times | Yes | already used |
| Steps, active energy | Yes | **M7.2** |
| Blood oxygen (spot and overnight) | Yes | **M7.3** |
| Sleep stages | Only if Zepp writes them | **M7.4** (display only) |
| Workout records | **No**: Shortcuts' Find Health Samples has no Workout type | use HR samples instead |
| Stress, PAI, Zepp readiness, respiration rate, skin temperature | **No**: stay inside Zepp | out of scope |

### Shortcut contract additions (all optional, all about **yesterday** unless noted)

| Param | Example | Meaning |
|---|---|---|
| `z` | `12,30,25,10,2` | HR sample counts in zones 1–5 yesterday |
| `hri` | `60` | seconds between HR samples during activity (default 60) |
| `hrmax` | `188` | highest HR sample yesterday |
| `st` | `9450` | steps yesterday |
| `ae` | `640` | active energy yesterday, kcal |
| `spo2` | `96` | overnight blood-oxygen average, % (since 18:00) |
| `spo2min` | `92` | overnight minimum, % |
| `deep`, `rem`, `core` | `62,95,240` | sleep-stage minutes, only if present |

- **Where yesterday's values live:** stored on **yesterday's** day record (`hrZones`, `hrMax`, `steps`, `activeKcal`). Overnight values are stored on **today's** record (`spo2`, `spo2Min`, `stages`).
- **First task, before any code:** check the strap's HR sample interval during a workout (Health → Heart → Heart Rate → Show All Data). If it isn't ~60 s, set `hri` so counts convert to minutes correctly.

### M7.1 Heart-rate training load (automatic)

```js
export const HR = { zones: [0.5, 0.6, 0.7, 0.8, 0.9, 1.0], maxWindowDays: 90 };
export function personalMaxHr(history, profile)   // profile.maxHr if set, else the 98th percentile of hrMax over 90 days (needs ≥ 10 days), else null
export function zoneMinutes(counts, hri = 60)    // counts → minutes per zone
export function hrLoad(minutes)                   // Edwards TRIMP: Σ minutes_z × z (z = 1..5)
```
- **Load summary:** `hrLoadSummary` compares this week's `hrLoad` with the 4 weeks before. It's advisory only, and starts once the prior 4 weeks have ≥ 4 days with HR data. There's no manual RPE fallback.
- **Auto-detected sessions:** if yesterday's `hrLoad` ≥ `HR.sessionMin` (default 60), store `session: { type: template[day], auto: true, minutes: Z2+ minutes }`. Nothing is entered by hand.
- **Learning:** bring back the football recovery profile (hours until HRV and resting HR return after a match), using auto-detected football days.
- **Tests:** zone conversion, TRIMP, load summary threshold, auto-session detection, max-HR percentile, football recovery from auto-detected days.

### M7.2 Steps and active energy
- **Vitals strip:** shows yesterday's steps and active energy, against your 30-day median.
- **New tag:** `"big-day"` when active energy ≥ 1.5× your 30-day median. It feeds the habit-effects learning (what big days do to your next morning).
- **Restoration days:** if yesterday's steps were < 5,000, add a "30-min easy walk" block. Gentle movement, not training.
- **Tests:** median, the big-day tag, the walk block only on restoration days.

### M7.3 Overnight blood oxygen
- **Baseline:** 30-day mean of `spo2`, same exclusions as HRV (override and low-confidence days).
- **Supporting signal only:** wrist SpO2 is noisy, so it never fires a direction on its own.
- **When it counts:** if the average is ≥ 2 points below baseline on the same mornings the resting-HR rule fires, the `rhr-high` direction adds "and overnight oxygen is down N points", and the illness-confidence note says so.
- **Data confidence:** `spo2Min` < 88 % on a single night is treated as a likely artefact (loose strap) and shown as a data-quality note, not a health claim.
- **Tests:** baseline, supporting-only behaviour, the artefact note.

### M7.4 Sleep stages (display only)
- **When present:** if Sleep samples include Core/Deep/REM, the Shortcut sends minutes and CHINH shows a stacked bar on the recovery card.
- **Not used in the score or directions:** consumer staging isn't accurate enough to act on. The stages are display only.

### M7.5 Hosting on Vercel (done)
- **Hosting:** the site deploys from `main` via Vercel's Git integration. `vercel.json` runs the tests before every build.
- **CI:** GitHub Actions still tests and builds every PR. GitHub Pages is retired.

### M7 follow-ups (from the strap research, 22 Oct 2026)
- **M7.0 data check (on the phone, no code):** in Health → Browse, note whether Zepp writes Blood Oxygen, Respiratory Rate and sleep stages, and the HR sample interval during a workout. If Blood Oxygen is empty, M7.3 stays dormant. Reviews and Zepp's own pages disagree on SpO2, and HRV arrives as only 2–4 points a night (RMSSD stored in HealthKit's SDNN field).
- **Session guards:** CHINH detects sessions from yesterday's heart-rate zones, not from Zepp's workout detection (Shortcuts can't read workouts), but a long walking day can still cross `HR.sessionMin` on zone 1–2 minutes alone. Tighten `autoSession` to need ≥ 20 min in zone 2+ as well as `HR.sessionMin`, and let a one-tap "not a session" set `session.dismissed = true` (excluded from load and learning). If the M7.0 check shows HR samples about 2 minutes apart during training, set `hri=120` before tuning these thresholds: zone minutes are coarse at that spacing.
- **Routes not used:** the unofficial Zepp API (against Zepp's terms, token expires about every 30 days), Zepp's deprecated developer REST API, Strava's API (third-party, needs a subscription).

---

## M8 — Your trainer: calisthenics + bands, rules first, AI on top

**Owner request, 22 Oct 2026:** training takes too long; the goal is to be strong for his size, springy and mobile (move easily for football and like a fighter) and look athletic, **without** chasing size; switch to **full calisthenics with a pull-up bar, dip bars and resistance bands**, and have an AI act as a personal trainer that picks each day's exercises from his data. This brings back two things removed on 19 Oct, at the owner's request: a **session log** (needed for progression) and an **AI** (as a trainer, not a chat). Everything else on the removed list stays removed.

**Evidence the design rests on** (sources in `docs/FEATURE_RESEARCH.md` §12):
- **Short sessions work.** ≥ 4 hard sets per muscle group a week is the minimum worth doing; 6–15 RM, or 15–40 reps if taken to failure. Supersets roughly halve session time with the same strength and size gains (Iversen 2021; Zhang 2025 meta-analysis).
- **Bodyweight and bands are enough for size.** All loads build muscle similarly when sets are hard (BJSM 2023 network meta-analysis, 178 studies); push-ups matched bench press at 40 % 1RM (Kikuchi 2017); progressive calisthenic push-ups matched bench press for strength (Kotarsky 2018); elastic bands matched machines and free weights for strength (Lopes 2019). Top-end maximal strength is the one thing heavy loads still do better.
- **Football prehab:** programmes with the Nordic hamstring exercise roughly halve hamstring injuries (van Dyk 2019, RR 0.49), but only with ≥ 75 % adherence (2025 meta-analysis). Copenhagen adductor: ~30 reps a week builds adductor strength; groin-injury prevention is unproven.
- **Ankle:** balance training cuts ankle sprains by about a third to a half, more in people with a previous sprain; ≥ 6 weeks after an acute sprain reduces re-sprains for up to a year.
- **Effort:** reps in reserve (RIR) is judged better close to failure and on lower-rep sets, so the last set of each exercise goes to technical failure as a calibration.
- **AI plans:** expert reviewers rate LLM-written training plans as moderate; quality rises with more input, and safety gaps appear with injuries (Düking 2024, Havers 2025, Akrimi 2025). So the AI gets rich, structured input, chooses only from a fixed library, and is checked by rules.

**Ground rules for M8:**
- The engine still decides **how hard** today is (score, archetype, directions, `trainingDecision`). The AI only chooses **what** to do within that. It never changes the score, the decision or the four mobility drills.
- Every AI session passes a pure-function validator or CHINH falls back to the rule-based session.
- The exercise library and ladders live in `docs/knowledge/calisthenics-and-bands.md` and `src/engine/exercises.js`; the AI can only use ids from it.

### M8.1 New plan and rule-based sessions (no AI)

**Status:** built (`src/engine/exercises.js`, `TrainingCard`, settings, `tests/exercises.test.js`). Rungs and the power-l balance gate read `workout` logs, which arrive with M8.2; until then sessions start at rung 2, leg power stays at rung 0, and the "short week adds the Nordic/Copenhagen" catch-up waits for the log too. A `reduce` decision also takes a round off, and `cap`/`reduce` days never go to failure.

- **Profile (settings) adds:** `equipment` (default `["bands", "bar", "dip"]`, the owner's kit; each can be switched off, e.g. when travelling), `sessionMinutes` (20 / 30 / 45, default 30). Exercises whose `needs` aren't in `equipment` are skipped and the ladder falls back to the nearest rung without them. Settings now hold wake times, the weekly plan, equipment and session length.
- **Template options:** `full-a`, `full-b`, `football`, `zone2`, `rest`. `upper` / `lower` stay valid for old profiles and map to Full A / Full B.
- **Suggested default week:** Mon Full A · Tue rest · Wed Football · Thu Full B · Fri rest · Sat Football · Sun mobility only. About 1 h of strength a week instead of about 4 h, still ≥ 4 hard sets per muscle group (about 6 a week for each main muscle group across Full A and B, e.g. chest from dips + push-ups, back from both pulls). Both sessions include the Nordic, so two Nordic sessions a week need no optional day, and they're 72 h apart and never the day before football. The mobility panel runs every day and now includes the balance drill (see below).
- **Mobility panel adds balance (and calves):** the `balance` drill moves out of the session into the daily mobility panel, at its ladder rung (rungs 1–3 on `ankle-flare`), with a single-leg calf raise from the `calf` ladder on strength days. The four required drills stay.
- **`src/engine/exercises.js`:** `EXERCISES` (id, pattern, rung, reps, ankle 0–2, needs) and `buildSession({ dayType, archetypeId, decision, directives, profile, history })` returning `{ power, blocks: [{ pair: [ex, ex], rounds, restSec }], minutes, why }`.
- **Rules inside `buildSession`:**
  - High Output: all rounds, last set to failure. Balanced Flow: one round fewer, 2–3 RIR. Active Restoration, or `hrv-low` / `rhr-high` stop: no strength or power block, the mobility panel (with balance) only.
  - `ankle-flare` (ankle/hip ≥ 4): no exercise with ankle load 2; balance stays at rungs 1–3.
  - Lower-body soreness ≥ 4: lower patterns drop to rung − 1 and one round fewer.
  - **Power primer** (first 3 min after the warm-up): High Output gets `power-l` and `power-u`, Balanced Flow one of them, Active Restoration none. `power-l` above rung 0 only when ankle/hip < 3, lower-body soreness < 4, no `ankle-flare`, and the balance ladder has reached rung 4 in the log; otherwise rung 0 or `power-u`. Power sets are never to failure, never more than 5 reps (pogo hops: timed, ≤ 15 s a set) and aren't counted as hard sets.
  - **Strength bias:** entry rungs (a rep range that starts at 12 or more: `squat` 1–2, `hinge` 1, `pull-h` 1) progress within their own range. From the first harder rung, main patterns target 5–10 reps, and ≥ 12 clean reps triggers a rung up. Last set to failure only on High Output days.
  - **Time:** supersets alternate opposite muscles, so rest is 45–60 s after each pair (the `range` drill fits in it). `estimateMinutes` = 5 min warm-up and power + 45 s per set + the stated rest; 30 min ≈ 3 pairs × 3 rounds (about 25–28 min), 20 min = 2 rounds, 45 min = 4 rounds or add `arms`.
  - **Range:** each superset pair gets one `range` drill in its rest; the drill set follows the same ankle rule (ankle 1 drills are skipped on `ankle-flare`).
  - Day before football: no Nordic, lower patterns one round fewer. Nordic is due 2× a week, Copenhagen about 30 reps a week; if a week is short, the next session adds it.
  - Rungs come from the session log (`currentRung(history, pattern)`); with no log, start at rung 2.
- **Schedule:** the 17:00 training block takes the session's real minutes and title ("Full A · 30 min").
- **Tests:** each rule above, `estimateMinutes` ≤ `sessionMinutes` for 20 / 30 / 45, the ladder start, Nordic in both sessions and never the day before football, the restoration swap, balance and calf in the mobility panel, the `power-l` ankle gate (including the balance-rung condition), every power dose in the library ≤ 5 reps or ≤ 15 s, entry rungs progressing within their range, rung-up at ≥ 12 reps from the first harder rung, failure sets only on High Output days.

### M8.2 Session log (about 30 seconds)

**Status:** built (`nextRung`, `applyWorkoutLog`, `markExtraDone`, `daySession` in `src/engine/exercises.js`; log form in `TrainingCard`; `tests/progression.test.js`). Ticking the balance or calf drill in the mobility panel logs it (`extrasDone`), which is what opens the `power-l` gate at balance rung 4. Power moves up a whole rung, only after feeling easy twice. Today's plan ignores today's own log.

- **Training card:** shows today's session. After training, each exercise is pre-filled with the target reps; you tick it, change a number if it differs, and mark the last set *easy / right / failed*.
- **Stored on today's record:** `workout = { dayType, exercises: [{ id, rung, reps: [12, 11, 9], last: "right" }], minutes, updatedAt }`. The automatic HR session (M7.1) supplies minutes and load, so nothing is asked twice.
- **Which session wins:** a logged `workout` sets the day's session type; the automatic HR session only supplies minutes and load (and is never dismissed by a log). With no log, the HR session's type comes from the template as in M7.1. With a log but no HR data, minutes come from the log and load stays unknown (never estimated).
- **Progression:** `nextRung(history, pattern)` applies the rule at the end of the library doc: top of the range twice running moves up a rung; missing the bottom twice moves down.
- **Tests:** progression up and down, entry rungs, bands as half a rung, logs merge by `updatedAt`, a log overriding the HR session's type but not its load.

### M8.3 Training week view
- **Plan vs done:** the week's template against logged sessions and auto-detected HR sessions, with dismissed sessions left out.
- **Counts:** hard sets per muscle group (target ≥ 4), Nordic sessions (target 2), Copenhagen reps (target ~30), balance days, HR load against your 42-day weekly average.
- **`weeklyReview`** adds `sessionsPlanned`, `sessionsDone`, `setsByPattern`, `prehab`.
- **Tests:** plan/actual matching, the counts.

### M8.4 AI trainer (Claude)

**Status:** built (`src/engine/coach.js`, `api/coach.js`, `claim_coach_request` in `supabase/schema.sql`, the AI plan button on `TrainingCard`, `tests/coach.test.js`). The Sunday weekly note waits for M8.3.
- **Server function:** `api/coach.js` on Vercel. `ANTHROPIC_API_KEY`, `COACH_MODEL` and `OWNER_EMAIL` are Vercel environment variables, never in the browser.
- **Who can call it:** the function checks the Supabase session (asks Supabase Auth for the user behind the token) and answers only when that user's email matches `OWNER_EMAIL`, before any call to Claude. Sign-ups also stay off in Supabase (step 6 of `SUPABASE_SETUP.md`). Both, because the key costs money.
- **Daily limit (Supabase):** one plan a day plus 3 regenerations, kept in a new table `coach_usage (user_id, date, plans, regenerations)` with RLS (users read their own rows only). Counting goes through a `security definer` function `claim_coach_request(kind text) returns boolean` that atomically increments today's row (Europe/London date) and returns false once the limit is reached, so the Vercel function needs only the caller's token, not the service-role key. The function calls it before Claude and returns 429 "Today's plans are used up" when it's false. SQL goes in `supabase/schema.sql`, plus a line in `docs/SUPABASE_SETUP.md`.
- **Input** (`coachInput(...)`, pure, in the engine): today's archetype, decision, direction ids and their numbers, day type, `sessionMinutes`, equipment, current rung per pattern, the last 6 weeks of logged sessions (per pattern: rung, best reps, last-set effort), HR load 7/42, ankle/hip ratings for 14 days, football days, prehab counts this week, and the rules above as text. No name, email or raw history.
- **Output:** strict JSON `{ power: [{ id, rung, sets, reps }], blocks: [{ pair: [{ id, rung, sets, reps, rir }], rounds, restSec }], why }`; `why` is 1–2 sentences naming the numbers behind the choice. Balance stays in the mobility panel and isn't the AI's to choose.
- **Validator** (`validateSession(session, constraints)`, pure): ids exist and fit `equipment`; ankle and soreness rules, including the `power-l` gate; power never above 5 reps a set, and timed power (pogo hops) never above 15 s; Nordic spacing; `restSec` 45–60; `estimateMinutes` (5 min warm-up and power + 45 s a set + rest) ≤ `sessionMinutes`; rungs within ± 1 of `nextRung`. On failure the card shows the rule-based session from M8.1 with "Standard session: the AI plan didn't pass the checks".
- **Weekly note (Sundays):** the AI also gets the M8.3 week summary and may suggest one change for next week (a template swap or a rung change). It's shown as a suggestion you accept with one tap, never applied automatically.
- **Cost and privacy:** one small request a day, paid per use on your Anthropic API account. Only the summary leaves the device.
- **Tests:** `coachInput` contains no identifiers, validator cases (each rule), fallback, time estimate, a non-owner email refused, the 429 once `claim_coach_request` returns false. The API call itself is mocked.

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
| M7 | "Implement M7.1 from docs/TECH_SPEC.md (HR load), then M7.2–M7.4, one PR each." (done) |
| M7 follow-ups | "Implement the M7 follow-ups from docs/TECH_SPEC.md: session guards and dismiss." (after the M7.0 phone check) |
| M8.1 | "Implement M8.1 from docs/TECH_SPEC.md: exercise library, new template, rule-based sessions." |
| M8.2 | "Implement M8.2 from docs/TECH_SPEC.md: session log and progression." |
| M8.3 | "Implement M8.3 from docs/TECH_SPEC.md: training week view." |
| M8.4 | "Implement M8.4 from docs/TECH_SPEC.md: the AI trainer function, validator and fallback." |

After each merge: run the morning Shortcut once to check the live site on Vercel, and update `CLAUDE.md` if an architecture note changed.
