"use client";

import * as React from "react";
import type { Task, TaskStatus } from "@/lib/types";
import { Icon } from "../icons";
import { Button, Card, DemoBadge, EmptyState, Menu, Modal, Pill, ProgressBar, Ring, SectionTitle, Segmented, Select } from "../ui";
import { useData } from "../providers/DataProvider";
import { useUI } from "../providers/UIProvider";
import { useToast } from "../providers/Toast";
import { useKit, useNow } from "../hooks";
import { PRIORITIES, PRIORITY_META, TASK_CATEGORIES, TASK_STATUS_META } from "@/lib/constants";
import { deadlineLevel, displayStatus, isOverdue, LEVEL_COLOR, taskProgress, todaysTasks, upcomingTasks, weeklyCompletion, type DisplayStatus } from "@/lib/tasks";
import { addDays, durationLabel, fmtDateTime, fmtTime, nowLocal, relativeDeadline, startOfWeek, todayKey } from "@/lib/time";
import { cn, uid } from "@/lib/format";

type DeadlineFilter = "all" | "today" | "week" | "overdue" | "upcoming";
type SortKey = "deadline" | "newest" | "oldest" | "priority";

function TaskDetail({ taskId, onClose }: { taskId: string; onClose: () => void }) {
  const { tasks, schedules, actions } = useData();
  const { openModal } = useUI();
  const { toast } = useToast();
  const kit = useKit();
  const t = tasks.find((x) => x.id === taskId);
  const [newSub, setNewSub] = React.useState("");
  const [notes, setNotes] = React.useState(t?.notes ?? "");
  React.useEffect(() => setNotes(t?.notes ?? ""), [t?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!t) return null;
  const st = displayStatus(t);
  const p = taskProgress(t);
  const sessions = schedules.filter((s) => s.taskId === t.id).sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
  const update = (patch: Partial<Task>) => actions.upsert("tasks", { ...t, ...patch });
  const setStatus = (s: TaskStatus) => update({ status: s, completedAt: s === "completed" ? nowLocal() : undefined });
  const lvl = deadlineLevel(t);

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      icon="ListTodo"
      title={
        <span className="flex items-center gap-2">
          {t.title} <DemoBadge show={t.isDemo} />
        </span>
      }
      subtitle={`${t.category} · dibuat ${fmtDateTime(t.createdAt)}`}
      footer={
        <>
          <Button variant="danger" size="sm" icon="Trash2" onClick={async () => (await kit.deleteTask(t)) && onClose()}>
            Hapus
          </Button>
          <Button size="sm" icon="Pencil" onClick={() => (onClose(), openModal({ kind: "task", task: t }))}>
            Edit
          </Button>
          {t.status !== "completed" && (
            <Button size="sm" icon="WandSparkles" onClick={() => (onClose(), openModal({ kind: "smart", taskId: t.id }))}>
              Jadwalkan cerdas
            </Button>
          )}
          <Button size="sm" variant="primary" icon={t.status === "completed" ? "RotateCcw" : "Check"} onClick={() => kit.toggleTask(t)}>
            {t.status === "completed" ? "Buka kembali" : "Tandai selesai"}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-4">
          <Ring value={p} size={74} stroke={7} color={st === "completed" ? "#22C55E" : undefined}>
            <span className="tabular text-sm font-semibold">{p}%</span>
          </Ring>
          <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-3">
            <div className="surface p-2.5">
              <p className="text-[11px] text-muted">Deadline</p>
              <p className="text-sm font-semibold" style={{ color: LEVEL_COLOR[lvl] }}>
                {fmtDateTime(t.deadline)}
              </p>
              <p className="text-[11px] text-muted">{t.status === "completed" ? "selesai" : relativeDeadline(t.deadline)}</p>
            </div>
            <div className="surface p-2.5">
              <p className="text-[11px] text-muted">Prioritas</p>
              <p className="text-sm font-semibold" style={{ color: PRIORITY_META[t.priority].color }}>
                {PRIORITY_META[t.priority].label}
              </p>
            </div>
            <div className="surface p-2.5">
              <p className="text-[11px] text-muted">Estimasi</p>
              <p className="text-sm font-semibold">{durationLabel(t.estimatedMinutes)}</p>
            </div>
          </div>
        </div>
        <div>
          <p className="label">Status</p>
          <Segmented
            size="sm"
            value={t.status}
            onChange={setStatus}
            options={[
              { value: "todo", label: "To Do" },
              { value: "in_progress", label: "In Progress" },
              { value: "completed", label: "Completed" },
            ]}
          />
          {st === "overdue" && <Pill color="#EF4444" className="ml-2">Overdue</Pill>}
        </div>
        {t.description && <p className="rounded-xl bg-bg2/60 p-3 text-sm whitespace-pre-wrap text-muted">{t.description}</p>}
        <div>
          <p className="label">Subtugas ({t.subtasks.filter((s) => s.done).length}/{t.subtasks.length})</p>
          <div className="space-y-1.5">
            {t.subtasks.map((s) => (
              <div key={s.id} className="surface flex items-center gap-2.5 px-3 py-2">
                <button className="check" data-checked={s.done} onClick={() => update({ subtasks: t.subtasks.map((x) => (x.id === s.id ? { ...x, done: !x.done } : x)), status: t.status === "todo" ? "in_progress" : t.status })} aria-label="Tandai subtugas">
                  <Icon name="Check" size={12} strokeWidth={3} />
                </button>
                <span className={cn("flex-1 text-sm", s.done && "text-muted line-through")}>{s.title}</span>
                <button className="text-muted hover:text-danger" onClick={() => update({ subtasks: t.subtasks.filter((x) => x.id !== s.id) })} aria-label="Hapus subtugas">
                  <Icon name="X" size={14} />
                </button>
              </div>
            ))}
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!newSub.trim()) return;
                update({ subtasks: [...t.subtasks, { id: uid("sub-"), title: newSub.trim(), done: false }] });
                setNewSub("");
              }}
            >
              <input className="input !h-9" value={newSub} onChange={(e) => setNewSub(e.target.value)} placeholder="Tambah subtugas…" />
              <Button size="sm" type="submit" icon="Plus" className="!h-9">
                Tambah
              </Button>
            </form>
          </div>
        </div>
        {!t.subtasks.length && t.status !== "completed" && (
          <div>
            <p className="label">Progres manual: {t.progress}%</p>
            <input type="range" min={0} max={100} step={5} value={t.progress} onChange={(e) => update({ progress: Number(e.target.value), status: Number(e.target.value) > 0 && t.status === "todo" ? "in_progress" : t.status })} className="w-full accent-[var(--color-primary)]" />
          </div>
        )}
        <div>
          <p className="label">Catatan</p>
          <textarea className="input" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Tambahkan catatan…" />
          {notes !== (t.notes ?? "") && (
            <Button
              size="sm"
              className="mt-2"
              icon="Check"
              onClick={async () => {
                await update({ notes });
                toast("success", "Catatan tugas disimpan");
              }}
            >
              Simpan catatan
            </Button>
          )}
        </div>
        {sessions.length > 0 && (
          <div>
            <p className="label">Sesi kerja terjadwal</p>
            <div className="space-y-1">
              {sessions.map((s) => (
                <div key={s.id} className="flex items-center gap-2 text-sm">
                  <Icon name="CalendarCheck" size={14} className="text-accent" />
                  {fmtDateTime(`${s.date}T${s.start}`)}–{fmtTime(s.end)}
                  {s.completedDates?.includes(s.date) && <Pill color="#22C55E">selesai</Pill>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

function TaskRow({ t, onOpen }: { t: Task; onOpen: () => void }) {
  const kit = useKit();
  const { openModal } = useUI();
  const st = displayStatus(t);
  const lvl = deadlineLevel(t);
  const p = taskProgress(t);
  return (
    <div className="group card card-hover flex items-center gap-3 !rounded-2xl px-3.5 py-3">
      <button className="check" data-checked={t.status === "completed"} onClick={() => kit.toggleTask(t)} aria-label="Tandai selesai">
        <Icon name="Check" size={12} strokeWidth={3} />
      </button>
      <button onClick={onOpen} className="min-w-0 flex-1 text-left">
        <div className="flex flex-wrap items-center gap-2">
          <p className={cn("truncate text-sm font-semibold", t.status === "completed" && "text-muted line-through")}>{t.title}</p>
          <DemoBadge show={t.isDemo} />
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <Pill color={TASK_STATUS_META[st].color}>{TASK_STATUS_META[st].label}</Pill>
          <Pill color={PRIORITY_META[t.priority].color}>{PRIORITY_META[t.priority].label}</Pill>
          <span className="text-[11px] text-muted">{t.category}</span>
          {t.subtasks.length > 0 && (
            <span className="flex items-center gap-1 text-[11px] text-muted">
              <Icon name="ListChecks" size={12} /> {t.subtasks.filter((s) => s.done).length}/{t.subtasks.length}
            </span>
          )}
          {t.notes && <Icon name="StickyNote" size={12} className="text-muted" />}
        </div>
        {t.status !== "completed" && p > 0 && <ProgressBar value={p} height={3} className="mt-2 max-w-xs" />}
      </button>
      <div className="hidden text-right sm:block">
        <p className="tabular text-xs font-semibold" style={{ color: LEVEL_COLOR[lvl] }}>
          {t.status === "completed" ? "Selesai" : st === "overdue" ? relativeDeadline(t.deadline) : relativeDeadline(t.deadline)}
        </p>
        <p className="tabular text-[11px] text-subtle">{fmtDateTime(t.deadline)}</p>
      </div>
      <Menu
        trigger={(toggle) => (
          <button onClick={toggle} className="btn btn-ghost btn-sm btn-icon" aria-label="Aksi tugas">
            <Icon name="Ellipsis" size={16} />
          </button>
        )}
        items={[
          { label: "Lihat detail", icon: "Eye", onClick: onOpen },
          { label: "Edit", icon: "Pencil", onClick: () => openModal({ kind: "task", task: t }) },
          ...(t.status !== "completed" ? [{ label: "Jadwalkan cerdas", icon: "WandSparkles" as const, onClick: () => openModal({ kind: "smart", taskId: t.id }) }] : []),
          { label: "Hapus", icon: "Trash2", danger: true, onClick: () => kit.deleteTask(t) },
        ]}
      />
    </div>
  );
}

const BOARD: { key: DisplayStatus; label: string }[] = [
  { key: "todo", label: "To Do" },
  { key: "in_progress", label: "In Progress" },
  { key: "overdue", label: "Overdue" },
  { key: "completed", label: "Completed" },
];

export function TasksView() {
  const { tasks, actions } = useData();
  const { openModal, focus, setFocus } = useUI();
  const { toast } = useToast();
  const now = useNow(60_000);
  const nl = nowLocal(now);
  const today = todayKey(now);
  const [q, setQ] = React.useState("");
  const [cat, setCat] = React.useState("all");
  const [prio, setPrio] = React.useState("all");
  const [dl, setDl] = React.useState<DeadlineFilter>("all");
  const [sort, setSort] = React.useState<SortKey>("deadline");
  const [tab, setTab] = React.useState<"all" | DisplayStatus>("all");
  const [mode, setMode] = React.useState<"list" | "board">("list");
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [dragId, setDragId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (focus?.type === "task") {
      setOpenId(focus.id);
      setFocus(null);
    }
  }, [focus, setFocus]);

  const weekEnd = addDays(startOfWeek(today), 6);
  const filtered = React.useMemo(() => {
    const term = q.trim().toLowerCase();
    return tasks
      .filter((t) => !term || [t.title, t.description, t.notes, t.category, ...t.subtasks.map((s) => s.title)].some((x) => x?.toLowerCase().includes(term)))
      .filter((t) => cat === "all" || t.category === cat)
      .filter((t) => prio === "all" || t.priority === prio)
      .filter((t) => {
        const d = t.deadline.slice(0, 10);
        if (dl === "today") return d === today;
        if (dl === "week") return d >= startOfWeek(today) && d <= weekEnd;
        if (dl === "overdue") return isOverdue(t, nl);
        if (dl === "upcoming") return d > today && t.status !== "completed";
        return true;
      })
      .sort((a, b) => {
        if (sort === "newest") return b.createdAt.localeCompare(a.createdAt);
        if (sort === "oldest") return a.createdAt.localeCompare(b.createdAt);
        if (sort === "priority") return PRIORITY_META[b.priority].weight - PRIORITY_META[a.priority].weight || a.deadline.localeCompare(b.deadline);
        // closest deadline: open tasks first
        return Number(a.status === "completed") - Number(b.status === "completed") || a.deadline.localeCompare(b.deadline);
      });
  }, [tasks, q, cat, prio, dl, sort, today, weekEnd, nl]);
  const listed = tab === "all" ? filtered : filtered.filter((t) => displayStatus(t, nl) === tab);
  const counts = (s: DisplayStatus) => filtered.filter((t) => displayStatus(t, nl) === s).length;

  const tToday = todaysTasks(tasks, today);
  const up = upcomingTasks(tasks, 7, today);
  const overdue = tasks.filter((t) => isOverdue(t, nl));
  const done = tasks.filter((t) => t.status === "completed");
  const wc = weeklyCompletion(tasks, today);

  const drop = async (status: DisplayStatus) => {
    const t = tasks.find((x) => x.id === dragId);
    setDragId(null);
    if (!t) return;
    if (status === "overdue") return toast("info", "Status Overdue dihitung otomatis dari deadline");
    if (displayStatus(t, nl) === status) return;
    await actions.upsert("tasks", { ...t, status: status as TaskStatus, completedAt: status === "completed" ? nowLocal() : undefined });
    toast("success", `Dipindah ke ${TASK_STATUS_META[status].label}`, t.title);
  };

  return (
    <div>
      <SectionTitle
        title="Tugas"
        subtitle="Kelola to-do, deadline, subtugas & progres. Gunakan Smart Planner untuk menjadwalkan waktu kerja."
        action={
          <Button variant="primary" icon="Plus" onClick={() => openModal({ kind: "task" })}>
            Tambah Tugas
          </Button>
        }
      />
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-5">
        {[
          { l: "Tugas hari ini", v: tToday.length, s: `${tToday.filter((t) => t.status === "completed").length} selesai`, c: "#60A5FA", i: "CalendarCheck" as const, f: () => (setDl("today"), setTab("all")) },
          { l: "Akan datang (7 hari)", v: up.length, s: "belum selesai", c: "#38BDF8", i: "CalendarClock" as const, f: () => (setDl("upcoming"), setTab("all")) },
          { l: "Terlambat", v: overdue.length, s: overdue.length ? "segera tangani" : "tidak ada", c: "#EF4444", i: "CircleAlert" as const, f: () => (setDl("all"), setTab("overdue")) },
          { l: "Selesai", v: done.length, s: "total tugas selesai", c: "#22C55E", i: "CircleCheck" as const, f: () => (setDl("all"), setTab("completed")) },
        ].map((x) => (
          <button key={x.l} onClick={x.f} className="card card-hover p-4 text-left">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted">{x.l}</span>
              <Icon name={x.i} size={16} style={{ color: x.c }} />
            </div>
            <p className="tabular mt-2 text-3xl font-semibold">{x.v}</p>
            <p className="text-[11px] text-muted">{x.s}</p>
          </button>
        ))}
        <div className="card col-span-2 flex items-center gap-4 p-4 md:col-span-1">
          <Ring value={wc.pct} size={64} stroke={7}>
            <span className="tabular text-sm font-semibold">{wc.pct}%</span>
          </Ring>
          <div>
            <p className="text-xs font-medium text-muted">Penyelesaian minggu ini</p>
            <p className="tabular text-sm font-semibold">
              {wc.done}/{wc.total} tugas
            </p>
          </div>
        </div>
      </div>

      <Card className="mb-4 p-3">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Icon name="Search" size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
            <input className="input !pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari tugas, subtugas, catatan…" aria-label="Cari tugas" />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:flex">
            <Select value={cat} onChange={(e) => setCat(e.target.value)} options={[{ value: "all", label: "Semua kategori" }, ...TASK_CATEGORIES.map((c) => ({ value: c, label: c }))]} className="lg:w-40" aria-label="Filter kategori" />
            <Select value={prio} onChange={(e) => setPrio(e.target.value)} options={[{ value: "all", label: "Semua prioritas" }, ...PRIORITIES.map((p) => ({ value: p.value, label: p.label }))]} className="lg:w-36" aria-label="Filter prioritas" />
            <Select
              value={dl}
              onChange={(e) => setDl(e.target.value as DeadlineFilter)}
              options={[
                { value: "all", label: "Semua deadline" },
                { value: "today", label: "Hari ini" },
                { value: "week", label: "Minggu ini" },
                { value: "upcoming", label: "Akan datang" },
                { value: "overdue", label: "Terlambat" },
              ]}
              className="lg:w-40"
              aria-label="Filter deadline"
            />
            <Select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              options={[
                { value: "deadline", label: "Deadline terdekat" },
                { value: "newest", label: "Terbaru" },
                { value: "oldest", label: "Terlama" },
                { value: "priority", label: "Prioritas tertinggi" },
              ]}
              className="lg:w-44"
              aria-label="Urutkan"
            />
          </div>
          <Segmented
            size="sm"
            value={mode}
            onChange={setMode}
            options={[
              { value: "list", label: <span className="flex items-center gap-1"><Icon name="List" size={13} />List</span> },
              { value: "board", label: <span className="flex items-center gap-1"><Icon name="Columns3" size={13} />Board</span> },
            ]}
          />
        </div>
      </Card>

      {mode === "list" ? (
        <>
          <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1">
            {(["all", "todo", "in_progress", "overdue", "completed"] as const).map((k) => (
              <button key={k} onClick={() => setTab(k)} className={cn("btn btn-sm shrink-0", tab === k ? "!border-primary/50 !bg-primary/15 !text-fg" : "btn-ghost")}>
                {k === "all" ? "Semua" : TASK_STATUS_META[k].label}
                <span className="tabular rounded-md bg-white/10 px-1.5 text-[10px]">{k === "all" ? filtered.length : counts(k)}</span>
              </button>
            ))}
          </div>
          <div className="space-y-2">
            {listed.length === 0 ? (
              <Card>
                <EmptyState icon="ListTodo" title="Tidak ada tugas yang cocok" description="Ubah filter atau tambahkan tugas baru." action={<Button icon="Plus" onClick={() => openModal({ kind: "task" })}>Tambah tugas</Button>} />
              </Card>
            ) : (
              listed.map((t) => <TaskRow key={t.id} t={t} onOpen={() => setOpenId(t.id)} />)
            )}
          </div>
        </>
      ) : (
        <div className="grid gap-4 overflow-x-auto md:grid-cols-2 xl:grid-cols-4">
          {BOARD.map((col) => {
            const items = filtered.filter((t) => displayStatus(t, nl) === col.key);
            return (
              <div key={col.key} onDragOver={(e) => e.preventDefault()} onDrop={() => drop(col.key)} className={cn("rounded-2xl border border-line bg-bg2/50 p-3 transition", dragId && col.key !== "overdue" && "border-dashed border-primary/40")}>
                <div className="mb-3 flex items-center justify-between px-1">
                  <span className="flex items-center gap-2 text-sm font-semibold">
                    <span className="size-2 rounded-full" style={{ background: TASK_STATUS_META[col.key].color }} />
                    {col.label}
                  </span>
                  <span className="tabular text-xs text-muted">{items.length}</span>
                </div>
                <div className="min-h-24 space-y-2">
                  {items.map((t) => (
                    <div key={t.id} draggable onDragStart={() => setDragId(t.id)} onDragEnd={() => setDragId(null)} onClick={() => setOpenId(t.id)} className="card card-hover cursor-grab !rounded-xl p-3 active:cursor-grabbing">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium">{t.title}</p>
                        <DemoBadge show={t.isDemo} />
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <Pill color={PRIORITY_META[t.priority].color}>{PRIORITY_META[t.priority].label}</Pill>
                        <span className="tabular text-[11px]" style={{ color: LEVEL_COLOR[deadlineLevel(t, nl)] }}>
                          {fmtDateTime(t.deadline)}
                        </span>
                      </div>
                      {taskProgress(t) > 0 && t.status !== "completed" && <ProgressBar value={taskProgress(t)} height={3} className="mt-2" />}
                    </div>
                  ))}
                  {items.length === 0 && <p className="py-6 text-center text-xs text-subtle">Seret tugas ke sini</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {openId && <TaskDetail taskId={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}
