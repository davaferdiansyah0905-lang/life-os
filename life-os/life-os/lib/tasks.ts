import type { Task } from "./types";
import { PRIORITY_META } from "./constants";
import { addDays, minutesBetween, nowLocal, startOfWeek, todayKey } from "./time";

export type DisplayStatus = "todo" | "in_progress" | "completed" | "overdue";

export function isOverdue(t: Task, now = nowLocal()) {
  return t.status !== "completed" && !!t.deadline && t.deadline < now;
}

export function displayStatus(t: Task, now = nowLocal()): DisplayStatus {
  if (t.status === "completed") return "completed";
  if (isOverdue(t, now)) return "overdue";
  return t.status;
}

export function taskProgress(t: Task) {
  if (t.status === "completed") return 100;
  if (t.subtasks?.length) return Math.round((t.subtasks.filter((s) => s.done).length / t.subtasks.length) * 100);
  return Math.max(0, Math.min(100, t.progress || 0));
}

/** Deadline urgency colour band: normal (blue), approaching (yellow), urgent/overdue (red). */
export function deadlineLevel(t: Task, now = nowLocal()): "normal" | "approaching" | "urgent" | "done" {
  if (t.status === "completed") return "done";
  const mins = minutesBetween(now, t.deadline);
  if (mins < 0 || mins <= 24 * 60) return "urgent";
  if (mins <= 72 * 60) return "approaching";
  return "normal";
}

export const LEVEL_COLOR = {
  normal: "#3B82F6",
  approaching: "#F59E0B",
  urgent: "#EF4444",
  done: "#22C55E",
} as const;

/** Tasks that belong to "today": due today, or completed today. */
export function todaysTasks(tasks: Task[], today = todayKey()) {
  return tasks.filter((t) => t.deadline.slice(0, 10) === today || (t.completedAt && t.completedAt.slice(0, 10) === today));
}

export function upcomingTasks(tasks: Task[], days = 7, today = todayKey()) {
  const end = addDays(today, days);
  return tasks
    .filter((t) => t.status !== "completed" && t.deadline.slice(0, 10) > today && t.deadline.slice(0, 10) <= end)
    .sort((a, b) => a.deadline.localeCompare(b.deadline));
}

export function urgencyScore(t: Task, now = nowLocal()) {
  const hours = minutesBetween(now, t.deadline) / 60;
  const w = PRIORITY_META[t.priority]?.weight ?? 2;
  const timeFactor = hours <= 0 ? 10 : 10 / Math.max(1, hours / 12);
  const remainingWork = (100 - taskProgress(t)) / 100;
  return timeFactor * 2 + w * 1.5 + remainingWork * 2;
}

export function weeklyCompletion(tasks: Task[], today = todayKey()) {
  const ws = startOfWeek(today);
  const we = addDays(ws, 6);
  const inWeek = tasks.filter((t) => {
    const d = t.deadline.slice(0, 10);
    return d >= ws && d <= we;
  });
  const done = inWeek.filter((t) => t.status === "completed").length;
  return { total: inWeek.length, done, pct: inWeek.length ? Math.round((done / inWeek.length) * 100) : 0 };
}
