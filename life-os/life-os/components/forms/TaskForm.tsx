"use client";

import * as React from "react";
import type { Priority, Subtask, Task, TaskStatus } from "@/lib/types";
import { PRIORITIES, TASK_CATEGORIES } from "@/lib/constants";
import { addDays, nowLocal, todayKey } from "@/lib/time";
import { uid } from "@/lib/format";
import { Button, Field, Modal, Select } from "../ui";
import { Icon } from "../icons";
import { useData } from "../providers/DataProvider";
import { useToast } from "../providers/Toast";
import { useUI } from "../providers/UIProvider";

export function TaskForm({ task, preset, onClose }: { task?: Task; preset?: Partial<Task>; onClose: () => void }) {
  const { actions } = useData();
  const { toast } = useToast();
  const { openModal } = useUI();
  const base = task ?? preset ?? {};
  const [f, setF] = React.useState({
    title: base.title ?? "",
    description: base.description ?? "",
    category: base.category ?? "Akademik",
    priority: (base.priority ?? "medium") as Priority,
    startDate: base.startDate ?? todayKey(),
    deadlineDate: base.deadline?.slice(0, 10) ?? addDays(todayKey(), 1),
    deadlineTime: base.deadline?.slice(11, 16) ?? "23:59",
    hours: String(Math.floor((base.estimatedMinutes ?? 60) / 60)),
    minutes: String((base.estimatedMinutes ?? 60) % 60),
    status: (base.status ?? "todo") as TaskStatus,
    notes: base.notes ?? "",
    progress: base.progress ?? 0,
  });
  const [subtasks, setSubtasks] = React.useState<Subtask[]>(base.subtasks ?? []);
  const [newSub, setNewSub] = React.useState("");
  const [error, setError] = React.useState<string>();
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));

  const addSub = () => {
    if (!newSub.trim()) return;
    setSubtasks((s) => [...s, { id: uid("sub-"), title: newSub.trim(), done: false }]);
    setNewSub("");
  };

  const save = async (planAfter = false) => {
    if (!f.title.trim()) return setError("Judul tugas wajib diisi.");
    const est = (Number(f.hours) || 0) * 60 + (Number(f.minutes) || 0);
    if (est <= 0) return setError("Estimasi durasi harus lebih dari 0.");
    const deadline = `${f.deadlineDate}T${f.deadlineTime || "23:59"}`;
    if (f.startDate > f.deadlineDate) return setError("Tanggal mulai tidak boleh setelah deadline.");
    setError(undefined);
    const wasCompleted = task?.status === "completed";
    const item: Task = {
      ...(task ?? {}),
      id: task?.id ?? uid("task-"),
      title: f.title.trim(),
      description: f.description.trim() || undefined,
      category: f.category,
      priority: f.priority,
      startDate: f.startDate,
      deadline,
      estimatedMinutes: est,
      status: f.status,
      completedAt: f.status === "completed" ? (wasCompleted ? task?.completedAt : nowLocal()) : undefined,
      notes: f.notes.trim() || undefined,
      subtasks,
      progress: subtasks.length ? 0 : Number(f.progress) || 0,
      isDemo: task?.isDemo,
      createdAt: task?.createdAt ?? nowLocal(),
    };
    await actions.upsert("tasks", item);
    toast("success", task ? "Tugas diperbarui" : "Tugas ditambahkan", item.title);
    if (planAfter) openModal({ kind: "smart", taskId: item.id });
    else onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={task ? "Edit Tugas" : "Tambah Tugas"}
      subtitle="Lengkapi deadline & estimasi agar Smart Planner bisa menyarankan waktu kerja"
      icon="ListTodo"
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Batal
          </Button>
          {f.status !== "completed" && (
            <Button icon="WandSparkles" onClick={() => save(true)}>
              Simpan & jadwalkan cerdas
            </Button>
          )}
          <Button variant="primary" icon="Check" onClick={() => save(false)}>
            Simpan tugas
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Judul tugas *" className="sm:col-span-2">
          <input className="input" value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="cth. Laporan Praktikum Telekomunikasi" autoFocus />
        </Field>
        <Field label="Deskripsi detail" className="sm:col-span-2">
          <textarea className="input" rows={3} value={f.description} onChange={(e) => set("description", e.target.value)} placeholder="Apa yang harus dikerjakan?" />
        </Field>
        <Field label="Kategori">
          <Select value={f.category} onChange={(e) => set("category", e.target.value)} options={TASK_CATEGORIES} />
        </Field>
        <Field label="Prioritas">
          <Select value={f.priority} onChange={(e) => set("priority", e.target.value as Priority)} options={PRIORITIES.map((p) => ({ value: p.value, label: p.label }))} />
        </Field>
        <Field label="Tanggal mulai">
          <input type="date" className="input" value={f.startDate} onChange={(e) => set("startDate", e.target.value)} />
        </Field>
        <div className="grid grid-cols-[1fr_auto] gap-3">
          <Field label="Deadline">
            <input type="date" className="input" value={f.deadlineDate} onChange={(e) => set("deadlineDate", e.target.value)} />
          </Field>
          <Field label="Jam">
            <input type="time" className="input w-28" value={f.deadlineTime} onChange={(e) => set("deadlineTime", e.target.value)} />
          </Field>
        </div>
        <Field label="Estimasi durasi">
          <div className="flex items-center gap-2">
            <input type="number" min={0} className="input" value={f.hours} onChange={(e) => set("hours", e.target.value)} aria-label="jam" />
            <span className="text-xs text-muted">jam</span>
            <input type="number" min={0} max={59} step={5} className="input" value={f.minutes} onChange={(e) => set("minutes", e.target.value)} aria-label="menit" />
            <span className="text-xs text-muted">mnt</span>
          </div>
        </Field>
        <Field label="Status">
          <Select
            value={f.status}
            onChange={(e) => set("status", e.target.value as TaskStatus)}
            options={[
              { value: "todo", label: "To Do" },
              { value: "in_progress", label: "In Progress" },
              { value: "completed", label: "Completed" },
            ]}
          />
        </Field>
        {!subtasks.length && (
          <Field label={`Progres manual: ${f.progress}%`} className="sm:col-span-2" hint="Jika ada subtugas, progres dihitung otomatis.">
            <input type="range" min={0} max={100} step={5} value={f.progress} onChange={(e) => set("progress", Number(e.target.value))} className="w-full accent-[var(--color-primary)]" />
          </Field>
        )}
        <div className="sm:col-span-2">
          <span className="label">Subtugas</span>
          <div className="space-y-1.5">
            {subtasks.map((s) => (
              <div key={s.id} className="surface flex items-center gap-2.5 px-3 py-2">
                <button className="check" data-checked={s.done} onClick={() => setSubtasks((xs) => xs.map((x) => (x.id === s.id ? { ...x, done: !x.done } : x)))} aria-label="Tandai subtugas">
                  <Icon name="Check" size={12} strokeWidth={3} />
                </button>
                <input className="min-w-0 flex-1 bg-transparent text-sm outline-none" value={s.title} onChange={(e) => setSubtasks((xs) => xs.map((x) => (x.id === s.id ? { ...x, title: e.target.value } : x)))} />
                <button className="text-muted hover:text-danger" onClick={() => setSubtasks((xs) => xs.filter((x) => x.id !== s.id))} aria-label="Hapus subtugas">
                  <Icon name="Trash2" size={14} />
                </button>
              </div>
            ))}
            <div className="flex gap-2">
              <input className="input" value={newSub} onChange={(e) => setNewSub(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addSub())} placeholder="Tambah subtugas lalu tekan Enter" />
              <Button icon="Plus" onClick={addSub}>
                Tambah
              </Button>
            </div>
          </div>
        </div>
        <Field label="Catatan (opsional)" className="sm:col-span-2">
          <textarea className="input" rows={2} value={f.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Link referensi, dosen pengampu, dll." />
        </Field>
        {error && <p className="text-sm text-danger sm:col-span-2">{error}</p>}
      </div>
    </Modal>
  );
}
