"use client";

import * as React from "react";
import type { Transaction } from "@/lib/types";
import { Icon, type IconName } from "../icons";
import { Button, Card, CardHeader, DemoBadge, EmptyState, Field, Pill, ProgressBar, SectionTitle, Segmented, Select } from "../ui";
import { AreaChart, BarChart, DonutChart, HBar, Sparkline } from "../charts";
import { useData } from "../providers/DataProvider";
import { useUI } from "../providers/UIProvider";
import { useToast } from "../providers/Toast";
import { AgentPanel } from "./FinanceAgent";
import { EXPENSE_CATEGORIES, FINANCE_CATEGORY_META, INCOME_SOURCES, SAVINGS_CATEGORY } from "@/lib/constants";
import { budgetStatus, categoryBreakdown, confirmed, expenseOf, incomeExpenseSeries, incomeOf, inRange, makeBuckets, runningBalances, savingsGrowth, summarize, type Granularity } from "@/lib/finance";
import { transactionsToCSV, downloadText } from "@/lib/csv";
import { addDays, addMonths, diffDays, fmtDate, fmtDateShort, rangeKeys, startOfMonth, startOfWeek, startOfYear, todayKey } from "@/lib/time";
import { cn, money, moneyShort, parseAmountInput } from "@/lib/format";

type Tab = "overview" | "transactions" | "budget" | "agent";
type Preset = "daily" | "weekly" | "monthly" | "yearly" | "custom";

const catMeta = (c: string) => FINANCE_CATEGORY_META[c] ?? FINANCE_CATEGORY_META.Lainnya;
const ORIGIN_LABEL: Record<string, string> = { manual: "Manual", csv: "CSV", notification: "Notifikasi", android: "Android", simulation: "SIMULASI", assistant: "AI" };

function rangeFor(p: Preset, today: string, custom: { from: string; to: string }): { from: string; to: string; gran: Granularity; label: string } {
  switch (p) {
    case "daily":
      return { from: addDays(today, -13), to: today, gran: "day", label: "14 hari terakhir" };
    case "weekly":
      return { from: addDays(startOfWeek(today), -7 * 11), to: today, gran: "week", label: "12 minggu terakhir" };
    case "monthly":
      return { from: addMonths(startOfMonth(today), -5), to: today, gran: "month", label: "6 bulan terakhir" };
    case "yearly":
      return { from: startOfYear(today), to: today, gran: "month", label: `Tahun ${today.slice(0, 4)}` };
    default: {
      const from = custom.from <= custom.to ? custom.from : custom.to;
      const to = custom.from <= custom.to ? custom.to : custom.from;
      const span = diffDays(to, from) + 1;
      return { from, to, gran: span <= 45 ? "day" : span <= 120 ? "week" : "month", label: `${fmtDate(from)} – ${fmtDate(to)}` };
    }
  }
}

