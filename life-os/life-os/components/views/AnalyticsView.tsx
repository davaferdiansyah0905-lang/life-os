"use client";

import * as React from "react";
import { Icon, type IconName } from "../icons";
import { Card, CardHeader, EmptyState, Pill, Ring, SectionTitle } from "../ui";
import { AreaChart, BarChart, HBar } from "../charts";
import { useData } from "../providers/DataProvider";
import { buildInsights, missedByCategory, monthlyComparison, mostProductiveWeekday, rangeScore, spendingByWeekday, taskCompletionRate, WEEKDAY_NAMES } from "@/lib/analytics";
import { categoryBreakdown, confirmed, expenseOf, incomeOf, inRange } from "@/lib/finance";
import { weekStats } from "@/lib/schedule";
import { addDays, addMonths, endOfMonth, fmtDateShort, fmtMonthShort, hoursLabel, rangeKeys, startOfMonth, startOfWeek, todayKey } from "@/lib/time";
import { FINANCE_CATEGORY_META } from "@/lib/constants";
import { cn, money, moneyShort, num } from "@/lib/format";

const TONE: Record<string, { icon: IconName; color: string }> = {
  good: { icon: "TrendingUp", color: "#22C55E" },
  warn: { icon: "TriangleAlert", color: "#F59E0B" },
  bad: { icon: "CircleAlert", color: "#EF4444" },
  info: { icon: "Lightbulb", color: "#38BDF8" },
};

function Metric({ label, value, sub, icon, color = "#60A5FA" }: { label: string; value: React.ReactNode; sub?: React.ReactNode; icon: IconName; color?: string }) {
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted">{label}</span>
        <Icon name={icon} size={16} style={{ color }} />
      </div>
      <div className="tabular mt-2 text-2xl font-semibold tracking-tight">{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-muted">{sub}</div>}
    </div>
  );
}

