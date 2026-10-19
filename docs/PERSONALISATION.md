# Personalisation: making CHINH learn Tony, not the average person

Companion to `FEATURE_RESEARCH.md`. That document sets **population rules**: 8 h sleep, 1.6 g/kg protein, an 8.8 h caffeine cut-off. This one replaces them, one by one, with **values measured from you**.

Principle: start every rule from the evidence-based default. Swap it for a personal value only when your data shows a clear, repeatable difference. Show which one is in use ("Sleep need: 8 h default" → "Sleep need: 8 h 25 m, learned from 9 nights").

Already built and assumed here: 30-day baselines, weekly review, tunable `THRESHOLDS`, carried-over ratings, Supabase sync.

---

## Ranked additions

| # | Feature | What CHINH learns about you | Effort | New data |
|---|---|---|---|---|
| 1 | Calendar-aware plan | Your real day, not a template | S | Shortcut reads Calendar |
| 2 | Evening check-out | What you did, so mornings can be explained | S | 4 taps at night |
| 3 | Data confidence | When to trust (or ignore) a reading | S | None |
| 4 | Your sleep need | Your real sleep requirement | M | Bed/wake times |
| 5 | Chronotype & social jetlag | Your body clock, and how far work pulls you off it | M | Bed/wake times |
| 6 | Football recovery profile | How many hours you need after a match | M | None (session tags) |
| 7 | Does the score work for you? | Whether readiness predicts *your* good sessions | M | Session quality tap |
| 8 | Ankle numbers | Rehab progress in cm and seconds, left vs right | S | Weekly 3-min test |
| 9 | Personal experiments | Cause and effect for your habits | L | Follows a protocol |
| 10 | Baseline shift detection | Fitness gains vs noise | M | None |
| 11 | Blood markers | What you're actually low in | S | Results from a test |
| 12 | Training log import | Strength progress vs recovery | M | Hevy Pro (optional) |
| 13 | Ask CHINH | Plain-language questions over your history | L | Claude API via Supabase |

S = a few hours · M = a day or two · L = several days

---

## 1. Calendar-aware plan

The morning Shortcut can also run **Find Calendar Events** for today and send your busy blocks:

```
…#hrv=58&rhr=54&sleep=7.4&busy=0930-1030,1400-1500&football=1900
```

The schedule then puts deep work in the longest free block, moves mobility around meetings and recognises football fixtures automatically. It also schedules the FIFA 11+ warm-up and the pre-match meal 2–3 h before kick-off.

**Why it matters:** a plan that collides with your real day gets ignored.

**Privacy:** send only start and end times, never event titles.

## 2. Evening check-out (10 seconds)

Four taps before bed. These are the **tags** that every personal insight later depends on:

- Stress today (1–5)
- Alcohol (none / 1–2 / 3+)
- Last caffeine time
- Last meal time

