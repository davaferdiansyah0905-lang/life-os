"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Icon, type IconName } from "../icons";
import { cn, money } from "@/lib/format";
import { fmtDateTime, fmtTime } from "@/lib/time";
import { useData } from "../providers/DataProvider";
import { useUI } from "../providers/UIProvider";
import { Button, Menu, Skeleton } from "../ui";
import { ModalHost } from "./ModalHost";
import { BackgroundJobs } from "./BackgroundJobs";
import { PersonalAI } from "../assistant/PersonalAI";

export const NAV: { href: string; label: string; icon: IconName; short?: string }[] = [
  { href: "/", label: "Ringkasan", icon: "LayoutDashboard", short: "Beranda" },
  { href: "/schedule", label: "Jadwal Saya", icon: "CalendarDays", short: "Jadwal" },
  { href: "/tasks", label: "Tugas", icon: "ListTodo" },
  { href: "/finance", label: "Keuangan", icon: "Wallet" },
  { href: "/goals", label: "Goals & Impian", icon: "Target", short: "Goals" },
  { href: "/notes", label: "Catatan", icon: "NotebookPen" },
  { href: "/analytics", label: "Analitik", icon: "ChartColumn" },
  { href: "/settings", label: "Pengaturan", icon: "Settings" },
];

const isActive = (path: string, href: string) => (href === "/" ? path === "/" : path === href || path.startsWith(href + "/"));

function Logo({ compact }: { compact?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <span className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-primary to-accent shadow-[0_8px_20px_-8px_rgb(37_99_235/0.9)]">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 17l5-5 4 4 7-8" />
          <path d="M15 8h5v5" />
        </svg>
      </span>
      {!compact && (
        <span className="leading-tight">
          <span className="block text-[15px] font-bold tracking-tight">
            Life<span className="text-accent">OS</span>
          </span>
          <span className="block text-[10.5px] text-muted">Personal Command Center</span>
        </span>
      )}
    </Link>
  );
}

function Sidebar() {
  const path = usePathname();
  const { settings, transactions } = useData();
  const { setAssistantOpen } = useUI();
  const pending = transactions.filter((t) => t.status === "pending").length;
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[76px] flex-col border-r border-line bg-bg2/70 px-3 py-5 backdrop-blur-xl md:flex xl:w-64 xl:px-4">
      <div className="px-1.5 xl:hidden">
        <Logo compact />
      </div>
      <div className="hidden px-1.5 xl:block">
        <Logo />
      </div>
      <nav className="mt-8 flex flex-1 flex-col gap-1 pl-3 xl:pl-3" aria-label="Navigasi utama">
        <p className="eyebrow mb-2 hidden px-2 xl:block">Menu</p>
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} data-active={isActive(path, n.href)} className="nav-item justify-center xl:justify-start" title={n.label}>
            <Icon name={n.icon} size={19} />
            <span className="hidden xl:inline">{n.label}</span>
            {n.href === "/finance" && pending > 0 && <span className="absolute top-1.5 right-1.5 grid size-4 place-items-center rounded-full bg-warning text-[9px] font-bold text-black xl:static xl:ml-auto">{pending}</span>}
          </Link>
        ))}
      </nav>
      <button onClick={() => setAssistantOpen(true)} className="mx-auto mb-4 hidden w-full overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/25 via-primary/10 to-transparent p-4 text-left transition hover:border-primary/60 xl:block">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Icon name="Sparkles" size={16} className="text-accent" /> PERSONAL AI
        </div>
        <p className="mt-1 text-xs text-muted">Tanya jadwal, tugas & keuanganmu.</p>
      </button>
      <div className="flex items-center gap-3 rounded-2xl px-1.5 xl:border xl:border-line xl:bg-card/60 xl:p-2.5">
        <span className="mx-auto grid size-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-highlight to-primary text-sm font-bold text-white xl:mx-0">{(settings.name || "D").slice(0, 1).toUpperCase()}</span>
        <div className="hidden min-w-0 xl:block">
          <p className="truncate text-sm font-semibold">{settings.name || "Pengguna"}</p>
          <p className="truncate text-[11px] text-muted">Data tersimpan lokal</p>
        </div>
      </div>
    </aside>
  );
}

