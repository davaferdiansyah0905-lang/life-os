import type { Recurrence, Schedule, Task } from "./types";
import { addDays, dayOfWeek, diffDays, fromMin, minutesBetween, nowLocal, rangeKeys, roundUpTo, toMin, todayKey } from "./time";
import { PRODUCTIVE_CATEGORIES, REST_CATEGORY, WORK_WINDOWS } from "./constants";

export interface Occurrence {
  key: string; // `${id}@${date}`
  schedule: Schedule;
  date: string;
  startMin: number;
  endMin: number;
  completed: boolean;
}

export const RECURRENCE_LABEL: Record<Recurrence, string> = {
  none: "Tidak berulang",
  daily: "Setiap hari",
  weekdays: "Setiap hari kerja (Sen–Jum)",
  weekly: "Setiap minggu",
  monthly: "Setiap bulan",
};

export function occursOn(s: Pick<Schedule, "date" | "recurrence" | "recurrenceUntil" | "excludedDates">, date: string): boolean {
  if (date < s.date) return false;
  if (s.recurrenceUntil && date > s.recurrenceUntil) return false;
  if (s.excludedDates?.includes(date)) return false;
  switch (s.recurrence) {
    case "none":
      return date === s.date;
    case "daily":
      return true;
    case "weekdays": {
      const d = dayOfWeek(date);
      return d >= 1 && d <= 5;
    }
    case "weekly":
      return dayOfWeek(date) === dayOfWeek(s.date);
    case "monthly":
      return date.slice(8, 10) === s.date.slice(8, 10);
    default:
      return date === s.date;
  }
}

export function occurrencesOn(schedules: Schedule[], date: string): Occurrence[] {
  const out: Occurrence[] = [];
  for (const s of schedules) {
    if (!occursOn(s, date)) continue;
    out.push({
      key: `${s.id}@${date}`,
      schedule: s,
      date,
      startMin: toMin(s.start),
      endMin: Math.max(toMin(s.end), toMin(s.start) + 1),
      completed: !!s.completedDates?.includes(date),
    });
  }
  return out.sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);
}

export function occurrencesInRange(schedules: Schedule[], from: string, to: string) {
  return rangeKeys(from, to).flatMap((d) => occurrencesOn(schedules, d));
}

export const overlaps = (aS: number, aE: number, bS: number, bE: number) => Math.max(aS, bS) < Math.min(aE, bE);

/** Merge intervals and return total covered minutes. */
export function unionMinutes(intervals: [number, number][]) {
  const sorted = intervals.filter(([a, b]) => b > a).sort((x, y) => x[0] - y[0]);
  let total = 0;
  let cur: [number, number] | null = null;
  for (const [a, b] of sorted) {
    if (!cur || a > cur[1]) {
      if (cur) total += cur[1] - cur[0];
      cur = [a, b];
    } else cur[1] = Math.max(cur[1], b);
  }
  if (cur) total += cur[1] - cur[0];
  return total;
}

export function mergeIntervals(intervals: [number, number][]) {
  const sorted = intervals.filter(([a, b]) => b > a).sort((x, y) => x[0] - y[0]);
  const out: [number, number][] = [];
  for (const [a, b] of sorted) {
    const last = out[out.length - 1];
    if (last && a <= last[1]) last[1] = Math.max(last[1], b);
    else out.push([a, b]);
  }
  return out;
}

export interface ScheduleCandidate {
  id?: string;
  date: string;
  start: string;
  end: string;
  recurrence: Recurrence;
  recurrenceUntil?: string;
  excludedDates?: string[];
}

export interface Conflict {
  other: Schedule;
  date: string;
  overlapStart: string;
  overlapEnd: string;
  occurrences: number; // number of dates on which they collide (within horizon)
}

/**
 * Detect overlaps between a candidate schedule and existing ones.
 * Recurring candidates are checked for the next `horizonDays` days.
 */
export function findConflicts(schedules: Schedule[], c: ScheduleCandidate, horizonDays = 28): Conflict[] {
  const s = toMin(c.start);
  const e = toMin(c.end);
  if (e <= s) return [];
  const others = schedules.filter((x) => x.id !== c.id);
  const dates: string[] = [];
  if (c.recurrence === "none") dates.push(c.date);
  else {
    const from = c.date > todayKey() ? c.date : todayKey();
    for (let i = 0; i <= horizonDays; i++) {
      const d = addDays(from, i);
      if (occursOn(c, d)) dates.push(d);
    }
  }
  const map = new Map<string, Conflict>();
  for (const d of dates) {
    for (const o of occurrencesOn(others, d)) {
      if (overlaps(s, e, o.startMin, o.endMin)) {
        const existing = map.get(o.schedule.id);
        if (existing) existing.occurrences++;
        else
          map.set(o.schedule.id, {
            other: o.schedule,
            date: d,
            overlapStart: fromMin(Math.max(s, o.startMin)),
            overlapEnd: fromMin(Math.min(e, o.endMin)),
            occurrences: 1,
          });
      }
    }
  }
  return [...map.values()].sort((a, b) => (a.date + a.overlapStart).localeCompare(b.date + b.overlapStart));
}

