// PERSONAL AI — local, data-grounded engine (used when no LLM API key is configured,
// and as the structured context sent to the LLM when one is).

import type { AppData, Schedule } from "./types";
import { PRIORITY_META } from "./constants";
import { categoryBreakdown, confirmed, expenseOf, incomeOf, inRange, summarize } from "./finance";
import { findConflicts, occurrencesOn, overlaps, suggestAlternatives } from "./schedule";
import { displayStatus, isOverdue, taskProgress, urgencyScore } from "./tasks";
import {
  addDays,
  addMonths,
  dayOfWeek,
  diffDays,
  endOfMonth,
  fmtDateLong,
  fmtTime,
  fromMin,
  nowLocal,
  relativeDeadline,
  startOfMonth,
  startOfWeek,
  todayKey,
  toMin,
} from "./time";
import { money } from "./format";

export interface ProposedSchedule {
  title: string;
  date: string;
  start: string;
  end: string;
  category: string;
  description?: string;
}

export interface AssistantReply {
  text: string;
  proposal?: ProposedSchedule;
  engine: "local" | "llm";
}

const DAY_WORDS: Record<string, number> = { minggu: 0, senin: 1, selasa: 2, rabu: 3, kamis: 4, jumat: 5, "jum'at": 5, sabtu: 6 };

export function resolveDay(q: string, today = todayKey()): { date: string; label: string } {
  const s = q.toLowerCase();
  if (/lusa/.test(s)) return { date: addDays(today, 2), label: "lusa" };
  if (/besok/.test(s)) return { date: addDays(today, 1), label: "besok" };
  if (/kemarin/.test(s)) return { date: addDays(today, -1), label: "kemarin" };
  for (const [w, dow] of Object.entries(DAY_WORDS)) {
    // "minggu" alone is ambiguous with "minggu ini" (this week) → require "hari minggu"
    if (w === "minggu" ? /hari minggu/.test(s) : new RegExp(`\\b${w}\\b`).test(s)) {
      let d = today;
      for (let i = 0; i < 7; i++) {
        if (dayOfWeek(d) === dow) break;
        d = addDays(d, 1);
      }
      return { date: d, label: `hari ${w[0].toUpperCase()}${w.slice(1)}` };
    }
  }
  return { date: today, label: "hari ini" };
}

function periodOf(q: string, today = todayKey()) {
  const s = q.toLowerCase();
  if (/bulan lalu/.test(s)) {
    const m = addMonths(startOfMonth(today), -1);
    return { from: m, to: endOfMonth(m), label: "bulan lalu" };
  }
  if (/bulan ini|sebulan/.test(s)) return { from: startOfMonth(today), to: today, label: "bulan ini" };
  if (/minggu lalu|pekan lalu/.test(s)) {
    const ws = addDays(startOfWeek(today), -7);
    return { from: ws, to: addDays(ws, 6), label: "minggu lalu" };
  }
  if (/minggu ini|pekan ini|seminggu/.test(s)) return { from: startOfWeek(today), to: today, label: "minggu ini" };
  if (/kemarin/.test(s)) return { from: addDays(today, -1), to: addDays(today, -1), label: "kemarin" };
  if (/tahun ini/.test(s)) return { from: today.slice(0, 4) + "-01-01", to: today, label: "tahun ini" };
  return { from: today, to: today, label: "hari ini" };
}

const bullet = (lines: string[]) => lines.map((l) => `• ${l}`).join("\n");

