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
3. Open **https://chinh-recovery.vercel.app/** once in Safari. Use Safari for CHINH, not a home-screen icon: iOS keeps separate storage for each, and the Shortcut opens Safari.

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
    https://chinh-recovery.vercel.app/#hrv=[HRV]&rhr=[RHR]&sleep=[Sleep]
    ```
14. **Open URLs**

Tap ▶︎ once. iOS asks for Health permission: allow all three types.

**Test as you go:** add **Show Result** at the bottom after each part and tap ▶︎. Expect HRV as a whole number (e.g. `78`), resting HR around 40–70, and sleep as seconds (e.g. `25859` = 7 h 11 min). Delete Show Result when you're done.

## 2b. Upgrade to v2 (10 min, recommended)

v2 makes the numbers more trustworthy: overnight-only HRV, and bed and wake times for your body clock and sleep need. Every part is optional, and old links keep working.

**HRV: overnight only, with a reading count.** CHINH marks a day "high confidence" only when HRV is overnight with 2+ readings.
1. In the HRV **Find Health Samples** (step 1), change the date filter to **Start Date is after** → *Start of Today*. Add **Date** → Current Date → **Adjust Date** → *Get Start of Day*, then press-and-hold the filter date → Select Variable.
2. Under the HRV **Get Details** (step 2), add **Count** → *Items*, then **Set Variable** `HRVn`.

**Sleep: the main night only, plus bed and wake times.**
3. In the sleep **Find Health Samples** (step 9), change the date filter to **Start Date is after** *yesterday 18:00*: **Date** → **Adjust Date** *Get Start of Day* → **Adjust Date** *Subtract 6 hours*. This keeps afternoon naps out.
4. **Bed time:** duplicate that Find, then set **Sort by Start Date**, **Oldest First**, **Limit 1**. Add **Get Details** → *Start Date* → **Format Date** (Custom `HH:mm`) → **Set Variable** `Bed`.
5. **Wake time:** duplicate it again, then set **Sort by End Date**, **Latest First**, **Limit 1**. Add **Get Details** → *End Date* → **Format Date** (`HH:mm`) → **Set Variable** `Wake`.

**New link** (step 13):
```
https://chinh-recovery.vercel.app/#hrv=[HRV]&hrvn=[HRVn]&hw=o&rhr=[RHR]&sleep=[Sleep]&bed=[Bed]&wake=[Wake]
```

Test it without the Shortcut:
`https://chinh-recovery.vercel.app/#hrv=58&hrvn=3&hw=o&rhr=54&sleep=7.4&bed=23:05&wake=07:01`

## 3. What happens when it runs

CHINH opens, saves today's check-in and shows the plan. **There is no form to fill in.** Soreness, ankle/hip stiffness and mental energy carry over from the last time you rated them, and a banner says which day they're from.

The banner also asks **"How rested do you feel?"** (Poor / OK / Great). Until you tap one, sleep is scored on duration only, so an old quality rating can't skew today's score.

Tap **Update check-in** only when something has changed, for example the ankle feels worse or you slept badly. Your new ratings then carry forward from that day.

## 4. Make it automatic

Shortcuts → **Automation** → **+** → **Alarm** → **Is Stopped** → choose **Wake-Up** (or a specific alarm) → **Run Immediately** → pick **Health Sync**.