/** Free gaps on a date inside [from, to] (minutes). */
export function freeSlots(schedules: Schedule[], date: string, from = 0, to = 1440, excludeId?: string): [number, number][] {
  const busy = mergeIntervals(
    occurrencesOn(
      schedules.filter((s) => s.id !== excludeId),
      date,
    ).map((o) => [o.startMin, o.endMin]),
  );
  const out: [number, number][] = [];
  let cursor = from;
  for (const [a, b] of busy) {
    if (b <= cursor) continue;
    if (a >= to) break;
    if (a > cursor) out.push([cursor, Math.min(a, to)]);
    cursor = Math.max(cursor, b);
  }
  if (cursor < to) out.push([cursor, to]);
  return out.filter(([a, b]) => b - a > 0);
}

export interface SlotSuggestion {
  date: string;
  start: string;
  end: string;
}

/** Suggest alternative slots with the same duration (same day first, then following days). */
export function suggestAlternatives(
  schedules: Schedule[],
  date: string,
  durationMin: number,
  opts: { excludeId?: string; dayFrom?: number; dayTo?: number; max?: number; preferNear?: number } = {},
): SlotSuggestion[] {
  const dayFrom = opts.dayFrom ?? toMin("06:00");
  const dayTo = opts.dayTo ?? toMin("23:00");
  const max = opts.max ?? 4;
  const today = todayKey();
  const nowM = toMin(nowLocal().slice(11));
  const out: SlotSuggestion[] = [];
  for (let i = 0; i < 7 && out.length < max; i++) {
    const d = addDays(date, i);
    if (d < today) continue;
    const startBound = d === today ? Math.max(dayFrom, roundUpTo(nowM + 5, 15)) : dayFrom;
    const gaps = freeSlots(schedules, d, startBound, dayTo, opts.excludeId).filter(([a, b]) => b - a >= durationMin);
    // prefer slots near the originally requested time on the same day
    if (i === 0 && opts.preferNear !== undefined) {
      const near = opts.preferNear;
      gaps.sort((x, y) => Math.abs(clampIn(near, x, durationMin) - near) - Math.abs(clampIn(near, y, durationMin) - near));
    }
    for (const g of gaps) {
      if (out.length >= max) break;
      const st = i === 0 && opts.preferNear !== undefined ? clampIn(opts.preferNear, g, durationMin) : roundUpTo(g[0], 15) <= g[1] - durationMin ? roundUpTo(g[0], 15) : g[0];
      out.push({ date: d, start: fromMin(st), end: fromMin(st + durationMin) });
      if (i > 0) break; // one per following day keeps the list varied
    }
  }
  return out;
}

function clampIn(target: number, gap: [number, number], dur: number) {
  const latest = gap[1] - dur;
  const t = Math.min(Math.max(target, gap[0]), latest);
  const rounded = roundUpTo(t, 15);
  return rounded <= latest ? rounded : t;
}

// ── Time management stats ───────────────────────────────────────────
export interface DayStats {
  scheduledMin: number; // union of non-rest activities
  restMin: number; // union of rest activities
  freeMin: number; // unscheduled time inside active hours
  unallocatedMin: number; // 24h − scheduled − rest
  productiveMin: number;
  count: number;
  completed: number;
}

export function dayStats(schedules: Schedule[], date: string, activeStart = "05:00", activeEnd = "22:00"): DayStats {
  const occ = occurrencesOn(schedules, date);
  const work = occ.filter((o) => o.schedule.category !== REST_CATEGORY);
  const allIntervals = occ.map((o) => [o.startMin, o.endMin] as [number, number]);
  const scheduledMin = unionMinutes(work.map((o) => [o.startMin, o.endMin]));
  const allCovered = unionMinutes(allIntervals);
  const restMin = allCovered - scheduledMin;
  const aS = toMin(activeStart);
  const aE = toMin(activeEnd);
  const activeCovered = unionMinutes(allIntervals.map(([a, b]) => [Math.max(a, aS), Math.min(b, aE)]));
  return {
    scheduledMin,
    restMin: Math.max(0, restMin),
    freeMin: Math.max(0, aE - aS - activeCovered),
    unallocatedMin: Math.max(0, 1440 - allCovered),
    productiveMin: unionMinutes(work.filter((o) => PRODUCTIVE_CATEGORIES.includes(o.schedule.category)).map((o) => [o.startMin, o.endMin])),
    count: occ.length,
    completed: occ.filter((o) => o.completed).length,
  };
}