function SummaryCards() {
  const { transactions, settings } = useData();
  const today = todayKey();
  const s = summarize(transactions, settings, today);
  const last30 = rangeKeys(addDays(today, -29), today);
  const tx = confirmed(transactions);
  const dailyInc = last30.map((d) => incomeOf(inRange(tx, d, d)));
  const dailyExp = last30.map((d) => expenseOf(inRange(tx, d, d)));
  let bal = s.balance - dailyInc.reduce((a, b) => a + b, 0) + dailyExp.reduce((a, b) => a + b, 0);
  const balSeries = last30.map((_, i) => (bal += dailyInc[i] - dailyExp[i]));
  const cards: { l: string; v: number; i: IconName; c: string; sub: string; spark?: number[]; neg?: boolean }[] = [
    { l: "Saldo tersedia", v: s.balance, i: "Wallet", c: "#60A5FA", sub: `Saldo awal ${moneyShort(settings.initialBalance)} + pemasukan − pengeluaran`, spark: balSeries },
    { l: "Total pemasukan", v: s.totalIncome, i: "ArrowDownLeft", c: "#22C55E", sub: `Bulan ini ${moneyShort(s.monthIncome)}`, spark: dailyInc },
    { l: "Total pengeluaran", v: s.totalExpense, i: "ArrowUpRight", c: "#EF4444", sub: `Bulan ini ${moneyShort(s.monthExpense)}`, spark: dailyExp },
    { l: "Arus kas bersih", v: s.netCashFlow, i: "ArrowLeftRight", c: s.netCashFlow >= 0 ? "#22C55E" : "#EF4444", sub: "Pemasukan − pengeluaran", neg: s.netCashFlow < 0 },
    { l: "Anggaran bulanan", v: s.monthlyBudget, i: "Target", c: "#A78BFA", sub: s.monthlyBudget ? `Terpakai ${Math.round((s.monthExpense / s.monthlyBudget) * 100)}%` : "Atur di tab Anggaran" },
    { l: "Sisa anggaran", v: s.remainingBudget, i: "PiggyBank", c: s.remainingBudget < 0 ? "#EF4444" : "#38BDF8", sub: "Anggaran − pengeluaran bulan ini", neg: s.remainingBudget < 0 },
    { l: "Total tabungan", v: s.totalSavings, i: "Landmark", c: "#10B981", sub: `Kategori "${SAVINGS_CATEGORY}"` },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
      {cards.map((c, idx) => (
        <div key={c.l} className={cn("card card-hover flex flex-col p-4", idx === 0 && "col-span-2 md:col-span-2 xl:col-span-1 bg-gradient-to-br from-primary/20 to-transparent")}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted">{c.l}</span>
            <span className="grid size-7 place-items-center rounded-lg" style={{ background: `${c.c}1c`, color: c.c }}>
              <Icon name={c.i} size={15} />
            </span>
          </div>
          <p className={cn("tabular mt-2 text-lg font-semibold tracking-tight xl:text-[1.05rem] 2xl:text-lg", c.neg && "text-danger")}>{money(c.v)}</p>
          <p className="mt-0.5 line-clamp-2 text-[11px] text-muted">{c.sub}</p>
          {c.spark && <Sparkline values={c.spark} color={c.c} height={30} className="mt-auto pt-2" />}
        </div>
      ))}
    </div>
  );
}

