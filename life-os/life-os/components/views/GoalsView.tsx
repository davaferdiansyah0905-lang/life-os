"use client";

import * as React from "react";
import type { Goal } from "@/lib/types";
import { Icon } from "../icons";
import { Button, Card, CardHeader, DemoBadge, EmptyState, Modal, Pill, ProgressBar, Ring, SectionTitle, Segmented, Select } from "../ui";
import { useData } from "../providers/DataProvider";
import { useUI } from "../providers/UIProvider";
import { useToast } from "../providers/Toast";
import { goalProgress, useKit } from "../hooks";
import { GOAL_CATEGORIES, GOAL_CATEGORY_META, PRIORITY_META } from "@/lib/constants";
import { diffDays, fmtDate, fmtDateTime, todayKey } from "@/lib/time";
import { cn } from "@/lib/format";

const meta = (c: string) => GOAL_CATEGORY_META[c] ?? GOAL_CATEGORY_META.Lainnya;

function timeLeft(target: string, today: string) {
  const d = diffDays(target, today);
  if (d < 0) return { text: `lewat ${-d} hari`, overdue: true };
  if (d < 31) return { text: `${d} hari lagi`, overdue: false };
  const m = Math.floor(d / 30.44);
  if (m < 12) return { text: `±${m} bulan lagi`, overdue: false };
  const y = Math.floor(m / 12);
  const rm = m % 12;
  return { text: `±${y} th${rm ? ` ${rm} bln` : ""} lagi`, overdue: false };
}

function elapsedPct(g: Goal, today: string) {
  const total = Math.max(1, diffDays(g.targetDate, g.startDate));
  return Math.max(0, Math.min(100, Math.round((diffDays(today, g.startDate) / total) * 100)));
}

function Roadmap({ g }: { g: Goal }) {
  const kit = useKit();
  const color = meta(g.category).color;
  const firstOpen = g.milestones.findIndex((m) => !m.done);
  return (
    <ol className="relative ml-3">
      {g.milestones.map((m, i) => {
        const current = i === firstOpen;
        return (
          <li key={m.id} className="relative pb-5 pl-8 last:pb-0">
            {i < g.milestones.length - 1 && <span className="absolute top-6 bottom-0 left-[3px] w-0.5" style={{ background: m.done ? color : "rgb(148 163 184 / 0.2)" }} />}
            <button
              onClick={() => kit.toggleMilestone(g, m.id)}
              className={cn("absolute top-0.5 -left-2.5 grid size-6 place-items-center rounded-full border-2 transition hover:scale-110", m.done ? "text-white" : current ? "bg-card" : "border-line-strong bg-card")}
              style={m.done ? { background: color, borderColor: color } : current ? { borderColor: color } : undefined}
              aria-label={m.done ? "Tandai belum selesai" : "Tandai selesai"}
            >
              {m.done ? <Icon name="Check" size={12} strokeWidth={3} /> : <span className="text-[10px] font-bold text-muted">{i + 1}</span>}
            </button>
            <p className={cn("text-sm font-medium", m.done && "text-muted")}>{m.title}</p>
            <p className="text-[11px] text-subtle">{m.done ? `Selesai ${m.doneAt ? fmtDate(m.doneAt) : ""}` : current ? "Fokus berikutnya" : "Belum dimulai"}</p>
          </li>
        );
      })}
    </ol>
  );
}

