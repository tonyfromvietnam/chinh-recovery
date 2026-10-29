# Supabase sync: one-time setup (about 10 min)

Without this, CHINH is local-only and works exactly as before. With it, every check-in, rating and ticked block is saved to your own private database, and any device you sign in on shows the same history.

```
iPhone (Shortcut) ──▶ CHINH ──▶ Supabase "days" table ◀── CHINH on desktop
```

**Privacy:** the table has row-level security. Every query only ever sees rows belonging to the signed-in account, so even someone with the public key can't read your data.

## 1. Create the project
1. Go to **supabase.com**, then **Sign in with GitHub**.
2. **New project**:
   - Name: `chinh`
   - Database password: generate one and save it in your password manager (CHINH never needs it)
   - Region: **London (eu-west-2)**
3. **Create new project**, then wait about a minute.

## 2. Create the table
**SQL Editor → New query**, paste the whole of [`supabase/schema.sql`](../supabase/schema.sql), then **Run**. You should see *Success. No rows returned*.

**Live updates:** the end of the script also turns on Realtime for the table, so an open CHINH tab updates within a second of your phone saving. If you ran an older copy of the script, run the latest one again; it's safe to repeat. Check it under **Database → Publications → supabase_realtime**: `days` should be listed.

**Check it's working:** **Table Editor → days** shows one row per day once you've signed in on the phone.

**Profile table (added with the morning brief):** the same script also creates `profile`: one row with your wake times and weekly training plan. If you set up Supabase before this was added, run the script again. Until you do, days still sync and the profile stays on each device.

## 3. Allow sign-in links back to CHINH
**Authentication → URL Configuration**
- **Site URL:** `https://www.duychinhdinh.com/chinh-recovery`
- **Redirect URLs → Add URL:** `https://www.duychinhdinh.com/**` and `https://duychinhdinh.com/**` (plus `https://chinh-recovery.vercel.app/**`, where the app is hosted, and `http://localhost:5173/` if you run it locally)

Email sign-in is on by default, under **Authentication → Sign In / Providers → Email**.

## 4. Give CHINH the two public values
1. In Supabase, open **Project Settings → API** (called **API Keys** in some versions) and copy:
   - **Project URL**, e.g. `https://abcd1234.supabase.co`
   - The **anon / publishable** key. **Not** the `service_role` or secret key: that one bypasses security and must never leave Supabase.
2. On **Vercel**, open the **chinh-recovery** project → **Settings → Environment Variables** and add (for Production and Preview):
   - `VITE_SUPABASE_URL` = the Project URL
   - `VITE_SUPABASE_ANON_KEY` = the anon / publishable key
3. Redeploy: **Deployments → ⋯ on the latest → Redeploy**, or merge any change to `main`.

## 5. Sign in and upload your history
1. **On the iPhone first**, because it holds your history: open CHINH in **Safari** and tap **Sync across devices** in the header.
2. Enter your email, then tap the link in the email **on the same iPhone**. CHINH opens signed in and uploads everything on the phone: the backfill, every check-in and every rating.
3. **On desktop:** do the same. Your history downloads, and from then on both devices stay in step. CHINH re-syncs whenever you switch back to it.

## 6. Lock the door
Once you're signed in on your devices: **Authentication → Sign In / Providers → turn off "Allow new users to sign up"**. Nobody else can create an account, and you can still sign in.

## 7. Server sync and decision records (optional, about 10 min)

This lets the morning Shortcut send its numbers straight to CHINH's server (`api/ingest.js` on Vercel) instead of opening Safari. The server scores the day with the same engine as the app, saves it to `days`, and writes a permanent **decision record** to `decisions`: what went in, the baselines, each part of the score, every direction with the number that triggered it, the training decision and the plan. The app also writes one each time it scores a day while you're signed in.

1. **Run the latest `supabase/schema.sql`** again (SQL Editor → New query → Run). It adds the `decisions` table. Check **Table Editor → decisions** exists.
2. **Find your user id:** Supabase → **Authentication → Users** → click your account → copy the **UID**.
3. **Copy the server key:** **Project Settings → API Keys** → **Secret keys** (`sb_secret_…`), or the legacy `service_role` key. This key bypasses row-level security, so it goes **only** into Vercel, never into GitHub, the app or a Shortcut.
4. **Make a sync token:** a long random password (40+ characters from your password manager, letters and digits only). The Shortcut sends it; the server rejects anything else.
5. **Vercel → project `chinh-recovery` → Settings → Environment Variables**, for **Production**:

   | Name | Value |
   |---|---|
   | `SUPABASE_URL` | your Project URL, e.g. `https://abcd1234.supabase.co` (skip it if `VITE_SUPABASE_URL` is already there) |
   | `SUPABASE_SERVICE_ROLE_KEY` | the secret key from step 3 |
   | `OWNER_USER_ID` | the UID from step 2 |
   | `INGEST_TOKEN` | the token from step 4 |