export function localAnswer(question: string, data: AppData): AssistantReply {
  const q = question.toLowerCase().trim();
  const today = todayKey();
  const now = nowLocal();
  const reply = (text: string, proposal?: ProposedSchedule): AssistantReply => ({ text, proposal, engine: "local" });

  // 1) Create a study / work block: "buatkan jadwal belajar 2 jam besok"
  if (/(buat(kan)?|jadwalkan|atur(kan)?|tambahkan)\b.*\b(jadwal|sesi|waktu)/.test(q) || /^jadwalkan/.test(q)) {
    const { date, label } = resolveDay(q, today);
    const h = q.match(/(\d+(?:[.,]\d+)?)\s*jam/);
    const m = q.match(/(\d+)\s*menit/);
    const minutes = Math.round((h ? parseFloat(h[1].replace(",", ".")) * 60 : 0) + (m ? Number(m[1]) : 0)) || 60;
    const topicMatch = q.match(/jadwal\s+([a-z\s]+?)\s+(?:selama|untuk|\d|besok|lusa|hari|pada|$)/);
    const topic = topicMatch?.[1]?.trim() || "belajar";
    const title = topic.charAt(0).toUpperCase() + topic.slice(1);
    const preferNear = /pagi/.test(q) ? toMin("08:00") : /siang/.test(q) ? toMin("13:00") : /sore/.test(q) ? toMin("16:00") : /malam/.test(q) ? toMin("19:30") : undefined;
    const slots = suggestAlternatives(data.schedules, date, minutes, { preferNear, max: 3 });
    const sameDay = slots.filter((s) => s.date === date);
    if (!sameDay.length) {
      const alt = slots[0];
      return reply(
        `Tidak ada slot kosong ${Math.round(minutes / 6) / 10} jam pada ${label} (${fmtDateLong(date)}) di antara 06:00–23:00.` +
          (alt ? `\nSlot terdekat yang tersedia: ${fmtDateLong(alt.date)}, ${fmtTime(alt.start)}–${fmtTime(alt.end)}.` : ""),
        alt ? { title: `${title} (${minutes} menit)`, date: alt.date, start: alt.start, end: alt.end, category: "Akademik", description: "Dibuat oleh Personal AI" } : undefined,
      );
    }
    const s = sameDay[0];
    return reply(
      `Saya menemukan slot kosong untuk ${title.toLowerCase()} selama ${minutes} menit pada ${label} (${fmtDateLong(date)}):\n` +
        `🕒 ${fmtTime(s.start)}–${fmtTime(s.end)} — tidak bertabrakan dengan jadwal lain.\n` +
        (sameDay.length > 1 ? `Alternatif: ${sameDay.slice(1).map((x) => `${fmtTime(x.start)}–${fmtTime(x.end)}`).join(", ")}.\n` : "") +
        `Tekan "Tambahkan ke Jadwal" untuk menyimpan.`,
      { title, date: s.date, start: s.start, end: s.end, category: "Akademik", description: "Dibuat oleh Personal AI" },
    );
  }

  // 2) Conflicts
  if (/(tabrak|bentrok|konflik|overlap|tumpang)/.test(q)) {
    const { date, label } = resolveDay(q, today);
    const occ = occurrencesOn(data.schedules, date);
    const pairs: string[] = [];
    for (let i = 0; i < occ.length; i++)
      for (let j = i + 1; j < occ.length; j++)
        if (overlaps(occ[i].startMin, occ[i].endMin, occ[j].startMin, occ[j].endMin))
          pairs.push(
            `${occ[i].schedule.title} (${fmtTime(occ[i].schedule.start)}–${fmtTime(occ[i].schedule.end)}) ↔ ${occ[j].schedule.title} (${fmtTime(occ[j].schedule.start)}–${fmtTime(occ[j].schedule.end)}), tumpang tindih ${fromMin(Math.max(occ[i].startMin, occ[j].startMin))}–${fromMin(Math.min(occ[i].endMin, occ[j].endMin))}`,
          );
    if (!occ.length) return reply(`Belum ada jadwal tercatat untuk ${label} (${fmtDateLong(date)}).`);
    return reply(pairs.length ? `Ada ${pairs.length} jadwal yang bertabrakan pada ${label}:\n${bullet(pairs)}` : `Tidak ada jadwal yang bertabrakan pada ${label} (${fmtDateLong(date)}). ${occ.length} aktivitas tersusun rapi. ✅`);
  }

  // 3) Spending / expenses
  if (/(pengeluaran|belanja|habis|keluar|spend)/.test(q) && !/kategori/.test(q)) {
    const p = periodOf(q, today);
    const tx = inRange(confirmed(data.transactions), p.from, p.to);
    const exp = expenseOf(tx);
    const count = tx.filter((t) => t.type === "expense").length;
    const top = categoryBreakdown(data.transactions, p.from, p.to).slice(0, 3);
    if (!count) return reply(`Belum ada pengeluaran tercatat untuk ${p.label}.`);
    return reply(
      `Total pengeluaranmu ${p.label}: ${money(exp)} dari ${count} transaksi.\n` +
        (top.length ? `Terbesar:\n${bullet(top.map((c) => `${c.name}: ${money(c.value)} (${Math.round(c.pct)}%)`))}` : ""),
    );
  }

  // 4) Biggest category
  if (/kategori/.test(q) && /(terbesar|paling|tertinggi|banyak)/.test(q)) {
    const p = /minggu/.test(q) || /hari ini/.test(q) || /bulan lalu/.test(q) ? periodOf(q, today) : { from: startOfMonth(today), to: today, label: "bulan ini" };
    const cats = categoryBreakdown(data.transactions, p.from, p.to);
    if (!cats.length) return reply(`Belum ada pengeluaran tercatat untuk ${p.label}.`);
    const c = cats[0];
    return reply(`Kategori pengeluaran terbesar ${p.label} adalah **${c.name}**: ${money(c.value)} (${Math.round(c.pct)}% dari total, ${c.count} transaksi).` + (cats[1] ? `\nDisusul ${cats[1].name} (${money(cats[1].value)}).` : ""));
  }

  // 5) Income / balance
  if (/(saldo|uang saya|sisa uang|balance)/.test(q)) {
    const s = summarize(data.transactions, data.settings, today);
    return reply(
      `Saldo saat ini: ${money(s.balance)}.\n` +
        bullet([`Pemasukan bulan ini: ${money(s.monthIncome)}`, `Pengeluaran bulan ini: ${money(s.monthExpense)}`, data.settings.monthlyBudget ? `Sisa anggaran bulanan: ${money(s.remainingBudget)}` : "Anggaran bulanan belum diatur"]),
    );
  }
  if (/(pemasukan|pendapatan|income)/.test(q)) {
    const p = periodOf(q, today);
    const inc = incomeOf(inRange(confirmed(data.transactions), p.from, p.to));
    return reply(`Total pemasukan ${p.label}: ${money(inc)}.`);
  }

  // 6) Urgent tasks
  if (/tugas|task|to-?do|deadline/.test(q) && !/target|goal/.test(q)) {
    const open = data.tasks.filter((t) => t.status !== "completed");
    if (!open.length) return reply("Semua tugas sudah selesai. Kerja bagus! 🎉");
    const ranked = [...open].sort((a, b) => urgencyScore(b, now) - urgencyScore(a, now)).slice(0, 5);
    return reply(
      `Tugas yang perlu segera kamu selesaikan (diurutkan dari deadline, prioritas & progres):\n` +
        bullet(
          ranked.map(
            (t) =>
              `${t.title} — ${PRIORITY_META[t.priority].label}, deadline ${relativeDeadline(t.deadline, now)}${isOverdue(t, now) ? " ⚠️" : ""}, progres ${taskProgress(t)}%`,
          ),
        ),
    );
  }

  // 7) Goals on track?
  if (/(target|goal|impian|cita)/.test(q)) {
    const active = data.goals.filter((g) => g.status === "active");
    if (!active.length) return reply("Belum ada goal aktif yang tercatat.");
    const lines = active.map((g) => {
      const total = Math.max(1, diffDays(g.targetDate, g.startDate));
      const elapsed = Math.min(total, Math.max(0, diffDays(today, g.startDate)));
      const expected = Math.round((elapsed / total) * 100);
      const actual = g.progressMode === "auto" && g.milestones.length ? Math.round((g.milestones.filter((m) => m.done).length / g.milestones.length) * 100) : g.progress;
      const daysLeft = diffDays(g.targetDate, today);
      const status = daysLeft < 0 ? "melewati target tanggal" : actual >= expected ? "sesuai jalur ✅" : actual >= expected - 15 ? "sedikit tertinggal" : "tertinggal ⚠️";
      return `${g.title}: progres ${actual}% vs seharusnya ±${expected}% → ${status} (${daysLeft >= 0 ? `${daysLeft} hari lagi` : `${-daysLeft} hari lewat`})`;
    });
    return reply(`Evaluasi goal berdasarkan progres milestone vs waktu yang sudah berjalan:\n${bullet(lines)}`);
  }

  // 8) Activities for a day
  if (/(kegiatan|jadwal|agenda|acara|aktivitas|ngapain)/.test(q)) {
    const { date, label } = resolveDay(q, today);
    const occ = occurrencesOn(data.schedules, date);
    const due = data.tasks.filter((t) => t.deadline.slice(0, 10) === date && t.status !== "completed");
    if (!occ.length && !due.length) return reply(`Tidak ada kegiatan tercatat untuk ${label} (${fmtDateLong(date)}).`);
    return reply(
      `Kegiatanmu ${label} (${fmtDateLong(date)}):\n` +
        bullet(occ.map((o) => `${fmtTime(o.schedule.start)}–${fmtTime(o.schedule.end)} ${o.schedule.title}${o.completed ? " ✓" : ""}`)) +
        (due.length ? `\n\nTugas jatuh tempo:\n${bullet(due.map((t) => `${t.title} (${fmtTime(t.deadline.slice(11))}, ${displayStatus(t, now) === "overdue" ? "terlambat" : "belum selesai"})`))}` : ""),
    );
  }

  return reply(
    "Saya bisa menjawab berdasarkan data di aplikasi ini. Coba tanyakan:\n" +
      bullet([
        "Apa saja kegiatan saya hari ini?",
        "Apakah ada jadwal yang bertabrakan besok?",
        "Berapa pengeluaran saya minggu ini?",
        "Kategori pengeluaran terbesar bulan ini apa?",
        "Buatkan jadwal belajar selama 2 jam besok",
        "Tugas apa yang harus segera saya selesaikan?",
        "Apakah target saya masih sesuai dengan deadline?",
      ]),
  );
}

