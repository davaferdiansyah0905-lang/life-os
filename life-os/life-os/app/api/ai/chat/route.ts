import { NextResponse } from "next/server";
import { completeJSON, extractJSON, llmConfig, providerLabel } from "@/lib/server/llm";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SYSTEM = `Kamu adalah "PERSONAL AI", asisten pribadi dalam aplikasi LifeOS milik pengguna.
ATURAN WAJIB:
1. Jawab HANYA berdasarkan objek DATA yang diberikan (jadwal, tugas, keuangan, goals). Jangan mengarang angka, jadwal, atau fakta.
2. Jika data tidak cukup untuk menjawab, katakan dengan jujur bahwa datanya belum tercatat.
3. Gunakan Bahasa Indonesia yang ringkas, hangat, dan praktis. Format uang dalam Rupiah (contoh Rp25.000) kecuali currency lain.
4. Waktu sekarang ada di DATA.now (zona waktu DATA.timezone). "Besok" = tanggal setelah DATA.now.
5. Jika pengguna meminta dibuatkan jadwal, usulkan SATU slot yang tidak bertabrakan dengan jadwal di DATA.schedule, dan isi "proposal". Aplikasi akan memvalidasi ulang bentrok sebelum menyimpan.
Keluarkan HANYA JSON valid dengan skema:
{"answer": string, "proposal": null | {"title": string, "date": "YYYY-MM-DD", "start": "HH:mm", "end": "HH:mm", "category": "Akademik"|"Organisasi"|"Kerja"|"Pribadi"|"Olahraga"|"Ibadah"|"Istirahat"|"Lainnya", "description": string}}`;

export async function POST(req: Request) {
  const cfg = llmConfig();
  if (!cfg.configured) {
    return NextResponse.json({ configured: false, error: "LLM belum dikonfigurasi. Atur LLM_API_KEY di environment variables." }, { status: 503 });
  }
  let body: { message?: unknown; context?: unknown; history?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body harus JSON" }, { status: 400 });
  }
  const message = typeof body.message === "string" ? body.message.slice(0, 1000).trim() : "";
  if (!message) return NextResponse.json({ error: "Pesan kosong" }, { status: 400 });
  const context = JSON.stringify(body.context ?? {}).slice(0, 24000);
  const history = Array.isArray(body.history)
    ? (body.history as { role?: string; text?: string }[])
        .slice(-6)
        .map((h) => `${h.role === "user" ? "Pengguna" : "Asisten"}: ${String(h.text ?? "").slice(0, 400)}`)
        .join("\n")
    : "";
  try {
    const raw = await completeJSON(SYSTEM, `DATA = ${context}\n\n${history ? `Riwayat singkat:\n${history}\n\n` : ""}Pertanyaan pengguna: ${message}`, { maxTokens: 900 });
    const j = extractJSON<{ answer?: unknown; proposal?: unknown }>(raw);
    const answer = typeof j?.answer === "string" ? j.answer : raw.trim();
    const p = j?.proposal as Record<string, unknown> | null | undefined;
    const proposal =
      p && typeof p === "object" && typeof p.date === "string" && typeof p.start === "string" && typeof p.end === "string"
        ? { title: String(p.title ?? "Sesi baru").slice(0, 80), date: p.date, start: p.start, end: p.end, category: String(p.category ?? "Akademik"), description: String(p.description ?? "Dibuat oleh Personal AI").slice(0, 200) }
        : null;
    return NextResponse.json({ configured: true, provider: providerLabel(), answer, proposal });
  } catch (e) {
    return NextResponse.json({ configured: true, error: (e as Error).message }, { status: 502 });
  }
}