function GoalDetail({ goalId, onClose }: { goalId: string; onClose: () => void }) {
  const { goals, actions } = useData();
  const { openModal } = useUI();
  const { toast, confirm } = useToast();
  const g = goals.find((x) => x.id === goalId);
  if (!g) return null;
  const today = todayKey();
  const p = goalProgress(g);
  const el = elapsedPct(g, today);
  const tl = timeLeft(g.targetDate, today);
  const m = meta(g.category);
  const del = async () => {
    if (!(await confirm({ title: "Hapus goal?", message: `"${g.title}" beserta milestone & riwayatnya akan dihapus.`, danger: true, confirmText: "Hapus" }))) return;
    await actions.remove("goals", g.id);
    toast("success", "Goal dihapus");
    onClose();
  };
  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      icon={m.icon}
      title={
        <span className="flex items-center gap-2">
          {g.title} <DemoBadge show={g.isDemo} />
        </span>
      }
      subtitle={`${g.category} · target ${fmtDate(g.targetDate)}`}
      footer={
        <>
          <Button variant="danger" size="sm" icon="Trash2" onClick={del}>
            Hapus
          </Button>
          <Button size="sm" icon="Pencil" onClick={() => (onClose(), openModal({ kind: "goal", goal: g }))}>
            Edit goal
          </Button>
        </>
      }
    >
      <div className="grid gap-6 md:grid-cols-5">
        <div className="space-y-4 md:col-span-2">
          <div className="flex flex-col items-center rounded-2xl border border-line bg-bg2/50 p-4">
            <Ring value={p} size={130} stroke={11} color={m.color}>
              <div className="text-center">
                <div className="tabular text-2xl font-semibold">{p}%</div>
                <div className="text-[11px] text-muted">progres</div>
              </div>
            </Ring>
            <div className="mt-4 w-full space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted">Waktu berjalan</span>
                <span className="tabular font-semibold">{el}%</span>
              </div>
              <ProgressBar value={el} color="rgb(148 163 184 / 0.6)" height={4} />
              <p className={cn("pt-1 text-center font-medium", p >= el ? "text-success" : p >= el - 15 ? "text-warning" : "text-danger")}>{g.status === "completed" ? "🎉 Tercapai" : p >= el ? "Sesuai jalur" : p >= el - 15 ? "Sedikit tertinggal" : "Tertinggal dari jadwal"}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="surface p-2.5">
              <p className="tabular text-lg font-semibold text-success">{g.milestones.filter((x) => x.done).length}</p>
              <p className="text-[11px] text-muted">milestone selesai</p>
            </div>
            <div className="surface p-2.5">
              <p className="tabular text-lg font-semibold">{g.milestones.filter((x) => !x.done).length}</p>
              <p className="text-[11px] text-muted">tersisa</p>
            </div>
            <div className="surface col-span-2 p-2.5">
              <p className={cn("text-sm font-semibold", tl.overdue && "text-danger")}>{tl.text}</p>
              <p className="text-[11px] text-muted">sisa waktu hingga {fmtDate(g.targetDate)}</p>
            </div>
          </div>
          {g.description && <p className="text-sm text-muted">{g.description}</p>}
          {g.notes && <p className="rounded-xl bg-bg2/60 p-3 text-xs whitespace-pre-wrap text-muted">{g.notes}</p>}
        </div>
        <div className="md:col-span-3">
          <p className="eyebrow mb-3">Peta perjalanan (klik untuk menandai)</p>
          {g.milestones.length ? <Roadmap g={g} /> : <p className="text-sm text-muted">Belum ada milestone. Edit goal untuk memecahnya menjadi langkah kecil.</p>}
          <p className="eyebrow mt-6 mb-2">Riwayat pencapaian</p>
          <div className="max-h-48 space-y-1.5 overflow-y-auto">
            {g.history.length === 0 ? (
              <p className="text-sm text-muted">Belum ada riwayat.</p>
            ) : (
              [...g.history].reverse().map((h, i) => (
                <div key={i} className="flex gap-2.5 text-xs">
                  <span className="tabular w-28 shrink-0 text-subtle">{fmtDateTime(h.at)}</span>
                  <span>{h.text}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}

export function GoalsView() {
  const { goals } = useData();
  const { openModal, focus, setFocus } = useUI();
  const kit = useKit();
  const today = todayKey();
  const [filter, setFilter] = React.useState<"all" | Goal["status"]>("all");
  const [cat, setCat] = React.useState("all");
  const [openId, setOpenId] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (focus?.type === "goal") {
      setOpenId(focus.id);
      setFocus(null);
    }
  }, [focus, setFocus]);

  const list = goals
    .filter((g) => filter === "all" || g.status === filter)
    .filter((g) => cat === "all" || g.category === cat)
    .sort((a, b) => Number(a.status === "completed") - Number(b.status === "completed") || PRIORITY_META[b.priority].weight - PRIORITY_META[a.priority].weight || a.targetDate.localeCompare(b.targetDate));
  const active = goals.filter((g) => g.status === "active");
  const avg = active.length ? Math.round(active.reduce((s, g) => s + goalProgress(g), 0) / active.length) : 0;
  const msDone = goals.reduce((s, g) => s + g.milestones.filter((m) => m.done).length, 0);
  const msTotal = goals.reduce((s, g) => s + g.milestones.length, 0);

  return (
    <div>
      <SectionTitle
        title="Goals & Impian"
        subtitle="Rencanakan ambisi jangka panjang dan pecah menjadi milestone yang bisa dicapai."
        action={
          <Button variant="primary" icon="Plus" onClick={() => openModal({ kind: "goal" })}>
            Goal Baru
          </Button>
        }
      />
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-5">
        <div className="card col-span-2 flex items-center gap-4 overflow-hidden bg-gradient-to-br from-primary/25 via-primary/5 to-transparent p-4 md:col-span-1">
          <Ring value={avg} size={64} stroke={7}>
            <span className="tabular text-sm font-semibold">{avg}%</span>
          </Ring>
          <div>
            <p className="text-xs text-muted">Rata-rata progres</p>
            <p className="text-sm font-semibold">goal aktif</p>
          </div>
        </div>
        {[
          { l: "Total goals", v: goals.length, i: "Target" as const, c: "#60A5FA" },
          { l: "Aktif", v: active.length, i: "Rocket" as const, c: "#38BDF8" },
          { l: "Tercapai", v: goals.filter((g) => g.status === "completed").length, i: "Trophy" as const, c: "#F59E0B" },
          { l: "Milestone selesai", v: `${msDone}/${msTotal}`, i: "Flag" as const, c: "#22C55E" },
        ].map((s) => (
          <div key={s.l} className="card p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted">{s.l}</span>
              <Icon name={s.i} size={16} style={{ color: s.c }} />
            </div>
            <p className="tabular mt-2 text-3xl font-semibold">{s.v}</p>
          </div>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Segmented
          size="sm"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "Semua" },
            { value: "active", label: "Aktif" },
            { value: "completed", label: "Tercapai" },
            { value: "paused", label: "Ditunda" },
          ]}
        />
        <Select value={cat} onChange={(e) => setCat(e.target.value)} options={[{ value: "all", label: "Semua kategori" }, ...GOAL_CATEGORIES.map((c) => ({ value: c, label: c }))]} className="!h-9 !w-auto" aria-label="Filter kategori" />
      </div>

      <div className="grid gap-5 xl:grid-cols-12">
        <div className="grid content-start gap-4 md:grid-cols-2 xl:col-span-8">
          {list.length === 0 ? (
            <Card className="md:col-span-2">
              <EmptyState icon="Mountain" title="Belum ada goal di sini" description="Mulai dari impian terbesarmu, lalu pecah menjadi milestone." action={<Button icon="Plus" onClick={() => openModal({ kind: "goal" })}>Goal baru</Button>} />
            </Card>
          ) : (
            list.map((g) => {
              const m = meta(g.category);
              const p = goalProgress(g);
              const tl = timeLeft(g.targetDate, today);
              const next = g.milestones.find((x) => !x.done);
              return (
                <Card key={g.id} className="card-hover flex flex-col overflow-hidden p-0">
                  <div className="h-1 w-full" style={{ background: `linear-gradient(90deg, ${m.color}, transparent)` }} />
                  <div className="flex flex-1 flex-col p-5">
                    <div className="flex items-start gap-3">
                      <span className="grid size-10 shrink-0 place-items-center rounded-xl" style={{ background: `${m.color}20`, color: m.color }}>
                        <Icon name={m.icon} size={19} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[11px] font-medium" style={{ color: m.color }}>
                            {g.category}
                          </span>
                          <DemoBadge show={g.isDemo} />
                          {g.status === "completed" && <Pill color="#22C55E">Tercapai</Pill>}
                          {g.status === "paused" && <Pill color="#94A3B8">Ditunda</Pill>}
                        </div>
                        <h3 className="mt-0.5 text-[15px] leading-snug font-semibold">{g.title}</h3>
                      </div>
                      <Ring value={p} size={52} stroke={5} color={m.color}>
                        <span className="tabular text-[11px] font-semibold">{p}%</span>
                      </Ring>
                    </div>
                    {g.description && <p className="mt-3 line-clamp-2 text-xs text-muted">{g.description}</p>}
                    <div className="mt-4 space-y-1.5">
                      {g.milestones.slice(0, 4).map((ms) => (
                        <button key={ms.id} onClick={() => kit.toggleMilestone(g, ms.id)} className="flex w-full items-center gap-2 text-left text-xs">
                          <span className="check !size-4" data-checked={ms.done}>
                            <Icon name="Check" size={10} strokeWidth={3} />
                          </span>
                          <span className={cn("truncate", ms.done && "text-muted line-through")}>{ms.title}</span>
                        </button>
                      ))}
                      {g.milestones.length > 4 && <p className="pl-6 text-[11px] text-subtle">+{g.milestones.length - 4} milestone lainnya</p>}
                    </div>
                    <div className="mt-auto pt-4">
                      <ProgressBar value={p} color={`linear-gradient(90deg, ${m.color}99, ${m.color})`} />
                      <div className="mt-2 flex items-center justify-between text-[11px]">
                        <span className="text-muted">
                          {g.milestones.filter((x) => x.done).length}/{g.milestones.length} milestone {next && g.status !== "completed" ? `· berikutnya: ${next.title}` : ""}
                        </span>
                      </div>
                      <div className="mt-3 flex items-center justify-between">
                        <span className={cn("flex items-center gap-1.5 text-xs", tl.overdue ? "text-danger" : "text-muted")}>
                          <Icon name="Hourglass" size={13} /> {tl.text}
                        </span>
                        <Button size="sm" onClick={() => setOpenId(g.id)}>
                          Detail <Icon name="ArrowRight" size={13} />
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })
          )}
        </div>
        <div className="space-y-5 xl:col-span-4">
          <Card className="p-5">
            <CardHeader title="Progres vs Waktu" subtitle="Bar penuh = progres · garis = waktu yang sudah berjalan" icon="ChartBarBig" />
            <div className="mt-5 space-y-4">
              {active.length === 0 ? (
                <p className="text-sm text-muted">Tidak ada goal aktif.</p>
              ) : (
                active.map((g) => {
                  const p = goalProgress(g);
                  const el = elapsedPct(g, today);
                  const m = meta(g.category);
                  return (
                    <button key={g.id} onClick={() => setOpenId(g.id)} className="block w-full text-left">
                      <div className="mb-1 flex justify-between gap-2 text-xs">
                        <span className="truncate font-medium">{g.title}</span>
                        <span className={cn("tabular shrink-0", p >= el ? "text-success" : "text-warning")}>
                          {p}% / {el}%
                        </span>
                      </div>
                      <div className="relative h-2.5 rounded-full bg-white/[0.06]">
                        <div className="h-full rounded-full" style={{ width: `${p}%`, background: m.color }} />
                        <div className="absolute -top-1 h-[18px] w-0.5 rounded bg-fg/80" style={{ left: `${el}%` }} title={`Waktu berjalan ${el}%`} />
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </Card>
          <Card className="p-5">
            <CardHeader title="Milestone Berikutnya" subtitle="Langkah konkret untuk dikerjakan" icon="Footprints" />
            <div className="mt-4 space-y-2">
              {active
                .map((g) => ({ g, ms: g.milestones.find((m) => !m.done) }))
                .filter((x) => x.ms)
                .slice(0, 6)
                .map(({ g, ms }) => (
                  <div key={g.id} className="surface flex items-center gap-3 p-3">
                    <button className="check" data-checked={false} onClick={() => kit.toggleMilestone(g, ms!.id)} aria-label="Tandai milestone selesai">
                      <Icon name="Check" size={12} strokeWidth={3} />
                    </button>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{ms!.title}</p>
                      <p className="truncate text-[11px] text-muted">{g.title}</p>
                    </div>
                  </div>
                ))}
              {!active.some((g) => g.milestones.some((m) => !m.done)) && <p className="text-sm text-muted">Tidak ada milestone tertunda.</p>}
            </div>
          </Card>
        </div>
      </div>
      {openId && <GoalDetail goalId={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}