export interface WeekStats {
  from: string;
  to: string;
  count: number;
  productiveMin: number;
  scheduledMin: number;
  unallocatedMin: number;
  freeMin: number;
  mostActiveDay: { date: string; minutes: number } | null;
  dueCount: number; // occurrences already finished (end time passed)
  completedCount: number;
  completionPct: number;
  perDay: { date: string; scheduledMin: number; productiveMin: number; count: number; completed: number }[];
}

export function weekStats(schedules: Schedule[], weekStart: string, activeStart = "05:00", activeEnd = "22:00"): WeekStats {
  const days = rangeKeys(weekStart, addDays(weekStart, 6));
  const now = nowLocal();
  let count = 0,
    productive = 0,
    scheduled = 0,
    unalloc = 0,
    free = 0,
    due = 0,
    completed = 0;
  const perDay = days.map((d) => {
    const st = dayStats(schedules, d, activeStart, activeEnd);
    count += st.count;
    productive += st.productiveMin;
    scheduled += st.scheduledMin;
    unalloc += st.unallocatedMin;
    free += st.freeMin;
    for (const o of occurrencesOn(schedules, d)) {
      const endLocal = `${d}T${fromMin(o.endMin)}`;
      if (endLocal <= now || o.completed) {
        due++;
        if (o.completed) completed++;
      }
    }
    return { date: d, scheduledMin: st.scheduledMin, productiveMin: st.productiveMin, count: st.count, completed: st.completed };
  });
  const most = perDay.reduce<{ date: string; minutes: number } | null>(
    (best, d) => (d.scheduledMin > (best?.minutes ?? 0) ? { date: d.date, minutes: d.scheduledMin } : best),
    null,
  );
  return {
    from: days[0],
    to: days[6],
    count,
    productiveMin: productive,
    scheduledMin: scheduled,
    unallocatedMin: unalloc,
    freeMin: free,
    mostActiveDay: most,
    dueCount: due,
    completedCount: completed,
    completionPct: due ? Math.round((completed / due) * 100) : 0,
    perDay,
  };
}

// ── Smart deadline planner ──────────────────────────────────────────
export interface PlannedSession {
  id: string;
  date: string;
  start: string;
  end: string;
  minutes: number;
  outsidePreference: boolean;
}

export interface PlanResult {
  sessions: PlannedSession[];
  requiredMin: number;
  alreadyScheduledMin: number;
  plannedMin: number;
  shortfallMin: number;
  feasible: boolean;
  message: string;
}