/** Compact, privacy-conscious snapshot sent to the server-side LLM. */
export function buildContext(data: AppData) {
  const today = todayKey();
  const now = nowLocal();
  const dayList = (d: string) => occurrencesOn(data.schedules, d).map((o) => ({ start: o.schedule.start, end: o.schedule.end, title: o.schedule.title, category: o.schedule.category, done: o.completed }));
  const s = summarize(data.transactions, data.settings, today);
  const ws = startOfWeek(today);
  return {
    now,
    timezone: data.settings.timezone,
    user: data.settings.name,
    schedule: { today: dayList(today), tomorrow: dayList(addDays(today, 1)), dayAfter: dayList(addDays(today, 2)) },
    tasks: data.tasks
      .filter((t) => t.status !== "completed" || (t.completedAt ?? "") >= addDays(today, -7))
      .slice(0, 40)
      .map((t) => ({ title: t.title, deadline: t.deadline, priority: t.priority, status: displayStatus(t, now), progress: taskProgress(t), category: t.category, estimatedMinutes: t.estimatedMinutes })),
    finance: {
      currency: data.settings.currency,
      balance: s.balance,
      today: { income: s.todayIncome, expense: s.todayExpense },
      thisWeek: { expense: expenseOf(inRange(confirmed(data.transactions), ws, today)), categories: categoryBreakdown(data.transactions, ws, today).slice(0, 6) },
      thisMonth: { income: s.monthIncome, expense: s.monthExpense, budget: data.settings.monthlyBudget, remainingBudget: s.remainingBudget, categories: categoryBreakdown(data.transactions, startOfMonth(today), today).slice(0, 8) },
      lastMonth: (() => {
        const m = addMonths(startOfMonth(today), -1);
        return { categories: categoryBreakdown(data.transactions, m, endOfMonth(m)).slice(0, 6) };
      })(),
    },
    goals: data.goals.map((g) => ({
      title: g.title,
      targetDate: g.targetDate,
      startDate: g.startDate,
      status: g.status,
      progress: g.progressMode === "auto" && g.milestones.length ? Math.round((g.milestones.filter((m) => m.done).length / g.milestones.length) * 100) : g.progress,
      milestonesDone: g.milestones.filter((m) => m.done).length,
      milestonesTotal: g.milestones.length,
    })),
  };
}

export function validateProposal(p: ProposedSchedule | undefined, schedules: Schedule[]) {
  if (!p) return { ok: false as const, reason: "Tidak ada usulan" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(p.date) || !/^\d{2}:\d{2}$/.test(p.start) || !/^\d{2}:\d{2}$/.test(p.end) || toMin(p.end) <= toMin(p.start))
    return { ok: false as const, reason: "Format waktu usulan tidak valid" };
  const conflicts = findConflicts(schedules, { date: p.date, start: p.start, end: p.end, recurrence: "none" });
  return { ok: conflicts.length === 0, conflicts, reason: conflicts.length ? "Usulan bertabrakan dengan jadwal lain" : "" };
}
