/* M1 — Fit the plan around the real day. The Shortcut sends busy blocks as times only
   (#busy=0930-1030,1400-1500) and a football fixture start (#fb=1900); never event titles. */
import { parseClock, toMin, fromMin } from "./util.js";

export const CALENDAR = {
  dayStart: 7 * 60,
  dayEnd: 21 * 60,
  deepWorkBefore: 13 * 60,
  step: 5,
  minShortenedMin: 15,
  warmUpMin: 20, // FIFA 11+
  preMatchMealBeforeMin: 150,
  preMatchMealMin: 30,
  footballMin: 90,
};

const MOVABLE = new Set(["focus", "study", "mobility", "breath", "errands", "training"]);

/* "0930-1030,1400-1500" → [{start:570,end:630},{start:840,end:900}], merged and sorted */
export function parseBusy(str) {
  if (!str) return [];
  const blocks = String(str).split(",").map((s) => {
    const [a, b] = s.trim().split("-");
    const start = parseClock(a), end = parseClock(b);
    return start != null && end != null && end > start ? { start, end } : null;
  }).filter(Boolean).sort((x, y) => x.start - y.start);
  const merged = [];
  for (const b of blocks) {
    const last = merged[merged.length - 1];
    if (last && b.start <= last.end) last.end = Math.max(last.end, b.end);
    else merged.push({ ...b });
  }
  return merged;
}

/* "1900" or "19:00" → [{type:"football", start:1140}] */
export function parseFixtures(fb) {
  const start = parseClock(fb);
  return start == null ? [] : [{ type: "football", start }];
}

const overlaps = (a, b) => a.start < b.end && b.start < a.end;
const free = (slot, occupied) => occupied.every((o) => !overlaps(slot, o));

function nearestSlot(item, dur, occupied, { dayStart, dayEnd, step }) {
  let best = null;
  for (let s = dayStart; s + dur <= dayEnd; s += step) {
    const slot = { start: s, end: s + dur };
    if (!free(slot, occupied)) continue;
    const d = Math.abs(s - item.start);
    if (!best || d < best.d) best = { start: s, d };
  }
  return best?.start ?? null;
}

function longestGapBefore(occupied, limit, { dayStart }) {
  const blocks = occupied.filter((o) => o.start < limit).sort((a, b) => a.start - b.start);
  let cursor = dayStart, best = null;
  for (const b of blocks) {
    if (b.start > cursor && (!best || b.start - cursor > best.end - best.start)) best = { start: cursor, end: Math.min(b.start, limit) };
    cursor = Math.max(cursor, b.end);
  }
  if (limit > cursor && (!best || limit - cursor > best.end - best.start)) best = { start: cursor, end: limit };
  return best;
}

/* Moves movable blocks out of meetings, makes room for a football fixture, and reports what changed.
   Fixed blocks (morning light, meals, work, wind-down) stay where they are. */
export function fitScheduleToCalendar(schedule, busy = [], fixtures = [], opts = {}) {
  const C = { ...CALENDAR, ...opts };
  if (!busy.length && !fixtures.length) return { schedule, moved: [], dropped: [] };

  let items = schedule.map((it) => ({ ...it, start: toMin(it.time), end: toMin(it.time) + it.dur }));
  const moved = [], dropped = [];

  // Football fixture: the training block becomes the match, with an 11+ warm-up and a pre-match meal
  const fixture = fixtures.find((f) => f.type === "football");
  const added = [];
  if (fixture) {
    const t = items.find((i) => i.slot === "training" && i.type === "training");
    if (t) {
      t.start = fixture.start; t.end = fixture.start + C.footballMin; t.dur = C.footballMin;
      t.time = fromMin(fixture.start); t.fixed = true; t.fromCalendar = true;
    }
    added.push({ id: "cal-warmup", type: "mobility", title: "FIFA 11+ warm-up", dur: C.warmUpMin, fixed: true,
      detail: "Running, strength, plyometric and balance drills. Cuts football injuries by about a third.",
      start: fixture.start - C.warmUpMin, end: fixture.start });
    added.push({ id: "cal-prematch", type: "fuel", title: "Pre-match meal", dur: C.preMatchMealMin, fixed: true,
      detail: "Carbs + some protein, low fat and fibre. 2–3 h before kick-off.",
      start: fixture.start - C.preMatchMealBeforeMin, end: fixture.start - C.preMatchMealBeforeMin + C.preMatchMealMin });
  }
  items = [...items, ...added.map((a) => ({ ...a, time: fromMin(a.start) }))];

  const occupied = [...busy, ...items.filter((i) => i.fixed || !MOVABLE.has(i.type))];
  const movable = items.filter((i) => !i.fixed && MOVABLE.has(i.type)).sort((a, b) => a.start - b.start);

  for (const it of movable) {
    if (free(it, occupied)) { occupied.push(it); continue; }
    let start = null, dur = it.dur;
    if (it.type === "focus") {
      const gap = longestGapBefore(occupied, C.deepWorkBefore, C);
      if (gap && gap.end - gap.start >= dur) start = gap.start;
    }
    if (start == null) start = nearestSlot(it, dur, occupied, C);
    if (start == null) {
      dur = Math.max(C.minShortenedMin, Math.round(it.dur / 2 / 5) * 5);
      start = nearestSlot(it, dur, occupied, C);
    }
    if (start == null) {
      dropped.push({ id: it.id, title: it.title, from: it.time });
      it.dropped = true;
      continue;
    }
    moved.push({ id: it.id, title: it.title, from: it.time, to: fromMin(start), shortened: dur < it.dur });
    Object.assign(it, { start, end: start + dur, time: fromMin(start), dur, movedFrom: it.time, shortened: dur < it.dur || undefined });
    occupied.push(it);
  }

  const out = items.filter((i) => !i.dropped)
    .sort((a, b) => a.start - b.start)
    .map(({ start, end, fixed, ...rest }) => rest);
  return { schedule: out, moved, dropped };
}
