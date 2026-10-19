/* Shared helpers for the engine. Pure, no imports. */

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const clamp01 = (v) => clamp(v, 0, 1);
export const round1 = (v) => Math.round(v * 10) / 10;
export const isNum = (v) => Number.isFinite(v);

export const mean = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length;
export const stdev = (xs) => {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1));
};
export const median = (xs) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

/* ---------- Dates ---------- */
export function dateKey(d = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function shiftKey(key, days) {
  const [y, m, d] = key.split("-").map(Number);
  return dateKey(new Date(y, m - 1, d + days));
}

/* Whole days from a to b (b − a), DST-safe because both are noon-anchored. */
export function daysBetween(a, b) {
  const t = (k) => { const [y, m, d] = k.split("-").map(Number); return Date.UTC(y, m - 1, d); };
  return Math.round((t(b) - t(a)) / 86400000);
}

const DOW = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
export function weekday(key) {
  const [y, m, d] = key.split("-").map(Number);
  return DOW[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}
export const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
export const isWeekend = (key) => ["sat", "sun"].includes(weekday(key));

/* ---------- Clock times ---------- */
export function isHHMM(s) {
  return typeof s === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
}
/* "HH:MM" → minutes after midnight, or null */
export function toMin(hhmm) {
  if (!isHHMM(hhmm)) return null;
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}
/* minutes (any integer, wraps round the clock) → "HH:MM" */
export function fromMin(min) {
  const t = ((Math.round(min) % 1440) + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}
/* Evening-anchored minutes: times before 12:00 count as after midnight (+1440), so 23:30 < 00:30 */
export const eveningMin = (hhmm) => {
  const m = toMin(hhmm);
  return m == null ? null : m < 720 ? m + 1440 : m;
};
/* Accepts "HHMM" or "HH:MM" */
export function parseClock(s) {
  const m = String(s || "").trim().match(/^(\d{1,2}):?(\d{2})$/);
  if (!m) return null;
  const h = +m[1], mm = +m[2];
  return h <= 23 && mm <= 59 ? h * 60 + mm : null;
}

/* ---------- Deterministic randomness (stable per date) ---------- */
export function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/* ---------- Statistics ---------- */
/* Two-sided 95 % t critical values; df > 30 uses 1.96 + small-sample correction */
const T95 = [12.71, 4.30, 3.18, 2.78, 2.57, 2.45, 2.36, 2.31, 2.26, 2.23, 2.20, 2.18, 2.16, 2.14, 2.13,
  2.12, 2.11, 2.10, 2.09, 2.09, 2.08, 2.07, 2.07, 2.06, 2.06, 2.06, 2.05, 2.05, 2.05, 2.04];
export const tCrit95 = (df) => (df < 1 ? Infinity : df <= 30 ? T95[Math.floor(df) - 1] : 1.96 + 2.4 / df);

/* Welch difference in means (a − b) with a 95 % confidence interval */
export function welch(a, b) {
  if (a.length < 2 || b.length < 2) return null;
  const va = stdev(a) ** 2 / a.length, vb = stdev(b) ** 2 / b.length;
  const diff = mean(a) - mean(b);
  const se = Math.sqrt(va + vb);
  if (se === 0) return { diff, ci: [diff, diff], df: a.length + b.length - 2 };
  const df = (va + vb) ** 2 / ((va ** 2) / (a.length - 1) + (vb ** 2) / (b.length - 1));
  const t = tCrit95(df);
  return { diff, ci: [diff - t * se, diff + t * se], df };
}

/* Spearman rank correlation */
export function spearman(xs, ys) {
  const n = xs.length;
  if (n < 3) return null;
  const rank = (v) => {
    const idx = v.map((x, i) => [x, i]).sort((p, q) => p[0] - q[0]);
    const r = new Array(n);
    for (let i = 0; i < n;) {
      let j = i;
      while (j + 1 < n && idx[j + 1][0] === idx[i][0]) j++;
      for (let k = i; k <= j; k++) r[idx[k][1]] = (i + j) / 2 + 1;
      i = j + 1;
    }
    return r;
  };
  const rx = rank(xs), ry = rank(ys);
  const mx = mean(rx), my = mean(ry);
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) { num += (rx[i] - mx) * (ry[i] - my); dx += (rx[i] - mx) ** 2; dy += (ry[i] - my) ** 2; }
  return dx && dy ? num / Math.sqrt(dx * dy) : 0;
}
