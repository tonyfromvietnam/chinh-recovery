# Apple Health → CHINH: the morning Shortcut

How last night's data gets from your Helio Strap into CHINH with one tap, or none.

```
Helio Strap ──Bluetooth──▶ Zepp app ──▶ Apple Health ──Shortcut──▶ CHINH
                                                         #hrv=58&rhr=54&sleep=26640
```

The numbers travel after the `#` in the link. Browsers never send that part to a server, so your data goes from the Health app to the CHINH page on your phone and nowhere else.

---

## 1. One-time checks (2 min)

1. **Health → Sharing → Apps → Zepp:** turn on **Heart Rate Variability**, **Resting Heart Rate** and **Sleep**.
2. **Health → Browse → Heart → Heart Rate Variability → Show All Data:** confirm there are entries from Zepp. If there are none, update the strap in the Zepp app (HRV sharing needs Helio Strap firmware 3.3.10.3 or later).
3. Open **https://tonyfromvietnam.github.io/chinh-recovery/** once in Safari. Use Safari for CHINH, not a home-screen icon: iOS keeps separate storage for each, and the Shortcut opens Safari.

## 2. Build the Shortcut (5 min)

Shortcuts app → **+** → name it **CHINH Sync**. Add these actions in order (search for each by name):

**Make Zepp push last night's data (recommended)**

1. **Open App** → Zepp
2. **Wait** → 20 seconds
3. **Open App** → Shortcuts *(brings you back while the sync finishes)*

**HRV: average of the last 24 h**

4. **Find Health Samples**
   - Type: **Heart Rate Variability**
   - Add filter → Start Date **is in the last** **1 day**
5. **Get Details of Health Samples** → **Value**
6. **Calculate Statistics** → **Average**
7. **Round Number** → **Ones Place**
8. **Set Variable** → name it `HRV`

**Resting heart rate: latest reading**

9. **Find Health Samples**
   - Type: **Resting Heart Rate**
   - Start Date **is in the last** **1 day**
   - Sort by **Start Date**, Order **Latest First**, Limit **1**
10. **Get Details of Health Samples** → **Value**
11. **Set Variable** → `RHR`

**Sleep: total time asleep last night**

12. **Find Health Samples**
    - Type: **Sleep Analysis**
    - Start Date **is in the last** **18 hours**
    - Add filter → Value **is not** **In Bed**
    - Add filter → Value **is not** **Awake**
13. **Get Details of Health Samples** → **Duration**
14. **Calculate Statistics** → **Sum**
15. **Set Variable** → `Sleep`

**Send it to CHINH**

16. **Text** — type the link and insert the variables where shown:
    ```
    https://tonyfromvietnam.github.io/chinh-recovery/#hrv=[HRV]&rhr=[RHR]&sleep=[Sleep]
    ```
17. **Open URLs** → Text

Run it once by hand. iOS asks for Health permission: allow all three types.

## 3. Make it automatic

Shortcuts → **Automation** → **+** → **Alarm** → **Is Stopped** → choose **Wake-Up** (or a specific alarm) → **Run Immediately** → pick **CHINH Sync**.

Now turning off your alarm opens CHINH with sleep, HRV and resting HR filled in. You rate soreness and energy (about 10 seconds) and get the plan.

## 4. Backfill your last 30 days (run once)

Without history, CHINH needs 5 check-ins before it can compare you with yourself. This second Shortcut sends the last 30 days from Apple Health in one go, so your baselines are personal from day one. It only fills gaps and never overwrites a real check-in, so it's safe to run again.

New Shortcut → name it **CHINH Backfill**:

1. **Repeat** → **30** times. Everything below goes **inside** the Repeat until step 17.

   **Work out the day and its time windows**

2. **Date** → Current Date
3. **Adjust Date** → **Subtract** `Repeat Index` **days** from Date
4. **Adjust Date** → **Get Start of Day** of the result
5. **Adjust Date** → **Add** **12 hours** → **Set Variable** `WindowEnd` *(midday on that day)*
6. **Adjust Date** → **Subtract** **24 hours** from `WindowEnd` → **Set Variable** `WindowStart`
7. **Adjust Date** → **Subtract** **18 hours** from `WindowEnd` → **Set Variable** `SleepStart` *(6 pm the evening before)*
8. **Format Date** → `WindowEnd`, Date Format **Custom**: `yyyy-MM-dd`, Time Format **None** → **Set Variable** `Day`

   **Read that day's numbers**

9. **Find Health Samples** → Type **Heart Rate Variability**, filters: Start Date **is after** `WindowStart` and Start Date **is before** `WindowEnd` → **Get Details** **Value** → **Calculate Statistics** **Average** → **Round Number** **Ones Place** → **Set Variable** `HRV`
10. **Find Health Samples** → Type **Resting Heart Rate**, same two date filters, Sort **Start Date**, **Latest First**, Limit **1** → **Get Details** **Value** → **Set Variable** `RHR`
11. **Find Health Samples** → Type **Sleep Analysis**, filters: Start Date **is after** `SleepStart`, Start Date **is before** `WindowEnd`, Value **is not** **In Bed**, Value **is not** **Awake** → **Get Details** **Duration** → **Calculate Statistics** **Sum** → **Set Variable** `Sleep`

    **Add one row**

12. **Text** → `[Day],[HRV],[RHR],[Sleep]` *(commas between, no spaces)*
13. **Add to Variable** → `Rows`
14. **End Repeat**

    **Send everything to CHINH**

15. **Combine Text** → `Rows` with **Custom** separator `;`
16. **Text** → `https://tonyfromvietnam.github.io/chinh-recovery/#history=[Combined Text]`
17. **Open URLs**

It takes 10–30 seconds. CHINH shows "Imported 30 days from Apple Health" and the recovery card switches to "Baseline: your last 30 days". Days with no data are skipped, so a few gaps are fine.

**Test it without the Shortcut:**
`https://tonyfromvietnam.github.io/chinh-recovery/#history=2026-10-13,58,54,7.4;2026-10-14,61,53,7.1`

## What CHINH does with it

| Step | What happens |
|---|---|
| Parse | Reads `hrv`, `rhr`, `sleep` from the link. Sleep can be seconds, minutes or hours. Then clears the numbers from the address bar. |
| Store | Saves the day in your history on this phone. |
| Baseline | After 5 check-ins, compares you with your own 30-day average and spread instead of fixed numbers. |
| Score | Sleep 35% · HRV & RHR 35% · Soreness 20% · Energy 10%. |
| Directions | Flags what to stop, adjust or push today, with the number behind each. |
| Plan | Rewrites the schedule: swaps training on low-HRV days, moves wind-down earlier when you're in sleep debt, blocks football on ankle flares. |

## Troubleshooting

- **HRV missing or old:** Zepp only writes to Health after it syncs with the strap. Keep steps 1–3, or open Zepp yourself first.
- **Sleep looks doubled:** another app is also writing sleep to Health. In step 12 add a filter **Source is Zepp**.
- **Test without the Shortcut:** open `https://tonyfromvietnam.github.io/chinh-recovery/#hrv=58&rhr=54&sleep=7.4`.
- **Keep HRV from one source.** Baselines only make sense if every day's HRV comes from the same place, so don't mix in values typed from another app.