function OverviewTab() {
  const { transactions, settings } = useData();
  const today = todayKey();
  const [preset, setPreset] = React.useState<Preset>("monthly");
  const [custom, setCustom] = React.useState({ from: addDays(today, -29), to: today });
  const r = rangeFor(preset, today, custom);
  const buckets = makeBuckets(r.from, r.to, r.gran);
  const ie = incomeExpenseSeries(transactions, buckets);
  const tx = inRange(confirmed(transactions), r.from, r.to);
  const inc = incomeOf(tx);
  const exp = expenseOf(tx);
  const trendFrom = diffDays(r.to, r.from) > 89 ? addDays(r.to, -89) : r.from;
  const daily = makeBuckets(trendFrom, r.to, "day").map((b) => ({ label: b.label, value: expenseOf(inRange(tx, b.from, b.to)) }));
  const cats = categoryBreakdown(transactions, r.from, r.to);
  const months = Math.max(3, Math.min(12, Math.round(diffDays(r.to, r.from) / 30) + 1));
  const sav = savingsGrowth(transactions, months, today);
  const budgets = budgetStatus(transactions, settings, today);
  const fmt = (v: number) => money(v);
  const yfmt = (v: number) => moneyShort(v).replace("Rp", "");

  return (
    <div className="space-y-5">
      <SummaryCards />
      <Card className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            size="sm"
            value={preset}
            onChange={setPreset}
            options={[
              { value: "daily", label: "Harian" },
              { value: "weekly", label: "Mingguan" },
              { value: "monthly", label: "Bulanan" },
              { value: "yearly", label: "Tahunan" },
              { value: "custom", label: "Kustom" },
            ]}
          />
          {preset === "custom" && (
            <div className="flex items-center gap-1.5">
              <input type="date" className="input !h-8 !w-auto !text-xs" value={custom.from} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value || c.from }))} aria-label="Dari tanggal" />
              <span className="text-xs text-muted">–</span>
              <input type="date" className="input !h-8 !w-auto !text-xs" value={custom.to} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value || c.to }))} aria-label="Sampai tanggal" />
            </div>
          )}
        </div>
        <div className="tabular flex flex-wrap gap-x-4 gap-y-1 px-1 text-xs">
          <span className="text-muted">{r.label}:</span>
          <span className="text-success">+{money(inc)}</span>
          <span className="text-danger">−{money(exp)}</span>
          <span className={inc - exp >= 0 ? "text-highlight" : "text-danger"}>Net {money(inc - exp, { sign: true })}</span>
        </div>
      </Card>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card className="p-5">
          <CardHeader title="Pemasukan vs Pengeluaran" subtitle={`Per ${r.gran === "day" ? "hari" : r.gran === "week" ? "minggu" : "bulan"} · ${r.label}`} icon="ChartColumn" />
          <BarChart
            className="mt-4"
            data={ie}
            series={[
              { key: "income", name: "Pemasukan", color: "#22C55E" },
              { key: "expense", name: "Pengeluaran", color: "#3B82F6" },
            ]}
            format={fmt}
            yFormat={yfmt}
            height={240}
          />
        </Card>
        <Card className="p-5">
          <CardHeader title="Tren Pengeluaran Harian" subtitle={trendFrom !== r.from ? "90 hari terakhir dari rentang" : r.label} icon="TrendingUp" />
          <AreaChart className="mt-4" data={daily} series={[{ key: "value", name: "Pengeluaran", color: "#38BDF8" }]} format={fmt} yFormat={yfmt} height={240} />
        </Card>
        <Card className="p-5">
          <CardHeader title="Distribusi Pengeluaran per Kategori" subtitle={r.label} icon="ChartPie" />
          {cats.length === 0 ? (
            <EmptyState icon="ChartPie" title="Belum ada pengeluaran" description="Pengeluaran pada rentang ini akan tampil di sini." />
          ) : (
            <div className="mt-4 flex flex-col items-center gap-6 sm:flex-row sm:items-start">
              <DonutChart
                data={cats.map((c) => ({ name: c.name, value: c.value, color: catMeta(c.name).color }))}
                size={190}
                format={fmt}
                center={
                  <div>
                    <div className="text-[11px] text-muted">Total</div>
                    <div className="tabular text-sm font-semibold">{moneyShort(exp)}</div>
                  </div>
                }
              />
              <div className="w-full flex-1 space-y-2">
                {cats.slice(0, 7).map((c) => (
                  <div key={c.name} className="flex items-center gap-2.5 text-sm">
                    <span className="grid size-7 shrink-0 place-items-center rounded-lg" style={{ background: `${catMeta(c.name).color}22`, color: catMeta(c.name).color }}>
                      <Icon name={catMeta(c.name).icon} size={14} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px]">{c.name}</p>
                      <p className="text-[11px] text-muted">{c.count} transaksi</p>
                    </div>
                    <div className="text-right">
                      <p className="tabular text-[13px] font-semibold">{money(c.value)}</p>
                      <p className="tabular text-[11px] text-muted">{c.pct.toFixed(1).replace(".", ",")}%</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
        <Card className="p-5">
          <CardHeader title="Arus Kas" subtitle={`Net per ${r.gran === "day" ? "hari" : r.gran === "week" ? "minggu" : "bulan"} (hijau surplus · merah defisit)`} icon="ArrowLeftRight" />
          <BarChart className="mt-4" data={ie} series={[{ key: "net", name: "Arus kas bersih", color: "#22C55E" }]} signedColors={["#22C55E", "#EF4444"]} format={(v) => money(v, { sign: true })} yFormat={yfmt} height={240} />
        </Card>
        <Card className="p-5">
          <CardHeader title="Pertumbuhan Tabungan" subtitle={`Kumulatif kategori "${SAVINGS_CATEGORY}" · ${months} bulan`} icon="PiggyBank" />
          <AreaChart className="mt-4" data={sav.map((s) => ({ label: s.label, value: s.value, added: s.added }))} series={[{ key: "value", name: "Total tabungan", color: "#10B981" }]} format={fmt} yFormat={yfmt} height={240} empty="Belum ada setoran tabungan" />
        </Card>
        <Card className="p-5">
          <CardHeader title="Pemakaian Anggaran" subtitle="Periode berjalan (hari/minggu/bulan ini)" icon="Gauge" />
          <div className="mt-5 space-y-4">
            {budgets.length === 0 ? (
              <EmptyState icon="Target" title="Belum ada anggaran" description="Atur anggaran harian, mingguan, bulanan, atau per kategori di tab Anggaran." />
            ) : (
              budgets.map((b) => (
                <HBar
                  key={b.id}
                  label={
                    <span className="flex items-center gap-2">
                      {b.label} {b.scope === "category" && <span className="text-[10px] text-muted">(kategori · bulan ini)</span>}
                      {b.level !== "ok" && <Pill color={b.level === "over" ? "#EF4444" : "#F59E0B"}>{b.level === "over" ? "Terlampaui" : "Hampir habis"}</Pill>}
                    </span>
                  }
                  value={b.spent}
                  max={b.limit}
                  color={b.level === "over" ? "#EF4444" : b.level === "warn" ? "#F59E0B" : "linear-gradient(90deg,#2563EB,#38BDF8)"}
                  right={`${money(b.spent)} / ${money(b.limit)} · ${Math.round(b.pct)}%`}
                />
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

const PAGE = 10;

function TransactionsTab({ initialQuery }: { initialQuery?: string }) {
  const { transactions, settings, actions } = useData();
  const { openModal } = useUI();
  const { toast, confirm } = useToast();
  const [q, setQ] = React.useState(initialQuery ?? "");
  const [type, setType] = React.useState<"all" | "income" | "expense">("all");
  const [cat, setCat] = React.useState("all");
  const [status, setStatus] = React.useState<"all" | "confirmed" | "pending">("all");
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  const [sort, setSort] = React.useState("newest");
  const [page, setPage] = React.useState(1);
  React.useEffect(() => setPage(1), [q, type, cat, status, from, to, sort]);

  const balances = React.useMemo(() => runningBalances(transactions, settings.initialBalance), [transactions, settings.initialBalance]);
  const rows = React.useMemo(() => {
    const term = q.trim().toLowerCase();
    return transactions
      .filter((t) => !term || [t.merchant, t.description, t.category, t.paymentMethod, String(t.amount)].some((x) => x?.toLowerCase().includes(term)))
      .filter((t) => type === "all" || t.type === type)
      .filter((t) => cat === "all" || t.category === cat)
      .filter((t) => status === "all" || t.status === status)
      .filter((t) => (!from || t.date >= from) && (!to || t.date <= to))
      .sort((a, b) => {
        const chrono = a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? "") || a.createdAt.localeCompare(b.createdAt);
        if (sort === "oldest") return chrono;
        if (sort === "largest") return b.amount - a.amount;
        if (sort === "smallest") return a.amount - b.amount;
        return -chrono;
      });
  }, [transactions, q, type, cat, status, from, to, sort]);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const pageRows = rows.slice((page - 1) * PAGE, page * PAGE);
  const fInc = incomeOf(rows.filter((r) => r.status === "confirmed"));
  const fExp = expenseOf(rows.filter((r) => r.status === "confirmed"));

  const del = async (t: Transaction) => {
    if (!(await confirm({ title: "Hapus transaksi?", message: `${t.merchant || t.category} · ${money(t.amount)} pada ${fmtDate(t.date)}. Saldo akan dihitung ulang.`, danger: true, confirmText: "Hapus" }))) return;
    await actions.remove("transactions", t.id);
    toast("success", "Transaksi dihapus", "Saldo & grafik diperbarui");
  };
  const exportCsv = () => {
    downloadText(`lifeos-transaksi-${todayKey()}.csv`, transactionsToCSV(rows, settings.initialBalance));
    toast("success", "CSV diekspor", `${rows.length} transaksi`);
  };

  return (
    <div className="space-y-4">
      <Card className="p-3">
        <div className="flex flex-col gap-2 xl:flex-row xl:items-center">
          <div className="relative flex-1">
            <Icon name="Search" size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
            <input className="input !pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari merchant, deskripsi, kategori, jumlah…" aria-label="Cari transaksi" />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:flex">
            <Select value={type} onChange={(e) => setType(e.target.value as typeof type)} options={[{ value: "all", label: "Semua tipe" }, { value: "income", label: "Pemasukan" }, { value: "expense", label: "Pengeluaran" }]} className="xl:w-36" aria-label="Filter tipe" />
            <Select value={cat} onChange={(e) => setCat(e.target.value)} options={[{ value: "all", label: "Semua kategori" }, ...[...EXPENSE_CATEGORIES, ...INCOME_SOURCES].map((c) => ({ value: c, label: c }))]} className="xl:w-44" aria-label="Filter kategori" />
            <Select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} options={[{ value: "all", label: "Semua status" }, { value: "confirmed", label: "Terkonfirmasi" }, { value: "pending", label: "Menunggu konfirmasi" }]} className="xl:w-44" aria-label="Filter status" />
            <input type="date" className="input xl:w-36" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="Dari tanggal" />
            <input type="date" className="input xl:w-36" value={to} onChange={(e) => setTo(e.target.value)} aria-label="Sampai tanggal" />
            <Select value={sort} onChange={(e) => setSort(e.target.value)} options={[{ value: "newest", label: "Terbaru" }, { value: "oldest", label: "Terlama" }, { value: "largest", label: "Jumlah terbesar" }, { value: "smallest", label: "Jumlah terkecil" }]} className="xl:w-40" aria-label="Urutkan" />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
          <p className="tabular text-xs text-muted">
            {rows.length} transaksi · <span className="text-success">+{money(fInc)}</span> · <span className="text-danger">−{money(fExp)}</span>
            {(q || type !== "all" || cat !== "all" || status !== "all" || from || to) && (
              <button
                className="ml-2 text-highlight hover:underline"
                onClick={() => {
                  setQ("");
                  setType("all");
                  setCat("all");
                  setStatus("all");
                  setFrom("");
                  setTo("");
                }}
              >
                Reset filter
              </button>
            )}
          </p>
          <div className="flex gap-2">
            <Button size="sm" icon="Download" onClick={exportCsv} disabled={!rows.length}>
              Ekspor CSV
            </Button>
            <Button size="sm" variant="primary" icon="Plus" onClick={() => openModal({ kind: "transaction" })}>
              Transaksi
            </Button>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        {pageRows.length === 0 ? (
          <EmptyState icon="Receipt" title="Tidak ada transaksi" description="Ubah filter atau catat transaksi baru." />
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="table">
                <thead>
                  <tr>
                    <th>Tanggal</th>
                    <th>Transaksi</th>
                    <th>Kategori</th>
                    <th className="!text-right">Pemasukan</th>
                    <th className="!text-right">Pengeluaran</th>
                    <th className="!text-right">Saldo setelah</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((t) => (
                    <tr key={t.id} className={cn(t.status === "pending" && "bg-warning/[0.04]")}>
                      <td className="tabular whitespace-nowrap">
                        <div>{fmtDate(t.date)}</div>
                        <div className="text-[11px] text-subtle">{t.time ?? ""}</div>
                      </td>
                      <td className="max-w-[280px]">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-medium">{t.merchant || t.description || t.category}</span>
                          <DemoBadge show={t.isDemo} />
                          {t.status === "pending" && <Pill color="#F59E0B">Menunggu</Pill>}
                          {t.origin !== "manual" && !t.isDemo && <Pill color={t.origin === "simulation" ? "#A78BFA" : "#38BDF8"}>{ORIGIN_LABEL[t.origin]}</Pill>}
                          {t.receipt && <Icon name="Paperclip" size={13} className="text-muted" />}
                        </div>
                        <div className="truncate text-[11px] text-muted">
                          {t.paymentMethod}
                          {t.description && t.merchant ? ` · ${t.description}` : ""}
                        </div>
                      </td>
                      <td>
                        <span className="flex items-center gap-1.5 whitespace-nowrap text-[13px]">
                          <Icon name={catMeta(t.category).icon} size={14} style={{ color: catMeta(t.category).color }} />
                          {t.category}
                        </span>
                      </td>
                      <td className="tabular !text-right whitespace-nowrap text-success">{t.type === "income" ? money(t.amount) : ""}</td>
                      <td className="tabular !text-right whitespace-nowrap text-danger">{t.type === "expense" ? money(t.amount) : ""}</td>
                      <td className="tabular !text-right whitespace-nowrap text-muted">{t.status === "confirmed" ? money(balances.get(t.id) ?? 0) : "—"}</td>
                      <td className="whitespace-nowrap !text-right">
                        <button onClick={() => openModal({ kind: "transaction", tx: t })} className="btn btn-ghost btn-sm btn-icon" aria-label="Edit transaksi">
                          <Icon name={t.status === "pending" ? "CircleCheck" : "Pencil"} size={15} />
                        </button>
                        <button onClick={() => del(t)} className="btn btn-ghost btn-sm btn-icon hover:!text-danger" aria-label="Hapus transaksi">
                          <Icon name="Trash2" size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="divide-y divide-line md:hidden">
              {pageRows.map((t) => (
                <button key={t.id} onClick={() => openModal({ kind: "transaction", tx: t })} className="flex w-full items-center gap-3 px-4 py-3 text-left">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl" style={{ background: `${catMeta(t.category).color}22`, color: catMeta(t.category).color }}>
                    <Icon name={catMeta(t.category).icon} size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate text-sm font-medium">{t.merchant || t.category}</p>
                      <DemoBadge show={t.isDemo} />
                      {t.status === "pending" && <Pill color="#F59E0B">Menunggu</Pill>}
                    </div>
                    <p className="text-[11px] text-muted">
                      {fmtDateShort(t.date)} {t.time ?? ""} · {t.category}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={cn("tabular text-sm font-semibold", t.type === "income" ? "text-success" : "text-fg")}>
                      {t.type === "income" ? "+" : "−"}
                      {money(t.amount)}
                    </p>
                    {t.status === "confirmed" && <p className="tabular text-[10.5px] text-subtle">saldo {moneyShort(balances.get(t.id) ?? 0)}</p>}
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
        {rows.length > PAGE && (
          <div className="flex items-center justify-between border-t border-line px-4 py-3 text-xs">
            <span className="text-muted">
              Halaman {page} dari {pages}
            </span>
            <div className="flex gap-1.5">
              <Button size="sm" iconOnly icon="ChevronLeft" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} aria-label="Halaman sebelumnya" />
              {Array.from({ length: pages }, (_, i) => i + 1)
                .filter((n) => n === 1 || n === pages || Math.abs(n - page) <= 1)
                .map((n, i, arr) => (
                  <React.Fragment key={n}>
                    {i > 0 && n - arr[i - 1] > 1 && <span className="px-1 text-muted">…</span>}
                    <button onClick={() => setPage(n)} className={cn("btn btn-sm min-w-8 !px-2", n === page ? "!border-primary/60 !bg-primary/20" : "btn-ghost")}>
                      {n}
                    </button>
                  </React.Fragment>
                ))}
              <Button size="sm" iconOnly icon="ChevronRight" disabled={page >= pages} onClick={() => setPage((p) => p + 1)} aria-label="Halaman berikutnya" />
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

function BudgetTab() {
  const { transactions, settings, actions } = useData();
  const { toast } = useToast();
  const [f, setF] = React.useState({
    daily: settings.dailyBudget ? String(settings.dailyBudget) : "",
    weekly: settings.weeklyBudget ? String(settings.weeklyBudget) : "",
    monthly: settings.monthlyBudget ? String(settings.monthlyBudget) : "",
  });
  const [cats, setCats] = React.useState<Record<string, string>>(Object.fromEntries(Object.entries(settings.categoryBudgets ?? {}).map(([k, v]) => [k, String(v)])));
  const lines = budgetStatus(transactions, settings);
  const save = async () => {
    const categoryBudgets: Record<string, number> = {};
    for (const [k, v] of Object.entries(cats)) {
      const n = parseAmountInput(v);
      if (n > 0) categoryBudgets[k] = n;
    }
    await actions.updateSettings({ dailyBudget: parseAmountInput(f.daily), weeklyBudget: parseAmountInput(f.weekly), monthlyBudget: parseAmountInput(f.monthly), categoryBudgets });
    toast("success", "Anggaran disimpan", "Peringatan akan muncul saat pemakaian ≥ 80% dan ≥ 100%.");
  };
  return (
    <div className="grid gap-5 xl:grid-cols-5">
      <Card className="p-5 xl:col-span-3">
        <CardHeader title="Atur Anggaran" subtitle="Kosongkan untuk menonaktifkan. Jika anggaran harian kosong, dihitung dari anggaran bulanan ÷ jumlah hari." icon="SlidersHorizontal" />
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          {(
            [
              ["daily", "Harian"],
              ["weekly", "Mingguan"],
              ["monthly", "Bulanan"],
            ] as const
          ).map(([k, l]) => (
            <Field key={k} label={`Anggaran ${l}`} hint={parseAmountInput(f[k]) ? money(parseAmountInput(f[k])) : "—"}>
              <input className="input tabular" inputMode="decimal" value={f[k]} onChange={(e) => setF((x) => ({ ...x, [k]: e.target.value }))} placeholder="cth. 75.000" />
            </Field>
          ))}
        </div>
        <p className="eyebrow mt-6 mb-3">Anggaran per kategori (bulanan)</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {EXPENSE_CATEGORIES.filter((c) => c !== SAVINGS_CATEGORY).map((c) => (
            <div key={c} className="flex items-center gap-2.5">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg" style={{ background: `${catMeta(c).color}22`, color: catMeta(c).color }}>
                <Icon name={catMeta(c).icon} size={15} />
              </span>
              <span className="w-32 shrink-0 truncate text-sm">{c}</span>
              <input className="input tabular !h-9" inputMode="decimal" value={cats[c] ?? ""} onChange={(e) => setCats((x) => ({ ...x, [c]: e.target.value }))} placeholder="—" aria-label={`Anggaran ${c}`} />
            </div>
          ))}
        </div>
        <div className="mt-6 flex justify-end">
          <Button variant="primary" icon="Check" onClick={save}>
            Simpan anggaran
          </Button>
        </div>
      </Card>
      <Card className="p-5 xl:col-span-2">
        <CardHeader title="Status Anggaran" subtitle="Diperbarui otomatis setiap transaksi" icon="Gauge" />
        <div className="mt-5 space-y-5">
          {lines.length === 0 ? (
            <EmptyState icon="Target" title="Belum ada anggaran aktif" />
          ) : (
            lines.map((b) => (
              <div key={b.id}>
                <div className="mb-1.5 flex items-center justify-between gap-2 text-sm">
                  <span className="flex items-center gap-2 font-medium">
                    {b.level !== "ok" && <Icon name="TriangleAlert" size={14} className={b.level === "over" ? "text-danger" : "text-warning"} />}
                    {b.label}
                    <span className="text-[11px] font-normal text-muted">{b.scope === "category" ? "kategori/bulan" : b.scope === "daily" ? "hari ini" : b.scope === "weekly" ? "minggu ini" : "bulan ini"}</span>
                  </span>
                  <span className="tabular text-xs font-semibold" style={{ color: b.level === "over" ? "#EF4444" : b.level === "warn" ? "#F59E0B" : undefined }}>
                    {Math.round(b.pct)}%
                  </span>
                </div>
                <ProgressBar value={b.pct} color={b.level === "over" ? "#EF4444" : b.level === "warn" ? "#F59E0B" : undefined} />
                <p className="tabular mt-1 text-[11px] text-muted">
                  {money(b.spent)} dari {money(b.limit)} · {b.limit - b.spent >= 0 ? `sisa ${money(b.limit - b.spent)}` : `lebih ${money(b.spent - b.limit)}`}
                </p>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}

export function FinanceView() {
  const { transactions } = useData();
  const { openModal, focus, setFocus } = useUI();
  const [tab, setTab] = React.useState<Tab>("overview");
  const [initialQuery, setInitialQuery] = React.useState<string>();
  React.useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("tab");
    if (p === "agent" || p === "transactions" || p === "budget") setTab(p);
  }, []);
  React.useEffect(() => {
    if (focus?.type === "transaction") {
      setInitialQuery(focus.query);
      setTab("transactions");
      setFocus(null);
    }
  }, [focus, setFocus]);
  const pending = transactions.filter((t) => t.status === "pending").length;
  return (
    <div>
      <SectionTitle
        title="Keuangan"
        subtitle="Pelacak keuangan pribadi — semua perhitungan diperbarui otomatis saat transaksi ditambah, diubah, atau dihapus."
        action={
          <Button variant="primary" icon="Plus" onClick={() => openModal({ kind: "transaction" })}>
            Tambah Transaksi
          </Button>
        }
      />
      <div className="mb-5 overflow-x-auto">
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: "overview", label: <span className="flex items-center gap-1.5"><Icon name="LayoutDashboard" size={14} /> Ringkasan</span> },
            { value: "transactions", label: <span className="flex items-center gap-1.5"><Icon name="Receipt" size={14} /> Transaksi</span> },
            { value: "budget", label: <span className="flex items-center gap-1.5"><Icon name="Target" size={14} /> Anggaran</span> },
            {
              value: "agent",
              label: (
                <span className="flex items-center gap-1.5">
                  <Icon name="Bot" size={14} /> AI Agent {pending > 0 && <span className="grid size-4 place-items-center rounded-full bg-warning text-[9px] font-bold text-black">{pending}</span>}
                </span>
              ),
            },
          ]}
        />
      </div>
      {tab === "overview" && <OverviewTab />}
      {tab === "transactions" && <TransactionsTab key={initialQuery ?? ""} initialQuery={initialQuery} />}
      {tab === "budget" && <BudgetTab />}
      {tab === "agent" && <AgentPanel />}
    </div>
  );
}
