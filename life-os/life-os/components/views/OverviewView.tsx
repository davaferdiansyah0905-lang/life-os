"use client";

import * as React from "react";
import Link from "next/link";
import { Icon, type IconName } from "../icons";
import { Card, CardHeader, DemoBadge, Dot, EmptyState, Pill, ProgressBar, Ring } from "../ui";
import { BarChart, SegmentGauge } from "../charts";
import { QuoteCard } from "./QuoteCard";
import { useData } from "../providers/DataProvider";
import { useUI } from "../providers/UIProvider";
import { goalProgress, useKit, useNow } from "../hooks";
import { GOAL_CATEGORY_META, PRIORITY_META, SCHEDULE_CATEGORY_META } from "@/lib/constants";
import { currentAndNext, remainingFreeToday } from "@/lib/schedule";
import { dayScore } from "@/lib/analytics";
import { deadlineLevel, displayStatus, isOverdue, LEVEL_COLOR, todaysTasks } from "@/lib/tasks";
import { incomeExpenseSeries, makeBuckets, summarize } from "@/lib/finance";
import { addDays, diffDays, durationLabel, fmtDateLong, fmtDateShort, fmtTime, fmtWeekdayShort, greeting, nowLocal, relativeDeadline, todayKey, toMin, zonedParts } from "@/lib/time";
import { cn, money, moneyShort } from "@/lib/format";

const MESSAGES = [
  "Setiap langkah kecil yang kamu ambil hari ini membawamu lebih dekat ke masa depan yang sedang kamu bangun.",
  "Fokus pada satu hal penting dulu. Momentum akan menyusul.",
  "Rencanakan harimu, lalu jalankan rencanamu. Kamu sudah selangkah di depan.",
  "Konsisten hari ini adalah pencapaian besar esok hari.",
];

