"use client";

import * as React from "react";
import type { Priority, Recurrence, Schedule } from "@/lib/types";
import { PRIORITIES, SCHEDULE_CATEGORIES, SCHEDULE_CATEGORY_META } from "@/lib/constants";
import { findConflicts, RECURRENCE_LABEL, suggestAlternatives, type Conflict } from "@/lib/schedule";
import { durationLabel, fmtDateLong, fmtTime, nowLocal, todayKey, toMin } from "@/lib/time";
import { uid } from "@/lib/format";
import { Button, Field, Modal, Select } from "../ui";
import { Icon } from "../icons";
import { useData } from "../providers/DataProvider";
import { useToast } from "../providers/Toast";

const endNorm = (start: string, end: string) => (end === "00:00" && start !== "00:00" ? "24:00" : end);
const endInput = (end: string) => (end === "24:00" ? "00:00" : end);

export function ScheduleForm({ schedule, preset, onClose }: { schedule?: Schedule; preset?: Partial<Schedule>; onClose: () => void }) {
  const { schedules, actions } = useData();
  const { toast } = useToast();
  const base = schedule ?? preset ?? {};
  const [f, setF] = React.useState({
    title: base.title ?? "",
    description: base.description ?? "",
    date: base.date ?? todayKey(),
    start: base.start ?? "09:00",
    end: endInput(base.end ?? "10:00"),
    category: base.category ?? "Akademik",
    priority: (base.priority ?? "medium") as Priority,
    location: base.location ?? "",
    recurrence: (base.recurrence ?? "none") as Recurrence,
    recurrenceUntil: base.recurrenceUntil ?? "",
  });
  const [error, setError] = React.useState<string>();
  const [showConflict, setShowConflict] = React.useState(false);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => {
    setF((x) => ({ ...x, [k]: v }));
    setShowConflict(false);
  };

  const end = endNorm(f.start, f.end);
  const duration = toMin(end) - toMin(f.start);
  const candidate = { id: schedule?.id, date: f.date, start: f.start, end, recurrence: f.recurrence, recurrenceUntil: f.recurrenceUntil || undefined, excludedDates: schedule?.excludedDates };
  const conflicts: Conflict[] = React.useMemo(() => (duration > 0 ? findConflicts(schedules, candidate) : []), [schedules, f.date, f.start, end, f.recurrence, f.recurrenceUntil]); // eslint-disable-line react-hooks/exhaustive-deps
  const suggestions = React.useMemo(
    () => (conflicts.length && duration > 0 ? suggestAlternatives(schedules, f.date, duration, { excludeId: schedule?.id, preferNear: toMin(f.start), max: 4 }) : []),
    [conflicts.length, schedules, f.date, f.start, duration, schedule?.id],
  );

  const save = async (force = false) => {
    if (!f.title.trim()) return setError("Nama aktivitas wajib diisi.");
    if (duration <= 0) return setError("Jam selesai harus setelah jam mulai.");
    if (f.recurrence !== "none" && f.recurrenceUntil && f.recurrenceUntil < f.date) return setError("Tanggal akhir pengulangan harus setelah tanggal mulai.");
    setError(undefined);
    if (conflicts.length && !force) {
      setShowConflict(true);
      return;
    }
    const item: Schedule = {
      ...(schedule ?? {}),
      id: schedule?.id ?? uid("sch-"),
      title: f.title.trim(),
      description: f.description.trim() || undefined,
      date: f.date,
      start: f.start,
      end,
      category: f.category,
      priority: f.priority,
      location: f.location.trim() || undefined,
      recurrence: f.recurrence,
      recurrenceUntil: f.recurrence !== "none" && f.recurrenceUntil ? f.recurrenceUntil : undefined,
      completedDates: schedule?.completedDates ?? [],
      excludedDates: schedule?.excludedDates ?? [],
      taskId: schedule?.taskId ?? preset?.taskId,
      isDemo: schedule?.isDemo,
      createdAt: schedule?.createdAt ?? nowLocal(),
    };
    await actions.upsert("schedules", item);
    if (force && conflicts.length) {
      actions.notify({ type: "conflict", title: "Jadwal disimpan meski bentrok", body: `"${item.title}" bertabrakan dengan ${conflicts.map((c) => c.other.title).join(", ")}.`, href: "/schedule" });
      toast("warning", "Disimpan dengan bentrok", "Kamu memilih menyimpan meskipun ada konflik jadwal.");
    } else toast("success", schedule ? "Jadwal diperbarui" : "Jadwal ditambahkan", `${item.title} · ${fmtTime(item.start)}–${fmtTime(item.end)}`);
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={schedule ? "Edit Jadwal" : "Tambah Jadwal"}
      subtitle={schedule?.recurrence && schedule.recurrence !== "none" ? "Perubahan berlaku untuk seluruh seri berulang" : "Sistem otomatis memeriksa bentrok jadwal"}
      icon="CalendarPlus"
      footer={
        showConflict ? (
          <>
            <Button variant="ghost" onClick={() => setShowConflict(false)}>
              Kembali ubah
            </Button>
            <Button variant="danger" icon="TriangleAlert" onClick={() => save(true)}>
              Tetap simpan
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose}>
              Batal
            </Button>
            <Button variant="primary" icon="Check" onClick={() => save(false)}>
              {schedule ? "Simpan perubahan" : "Simpan jadwal"}
            </Button>
          </>
        )
      }
    >
      {showConflict ? (
        <div className="space-y-4">
          <div className="rounded-2xl border border-danger/40 bg-danger/10 p-4">
            <div className="flex items-center gap-2 text-danger">
              <Icon name="TriangleAlert" size={18} />
              <span className="text-base font-semibold">Schedule Conflict Detected!</span>
            </div>
            <p className="mt-1 text-sm text-muted">Jadwal bentrok terdeteksi. &ldquo;{f.title || "Aktivitas baru"}&rdquo; ({fmtTime(f.start)}–{fmtTime(end)}) tumpang tindih dengan:</p>
          </div>
          <div className="space-y-2">
            {conflicts.map((c) => (
              <div key={c.other.id} className="surface flex items-center gap-3 p-3">
                <span className="h-9 w-1 rounded-full" style={{ background: SCHEDULE_CATEGORY_META[c.other.category]?.color ?? "#94A3B8" }} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{c.other.title}</p>
                  <p className="text-xs text-muted">
                    {fmtTime(c.other.start)}–{fmtTime(c.other.end)} · {fmtDateLong(c.date)}
                    {c.occurrences > 1 && ` · bentrok ${c.occurrences}× dalam 4 minggu`}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] text-muted">Waktu tumpang tindih</p>
                  <p className="tabular text-sm font-semibold text-danger">
                    {fmtTime(c.overlapStart)}–{fmtTime(c.overlapEnd)}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <div>
            <p className="eyebrow mb-2">Saran slot alternatif ({durationLabel(duration)})</p>
            {suggestions.length ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {suggestions.map((s) => (
                  <button
                    key={s.date + s.start}
                    onClick={() => {
                      setF((x) => ({ ...x, date: s.date, start: s.start, end: endInput(s.end), recurrence: x.recurrence }));
                      setShowConflict(false);
                      toast("info", "Slot alternatif dipilih", "Periksa lalu simpan.");
                    }}
                    className="surface flex items-center gap-3 p-3 text-left transition hover:border-highlight/50"
                  >
                    <Icon name="CalendarCheck" size={18} className="text-success" />
                    <div>
                      <p className="tabular text-sm font-semibold">
                        {fmtTime(s.start)}–{fmtTime(s.end)}
                      </p>
                      <p className="text-xs text-muted">{s.date === f.date ? "Hari yang sama" : fmtDateLong(s.date)}</p>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted">Tidak ada slot kosong dengan durasi yang sama dalam 7 hari ke depan.</p>
            )}
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nama aktivitas *" className="sm:col-span-2">
            <input className="input" value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="cth. Rapat Himpunan" autoFocus />
          </Field>
          <Field label="Tanggal">
            <input type="date" className="input" value={f.date} onChange={(e) => set("date", e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Mulai">
              <input type="time" className="input" value={f.start} onChange={(e) => set("start", e.target.value)} />
            </Field>
            <Field label="Selesai" hint={f.end === "00:00" ? "= tengah malam" : undefined}>
              <input type="time" className="input" value={f.end} onChange={(e) => set("end", e.target.value)} />
            </Field>
          </div>
          <Field label="Kategori">
            <Select value={f.category} onChange={(e) => set("category", e.target.value)} options={SCHEDULE_CATEGORIES} />
          </Field>
          <Field label="Prioritas">
            <Select value={f.priority} onChange={(e) => set("priority", e.target.value as Priority)} options={PRIORITIES.map((p) => ({ value: p.value, label: p.label }))} />
          </Field>
          <Field label="Pengulangan">
            <Select value={f.recurrence} onChange={(e) => set("recurrence", e.target.value as Recurrence)} options={Object.entries(RECURRENCE_LABEL).map(([value, label]) => ({ value, label }))} />
          </Field>
          {f.recurrence !== "none" ? (
            <Field label="Berulang sampai (opsional)">
              <input type="date" className="input" value={f.recurrenceUntil} onChange={(e) => set("recurrenceUntil", e.target.value)} />
            </Field>
          ) : (
            <Field label="Lokasi (opsional)">
              <input className="input" value={f.location} onChange={(e) => set("location", e.target.value)} placeholder="cth. Gedung E Lt. 2" />
            </Field>
          )}
          {f.recurrence !== "none" && (
            <Field label="Lokasi (opsional)" className="sm:col-span-2">
              <input className="input" value={f.location} onChange={(e) => set("location", e.target.value)} placeholder="cth. Gedung E Lt. 2" />
            </Field>
          )}
          <Field label="Deskripsi" className="sm:col-span-2">
            <textarea className="input" value={f.description} onChange={(e) => set("description", e.target.value)} placeholder="Catatan singkat aktivitas" rows={3} />
          </Field>
          <div className="sm:col-span-2">
            {duration > 0 && (
              <div className={`flex items-start gap-2 rounded-xl border px-3 py-2.5 text-xs ${conflicts.length ? "border-warning/40 bg-warning/10 text-warning" : "border-success/30 bg-success/10 text-success"}`}>
                <Icon name={conflicts.length ? "TriangleAlert" : "CircleCheck"} size={15} className="mt-px shrink-0" />
                <span>
                  {conflicts.length
                    ? `Bentrok dengan ${conflicts.length} aktivitas (${conflicts.map((c) => c.other.title).slice(0, 2).join(", ")}${conflicts.length > 2 ? ", …" : ""}). Kamu akan diminta konfirmasi saat menyimpan.`
                    : `Durasi ${durationLabel(duration)} · tidak ada bentrok${f.recurrence !== "none" ? " dalam 4 minggu ke depan" : ""}.`}
                </span>
              </div>
            )}
            {error && <p className="mt-2 text-sm text-danger">{error}</p>}
          </div>
        </div>
      )}
    </Modal>
  );
}