export function AnalyticsView() {
  const data = useData();
  const { tasks, schedules, transactions, settings } = data;
  const today = todayKey();
  const ws = startOfWeek(today);
  const ms = startOfMonth(today);

  const day = rangeScore(tasks, schedules, today, today);
  const week = rangeScore(tasks, schedules, ws, today);
  const month = rangeScore(tasks, schedules, ms, today);
  const tcr = taskCompletionRate(tasks, ms, endOfMonth(today));
  const wk = weekStats(schedules, ws, settings.activeHoursStart, settings.activeHoursEnd);
  const mp = mostProductiveWeekday(tasks, schedules);
  const missed = missedByCategory(tasks);
  const trend = rangeKeys(addDays(today, -13), today).map((d) => {
    const s = rangeScore(tasks, schedules, d, d);
    return { label: fmtDateShort(d), score: s.score ?? 0 };
  });
  const weekdayData = [1, 2, 3, 4, 5, 6, 0].map((dow) => {
    const v = mp.perWeekday.get(dow);
    return { label: WEEKDAY_NAMES[dow].slice(0, 3), pct: v && v.total ? Math.round((v.done / v.total) * 100) : 0 };
  });

  const months = monthlyComparison(transactions, 6, today);
  const cur = months[months.length - 1];
  // month-to-date vs the same period of last month (fair comparison)
  const lastMs = addMonths(ms, -1);
  const lastSameEnd = addDays(lastMs, Math.min(Number(today.slice(8, 10)), Number(endOfMonth(lastMs).slice(8, 10))) - 1);
  const ctx = confirmed(transactions);
  const prevSame = inRange(ctx, lastMs, lastSameEnd);
  const curMtd = inRange(ctx, ms, today);
  const pInc = incomeOf(prevSame);
  const pExp = expenseOf(prevSame);
  const incomeGrowth = pInc ? ((incomeOf(curMtd) - pInc) / pInc) * 100 : null;
  const expenseGrowth = pExp ? ((expenseOf(curMtd) - pExp) / pExp) * 100 : null;
  const cats = categoryBreakdown(transactions, ms, today);
  const pattern = spendingByWeekday(transactions, addMonths(ms, -2), today);
  const insights = buildInsights(data);

  return (
    <div className="space-y-6">
      <SectionTitle title="Analitik & Evaluasi Diri" subtitle="Pahami bagaimana kamu menggunakan waktu dan uang — semua angka dihitung dari data yang tercatat." />

      <Card accent className="p-5">
        <CardHeader title="Insight Personal" subtitle="Dihasilkan otomatis dari data nyata, bukan statistik karangan" icon="Sparkles" />
        {insights.length === 0 ? (
          <EmptyState icon="Lightbulb" title="Belum cukup data" description="Catat jadwal, tugas, dan transaksi beberapa hari untuk melihat insight." />
        ) : (
          <div className="mt-4 grid gap-2.5 md:grid-cols-2">
            {insights.map((i) => (
              <div key={i.id} className="surface flex items-start gap-3 p-3.5">
                <span className="grid size-8 shrink-0 place-items-center rounded-lg" style={{ background: `${TONE[i.tone].color}1f`, color: TONE[i.tone].color }}>
                  <Icon name={TONE[i.tone].icon} size={16} />
                </span>
                <p className="text-sm leading-relaxed">{i.text}</p>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Productivity */}
      <div>
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
          <Icon name="Gauge" size={18} className="text-highlight" /> Produktivitas
        </h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
          {[
            { l: "Skor harian", s: day },
            { l: "Skor mingguan", s: week },
            { l: "Skor bulanan", s: month },
          ].map((x) => (
            <div key={x.l} className="card flex items-center gap-3 p-4">
              <Ring value={x.s.score ?? 0} size={56} stroke={6}>
                <span className="tabular text-xs font-semibold">{x.s.score ?? "–"}{x.s.score !== null && "%"}</span>
              </Ring>
              <div>
                <p className="text-xs font-medium text-muted">{x.l}</p>
                <p className="tabular text-[11px] text-subtle">
                  {x.s.done}/{x.s.total} rencana
                </p>
              </div>
            </div>
          ))}
          <Metric label="Penyelesaian tugas" value={tcr.pct === null ? "–" : `${tcr.pct}%`} sub={`${tcr.done}/${tcr.due} jatuh tempo bulan ini`} icon="CircleCheck" color="#22C55E" />
          <Metric label="Jam produktif" value={hoursLabel(wk.productiveMin)} sub="minggu ini (terjadwal)" icon="Timer" color="#38BDF8" />
          <Metric label="Hari terproduktif" value={mp.best ? WEEKDAY_NAMES[mp.best.dow] : "–"} sub={mp.best ? `${Math.round(mp.best.pct)}% selesai (4 minggu)` : "data belum cukup"} icon="Trophy" color="#F59E0B" />
          <Metric label="Waktu belum teralokasi" value={`${num(wk.freeMin / 60, 1)} j`} sub="jam aktif minggu ini" icon="Hourglass" color="#A78BFA" />
        </div>
        <div className="mt-4 grid gap-5 xl:grid-cols-3">
          <Card className="p-5 xl:col-span-2">
            <CardHeader title="Tren Skor Produktivitas" subtitle="14 hari terakhir (selesai ÷ rencana)" icon="Activity" />
            <AreaChart className="mt-4" data={trend} series={[{ key: "score", name: "Skor", color: "#38BDF8" }]} format={(v) => `${Math.round(v)}%`} height={230} />
          </Card>
          <Card className="p-5">
            <CardHeader title="Tugas Paling Sering Terlewat" subtitle="Terlambat atau selesai melewati deadline" icon="CircleAlert" />
            <div className="mt-4 space-y-3">
              {missed.list.length === 0 ? (
                <p className="text-sm text-muted">Tidak ada tugas yang terlewat. Pertahankan! 🎯</p>
              ) : (
                <>
                  {missed.list.map((m) => (
                    <HBar key={m.category} label={m.category} value={m.count} max={missed.list[0].count} color="#EF4444" right={`${m.count} tugas`} />
                  ))}
                  <div className="border-t border-line pt-3">
                    {missed.tasks.slice(0, 4).map((t) => (
                      <p key={t.id} className="truncate text-xs text-muted">
                        • {t.title}
                      </p>
                    ))}
                  </div>
                </>
              )}
            </div>
          </Card>
        </div>
        <Card className="mt-5 p-5">
          <CardHeader title="Tingkat Penyelesaian per Hari" subtitle="Rata-rata 4 minggu terakhir" icon="CalendarDays" />
          <BarChart className="mt-4" data={weekdayData} series={[{ key: "pct", name: "Selesai", color: "#2563EB" }]} format={(v) => `${Math.round(v)}%`} height={200} />
        </Card>
      </div>

      {/* Finance */}
      <div>
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
          <Icon name="Wallet" size={18} className="text-highlight" /> Keuangan
        </h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Metric
            label="Pertumbuhan pemasukan"
            value={incomeGrowth === null ? "–" : `${incomeGrowth >= 0 ? "+" : ""}${Math.round(incomeGrowth)}%`}
            sub={`tgl 1–${Number(today.slice(8, 10))} ${fmtMonthShort(ms)} vs periode sama ${fmtMonthShort(lastMs)}`}
            icon="TrendingUp"
            color={incomeGrowth !== null && incomeGrowth < 0 ? "#EF4444" : "#22C55E"}
          />
          <Metric
            label="Perubahan pengeluaran"
            value={expenseGrowth === null ? "–" : `${expenseGrowth >= 0 ? "+" : ""}${Math.round(expenseGrowth)}%`}
            sub="periode sama bulan lalu"
            icon="TrendingDown"
            color={expenseGrowth !== null && expenseGrowth > 0 ? "#F59E0B" : "#22C55E"}
          />
          <Metric label="Rasio tabungan" value={cur.savingsRate === null ? "–" : `${Math.round(cur.savingsRate)}%`} sub={`${money(cur.savings)} bulan ini`} icon="PiggyBank" color="#10B981" />
          <Metric label="Kategori terbesar" value={<span className="text-lg">{cats[0]?.name ?? "–"}</span>} sub={cats[0] ? `${money(cats[0].value)} · ${Math.round(cats[0].pct)}%` : "belum ada data"} icon="ChartPie" color="#F59E0B" />
        </div>
        <div className="mt-4 grid gap-5 xl:grid-cols-3">
          <Card className="p-5 xl:col-span-2">
            <CardHeader title="Tren Pemasukan & Pengeluaran" subtitle="6 bulan terakhir" icon="ChartLine" />
            <AreaChart
              className="mt-4"
              data={months.map((m) => ({ label: `${fmtMonthShort(m.month)} ${m.month.slice(2, 4)}`, income: m.income, expense: m.expense }))}
              series={[
                { key: "income", name: "Pemasukan", color: "#22C55E" },
                { key: "expense", name: "Pengeluaran", color: "#3B82F6" },
              ]}
              format={(v) => money(v)}
              yFormat={(v) => moneyShort(v).replace("Rp", "")}
              height={240}
            />
          </Card>
          <Card className="p-5">
            <CardHeader title="Kategori Pengeluaran Tertinggi" subtitle="Bulan ini" icon="ChartBarBig" />
            <div className="mt-4 space-y-3.5">
              {cats.length === 0 ? (
                <p className="text-sm text-muted">Belum ada pengeluaran bulan ini.</p>
              ) : (
                cats.slice(0, 6).map((c) => <HBar key={c.name} label={c.name} value={c.value} max={cats[0].value} color={(FINANCE_CATEGORY_META[c.name] ?? FINANCE_CATEGORY_META.Lainnya).color} right={`${moneyShort(c.value)} · ${Math.round(c.pct)}%`} />)
              )}
            </div>
          </Card>
        </div>
        <div className="mt-5 grid gap-5 xl:grid-cols-3">
          <Card className="p-5">
            <CardHeader title="Pola Pengeluaran" subtitle="Rata-rata per hari dalam seminggu (3 bulan)" icon="CalendarRange" />
            <BarChart className="mt-4" data={pattern} series={[{ key: "avg", name: "Rata-rata", color: "#38BDF8" }]} format={(v) => money(v)} yFormat={(v) => moneyShort(v).replace("Rp", "")} height={220} />
          </Card>
          <Card className="overflow-hidden p-0 xl:col-span-2">
            <div className="p-5 pb-3">
              <CardHeader title="Perbandingan Bulanan" subtitle="Hanya transaksi terkonfirmasi" icon="Table" />
            </div>
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Bulan</th>
                    <th className="!text-right">Pemasukan</th>
                    <th className="!text-right">Pengeluaran</th>
                    <th className="!text-right">Net</th>
                    <th className="!text-right">Tabungan</th>
                    <th className="!text-right">Rasio</th>
                  </tr>
                </thead>
                <tbody>
                  {[...months].reverse().map((m) => (
                    <tr key={m.key}>
                      <td className="whitespace-nowrap">
                        {fmtMonthShort(m.month)} {m.month.slice(0, 4)} {m.key === today.slice(0, 7) && <Pill color="#38BDF8">berjalan</Pill>}
                      </td>
                      <td className="tabular !text-right text-success">{money(m.income)}</td>
                      <td className="tabular !text-right">{money(m.expense)}</td>
                      <td className={cn("tabular !text-right font-semibold", m.net >= 0 ? "text-highlight" : "text-danger")}>{money(m.net, { sign: true })}</td>
                      <td className="tabular !text-right text-muted">{money(m.savings)}</td>
                      <td className="tabular !text-right text-muted">{m.savingsRate === null ? "–" : `${Math.round(m.savingsRate)}%`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
