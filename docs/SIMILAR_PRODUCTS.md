# Similar products: what CHINH can learn

Researched 19 Oct 2026. For each product: what it does that matters for CHINH, the specific mechanic worth copying (or avoiding), and where it lands in `TECH_SPEC.md`.

## At a glance

| Product | Category | Best idea for CHINH | Spec |
|---|---|---|---|
| WHOOP | Wearable + subscription | Journal → "behaviour impact" on recovery after 5 yes / 5 no days | M5 |
| Bevel | Apple Health app | RMSSD over the full sleep window; no hardware of its own | M0 |
| HRV4Training | HRV app (research-led) | Judge against a ~2-month **normal range**, not day-to-day change | M3 |
| Garmin | Wearable | Readiness includes **remaining recovery time** and **acute load**; honest "initialising" state | M1, M3 |
| Athlytic | Apple Health app | Warning case: cardiac-only recovery misses muscular fatigue | — (CHINH already rates soreness) |
| Gentler Streak | Apple Health app | Rest days count; **"Go Gentler"** override for illness or stress | M1 |
| RISE | Sleep app | Sleep need + sleep debt → bedtime that **shifts gradually** | M2, M5 |
| MacroFactor | Nutrition | Expenditure from **trended weight + intake**, adherence-neutral | M2 (optional) |
| Bearable | Symptom/habit tracker | With-vs-without factor report; same-day vs next-7-days effect | M5 |
| Fitbod | Strength app | Per-muscle recovery %, e1RM from logged sets, RIR | M3 |
| Oura | Ring + app | Readiness "contributors" breakdown | Existing UI |

---

## Readiness & recovery

### WHOOP
- **Journal & Behaviour Insights:** you log daily behaviours. After at least **5 "yes" and 5 "no" days within 90 days**, WHOOP shows how each one relates to your Recovery. In 2026 you can also ask the AI to create custom behaviours to track.
- **Strength Trainer:** logs exercises with volume, history and personal records, and links them to muscular load.
- **Advanced Labs and Healthspan:** blood panels with biomarkers shown as Optimal / Sufficient / Out of Range against the Sleep, Strain and Fitness pillars, refreshed every 90 days.
- **AI coach with "My Memory":** stores your goals and routines, which you can view, edit or turn off.

**Learn:** behaviour-impact insights are WHOOP's most personal feature, and CHINH can do it for free with the evening check-out tags. Use a **stricter minimum (8/8)** and show a confidence interval; WHOOP's 5/5 is very little data. For any AI memory, copy the transparency: you can see and edit what it holds.

### Bevel
- Builds on Apple Health data with no hardware of its own.
- Lets you pick the HRV method. For Apple Watch it recommends **RMSSD over the full sleep window**.

**Learn:** measure HRV only during sleep and the same way every night. That's gap fix #3 (overnight-only HRV).

### HRV4Training (Marco Altini, research-led)
- **Normal range** from about **2 months** of data, updated continuously. The daily score is judged against the normal range, not against yesterday or the 7-day baseline.
- Its developer found **acute day-to-day change "too sensitive"** and moved away from it.
- **Optional subjective inputs:** sleep quality, motivation to train, perceived performance in recent sessions. Inputs you don't use are simply ignored.

**Learn:** this matches the research plan. Decide on the 7-day average against a long normal range, not on single days. Also copy "use whichever inputs you track": no input should be mandatory.

### Garmin Training Readiness
- **Six factors:** sleep score, HRV status, **remaining recovery time** from your last hard session, **acute training load**, sleep history and stress history. The weighting isn't disclosed.
- **HRV Status:** a **60-day baseline** that needs **at least 19 nights** to start. Until then it says plainly that it's initialising.

**Learn:**
1. Load and time since your last hard session belong in today's decision. CHINH gets these from session-RPE and the football recovery profile.
2. Show an explicit **"learning your baseline: 12/19 nights"** state instead of confident numbers built on thin data.

### Athlytic (warning case)
- Recovery from HRV and resting HR, plus an Apple Watch exertion target.
- A reviewer noted it can show **full recovery while muscles are still fatigued**, because it's cardiac-only. Its "machine learning" also showed no visible effect after a month.

**Learn:** keep CHINH's soreness and ankle taps; they cover what heart data can't see. Don't claim "AI" unless something visibly adapts.

### Gentler Streak
- **Activity Path:** places you between Rest and Active each day, from HRV, resting HR, sleep and recent workouts. Calibration takes about **3–4 weeks**.
- **Rest days count toward your streak** when rest is the right call.
- **"Go Gentler"** toggle: you tell it you're ill or stressed, and it adjusts without punishing you.
- Calm, non-guilt tone.

