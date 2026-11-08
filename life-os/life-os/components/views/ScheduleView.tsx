"use client";

import * as React from "react";
import { Icon } from "../icons";
import { Button, Card, CardHeader, DemoBadge, Dot, Modal, Pill, ProgressBar, SectionTitle, Segmented } from "../ui";
import { useData } from "../providers/DataProvider";
import { useUI } from "../providers/UIProvider";
import { useKit, useNow } from "../hooks";
import { PRIORITY_META, REST_CATEGORY, SCHEDULE_CATEGORY_META } from "@/lib/constants";
import { dayStats, mergeIntervals, occurrencesOn, RECURRENCE_LABEL, weekStats, type Occurrence } from "@/lib/schedule";
import {
  addDays,
  addMonths,
  dayOfWeek,
  durationLabel,
  fmtDateLong,
  fmtDateShort,
  fmtMonthYear,
  fmtTime,
  fmtWeekday,
  fmtWeekdayShort,
  fromMin,
  hoursLabel,
  nowLocal,
  rangeKeys,
  startOfMonth,
  startOfWeek,
  todayKey,
  toMin,
} from "@/lib/time";
import { cn, num } from "@/lib/format";

type View = "day" | "week" | "month";
const catColor = (c: string) => (SCHEDULE_CATEGORY_META[c] ?? SCHEDULE_CATEGORY_META.Lainnya).color;

/** Assign side-by-side columns to overlapping events. */
function layout(occ: Occurrence[]) {
  const res: { o: Occurrence; col: number; cols: number }[] = [];
  let cluster: { o: Occurrence; col: number }[] = [];
  let clusterEnd = -1;
  const flush = () => {
    const cols = Math.max(1, ...cluster.map((c) => c.col + 1));
    for (const c of cluster) res.push({ ...c, cols });
    cluster = [];
  };
  for (const o of occ) {
    if (o.startMin >= clusterEnd && cluster.length) flush();
    const used = new Set(cluster.filter((c) => c.o.endMin > o.startMin).map((c) => c.col));
    let col = 0;
    while (used.has(col)) col++;
    cluster.push({ o, col });
    clusterEnd = Math.max(clusterEnd, o.endMin);
  }
  if (cluster.length) flush();
  return res;
}

