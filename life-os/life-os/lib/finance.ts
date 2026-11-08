import type { Settings, Transaction } from "./types";
import { SAVINGS_CATEGORY } from "./constants";
import { addDays, addMonths, diffDays, endOfMonth, fmtDateShort, fmtMonthShort, rangeKeys, startOfMonth, startOfWeek, todayKey } from "./time";

/** Only confirmed records count. Pending records (awaiting confirmation) are excluded → no double counting. */
export const confirmed = (tx: Transaction[]) => tx.filter((t) => t.status === "confirmed");

export const sum = (tx: Transaction[]) => tx.reduce((s, t) => s + (Number(t.amount) || 0), 0);
export const incomeOf = (tx: Transaction[]) => sum(tx.filter((t) => t.type === "income"));
export const expenseOf = (tx: Transaction[]) => sum(tx.filter((t) => t.type === "expense"));
export const inRange = (tx: Transaction[], from: string, to: string) => tx.filter((t) => t.date >= from && t.date <= to);

export interface FinanceSummary {
  totalIncome: number;
  totalExpense: number;
  netCashFlow: number;
  balance: number;
  totalSavings: number;
  monthIncome: number;
  monthExpense: number;
  monthlyBudget: number;
  remainingBudget: number;
  todayIncome: number;
  todayExpense: number;
  dailyBudget: number;
  remainingDaily: number;
  weekExpense: number;
}

export function effectiveDailyBudget(settings: Settings, today = todayKey()) {
  if (settings.dailyBudget > 0) return settings.dailyBudget;
  if (settings.monthlyBudget > 0) return Math.round(settings.monthlyBudget / Number(endOfMonth(today).slice(8, 10)));
  return 0;
}

export function summarize(all: Transaction[], settings: Settings, today = todayKey()): FinanceSummary {
  const tx = confirmed(all);
  const totalIncome = incomeOf(tx);
  const totalExpense = expenseOf(tx);
  const ms = startOfMonth(today);
  const me = endOfMonth(today);
  const month = inRange(tx, ms, me);
  const day = inRange(tx, today, today);
  const ws = startOfWeek(today);
  const week = inRange(tx, ws, addDays(ws, 6));
  const monthExpense = expenseOf(month);
  const daily = effectiveDailyBudget(settings, today);
  const todayExpense = expenseOf(day);
  return {
    totalIncome,
    totalExpense,
    netCashFlow: totalIncome - totalExpense,
    balance: (Number(settings.initialBalance) || 0) + totalIncome - totalExpense,
    totalSavings: sum(tx.filter((t) => t.type === "expense" && t.category === SAVINGS_CATEGORY)),
    monthIncome: incomeOf(month),
    monthExpense,
    monthlyBudget: settings.monthlyBudget,
    remainingBudget: settings.monthlyBudget - monthExpense,
    todayIncome: incomeOf(day),
    todayExpense,
    dailyBudget: daily,
    remainingDaily: daily - todayExpense,
    weekExpense: expenseOf(week),
  };
}

export function sortChrono(tx: Transaction[]) {
  return [...tx].sort(
    (a, b) => a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? "") || a.createdAt.localeCompare(b.createdAt),
  );
}

/** Balance after each confirmed transaction, in chronological order. */
export function runningBalances(all: Transaction[], initial: number) {
  const map = new Map<string, number>();
  let bal = Number(initial) || 0;
  for (const t of sortChrono(confirmed(all))) {
    bal += t.type === "income" ? t.amount : -t.amount;
    map.set(t.id, bal);
  }
  return map;
}

// ── Period buckets for charts ───────────────────────────────────────
export type Granularity = "day" | "week" | "month";
export interface Bucket {
  key: string;
  label: string;
  from: string;
  to: string;
}

export function makeBuckets(from: string, to: string, gran?: Granularity): Bucket[] {
  const span = diffDays(to, from) + 1;
  const g: Granularity = gran ?? (span <= 45 ? "day" : span <= 120 ? "week" : "month");
  const out: Bucket[] = [];
  if (g === "day") {
    for (const d of rangeKeys(from, to)) out.push({ key: d, label: fmtDateShort(d), from: d, to: d });
  } else if (g === "week") {
    let ws = startOfWeek(from);
    while (ws <= to) {
      const we = addDays(ws, 6);
      out.push({ key: ws, label: fmtDateShort(ws < from ? from : ws), from: ws < from ? from : ws, to: we > to ? to : we });
      ws = addDays(ws, 7);
    }
  } else {
    let m = startOfMonth(from);
    while (m <= to) {
      const me = endOfMonth(m);
      out.push({ key: m.slice(0, 7), label: `${fmtMonthShort(m)} ${m.slice(2, 4)}`, from: m < from ? from : m, to: me > to ? to : me });
      m = addMonths(m, 1);
    }
  }
  return out;
}

