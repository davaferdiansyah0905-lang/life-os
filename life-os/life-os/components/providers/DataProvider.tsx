"use client";

import * as React from "react";
import type { AgentMeta, AppData, AppNotification, CollectionMap, CollectionName, Settings } from "@/lib/types";
import * as db from "@/lib/db";
import { DEFAULT_SETTINGS } from "@/lib/constants";
import { buildDemoData } from "@/lib/demo";
import { setTimeFormat, setTimezone, nowLocal } from "@/lib/time";
import { setCurrency, uid } from "@/lib/format";
import { useToast } from "./Toast";

const EMPTY: AppData = {
  schedules: [],
  tasks: [],
  transactions: [],
  goals: [],
  notes: [],
  rules: [],
  notifications: [],
  favorites: [],
  settings: DEFAULT_SETTINGS,
  agent: { detected: 0, parseErrors: 0 },
};

export interface BackupFile {
  app: "lifeos";
  version: 1;
  exportedAt: string;
  data: AppData;
}

interface Actions {
  upsert: <K extends CollectionName>(col: K, item: CollectionMap[K]) => Promise<void>;
  upsertMany: <K extends CollectionName>(col: K, items: CollectionMap[K][]) => Promise<void>;
  remove: (col: CollectionName, id: string) => Promise<void>;
  removeMany: (col: CollectionName, ids: string[]) => Promise<void>;
  updateSettings: (patch: Partial<Settings>) => Promise<void>;
  updateAgent: (patch: Partial<AgentMeta>) => Promise<void>;
  setFavorites: (fav: number[]) => Promise<void>;
  notify: (n: Omit<AppNotification, "id" | "createdAt" | "read">, opts?: { browser?: boolean; toast?: boolean }) => void;
  markAllRead: () => Promise<void>;
  clearNotifications: () => Promise<void>;
  exportAll: () => BackupFile;
  importAll: (file: unknown) => Promise<{ ok: boolean; error?: string }>;
  removeDemo: (resetFinance: boolean) => Promise<number>;
  loadDemo: () => Promise<void>;
  resetAll: () => Promise<void>;
}

type Ctx = AppData & { ready: boolean; storageError?: string; actions: Actions };
const DataCtx = React.createContext<Ctx | null>(null);

function applyPrefs(s: Settings) {
  setTimezone(s.timezone || "Asia/Jakarta");
  setTimeFormat(s.timeFormat);
  setCurrency(s.currency);
}

export function applyTheme(theme: Settings["theme"]) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem("lifeos-theme", theme);
  } catch {}
}

function showBrowserNotification(title: string, body: string) {
  try {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    const n = new Notification(title, { body, icon: "/icon.svg", tag: title });
    n.onclick = () => {
      window.focus();
      n.close();
    };
  } catch {
    /* some mobile browsers only allow notifications from a service worker */
  }
}

