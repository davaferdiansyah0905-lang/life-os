"use client";

import * as React from "react";
import type { Schedule, Settings } from "@/lib/types";
import { WORK_WINDOWS } from "@/lib/constants";
import { findConflicts, planTask } from "@/lib/schedule";
import { durationLabel, fmtDateLong, fmtDateTime, fmtTime, nowLocal, relativeDeadline } from "@/lib/time";
import { uid } from "@/lib/format";
import { Button, Modal, Segmented } from "../ui";
import { Icon } from "../icons";
import { useData } from "../providers/DataProvider";
import { useToast } from "../providers/Toast";

const CAT_MAP: Record<string, string> = { Akademik: "Akademik", Organisasi: "Organisasi", Kerja: "Kerja", Karier: "Kerja", Pribadi: "Pribadi", Keuangan: "Pribadi" };

export function SmartPlanner({ taskId, onClose }: { taskId: string; onClose: () => void }) {
  const { tasks, schedules, settings, actions } = useData();
  const { toast } = useToast();
  const task = tasks.find((t) => t.id === taskId);
  const [preferred, setPreferred] = React.useState<Settings["preferredWorkTime"]>(settings.preferredWorkTime);
  const [sessionMax, setSessionMax] = React.useState("120");
  const [selected, setSelected] = React.useState<Set<string>>(new Set());

  const plan = React.useMemo(() => (task ? planTask(schedules, task, { preferred, sessionMax: Number(sessionMax) }) : null), [task, schedules, preferred, sessionMax]);
  React.useEffect(() => setSelected(new Set(plan?.sessions.map((s) => s.id) ?? [])), [plan]);

  if (!task || !plan) return null;

  const approve = async () => {
    const chosen = plan.sessions.filter((s) => selected.has(s.id));
    if (!chosen.length) return toast("info", "Pilih minimal satu sesi");
    const created: Schedule[] = [];
    const working = [...schedules];
    for (const [i, s] of chosen.entries()) {
      const item: Schedule = {
        id: uid("sch-"),
        title: `Kerjakan: ${task.title}${chosen.length > 1 ? ` (${i + 1}/${chosen.length})` : ""}`,
        description: `Sesi kerja dari Smart Planner. Deadline ${fmtDateTime(task.deadline)}.`,
        date: s.date,
        start: s.start,
        end: s.end,
        category: CAT_MAP[task.category] ?? "Lainnya",
        priority: task.priority,
        recurrence: "none",
        taskId: task.id,
        completedDates: [],
        createdAt: nowLocal(),
      };
      // final safety check — never overwrite or silently overlap existing schedules
      if (findConflicts(working, item).length) {
        toast("warning", "Sesi dilewati karena bentrok", `${fmtDateLong(s.date)} ${s.start}–${s.end}`);
        continue;
      }
      working.push(item);
      created.push(item);
    }
    await actions.upsertMany("schedules", created);
    toast("success", `${created.length} sesi ditambahkan ke kalender`, task.title);
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      icon="WandSparkles"
      title="Smart Deadline Planner"
      subtitle={`${task.title} · deadline ${fmtDateTime(task.deadline)} (${relativeDeadline(task.deadline)})`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Nanti saja
          </Button>
          <Button variant="primary" icon="CalendarPlus" disabled={!selected.size} onClick={approve}>
            Setujui & tambahkan {selected.size ? `${selected.size} sesi` : ""}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <ol className="grid gap-2 text-xs text-muted sm:grid-cols-4">
          {["Cek jadwal yang ada", "Cari slot kosong", "Pilih waktu terbaik", "Cek bentrok & minta persetujuan"].map((s, i) => (
            <li key={s} className="surface flex items-center gap-2 px-3 py-2">
              <span className="grid size-5 shrink-0 place-items-center rounded-full bg-primary/20 text-[10px] font-bold text-highlight">{i + 1}</span>
              {s}
            </li>
          ))}
        </ol>
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <p className="label">Waktu kerja favorit</p>
            <Segmented
              size="sm"
              value={preferred}
              onChange={setPreferred}
              options={(Object.keys(WORK_WINDOWS) as Settings["preferredWorkTime"][]).map((k) => ({ value: k, label: k[0].toUpperCase() + k.slice(1) }))}
            />
          </div>
          <div>
            <p className="label">Maks. per sesi</p>
            <Segmented size="sm" value={sessionMax} onChange={setSessionMax} options={["60", "90", "120", "180"].map((v) => ({ value: v, label: `${Number(v) / 60}j` }))} />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="surface p-3">
            <p className="text-[11px] text-muted">Estimasi</p>
            <p className="tabular font-semibold">{durationLabel(plan.requiredMin)}</p>
          </div>
          <div className="surface p-3">
            <p className="text-[11px] text-muted">Sudah terjadwal</p>
            <p className="tabular font-semibold">{durationLabel(plan.alreadyScheduledMin)}</p>
          </div>
          <div className="surface p-3">
            <p className="text-[11px] text-muted">Diusulkan</p>
            <p className="tabular font-semibold text-highlight">{durationLabel(plan.plannedMin)}</p>
          </div>
        </div>
        <div className={`flex items-start gap-2 rounded-xl border px-3 py-2.5 text-sm ${plan.feasible ? "border-success/30 bg-success/10" : "border-warning/40 bg-warning/10"}`}>
          <Icon name={plan.feasible ? "CircleCheck" : "TriangleAlert"} size={16} className={`mt-0.5 shrink-0 ${plan.feasible ? "text-success" : "text-warning"}`} />
          <span>{plan.message}</span>
        </div>
        {plan.sessions.length > 0 && (
          <div className="space-y-2">
            {plan.sessions.map((s) => {
              const on = selected.has(s.id);
              return (
                <button
                  key={s.id}
                  onClick={() => setSelected((x) => {
                    const n = new Set(x);
                    if (n.has(s.id)) n.delete(s.id);
                    else n.add(s.id);
                    return n;
                  })}
                  className={`surface flex w-full items-center gap-3 p-3 text-left transition ${on ? "border-primary/60 bg-primary/10" : "opacity-70"}`}
                >
                  <span className="check" data-checked={on}>
                    <Icon name="Check" size={12} strokeWidth={3} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{fmtDateLong(s.date)}</p>
                    <p className="tabular text-xs text-muted">
                      {fmtTime(s.start)}–{fmtTime(s.end)} · {durationLabel(s.minutes)}
                    </p>
                  </div>
                  {s.outsidePreference ? (
                    <span className="badge border-warning/40 bg-warning/10 text-warning">di luar waktu favorit</span>
                  ) : (
                    <span className="badge border-success/30 bg-success/10 text-success">bebas bentrok</span>
                  )}
                </button>
              );
            })}
          </div>
        )}
        <p className="text-xs text-subtle">Planner tidak pernah menimpa jadwal yang sudah ada. Sesi hanya ditambahkan setelah kamu menyetujuinya.</p>
      </div>
    </Modal>
  );
}