export function incomeExpenseSeries(all: Transaction[], buckets: Bucket[]) {
  const tx = confirmed(all);
  return buckets.map((b) => {
    const r = inRange(tx, b.from, b.to);
    const income = incomeOf(r);
    const expense = expenseOf(r);
    return { label: b.label, key: b.key, income, expense, net: income - expense };
  });
}

export function categoryBreakdown(all: Transaction[], from: string, to: string, type: "expense" | "income" = "expense") {
  const tx = inRange(confirmed(all), from, to).filter((t) => t.type === type);
  const map = new Map<string, { name: string; value: number; count: number }>();
  for (const t of tx) {
    const cur = map.get(t.category) ?? { name: t.category, value: 0, count: 0 };
    cur.value += t.amount;
    cur.count++;
    map.set(t.category, cur);
  }
  const total = sum(tx);
  return [...map.values()].sort((a, b) => b.value - a.value).map((x) => ({ ...x, pct: total ? (x.value / total) * 100 : 0 }));
}

/** Cumulative savings (category Tabungan) by month for the last N months. */
export function savingsGrowth(all: Transaction[], months = 6, today = todayKey()) {
  const tx = confirmed(all).filter((t) => t.type === "expense" && t.category === SAVINGS_CATEGORY);
  const first = addMonths(startOfMonth(today), -(months - 1));
  let cumulative = sum(tx.filter((t) => t.date < first));
  const out: { label: string; key: string; value: number; added: number }[] = [];
  for (let i = 0; i < months; i++) {
    const m = addMonths(first, i);
    const added = sum(inRange(tx, m, endOfMonth(m)));
    cumulative += added;
    out.push({ label: `${fmtMonthShort(m)} ${m.slice(2, 4)}`, key: m.slice(0, 7), value: cumulative, added });
  }
  return out;
}

export interface BudgetLine {
  id: string;
  scope: "daily" | "weekly" | "monthly" | "category";
  label: string;
  limit: number;
  spent: number;
  pct: number;
  level: "ok" | "warn" | "over";
}

export function budgetStatus(all: Transaction[], settings: Settings, today = todayKey()): BudgetLine[] {
  const tx = confirmed(all).filter((t) => t.type === "expense");
  const ws = startOfWeek(today);
  const ms = startOfMonth(today);
  const me = endOfMonth(today);
  const lines: BudgetLine[] = [];
  const add = (id: string, scope: BudgetLine["scope"], label: string, limit: number, spent: number) => {
    if (!limit || limit <= 0) return;
    const p = (spent / limit) * 100;
    lines.push({ id, scope, label, limit, spent, pct: p, level: p >= 100 ? "over" : p >= 80 ? "warn" : "ok" });
  };
  add("daily", "daily", "Harian", effectiveDailyBudget(settings, today), sum(inRange(tx, today, today)));
  add("weekly", "weekly", "Mingguan", settings.weeklyBudget, sum(inRange(tx, ws, addDays(ws, 6))));
  add("monthly", "monthly", "Bulanan", settings.monthlyBudget, sum(inRange(tx, ms, me)));
  for (const [cat, limit] of Object.entries(settings.categoryBudgets || {})) {
    add(`cat:${cat}`, "category", cat, limit, sum(inRange(tx, ms, me).filter((t) => t.category === cat)));
  }
  return lines;
}

/** Possible duplicates: same type & amount on same date with similar merchant/time. */
export function findDuplicate(all: Transaction[], t: Pick<Transaction, "type" | "amount" | "date" | "time" | "merchant" | "id">) {
  const norm = (s?: string) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const mins = (hm?: string) => (hm ? Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3, 5)) : null);
  return all.find((o) => {
    if (o.id === t.id || o.type !== t.type || o.date !== t.date || Math.abs(o.amount - t.amount) > 0.5) return false;
    const m1 = norm(o.merchant);
    const m2 = norm(t.merchant);
    const merchantClose = !m1 || !m2 || m1.includes(m2) || m2.includes(m1);
    const a = mins(o.time);
    const b = mins(t.time);
    const timeClose = a === null || b === null || Math.abs(a - b) <= 10;
    return merchantClose && timeClose;
  });
}

export function monthKeyRange(months: number, today = todayKey()) {
  const first = addMonths(startOfMonth(today), -(months - 1));
  return { from: first, to: endOfMonth(today) };
}

/** Budget lines that crossed the 80% (warn) or 100% (over) threshold between two states. */
export function budgetCrossings(before: Transaction[], after: Transaction[], settings: Settings, today = todayKey()) {
  const b = new Map(budgetStatus(before, settings, today).map((l) => [l.id, l]));
  return budgetStatus(after, settings, today).filter((l) => {
    const prev = b.get(l.id);
    const rank = (x?: BudgetLine) => (!x ? 0 : x.level === "over" ? 2 : x.level === "warn" ? 1 : 0);
    return rank(l) > rank(prev);
  });
}
