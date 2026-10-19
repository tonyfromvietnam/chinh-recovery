# CHINH feature research: from data to daily decisions

Research basis for the next CHINH features. Every rule names its evidence. Where the evidence is weak, the rule says so and stays conservative.

The app answers eight daily questions:

1. How am I today?
2. Heavy lifting, light mobility, or rest?
3. How much water today?
4. What and when should I eat? Should I eat after 20:00?
5. Should I sleep earlier tonight, and when exactly?
6. What should I care about most today?
7. What am I lacking?
8. Something interesting about my body today.

---

## 0. What the data can and can't tell us

Helio Strap → Zepp → Apple Health → CHINH.

| Signal | Available? | Notes |
|---|---|---|
| HRV | Yes, sparse | Helio firmware 3.3.10.3+ writes about 3–4 readings a day. Use **overnight readings only** (00:00–07:00) so every day is measured the same way. |
| Resting heart rate | Yes | Daily value. |
| Sleep start, end, duration | Yes | From Sleep Analysis samples. This gives **bedtime, wake time and regularity**, the most useful sleep signals. |
| Sleep stages | Uncertain | Only if Zepp writes stages. Consumer staging is unreliable, so CHINH should never prescribe off deep or REM %. |
| Steps, active energy, workouts | Yes | For load and hydration. |
| Skin temperature, respiratory rate | **No** | The strap tracks respiration in Zepp, but Zepp doesn't write it to Apple Health and skin temperature isn't reported. The illness flag has to use RHR + HRV instead. |
| Nutrient status, hydration | **No** | No wearable measures these. Estimate from inputs; deficiencies need a blood test. |

**New inputs needed** (low effort):

- **Once:** body weight (update weekly), weekly training template (e.g. Mon Upper, Tue Lower, Wed football…), usual wake time.
- **Morning taps:** soreness, energy (already exist).
- **Evening taps:** session RPE (1–10), last caffeine time, alcohol yes/no, last meal time.
- **Automatic:** London weather from Open-Meteo (free, no key; adds fluid needs on warm days).

---

## 1. "How am I today?" — readiness

**Change from V1.1: decide on the 7-day trend, not a single morning.**

- Compute **ln(HRV)** (log-transformed; normalises the distribution).
- **Normal range** = 30–60-day mean of ln(HRV) ± **0.5 × SD** (the "smallest worthwhile change").
- Compare the **7-day rolling average** against that range. This is the method used in HRV-guided training research (Plews et al.; Kiviniemi et al. 2007). A single low morning is mostly noise; a 7-day average below range is a signal.
- **Instability flag:** a rising coefficient of variation of 7-day ln(HRV) has preceded non-functional overreaching in athletes (Plews et al.).
- **Illness/strain flag:** RHR ≥ 5 bpm above baseline on 2+ consecutive mornings, especially with HRV falling. This replaces the temperature and respiratory-rate flags the strap can't provide.

Honest note: HRV-guided training clearly helps endurance athletes avoid poor adaptation. A 2021 meta-analysis found it **reduced the number of negative responders** rather than raising average gains. Evidence for strength training is thinner, so CHINH should use HRV to pick intensity, not to cancel plans casually.

## 2. "Heavy or light today?" — training decision matrix

Inputs: the readiness band, **today's planned session** (from the template), recent load and ankle status.

| Readiness | Planned heavy lift / football | Planned light day |
|---|---|---|
| 7-day HRV **above** range, sleep ≥ 7 h | **Push**: attempt top sets / full intensity | Optional extra Zone 2 or skill work |
| 7-day HRV **in** range | **As planned** | As planned |
| Today's HRV < −1 SD but 7-day in range | **As planned, cap RPE 8** (single dips are noise) | As planned |
| 7-day HRV **below** range | **Reduce**: drop volume 30–40 %, RPE ≤ 7 | Mobility + Zone 2 |
| Below range **and** RHR flag | **Recover**: swap for walk + mobility | Rest, sleep, hydrate |