function MobileNav() {
  const path = usePathname();
  const { mobileNavOpen, setMobileNavOpen } = useUI();
  const primary = NAV.slice(0, 4);
  const more = NAV.slice(4);
  const moreActive = more.some((n) => isActive(path, n.href));
  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-bg2/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden" aria-label="Navigasi bawah">
        <div className="grid grid-cols-5">
          {primary.map((n) => {
            const a = isActive(path, n.href);
            return (
              <Link key={n.href} href={n.href} className={cn("flex flex-col items-center gap-1 py-2.5 text-[10.5px] font-medium", a ? "text-fg" : "text-muted")}>
                <span className={cn("grid h-7 w-12 place-items-center rounded-full transition", a && "bg-primary/20 text-highlight")}>
                  <Icon name={n.icon} size={19} />
                </span>
                {n.short ?? n.label}
              </Link>
            );
          })}
          <button onClick={() => setMobileNavOpen(true)} className={cn("flex flex-col items-center gap-1 py-2.5 text-[10.5px] font-medium", moreActive ? "text-fg" : "text-muted")}>
            <span className={cn("grid h-7 w-12 place-items-center rounded-full", moreActive && "bg-primary/20 text-highlight")}>
              <Icon name="LayoutGrid" size={19} />
            </span>
            Lainnya
          </button>
        </div>
      </nav>
      {mobileNavOpen && (
        <div className="fixed inset-0 z-[60] md:hidden">
          <div className="absolute inset-0 animate-fade-in bg-black/60" onClick={() => setMobileNavOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 animate-slide-up rounded-t-3xl border-t border-line-strong bg-card p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20" />
            <div className="grid grid-cols-2 gap-2">
              {more.map((n) => (
                <Link key={n.href} href={n.href} onClick={() => setMobileNavOpen(false)} className={cn("surface flex items-center gap-3 p-4 text-sm font-medium", isActive(path, n.href) && "border-primary/50 bg-primary/10")}>
                  <Icon name={n.icon} size={18} className="text-highlight" />
                  {n.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function GlobalSearch() {
  const data = useData();
  const { setFocus } = useUI();
  const router = useRouter();
  const [q, setQ] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const h = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const k = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    };
    document.addEventListener("mousedown", h);
    window.addEventListener("keydown", k);
    return () => {
      document.removeEventListener("mousedown", h);
      window.removeEventListener("keydown", k);
    };
  }, []);

  const term = q.trim().toLowerCase();
  const results = React.useMemo(() => {
    if (term.length < 2) return [];
    const has = (...s: (string | undefined)[]) => s.some((x) => x?.toLowerCase().includes(term));
    type R = { group: string; icon: IconName; title: string; sub: string; go: () => void };
    const out: R[] = [];
    for (const t of data.tasks.filter((t) => has(t.title, t.description, t.category)).slice(0, 5))
      out.push({ group: "Tugas", icon: "ListTodo", title: t.title, sub: `Deadline ${fmtDateTime(t.deadline)}`, go: () => (setFocus({ type: "task", id: t.id }), router.push("/tasks")) });
    for (const s of data.schedules.filter((s) => has(s.title, s.description, s.location, s.category)).slice(0, 5))
      out.push({ group: "Jadwal", icon: "CalendarDays", title: s.title, sub: `${fmtTime(s.start)}–${fmtTime(s.end)} · ${s.category}`, go: () => (setFocus({ type: "schedule", id: s.id }), router.push("/schedule")) });
    for (const t of data.transactions.filter((t) => has(t.merchant, t.description, t.category)).slice(0, 5))
      out.push({ group: "Transaksi", icon: "Receipt", title: t.merchant || t.category, sub: `${t.type === "income" ? "+" : "−"}${money(t.amount)} · ${t.date}`, go: () => (setFocus({ type: "transaction", id: t.id, query: q.trim() }), router.push("/finance")) });
    for (const g of data.goals.filter((g) => has(g.title, g.description)).slice(0, 4))
      out.push({ group: "Goals", icon: "Target", title: g.title, sub: g.category, go: () => (setFocus({ type: "goal", id: g.id }), router.push("/goals")) });
    for (const n of data.notes.filter((n) => has(n.title, n.content)).slice(0, 4))
      out.push({ group: "Catatan", icon: "NotebookPen", title: n.title, sub: n.category, go: () => (setFocus({ type: "note", id: n.id }), router.push("/notes")) });
    return out;
  }, [term, data, q, router, setFocus]);

  return (
    <div className="relative w-full max-w-md" ref={ref}>
      <Icon name="Search" size={16} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted" />
      <input
        ref={inputRef}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Cari tugas, jadwal, transaksi, catatan…"
        className="input !h-10 !rounded-xl !border-line !bg-card/70 !pl-10 !pr-14"
        aria-label="Pencarian global"
      />
      <kbd className="pointer-events-none absolute top-1/2 right-3 hidden -translate-y-1/2 rounded-md border border-line px-1.5 py-0.5 text-[10px] text-muted sm:block">Ctrl K</kbd>
      {open && term.length >= 2 && (
        <div className="absolute top-full right-0 left-0 z-50 mt-2 max-h-[60vh] animate-slide-up overflow-y-auto rounded-2xl border border-line-strong bg-elevated p-1.5 shadow-[var(--shadow-pop)]">
          {results.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted">Tidak ada hasil untuk &ldquo;{q}&rdquo;</p>
          ) : (
            results.map((r, i) => (
              <React.Fragment key={i}>
                {(i === 0 || results[i - 1].group !== r.group) && <p className="eyebrow px-2.5 pt-2 pb-1">{r.group}</p>}
                <button
                  onClick={() => {
                    r.go();
                    setOpen(false);
                    setQ("");
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left hover:bg-white/5"
                >
                  <Icon name={r.icon} size={16} className="shrink-0 text-highlight" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm">{r.title}</span>
                    <span className="block truncate text-xs text-muted">{r.sub}</span>
                  </span>
                </button>
              </React.Fragment>
            ))
          )}
        </div>
      )}
    </div>
  );
}

const NOTIF_ICON: Record<string, IconName> = {
  schedule: "CalendarClock",
  deadline: "Clock",
  overdue: "CircleAlert",
  conflict: "TriangleAlert",
  budget: "Wallet",
  transaction: "Receipt",
  goal: "Trophy",
  system: "Info",
};

function NotificationBell() {
  const { notifications, actions } = useData();
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  const unread = notifications.filter((n) => !n.read).length;
  React.useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} className="btn btn-icon relative !rounded-xl !border-line !bg-card/70" aria-label="Notifikasi">
        <Icon name="Bell" size={18} />
        {unread > 0 && <span className="absolute -top-1 -right-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">{unread > 9 ? "9+" : unread}</span>}
      </button>
      {open && (
        <div className="fixed inset-x-3 top-16 z-50 animate-slide-up rounded-2xl border border-line-strong bg-elevated shadow-[var(--shadow-pop)] sm:absolute sm:inset-x-auto sm:top-full sm:right-0 sm:mt-2 sm:w-96">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <p className="text-sm font-semibold">Notifikasi</p>
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" icon="CheckCheck" onClick={() => actions.markAllRead()} disabled={!unread}>
                Tandai dibaca
              </Button>
              <Button size="sm" variant="ghost" icon="Trash2" onClick={() => actions.clearNotifications()} disabled={!notifications.length} aria-label="Hapus semua" iconOnly />
            </div>
          </div>
          <div className="max-h-[60vh] overflow-y-auto p-1.5">
            {notifications.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-muted">Belum ada notifikasi. Pengingat jadwal, deadline, dan anggaran akan muncul di sini.</p>
            ) : (
              notifications.slice(0, 40).map((n) => (
                <button
                  key={n.id}
                  onClick={() => {
                    if (!n.read) actions.upsert("notifications", { ...n, read: true });
                    if (n.href) router.push(n.href);
                    setOpen(false);
                  }}
                  className={cn("flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-white/5", !n.read && "bg-primary/[0.07]")}
                >
                  <Icon name={NOTIF_ICON[n.type] ?? "Bell"} size={16} className={cn("mt-0.5 shrink-0", n.type === "budget" || n.type === "overdue" || n.type === "conflict" ? "text-warning" : "text-highlight")} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{n.title}</span>
                    <span className="block text-xs text-muted">{n.body}</span>
                    <span className="mt-0.5 block text-[10.5px] text-subtle">{fmtDateTime(n.createdAt)}</span>
                  </span>
                  {!n.read && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-accent" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function QuickAdd() {
  const { openModal } = useUI();
  return (
    <Menu
      trigger={(toggle) => (
        <Button variant="primary" icon="Plus" onClick={toggle} className="!rounded-xl">
          <span className="hidden sm:inline">Tambah</span>
        </Button>
      )}
      items={[
        { label: "Tugas", icon: "ListTodo", onClick: () => openModal({ kind: "task" }) },
        { label: "Jadwal", icon: "CalendarPlus", onClick: () => openModal({ kind: "schedule" }) },
        { label: "Transaksi", icon: "Receipt", onClick: () => openModal({ kind: "transaction" }) },
        { label: "Goal", icon: "Target", onClick: () => openModal({ kind: "goal" }) },
        { label: "Catatan", icon: "NotebookPen", onClick: () => openModal({ kind: "note" }) },
      ]}
    />
  );
}

function Topbar() {
  const { setAssistantOpen } = useUI();
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg/75 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1500px] items-center gap-3 px-4 sm:px-6 lg:px-8">
        <div className="md:hidden">
          <Logo compact />
        </div>
        <div className="hidden flex-1 sm:block">
          <GlobalSearch />
        </div>
        <div className="flex-1 sm:hidden" />
        <button onClick={() => setAssistantOpen(true)} className="btn !rounded-xl !border-primary/40 !bg-primary/10 text-highlight hover:!bg-primary/20" aria-label="Buka Personal AI">
          <Icon name="Sparkles" size={16} />
          <span className="hidden lg:inline">AI</span>
        </button>
        <NotificationBell />
        <QuickAdd />
      </div>
      <div className="px-4 pb-3 sm:hidden">
        <GlobalSearch />
      </div>
    </header>
  );
}

function LoadingScreen() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-10 w-72" />
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-52 lg:col-span-2" />
        <Skeleton className="h-52" />
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-72" />
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { ready, storageError } = useData();
  const path = usePathname();
  React.useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [path]);
  return (
    <div className="min-h-dvh">
      <Sidebar />
      <div className="md:pl-[76px] xl:pl-64">
        <Topbar />
        <main className="mx-auto max-w-[1500px] px-4 pt-6 pb-28 sm:px-6 md:pb-12 lg:px-8">
          {storageError && (
            <div className="mb-5 flex items-start gap-3 rounded-2xl border border-danger/40 bg-danger/10 p-4 text-sm">
              <Icon name="TriangleAlert" size={18} className="mt-0.5 shrink-0 text-danger" />
              <div>
                <p className="font-semibold">Penyimpanan lokal tidak tersedia</p>
                <p className="mt-0.5 text-muted">{storageError} Data tidak akan tersimpan setelah halaman ditutup. Nonaktifkan mode penyamaran / private browsing.</p>
              </div>
            </div>
          )}
          {ready ? <div key={path} className="animate-fade-in">{children}</div> : <LoadingScreen />}
        </main>
      </div>
      <MobileNav />
      {ready && (
        <>
          <ModalHost />
          <BackgroundJobs />
          <PersonalAI />
        </>
      )}
    </div>
  );
}

