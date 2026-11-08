"use client";

import * as React from "react";
import type { Note } from "@/lib/types";
import { Icon } from "../icons";
import { Button, Card, DemoBadge, EmptyState, SectionTitle, Select } from "../ui";
import { useData } from "../providers/DataProvider";
import { useUI } from "../providers/UIProvider";
import { useToast } from "../providers/Toast";
import { NOTE_CATEGORIES, NOTE_CATEGORY_META } from "@/lib/constants";
import { fmtDateTime, fmtDate, nowLocal, todayKey } from "@/lib/time";
import { cn, uid } from "@/lib/format";

const meta = (c: string) => NOTE_CATEGORY_META[c] ?? NOTE_CATEGORY_META["Catatan Cepat"];

function Editor({ note, onBack }: { note: Note; onBack: () => void }) {
  const { actions } = useData();
  const { toast, confirm } = useToast();
  const [title, setTitle] = React.useState(note.title);
  const [content, setContent] = React.useState(note.content);
  const [category, setCategory] = React.useState(note.category);
  const [saved, setSaved] = React.useState(true);
  const first = React.useRef(true);

  React.useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setSaved(false);
    const id = setTimeout(async () => {
      await actions.upsert("notes", { ...note, title: title.trim() || "Tanpa judul", content, category, updatedAt: nowLocal() });
      setSaved(true);
    }, 600);
    return () => clearTimeout(id);
  }, [title, content, category]); // eslint-disable-line react-hooks/exhaustive-deps

  const del = async () => {
    if (!(await confirm({ title: "Hapus catatan?", message: `"${note.title}" akan dihapus permanen.`, danger: true, confirmText: "Hapus" }))) return;
    await actions.remove("notes", note.id);
    toast("success", "Catatan dihapus");
    onBack();
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
        <Button size="sm" variant="ghost" iconOnly icon="ArrowLeft" onClick={onBack} className="lg:hidden" aria-label="Kembali" />
        <Select value={category} onChange={(e) => setCategory(e.target.value)} options={NOTE_CATEGORIES} className="!h-8 !w-auto !text-xs" aria-label="Kategori catatan" />
        <button onClick={() => actions.upsert("notes", { ...note, pinned: !note.pinned })} className={cn("btn btn-sm", note.pinned ? "!border-warning/40 !bg-warning/15 !text-warning" : "btn-ghost")}>
          <Icon name={note.pinned ? "PinOff" : "Pin"} size={14} /> {note.pinned ? "Lepas sematan" : "Sematkan"}
        </button>
        <DemoBadge show={note.isDemo} />
        <span className="ml-auto flex items-center gap-1.5 text-[11px] text-muted">
          <Icon name={saved ? "CircleCheck" : "LoaderCircle"} size={13} className={saved ? "text-success" : "animate-spin"} />
          {saved ? `Tersimpan · ${fmtDateTime(note.updatedAt)}` : "Menyimpan…"}
        </span>
        <Button size="sm" variant="ghost" iconOnly icon="Trash2" onClick={del} className="hover:!text-danger" aria-label="Hapus catatan" />
      </div>
      <input value={title} onChange={(e) => setTitle(e.target.value)} className="bg-transparent px-5 pt-5 text-xl font-semibold tracking-tight outline-none" placeholder="Judul catatan" aria-label="Judul catatan" />
      <textarea value={content} onChange={(e) => setContent(e.target.value)} className="min-h-[50vh] flex-1 resize-none bg-transparent px-5 py-4 text-[15px] leading-relaxed outline-none" placeholder="Mulai menulis…" aria-label="Isi catatan" />
    </div>
  );
}

