"use client";

import * as React from "react";
import type { Transaction } from "@/lib/types";
import { Icon } from "../icons";
import { Button, Card, CardHeader, DemoBadge, EmptyState, Pill } from "../ui";
import { useData } from "../providers/DataProvider";
import { useUI } from "../providers/UIProvider";
import { useToast } from "../providers/Toast";
import { parsedToTransaction, useAgentSync } from "../shell/agent";
import { parseNotification, SAMPLE_NOTIFICATIONS, type ParsedTransaction } from "@/lib/parser";
import { csvToTransactions, CSV_TEMPLATE, downloadText, type CsvImportRow } from "@/lib/csv";
import { findDuplicate } from "@/lib/finance";
import { learnRule } from "@/lib/rules";
import { fmtDate, fmtDateTime, minutesBetween, nowLocal } from "@/lib/time";
import { cn, money, uid } from "@/lib/format";
import { EXPENSE_CATEGORIES, INCOME_SOURCES } from "@/lib/constants";

interface Health {
  llm: { configured: boolean; label: string | null };
  ingest: { tokenConfigured: boolean; storageConfigured: boolean };
}

function useHealth() {
  const [h, setH] = React.useState<Health | null>(null);
  const [err, setErr] = React.useState(false);
  React.useEffect(() => {
    fetch("/api/health", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setH)
      .catch(() => setErr(true));
  }, []);
  return { h, err };
}

function ParsedPreview({ p, onSave, onDiscard, dupLabel }: { p: ParsedTransaction; onSave: (confirmNow: boolean) => void; onDiscard: () => void; dupLabel?: string }) {
  const rows: [string, React.ReactNode][] = [
    ["Tipe", p.type ? (p.type === "income" ? <span className="text-success">Pemasukan</span> : <span className="text-danger">Pengeluaran</span>) : <span className="text-warning">Tidak jelas</span>],
    ["Jumlah", p.amount ? money(p.amount) : <span className="text-warning">Tidak ditemukan</span>],
    ["Merchant", p.merchant ?? <span className="text-warning">Tidak ditemukan</span>],
    ["Kategori", <span key="c">{p.category} {p.learned && <Pill color="#A78BFA">dari koreksimu</Pill>}</span>],
    ["Metode", p.paymentMethod],
    ["Tanggal", `${fmtDate(p.date)}${p.time ? `, ${p.time}` : ""}`],
  ];
  const certain = !!p.type && !!p.amount && p.issues.length === 0 && !dupLabel;
  return (
    <div className="mt-4 rounded-2xl border border-line-strong bg-bg2/60 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <Icon name="ScanText" size={16} className="text-accent" /> Hasil parsing
          <Pill color={p.engine === "llm" ? "#A78BFA" : "#38BDF8"}>{p.engine === "llm" ? "LLM + aturan" : "Parser aturan"}</Pill>
          {p.bank && <Pill color="#94A3B8">{p.bank}</Pill>}
        </p>
        <span className={cn("tabular text-xs font-semibold", p.confidence >= 0.85 ? "text-success" : p.confidence >= 0.6 ? "text-warning" : "text-danger")}>Keyakinan {Math.round(p.confidence * 100)}%</span>
      </div>
      <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3 border-b border-line/60 pb-1.5 text-sm">
            <span className="text-muted">{k}</span>
            <span className="text-right font-medium">{v}</span>
          </div>
        ))}
      </div>
      {(p.issues.length > 0 || dupLabel) && (
        <ul className="mt-3 space-y-1 text-xs text-warning">
          {p.issues.map((i) => (
            <li key={i} className="flex items-center gap-1.5">
              <Icon name="TriangleAlert" size={12} /> {i}
            </li>
          ))}
          {dupLabel && (
            <li className="flex items-center gap-1.5">
              <Icon name="Copy" size={12} /> {dupLabel}
            </li>
          )}
        </ul>
      )}
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onDiscard}>
          Buang
        </Button>
        <Button size="sm" icon="Inbox" onClick={() => onSave(false)} disabled={!p.amount}>
          Masukkan ke antrean konfirmasi
        </Button>
        <Button size="sm" variant="primary" icon="CircleCheck" onClick={() => onSave(true)} disabled={!certain}>
          Konfirmasi & catat
        </Button>
      </div>
      <p className="mt-2 text-[11px] text-subtle">Teks notifikasi tidak disimpan — hanya kolom transaksi di atas yang dicatat.</p>
    </div>
  );
}

