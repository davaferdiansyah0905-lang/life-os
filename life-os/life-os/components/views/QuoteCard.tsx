"use client";

import * as React from "react";
import { Icon } from "../icons";
import { Button, EmptyState, Modal } from "../ui";
import { useData } from "../providers/DataProvider";
import { useToast } from "../providers/Toast";
import { useUI } from "../providers/UIProvider";
import { QUOTES, dailyQuoteIndex, quotePool } from "@/lib/quotes";
import { fmtDateLong, todayKey } from "@/lib/time";
import { cn } from "@/lib/format";

export function QuoteCard({ className }: { className?: string }) {
  const { settings, favorites, actions } = useData();
  const { toast } = useToast();
  const { openModal } = useUI();
  const today = todayKey();
  const dailyIdx = dailyQuoteIndex(today, settings.quoteCategories);
  const [idx, setIdx] = React.useState(dailyIdx);
  const [seen, setSeen] = React.useState<number[]>([dailyIdx]);
  const [anim, setAnim] = React.useState(0);
  React.useEffect(() => {
    setIdx(dailyIdx);
    setSeen([dailyIdx]);
  }, [dailyIdx]);

  const q = QUOTES[idx];
  const fav = favorites.includes(idx);
  const isDaily = idx === dailyIdx;

  const more = () => {
    const pool = quotePool(settings.quoteCategories);
    const remaining = pool.filter((i) => !seen.includes(i));
    const list = remaining.length ? remaining : pool.filter((i) => i !== idx);
    const next = list[Math.floor(Math.random() * list.length)];
    setIdx(next);
    setSeen((s) => (remaining.length ? [...s, next] : [next]));
    setAnim((a) => a + 1);
  };
  const toggleFav = async () => {
    await actions.setFavorites(fav ? favorites.filter((f) => f !== idx) : [...favorites, idx]);
    toast("success", fav ? "Dihapus dari favorit" : "Disimpan ke favorit", `"${q.text.slice(0, 50)}${q.text.length > 50 ? "…" : ""}"`);
  };

  return (
    <section className={cn("quote-hero relative overflow-hidden rounded-[1.4rem] border border-white/10 p-6 text-white shadow-[0_24px_60px_-24px_rgb(37_99_235/0.8)] sm:p-8", className)}>
      <div className="pointer-events-none absolute -top-24 -right-16 size-72 animate-float rounded-full bg-accent/25 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-28 left-10 size-72 animate-float rounded-full bg-primary/40 blur-3xl [animation-delay:-4s]" />
      <svg className="pointer-events-none absolute top-5 right-6 text-white/10" width="120" height="120" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M7.17 6A5.17 5.17 0 0 0 2 11.17V18h6.83v-6.83H5.41A1.76 1.76 0 0 1 7.17 9.4zm10 0A5.17 5.17 0 0 0 12 11.17V18h6.83v-6.83h-3.42a1.76 1.76 0 0 1 1.76-1.77z" />
      </svg>
      <div className="relative flex h-full flex-col">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold tracking-wide backdrop-blur">
            <Icon name="Sparkles" size={12} /> {isDaily ? "MOTIVASI HARI INI" : "INSPIRASI TAMBAHAN"}
          </span>
          <span className="rounded-full bg-black/20 px-3 py-1 text-[11px] font-medium text-white/85">{q.category}</span>
        </div>
        <blockquote key={anim} className="mt-5 flex-1 animate-slide-up">
          <p className="text-balance text-xl leading-snug font-semibold tracking-tight sm:text-2xl lg:text-[1.7rem] lg:leading-[1.3]">&ldquo;{q.text}&rdquo;</p>
          <footer className="mt-4 flex items-center gap-2 text-sm text-white/80">
            <span className="h-px w-8 bg-white/50" />
            <cite className="not-italic font-medium">{q.author}</cite>
          </footer>
        </blockquote>
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <button onClick={more} className="inline-flex h-9 items-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-[#0b1a3a] transition hover:bg-white/90 active:scale-[0.98]">
            <Icon name="Shuffle" size={15} /> More Inspiration
          </button>
          <button onClick={toggleFav} className={cn("inline-flex h-9 items-center gap-2 rounded-xl border px-3.5 text-sm font-semibold backdrop-blur transition", fav ? "border-pink-300/50 bg-pink-500/25 text-pink-100" : "border-white/25 bg-white/10 hover:bg-white/20")} aria-pressed={fav}>
            <Icon name="Heart" size={15} className={fav ? "fill-current" : ""} /> {fav ? "Favorit" : "Simpan"}
          </button>
          <button onClick={() => openModal({ kind: "favorites" })} className="inline-flex h-9 items-center gap-2 rounded-xl px-3 text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white">
            <Icon name="BookOpen" size={15} /> Koleksi ({favorites.length})
          </button>
          {!isDaily && (
            <button onClick={() => setIdx(dailyIdx)} className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm font-medium text-white/80 hover:bg-white/10">
              <Icon name="RotateCcw" size={14} /> Kutipan hari ini
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

export function FavoritesModal({ onClose }: { onClose: () => void }) {
  const { favorites, actions } = useData();
  const today = todayKey();
  return (
    <Modal open onClose={onClose} title="Koleksi Kutipan Favorit" subtitle={`Kutipan berganti otomatis setiap hari · ${fmtDateLong(today)}`} icon="Heart" footer={<Button onClick={onClose}>Tutup</Button>}>
      {favorites.length === 0 ? (
        <EmptyState icon="Heart" title="Belum ada favorit" description='Tekan "Simpan" pada kartu motivasi untuk menyimpan kutipan yang kamu sukai.' />
      ) : (
        <div className="space-y-3">
          {favorites.map((i) => {
            const q = QUOTES[i];
            if (!q) return null;
            return (
              <div key={i} className="surface flex items-start gap-3 p-4">
                <Icon name="Quote" size={18} className="mt-0.5 shrink-0 text-accent" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-relaxed">{q.text}</p>
                  <p className="mt-1.5 text-xs text-muted">
                    — {q.author} · {q.category}
                  </p>
                </div>
                <button onClick={() => actions.setFavorites(favorites.filter((f) => f !== i))} className="text-muted hover:text-danger" aria-label="Hapus dari favorit">
                  <Icon name="Trash2" size={15} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}
