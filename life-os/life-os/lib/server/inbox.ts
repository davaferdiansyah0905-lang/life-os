// Server-side transaction inbox for the Android companion.
// Uses Upstash Redis over its REST API (no SDK needed). Works with the env vars that
// Vercel's Upstash/KV integration injects automatically.
import { timingSafeEqual } from "node:crypto";

const LIST_KEY = "lifeos:inbox";
const HEARTBEAT_KEY = "lifeos:heartbeat";
const COUNT_KEY = "lifeos:detected";
const ERR_KEY = "lifeos:parse-errors";
const MAX_ITEMS = 500;

export function storeConfig() {
  const url = (process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "").trim().replace(/\/+$/, "");
  const token = (process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "").trim();
  return { configured: !!(url && token), url, token };
}

export function tokenConfigured() {
  return (process.env.INGEST_TOKEN || "").trim().length >= 12;
}

export function checkToken(req: Request): boolean {
  const expected = (process.env.INGEST_TOKEN || "").trim();
  if (expected.length < 12) return false;
  const header = req.headers.get("authorization") || "";
  const given = header.replace(/^Bearer\s+/i, "").trim() || (req.headers.get("x-ingest-token") || "").trim();
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function redis<T = unknown>(command: (string | number)[]): Promise<T> {
  const c = storeConfig();
  if (!c.configured) throw new Error("storage_not_configured");
  const res = await fetch(c.url, {
    method: "POST",
    headers: { authorization: `Bearer ${c.token}`, "content-type": "application/json" },
    body: JSON.stringify(command.map(String)),
    cache: "no-store",
  });
  const j = (await res.json()) as { result?: T; error?: string };
  if (!res.ok || j.error) throw new Error(j.error || `Redis HTTP ${res.status}`);
  return j.result as T;
}

export interface InboxItem {
  id: string;
  receivedAt: string; // ISO
  source: "android";
  app?: string;
  type: "income" | "expense" | null;
  amount: number | null;
  merchant: string | null;
  date: string;
  time: string | null;
  paymentMethod: string;
  category: string;
  confidence: number;
  issues: string[];
  bank?: string;
  engine: "rules" | "llm";
}

export async function pushItem(item: InboxItem) {
  await redis(["RPUSH", LIST_KEY, JSON.stringify(item)]);
  await redis(["LTRIM", LIST_KEY, -MAX_ITEMS, -1]);
  await redis(["INCR", COUNT_KEY]);
}

export async function markParseError() {
  await redis(["INCR", ERR_KEY]);
}

export async function heartbeat() {
  await redis(["SET", HEARTBEAT_KEY, new Date().toISOString()]);
}

export async function pullItems(max = 50): Promise<InboxItem[]> {
  const raw = await redis<string[]>(["LRANGE", LIST_KEY, 0, max - 1]);
  if (raw?.length) await redis(["LTRIM", LIST_KEY, raw.length, -1]);
  return (raw ?? [])
    .map((s) => {
      try {
        return JSON.parse(s) as InboxItem;
      } catch {
        return null;
      }
    })
    .filter((x): x is InboxItem => !!x);
}

export async function status() {
  const [hb, detected, errors, pending] = await Promise.all([
    redis<string | null>(["GET", HEARTBEAT_KEY]),
    redis<string | null>(["GET", COUNT_KEY]),
    redis<string | null>(["GET", ERR_KEY]),
    redis<number>(["LLEN", LIST_KEY]),
  ]);
  return { heartbeat: hb, detected: Number(detected || 0), parseErrors: Number(errors || 0), queued: Number(pending || 0) };
}