Overrides:
- **Ankle/hip ≥ 4/5:** no football, sprints, jumps or cutting, whatever the readiness.
- **Spacing:** avoid heavy lower-body work within ~48 h before football (fatigue raises injury risk). The app should flag template conflicts.

**Load tracking (session-RPE, Foster 2001):** load = RPE × minutes, for lifting and football alike. This takes 5 seconds after each session.
- **Weekly spike:** this week > 1.5× the 4-week average is shown as an *advisory*. The acute:chronic workload ratio's injury "sweet spot" has been heavily criticised, partly because of mathematical coupling (Impellizzeri et al. 2020; Lolli et al. 2019). CHINH uses it to start a conversation, never to block training on its own.
- **Monotony** (weekly mean ÷ SD of daily load) > 2 → "vary your week": too many similar days in a row (Foster 1998).

## 3. "How much water today?"

No sensor exists, so build it up from parts and show the sum:

- **Base:** EFSA adequate intake for men is **2.5 L/day total water**, about 20 % of which comes from food → **~2.0 L from drinks**.
- **Training:** + **0.5–0.75 L per hour** of session. Sweat rates vary 0.5–2 L/h.
  - **Personalise once:** weigh yourself before and after a football session. Every 1 kg lost ≈ 1 L, and you replace 1.25–1.5× that (ACSM).
- **Warm day:** + 0.5 L above 25 °C.
- **RHR flag:** + 0.5 L, since dehydration raises RHR.
- **Timing:** 500 ml on waking, 400–600 ml in the 2 h before training. Taper after 20:00 to protect sleep.
- **Check:** pale straw-coloured urine.

Example output: "**2.9 L today**: 2.0 base + 0.7 football (75 min) + 0.2 warm afternoon."

## 4. "What and when should I eat?"

**Protein**
- **1.6 g/kg/day.** Gains in lean mass plateau around here, with an upper confidence range of 2.2 (Morton et al. 2018, BJSM).
- **Spread over 4 meals** of ~0.4 g/kg, every 3–4 h (Schoenfeld & Aragon 2018).
- Example at 75 kg: 120 g/day → 4 × 30 g.

**Carbohydrate follows the day** (periodised, after Burke et al., IOC/ACSM guidance):

| Day | Carbs |
|---|---|
| Restoration / rest | 3–4 g/kg |
| Lifting day | 4–5 g/kg |
| Football / double day | 5–7 g/kg |

**Timing**

| Meal | When |
|---|---|
| Breakfast | Within ~1–2 h of waking on training days. Don't fast until noon on lifting days: it compresses protein into fewer meals. |
| Pre-training meal | 2–3 h before the session: carbs + protein, low fat and fibre. |
| Post-training | 20–40 g protein within ~2 h. |
| **Last main meal** | **≥ 2–3 h before target bedtime.** Consensus guidance: large late meals raise night-time heart rate and core temperature. The evidence is moderate. |
| Pre-sleep snack | On training days, 30–40 g slow protein (Greek yoghurt, cottage cheese, casein) is fine and supports overnight muscle repair (Res et al. 2012). |

**"Should I eat after 20:00?"** The answer is computed from tonight's bedtime: *"Bed 22:30 → finish dinner by 19:30. A protein snack at 21:00 is fine after football."*

**Food choices tied to the data**
- **Low-HRV / high-soreness days:** prioritise oily fish (omega-3), colourful veg and fruit, and enough carbs.
- **Alcohol:** a reliable HRV suppressant for that night. When logged, the next morning's score is annotated so it isn't mistaken for training fatigue.
- **Fibre:** 30 g/day (UK SACN). The app nudges this on restoration days.

**Calorie tracking: what the attached blueprint got wrong.** The "people underreport by 47 %" figure comes from 10 obese "diet-resistant" patients (Lichtman et al. 1992, NEJM). It doesn't generalise to you.

The *idea* behind it is still right, though: trust the **7-day average of body weight against energy expenditure** over food logs. Adjust intake by ~100–200 kcal/day if weight drifts away from goal for 2–3 weeks.

## 5. "Should I sleep earlier tonight?"