Zepp only writes to Health after it syncs with the strap, so open Zepp for about 15 seconds before turning off the alarm, or right after. (Shortcuts' **Open App** action doesn't list Zepp on some iPhones, so the Shortcut can't do this step for you.)

## 5. Backfill your last 30 days (run once)

Without history, CHINH needs 5 check-ins before it can compare you with yourself. This second Shortcut sends the last 30 days from Apple Health in one go, so your baselines are personal from day one. It only fills gaps and never overwrites a real check-in, so it's safe to run again. If you're signed in to sync, the 30 days also upload to your database.

**First, one setting:** 30 days is about 800 Health items, more than Shortcuts shares by default. Turn on **Settings → Apps → Shortcuts → Advanced → Allow Sharing Large Amounts of Data**. Without it the run stops with *"This action is trying to share 803 Health items, which is not allowed"*.

New Shortcut → name it **BackFill**:

1. **Repeat** → **30** times. Everything down to step 14 goes **inside** the Repeat.

   **Work out the day's time window**

2. **Date** → Current Date
3. **Adjust Date** → **Subtract** `Repeat Index` **days**
4. **Adjust Date** → **Get Start of Day**
5. **Adjust Date** → **Add** **12 hours** → **Set Variable** `WindowEnd` *(midday on that day)*
6. **Adjust Date** → **Subtract** **24 hours** from `WindowEnd` → **Set Variable** `WindowStart` *(midday the day before)*

   **Read that day's numbers.** Each **Get Details** goes directly under its **Find** (tap the Find first), otherwise it reads the wrong input.

   To put a variable into a date filter, **press and hold** the date slot → **Select Variable** → tap the matching **Set Variable** action. A plain tap only opens the date picker.

7. **Find Health Samples**: Type **Heart Rate Variability** · Start Date **is between** `WindowStart` and `WindowEnd` · **Source is Zepp**
   → **Get Details** **Value** → **Calculate Statistics** **Average** → **Round Number** **Integer** → **Set Variable** `HRV`
8. **Find Health Samples**: Type **Resting Heart Rate** · the same two filters · Sort **Start Date**, **Latest First**, Limit **1**
   → **Get Details** **Value** → **Set Variable** `RHR`
9. **Find Health Samples**: Type **Sleep** · the same two filters · Value **is not In Bed** · Value **is not Awake**
   → **Get Details** **Duration** → **Calculate Statistics** **Sum** → **Set Variable** `Sleep`

   *(Midday to midday covers the whole night before, so sleep needs no window of its own.)*

    **Add one row**

   **v2 (optional, more accurate):**
   - For HRV, use a window of 00:00–10:00 of that day: **Adjust Date** `WindowEnd` *Subtract 12 hours* → `NightStart`; *Subtract 2 hours* → `NightEnd`. Add **Count** → `HRVn`.
   - Get `Bed` (earliest sleep Start Date) and `Wake` (latest End Date) as `HH:mm`, as in section 2b.

10. **Text**: `[WindowEnd],[HRV],[RHR],[Sleep]`. Insert all four as variables, commas between, no spaces.
    v2 rows add three more columns: `[WindowEnd],[HRV],[RHR],[Sleep],[HRVn],[Bed],[Wake]`. CHINH reads 4-, 5- and 7-column rows.
    The date can come out as `2026-10-16` or `16 Oct 2026 at 12:00`; CHINH reads both. If you'd like the short form, tap the WindowEnd chip → **Date** → **Custom** → `yyyy-MM-dd`.
11. **Add to Variable** → `Rows`
12. **End Repeat**

    **Send everything to CHINH**

13. **Combine Text** → `Rows`, separator **Custom** `;`
14. **URL Encode** → Combined Text. **Don't skip this:** dates with spaces make an invalid link, and Open URLs then fails silently.
15. **Text** → `https://chinh-recovery.vercel.app/#history=[URL Encoded Text]`
16. **Open URLs**

It takes 10–30 seconds. CHINH shows **"Imported 30 days from Apple Health (N with HRV)"**, and the bottom of the recovery card switches to **"Baseline: your last 30 days"**. Days with no data are left empty, so a few gaps are fine.

**Check it before importing:** temporarily swap **Open URLs** for **Quick Look** and set Repeat to **2**. Each row should look like `16 Oct 2026 at 12:00,77,48,24039` (date, HRV, resting HR, sleep seconds).

**Test the import without the Shortcut:**
`https://chinh-recovery.vercel.app/#history=2026-10-13,58,54,7.4;2026-10-14,61,53,7.1`

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
| BackFill rows start with `12:00` or all show today's date | The date chip in the row Text is formatting the time, or a date that doesn't change each loop. Use the **WindowEnd** variable in the row (step 10). |
| BackFill sleep empty in every row | Get Details under the sleep Find is reading the wrong input. Delete it and add it again directly under the Find. |
| BackFill runs but nothing imports | Missing **URL Encode** (step 14), or the large-data setting is off. |
| Test without the Shortcut | Open `https://chinh-recovery.vercel.app/#hrv=58&rhr=54&sleep=7.4`. |

**Keep HRV from one source.** Baselines only make sense if every day's HRV comes from the same place, so keep **Source is Zepp** on and don't mix in values typed from another app.
