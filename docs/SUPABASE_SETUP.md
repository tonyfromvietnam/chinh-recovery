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

## 3. Allow sign-in links back to CHINH
**Authentication → URL Configuration**
- **Site URL:** `https://tonyfromvietnam.github.io/chinh-recovery/`
- **Redirect URLs → Add URL:** `https://tonyfromvietnam.github.io/chinh-recovery/` (and `http://localhost:5173/chinh-recovery/` if you run it locally)

Email sign-in is on by default, under **Authentication → Sign In / Providers → Email**.

## 4. Give CHINH the two public values
1. In Supabase, open **Project Settings → API** (called **API Keys** in some versions) and copy:
   - **Project URL**, e.g. `https://abcd1234.supabase.co`
   - The **anon / publishable** key. **Not** the `service_role` or secret key: that one bypasses security and must never leave Supabase.
2. On GitHub, go to **chinh-recovery → Settings → Secrets and variables → Actions → Variables tab → New repository variable** and add:
   - `SUPABASE_URL` = the Project URL
   - `SUPABASE_ANON_KEY` = the anon / publishable key
3. Redeploy: **Actions → Test and deploy → Run workflow**, or merge any change to `main`.

## 5. Sign in and upload your history
1. **On the iPhone first**, because it holds your history: open CHINH in **Safari** and tap **Sync across devices** in the header.
2. Enter your email, then tap the link in the email **on the same iPhone**. CHINH opens signed in and uploads everything on the phone: the backfill, every check-in and every rating.
3. **On desktop:** do the same. Your history downloads, and from then on both devices stay in step. CHINH re-syncs whenever you switch back to it.

## 6. Lock the door
Once you're signed in on your devices: **Authentication → Sign In / Providers → turn off "Allow new users to sign up"**. Nobody else can create an account, and you can still sign in.

## How clashes are settled
Each day carries the time it was last changed. If phone and desktop both changed the same day, the newer change wins, and fields only one side has are kept. A real check-in always beats a backfilled day. Signing out keeps the copy on that device.

## Troubleshooting
| You see | Fix |
|---|---|
| No "Sync across devices" button | The two variables aren't set, or the site hasn't been redeployed since (step 4). |
| The email link opens CHINH but you're not signed in | Add the CHINH address to **Redirect URLs** (step 3). |
| "Email rate limit exceeded" | Supabase's built-in email allows a few emails an hour. Wait and try again. |
| Desktop only updates when you click back into it | Realtime isn't on for `days`. Run `schema.sql` again (step 2). |
| Sync error mentioning "row-level security" | `schema.sql` didn't run fully. Run it again (it's safe to repeat). |
