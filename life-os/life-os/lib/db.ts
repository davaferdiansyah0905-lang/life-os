// Minimal, dependency-free IndexedDB layer (local-first persistence).
// Every collection is an object store keyed by `id`; settings & metadata live in "kv".

import type { CollectionName } from "./types";

const DB_NAME = "lifeos-db";
const DB_VERSION = 1;
export const COLLECTIONS: CollectionName[] = ["schedules", "tasks", "transactions", "goals", "notes", "rules", "notifications"];

let dbPromise: Promise<IDBDatabase> | null = null;

export function idbAvailable() {
  return typeof indexedDB !== "undefined";
}

function open(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const name of COLLECTIONS) {
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("kv")) db.createObjectStore("kv", { keyPath: "key" });
    };
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error("IndexedDB diblokir oleh tab lain. Tutup tab LifeOS lain lalu muat ulang."));
  });
  dbPromise.catch(() => (dbPromise = null));
  return dbPromise;
}

function wrap<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error("Transaksi IndexedDB dibatalkan"));
  });
}

export async function getAll<T>(store: string): Promise<T[]> {
  const db = await open();
  return wrap(db.transaction(store, "readonly").objectStore(store).getAll()) as Promise<T[]>;
}

export async function put<T>(store: string, value: T): Promise<void> {
  const db = await open();
  const tx = db.transaction(store, "readwrite");
  tx.objectStore(store).put(value);
  return done(tx);
}

export async function bulkPut<T>(store: string, values: T[]): Promise<void> {
  if (!values.length) return;
  const db = await open();
  const tx = db.transaction(store, "readwrite");
  const os = tx.objectStore(store);
  for (const v of values) os.put(v);
  return done(tx);
}

export async function remove(store: string, id: string): Promise<void> {
  const db = await open();
  const tx = db.transaction(store, "readwrite");
  tx.objectStore(store).delete(id);
  return done(tx);
}

export async function bulkRemove(store: string, ids: string[]): Promise<void> {
  if (!ids.length) return;
  const db = await open();
  const tx = db.transaction(store, "readwrite");
  const os = tx.objectStore(store);
  for (const id of ids) os.delete(id);
  return done(tx);
}

export async function clear(store: string): Promise<void> {
  const db = await open();
  const tx = db.transaction(store, "readwrite");
  tx.objectStore(store).clear();
  return done(tx);
}

export async function kvGet<T>(key: string): Promise<T | undefined> {
  const db = await open();
  const row = (await wrap(db.transaction("kv", "readonly").objectStore("kv").get(key))) as { key: string; value: T } | undefined;
  return row?.value;
}

export async function kvSet<T>(key: string, value: T): Promise<void> {
  const db = await open();
  const tx = db.transaction("kv", "readwrite");
  tx.objectStore("kv").put({ key, value });
  return done(tx);
}

/** Replace the full content of every store atomically (used by restore). */
export async function replaceAll(data: Record<string, unknown[]>, kv: Record<string, unknown>): Promise<void> {
  const db = await open();
  const stores = [...COLLECTIONS, "kv"];
  const tx = db.transaction(stores, "readwrite");
  for (const name of COLLECTIONS) {
    const os = tx.objectStore(name);
    os.clear();
    for (const v of data[name] ?? []) os.put(v);
  }
  const kvs = tx.objectStore("kv");
  kvs.clear();
  for (const [key, value] of Object.entries(kv)) kvs.put({ key, value });
  return done(tx);
}