function TimeGrid({ dates, hourH, onSlot, onOpen, nowLocalStr }: { dates: string[]; hourH: number; onSlot: (date: string, min: number) => void; onOpen: (o: Occurrence) => void; nowLocalStr: string }) {
  const { schedules } = useData();
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const today = nowLocalStr.slice(0, 10);
  const nowMin = toMin(nowLocalStr.slice(11));
  React.useEffect(() => {
    const target = dates.includes(today) ? Math.max(0, nowMin - 90) : 6 * 60;
    scrollRef.current?.scrollTo({ top: (target / 60) * hourH });
  }, [dates.join(), hourH]); // eslint-disable-line react-hooks/exhaustive-deps
  const multi = dates.length > 1;
  return (
    <div className="overflow-x-auto">
      <div style={{ minWidth: multi ? 760 : undefined }}>
        {multi && (
          <div className="grid border-b border-line" style={{ gridTemplateColumns: `56px repeat(${dates.length}, 1fr)` }}>
            <div />
            {dates.map((d) => (
              <div key={d} className="px-2 py-2.5 text-center">
                <div className="text-[11px] font-medium text-muted uppercase">{fmtWeekdayShort(d)}</div>
                <div className={cn("mx-auto mt-0.5 grid size-8 place-items-center rounded-full text-sm font-semibold", d === today && "bg-primary text-white")}>{Number(d.slice(8))}</div>
              </div>
            ))}
          </div>
        )}
        <div ref={scrollRef} className="relative max-h-[68vh] overflow-y-auto">
          <div className="relative grid" style={{ gridTemplateColumns: `56px repeat(${dates.length}, 1fr)`, height: hourH * 24 }}>
            <div className="relative">
              {Array.from({ length: 24 }, (_, h) => (
                <div key={h} className="tabular absolute right-2 -translate-y-1/2 text-[10.5px] text-subtle" style={{ top: h * hourH }}>
                  {h === 0 ? "" : fmtTime(fromMin(h * 60))}
                </div>
              ))}
            </div>
            {dates.map((d) => {
              const items = layout(occurrencesOn(schedules, d));
              return (
                <div key={d} className={cn("relative border-l border-line", d === today && multi && "bg-primary/[0.03]")}>
                  {Array.from({ length: 24 }, (_, h) => (
                    <button
                      key={h}
                      onClick={() => onSlot(d, h * 60)}
                      className="absolute inset-x-0 border-t border-line/70 transition hover:bg-primary/[0.06]"
                      style={{ top: h * hourH, height: hourH }}
                      aria-label={`Tambah jadwal ${fmtDateShort(d)} ${fromMin(h * 60)}`}
                    />
                  ))}
                  {items.map(({ o, col, cols }) => {
                    const s = o.schedule;
                    const color = catColor(s.category);
                    const top = (o.startMin / 60) * hourH;
                    const h = Math.max(18, ((o.endMin - o.startMin) / 60) * hourH - 2);
                    const isNow = d === today && nowMin >= o.startMin && nowMin < o.endMin;
                    return (
                      <button
                        key={o.key}
                        onClick={() => onOpen(o)}
                        className={cn("absolute overflow-hidden rounded-lg border px-2 py-1 text-left transition hover:z-10 hover:brightness-110", isNow && "ring-2 ring-accent/70")}
                        style={{
                          top: top + 1,
                          height: h,
                          left: `calc(${(col / cols) * 100}% + 3px)`,
                          width: `calc(${100 / cols}% - 6px)`,
                          background: `linear-gradient(180deg, ${color}38, ${color}22)`,
                          borderColor: `${color}66`,
                          opacity: o.completed ? 0.55 : 1,
                        }}
                      >
                        <div className="flex items-center gap-1">
                          {o.completed && <Icon name="CircleCheck" size={11} className="shrink-0 text-success" />}
                          <p className={cn("truncate text-[11.5px] leading-tight font-semibold", o.completed && "line-through")}>{s.title}</p>
                        </div>
                        {h > 30 && (
                          <p className="tabular truncate text-[10.5px] text-fg/70">
                            {fmtTime(s.start)}–{fmtTime(s.end)}
                            {s.location && h > 46 ? ` · ${s.location}` : ""}
                          </p>
                        )}
                      </button>
                    );
                  })}
                  {d === today && (
                    <div className="pointer-events-none absolute inset-x-0 z-20" style={{ top: (nowMin / 60) * hourH }}>
                      <div className="relative h-0.5 bg-danger">
                        <span className="absolute -top-[5px] -left-1 size-3 rounded-full bg-danger" />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function MonthGrid({ cursor, onPick }: { cursor: string; onPick: (d: string) => void }) {
  const { schedules } = useData();
  const today = todayKey();
  const first = startOfMonth(cursor);
  const gridStart = startOfWeek(first);
  const days = rangeKeys(gridStart, addDays(gridStart, 41));
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[640px]">
        <div className="grid grid-cols-7 border-b border-line">
          {["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"].map((d) => (
            <div key={d} className="py-2 text-center text-[11px] font-semibold text-muted uppercase">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((d) => {
            const occ = occurrencesOn(schedules, d).filter((o) => o.schedule.category !== REST_CATEGORY);
            const inMonth = d.slice(0, 7) === cursor.slice(0, 7);
            return (
              <button key={d} onClick={() => onPick(d)} className={cn("min-h-[104px] border-r border-b border-line p-1.5 text-left transition hover:bg-white/[0.03]", !inMonth && "opacity-40")}>
                <div className={cn("mb-1 grid size-6 place-items-center rounded-full text-xs font-semibold", d === today && "bg-primary text-white")}>{Number(d.slice(8))}</div>
                <div className="space-y-0.5">
                  {occ.slice(0, 3).map((o) => (
                    <div key={o.key} className="flex items-center gap-1 truncate rounded px-1 text-[10.5px]" style={{ background: `${catColor(o.schedule.category)}22` }}>
                      <Dot color={catColor(o.schedule.category)} className="!size-1.5" />
                      <span className="truncate">{o.schedule.title}</span>
                    </div>
                  ))}
                  {occ.length > 3 && <div className="px-1 text-[10px] text-muted">+{occ.length - 3} lainnya</div>}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function DayTimeline({ date }: { date: string }) {
  const { schedules } = useData();
  const occ = occurrencesOn(schedules, date);
  const byCat = new Map<string, [number, number][]>();
  for (const o of occ) byCat.set(o.schedule.category, [...(byCat.get(o.schedule.category) ?? []), [o.startMin, o.endMin]]);
  return (
    <div>
      <div className="relative h-7 overflow-hidden rounded-lg bg-white/[0.05]">
        {[...byCat.entries()].flatMap(([cat, iv]) =>
          mergeIntervals(iv).map(([a, b]) => <div key={cat + a} className="absolute inset-y-0" title={`${cat} ${fromMin(a)}–${fromMin(b)}`} style={{ left: `${(a / 1440) * 100}%`, width: `${((b - a) / 1440) * 100}%`, background: catColor(cat), opacity: 0.85 }} />),
        )}
      </div>
      <div className="tabular mt-1 flex justify-between text-[10px] text-subtle">
        {["00", "06", "12", "18", "24"].map((h) => (
          <span key={h}>{h}:00</span>
        ))}
      </div>
    </div>
  );
}

function OccurrenceDetail({ o, onClose }: { o: Occurrence; onClose: () => void }) {
  const { schedules, tasks } = useData();
  const { openModal } = useUI();
  const kit = useKit();
  const s = schedules.find((x) => x.id === o.schedule.id) ?? o.schedule;
  const completed = !!s.completedDates?.includes(o.date);
  const linkedTask = s.taskId ? tasks.find((t) => t.id === s.taskId) : undefined;
  const meta = SCHEDULE_CATEGORY_META[s.category] ?? SCHEDULE_CATEGORY_META.Lainnya;
  return (
    <Modal
      open
      onClose={onClose}
      title={
        <span className="flex items-center gap-2">
          {s.title} <DemoBadge show={s.isDemo} />
        </span>
      }
      subtitle={fmtDateLong(o.date)}
      icon={meta.icon}
      footer={
        <>
          {s.recurrence !== "none" && (
            <Button variant="ghost" size="sm" icon="CalendarX" onClick={async () => (await kit.deleteOccurrence(s, o.date)) && onClose()}>
              Hapus kejadian ini
            </Button>
          )}
          <Button variant="danger" size="sm" icon="Trash2" onClick={async () => (await kit.deleteSeries(s)) && onClose()}>
            {s.recurrence !== "none" ? "Hapus seri" : "Hapus"}
          </Button>
          <Button size="sm" icon="Copy" onClick={() => (onClose(), kit.duplicateSchedule(s, o.date))}>
            Duplikat
          </Button>
          <Button size="sm" icon="Pencil" onClick={() => (onClose(), openModal({ kind: "schedule", schedule: s }))}>
            Edit
          </Button>
          <Button size="sm" variant="primary" icon={completed ? "RotateCcw" : "Check"} onClick={() => kit.toggleOccurrence(s, o.date)}>
            {completed ? "Batalkan selesai" : "Tandai selesai"}
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {[
          { icon: "Clock" as const, label: "Waktu", value: `${fmtTime(s.start)}–${fmtTime(s.end)} (${durationLabel(o.endMin - o.startMin)})` },
          { icon: "Tag" as const, label: "Kategori", value: <span style={{ color: meta.color }}>{s.category}</span> },
          { icon: "Flag" as const, label: "Prioritas", value: <span style={{ color: PRIORITY_META[s.priority].color }}>{PRIORITY_META[s.priority].label}</span> },
          { icon: "Repeat" as const, label: "Pengulangan", value: `${RECURRENCE_LABEL[s.recurrence]}${s.recurrenceUntil ? ` s/d ${fmtDateShort(s.recurrenceUntil)}` : ""}` },
          { icon: "MapPin" as const, label: "Lokasi", value: s.location || "—" },
          { icon: "CircleCheck" as const, label: "Status", value: completed ? <span className="text-success">Selesai</span> : "Belum selesai" },
        ].map((r) => (
          <div key={r.label} className="surface flex items-center gap-3 p-3">
            <Icon name={r.icon} size={16} className="shrink-0 text-muted" />
            <div className="min-w-0">
              <p className="text-[11px] text-muted">{r.label}</p>
              <p className="truncate text-sm font-medium">{r.value}</p>
            </div>
          </div>
        ))}
      </div>
      {s.description && <p className="mt-4 rounded-xl bg-bg2/60 p-3 text-sm text-muted">{s.description}</p>}
      {linkedTask && (
        <p className="mt-3 flex items-center gap-2 text-xs text-muted">
          <Icon name="Link" size={13} /> Terhubung dengan tugas: <span className="font-medium text-fg">{linkedTask.title}</span>
        </p>
      )}
    </Modal>
  );
}

export function ScheduleView() {
  const { schedules, settings } = useData();
  const { openModal, focus, setFocus } = useUI();
  const now = useNow(60_000);
  const nl = nowLocal(now);
  const today = nl.slice(0, 10);
  const [view, setView] = React.useState<View>("day");
  const [cursor, setCursor] = React.useState(today);
  const [detail, setDetail] = React.useState<Occurrence | null>(null);
  const [isMobile, setIsMobile] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const f = () => setIsMobile(mq.matches);
    f();
    mq.addEventListener("change", f);
    return () => mq.removeEventListener("change", f);
  }, []);

  // open a schedule coming from global search
  React.useEffect(() => {
    if (focus?.type !== "schedule") return;
    const s = schedules.find((x) => x.id === focus.id);
    setFocus(null);
    if (!s) return;
    const date = occurrencesOn([s], today).length ? today : s.date;
    setView("day");
    setCursor(date);
    const o = occurrencesOn([s], date)[0];
    if (o) setDetail(o);
  }, [focus]); // eslint-disable-line react-hooks/exhaustive-deps

  // keep the detail modal in sync after edits
  const liveDetail = detail ? occurrencesOn(schedules, detail.date).find((o) => o.schedule.id === detail.schedule.id) ?? null : null;

  const move = (dir: number) => setCursor((c) => (view === "day" ? addDays(c, dir) : view === "week" ? addDays(c, dir * 7) : addMonths(c, dir)));
  const weekStart = startOfWeek(cursor);
  const label = view === "day" ? fmtDateLong(cursor) : view === "week" ? `${fmtDateShort(weekStart)} – ${fmtDateShort(addDays(weekStart, 6))} ${weekStart.slice(0, 4)}` : fmtMonthYear(cursor);

  const ds = dayStats(schedules, cursor, settings.activeHoursStart, settings.activeHoursEnd);
  const ws = weekStats(schedules, weekStart, settings.activeHoursStart, settings.activeHoursEnd);
  const maxDay = Math.max(1, ...ws.perDay.map((d) => d.scheduledMin));
  const dayOcc = occurrencesOn(schedules, cursor);

  const onSlot = (date: string, min: number) => openModal({ kind: "schedule", preset: { date, start: fromMin(min), end: fromMin(Math.min(1440, min + 60)) } });

  return (
    <div>
      <SectionTitle
        title="Jadwal Saya"
        subtitle="Atur aktivitas harian, mingguan & bulanan. Bentrok jadwal terdeteksi otomatis."
        action={
          <Button variant="primary" icon="CalendarPlus" onClick={() => openModal({ kind: "schedule", preset: { date: cursor } })}>
            Tambah Jadwal
          </Button>
        }
      />
      <div className="grid gap-5 xl:grid-cols-12">
        <Card className="overflow-hidden xl:col-span-8 xl:self-start">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
            <div className="flex items-center gap-1.5">
              <Button size="sm" iconOnly icon="ChevronLeft" onClick={() => move(-1)} aria-label="Sebelumnya" />
              <Button size="sm" onClick={() => setCursor(today)}>
                Hari ini
              </Button>
              <Button size="sm" iconOnly icon="ChevronRight" onClick={() => move(1)} aria-label="Berikutnya" />
              <h2 className="ml-2 text-sm font-semibold sm:text-base">{label}</h2>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input type="date" className="input !h-8 !w-auto !text-xs" value={cursor} onChange={(e) => e.target.value && setCursor(e.target.value)} aria-label="Pilih tanggal" />
              <Segmented
                size="sm"
                value={view}
                onChange={setView}
                options={[
                  { value: "day", label: "Harian" },
                  { value: "week", label: "Mingguan" },
                  { value: "month", label: "Bulanan" },
                ]}
              />
            </div>
          </div>
          {view === "day" && <TimeGrid dates={[cursor]} hourH={isMobile ? 52 : 60} onSlot={onSlot} onOpen={setDetail} nowLocalStr={nl} />}
          {view === "week" && <TimeGrid dates={rangeKeys(weekStart, addDays(weekStart, 6))} hourH={48} onSlot={onSlot} onOpen={setDetail} nowLocalStr={nl} />}
          {view === "month" && (
            <MonthGrid
              cursor={cursor}
              onPick={(d) => {
                setCursor(d);
                setView("day");
              }}
            />
          )}
          <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-line px-4 py-3 text-[11px] text-muted">
            {Object.entries(SCHEDULE_CATEGORY_META).map(([k, v]) => (
              <span key={k} className="flex items-center gap-1.5">
                <Dot color={v.color} /> {k}
              </span>
            ))}
            <span className="ml-auto hidden sm:inline">Klik slot kosong untuk menambah jadwal</span>
          </div>
        </Card>

        <div className="space-y-5 xl:col-span-4">
          <Card className="p-5">
            <CardHeader title="Manajemen Waktu Harian" subtitle={fmtDateLong(cursor)} icon="Hourglass" />
            <div className="mt-4 grid grid-cols-2 gap-2">
              {[
                { l: "Total terjadwal", v: hoursLabel(ds.scheduledMin), c: "#60A5FA" },
                { l: "Waktu istirahat", v: hoursLabel(ds.restMin), c: "#94A3B8" },
                { l: `Waktu luang (${settings.activeHoursStart}–${settings.activeHoursEnd})`, v: hoursLabel(ds.freeMin), c: "#22C55E" },
                { l: "Tidak teralokasi (24 jam)", v: hoursLabel(ds.unallocatedMin), c: "#F59E0B" },
              ].map((x) => (
                <div key={x.l} className="surface p-3">
                  <p className="text-[11px] leading-tight text-muted">{x.l}</p>
                  <p className="tabular mt-1 text-lg font-semibold" style={{ color: x.c }}>
                    {x.v}
                  </p>
                </div>
              ))}
            </div>
            <p className="eyebrow mt-5 mb-2">Timeline 24 jam</p>
            <DayTimeline date={cursor} />
            <div className="mt-4 space-y-1.5">
              {dayOcc.length === 0 ? (
                <p className="text-sm text-muted">Tidak ada aktivitas pada tanggal ini.</p>
              ) : (
                dayOcc.map((o) => (
                  <button key={o.key} onClick={() => setDetail(o)} className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-white/[0.04]">
                    <span className="tabular w-11 shrink-0 text-xs text-muted">{fmtTime(o.schedule.start)}</span>
                    <Dot color={catColor(o.schedule.category)} />
                    <span className={cn("min-w-0 flex-1 truncate", o.completed && "text-muted line-through")}>{o.schedule.title}</span>
                    {o.completed && <Icon name="CircleCheck" size={14} className="text-success" />}
                  </button>
                ))
              )}
            </div>
          </Card>

          <Card className="p-5">
            <CardHeader title="Evaluasi Mingguan" subtitle={`${fmtDateShort(ws.from)} – ${fmtDateShort(ws.to)}`} icon="ChartColumn" />
            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="surface p-3">
                <p className="text-[11px] text-muted">Aktivitas terjadwal</p>
                <p className="tabular mt-1 text-lg font-semibold">{ws.count}</p>
              </div>
              <div className="surface p-3">
                <p className="text-[11px] text-muted">Jam produktif</p>
                <p className="tabular mt-1 text-lg font-semibold text-highlight">{hoursLabel(ws.productiveMin)}</p>
              </div>
              <div className="surface p-3">
                <p className="text-[11px] text-muted">Hari paling aktif</p>
                <p className="mt-1 text-sm font-semibold">{ws.mostActiveDay ? fmtWeekday(ws.mostActiveDay.date) : "—"}</p>
                {ws.mostActiveDay && <p className="tabular text-[11px] text-muted">{hoursLabel(ws.mostActiveDay.minutes)}</p>}
              </div>
              <div className="surface p-3">
                <p className="text-[11px] text-muted">Waktu belum terpakai</p>
                <p className="tabular mt-1 text-lg font-semibold text-warning">{num(ws.freeMin / 60, 1)} jam</p>
              </div>
            </div>
            <div className="mt-4">
              <div className="mb-1 flex justify-between text-xs">
                <span className="text-muted">Penyelesaian jadwal (yang sudah lewat)</span>
                <span className="tabular font-semibold">
                  {ws.completionPct}% <span className="font-normal text-muted">({ws.completedCount}/{ws.dueCount})</span>
                </span>
              </div>
              <ProgressBar value={ws.completionPct} color={ws.completionPct >= 75 ? "#22C55E" : ws.completionPct >= 50 ? "#F59E0B" : "#EF4444"} />
            </div>
            <div className="mt-5 flex items-end gap-2">
              {ws.perDay.map((d) => (
                <button key={d.date} onClick={() => (setCursor(d.date), setView("day"))} className="group flex flex-1 flex-col items-center gap-1" title={`${fmtWeekday(d.date)}: ${hoursLabel(d.scheduledMin)}`}>
                  <div className="relative h-20 w-full">
                    <div
                      className={cn("absolute inset-x-0 bottom-0 rounded-md transition group-hover:brightness-125", d.date === today ? "bg-gradient-to-t from-primary to-accent" : "bg-primary/45")}
                      style={{ height: `${Math.max(4, (d.scheduledMin / maxDay) * 100)}%` }}
                    />
                  </div>
                  <span className={cn("text-[10px]", d.date === cursor ? "font-semibold text-fg" : "text-muted")}>{fmtWeekdayShort(d.date)}</span>
                </button>
              ))}
            </div>
            {dayOfWeek(today) === 0 && <Pill color="#38BDF8" className="mt-3">Hari Minggu — waktu yang tepat untuk evaluasi mingguan</Pill>}
          </Card>
        </div>
      </div>
      {liveDetail && <OccurrenceDetail o={liveDetail} onClose={() => setDetail(null)} />}
    </div>
  );
}
