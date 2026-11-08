"use client";

import * as React from "react";
import type { Goal, Schedule, Task } from "@/lib/types";
import { useData } from "./providers/DataProvider";
import { useToast } from "./providers/Toast";
import { useUI } from "./providers/UIProvider";
import { fmtDateLong, nowLocal, todayKey } from "@/lib/time";

export function useNow(intervalMs = 30_000) {
  const [now, setNow] = React.useState(() => new Date());
  React.useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function goalProgress(g: Goal) {
  if (g.status === "completed") return 100;
  if (g.progressMode === "auto" && g.milestones.length) return Math.round((g.milestones.filter((m) => m.done).length / g.milestones.length) * 100);
  return Math.max(0, Math.min(100, g.progress || 0));
}

export function useKit() {
  const { actions } = useData();
  const { toast, confirm } = useToast();
  const { openModal } = useUI();

  return React.useMemo(
    () => ({
      async toggleOccurrence(s: Schedule, date: string) {
        const done = s.completedDates?.includes(date);
        const completedDates = done ? (s.completedDates ?? []).filter((d) => d !== date) : [...(s.completedDates ?? []), date];
        await actions.upsert("schedules", { ...s, completedDates });
        if (!done) toast("success", "Aktivitas selesai", s.title);
      },
      async toggleTask(t: Task) {
        const completing = t.status !== "completed";
        await actions.upsert("tasks", {
          ...t,
          status: completing ? "completed" : t.subtasks.length || t.progress ? "in_progress" : "todo",
          completedAt: completing ? nowLocal() : undefined,
        });
        if (completing) toast("success", "Tugas selesai 🎉", t.title);
      },
      async deleteTask(t: Task) {
        if (!(await confirm({ title: "Hapus tugas?", message: `"${t.title}" akan dihapus permanen.`, danger: true, confirmText: "Hapus" }))) return false;
        await actions.remove("tasks", t.id);
        toast("success", "Tugas dihapus");
        return true;
      },
      async deleteSeries(s: Schedule) {
        if (!(await confirm({ title: s.recurrence === "none" ? "Hapus jadwal?" : "Hapus seluruh seri jadwal?", message: `"${s.title}" ${s.recurrence === "none" ? "" : "(semua pengulangan) "}akan dihapus permanen.`, danger: true, confirmText: "Hapus" }))) return false;
        await actions.remove("schedules", s.id);
        toast("success", "Jadwal dihapus");
        return true;
      },
      async deleteOccurrence(s: Schedule, date: string) {
        if (!(await confirm({ title: "Hapus kejadian ini saja?", message: `"${s.title}" pada ${fmtDateLong(date)} akan dilewati. Jadwal di hari lain tetap ada.`, danger: true, confirmText: "Hapus kejadian ini" }))) return false;
        await actions.upsert("schedules", { ...s, excludedDates: [...(s.excludedDates ?? []), date] });
        toast("success", "Kejadian dihapus");
        return true;
      },
      duplicateSchedule(s: Schedule, date?: string) {
        const { id: _id, completedDates: _c, excludedDates: _e, createdAt: _cr, isDemo: _d, ...rest } = s;
        void _id;
        void _c;
        void _e;
        void _cr;
        void _d;
        openModal({ kind: "schedule", preset: { ...rest, date: date ?? s.date, title: `${s.title} (salinan)` } });
      },
      async toggleMilestone(g: Goal, msId: string) {
        const ms = g.milestones.find((m) => m.id === msId);
        if (!ms) return;
        const done = !ms.done;
        const milestones = g.milestones.map((m) => (m.id === msId ? { ...m, done, doneAt: done ? todayKey() : undefined } : m));
        const history = [...g.history, { at: nowLocal(), text: `${done ? "Milestone selesai" : "Milestone dibuka kembali"}: ${ms.title}` }];
        const allDone = milestones.length > 0 && milestones.every((m) => m.done);
        const next: Goal = { ...g, milestones, history, status: allDone && g.progressMode === "auto" ? "completed" : g.status === "completed" && !allDone ? "active" : g.status };
        if (allDone && g.status !== "completed") next.history.push({ at: nowLocal(), text: "🎉 Goal tercapai!" });
        await actions.upsert("goals", next);
        if (done) {
          actions.notify(
            allDone ? { type: "goal", title: "Goal tercapai! 🎉", body: g.title, href: "/goals" } : { type: "goal", title: "Milestone tercapai", body: `${ms.title} — ${g.title}`, href: "/goals" },
            { toast: true, browser: true },
          );
        }
      },
    }),
    [actions, toast, confirm, openModal],
  );
}