6. **Redeploy:** Vercel → **Deployments** → the latest → **⋯ → Redeploy**.
7. **Change the Shortcut:** section 2d of `docs/APPLE_HEALTH_SHORTCUT.md`.

**Check it:** run Health Sync. You get a notification with today's score, and a new row appears in both **days** (today) and **decisions**. To see why CHINH decided something on any day: **Table Editor → decisions**, filter `date`, and open `data`.

## 8. AI trainer (optional, about 5 min)

The **New plan** button on the training card asks Claude to pick today's exercises (`api/coach.js`). It only chooses *what* to do: the engine still sets how hard, and every AI session must pass CHINH's checks or you get the standard session. Only a summary goes to Claude (today's archetype, directions with their numbers, rungs, recent logs, ankle ratings), never your name, email or raw history. It costs a few pence a request on your Anthropic account, and it's limited to one plan a day plus 3 new plans.

1. **Run the latest `supabase/schema.sql`** again. It adds the `coach_usage` table and the `claim_coach_request` function that counts today's requests.
2. **Make sure sign-ups are off** (step 6), so nobody else can get a sign-in.
3. **Create an API key** at console.anthropic.com → **API Keys**. Set a monthly spend limit there too.
4. **Vercel → project `chinh-recovery` → Settings → Environment Variables**, for **Production**:

   | Name | Value |
   |---|---|
   | `ANTHROPIC_API_KEY` | the key from step 3 |
   | `OWNER_EMAIL` | the email you sign in to CHINH with; anyone else gets "for the owner only" |
   | `COACH_MODEL` | optional; defaults to `claude-opus-5-5` |
   | `SUPABASE_ANON_KEY` | skip it if `VITE_SUPABASE_ANON_KEY` is already there |

5. **Redeploy**, sign in to CHINH and press **AI plan** on a strength day.

## 9. Live stats on www.duychinhdinh.com (optional)

`api/stats.js` gives the website a public summary: the latest recovery score and day type, the 30 daily scores, and HRV, resting HR and sleep as 7-day averages (never a single day's reading, ratings, directions or why a day was off). It reuses the section 7 variables and stays off until you add, in Vercel → `chinh-recovery` → Environment Variables:

| Name | Value |
|---|---|
| `PUBLIC_STATS` | `on` (remove it to take the numbers off the website again) |

Redeploy. Check https://chinh-recovery.vercel.app/api/stats shows the summary; the homepage picks it up within about 15 minutes.

## 10. Public read-only dashboard (optional)

Anyone who opens www.duychinhdinh.com/chinh-recovery without signing in sees your dashboard, read-only: score, directions, plan, charts and history. Only you, signed in, can check in, log sessions or change settings. Visitors' browsers save nothing.

Kept private, removed on the server before anything is sent (`api/_public.js`): **bed and wake times** (on every day and in your settings) and **the reason for a rest day** (ill or high stress shows as "rest day"). Your sleep need, which is learned from bed and wake times, is sent as a single number so visitors see the same score as you. Decision records are never served.

It reuses the section 7 variables. Turn it on in Vercel → `chinh-recovery` → Environment Variables (type **Config**, Production):

| Name | Value |
|---|---|
| `PUBLIC_DASHBOARD` | `on` (remove it, then redeploy, to make the dashboard private again) |

Redeploy, then open the address in a private window: you should see the blue "read-only" banner and your data.

## How clashes are settled
Each day carries the time it was last changed. If phone and desktop both changed the same day, the newer change wins, and fields only one side has are kept. A real check-in always beats a backfilled day. Signing out keeps the copy on that device.

## Troubleshooting
| You see | Fix |
|---|---|
| No "Sync across devices" button | The two variables aren't set in Vercel, or the site hasn't been redeployed since (step 4). |
| The email link opens CHINH but you're not signed in | Add the CHINH address to **Redirect URLs** (step 3). |
| "Email rate limit exceeded" | Supabase's built-in email allows a few emails an hour. Wait and try again. |
| Desktop only updates when you click back into it | Realtime isn't on for `days`. Run `schema.sql` again (step 2). |
| `decisions` stays empty | Run the latest `schema.sql` (step 7.1). The app only writes decision records while signed in. |
| Sync error mentioning "row-level security" | `schema.sql` didn't run fully. Run it again (it's safe to repeat). |
