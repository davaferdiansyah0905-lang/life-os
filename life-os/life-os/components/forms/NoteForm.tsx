"use client";

import * as React from "react";
import type { Note } from "@/lib/types";
import { NOTE_CATEGORIES } from "@/lib/constants";
import { nowLocal } from "@/lib/time";
import { uid } from "@/lib/format";
import { Button, Field, Modal, Select, Toggle } from "../ui";
import { useData } from "../providers/DataProvider";
import { useToast } from "../providers/Toast";

export function NoteForm({ note, preset, onClose }: { note?: Note; preset?: Partial<Note>; onClose: () => void }) {
  const { actions } = useData();
  const { toast } = useToast();
  const base = note ?? preset ?? {};
  const [title, setTitle] = React.useState(base.title ?? "");
  const [content, setContent] = React.useState(base.content ?? "");
  const [category, setCategory] = React.useState(base.category ?? "Catatan Cepat");
  const [pinned, setPinned] = React.useState(!!base.pinned);
  const [error, setError] = React.useState<string>();

  const save = async () => {
    if (!title.trim() && !content.trim()) return setError("Isi judul atau isi catatan.");
    const item: Note = {
      ...(note ?? {}),
      id: note?.id ?? uid("note-"),
      title: title.trim() || content.trim().split("\n")[0].slice(0, 60),
      content,
      category,
      pinned,
      isDemo: note?.isDemo,
      createdAt: note?.createdAt ?? nowLocal(),
      updatedAt: nowLocal(),
    };
    await actions.upsert("notes", item);
    toast("success", note ? "Catatan diperbarui" : "Catatan disimpan", item.title);
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      icon="NotebookPen"
      title={note ? "Edit Catatan" : "Catatan Baru"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Batal
          </Button>
          <Button variant="primary" icon="Check" onClick={save}>
            Simpan
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Judul">
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Judul catatan" autoFocus />
        </Field>
        <Field label="Kategori">
          <Select value={category} onChange={(e) => setCategory(e.target.value)} options={NOTE_CATEGORIES} />
        </Field>
        <Field label="Isi">
          <textarea className="input min-h-40" value={content} onChange={(e) => setContent(e.target.value)} placeholder="Tulis apa saja…" rows={8} />
        </Field>
        <Toggle checked={pinned} onChange={setPinned} label="Sematkan catatan" description="Catatan tersemat selalu tampil di atas" />
        {error && <p className="text-sm text-danger">{error}</p>}
      </div>
    </Modal>
  );
}
