import { NextResponse } from "next/server";
import { parseNotification } from "@/lib/parser";
import { llmConfig } from "@/lib/server/llm";
import { refineWithLLM } from "@/lib/server/refine";
import { checkToken, heartbeat, markParseError, pullItems, pushItem, status, storeConfig, tokenConfigured, type InboxItem } from "@/lib/server/inbox";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function guard(req: Request) {
  if (!tokenConfigured()) return NextResponse.json({ error: "INGEST_TOKEN belum diatur di environment variables (min. 12 karakter)." }, { status: 503 });
  if (!storeConfig().configured) return NextResponse.json({ error: "Penyimpanan antrean belum dikonfigurasi. Hubungkan Upstash Redis (KV_REST_API_URL & KV_REST_API_TOKEN)." }, { status: 503 });
  if (!checkToken(req)) return NextResponse.json({ error: "Token tidak valid" }, { status: 401 });
  return null;
}

/**
 * POST /api/ingest — called by the Android companion.
 * Body: { "text": "<isi notifikasi>", "app": "com.bca", "postedAt": 1731111111000 }  or  { "heartbeat": true }
 * Only parsed fields are stored; the raw notification text is discarded after parsing.
 */
export async function POST(req: Request) {
  const denied = guard(req);
  if (denied) return denied;
  let body: { text?: unknown; app?: unknown; heartbeat?: unknown; postedAt?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body harus JSON" }, { status: 400 });
  }
  try {
    await heartbeat();
    if (body.heartbeat === true && !body.text) return NextResponse.json({ ok: true, heartbeat: true });
    const text = typeof body.text === "string" ? body.text.slice(0, 1000) : "";
    if (!text.trim()) return NextResponse.json({ error: "Teks notifikasi kosong" }, { status: 400 });
    const ref = typeof body.postedAt === "number" && body.postedAt > 0 ? new Date(body.postedAt) : new Date();
    let parsed = parseNotification(text, [], ref);
    if (llmConfig().configured && parsed.confidence < 0.85) {
      try {
        parsed = await refineWithLLM(text, parsed);
      } catch {
        /* keep rule-based result */
      }
    }
    if (!parsed.amount || !parsed.type) {
      await markParseError();
      return NextResponse.json({ ok: false, reason: "Bukan notifikasi transaksi atau tidak dapat diparsing", issues: parsed.issues }, { status: 422 });
    }
    const item: InboxItem = {
      id: `and-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      receivedAt: new Date().toISOString(),
      source: "android",
      app: typeof body.app === "string" ? body.app.slice(0, 80) : undefined,
      type: parsed.type,
      amount: parsed.amount,
      merchant: parsed.merchant,
      date: parsed.date,
      time: parsed.time,
      paymentMethod: parsed.paymentMethod,
      category: parsed.category,
      confidence: parsed.confidence,
      issues: parsed.issues,
      bank: parsed.bank,
      engine: parsed.engine,
    };
    await pushItem(item);
    return NextResponse.json({ ok: true, id: item.id, parsed: { type: item.type, amount: item.amount, merchant: item.merchant, category: item.category, confidence: item.confidence } });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

/** GET /api/ingest — dashboard pulls queued transactions (?peek=1 only returns status). */
export async function GET(req: Request) {
  const denied = guard(req);
  if (denied) return denied;
  try {
    const peek = new URL(req.url).searchParams.get("peek") === "1";
    const st = await status();
    const items = peek ? [] : await pullItems(50);
    return NextResponse.json({ ok: true, ...st, items });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