**Regularity first.** In 60,977 UK Biobank participants, sleep regularity predicted mortality more strongly than sleep duration (Windred et al. 2024, SLEEP).

**Target bedtime**
- Bedtime = tomorrow's wake time − sleep need − 15 min to fall asleep.
- **Sleep need:** 8 h by default. Athletes benefit from more: extending basketball players' sleep improved sprint times and shooting accuracy (Mah et al. 2011).
- **Debt repayment:** + up to 30 min per night while 3-night debt > 2 h.
- **Hard session tomorrow** (football / heavy lower): + 15 min.
- **Clamp:** at most **45 min earlier than your 7-day average bedtime**, so you don't wreck regularity chasing debt.

**Derived cut-offs, shown as one evening timeline**

| Cut-off | Rule |
|---|---|
| **Last coffee** | Bedtime − **8.8 h** for a standard cup; − **13.2 h** for a pre-workout (Gardiner et al. 2023, Sleep Med Rev; caffeine cut total sleep by ~45 min). |
| **Last main meal** | Bedtime − 3 h |
| **Warm shower** | Bedtime − 1 to 2 h: a 40–42.5 °C shower or bath shortens time to fall asleep by ~10 min (Haghayegh et al. 2019). |
| **Lights dim / screens down** | Bedtime − 60 min |
| **Naps** | ≤ 20 min, before 15:00 |

**Sleep quality metrics CHINH shows**
- **Efficiency:** time asleep ÷ time in bed, where in-bed time is available. Aim **≥ 85 %**; the blueprint's 90 % is aspirational, not the clinical cut-off.
- **Regularity:** SD of your sleep midpoint over 7 nights. Aim < 30 min.
- **Not shown:** deep/REM targets (consumer staging isn't accurate enough to act on) and sleep latency (the strap can't tell lying down from falling asleep).

## 6. "What should I care about today?" — one focus

Pick the **single weakest pillar against your own baseline** and make it the day's headline:
- sleep debt
- regularity drift
- HRV trend
- load spike
- ankle
- protein consistency

One focus beats ten flags. For example:

> **Today's focus: regularity.** Your bedtime has drifted 52 min later over 5 nights. Lights out 22:45 tonight.

## 7. "What am I lacking?" — honest tiers

1. **Measurable from your data:** sleep debt, regularity, hydration estimate, protein (if logged), steps, Zone 2 minutes, mobility streak.
2. **Seasonal and well-established:** the **NHS advises 10 µg vitamin D daily from October to March** for everyone in the UK, because winter sunlight is too weak. That applies to you right now in London.
   - **Creatine monohydrate 3–5 g/day** is among the best-supported supplements for strength (ISSN position stand). It's optional.
3. **Needs a blood test:** ferritin/iron, vitamin D level, B12 and lipids can't be read from a wearable. That's outside CHINH's scope (strap data only); ask your GP if you want them checked.

## 8. Ankle–hip rehab, made trackable

- **Proprioceptive training works.** An 8-week unsupervised home balance programme cut **recurrent ankle sprains by 35 %** (Hupperets et al. 2009, BMJ). A previous sprain is the biggest risk factor for the next one.
  - CHINH adds a progression tracker: single-leg balance, eyes open → eyes closed → unstable surface → hop and stick, 3×/week, 8 weeks.
- **FIFA 11+ warm-up before football** reduced injuries in footballers by roughly a third (Soligard et al. 2008, BMJ). CHINH puts it on the schedule before every football block.
- **Not a diagnosis tool:** if ankle pain is 4+/5 for more than a week, or swelling returns, the app says to see a physio.

## 9. Interesting fact of the day

Pick a fact **tied to today's data**, with its source. Examples:

- *Short sleep:* adolescent athletes sleeping < 8 h had 1.7× the injury rate (Milewski et al. 2014).
- *Coffee at 15:00:* caffeine's half-life is ~5 h, so half of a 15:00 coffee is still active at 20:00.
- *High HRV after rest days:* in elite endurance athletes, very high HRV can signal detraining or saturation rather than great recovery (Plews et al.).
- *Breathwork:* five minutes of cyclic sighing (double inhale, long exhale) improved mood and lowered breathing rate more than mindfulness meditation (Balban et al. 2023, Cell Reports Medicine).
- *Regularity:* irregular sleepers had higher mortality even with the same total sleep (Windred et al. 2024).
- *Ankle:* 8 weeks of balance training cuts repeat sprains by about a third (Hupperets et al. 2009).