export function DataProvider({ children }: { children: React.ReactNode }) {
  const { toast } = useToast();
  const [data, setData] = React.useState<AppData>(EMPTY);
  const [ready, setReady] = React.useState(false);
  const [storageError, setStorageError] = React.useState<string>();
  const dataRef = React.useRef(data);
  dataRef.current = data;

  // Apply locale/timezone prefs synchronously so children render with correct settings.
  React.useMemo(() => applyPrefs(data.settings), [data.settings]);

  const fail = React.useCallback(
    (e: unknown) => {
      console.error(e);
      toast("error", "Gagal menyimpan data", (e as Error)?.message ?? String(e));
    },
    [toast],
  );

  // ── Load (and seed demo on first run) ──
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!db.idbAvailable()) throw new Error("Browser ini tidak mendukung IndexedDB.");
        let seeded = await db.kvGet<boolean>("seeded");
        if (!seeded) {
          const demo = buildDemoData();
          await db.bulkPut("schedules", demo.schedules);
          await db.bulkPut("tasks", demo.tasks);
          await db.bulkPut("transactions", demo.transactions);
          await db.bulkPut("goals", demo.goals);
          await db.bulkPut("notes", demo.notes);
          await db.kvSet("settings", { ...DEFAULT_SETTINGS, ...demo.settings });
          await db.kvSet("seeded", true);
          seeded = true;
        }
        const [schedules, tasks, transactions, goals, notes, rules, notifications, settings, favorites, agent] = await Promise.all([
          db.getAll<CollectionMap["schedules"]>("schedules"),
          db.getAll<CollectionMap["tasks"]>("tasks"),
          db.getAll<CollectionMap["transactions"]>("transactions"),
          db.getAll<CollectionMap["goals"]>("goals"),
          db.getAll<CollectionMap["notes"]>("notes"),
          db.getAll<CollectionMap["rules"]>("rules"),
          db.getAll<CollectionMap["notifications"]>("notifications"),
          db.kvGet<Settings>("settings"),
          db.kvGet<number[]>("favorites"),
          db.kvGet<AgentMeta>("agent"),
        ]);
        if (cancelled) return;
        const s = { ...DEFAULT_SETTINGS, ...(settings ?? {}) };
        applyPrefs(s);
        applyTheme(s.theme);
        setData({
          schedules,
          tasks,
          transactions,
          goals,
          notes,
          rules,
          notifications: notifications.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
          settings: s,
          favorites: favorites ?? [],
          agent: { detected: 0, parseErrors: 0, ...(agent ?? {}) },
        });
      } catch (e) {
        console.error(e);
        setStorageError((e as Error).message);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const actions = React.useMemo<Actions>(() => {
    const stamp = <T extends object>(item: T): T => ({ ...item, updatedAt: nowLocal() });
    const a: Actions = {
      async upsert(col, item) {
        const v = col === "notifications" || col === "rules" ? item : stamp(item);
        setData((d) => {
          const list = d[col] as { id: string }[];
          const idx = list.findIndex((x) => x.id === (v as { id: string }).id);
          const next = idx >= 0 ? list.map((x, i) => (i === idx ? v : x)) : [v, ...list];
          return { ...d, [col]: next };
        });
        try {
          await db.put(col, v);
        } catch (e) {
          fail(e);
        }
      },
      async upsertMany(col, items) {
        if (!items.length) return;
        const vs = items.map((i) => (col === "notifications" || col === "rules" ? i : stamp(i)));
        setData((d) => {
          const map = new Map((d[col] as { id: string }[]).map((x) => [x.id, x]));
          for (const v of vs) map.set((v as { id: string }).id, v);
          return { ...d, [col]: [...map.values()] };
        });
        try {
          await db.bulkPut(col, vs);
        } catch (e) {
          fail(e);
        }
      },
      async remove(col, id) {
        setData((d) => ({ ...d, [col]: (d[col] as { id: string }[]).filter((x) => x.id !== id) }));
        try {
          await db.remove(col, id);
        } catch (e) {
          fail(e);
        }
      },
      async removeMany(col, ids) {
        const set = new Set(ids);
        setData((d) => ({ ...d, [col]: (d[col] as { id: string }[]).filter((x) => !set.has(x.id)) }));
        try {
          await db.bulkRemove(col, ids);
        } catch (e) {
          fail(e);
        }
      },
      async updateSettings(patch) {
        const next = { ...dataRef.current.settings, ...patch };
        applyPrefs(next);
        if (patch.theme) applyTheme(patch.theme);
        setData((d) => ({ ...d, settings: next }));
        try {
          await db.kvSet("settings", next);
        } catch (e) {
          fail(e);
        }
      },
      async updateAgent(patch) {
        const next = { ...dataRef.current.agent, ...patch };
        setData((d) => ({ ...d, agent: next }));
        try {
          await db.kvSet("agent", next);
        } catch (e) {
          fail(e);
        }
      },
      async setFavorites(fav) {
        setData((d) => ({ ...d, favorites: fav }));
        try {
          await db.kvSet("favorites", fav);
        } catch (e) {
          fail(e);
        }
      },
      notify(n, opts = {}) {
        const s = dataRef.current.settings;
        if (!s.notificationsEnabled) return;
        const item: AppNotification = { ...n, id: uid("ntf-"), createdAt: nowLocal(), read: false };
        setData((d) => ({ ...d, notifications: [item, ...d.notifications].slice(0, 150) }));
        db.put("notifications", item).catch(() => {});
        if (opts.toast) toast(n.type === "budget" || n.type === "overdue" || n.type === "conflict" ? "warning" : "info", n.title, n.body);
        if (opts.browser !== false && s.browserNotifications) showBrowserNotification(n.title, n.body);
        // prune old notifications in storage
        const all = dataRef.current.notifications;
        if (all.length > 150) db.bulkRemove("notifications", all.slice(150).map((x) => x.id)).catch(() => {});
      },
      async markAllRead() {
        const updated = dataRef.current.notifications.map((x) => ({ ...x, read: true }));
        setData((d) => ({ ...d, notifications: updated }));
        await db.bulkPut("notifications", updated).catch(fail);
      },
      async clearNotifications() {
        setData((d) => ({ ...d, notifications: [] }));
        await db.clear("notifications").catch(fail);
      },
      exportAll() {
        return { app: "lifeos", version: 1, exportedAt: new Date().toISOString(), data: dataRef.current };
      },
      async importAll(file) {
        const f = file as Partial<BackupFile>;
        if (!f || f.app !== "lifeos" || !f.data || typeof f.data !== "object") return { ok: false, error: "File bukan backup LifeOS yang valid." };
        const d = f.data as Partial<AppData>;
        const arr = <T,>(x: unknown): T[] => (Array.isArray(x) ? (x as T[]).filter((i) => i && typeof i === "object" && "id" in (i as object)) : []);
        const next: AppData = {
          schedules: arr(d.schedules),
          tasks: arr(d.tasks),
          transactions: arr(d.transactions),
          goals: arr(d.goals),
          notes: arr(d.notes),
          rules: arr(d.rules),
          notifications: arr(d.notifications),
          favorites: Array.isArray(d.favorites) ? d.favorites.filter((n) => typeof n === "number") : [],
          settings: { ...DEFAULT_SETTINGS, ...(d.settings ?? {}) },
          agent: { detected: 0, parseErrors: 0, ...(d.agent ?? {}) },
        };
        try {
          await db.replaceAll(
            { schedules: next.schedules, tasks: next.tasks, transactions: next.transactions, goals: next.goals, notes: next.notes, rules: next.rules, notifications: next.notifications },
            { settings: next.settings, favorites: next.favorites, agent: next.agent, seeded: true },
          );
          applyPrefs(next.settings);
          applyTheme(next.settings.theme);
          setData(next);
          return { ok: true };
        } catch (e) {
          return { ok: false, error: (e as Error).message };
        }
      },
      async removeDemo(resetFinance) {
        const d = dataRef.current;
        let count = 0;
        for (const col of ["schedules", "tasks", "transactions", "goals", "notes"] as const) {
          const ids = (d[col] as { id: string; isDemo?: boolean }[]).filter((x) => x.isDemo).map((x) => x.id);
          count += ids.length;
          if (ids.length) await a.removeMany(col, ids);
        }
        if (resetFinance) await a.updateSettings({ initialBalance: 0, monthlyBudget: 0, weeklyBudget: 0, dailyBudget: 0, categoryBudgets: {} });
        return count;
      },
      async loadDemo() {
        const demo = buildDemoData();
        await a.upsertMany("schedules", demo.schedules);
        await a.upsertMany("tasks", demo.tasks);
        await a.upsertMany("transactions", demo.transactions);
        await a.upsertMany("goals", demo.goals);
        await a.upsertMany("notes", demo.notes);
      },
      async resetAll() {
        await db.replaceAll({}, { settings: { ...DEFAULT_SETTINGS, name: dataRef.current.settings.name }, seeded: true, favorites: [], agent: { detected: 0, parseErrors: 0 } });
        const s = { ...DEFAULT_SETTINGS, name: dataRef.current.settings.name };
        applyPrefs(s);
        applyTheme(s.theme);
        setData({ ...EMPTY, settings: s });
      },
    };
    return a;
  }, [fail, toast]);

  const value = React.useMemo<Ctx>(() => ({ ...data, ready, storageError, actions }), [data, ready, storageError, actions]);
  return <DataCtx.Provider value={value}>{children}</DataCtx.Provider>;
}

export function useData() {
  const ctx = React.useContext(DataCtx);
  if (!ctx) throw new Error("useData must be used inside DataProvider");
  return ctx;
}
