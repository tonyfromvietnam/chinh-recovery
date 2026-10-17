import { createClient } from "@supabase/supabase-js";

/* Optional cloud sync. Without these two values the app runs exactly as before: local only.
   The publishable (anon) key is safe in the browser; row-level security keeps each user to their own rows.
   Never put the service_role key here. */
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = url && key
  ? createClient(url, key, {
      // Implicit flow, so an email link works even when it opens in a different browser to the one that asked
      auth: { flowType: "implicit", persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;

const TABLE = "days";

export async function pullDays() {
  const { data, error } = await supabase.from(TABLE).select("data").order("date");
  if (error) throw error;
  return data.map((r) => r.data);
}

export async function pushDays(userId, days) {
  if (!days.length) return;
  const rows = days.map((d) => ({ user_id: userId, date: d.date, data: d, updated_at: new Date().toISOString() }));
  const { error } = await supabase.from(TABLE).upsert(rows, { onConflict: "user_id,date" });
  if (error) throw error;
}
