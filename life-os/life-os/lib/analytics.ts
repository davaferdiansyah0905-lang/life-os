import type { Schedule, Settings, Task, Transaction } from "./types";
import { REST_CATEGORY, SAVINGS_CATEGORY } from "./constants";
import { categoryBreakdown, confirmed, expenseOf, incomeOf, inRange, sum } from "./finance";
import { occurrencesOn, weekStats } from "./schedule";
import { isOverdue } from "./tasks";
import { addDays, addMonths, daysInMonth, fmtWeekday, nowLocal, rangeKeys, startOfMonth, startOfWeek, todayKey } from "./time";
import { moneyShort, num } from "./format";

export interface DayScore {
  date: string;
  total: number;
  done: number;
  score: number | null;
}

/** Daily productivity = completed items ÷ planned items (tasks due that day + non-rest scheduled activities). */
export function dayScore(tasks: Task[], schedules: Schedule[], date: string): DayScore {
  const due = tasks.filter((t) => t.deadline.slice(0, 10) === date);
  const doneTasks = due.filter((t) => t.status === "completed").length;
  const occ = occurrencesOn(schedules, date).filter((o) => o.schedule.category !== REST_CATEGORY);
  const doneOcc = occ.filter((o) => o.completed).length;
  const total = due.length + occ.length;
  const done = doneTasks + doneOcc;
  return { date, total, done, score: total ? Math.round((done / total) * 100) : null };
}

export function rangeScore(tasks: Task[], schedules: Schedule[], from: string, to: string) {
  const days = rangeKeys(from, to).map((d) => dayScore(tasks, schedules, d));
  const total = days.reduce((s, d) => s + d.total, 0);
  const done = days.reduce((s, d) => s + d.done, 0);
  return { days, total, done, score: total ? Math.round((done / total) * 100) : null };
}

export function taskCompletionRate(tasks: Task[], from: string, to: string, now = nowLocal()) {
  const due = tasks.filter((t) => {
    const d = t.deadline.slice(0, 10);
    return d >= from && d <= to && (t.deadline <= now || t.status === "completed");
  });
  const done = due.filter((t) => t.status === "completed").length;
  return { due: due.length, done, pct: due.length ? Math.round((done / due.length) * 100) : null };
}

export function lateCompletions(tasks: Task[]) {
  return tasks.filter((t) => t.status === "completed" && t.completedAt && t.completedAt > t.deadline);
}

/** Categories with the most missed (overdue or completed late) tasks. */
export function missedByCategory(tasks: Task[], now = nowLocal()) {
  const missed = [...tasks.filter((t) => isOverdue(t, now)), ...lateCompletions(tasks)];
  const map = new Map<string, number>();
  for (const t of missed) map.set(t.category, (map.get(t.category) ?? 0) + 1);
  return { list: [...map.entries()].map(([category, count]) => ({ category, count })).sort((a, b) => b.count - a.count), tasks: missed };
}

export function mostProductiveWeekday(tasks: Task[], schedules: Schedule[], days = 28, today = todayKey()) {
  const acc = new Map<number, { done: number; total: number }>();
  for (const d of rangeKeys(addDays(today, -days + 1), today)) {
    const s = dayScore(tasks, schedules, d);
    const dow = new Date(d + "T00:00:00Z").getUTCDay();
    const cur = acc.get(dow) ?? { done: 0, total: 0 };
    cur.done += s.done;
    cur.total += s.total;
    acc.set(dow, cur);
  }
  let best: { dow: number; pct: number; done: number } | null = null;
  for (const [dow, v] of acc) {
    if (!v.total) continue;
    const p = (v.done / v.total) * 100;
    if (!best || p > best.pct || (p === best.pct && v.done > best.done)) best = { dow, pct: p, done: v.done };
  }
  return { best, perWeekday: acc };
}

export const WEEKDAY_NAMES = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

export interface Insight {
  id: string;
  tone: "good" | "warn" | "bad" | "info";
  text: string;
}