**Learn:** add a **"Feeling ill / high stress"** override. It forces a restoration plan and **excludes that day from baselines**, so a cold doesn't distort a month of normal values. CHINH's streaks (mobility, adherence) should count a correctly taken rest day as a success.

### Oura
- Readiness shown with **contributors** (what pulled it up or down).
- An AI advisor over your data, plus labs.

**Learn:** CHINH already shows its score breakdown. Make each contributor tappable, showing "what changed vs your normal".

---

## Sleep timing

### RISE
- Estimates **sleep need** and tracks **sleep debt**, then sets a bedtime that **shifts earlier gradually** when you need more sleep.
- Shows a **"Wake Zone"** and a roughly one-hour **"melatonin window"** predicted from phone use and light exposure.

**Learn:** the gradual shift backs up the spec's 45-minute clamp. CHINH can't estimate melatonin timing (no light or phone-use data), so it shouldn't pretend to. Instead, use **chronotype from your own sleep timing** (M5) to set where the bedtime target sits.

---

## Nutrition

### MacroFactor
- **Expenditure from data:** a smoothed weight trend that weights recent readings more, converted into stored energy and combined with logged intake. This solves for your real daily expenditure, accurate after about **14–30 days**.
- **Adherence-neutral:** going over or under target doesn't break the maths. Each week's targets are reset from what's known.
- **Known failure:** creatine loading or big carb/fibre swings shift weight without fat change. The fix is to skip a check-in.

**Learn:** if you start logging weight (and optionally intake), use a **trended weight** for protein and water targets and any calorie advice, never a single morning's weigh-in. Flag creatine starts the same way MacroFactor does.

---

## Learning from your own data

### Bearable
- **Factor Effect Report:** compares outcomes **with vs without** a factor. You choose the window, from the same day to the average over the **next 7 days**, to catch delayed effects.
- A factor appears after just **3 entries with and 3 without**, and users are told to "be critical of the results".

**Learn:**
1. Offer a **next-day** and **next-3-days** view; football and alcohol effects aren't only next-morning.
2. Don't copy the 3/3 minimum; that's noise. Use 8/8 with an interval, and label anything weaker "not enough data".

---

## Training

### Fitbod
- A **recovery % per muscle group** from recent training (48–72 h window), with manual fatigue overrides and outside activity included.
- **Estimated 1RM** (Epley and similar), max-effort sets to refresh it, and **reps in reserve** shaping the next session.
- Hypertrophy at 10–20 working sets per muscle per week.

**Learn:** CHINH's weekly template plus logged sessions can give a simple **"fresh / recovering"** state for upper, lower and ankle-chain. That's M3. Per-exercise e1RM is out of scope: CHINH uses strap data, not a lifting log.

---

## What none of them do (CHINH's edge)

1. **Hour-by-hour plan rewritten from the data.** The others give a score and generic advice; CHINH changes the actual schedule.
2. **Rehab-specific logic.** Ankle stiffness counts double, and objective ankle tests track progress left vs right.
3. **Football-specific recovery window** learned from your own matches.
4. **Structured personal experiments.** WHOOP and Bearable correlate after the fact; CHINH can *run* an alternating protocol and test it.
5. **Transparent and testable.** Every rule is in `engine.js` with a test and a stated trigger. Garmin, WHOOP and Athlytic don't disclose their weightings.

## Sources
- WHOOP 2026 features: https://www.whoop.com/us/en/thelocker/2026-whats-new/
- Bevel: https://kiledjian.com/2026/07/07/bevel-turns-apple-watch-data.html
- HRV4Training daily advice: https://www.hrv4training.com/blog2/redefining-hrv4trainings-daily-advice
- Garmin Training Readiness: https://the5krunner.com/garmin-features/training/training-readiness
- Athlytic review: https://ibikerun.substack.com/p/athlytic-app-review-iosapple-watch
- Gentler Streak: https://lifestack.ai/blog/gentler-streak
- RISE: https://www.risescience.com/blog/best-time-to-sleep-and-wake-up
- MacroFactor algorithms: https://macrofactor.com/macrofactors-algorithms-and-core-philosophy/
- Bearable Factor Effect Report: https://bearable.app/support/howto/the-factor-effect-report/
- Fitbod algorithm: https://fitbod.me/blog/fitbod-algorithm
- Oura Advisor: https://www.androidcentral.com/wearables/oura-app-advisor-labs-test-launch
