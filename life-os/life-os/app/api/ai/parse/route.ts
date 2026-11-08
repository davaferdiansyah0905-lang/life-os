import { NextResponse } from "next/server";
import { parseNotification } from "@/lib/parser";
import { llmConfig } from "@/lib/server/llm";
import { refineWithLLM } from "@/lib/server/refine";
import type { CategoryRule } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: { text?: unknown; rules?: unknown; useLLM?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body harus JSON" }, { status: 400 });
  }
  const text = typeof body.text === "string" ? body.text.slice(0, 2000) : "";
  if (!text.trim()) return NextResponse.json({ error: "Teks notifikasi kosong" }, { status: 400 });
  const rules = Array.isArray(body.rules) ? (body.rules as CategoryRule[]).slice(0, 500) : [];
  const base = parseNotification(text, rules);
  if (body.useLLM !== false && llmConfig().configured) {
    try {
      return NextResponse.json({ result: await refineWithLLM(text, base) });
    } catch (e) {
      return NextResponse.json({ result: base, warning: `LLM gagal, memakai parser aturan: ${(e as Error).message}` });
    }
  }
  return NextResponse.json({ result: base });
}