export function NotesView() {
  const { notes, actions } = useData();
  const { focus, setFocus } = useUI();
  const [q, setQ] = React.useState("");
  const [cat, setCat] = React.useState<string>("all");
  const [selected, setSelected] = React.useState<string | null>(null);
  const [mobileEditor, setMobileEditor] = React.useState(false);

  React.useEffect(() => {
    if (focus?.type === "note") {
      setSelected(focus.id);
      setMobileEditor(true);
      setFocus(null);
    }
  }, [focus, setFocus]);

  const list = React.useMemo(() => {
    const term = q.trim().toLowerCase();
    return notes
      .filter((n) => cat === "all" || n.category === cat)
      .filter((n) => !term || n.title.toLowerCase().includes(term) || n.content.toLowerCase().includes(term))
      .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt));
  }, [notes, q, cat]);
  React.useEffect(() => {
    if (!selected && list.length && typeof window !== "undefined" && window.innerWidth >= 1024) setSelected(list[0].id);
  }, [list, selected]);
  const current = notes.find((n) => n.id === selected);

  const create = async (category = cat === "all" ? "Catatan Cepat" : cat) => {
    const isJournal = category === "Jurnal Harian";
    const n: Note = { id: uid("note-"), title: isJournal ? `Jurnal ${fmtDate(todayKey())}` : "Catatan baru", content: "", category, pinned: false, createdAt: nowLocal(), updatedAt: nowLocal() };
    await actions.upsert("notes", n);
    setSelected(n.id);
    setMobileEditor(true);
  };

  return (
    <div>
      <SectionTitle
        title="Catatan & Jurnal"
        subtitle="Catatan cepat, jurnal harian, ide, info penting, akademik & karier — tersimpan otomatis."
        action={
          <>
            <Button icon="BookOpen" onClick={() => create("Jurnal Harian")}>
              Jurnal hari ini
            </Button>
            <Button variant="primary" icon="Plus" onClick={() => create()}>
              Catatan baru
            </Button>
          </>
        }
      />
      <div className="mb-4 flex gap-1.5 overflow-x-auto pb-1">
        {["all", ...NOTE_CATEGORIES].map((c) => (
          <button key={c} onClick={() => setCat(c)} className={cn("btn btn-sm shrink-0", cat === c ? "!border-primary/50 !bg-primary/15 !text-fg" : "btn-ghost")}>
            {c !== "all" && <Icon name={meta(c).icon} size={13} style={{ color: meta(c).color }} />}
            {c === "all" ? "Semua" : c}
            <span className="tabular rounded-md bg-white/10 px-1.5 text-[10px]">{c === "all" ? notes.length : notes.filter((n) => n.category === c).length}</span>
          </button>
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-12">
        <div className={cn("space-y-3 lg:col-span-4", mobileEditor && current && "hidden lg:block")}>
          <div className="relative">
            <Icon name="Search" size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
            <input className="input !pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari catatan…" aria-label="Cari catatan" />
          </div>
          <div className="max-h-[70vh] space-y-2 overflow-y-auto pr-1">
            {list.length === 0 ? (
              <Card>
                <EmptyState icon="NotebookPen" title="Belum ada catatan" description="Tulis ide, jurnal, atau info penting." action={<Button icon="Plus" onClick={() => create()}>Catatan baru</Button>} />
              </Card>
            ) : (
              list.map((n) => (
                <button
                  key={n.id}
                  onClick={() => {
                    setSelected(n.id);
                    setMobileEditor(true);
                  }}
                  className={cn("card card-hover block w-full !rounded-2xl p-4 text-left", selected === n.id && "!border-primary/50 bg-primary/[0.06]")}
                >
                  <div className="flex items-center gap-2">
                    <Icon name={meta(n.category).icon} size={14} style={{ color: meta(n.category).color }} />
                    <span className="text-[11px] text-muted">{n.category}</span>
                    {n.pinned && <Icon name="Pin" size={12} className="text-warning" />}
                    <DemoBadge show={n.isDemo} />
                    <span className="tabular ml-auto text-[10.5px] text-subtle">{fmtDate(n.updatedAt.slice(0, 10))}</span>
                  </div>
                  <p className="mt-1.5 truncate text-sm font-semibold">{n.title}</p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted">{n.content || "Kosong"}</p>
                </button>
              ))
            )}
          </div>
        </div>
        <Card className={cn("min-h-[60vh] overflow-hidden lg:col-span-8", !(mobileEditor && current) && "hidden lg:block")}>
          {current ? (
            <Editor key={current.id} note={current} onBack={() => setMobileEditor(false)} />
          ) : (
            <EmptyState className="h-full min-h-[50vh]" icon="NotebookPen" title="Pilih atau buat catatan" description="Catatan tersimpan otomatis saat kamu mengetik." />
          )}
        </Card>
      </div>
    </div>
  );
}