## 10. Learning *your* body (where AI fits)

1. **Now: rules engine.** Everything above is transparent, testable rules in `engine.js`. This is better than a model for one person with weeks of data.
2. **After ~60 days: personal effects (n-of-1).** Tag each day (late meal, alcohol, caffeine after cut-off, football, bedtime after 23:30). Compare **next-morning HRV and RHR** with and without each tag, with a confidence interval.
   - Only show an effect once there are ≥ 8 days on each side. Example: *"Dinner after 21:00 lowers your next-morning HRV by 9 % (±4 %)."*
   - This answers "how do I transform this data to understand myself?" with your evidence, not population averages.
3. **Optional: language model for the brief.** Claude can turn the engine's output into the morning message. It **writes, it doesn't decide**: numbers and rules stay in code so they can be tested. Training a model from scratch isn't needed and wouldn't work on one person's data.

---

## Example morning brief (target output)

> **Morning, Tony. Balanced Flow, 68 %.**
> HRV 7-day average is inside your normal range; last night was 6 h 40 m, 50 min short.
>
> **Train:** Upper as planned, cap at RPE 8. Tomorrow is football, so no heavy legs.
> **Water:** 2.6 L (2.0 base + 0.6 for the session).
> **Food:** 4 × 30 g protein; ~330 g carbs. Pre-gym meal 14:30. Dinner by 19:45.
> **Tonight:** in bed **22:45** (15 min earlier, paying down debt). Last coffee **14:00**.
> **Focus:** sleep. 1 h 40 m debt across 3 nights.
> **Did you know?** Half of a 15:00 coffee is still in your system at 20:00.

---

## Roadmap

| Version | Adds | Needs |
|---|---|---|
| **V1.2 Today brief** | Bedtime & caffeine/meal cut-offs, water target, protein/carb targets, one focus, fact of the day | Weight, weekly template, wake time; Shortcut adds sleep start/end, active energy, workouts |
| **V1.3 Training load** | Decision matrix with planned session, session-RPE load, monotony, 48 h spacing check, ankle progression tracker, FIFA 11+ block | Session-RPE tap |
| **V1.4 Weekly review+** | Extend the existing `weeklyReview` with regularity, load chart and "what moves your HRV" (n-of-1) | ~8 weeks of tags |

## Sources

- HRV-guided training overview (Kiviniemi 2007; Plews; meta-analyses 2020–21): https://www.athletedata.health/guides/hrv-guided-training
- Gardiner et al. 2023, caffeine & sleep meta-analysis: https://www.ajmc.com/view/caffeine-and-sleep-review-suggests-consumption-guidelines
- Windred et al., sleep regularity & mortality: https://pmc.ncbi.nlm.nih.gov/articles/PMC10782489/
- Lichtman et al. 1992, NEJM: https://pubmed.ncbi.nlm.nih.gov/1454084/
- ACWR critique: https://pmc.ncbi.nlm.nih.gov/articles/PMC7534938/ · https://www.sportsinjurybulletin.com/the-acutechronic-workload-ratio-science-or-religion/
- Helio Strap specs: https://gadgetsandwearables.com/technical-specs/amazfit-helio-strap/
- Other studies cited from the literature (Morton 2018 BJSM; Schoenfeld & Aragon 2018 JISSN; Burke 2011 J Sports Sci; Res 2012 MSSE; Haghayegh 2019 Sleep Med Rev; Mah 2011 SLEEP; Milewski 2014 J Pediatr Orthop; Hupperets 2009 BMJ; Soligard 2008 BMJ; Balban 2023 Cell Rep Med; Foster 1998/2001; EFSA 2010 water DRVs; NHS vitamin D guidance). Verify exact figures before shipping user-facing copy.
