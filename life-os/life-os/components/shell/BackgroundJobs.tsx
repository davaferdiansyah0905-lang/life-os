"use client";

import * as React from "react";
import { useData } from "../providers/DataProvider";
import { useAgentSync } from "./agent";
import { occurrencesOn } from "@/lib/schedule";
import { fmtTime, minutesBetween, nowLocal, todayKey, toMin } from "@/lib/time";

const KEY = "lifeos-notified";

/** Reminder engine (schedules, deadlines, overdue tasks) + periodic Android inbox sync. */
export function BackgroundJobs() {
  const data = useData();
  const ref = React.useRef(data);
  ref.current = data;
  const { sync } = useAgentSync();

  const notified = React.useRef<Record<string, number>>({});
  React.useEffect(() => {
    try {
      notified.current = JSON.parse(localStorage.getItem(KEY) || "{}");
    } catch {
      notified.current = {};
    }
  }, []);

  const once = (key: string, fn: () => void) => {
    if (notified.current[key]) return;
    notified.current[key] = Date.now();
    fn();
    // prune entries older than 3 days
    const cutoff = Date.now() - 3 * 86400000;
    for (const [k, v] of Object.entries(notified.current)) if (v < cutoff) delete notified.current[k];
    try {
      localStorage.setItem(KEY, JSON.stringify(notified.current));
    } catch {}
  };

  React.useEffect(() => {
    const tick = () => {
      const d = ref.current;
      const s = d.settings;
      if (!s.notificationsEnabled) return;
      const now = nowLocal();
      const today = todayKey();
      const nowMin = toMin(now.slice(11));
      const lead = Math.max(1, s.reminderMinutes || 15);

      for (const o of occurrencesOn(d.schedules, today)) {
        if (o.completed) continue;
        const diff = o.startMin - nowMin;
        if (diff > 0 && diff <= lead)
          once(`sch:${o.key}`, () =>
            d.actions.notify({ type: "schedule", title: `Segera dimulai: ${o.schedule.title}`, body: `${fmtTime(o.schedule.start)}–${fmtTime(o.schedule.end)} · ${diff} menit lagi${o.schedule.location ? ` · ${o.schedule.location}` : ""}`, href: "/schedule" }, { toast: true }),
          );
      }
      for (const t of d.tasks) {
        if (t.status === "completed") continue;
        const mins = minutesBetween(now, t.deadline);
        if (mins <= 0) once(`od:${t.id}:${t.deadline}`, () => d.actions.notify({ type: "overdue", title: `Tugas terlambat: ${t.title}`, body: "Deadline sudah lewat. Selesaikan atau perbarui deadline.", href: "/tasks" }));
        else if (mins <= lead) once(`dl2:${t.id}:${t.deadline}`, () => d.actions.notify({ type: "deadline", title: `Deadline ${mins} menit lagi`, body: t.title, href: "/tasks" }, { toast: true }));
        else if (mins <= 24 * 60) once(`dl:${t.id}:${t.deadline}`, () => d.actions.notify({ type: "deadline", title: "Deadline kurang dari 24 jam", body: `${t.title} · ${t.deadline.slice(11)}`, href: "/tasks" }));
      }
    };
    const first = setTimeout(tick, 2500);
    const id = setInterval(tick, 30_000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Android companion inbox: poll every 60 s while the app is open (only when a token is set).
  React.useEffect(() => {
    const run = () => {
      const s = ref.current.settings;
      if (s.ingestToken && s.aiAgentEnabled && document.visibilityState === "visible") sync({ silent: false });
    };
    const first = setTimeout(run, 4000);
    const id = setInterval(run, 60_000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [sync]);

  return null;
}
