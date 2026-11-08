"use client";

import * as React from "react";
import { Icon } from "../icons";
import { useData } from "../providers/DataProvider";
import { useUI } from "../providers/UIProvider";
import { useToast } from "../providers/Toast";
import { buildContext, localAnswer, validateProposal, type ProposedSchedule } from "@/lib/assistant";
import { SCHEDULE_CATEGORIES } from "@/lib/constants";
import { fmtDateLong, fmtTime, nowLocal } from "@/lib/time";
import { cn, uid } from "@/lib/format";

interface Msg {
  id: string;
  role: "user" | "ai";
  text: string;
  engine?: "local" | "llm";
  proposal?: ProposedSchedule;
  added?: boolean;
  note?: string;
}

const SUGGESTIONS = [
  "Apa saja kegiatan saya hari ini?",
  "Apakah ada jadwal yang bertabrakan besok?",
  "Berapa pengeluaran saya minggu ini?",
  "Kategori pengeluaran terbesar bulan ini apa?",
  "Buatkan jadwal belajar selama 2 jam besok",
  "Tugas apa yang harus segera saya selesaikan?",
  "Apakah target saya masih sesuai dengan deadline?",
];

function RichText({ text }: { text: string }) {
  return (
    <div className="space-y-1 text-sm leading-relaxed">
      {text.split("\n").map((line, i) =>
        line.trim() === "" ? (
          <div key={i} className="h-1" />
        ) : (
          <p key={i} className={line.startsWith("•") ? "pl-1" : ""}>
            {line.split(/(\*\*[^*]+\*\*)/g).map((part, j) => (part.startsWith("**") && part.endsWith("**") ? <strong key={j}>{part.slice(2, -2)}</strong> : <React.Fragment key={j}>{part}</React.Fragment>))}
          </p>
        ),
      )}
    </div>
  );
}