function LiveClock() {
  const [t, setT] = React.useState<ReturnType<typeof zonedParts> | null>(null);
  React.useEffect(() => {
    const tick = () => setT(zonedParts());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  const { settings } = useData();
  const tzLabel = settings.timezone === "Asia/Jakarta" ? "WIB" : settings.timezone === "Asia/Makassar" ? "WITA" : settings.timezone === "Asia/Jayapura" ? "WIT" : settings.timezone;
  if (!t) return <div className="h-14 w-44" />;
  let hh = t.hh;
  let suffix = "";
  if (settings.timeFormat === "12h") {
    const h = Number(t.hh);
    suffix = h >= 12 ? " PM" : " AM";
    hh = String(h % 12 === 0 ? 12 : h % 12).padStart(2, "0");
  }
  return (
    <div className="card flex items-center gap-3 px-4 py-3">
      <span className="live-dot" />
      <div>
        <div className="tabular font-mono text-[1.75rem] leading-none font-semibold tracking-tight">
          {hh}:{t.mm}
          <span className="text-lg text-muted">:{t.ss}</span>
          <span className="ml-1 text-sm text-muted">{suffix}</span>
        </div>
        <div className="mt-1 text-[11px] font-medium tracking-wide text-muted">{tzLabel} · waktu lokal</div>
      </div>
    </div>
  );
}

function QuickActions() {
  const { openModal } = useUI();
  const items: { label: string; icon: IconName; color: string; onClick: () => void }[] = [
    { label: "Tugas", icon: "ListTodo", color: "#60A5FA", onClick: () => openModal({ kind: "task" }) },
    { label: "Jadwal", icon: "CalendarPlus", color: "#38BDF8", onClick: () => openModal({ kind: "schedule" }) },
    { label: "Transaksi", icon: "Receipt", color: "#22C55E", onClick: () => openModal({ kind: "transaction" }) },
    { label: "Goal", icon: "Target", color: "#A78BFA", onClick: () => openModal({ kind: "goal" }) },
    { label: "Catatan", icon: "NotebookPen", color: "#F59E0B", onClick: () => openModal({ kind: "note" }) },
  ];
  return (
    <div className="grid grid-cols-5 gap-2 sm:flex sm:flex-wrap">
      {items.map((it) => (
        <button key={it.label} onClick={it.onClick} className="group card card-hover flex flex-col items-center gap-1.5 !rounded-2xl px-2 py-3 text-xs font-semibold sm:flex-row sm:gap-2 sm:px-4 sm:py-2.5 sm:text-sm">
          <span className="grid size-7 place-items-center rounded-lg transition group-hover:scale-110" style={{ background: `${it.color}22`, color: it.color }}>
            <Icon name="Plus" size={14} strokeWidth={2.6} />
          </span>
          <span className="truncate">
            <span className="hidden sm:inline">Tambah </span>
            {it.label}
          </span>
        </button>
      ))}
    </div>
  );
}

export function OverviewView() {
  const data = useData();
  const { settings, schedules, tasks, transactions, goals } = data;
  const kit = useKit();
  const now = useNow(30_000);
  const today = todayKey(now);
  const nl = nowLocal(now);
  const g = greeting();
  const msg = MESSAGES[Number(today.slice(8, 10)) % MESSAGES.length];

  // Productivity
  const tToday = todaysTasks(tasks, today);
  const completed = tToday.filter((t) => t.status === "completed").length;
  const overdueAll = tasks.filter((t) => isOverdue(t, nl));
  const pending = tToday.filter((t) => t.status !== "completed").length;
  const score = dayScore(tasks, schedules, today);
  const freeLeft = remainingFreeToday(schedules, today);

  // Schedule
  const { occ, current, next } = currentAndNext(schedules, today, toMin(nl.slice(11)));
  const nowMin = toMin(nl.slice(11));

  // Finance
  const fin = summarize(transactions, settings, today);
  const weekBuckets = makeBuckets(addDays(today, -6), today, "day");
  const ie = incomeExpenseSeries(transactions, weekBuckets).map((r) => ({ ...r, label: fmtWeekdayShort(r.key) }));

  // Deadlines
  const upcoming = tasks
    .filter((t) => t.status !== "completed")
    .sort((a, b) => a.deadline.localeCompare(b.deadline))
    .slice(0, 6);
  const topGoals = goals
    .filter((x) => x.status !== "completed")
    .sort((a, b) => PRIORITY_META[b.priority].weight - PRIORITY_META[a.priority].weight || a.targetDate.localeCompare(b.targetDate))
    .slice(0, 5);

  return (
    <div className="space-y-5">
      {/* Welcome */}
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-medium text-muted">
            <Icon name={g.icon} size={16} className="text-warning" /> {fmtDateLong(today)}
          </p>
          <h1 className="mt-1.5 text-[1.75rem] leading-tight font-semibold tracking-tight sm:text-4xl">
            {g.text},{" "}
            <span className="bg-gradient-to-r from-highlight to-accent bg-clip-text text-transparent">{settings.name || "Kamu"}</span>
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted sm:text-[15px]">{msg}</p>
        </div>
        <LiveClock />
      </section>
      <QuickActions />

      {/* Motivation + productivity gauge */}
      <div className="grid gap-5 lg:grid-cols-12">
        <QuoteCard className="lg:col-span-8" />
        <Card accent className="flex flex-col p-5 lg:col-span-4">
          <CardHeader title="Produktivitas Hari Ini" subtitle="Tugas jatuh tempo + aktivitas terjadwal" icon="Gauge" action={<Link href="/analytics" className="btn btn-ghost btn-sm">Detail</Link>} />
          <div className="flex flex-1 flex-col items-center justify-center pt-4">
            <SegmentGauge value={score.score ?? 0} size={230}>
              <div className="text-center">
                <div className="tabular text-5xl font-semibold tracking-tight">{score.score ?? 0}%</div>
                <div className="mt-1 text-xs text-muted">{score.total ? `${score.done} dari ${score.total} rencana selesai` : "Belum ada rencana hari ini"}</div>
              </div>
            </SegmentGauge>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 text-center text-xs">
            <div className="surface py-2">
              <div className="tabular text-base font-semibold text-success">{score.done}</div>
              <div className="text-muted">Selesai</div>
            </div>
            <div className="surface py-2">
              <div className="tabular text-base font-semibold text-warning">{Math.max(0, score.total - score.done)}</div>
              <div className="text-muted">Tersisa</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {[
          { label: "Tugas hari ini", value: tToday.length, icon: "ListTodo" as IconName, color: "#60A5FA", sub: "jatuh tempo / selesai hari ini" },
          { label: "Selesai", value: completed, icon: "CircleCheck" as IconName, color: "#22C55E", sub: tToday.length ? `${Math.round((completed / tToday.length) * 100)}% dari tugas hari ini` : "—" },
          { label: "Pending", value: pending, icon: "Hourglass" as IconName, color: "#F59E0B", sub: "belum selesai hari ini" },
          { label: "Terlambat", value: overdueAll.length, icon: "CircleAlert" as IconName, color: "#EF4444", sub: overdueAll.length ? "perlu perhatian" : "aman 👍" },
        ].map((s) => (
          <div key={s.label} className="card card-hover p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted">{s.label}</span>
              <span className="grid size-7 place-items-center rounded-lg" style={{ background: `${s.color}1c`, color: s.color }}>
                <Icon name={s.icon} size={15} />
              </span>
            </div>
            <div className="tabular mt-2 text-3xl font-semibold tracking-tight">{s.value}</div>
            <div className="mt-0.5 truncate text-[11px] text-muted">{s.sub}</div>
          </div>
        ))}
        <div className="card card-hover flex items-center gap-3 p-4">
          <Ring value={score.score ?? 0} size={58} stroke={6}>
            <span className="tabular text-xs font-semibold">{score.score ?? 0}%</span>
          </Ring>
          <div className="min-w-0">
            <div className="text-xs font-medium text-muted">Produktivitas</div>
            <div className="mt-0.5 text-[11px] text-subtle">selesai ÷ rencana</div>
          </div>
        </div>
        <div className="card card-hover p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted">Sisa waktu luang</span>
            <span className="grid size-7 place-items-center rounded-lg bg-accent/15 text-accent">
              <Icon name="Timer" size={15} />
            </span>
          </div>
          <div className="tabular mt-2 text-2xl font-semibold tracking-tight">{durationLabel(freeLeft)}</div>
          <ProgressBar value={(freeLeft / Math.max(1, 1440 - nowMin)) * 100} className="mt-2" height={4} />
          <div className="mt-1 text-[11px] text-muted">belum terjadwal hingga 24:00</div>
        </div>
      </div>

      {/* Schedule + Finance */}
      <div className="grid gap-5 lg:grid-cols-12">
        <Card className="p-5 lg:col-span-7">
          <CardHeader
            title="Jadwal Hari Ini"
            subtitle={`${occ.length} aktivitas · ${occ.filter((o) => o.completed).length} selesai`}
            icon="CalendarClock"
            action={
              <Link href="/schedule" className="btn btn-sm">
                Lihat semua <Icon name="ArrowRight" size={14} />
              </Link>
            }
          />
          {next && (
            <div className="mt-4 flex items-center gap-3 rounded-xl border border-accent/25 bg-accent/[0.07] px-3.5 py-2.5">
              <Icon name="BellRing" size={16} className="shrink-0 text-accent" />
              <p className="min-w-0 truncate text-sm">
                <span className="text-muted">Berikutnya:</span> <span className="font-semibold">{next.schedule.title}</span>
                <span className="text-muted"> · {fmtTime(next.schedule.start)} ({durationLabel(next.startMin - nowMin)} lagi)</span>
              </p>
            </div>
          )}
          <div className="mt-4 max-h-[440px] space-y-1.5 overflow-y-auto pr-1">
            {occ.length === 0 ? (
              <EmptyState icon="CalendarDays" title="Belum ada jadwal hari ini" description="Tambahkan aktivitas untuk mulai menyusun harimu." />
            ) : (
              occ.map((o) => {
                const s = o.schedule;
                const isCur = current?.key === o.key;
                const isNext = next?.key === o.key;
                const past = o.endMin <= nowMin;
                const meta = SCHEDULE_CATEGORY_META[s.category] ?? SCHEDULE_CATEGORY_META.Lainnya;
                return (
                  <div
                    key={o.key}
                    className={cn(
                      "group relative flex items-center gap-3 rounded-xl border px-3 py-2.5 transition",
                      isCur ? "border-primary/50 bg-primary/[0.12] shadow-[0_0_0_3px_rgb(37_99_235/0.12)]" : "border-transparent hover:bg-white/[0.03]",
                      past && !o.completed && !isCur && "opacity-60",
                    )}
                  >
                    <div className="tabular w-[52px] shrink-0 text-right text-xs">
                      <div className={cn("font-semibold", isCur && "text-highlight")}>{fmtTime(s.start)}</div>
                      <div className="text-subtle">{fmtTime(s.end)}</div>
                    </div>
                    <span className="h-9 w-1 shrink-0 rounded-full" style={{ background: meta.color }} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className={cn("truncate text-sm font-medium", o.completed && "text-muted line-through")}>{s.title}</p>
                        <DemoBadge show={s.isDemo} />
                        {isCur && <Pill color="#38BDF8">Sedang berlangsung</Pill>}
                        {isNext && !isCur && <Pill color="#A78BFA">Berikutnya</Pill>}
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted">
                        <span style={{ color: meta.color }}>{s.category}</span>·<span>{durationLabel(o.endMin - o.startMin)}</span>
                        <span className="flex items-center gap-1">
                          · <Dot color={PRIORITY_META[s.priority].color} /> {PRIORITY_META[s.priority].label}
                        </span>
                      </div>
                      {isCur && <ProgressBar value={((nowMin - o.startMin) / (o.endMin - o.startMin)) * 100} className="mt-1.5" height={3} />}
                    </div>
                    <button className="check" data-checked={o.completed} onClick={() => kit.toggleOccurrence(s, today)} aria-label={o.completed ? "Tandai belum selesai" : "Tandai selesai"}>
                      <Icon name="Check" size={12} strokeWidth={3} />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </Card>

        <Card className="flex flex-col p-5 lg:col-span-5">
          <CardHeader
            title="Ringkasan Keuangan"
            subtitle="Hanya transaksi terkonfirmasi"
            icon="Wallet"
            action={
              <Link href="/finance" className="btn btn-sm">
                Detail <Icon name="ArrowRight" size={14} />
              </Link>
            }
          />
          <div className="mt-4 rounded-2xl border border-line bg-gradient-to-br from-primary/20 via-primary/5 to-transparent p-4">
            <p className="text-xs text-muted">Saldo saat ini</p>
            <p className={cn("tabular mt-1 text-3xl font-semibold tracking-tight", fin.balance < 0 && "text-danger")}>{money(fin.balance)}</p>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="surface p-3">
              <p className="flex items-center gap-1 text-[11px] text-muted">
                <Icon name="ArrowDownLeft" size={12} className="text-success" /> Pemasukan hari ini
              </p>
              <p className="tabular mt-0.5 text-sm font-semibold text-success">{money(fin.todayIncome)}</p>
            </div>
            <div className="surface p-3">
              <p className="flex items-center gap-1 text-[11px] text-muted">
                <Icon name="ArrowUpRight" size={12} className="text-danger" /> Pengeluaran hari ini
              </p>
              <p className="tabular mt-0.5 text-sm font-semibold text-danger">{money(fin.todayExpense)}</p>
            </div>
            <div className="surface p-3">
              <p className="text-[11px] text-muted">Sisa anggaran harian</p>
              <p className={cn("tabular mt-0.5 text-sm font-semibold", fin.dailyBudget ? (fin.remainingDaily < 0 ? "text-danger" : "") : "text-muted")}>{fin.dailyBudget ? money(fin.remainingDaily) : "Belum diatur"}</p>
            </div>
            <div className="surface p-3">
              <p className="text-[11px] text-muted">Pengeluaran bulan ini</p>
              <p className="tabular mt-0.5 text-sm font-semibold">{money(fin.monthExpense)}</p>
            </div>
          </div>
          {fin.monthlyBudget > 0 && (
            <div className="mt-3">
              <div className="mb-1 flex justify-between text-[11px] text-muted">
                <span>Anggaran bulanan terpakai</span>
                <span className="tabular">{Math.round((fin.monthExpense / fin.monthlyBudget) * 100)}%</span>
              </div>
              <ProgressBar value={(fin.monthExpense / fin.monthlyBudget) * 100} color={fin.monthExpense > fin.monthlyBudget ? "#EF4444" : fin.monthExpense > fin.monthlyBudget * 0.8 ? "#F59E0B" : undefined} />
            </div>
          )}
          <div className="mt-4">
            <p className="eyebrow mb-1">Pemasukan vs pengeluaran · 7 hari</p>
            <BarChart
              data={ie}
              height={150}
              series={[
                { key: "income", name: "Pemasukan", color: "#22C55E" },
                { key: "expense", name: "Pengeluaran", color: "#3B82F6" },
              ]}
              format={(v) => money(v)}
              yFormat={(v) => moneyShort(v).replace("Rp", "")}
            />
          </div>
        </Card>
      </div>

      {/* Deadlines + Goals */}
      <div className="grid gap-5 lg:grid-cols-12">
        <Card className="p-5 lg:col-span-7">
          <CardHeader
            title="Deadline Terdekat"
            subtitle="Biru: normal · Kuning: mendekati · Merah: mendesak/terlambat"
            icon="Flame"
            action={
              <Link href="/tasks" className="btn btn-sm">
                Semua tugas <Icon name="ArrowRight" size={14} />
              </Link>
            }
          />
          <div className="mt-4 space-y-2">
            {upcoming.length === 0 ? (
              <EmptyState icon="PartyPopper" title="Tidak ada tugas tertunda" description="Semua tugas sudah selesai. Kerja bagus!" />
            ) : (
              upcoming.map((t) => {
                const lvl = deadlineLevel(t, nl);
                const st = displayStatus(t, nl);
                return (
                  <div key={t.id} className="surface flex items-center gap-3 px-3 py-2.5">
                    <button className="check" data-checked={false} onClick={() => kit.toggleTask(t)} aria-label="Tandai selesai">
                      <Icon name="Check" size={12} strokeWidth={3} />
                    </button>
                    <span className="h-8 w-1 shrink-0 rounded-full" style={{ background: LEVEL_COLOR[lvl] }} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium">{t.title}</p>
                        <DemoBadge show={t.isDemo} />
                      </div>
                      <p className="text-[11px] text-muted">
                        {t.category} · <span style={{ color: PRIORITY_META[t.priority].color }}>{PRIORITY_META[t.priority].label}</span>
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="tabular text-xs font-semibold" style={{ color: LEVEL_COLOR[lvl] }}>
                        {st === "overdue" ? "Terlambat" : relativeDeadline(t.deadline, nl)}
                      </p>
                      <p className="tabular text-[11px] text-subtle">
                        {t.deadline.slice(0, 10) === today ? "Hari ini" : t.deadline.slice(0, 10) === addDays(today, 1) ? "Besok" : fmtDateShort(t.deadline.slice(0, 10))}
                        , {fmtTime(t.deadline.slice(11))}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>

        <Card className="p-5 lg:col-span-5">
          <CardHeader
            title="Goals Jangka Panjang"
            subtitle="Impian terpenting & progresnya"
            icon="Mountain"
            action={
              <Link href="/goals" className="btn btn-sm">
                Semua <Icon name="ArrowRight" size={14} />
              </Link>
            }
          />
          <div className="mt-4 space-y-4">
            {topGoals.length === 0 ? (
              <EmptyState icon="Target" title="Belum ada goal" description="Tulis impian besarmu dan pecah menjadi milestone." />
            ) : (
              topGoals.map((goal) => {
                const p = goalProgress(goal);
                const meta = GOAL_CATEGORY_META[goal.category] ?? GOAL_CATEGORY_META.Lainnya;
                const daysLeft = diffDays(goal.targetDate, today);
                return (
                  <div key={goal.id}>
                    <div className="mb-1.5 flex items-center gap-2.5">
                      <span className="grid size-7 shrink-0 place-items-center rounded-lg" style={{ background: `${meta.color}1f`, color: meta.color }}>
                        <Icon name={meta.icon} size={14} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{goal.title}</p>
                        <p className="text-[11px] text-muted">
                          {goal.milestones.filter((m) => m.done).length}/{goal.milestones.length} milestone · {daysLeft >= 0 ? `${daysLeft} hari lagi` : "lewat target"}
                        </p>
                      </div>
                      <span className="tabular text-sm font-semibold">{p}%</span>
                    </div>
                    <ProgressBar value={p} color={`linear-gradient(90deg, ${meta.color}aa, ${meta.color})`} />
                  </div>
                );
              })
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
