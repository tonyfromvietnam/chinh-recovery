# Apple Health → CHINH: the morning Shortcut

How last night's data gets from your Helio Strap into CHINH with one tap, or none.

```
Helio Strap ──Bluetooth──▶ Zepp app ──▶ Apple Health ──Shortcut──▶ CHINH
                                                         #hrv=58&rhr=54&sleep=26640
```

The numbers travel after the `#` in the link. Browsers never send that part to a server, so your data goes from the Health app to the CHINH page on your phone and nowhere else.

A web page can't read Apple Health or the strap by itself (iOS doesn't allow it), so the Shortcut is the bridge.

Written against iOS 18/26 Shortcuts. Older versions name a few things differently; those are noted in brackets.

---

## 1. One-time checks (2 min)

1. **Health → Sharing → Apps → Zepp:** turn on **Heart Rate Variability**, **Resting Heart Rate** and **Sleep**.
2. **Health → Browse → Heart → Heart Rate Variability → Show All Data:** confirm there are entries from **Zepp** for last night. If there are none, open Zepp so it syncs with the strap. If there are still none, update the strap in Zepp (HRV sharing needs Helio Strap firmware 3.3.10.3 or later).
3. Open **https://tonyfromvietnam.github.io/chinh-recovery/** once in Safari. Use Safari for CHINH, not a home-screen icon: iOS keeps separate storage for each, and the Shortcut opens Safari.

## 2. Build the Shortcut (5 min)

Shortcuts → **+** → name it **Health Sync**.

**Two habits that avoid most errors:**

- Before adding an action, **tap the action it should go under**. Each new action then lands in the right place and picks up the previous result automatically.
- On every **Find Health Samples**, add the filter **Source is Zepp**. Other apps (the iPhone itself, Bevel, a watch) also write to Health; without this filter their numbers get mixed in. Sleep in particular comes out doubled.

### HRV: average of the last 24 h

1. **Find Health Samples**
   - **Type** is **Heart Rate Variability**
   - **Add Filter** → **Start Date** is in the last **1 day**
   - **Add Filter** → **Source** is **Zepp**
   - If a **Value is anything** filter appears, remove it with **⊖**.
2. **Get Details of Health Samples** → tap **Detail** → **Value**. It should read *Get Value from Health Samples*.
3. **Calculate Statistics** → **Average**
4. **Round Number** → **Integer** *(older iOS: Ones Place)*
5. **Set Variable** → tap **Variable Name** → `HRV`

### Resting heart rate: latest reading

6. **Find Health Samples**
   - **Type** is **Resting Heart Rate**
   - **Start Date** is in the last **1 day**
   - **Source** is **Zepp**
   - **Sort by** Start Date, **Order** Latest First, **Limit** on, **1**
7. **Get Details of Health Samples** → **Value**
8. **Set Variable** → `RHR`

### Sleep: total time asleep last night

9. **Find Health Samples**
   - **Type** is **Sleep** *(older iOS: Sleep Analysis; not "Sleep Changes")*
   - **Start Date** is in the last **1 day**
   - **Source** is **Zepp**
   - **Add Filter** → **Value** is not **In Bed**
   - **Add Filter** → **Value** is not **Awake**
   - Check it says **where All of the following are true**.
   - The two Value filters aren't there by default: add them yourself. Without them, time lying awake in bed is counted as sleep.
10. **Get Details of Health Samples** → **Duration**
11. **Calculate Statistics** → **Sum**. It may read *Calculate the Sum of Duration*; that's correct.
12. **Set Variable** → `Sleep`

### Send it to CHINH

13. **Text**: type the link and insert the variables where shown (tap **Select Variable** above the keyboard, then tap the matching **Set Variable** action). No spaces or line breaks:
    ```
    https://tonyfromvietnam.github.io/chinh-recovery/#hrv=[HRV]&rhr=[RHR]&sleep=[Sleep]
    ```
14. **Open URLs**

Tap ▶︎ once. iOS asks for Health permission: allow all three types.

**Test as you go:** add **Show Result** at the bottom after each part and tap ▶︎. Expect HRV as a whole number (e.g. `78`), resting HR around 40–70, and sleep as seconds (e.g. `25859` = 7 h 11 min). Delete Show Result when you're done.

## 3. What happens when it runs

CHINH opens, saves today's check-in and shows the plan. **There is no form to fill in.** Soreness, ankle/hip stiffness, mental energy and sleep quality carry over from the last time you rated them, and a banner says which day they're from.

Tap **Update check-in** only when something has changed, for example the ankle feels worse or you slept badly. Your new ratings then carry forward from that day.

## 4. Make it automatic

Shortcuts → **Automation** → **+** → **Alarm** → **Is Stopped** → choose **Wake-Up** (or a specific alarm) → **Run Immediately** → pick **Health Sync**.