export function PersonalAI() {
  const data = useData();
  const { assistantOpen, setAssistantOpen, openModal } = useUI();
  const { toast } = useToast();
  const [msgs, setMsgs] = React.useState<Msg[]>([]);
  const [input, setInput] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [llm, setLlm] = React.useState<{ configured: boolean; label: string | null } | null>(null);
  const [useLLM, setUseLLM] = React.useState(true);
  const endRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!assistantOpen || llm) return;
    fetch("/api/health", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setLlm({ configured: !!j?.llm?.configured, label: j?.llm?.label ?? null }))
      .catch(() => setLlm({ configured: false, label: null }));
  }, [assistantOpen, llm]);

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [msgs, busy]);

  React.useEffect(() => {
    if (!assistantOpen) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && setAssistantOpen(false);
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [assistantOpen, setAssistantOpen]);

  const ask = async (q: string) => {
    const question = q.trim();
    if (!question || busy) return;
    setInput("");
    const userMsg: Msg = { id: uid("m"), role: "user", text: question };
    setMsgs((m) => [...m, userMsg]);
    setBusy(true);
    try {
      if (llm?.configured && useLLM) {
        try {
          const res = await fetch("/api/ai/chat", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ message: question, context: buildContext(data), history: msgs.slice(-6).map((m) => ({ role: m.role === "user" ? "user" : "assistant", text: m.text })) }),
          });
          const j = await res.json();
          if (!res.ok) throw new Error(j?.error || `HTTP ${res.status}`);
          setMsgs((m) => [...m, { id: uid("m"), role: "ai", text: j.answer || "(jawaban kosong)", engine: "llm", proposal: j.proposal ?? undefined }]);
          return;
        } catch (e) {
          const r = localAnswer(question, data);
          setMsgs((m) => [...m, { id: uid("m"), role: "ai", text: r.text, engine: "local", proposal: r.proposal, note: `LLM tidak dapat dihubungi (${(e as Error).message}). Jawaban dari mesin lokal.` }]);
          return;
        }
      }
      await new Promise((r) => setTimeout(r, 250));
      const r = localAnswer(question, data);
      setMsgs((m) => [...m, { id: uid("m"), role: "ai", text: r.text, engine: "local", proposal: r.proposal }]);
    } finally {
      setBusy(false);
    }
  };

  const addProposal = async (msg: Msg) => {
    const p = msg.proposal!;
    const category = (SCHEDULE_CATEGORIES as readonly string[]).includes(p.category) ? p.category : "Akademik";
    const v = validateProposal(p, data.schedules);
    if (!v.ok) {
      if ("conflicts" in v && v.conflicts?.length) {
        toast("warning", "Usulan bentrok dengan jadwal lain", "Silakan sesuaikan di formulir.");
        openModal({ kind: "schedule", preset: { title: p.title, date: p.date, start: p.start, end: p.end, category, description: p.description } });
      } else toast("error", "Usulan tidak valid", v.reason);
      return;
    }
    await data.actions.upsert("schedules", { id: uid("sch-"), title: p.title, description: p.description, date: p.date, start: p.start, end: p.end, category, priority: "medium", recurrence: "none", completedDates: [], createdAt: nowLocal() });
    setMsgs((m) => m.map((x) => (x.id === msg.id ? { ...x, added: true } : x)));
    toast("success", "Jadwal ditambahkan", `${p.title} · ${fmtTime(p.start)}–${fmtTime(p.end)}`);
  };

  return (
    <>
      <button
        onClick={() => setAssistantOpen(!assistantOpen)}
        className={cn(
          "fixed right-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-[45] grid size-14 place-items-center rounded-2xl bg-gradient-to-br from-primary to-accent text-white shadow-[0_14px_34px_-10px_rgb(37_99_235/0.9)] transition hover:scale-105 active:scale-95 md:right-6 md:bottom-6",
          assistantOpen && "scale-0 opacity-0",
        )}
        aria-label="Buka PERSONAL AI"
      >
        <Icon name="Sparkles" size={24} />
      </button>
      {assistantOpen && (
        <div className="fixed inset-0 z-[70] flex items-end justify-end md:inset-auto md:right-6 md:bottom-6">
          <div className="absolute inset-0 bg-black/50 md:hidden" onClick={() => setAssistantOpen(false)} />
          <div className="relative flex h-[85dvh] w-full animate-slide-up flex-col overflow-hidden rounded-t-3xl border border-line-strong bg-card shadow-[var(--shadow-pop)] md:h-[min(640px,80dvh)] md:w-[420px] md:rounded-3xl">
            <div className="relative overflow-hidden border-b border-line px-5 py-4">
              <div className="quote-hero absolute inset-0 opacity-60" />
              <div className="relative flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="grid size-10 place-items-center rounded-xl bg-white/15 text-white backdrop-blur">
                    <Icon name="Bot" size={20} />
                  </span>
                  <div>
                    <p className="text-sm font-bold tracking-wide text-white">PERSONAL AI</p>
                    <p className="text-[11px] text-white/75">
                      {llm === null ? "Memeriksa koneksi…" : llm.configured && useLLM ? `Terhubung · ${llm.label}` : "Mode lokal · jawaban dari data aplikasi"}
                    </p>
                  </div>
                </div>
                <button onClick={() => setAssistantOpen(false)} className="grid size-8 place-items-center rounded-lg text-white/80 hover:bg-white/10" aria-label="Tutup">
                  <Icon name="X" size={18} />
                </button>
              </div>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
              {msgs.length === 0 && (
                <div className="space-y-4">
                  <div className="surface p-4 text-sm">
                    <p className="font-semibold">Halo, {data.settings.name || "kamu"}! 👋</p>
                    <p className="mt-1 text-muted">Saya membaca jadwal, tugas, keuangan & goals yang tersimpan di aplikasi ini — tidak mengarang data. Coba salah satu pertanyaan:</p>
                  </div>
                  {llm && !llm.configured && (
                    <div className="rounded-xl border border-line bg-bg2/60 px-3 py-2.5 text-[11.5px] text-muted">
                      <Icon name="Info" size={13} className="mr-1 inline -translate-y-px text-accent" />
                      LLM belum dikonfigurasi (LLM_API_KEY). Asisten berjalan dengan mesin lokal berbasis aturan yang menghitung langsung dari datamu. Lihat README untuk mengaktifkan LLM.
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {SUGGESTIONS.map((s) => (
                      <button key={s} onClick={() => ask(s)} className="rounded-full border border-line-strong bg-elevated px-3 py-1.5 text-left text-xs text-fg transition hover:border-highlight/60">
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {msgs.map((m) => (
                <div key={m.id} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                  <div className={cn("max-w-[88%] rounded-2xl px-3.5 py-2.5", m.role === "user" ? "rounded-br-md bg-primary text-white" : "rounded-bl-md border border-line bg-elevated")}>
                    {m.role === "user" ? <p className="text-sm">{m.text}</p> : <RichText text={m.text} />}
                    {m.note && <p className="mt-2 text-[11px] text-warning">{m.note}</p>}
                    {m.proposal && (
                      <div className="mt-3 rounded-xl border border-primary/30 bg-primary/10 p-3">
                        <p className="text-xs font-semibold">{m.proposal.title}</p>
                        <p className="text-xs text-muted">
                          {fmtDateLong(m.proposal.date)} · {fmtTime(m.proposal.start)}–{fmtTime(m.proposal.end)}
                        </p>
                        <button disabled={m.added} onClick={() => addProposal(m)} className="btn btn-primary btn-sm mt-2 w-full">
                          <Icon name={m.added ? "Check" : "CalendarPlus"} size={14} />
                          {m.added ? "Sudah ditambahkan" : "Tambahkan ke Jadwal"}
                        </button>
                      </div>
                    )}
                    {m.role === "ai" && <p className="mt-1.5 text-[10px] text-subtle">{m.engine === "llm" ? "via LLM · berdasarkan datamu" : "mesin lokal · dihitung dari datamu"}</p>}
                  </div>
                </div>
              ))}
              {busy && (
                <div className="flex items-center gap-1.5 px-2 text-muted">
                  <span className="size-1.5 animate-bounce rounded-full bg-accent [animation-delay:-0.2s]" />
                  <span className="size-1.5 animate-bounce rounded-full bg-accent [animation-delay:-0.1s]" />
                  <span className="size-1.5 animate-bounce rounded-full bg-accent" />
                </div>
              )}
              <div ref={endRef} />
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                ask(input);
              }}
              className="border-t border-line p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
            >
              <div className="flex items-center gap-2">
                <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Tanyakan sesuatu…" className="input !h-11 !rounded-xl" aria-label="Pesan untuk Personal AI" />
                <button type="submit" disabled={!input.trim() || busy} className="btn btn-primary btn-icon !h-11 !w-11 !rounded-xl" aria-label="Kirim">
                  <Icon name="Send" size={17} />
                </button>
              </div>
              <div className="mt-2 flex items-center justify-between text-[10.5px] text-subtle">
                {llm?.configured ? (
                  <label className="flex cursor-pointer items-center gap-1.5">
                    <input type="checkbox" checked={useLLM} onChange={(e) => setUseLLM(e.target.checked)} className="accent-[var(--color-primary)]" />
                    Gunakan LLM
                  </label>
                ) : (
                  <span>Mode lokal</span>
                )}
                {msgs.length > 0 && (
                  <button type="button" onClick={() => setMsgs([])} className="hover:text-fg">
                    Bersihkan percakapan
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