export function planTask(
  schedules: Schedule[],
  task: Pick<Task, "id" | "startDate" | "deadline" | "estimatedMinutes">,
  opts: { preferred: keyof typeof WORK_WINDOWS; sessionMax?: number; minSession?: number; bufferMin?: number },
): PlanResult {
  const sessionMax = opts.sessionMax ?? 120;
  const minSession = opts.minSession ?? 30;
  const buffer = opts.bufferMin ?? 0;
  const now = nowLocal();
  const today = now.slice(0, 10);
  const nowM = toMin(now.slice(11));
  const [deadlineDate, deadlineTime = "23:59"] = task.deadline.split("T");
  const deadlineM = toMin(deadlineTime);

  const alreadyScheduledMin = schedules
    .filter((s) => s.taskId === task.id && s.recurrence === "none" && `${s.date}T${s.end}` > now)
    .reduce((sum, s) => sum + (toMin(s.end) - toMin(s.start)), 0);
  const requiredMin = Math.max(0, task.estimatedMinutes);
  let remaining = Math.max(0, requiredMin - alreadyScheduledMin);

  if (task.deadline <= now) {
    return { sessions: [], requiredMin, alreadyScheduledMin, plannedMin: 0, shortfallMin: remaining, feasible: false, message: "Deadline sudah lewat. Ubah deadline atau selesaikan tugas secepatnya." };
  }
  if (remaining === 0) {
    return { sessions: [], requiredMin, alreadyScheduledMin, plannedMin: 0, shortfallMin: 0, feasible: true, message: "Waktu pengerjaan tugas ini sudah terjadwal penuh." };
  }

  const firstDay = task.startDate > today ? task.startDate : today;
  const days = firstDay <= deadlineDate ? rangeKeys(firstDay, deadlineDate) : [];
  const working: Schedule[] = [...schedules];
  const sessions: PlannedSession[] = [];

  const windows: { key: keyof typeof WORK_WINDOWS; outside: boolean }[] = [{ key: opts.preferred, outside: false }];
  if (opts.preferred !== "fleksibel") windows.push({ key: "fleksibel", outside: true });

  // Prefer meaningful blocks (≥ 60 min) first, inside the favourite window, then anywhere;
  // only fall back to short 30-min fragments when nothing bigger is available.
  for (const threshold of [60, minSession]) {
    for (const win of windows) {
      // pass 0: one session per day; pass 1: allow additional sessions per day
      for (let pass = 0; pass < 2 && remaining > 0; pass++) {
        for (const d of days) {
          if (remaining <= 0) break;
          if (pass === 0 && sessions.some((s) => s.date === d)) continue;
          let from = toMin(WORK_WINDOWS[win.key].from);
          let to = toMin(WORK_WINDOWS[win.key].to);
          if (d === today) from = Math.max(from, roundUpTo(nowM + 10, 15));
          if (d === deadlineDate) to = Math.min(to, deadlineM - buffer);
          if (to - from < Math.min(threshold, remaining)) continue;
          const need = Math.min(threshold, remaining);
          const gaps = freeSlots(working, d, from, to)
            .map(([a, b]) => [roundUpTo(a, 15), b] as [number, number])
            .filter(([a, b]) => b - a >= need)
            .sort((x, y) => y[1] - y[0] - (x[1] - x[0]) || x[0] - y[0]);
          const g = gaps[0];
          if (!g) continue;
          const minutes = Math.min(g[1] - g[0], sessionMax, remaining);
          const sess: PlannedSession = {
            id: `plan-${d}-${g[0]}`,
            date: d,
            start: fromMin(g[0]),
            end: fromMin(g[0] + minutes),
            minutes,
            outsidePreference: win.outside,
          };
          sessions.push(sess);
          working.push({ id: sess.id, title: "plan", date: d, start: sess.start, end: sess.end, category: "Akademik", priority: "medium", recurrence: "none", createdAt: now });
          remaining -= minutes;
        }
      }
      if (remaining <= 0) break;
    }
    if (remaining <= 0) break;
  }

  sessions.sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
  const plannedMin = sessions.reduce((s, x) => s + x.minutes, 0);
  const shortfall = Math.max(0, requiredMin - alreadyScheduledMin - plannedMin);
  const daysLeft = diffDays(deadlineDate, today);
  let message: string;
  if (shortfall > 0)
    message = `Waktu luang sebelum deadline tidak cukup. Kurang ${Math.round(shortfall)} menit — pertimbangkan mengurangi aktivitas lain atau memperpanjang deadline.`;
  else if (sessions.some((s) => s.outsidePreference))
    message = `Sebagian sesi berada di luar waktu kerja favorit karena slot ${WORK_WINDOWS[opts.preferred].label.split(" ")[0].toLowerCase()} penuh.`;
  else message = `Tersedia ${sessions.length} sesi dalam ${daysLeft + 1} hari sebelum deadline. Semua sesi bebas bentrok.`;
  return { sessions, requiredMin, alreadyScheduledMin, plannedMin, shortfallMin: shortfall, feasible: shortfall === 0, message };
}

export function minutesOfSchedule(s: Pick<Schedule, "start" | "end">) {
  return Math.max(0, toMin(s.end) - toMin(s.start));
}

/** Current & next activity for "today" preview. */
export function currentAndNext(schedules: Schedule[], date = todayKey(), nowMin?: number) {
  const occ = occurrencesOn(schedules, date);
  const n = nowMin ?? toMin(nowLocal().slice(11));
  const current = occ.find((o) => o.startMin <= n && n < o.endMin) ?? null;
  const next = occ.find((o) => o.startMin > n) ?? null;
  return { occ, current, next };
}

export function remainingFreeToday(schedules: Schedule[], date = todayKey()) {
  const n = toMin(nowLocal().slice(11));
  const gaps = freeSlots(schedules, date, n, 1440);
  return gaps.reduce((s, [a, b]) => s + (b - a), 0);
}

export { minutesBetween };