/** Generates insights strictly from recorded data. Skips any insight without enough data. */
export function buildInsights(data: { tasks: Task[]; schedules: Schedule[]; transactions: Transaction[]; settings: Settings }): Insight[] {
  const { tasks, schedules, transactions, settings } = data;
  const out: Insight[] = [];
  const today = todayKey();
  const ws = startOfWeek(today);

  const tc = taskCompletionRate(tasks, ws, addDays(ws, 6));
  if (tc.pct !== null)
    out.push({
      id: "task-week",
      tone: tc.pct >= 80 ? "good" : tc.pct >= 50 ? "info" : "warn",
      text: `Kamu menyelesaikan ${tc.pct}% tugas yang jatuh tempo minggu ini (${tc.done} dari ${tc.due}).`,
    });

  const overdue = tasks.filter((t) => isOverdue(t));
  if (overdue.length) out.push({ id: "overdue", tone: "bad", text: `Ada ${overdue.length} tugas terlambat. Prioritaskan "${overdue.sort((a, b) => a.deadline.localeCompare(b.deadline))[0].title}".` });

  const wk = weekStats(schedules, ws, settings.activeHoursStart, settings.activeHoursEnd);
  if (wk.count)
    out.push({
      id: "free-week",
      tone: "info",
      text: `Kamu punya ${num(wk.freeMin / 60, 1)} jam waktu luang yang belum teralokasi di jam aktif (${settings.activeHoursStart}–${settings.activeHoursEnd}) minggu ini.`,
    });
  if (wk.dueCount >= 3)
    out.push({ id: "sched-week", tone: wk.completionPct >= 75 ? "good" : "warn", text: `Tingkat penyelesaian jadwal minggu ini ${wk.completionPct}% (${wk.completedCount}/${wk.dueCount} aktivitas).` });

  // Month-to-date category comparison vs same period last month
  const tx = confirmed(transactions);
  const ms = startOfMonth(today);
  const dom = Number(today.slice(8, 10));
  const lastMs = addMonths(ms, -1);
  const lastEnd = addDays(lastMs, Math.min(dom, daysInMonth(lastMs)) - 1);
  const thisCats = categoryBreakdown(tx, ms, today);
  const lastCats = categoryBreakdown(tx, lastMs, lastEnd);
  const changes = thisCats
    .map((c) => {
      const prev = lastCats.find((l) => l.name === c.name)?.value ?? 0;
      return { name: c.name, cur: c.value, prev, delta: prev ? ((c.value - prev) / prev) * 100 : null };
    })
    .filter((c) => c.delta !== null && Math.abs(c.delta) >= 10 && c.name !== SAVINGS_CATEGORY && (c.cur >= 50_000 || c.prev >= 50_000))
    .sort((a, b) => Math.abs(b.delta!) - Math.abs(a.delta!));
  for (const c of changes.slice(0, 2)) {
    const up = c.delta! > 0;
    out.push({
      id: `cat-${c.name}`,
      tone: up ? "warn" : "good",
      text: `Pengeluaran ${c.name.toLowerCase()} ${up ? "naik" : "turun"} ${Math.round(Math.abs(c.delta!))}% dibanding periode yang sama bulan lalu (${moneyShort(c.prev)} → ${moneyShort(c.cur)}).`,
    });
  }

  const monthTx = inRange(tx, ms, today);
  const inc = incomeOf(monthTx);
  const sav = sum(monthTx.filter((t) => t.type === "expense" && t.category === SAVINGS_CATEGORY));
  if (inc > 0) {
    const rate = Math.round((sav / inc) * 100);
    out.push({ id: "savings", tone: rate >= 10 ? "good" : "info", text: `Rasio tabungan bulan ini ${rate}% dari pemasukan (${moneyShort(sav)} dari ${moneyShort(inc)}).` });
  }
  if (settings.monthlyBudget > 0) {
    const exp = expenseOf(monthTx);
    const used = Math.round((exp / settings.monthlyBudget) * 100);
    const elapsed = Math.round((dom / daysInMonth(today)) * 100);
    out.push({
      id: "budget",
      tone: used > 100 ? "bad" : used > elapsed + 10 ? "warn" : "good",
      text: `Anggaran bulanan terpakai ${used}% sementara bulan berjalan ${elapsed}%${used > elapsed + 10 ? " — laju pengeluaran lebih cepat dari rencana" : " — masih sesuai rencana"}.`,
    });
  }
  const mp = mostProductiveWeekday(tasks, schedules);
  if (mp.best) out.push({ id: "best-day", tone: "info", text: `Hari paling produktifmu dalam 4 minggu terakhir adalah ${WEEKDAY_NAMES[mp.best.dow]} (${Math.round(mp.best.pct)}% rencana terselesaikan).` });

  return out;
}

export function monthlyComparison(transactions: Transaction[], months = 6, today = todayKey()) {
  const tx = confirmed(transactions);
  const first = addMonths(startOfMonth(today), -(months - 1));
  return Array.from({ length: months }, (_, i) => {
    const m = addMonths(first, i);
    const end = addDays(addMonths(m, 1), -1);
    const r = inRange(tx, m, end);
    const income = incomeOf(r);
    const expense = expenseOf(r);
    const savings = sum(r.filter((t) => t.type === "expense" && t.category === SAVINGS_CATEGORY));
    return { key: m.slice(0, 7), month: m, income, expense, net: income - expense, savings, savingsRate: income ? (savings / income) * 100 : null };
  });
}

export function spendingByWeekday(transactions: Transaction[], from: string, to: string) {
  const tx = inRange(confirmed(transactions), from, to).filter((t) => t.type === "expense");
  const totals = Array(7).fill(0);
  const counts = Array(7).fill(0);
  for (const d of rangeKeys(from, to)) counts[new Date(d + "T00:00:00Z").getUTCDay()]++;
  for (const t of tx) totals[new Date(t.date + "T00:00:00Z").getUTCDay()] += t.amount;
  // Monday-first ordering
  return [1, 2, 3, 4, 5, 6, 0].map((dow) => ({ label: WEEKDAY_NAMES[dow].slice(0, 3), avg: counts[dow] ? totals[dow] / counts[dow] : 0, total: totals[dow] }));
}

export { fmtWeekday };