export function AgentPanel() {
  const data = useData();
  const { transactions, rules, settings, agent, actions } = data;
  const { openModal } = useUI();
  const { toast, confirm } = useToast();
  const { sync, syncing, lastError } = useAgentSync();
  const { h, err: healthErr } = useHealth();
  const [text, setText] = React.useState("");
  const [parsing, setParsing] = React.useState(false);
  const [parsed, setParsed] = React.useState<{ p: ParsedTransaction; origin: "notification" | "simulation" } | null>(null);
  const [csvRows, setCsvRows] = React.useState<CsvImportRow[] | null>(null);
  const [origin, setOrigin] = React.useState("");
  React.useEffect(() => setOrigin(window.location.origin), []);

  const pending = transactions.filter((t) => t.status === "pending").sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const detected = transactions.filter((t) => t.origin === "android" || t.origin === "notification" || t.origin === "simulation").length;
  const hbAge = agent.lastHeartbeat ? (Date.now() - new Date(agent.lastHeartbeat).getTime()) / 60000 : Infinity;
  const serverReady = !!h?.ingest.tokenConfigured && !!h?.ingest.storageConfigured;
  const connected = serverReady && !!settings.ingestToken && hbAge < 30;
  const status = connected ? { label: "Terhubung", color: "#22C55E", icon: "Wifi" as const } : { label: "Tidak terhubung", color: "#94A3B8", icon: "WifiOff" as const };

  const parse = async (raw: string, from: "notification" | "simulation") => {
    if (!raw.trim()) return toast("info", "Tempel teks notifikasi terlebih dahulu");
    setParsing(true);
    let p: ParsedTransaction;
    try {
      const res = await fetch("/api/ai/parse", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: raw, rules }) });
      if (!res.ok) throw new Error();
      const j = await res.json();
      p = j.result as ParsedTransaction;
      if (j.warning) toast("warning", "LLM gagal, memakai parser aturan", j.warning);
    } catch {
      p = parseNotification(raw, rules); // offline fallback (same parser, runs in the browser)
    }
    setParsing(false);
    if (!p.amount || !p.type) await actions.updateAgent({ parseErrors: agent.parseErrors + 1 });
    setParsed({ p, origin: from });
  };

  const saveParsed = async (confirmNow: boolean) => {
    if (!parsed) return;
    const t = parsedToTransaction(parsed.p, parsed.origin, data);
    if (confirmNow) {
      t.status = "confirmed";
      t.issues = [];
    }
    if (parsed.origin === "simulation") t.description = "SIMULASI — bukan transaksi nyata";
    await actions.upsert("transactions", t);
    await actions.updateAgent({ lastSync: nowLocal() });
    actions.notify({ type: "transaction", title: confirmNow ? "Transaksi tercatat" : "Transaksi menunggu konfirmasi", body: `${t.merchant ?? t.category} · ${money(t.amount)}`, href: "/finance?tab=agent" }, { browser: true });
    toast("success", confirmNow ? "Transaksi dicatat" : "Masuk antrean konfirmasi", `${t.merchant ?? t.category} · ${money(t.amount)}`);
    setParsed(null);
    setText("");
  };

  const simulate = () => {
    const sample = SAMPLE_NOTIFICATIONS[Math.floor(Math.random() * SAMPLE_NOTIFICATIONS.length)];
    setText(sample);
    parse(sample, "simulation");
  };

  const confirmTx = async (t: Transaction) => {
    await actions.upsert("transactions", { ...t, status: "confirmed", issues: [] });
    toast("success", "Transaksi dikonfirmasi", `${t.merchant ?? t.category} · ${money(t.amount)}`);
  };
  const reject = async (t: Transaction) => {
    if (!(await confirm({ title: "Tolak transaksi?", message: "Transaksi yang ditolak akan dihapus dari antrean dan tidak dihitung.", danger: true, confirmText: "Tolak & hapus" }))) return;
    await actions.remove("transactions", t.id);
    toast("info", "Transaksi ditolak");
  };
  const changeCategory = async (t: Transaction, category: string) => {
    await actions.upsert("transactions", { ...t, category });
    const rule = learnRule(rules, t.merchant, category);
    if (rule) {
      await actions.upsert("rules", rule);
      toast("info", "AI belajar dari koreksimu", `"${t.merchant}" → ${category}`);
    }
  };

  const onCsv = async (file?: File) => {
    if (!file) return;
    const text = await file.text();
    const rows = csvToTransactions(text);
    if (!rows.length) return toast("error", "CSV kosong atau tidak valid");
    setCsvRows(rows);
  };
  const importCsv = async () => {
    if (!csvRows) return;
    const items: Transaction[] = [];
    let working = transactions;
    let dups = 0;
    for (const r of csvRows) {
      if (!r.ok || !r.tx) continue;
      const t: Transaction = { ...r.tx, id: uid("tx-"), origin: "csv", status: "confirmed", createdAt: nowLocal() };
      const dup = findDuplicate(working, t);
      if (dup) {
        t.status = "pending";
        t.duplicateOf = dup.id;
        t.issues = [`Kemungkinan duplikat dengan ${dup.merchant || dup.category} ${money(dup.amount)} (${dup.date})`];
        dups++;
      }
      items.push(t);
      working = [...working, t];
    }
    await actions.upsertMany("transactions", items);
    toast("success", `${items.length} transaksi diimpor`, dups ? `${dups} kemungkinan duplikat dimasukkan ke antrean konfirmasi` : "Saldo & grafik diperbarui");
    setCsvRows(null);
  };

  const confirmAllCertain = async () => {
    const ok = pending.filter((t) => !(t.issues?.length) && !t.duplicateOf && t.amount > 0);
    if (!ok.length) return toast("info", "Tidak ada transaksi yang aman untuk dikonfirmasi massal", "Tinjau satu per satu.");
    await actions.upsertMany("transactions", ok.map((t) => ({ ...t, status: "confirmed" as const })));
    toast("success", `${ok.length} transaksi dikonfirmasi`);
  };

  const endpoint = `${origin || "https://<domain-anda>.vercel.app"}/api/ingest`;

  return (
    <div className="grid gap-5 xl:grid-cols-12">
      <div className="space-y-5 xl:col-span-7">
        {/* Status */}
        <Card accent className="p-5">
          <CardHeader
            title="AI Financial Agent"
            subtitle="Deteksi otomatis transaksi QRIS dari notifikasi mobile banking"
            icon="Bot"
            action={
              <Button size="sm" icon="RefreshCw" loading={syncing} onClick={async () => {
                const r = await sync();
                if (r.ok) toast("success", r.count ? `${r.count} transaksi baru` : "Sinkron selesai", r.count ? "Cek antrean konfirmasi" : "Tidak ada transaksi baru");
              }} disabled={!settings.ingestToken}>
                Sinkronkan
              </Button>
            }
          />
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
            <div className="surface col-span-2 flex items-center gap-3 p-3 sm:col-span-1 sm:block">
              <p className="text-[11px] text-muted">Status</p>
              <p className="mt-0.5 flex items-center gap-1.5 text-sm font-semibold" style={{ color: status.color }}>
                <Icon name={status.icon} size={15} /> {status.label}
              </p>
            </div>
            <div className="surface p-3">
              <p className="text-[11px] text-muted">Sinkron terakhir</p>
              <p className="mt-0.5 text-xs font-semibold">{agent.lastSync ? fmtDateTime(agent.lastSync) : "Belum pernah"}</p>
            </div>
            <div className="surface p-3">
              <p className="text-[11px] text-muted">Terdeteksi</p>
              <p className="tabular mt-0.5 text-lg font-semibold">{Math.max(detected, agent.detected)}</p>
            </div>
            <div className="surface p-3">
              <p className="text-[11px] text-muted">Menunggu konfirmasi</p>
              <p className="tabular mt-0.5 text-lg font-semibold text-warning">{pending.length}</p>
            </div>
            <div className="surface p-3">
              <p className="text-[11px] text-muted">Error parsing</p>
              <p className="tabular mt-0.5 text-lg font-semibold text-danger">{agent.parseErrors}</p>
            </div>
          </div>
          {!connected && (
            <p className="mt-3 text-xs text-muted">
              {!settings.ingestToken
                ? "Android companion belum dihubungkan. Isi token integrasi di Pengaturan → Integrasi, lalu pasang aplikasi Android (lihat panduan di bawah). Sementara itu gunakan input teks notifikasi, impor CSV, atau mode simulasi."
                : !serverReady
                  ? "Server belum siap menerima data Android (INGEST_TOKEN / Upstash Redis belum dikonfigurasi di Vercel)."
                  : `Belum ada sinyal dari HP dalam 30 menit terakhir${agent.lastHeartbeat ? ` (terakhir ${fmtDateTime(agent.lastHeartbeat.slice(0, 16))} UTC)` : ""}.`}
              {lastError && <span className="mt-1 block text-warning">Sinkron gagal: {lastError}</span>}
            </p>
          )}
        </Card>

        {/* Notification text input */}
        <Card className="p-5">
          <CardHeader title="Input Teks Notifikasi" subtitle="Tempel teks notifikasi bank / e-wallet, AI akan mengurai transaksinya" icon="ScanText" />
          <textarea className="input mt-4" rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder='cth. "Transaksi QRIS berhasil. Pembayaran Rp25.000 di Warung Makan."' />
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="primary" icon="Sparkles" loading={parsing} onClick={() => parse(text, "notification")}>
              Uraikan dengan AI
            </Button>
            <Button icon="FlaskConical" onClick={simulate}>
              Simulasikan notifikasi
            </Button>
          </div>
          <p className="mt-2 text-[11px] text-subtle">
            Mode simulasi memakai contoh notifikasi dan diberi label <span className="font-semibold text-violet-300">SIMULASI</span> — bukan transaksi nyata. {h?.llm.configured ? `LLM aktif: ${h.llm.label}.` : "LLM belum dikonfigurasi — parser aturan dipakai."}
          </p>
          {parsed && (
            <ParsedPreview
              p={parsed.p}
              onSave={saveParsed}
              onDiscard={() => setParsed(null)}
              dupLabel={(() => {
                const d = parsed.p.amount && parsed.p.type ? findDuplicate(transactions, { id: "", type: parsed.p.type, amount: parsed.p.amount, date: parsed.p.date, time: parsed.p.time ?? undefined, merchant: parsed.p.merchant ?? undefined }) : undefined;
                return d ? `Kemungkinan duplikat: ${d.merchant || d.category} ${money(d.amount)} (${fmtDate(d.date)})` : undefined;
              })()}
            />
          )}
        </Card>

        {/* Pending queue */}
        <Card className="p-5">
          <CardHeader
            title="Antrean Konfirmasi"
            subtitle="Transaksi yang belum pasti tidak dihitung ke saldo sampai dikonfirmasi"
            icon="Inbox"
            action={
              pending.length > 0 && (
                <Button size="sm" icon="CheckCheck" onClick={confirmAllCertain}>
                  Konfirmasi yang aman
                </Button>
              )
            }
          />
          <div className="mt-4 space-y-2">
            {pending.length === 0 ? (
              <EmptyState icon="Inbox" title="Antrean kosong" description="Transaksi terdeteksi yang perlu dicek akan muncul di sini." />
            ) : (
              pending.map((t) => (
                <div key={t.id} className="surface p-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="truncate text-sm font-semibold">{t.merchant ?? "(tanpa merchant)"}</p>
                        <Pill color={t.origin === "simulation" ? "#A78BFA" : "#38BDF8"}>{t.origin === "simulation" ? "SIMULASI" : t.origin === "android" ? "Android" : t.origin === "csv" ? "CSV" : "Notifikasi"}</Pill>
                        <DemoBadge show={t.isDemo} />
                      </div>
                      <p className="text-[11px] text-muted">
                        {fmtDate(t.date)} {t.time ?? ""} · {t.paymentMethod} · keyakinan {Math.round((t.confidence ?? 0) * 100)}%
                      </p>
                    </div>
                    <p className={cn("tabular text-sm font-semibold", t.type === "income" ? "text-success" : "")}>
                      {t.type === "income" ? "+" : "−"}
                      {money(t.amount)}
                    </p>
                  </div>
                  {t.issues && t.issues.length > 0 && <p className="mt-1.5 text-[11px] text-warning">⚠ {t.issues.join(" · ")}</p>}
                  <div className="mt-2.5 flex flex-wrap items-center gap-2">
                    <select className="input !h-8 !w-auto !py-0 !text-xs" value={t.category} onChange={(e) => changeCategory(t, e.target.value)} aria-label="Ubah kategori">
                      {(t.type === "income" ? INCOME_SOURCES : EXPENSE_CATEGORIES).map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                    <div className="ml-auto flex gap-1.5">
                      <Button size="sm" variant="ghost" icon="X" onClick={() => reject(t)}>
                        Tolak
                      </Button>
                      <Button size="sm" icon="Pencil" onClick={() => openModal({ kind: "transaction", tx: t })}>
                        Tinjau
                      </Button>
                      <Button size="sm" variant="primary" icon="Check" onClick={() => confirmTx(t)} disabled={!t.amount}>
                        Konfirmasi
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      <div className="space-y-5 xl:col-span-5">
        {/* CSV import */}
        <Card className="p-5">
          <CardHeader title="Impor CSV" subtitle="Dari mutasi rekening / spreadsheet" icon="FileSpreadsheet" action={<Button size="sm" variant="ghost" icon="Download" onClick={() => downloadText("template-transaksi-lifeos.csv", CSV_TEMPLATE)}>Template</Button>} />
          {!csvRows ? (
            <label className="surface mt-4 flex cursor-pointer flex-col items-center justify-center gap-2 border-dashed p-6 text-center text-sm text-muted hover:text-fg">
              <Icon name="Upload" size={22} />
              Pilih file .csv
              <span className="text-[11px] text-subtle">Kolom: tanggal, tipe, jumlah, kategori, nama, metode, deskripsi (atau kolom pemasukan/pengeluaran)</span>
              <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => onCsv(e.target.files?.[0])} />
            </label>
          ) : (
            <div className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="surface p-3">
                  <p className="tabular text-lg font-semibold text-success">{csvRows.filter((r) => r.ok).length}</p>
                  <p className="text-[11px] text-muted">baris valid</p>
                </div>
                <div className="surface p-3">
                  <p className="tabular text-lg font-semibold text-danger">{csvRows.filter((r) => !r.ok).length}</p>
                  <p className="text-[11px] text-muted">baris error (dilewati)</p>
                </div>
              </div>
              {csvRows.some((r) => !r.ok) && (
                <ul className="max-h-24 overflow-y-auto text-[11px] text-warning">
                  {csvRows
                    .filter((r) => !r.ok)
                    .slice(0, 8)
                    .map((r, i) => (
                      <li key={i}>• {r.error}</li>
                    ))}
                </ul>
              )}
              <div className="max-h-48 overflow-y-auto rounded-xl border border-line">
                {csvRows
                  .filter((r) => r.ok)
                  .slice(0, 30)
                  .map((r, i) => (
                    <div key={i} className="flex items-center justify-between border-b border-line/60 px-3 py-1.5 text-xs last:border-0">
                      <span className="truncate">
                        {r.tx!.date} · {r.tx!.merchant ?? r.tx!.category}
                      </span>
                      <span className={cn("tabular", r.tx!.type === "income" ? "text-success" : "")}>
                        {r.tx!.type === "income" ? "+" : "−"}
                        {money(r.tx!.amount)}
                      </span>
                    </div>
                  ))}
              </div>
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={() => setCsvRows(null)}>
                  Batal
                </Button>
                <Button size="sm" variant="primary" icon="Upload" onClick={importCsv} disabled={!csvRows.some((r) => r.ok)}>
                  Impor {csvRows.filter((r) => r.ok).length} transaksi
                </Button>
              </div>
            </div>
          )}
        </Card>

        {/* Learned rules */}
        <Card className="p-5">
          <CardHeader title="Pembelajaran Kategori" subtitle="AI mengingat koreksi kategori yang kamu buat" icon="Brain" />
          <div className="mt-4 space-y-1.5">
            {rules.length === 0 ? (
              <p className="text-sm text-muted">Belum ada. Ubah kategori transaksi yang terdeteksi, dan AI akan memakainya untuk merchant yang sama berikutnya.</p>
            ) : (
              rules
                .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
                .map((r) => (
                  <div key={r.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-white/[0.03]">
                    <span className="min-w-0 flex-1 truncate">{r.merchant}</span>
                    <Icon name="ArrowRight" size={13} className="text-muted" />
                    <span className="text-xs text-highlight">{r.category}</span>
                    <button onClick={() => actions.remove("rules", r.id)} className="text-muted hover:text-danger" aria-label="Hapus aturan">
                      <Icon name="X" size={14} />
                    </button>
                  </div>
                ))
            )}
          </div>
        </Card>

        {/* Integration guide */}
        <Card className="p-5">
          <CardHeader title="Integrasi Android Companion" subtitle="NotificationListenerService → API → Dashboard" icon="Smartphone" />
          <div className="mt-4 space-y-3 text-sm">
            <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
              {[
                { l: "INGEST_TOKEN", ok: h?.ingest.tokenConfigured },
                { l: "Upstash Redis", ok: h?.ingest.storageConfigured },
                { l: "Token di aplikasi", ok: !!settings.ingestToken },
              ].map((x) => (
                <div key={x.l} className="surface p-2">
                  <Icon name={x.ok ? "CircleCheck" : "CircleDashed"} size={16} className={cn("mx-auto", x.ok ? "text-success" : "text-muted")} />
                  <p className="mt-1">{x.l}</p>
                </div>
              ))}
            </div>
            {healthErr && <p className="text-xs text-warning">Server API tidak dapat dihubungi (mode offline/preview).</p>}
            <ol className="list-decimal space-y-1.5 pl-5 text-xs text-muted">
              <li>Di Vercel: hubungkan Upstash Redis (Storage → Marketplace) dan isi env <code className="text-fg">INGEST_TOKEN</code>.</li>
              <li>Isi token yang sama di Pengaturan → Integrasi pada dashboard ini.</li>
              <li>Build aplikasi di folder <code className="text-fg">android-companion/</code> dengan Android Studio, lalu isi URL & token.</li>
              <li>Beri izin &ldquo;Akses Notifikasi&rdquo; secara eksplisit. Aplikasi tidak pernah meminta password, PIN, atau OTP.</li>
            </ol>
            <div>
              <p className="label">Endpoint</p>
              <div className="flex items-center gap-2">
                <code className="input flex !h-9 items-center overflow-x-auto !text-xs whitespace-nowrap">{endpoint}</code>
                <Button size="sm" iconOnly icon="Copy" onClick={() => navigator.clipboard?.writeText(endpoint).then(() => toast("success", "URL disalin"))} aria-label="Salin URL" />
              </div>
            </div>
            <pre className="overflow-x-auto rounded-xl bg-bg2 p-3 text-[11px] leading-relaxed text-muted">{`curl -X POST ${endpoint} \\
  -H "Authorization: Bearer <INGEST_TOKEN>" \\
  -H "Content-Type: application/json" \\
  -d '{"text":"Transaksi QRIS berhasil. Pembayaran Rp25.000 di Warung Makan.","app":"id.bmri.livin"}'`}</pre>
            {settings.ingestToken && (
              <p className="text-[11px] text-subtle">
                Polling otomatis tiap 60 detik saat aplikasi terbuka. Terakhir aktif HP: {agent.lastHeartbeat ? `${Math.round(minutesBetween(agent.lastHeartbeat.slice(0, 16), new Date().toISOString().slice(0, 16)))} menit lalu` : "—"}
              </p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
