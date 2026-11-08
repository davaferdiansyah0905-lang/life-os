"use client";

import * as React from "react";
import type { Settings } from "@/lib/types";
import { Icon } from "../icons";
import { Button, Card, CardHeader, Field, Pill, SectionTitle, Segmented, Select, Toggle } from "../ui";
import { useData } from "../providers/DataProvider";
import { useToast } from "../providers/Toast";
import { CURRENCIES, QUOTE_CATEGORIES, TIMEZONES, WORK_WINDOWS } from "@/lib/constants";
import { downloadText, transactionsToCSV } from "@/lib/csv";
import { todayKey } from "@/lib/time";
import { cn, money, parseAmountInput } from "@/lib/format";

function randomToken() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function SettingsView() {
  const data = useData();
  const { settings, actions } = data;
  const { toast, confirm } = useToast();
  const save = async (patch: Partial<Settings>, msg = "Pengaturan disimpan") => {
    await actions.updateSettings(patch);
    toast("success", msg);
  };

  const [profile, setProfile] = React.useState({ name: settings.name, initialBalance: String(settings.initialBalance || ""), monthlyBudget: String(settings.monthlyBudget || "") });
  const [hours, setHours] = React.useState({ start: settings.activeHoursStart, end: settings.activeHoursEnd });
  const [token, setToken] = React.useState(settings.ingestToken);
  const [showToken, setShowToken] = React.useState(false);
  const [customReminder, setCustomReminder] = React.useState(String(settings.reminderMinutes));
  const [perm, setPerm] = React.useState<string>("default");
  const [health, setHealth] = React.useState<{ llm: { configured: boolean; label: string | null }; ingest: { tokenConfigured: boolean; storageConfigured: boolean } } | null>(null);
  const [resetFinance, setResetFinance] = React.useState(true);
  const fileRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    setPerm(typeof Notification === "undefined" ? "unsupported" : Notification.permission);
    fetch("/api/health", { cache: "no-store" })
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => setHealth(null));
  }, []);

  const counts = {
    schedules: data.schedules.length,
    tasks: data.tasks.length,
    transactions: data.transactions.length,
    goals: data.goals.length,
    notes: data.notes.length,
  };
  const demoCount = [data.schedules, data.tasks, data.transactions, data.goals, data.notes].reduce((s, arr) => s + (arr as { isDemo?: boolean }[]).filter((x) => x.isDemo).length, 0);

  const requestPermission = async () => {
    if (typeof Notification === "undefined") return toast("error", "Browser tidak mendukung notifikasi");
    const p = await Notification.requestPermission();
    setPerm(p);
    if (p === "granted") {
      await actions.updateSettings({ browserNotifications: true });
      new Notification("LifeOS", { body: "Notifikasi browser aktif ✅", icon: "/icon.svg" });
      toast("success", "Notifikasi browser diaktifkan");
    } else toast("warning", "Izin notifikasi ditolak", "Ubah izin di pengaturan situs browser.");
  };

  const exportJson = () => {
    const file = actions.exportAll();
    downloadText(`lifeos-backup-${todayKey()}.json`, JSON.stringify(file, null, 2), "application/json");
    toast("success", "Backup JSON diunduh");
  };
  const importJson = async (f?: File) => {
    if (!f) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(await f.text());
    } catch {
      return toast("error", "File JSON tidak valid");
    }
    const ok = await confirm({ title: "Pulihkan dari backup?", message: "Semua data saat ini akan DIGANTI dengan isi file backup. Disarankan ekspor backup terlebih dahulu.", danger: true, confirmText: "Pulihkan" });
    if (!ok) return;
    const r = await actions.importAll(parsed);
    if (r.ok) toast("success", "Data dipulihkan dari backup");
    else toast("error", "Gagal memulihkan", r.error);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div>
      <SectionTitle title="Pengaturan" subtitle="Tanpa login — semua data tersimpan lokal di browser ini (IndexedDB). Backup secara berkala." />
      <div className="grid gap-5 xl:grid-cols-2">
        <Card className="p-5">
          <CardHeader title="Profil & Keuangan" icon="User" />
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Nama" className="sm:col-span-2">
              <input className="input" value={profile.name} onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))} />
            </Field>
            <Field label="Saldo awal" hint={`= ${money(parseAmountInput(profile.initialBalance))} · Saldo = saldo awal + pemasukan − pengeluaran`}>
              <input className="input tabular" inputMode="decimal" value={profile.initialBalance} onChange={(e) => setProfile((p) => ({ ...p, initialBalance: e.target.value }))} placeholder="0" />
            </Field>
            <Field label="Anggaran bulanan" hint={`= ${money(parseAmountInput(profile.monthlyBudget))}`}>
              <input className="input tabular" inputMode="decimal" value={profile.monthlyBudget} onChange={(e) => setProfile((p) => ({ ...p, monthlyBudget: e.target.value }))} placeholder="0" />
            </Field>
            <Field label="Mata uang">
              <Select value={settings.currency} onChange={(e) => save({ currency: e.target.value })} options={CURRENCIES.map((c) => ({ value: c.code, label: c.label }))} />
            </Field>
          </div>
          <div className="mt-4 flex justify-end">
            <Button
              variant="primary"
              icon="Check"
              onClick={() => save({ name: profile.name.trim() || "Dava", initialBalance: parseAmountInput(profile.initialBalance), monthlyBudget: parseAmountInput(profile.monthlyBudget) }, "Profil & keuangan disimpan")}
            >
              Simpan
            </Button>
          </div>
        </Card>

        <Card className="p-5">
          <CardHeader title="Tampilan & Waktu" icon="Palette" />
          <div className="mt-4 space-y-4">
            <div>
              <p className="label">Tema</p>
              <Segmented
                value={settings.theme}
                onChange={(v) => save({ theme: v }, "Tema diubah")}
                options={[
                  { value: "dark", label: <span className="flex items-center gap-1.5"><Icon name="Moon" size={14} /> Gelap</span> },
                  { value: "midnight", label: <span className="flex items-center gap-1.5"><Icon name="Sparkles" size={14} /> Midnight</span> },
                  { value: "light", label: <span className="flex items-center gap-1.5"><Icon name="Sun" size={14} /> Terang</span> },
                ]}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Format waktu">
                <Select value={settings.timeFormat} onChange={(e) => save({ timeFormat: e.target.value as Settings["timeFormat"] })} options={[{ value: "24h", label: "24 jam (14:30)" }, { value: "12h", label: "12 jam (2:30 PM)" }]} />
              </Field>
              <Field label="Zona waktu">
                <Select value={settings.timezone} onChange={(e) => save({ timezone: e.target.value })} options={TIMEZONES} />
              </Field>
              <Field label="Waktu kerja favorit (Smart Planner)">
                <Select value={settings.preferredWorkTime} onChange={(e) => save({ preferredWorkTime: e.target.value as Settings["preferredWorkTime"] })} options={Object.entries(WORK_WINDOWS).map(([value, w]) => ({ value, label: w.label }))} />
              </Field>
              <Field label="Jam aktif (untuk hitung waktu luang)">
                <div className="flex items-center gap-2">
                  <input type="time" className="input" value={hours.start} onChange={(e) => setHours((h) => ({ ...h, start: e.target.value }))} onBlur={() => hours.start < hours.end && save({ activeHoursStart: hours.start })} aria-label="Mulai jam aktif" />
                  <span className="text-muted">–</span>
                  <input type="time" className="input" value={hours.end} onChange={(e) => setHours((h) => ({ ...h, end: e.target.value }))} onBlur={() => hours.start < hours.end && save({ activeHoursEnd: hours.end })} aria-label="Selesai jam aktif" />
                </div>
              </Field>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <CardHeader title="Notifikasi & Pengingat" icon="Bell" />
          <div className="mt-4 space-y-4">
            <Toggle checked={settings.notificationsEnabled} onChange={(v) => save({ notificationsEnabled: v })} label="Notifikasi dalam aplikasi" description="Jadwal mendatang, deadline, tugas terlambat, bentrok, anggaran, transaksi, milestone" />
            <div className="surface flex flex-wrap items-center justify-between gap-3 p-3">
              <div>
                <p className="text-sm font-medium">Notifikasi browser</p>
                <p className="text-xs text-muted">
                  Izin: <span className={perm === "granted" ? "text-success" : perm === "denied" ? "text-danger" : "text-warning"}>{perm === "granted" ? "diizinkan" : perm === "denied" ? "ditolak" : perm === "unsupported" ? "tidak didukung" : "belum diminta"}</span>
                </p>
              </div>
              {perm === "granted" ? (
                <Toggle checked={settings.browserNotifications} onChange={(v) => save({ browserNotifications: v })} />
              ) : (
                <Button size="sm" icon="BellRing" onClick={requestPermission} disabled={perm === "unsupported" || perm === "denied"}>
                  Minta izin
                </Button>
              )}
            </div>
            <div>
              <p className="label">Pengingat sebelum jadwal / deadline</p>
              <div className="flex flex-wrap items-center gap-2">
                <Segmented
                  size="sm"
                  value={[5, 15, 30, 60].includes(settings.reminderMinutes) ? String(settings.reminderMinutes) : "custom"}
                  onChange={(v) => v !== "custom" && save({ reminderMinutes: Number(v) })}
                  options={[
                    { value: "5", label: "5 mnt" },
                    { value: "15", label: "15 mnt" },
                    { value: "30", label: "30 mnt" },
                    { value: "60", label: "1 jam" },
                    { value: "custom", label: "Kustom" },
                  ]}
                />
                <input type="number" min={1} max={1440} className="input !h-8 !w-20 !text-xs" value={customReminder} onChange={(e) => setCustomReminder(e.target.value)} aria-label="Menit kustom" />
                <Button size="sm" onClick={() => Number(customReminder) > 0 && save({ reminderMinutes: Math.min(1440, Number(customReminder)) }, `Pengingat ${customReminder} menit`)}>
                  Terapkan
                </Button>
              </div>
            </div>
            <Button size="sm" variant="ghost" icon="Bell" onClick={() => actions.notify({ type: "system", title: "Tes notifikasi LifeOS", body: "Jika kamu melihat ini, notifikasi berfungsi dengan baik." }, { toast: true })}>
              Kirim notifikasi uji
            </Button>
          </div>
        </Card>

        <Card className="p-5">
          <CardHeader title="Preferensi Kutipan Motivasi" subtitle="Kutipan harian berganti otomatis dari kategori yang dipilih" icon="Quote" />
          <div className="mt-4 flex flex-wrap gap-2">
            {QUOTE_CATEGORIES.map((c) => {
              const on = settings.quoteCategories.includes(c);
              return (
                <button
                  key={c}
                  onClick={() => {
                    const next = on ? settings.quoteCategories.filter((x) => x !== c) : [...settings.quoteCategories, c];
                    if (!next.length) return toast("info", "Pilih minimal satu kategori");
                    save({ quoteCategories: next }, "Preferensi kutipan disimpan");
                  }}
                  className={cn("btn btn-sm", on ? "!border-primary/50 !bg-primary/15 !text-fg" : "btn-ghost !border-line")}
                >
                  {on && <Icon name="Check" size={13} />} {c}
                </button>
              );
            })}
          </div>
        </Card>

        <Card className="p-5">
          <CardHeader title="Integrasi AI & Android" subtitle="Kunci API disimpan di server (environment variables), tidak pernah di browser" icon="Plug" />
          <div className="mt-4 space-y-4">
            <div className="grid gap-2 sm:grid-cols-3">
              {[
                { l: "LLM (Personal AI)", ok: health?.llm.configured, d: health?.llm.label ?? "LLM_API_KEY belum diatur → mode lokal" },
                { l: "INGEST_TOKEN server", ok: health?.ingest.tokenConfigured, d: health?.ingest.tokenConfigured ? "Terkonfigurasi" : "Belum diatur" },
                { l: "Upstash Redis", ok: health?.ingest.storageConfigured, d: health?.ingest.storageConfigured ? "Terhubung" : "Belum dihubungkan" },
              ].map((x) => (
                <div key={x.l} className="surface p-3">
                  <p className="flex items-center gap-1.5 text-xs font-semibold">
                    <Icon name={x.ok ? "CircleCheck" : "CircleDashed"} size={14} className={x.ok ? "text-success" : "text-muted"} /> {x.l}
                  </p>
                  <p className="mt-1 truncate text-[11px] text-muted" title={x.d}>
                    {health === null ? "Server tidak dapat dihubungi" : x.d}
                  </p>
                </div>
              ))}
            </div>
            <Field label="Token integrasi Android (harus sama dengan INGEST_TOKEN di Vercel)">
              <div className="flex gap-2">
                <input className="input font-mono !text-xs" type={showToken ? "text" : "password"} value={token} onChange={(e) => setToken(e.target.value)} placeholder="Tempel atau buat token" />
                <Button iconOnly icon={showToken ? "EyeOff" : "Eye"} onClick={() => setShowToken((s) => !s)} aria-label="Tampilkan token" />
                <Button icon="RefreshCw" onClick={() => (setToken(randomToken()), setShowToken(true))}>
                  Buat
                </Button>
              </div>
            </Field>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Toggle checked={settings.aiAgentEnabled} onChange={(v) => save({ aiAgentEnabled: v })} label="Sinkronisasi otomatis" description="Ambil transaksi dari server setiap 60 detik" />
              <Button variant="primary" icon="Check" onClick={() => save({ ingestToken: token.trim() }, "Token integrasi disimpan")}>
                Simpan token
              </Button>
            </div>
            <Field label="Konfirmasi otomatis transaksi terdeteksi">
              <Select
                value={String(settings.autoConfirmThreshold)}
                onChange={(e) => save({ autoConfirmThreshold: Number(e.target.value) })}
                options={[
                  { value: "1", label: "Selalu minta konfirmasi (disarankan)" },
                  { value: "0.9", label: "Otomatis jika keyakinan ≥ 90% & tanpa masalah" },
                  { value: "0.8", label: "Otomatis jika keyakinan ≥ 80% & tanpa masalah" },
                ]}
              />
            </Field>
            <p className="flex items-start gap-2 rounded-xl border border-success/25 bg-success/[0.07] p-3 text-xs text-muted">
              <Icon name="ShieldCheck" size={15} className="mt-px shrink-0 text-success" />
              LifeOS tidak pernah meminta password, PIN, atau OTP perbankan dan tidak login ke aplikasi bank. Hanya kolom transaksi (nominal, merchant, tanggal) yang disimpan — teks notifikasi lengkap dibuang.
            </p>
          </div>
        </Card>

        <Card className="p-5">
          <CardHeader title="Data & Backup" subtitle="Local-first: data di IndexedDB browser ini" icon="Database" />
          <div className="mt-4 grid grid-cols-5 gap-2 text-center">
            {Object.entries({ Jadwal: counts.schedules, Tugas: counts.tasks, Transaksi: counts.transactions, Goals: counts.goals, Catatan: counts.notes }).map(([k, v]) => (
              <div key={k} className="surface p-2">
                <p className="tabular text-base font-semibold">{v}</p>
                <p className="text-[10.5px] text-muted">{k}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <Button icon="Download" onClick={exportJson}>
              Ekspor semua (JSON)
            </Button>
            <Button icon="Upload" onClick={() => fileRef.current?.click()}>
              Pulihkan dari JSON
            </Button>
            <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => importJson(e.target.files?.[0])} />
            <Button icon="FileSpreadsheet" onClick={() => (downloadText(`lifeos-transaksi-${todayKey()}.csv`, transactionsToCSV(data.transactions, settings.initialBalance)), toast("success", "CSV transaksi diunduh"))}>
              Ekspor transaksi (CSV)
            </Button>
            <Button
              icon="FlaskConical"
              onClick={async () => {
                if (demoCount && !(await confirm({ title: "Tambah data demo lagi?", message: "Data demo sudah ada. Menambahkan lagi akan menggandakan data contoh." }))) return;
                await actions.loadDemo();
                toast("success", "Data demo dimuat");
              }}
            >
              Muat data demo
            </Button>
          </div>
          <div className="mt-5 space-y-3 rounded-2xl border border-danger/25 bg-danger/[0.05] p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-danger">
              <Icon name="TriangleAlert" size={15} /> Zona berbahaya
            </p>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">
                  Hapus data demo <Pill color="#A78BFA">{demoCount} item DEMO</Pill>
                </p>
                <label className="mt-1 flex items-center gap-2 text-xs text-muted">
                  <input type="checkbox" checked={resetFinance} onChange={(e) => setResetFinance(e.target.checked)} className="accent-[var(--color-primary)]" />
                  Reset juga saldo awal & anggaran ke 0 (mulai bersih)
                </label>
              </div>
              <Button
                variant="danger"
                size="sm"
                icon="Eraser"
                disabled={!demoCount}
                onClick={async () => {
                  if (!(await confirm({ title: "Hapus semua data demo?", message: `${demoCount} item berlabel DEMO akan dihapus. Data milikmu sendiri tetap aman.`, danger: true, confirmText: "Hapus data demo" }))) return;
                  const n = await actions.removeDemo(resetFinance);
                  toast("success", `${n} item demo dihapus`, "Sekarang database berisi data pribadimu saja.");
                }}
              >
                Hapus demo
              </Button>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-danger/20 pt-3">
              <div>
                <p className="text-sm font-medium">Hapus SEMUA data</p>
                <p className="text-xs text-muted">Jadwal, tugas, transaksi, goals, catatan & pengaturan akan dihapus permanen.</p>
              </div>
              <Button
                variant="danger"
                size="sm"
                icon="Trash2"
                onClick={async () => {
                  if (!(await confirm({ title: "Hapus SEMUA data?", message: "Tindakan ini tidak dapat dibatalkan. Ekspor backup JSON terlebih dahulu jika ingin menyimpan data.", danger: true, confirmText: "Hapus permanen", requireText: "HAPUS" }))) return;
                  await actions.resetAll();
                  toast("success", "Semua data dihapus", "Aplikasi kini kosong.");
                }}
              >
                Hapus semua
              </Button>
            </div>
          </div>
        </Card>
      </div>
      <p className="mt-6 text-center text-xs text-subtle">LifeOS v1.0 · Next.js · data lokal (IndexedDB) · zona waktu {settings.timezone}</p>
    </div>
  );
}
