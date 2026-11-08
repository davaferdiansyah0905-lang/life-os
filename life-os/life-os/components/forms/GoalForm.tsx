"use client";

import * as React from "react";
import type { Goal, Milestone, Priority } from "@/lib/types";
import { GOAL_CATEGORIES, PRIORITIES } from "@/lib/constants";
import { addMonths, nowLocal, todayKey } from "@/lib/time";
import { uid } from "@/lib/format";
import { Button, Field, Modal, Select } from "../ui";
import { Icon } from "../icons";
import { useData } from "../providers/DataProvider";
import { useToast } from "../providers/Toast";

export function GoalForm({ goal, onClose }: { goal?: Goal; onClose: () => void }) {
  const { actions } = useData();
  const { toast } = useToast();
  const [f, setF] = React.useState({
    title: goal?.title ?? "",
    description: goal?.description ?? "",
    category: goal?.category ?? "Karier",
    targetDate: goal?.targetDate ?? addMonths(todayKey(), 12),
    startDate: goal?.startDate ?? todayKey(),
    priority: (goal?.priority ?? "high") as Priority,
    progressMode: goal?.progressMode ?? "auto",
    progress: goal?.progress ?? 0,
    notes: goal?.notes ?? "",
    status: goal?.status ?? "active",
  });
  const [milestones, setMilestones] = React.useState<Milestone[]>(goal?.milestones ?? []);
  const [newMs, setNewMs] = React.useState("");
  const [error, setError] = React.useState<string>();
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));

  const addMs = () => {
    if (!newMs.trim()) return;
    setMilestones((m) => [...m, { id: uid("ms-"), title: newMs.trim(), done: false }]);
    setNewMs("");
  };
  const move = (i: number, d: number) =>
    setMilestones((m) => {
      const n = [...m];
      const j = i + d;
      if (j < 0 || j >= n.length) return m;
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });

  const save = async () => {
    if (!f.title.trim()) return setError("Judul goal wajib diisi.");
    if (f.targetDate < f.startDate) return setError("Target tanggal harus setelah tanggal mulai.");
    setError(undefined);
    const history = [...(goal?.history ?? [])];
    if (!goal) history.push({ at: nowLocal(), text: "Goal dibuat" });
    else if (goal.status !== f.status) history.push({ at: nowLocal(), text: `Status diubah menjadi ${f.status === "completed" ? "Tercapai" : f.status === "paused" ? "Ditunda" : "Aktif"}` });
    const item: Goal = {
      ...(goal ?? {}),
      id: goal?.id ?? uid("goal-"),
      title: f.title.trim(),
      description: f.description.trim() || undefined,
      category: f.category,
      targetDate: f.targetDate,
      startDate: f.startDate,
      priority: f.priority,
      progressMode: milestones.length ? f.progressMode : "manual",
      progress: Number(f.progress) || 0,
      milestones,
      notes: f.notes.trim() || undefined,
      status: f.status as Goal["status"],
      history,
      isDemo: goal?.isDemo,
      createdAt: goal?.createdAt ?? nowLocal(),
    };
    await actions.upsert("goals", item);
    toast("success", goal ? "Goal diperbarui" : "Goal baru dibuat", item.title);
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      icon="Target"
      title={goal ? "Edit Goal" : "Goal & Impian Baru"}
      subtitle="Pecah impian besar menjadi milestone yang terukur"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Batal
          </Button>
          <Button variant="primary" icon="Check" onClick={save}>
            Simpan goal
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Judul goal *" className="sm:col-span-2">
          <input className="input" value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="cth. Menjadi Network Engineer Profesional" autoFocus />
        </Field>
        <Field label="Deskripsi" className="sm:col-span-2">
          <textarea className="input" rows={2} value={f.description} onChange={(e) => set("description", e.target.value)} placeholder="Mengapa goal ini penting bagimu?" />
        </Field>
        <Field label="Kategori">
          <Select value={f.category} onChange={(e) => set("category", e.target.value)} options={GOAL_CATEGORIES} />
        </Field>
        <Field label="Prioritas">
          <Select value={f.priority} onChange={(e) => set("priority", e.target.value as Priority)} options={PRIORITIES.map((p) => ({ value: p.value, label: p.label }))} />
        </Field>
        <Field label="Tanggal mulai">
          <input type="date" className="input" value={f.startDate} onChange={(e) => set("startDate", e.target.value)} />
        </Field>
        <Field label="Target tanggal">
          <input type="date" className="input" value={f.targetDate} onChange={(e) => set("targetDate", e.target.value)} />
        </Field>
        <Field label="Status">
          <Select
            value={f.status}
            onChange={(e) => set("status", e.target.value as Goal["status"])}
            options={[
              { value: "active", label: "Aktif" },
              { value: "paused", label: "Ditunda" },
              { value: "completed", label: "Tercapai" },
            ]}
          />
        </Field>
        <Field label="Perhitungan progres">
          <Select
            value={milestones.length ? f.progressMode : "manual"}
            disabled={!milestones.length}
            onChange={(e) => set("progressMode", e.target.value as Goal["progressMode"])}
            options={[
              { value: "auto", label: "Otomatis dari milestone" },
              { value: "manual", label: "Manual" },
            ]}
          />
        </Field>
        {(f.progressMode === "manual" || !milestones.length) && (
          <Field label={`Progres: ${f.progress}%`} className="sm:col-span-2">
            <input type="range" min={0} max={100} step={5} value={f.progress} onChange={(e) => set("progress", Number(e.target.value))} className="w-full accent-[var(--color-primary)]" />
          </Field>
        )}
        <div className="sm:col-span-2">
          <span className="label">Milestones ({milestones.filter((m) => m.done).length}/{milestones.length} selesai)</span>
          <div className="space-y-1.5">
            {milestones.map((m, i) => (
              <div key={m.id} className="surface flex items-center gap-2 px-3 py-2">
                <span className="w-5 text-center text-xs font-semibold text-subtle">{i + 1}</span>
                <button
                  className="check"
                  data-checked={m.done}
                  onClick={() => setMilestones((xs) => xs.map((x) => (x.id === m.id ? { ...x, done: !x.done, doneAt: !x.done ? todayKey() : undefined } : x)))}
                  aria-label="Tandai milestone"
                >
                  <Icon name="Check" size={12} strokeWidth={3} />
                </button>
                <input className="min-w-0 flex-1 bg-transparent text-sm outline-none" value={m.title} onChange={(e) => setMilestones((xs) => xs.map((x) => (x.id === m.id ? { ...x, title: e.target.value } : x)))} />
                <button className="text-muted hover:text-fg" onClick={() => move(i, -1)} aria-label="Naik">
                  <Icon name="ChevronUp" size={15} />
                </button>
                <button className="text-muted hover:text-fg" onClick={() => move(i, 1)} aria-label="Turun">
                  <Icon name="ChevronDown" size={15} />
                </button>
                <button className="text-muted hover:text-danger" onClick={() => setMilestones((xs) => xs.filter((x) => x.id !== m.id))} aria-label="Hapus milestone">
                  <Icon name="Trash2" size={14} />
                </button>
              </div>
            ))}
            <div className="flex gap-2">
              <input className="input" value={newMs} onChange={(e) => setNewMs(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addMs())} placeholder="cth. Lulus sertifikasi CCNA" />
              <Button icon="Plus" onClick={addMs}>
                Tambah
              </Button>
            </div>
          </div>
        </div>
        <Field label="Catatan" className="sm:col-span-2">
          <textarea className="input" rows={2} value={f.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Strategi, sumber belajar, mentor..." />
        </Field>
        {error && <p className="text-sm text-danger sm:col-span-2">{error}</p>}
      </div>
    </Modal>
  );
}