Optionally, add session quality (see #7).

**Evidence:** athletes' self-reported well-being responded to training load more consistently than blood and hormone markers. In a systematic review of 56 studies, subjective measures "trump" commonly used objective ones (Saw, Main & Gastin 2016, BJSM). Your quick taps aren't a fallback for missing sensors. They are among the best signals you have.

## 3. Data confidence

Zepp writes only ~3–4 HRV readings a day, and some nights are missed. Each day gets a confidence level:

- **High:** ≥ 2 overnight HRV readings and a full sleep record.
- **Medium:** 1 reading, or a daytime reading only.
- **Low:** nothing synced. Score from sleep and ratings only, with a clear "low confidence" label.

Low-confidence days are **excluded from baselines and from every personal-learning feature below**. One misleading reading should never shape a month of advice.

## 4. Your actual sleep need

**Evidence:** in a 9-day sleep-extension study, healthy young men's optimal sleep was about **8.4 h**. Their habitual sleep was about 1 h less, a hidden debt they didn't notice (Kitamura et al. 2016, Scientific Reports).

**How CHINH learns yours:**

- **Active test (most accurate):** during a holiday or a free run of 7+ days, sleep with no alarm. Ignore the first 3–4 nights (repaying debt). The average of the later nights is your need.
- **Passive estimate:** sleep duration on nights followed by energy ≥ 4/5 and HRV within range. This needs ~20 qualifying nights.

**Result:** `SLEEP_TARGET_H` becomes yours. Bedtime targets and sleep-debt maths update with it.

**Shortcut change:** send `bed=23:12&wake=07:04` from the Sleep Analysis start and end times. This also feeds #5.

## 5. Chronotype & social jetlag

From two weeks of bed and wake times:

- **Mid-sleep** = sleep start + duration ÷ 2.
- **Chronotype** (MCTQ method, Roenneberg et al. 2003): MSF, your mid-sleep on free days. If you sleep longer on free days (catch-up), it's corrected: MSFsc = MSF − (free-day duration − weekly average duration) ÷ 2.
- **Social jetlag** = |mid-sleep on free days − mid-sleep on workdays|.
  - Social jetlag has been linked to higher BMI and poorer metabolic health (Roenneberg et al. 2012, Current Biology).
  - **Target:** under 1 h.

**What changes:**

- **Plan timing:** a late chronotype shifts the template 30–60 min later on free days, so deep work and training land in your alert window, not the population's.
- **Weekend guard:** "Your weekend lie-in is creating 1 h 40 m of social jetlag. Get up within 1 h of your weekday time and take a 20-min nap instead."
- **Training time:** strength and power typically peak in the late afternoon. CHINH tracks your session quality by time of day (#7) and tells you if you differ.

## 6. Your football recovery profile

After every tagged football session, track HRV, RHR and soreness for the next 72 h. Then learn:

- **Hours to return to baseline:** the median across matches, e.g. "You're back after **52 h**."
- **Which matches hit hardest:** competitive vs casual, artificial pitch vs grass (one-tap tag).

**Use:** CHINH blocks heavy lower-body work inside *your* recovery window, instead of a generic 48 h. It also flags weeks where two matches fall closer together than your window.

## 7. Does the score work for you? (closing the loop)

Without this, CHINH never finds out whether its advice was right.

**After each session:** session quality 1–5 ("how did it go?"), plus RPE.

**After 20–30 sessions:**

- **Predictive check:** do high-readiness days produce better sessions *for you*? Show the correlation for each part of the score (sleep, HRV/RHR, soreness, energy).
- **Example finding:** "For you, sleep predicts session quality strongly (r = 0.52); HRV barely does (r = 0.11)."
- **Personal weighting:** the four weights are fixed by the project rules (35/35/20/10). CHINH can **show** the case for different personal weights, but changing them needs your decision and an update to `CLAUDE.md`. The engine never quietly re-weights itself.

## 8. Ankle rehab in numbers

Three-minute weekly test, both sides:

| Test | How | Target |
|---|---|---|
| **Knee-to-wall distance** | Furthest heel-to-wall distance (cm) where the knee still touches with the heel down | Injured side within ~1–2 cm of the good side |
| **Single-leg balance, eyes closed** | Seconds until the foot or arm moves | Symmetry, then ≥ 30 s |
| **Single-leg hop & stick** | 5 hops, count the ones held steady | 5/5 on both sides before full football |

Charted weekly, so the 35 % recurrence reduction from balance training (Hupperets 2009) shows up as a curve you can watch closing.

**Safety:** if the injured side gets **worse** for 2 weeks running, CHINH says to see a physio.

## 9. Personal experiments (n-of-1)

The strongest way to learn cause and effect about yourself. Instead of noticing patterns after the fact, CHINH **runs** a short alternating protocol:

| Experiment | Protocol | Measure |
|---|---|---|
| Caffeine cut-off | Alternate weeks: last coffee 12:00 vs 15:00 | Sleep duration, next-morning HRV |
| Late dinner | Dinner before 19:30 vs after 21:00, alternating days | Next-morning HRV & RHR |
| Evening screens | Phone out of the bedroom vs normal, by week | Bedtime drift, energy rating |
| Pre-sleep protein | 30–40 g casein/yoghurt vs none on training nights | Next-day soreness |
| Morning light | 10 min outside before 09:00 vs not | Bedtime, sleep onset |

- **Duration:** about 2–4 weeks each. The app tells you which condition today is.
- **Analysis:** difference in means with a confidence interval, as in "pre-sleep protein lowered your next-day soreness by 0.6/5 (±0.4)."
- **Inconclusive results:** shown as inconclusive, never rounded into advice.

## 10. Baseline shift detection

Rolling baselines slowly absorb change, so a real fitness gain or a creeping illness can hide inside them. A simple change-point test on 7-day ln(HRV) and RHR (CUSUM) separates the cases:

- **Real shift:** "Your HRV baseline has risen 8 % over 6 weeks. Fitness is improving."
- **Noise:** no message.

It's encouraging, and it stops the app treating a fitter you as "above baseline, push" forever.

## 11. Blood markers ("what am I lacking", properly)

No wearable can measure nutrient status. Twice-yearly blood tests can, from your GP or a UK home finger-prick service. Enter:

- Ferritin
- Vitamin D (25-OH)
- B12
- HbA1c
- Lipid panel

CHINH stores them with dates and reference ranges. Results it can act on:

- **Low vitamin D:** the NHS's October–March 10 µg advice becomes a daily item.
- **Ferritin low or falling:** food suggestions plus "discuss with your GP".

CHINH never diagnoses; it tracks and reminds.

## 12. Training log import (optional)

Hevy's API needs a paid subscription. If you log there, CHINH can import sets and compute:

- **Estimated 1RM trends** per main lift.
- **Weekly volume** per muscle group.
- **Training quality vs readiness:** "Top sets on green days average 4 % heavier."

Without Hevy, the session-RPE tap plus Zepp workouts from Apple Health is enough for load tracking.

**Objective readiness add-on:** a weekly countermovement jump with the **My Jump 2** iPhone app. It matched a force platform almost perfectly (r ≈ 0.999) in validation work. Its use for *fatigue* monitoring isn't validated in that study, so treat a drop as a prompt, not a rule.

## 13. Ask CHINH (later)

Ask questions over your own history in plain English: "Why was Tuesday low?", "Am I sleeping better than last month?".

- **How:** Claude API, called from a Supabase Edge Function so the API key never sits in the public repo.
- **Rule:** the model **explains** numbers computed by the engine. It never invents or decides them.
- **Privacy:** this sends health data to an external API, so it's opt-in, and the setting says exactly what is sent.

---

## Questions CHINH can answer

Status against the code on `main` (19 Oct 2026). **Now** = answered today; **Build** = needs the numbered feature; **Wait** = needs weeks of data once built.

### This morning
| Question | Status | Answered by |
|---|---|---|
| How recovered am I? | Now | Score, archetype, HRV/RHR vs your 30-day normal |
| Should I lift heavy, go light, or rest? | Now | Directions + rewritten training block |
| Can I play football today? | Now | Ankle flare / RHR / HRV stop rules |
| Am I getting ill? | Now (partly) | RHR +5 bpm rule; 2-day confirmation needs #3 |
| How should I fit today around my meetings? | Build #1 | Calendar-aware plan |
| Can I trust today's reading? | Build #3 | Data confidence |

### Tonight
| Question | Status | Answered by |
|---|---|---|
| Should I go to bed earlier? | Now (fixed 22:00) | Sleep-debt rule; a personal bedtime needs bed/wake times + #4 |
| When is my last coffee / last meal? | Build (V1.2) | Cut-offs from bedtime, `FEATURE_RESEARCH.md` §5 |
| How much water should I have drunk? | Build (V1.2) | Hydration formula |

### This week
| Question | Status | Answered by |
|---|---|---|
| Was this week better than last? | Now | Weekly review |
| Do I need a deload? | Now | Weekly HRV −5 % / 3+ restoration days |
| Did I actually do my mobility? | Now | Adherence (plan % and mobility days) |
| Which directions fire too often? | Now | `fired` counts → tune `THRESHOLDS` |

### About me (learned)
| Question | Status | Answered by |
|---|---|---|
| How much sleep do I really need? | Build #4 · Wait ~3–4 wk | Sleep-need estimate |
| Am I a morning or evening type? Is my weekend lie-in hurting me? | Build #5 · Wait 2 wk | Chronotype, social jetlag |
| How long do I need to recover from football? | Build #6 · Wait ~6 matches | Recovery profile |
| Does my score actually predict good sessions? Which input matters most for me? | Build #7 · Wait 20–30 sessions | Predictive check |
| Is my fitness improving? | Build #10 · Wait ~6 wk | Baseline shift detection |
| What am I low in? | Build #11 | Blood markers (+ NHS vitamin D advice now) |

### Cause and effect
| Question | Status | Answered by |
|---|---|---|
| Does late coffee / a late dinner / alcohol hurt my recovery? | Build #2 · Wait ~8 tagged days each | Tag comparison |
| What actually works for me? | Build #9 · 2–4 wk per test | Personal experiments |
| Why was Tuesday so low? | Build #2 now · #13 later | Tags explain the day; Ask CHINH answers in plain English |

## Gaps found in the current code

Small fixes worth making before the personal-learning features, because each one limits what CHINH can learn:

1. **History is capped at 120 days** (`upsertDay` → `.slice(-120)`). Sleep-need, chronotype, experiments and seasonal patterns need longer; raise to ~730 days (about 1 KB a day, fine for `localStorage`).
2. **Sleep quality is carried over.** After a no-form sync, 17.5 of the score's 35 sleep points come from the last time you *rated* sleep, possibly days ago. Either ask for one tap after each sync, or score sleep from duration + regularity until it's rated again.
3. **HRV is a 24-hour average** including daytime readings (Shortcut: "last 1 day"). Restrict to overnight, or at least send the reading count, so #3 can judge it.
4. **HRV baseline is computed on raw ms.** HRV is skewed, and ln(HRV) is the standard for baselines and z-scores. Switching changes scores slightly, so do it with a test and a note in the weekly review.
5. **Sleep "last 1 day" can include yesterday's nap.** Bed/wake times (#4/#5) fix this: take only the main sleep block.

## Suggested order

1. **This week:** #1 calendar, #2 evening check-out, #3 data confidence, plus bed/wake times in the Shortcut. These are the data foundations everything else learns from.
2. **Weeks 2–4:** #8 ankle numbers (start now: the curve needs time) and #7 session quality.
3. **After 4–6 weeks of data:** #4 sleep need, #5 chronotype, #6 football profile.
4. **Month 2+:** #9 experiments, #10 shift detection, #11 bloods.
5. **Later:** #12 Hevy, #13 Ask CHINH, native iPhone app.

## Sources

- Saw, Main & Gastin 2016, BJSM, subjective vs objective monitoring: https://bjsm.bmj.com/content/50/5/281
- Kitamura et al. 2016, Sci Rep, individual optimal sleep duration: https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5075948/
- Social jetlag & MCTQ (Roenneberg et al. 2003, 2012): https://en.wikipedia.org/wiki/Munich_Chronotype_Questionnaire · https://pmc.ncbi.nlm.nih.gov/articles/PMC10204006
- My Jump 2 validity: https://peerj.com/articles/17658
- Hevy / strength app APIs: https://forum.intervals.icu/t/weight-training-apps-with-public-api/125221
- Hupperets et al. 2009 BMJ (balance training and recurrent ankle sprains) and the sources in `FEATURE_RESEARCH.md`.