Zepp only writes to Health after it syncs with the strap, so open Zepp for about 15 seconds before turning off the alarm, or right after. (Shortcuts' **Open App** action doesn't list Zepp on some iPhones, so the Shortcut can't do this step for you.)

## 5. Backfill your last 30 days (run once)

Without history, CHINH needs 5 check-ins before it can compare you with yourself. This second Shortcut sends the last 30 days from Apple Health in one go, so your baselines are personal from day one. It only fills gaps and never overwrites a real check-in, so it's safe to run again.

New Shortcut → name it **CHINH Backfill**:

1. **Repeat** → **30** times. Everything below goes **inside** the Repeat until step 14.

   **Work out the day and its time windows**

2. **Date** → Current Date
3. **Adjust Date** → **Subtract** `Repeat Index` **days** from Date
4. **Adjust Date** → **Get Start of Day** of the result
5. **Adjust Date** → **Add** **12 hours** → **Set Variable** `WindowEnd` *(midday on that day)*
6. **Adjust Date** → **Subtract** **24 hours** from `WindowEnd` → **Set Variable** `WindowStart`
7. **Adjust Date** → **Subtract** **18 hours** from `WindowEnd` → **Set Variable** `SleepStart` *(6 pm the evening before)*
8. **Format Date** → `WindowEnd`, Date Format **Custom**: `yyyy-MM-dd`, Time Format **None** → **Set Variable** `Day`

   **Read that day's numbers.** Every Find gets **Source is Zepp**, and each Get Details goes directly under its Find.

9. **Find Health Samples** → Type **Heart Rate Variability**; filters: Start Date **is after** `WindowStart`, Start Date **is before** `WindowEnd`, **Source is Zepp** → **Get Details** **Value** → **Calculate Statistics** **Average** → **Round Number** **Integer** → **Set Variable** `HRV`
10. **Find Health Samples** → Type **Resting Heart Rate**, the same three filters, Sort **Start Date**, **Latest First**, Limit **1** → **Get Details** **Value** → **Set Variable** `RHR`
11. **Find Health Samples** → Type **Sleep**; filters: Start Date **is after** `SleepStart`, Start Date **is before** `WindowEnd`, **Source is Zepp**, Value **is not** **In Bed**, Value **is not** **Awake** → **Get Details** **Duration** → **Calculate Statistics** **Sum** → **Set Variable** `Sleep`

    **Add one row**

12. **Text** → `[Day],[HRV],[RHR],[Sleep]` *(commas between, no spaces)*
13. **Add to Variable** → `Rows`
14. **End Repeat**

    **Send everything to CHINH**

15. **Combine Text** → `Rows` with **Custom** separator `;`
16. **Text** → `https://tonyfromvietnam.github.io/chinh-recovery/#history=[Combined Text]`
17. **Open URLs**

It takes 10–30 seconds. CHINH shows "Imported 30 days from Apple Health", and the bottom of the recovery card switches to "Baseline: your last 30 days". Days with no data are skipped, so a few gaps are fine.

**Test it without the Shortcut:**
`https://tonyfromvietnam.github.io/chinh-recovery/#history=2026-10-13,58,54,7.4;2026-10-14,61,53,7.1`

## What CHINH does with it

| Step | What happens |
|---|---|
| Parse | Reads `hrv`, `rhr`, `sleep` from the link. Sleep can be seconds, minutes or hours. Then clears the numbers from the address bar. |
| Check in | Saves today with the synced numbers plus your last soreness, energy and sleep-quality ratings. No form. |
| Baseline | After 5 days of history, compares you with your own 30-day average and spread instead of fixed numbers. |
| Score | Sleep 35% · HRV & RHR 35% · Soreness 20% · Energy 10%. |
| Directions | Flags what to stop, adjust or push today, with the number behind each. |
| Plan | Rewrites the schedule: swaps training on low-HRV days, moves wind-down earlier when you're in sleep debt, blocks football on ankle flares. |

## Troubleshooting

| You see | Fix |
|---|---|
| *"Couldn't convert from Text to Health sample"* | A **Get Details** action is reading the wrong input. Delete it, tap the **Find** action above, and add Get Details again so it lands directly underneath. It should read *Get Value (or Duration) from Health Samples*. |
| Sleep about 14 h (around 50 000 s) | Two apps are writing sleep. Add **Source is Zepp** to the sleep Find. CHINH ignores anything over 14 h, so the day gets no sleep value until this is fixed. |
| Shortcut fails with no samples | Zepp hasn't synced. Open Zepp, wait for it to finish, run again. |
| Safari opens but nothing is filled in | Check the Text action: no spaces, and the HRV/RHR/Sleep chips were inserted as variables rather than typed. |
| **Open App** doesn't list Zepp | Skip it. Open Zepp yourself before running the Shortcut. |
| No "Start Date … hours" option | Use **1 day**. A daytime nap the day before then counts towards sleep; adjust the hours with Update check-in on those days. |
| Test without the Shortcut | Open `https://tonyfromvietnam.github.io/chinh-recovery/#hrv=58&rhr=54&sleep=7.4`. |

**Keep HRV from one source.** Baselines only make sense if every day's HRV comes from the same place, so keep **Source is Zepp** on and don't mix in values typed from another app.
