"use client";

import * as React from "react";
import type { Transaction, TxType } from "@/lib/types";
import { EXPENSE_CATEGORIES, INCOME_SOURCES, PAYMENT_METHODS } from "@/lib/constants";
import { budgetCrossings, findDuplicate } from "@/lib/finance";
import { learnRule } from "@/lib/rules";
import { fmtDate, nowHM, nowLocal, todayKey } from "@/lib/time";
import { money, parseAmountInput, uid } from "@/lib/format";
import { Button, Field, Modal, Segmented, Select } from "../ui";
import { Icon } from "../icons";
import { useData } from "../providers/DataProvider";
import { useToast } from "../providers/Toast";

/** Compress an image file to a small JPEG data URL (keeps IndexedDB lean). */
export async function compressImage(file: File, maxSize = 1024, quality = 0.7): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error("Gambar tidak dapat dibaca"));
      i.src = url;
    });
    const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", quality);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function TransactionForm({ tx, preset, onClose }: { tx?: Transaction; preset?: Partial<Transaction>; onClose: () => void }) {
  const { transactions, settings, rules, actions } = useData();
  const { toast } = useToast();
  const base = tx ?? preset ?? {};
  const [type, setType] = React.useState<TxType>(base.type ?? "expense");
  const [f, setF] = React.useState({
    amount: base.amount ? String(base.amount) : "",
    date: base.date ?? todayKey(),
    time: base.time ?? nowHM(),
    category: base.category ?? (base.type === "income" ? "Uang Saku" : "Makanan & Minuman"),
    merchant: base.merchant ?? "",
    description: base.description ?? "",
    paymentMethod: base.paymentMethod ?? "QRIS",
  });
  const [receipt, setReceipt] = React.useState<string | undefined>(base.receipt);
  const [error, setError] = React.useState<string>();
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));

  const amount = parseAmountInput(f.amount);
  const cats: readonly string[] = type === "income" ? INCOME_SOURCES : EXPENSE_CATEGORIES;
  React.useEffect(() => {
    if (!cats.includes(f.category)) set("category", cats[0]);
  }, [type]); // eslint-disable-line react-hooks/exhaustive-deps

  const dup = amount > 0 ? findDuplicate(transactions.filter((t) => t.status === "confirmed"), { id: tx?.id ?? "", type, amount, date: f.date, time: f.time, merchant: f.merchant }) : undefined;

  const onFile = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast("error", "Format tidak didukung", "Unggah gambar (JPG/PNG).");
    try {
      setReceipt(await compressImage(file));
    } catch (e) {
      toast("error", "Gagal memproses gambar", (e as Error).message);
    }
  };

  const save = async (confirmPending = false) => {
    if (!(amount > 0)) return setError("Jumlah harus lebih dari 0.");
    if (!f.date) return setError("Tanggal wajib diisi.");
    setError(undefined);
    const item: Transaction = {
      ...(tx ?? {}),
      id: tx?.id ?? uid("tx-"),
      type,
      amount,
      date: f.date,
      time: f.time || undefined,
      category: f.category,
      merchant: f.merchant.trim() || undefined,
      description: f.description.trim() || undefined,
      paymentMethod: f.paymentMethod,
      receipt,
      origin: tx?.origin ?? preset?.origin ?? "manual",
      status: tx ? (confirmPending ? "confirmed" : tx.status) : "confirmed",
      confidence: tx?.confidence,
      issues: confirmPending ? [] : tx?.issues,
      isDemo: tx?.isDemo,
      createdAt: tx?.createdAt ?? nowLocal(),
    };
    const after = tx ? transactions.map((t) => (t.id === item.id ? item : t)) : [...transactions, item];
    await actions.upsert("transactions", item);
    // learn from manual category corrections
    if (tx && tx.category !== item.category && item.merchant) {
      const rule = learnRule(rules, item.merchant, item.category);
      if (rule) {
        await actions.upsert("rules", rule);
        toast("info", "AI belajar dari koreksimu", `"${item.merchant}" → ${item.category}`);
      }
    }
    if (item.type === "expense" && item.status === "confirmed") {
      for (const l of budgetCrossings(transactions, after, settings)) {
        actions.notify(
          { type: "budget", title: l.level === "over" ? `Anggaran ${l.label} terlampaui!` : `Anggaran ${l.label} hampir habis`, body: `Terpakai ${Math.round(l.pct)}% (${money(l.spent)} dari ${money(l.limit)}).`, href: "/finance" },
          { toast: true },
        );
      }
    }
    toast("success", tx ? (confirmPending ? "Transaksi dikonfirmasi" : "Transaksi diperbarui") : "Transaksi dicatat", `${type === "income" ? "+" : "−"}${money(amount)} · ${f.category}`);
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={tx ? (tx.status === "pending" ? "Tinjau Transaksi" : "Edit Transaksi") : "Tambah Transaksi"}
      subtitle={tx?.status === "pending" ? "Periksa hasil deteksi AI sebelum dimasukkan ke perhitungan" : "Saldo & grafik diperbarui otomatis"}
      icon="Receipt"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Batal
          </Button>
          {tx?.status === "pending" ? (
            <>
              <Button onClick={() => save(false)}>Simpan sebagai draf</Button>
              <Button variant="primary" icon="CircleCheck" onClick={() => save(true)}>
                Konfirmasi
              </Button>
            </>
          ) : (
            <Button variant="primary" icon="Check" onClick={() => save(false)}>
              Simpan
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-4">
        {tx?.issues && tx.issues.length > 0 && (
          <div className="rounded-xl border border-warning/40 bg-warning/10 px-3 py-2.5 text-xs text-warning">
            <p className="mb-1 flex items-center gap-1.5 font-semibold">
              <Icon name="TriangleAlert" size={14} /> Perlu dicek ({Math.round((tx.confidence ?? 0) * 100)}% yakin)
            </p>
            <ul className="list-disc space-y-0.5 pl-5">
              {tx.issues.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
          </div>
        )}
        <Segmented
          value={type}
          onChange={setType}
          className="w-full [&>button]:flex-1"
          options={[
            { value: "expense", label: <span className="flex items-center justify-center gap-1.5"><Icon name="ArrowUpRight" size={14} /> Pengeluaran</span> },
            { value: "income", label: <span className="flex items-center justify-center gap-1.5"><Icon name="ArrowDownLeft" size={14} /> Pemasukan</span> },
          ]}
        />
        <Field label="Jumlah *" hint={amount > 0 ? `= ${money(amount)}` : "Bisa ketik 25000, 25.000, 25rb, atau 1,5jt"}>
          <div className="relative">
            <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted">Rp</span>
            <input className="input tabular !h-12 !pl-10 !text-lg font-semibold" inputMode="decimal" value={f.amount} onChange={(e) => set("amount", e.target.value)} placeholder="0" autoFocus={!tx} />
          </div>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tanggal">
            <input type="date" className="input" value={f.date} onChange={(e) => set("date", e.target.value)} />
          </Field>
          <Field label="Waktu">
            <input type="time" className="input" value={f.time} onChange={(e) => set("time", e.target.value)} />
          </Field>
          <Field label={type === "income" ? "Sumber pemasukan" : "Kategori"}>
            <Select value={f.category} onChange={(e) => set("category", e.target.value)} options={cats} />
          </Field>
          <Field label="Metode pembayaran">
            <Select value={f.paymentMethod} onChange={(e) => set("paymentMethod", e.target.value)} options={PAYMENT_METHODS} />
          </Field>
          <Field label={type === "income" ? "Dari (pengirim)" : "Merchant / toko"} className="sm:col-span-2">
            <input className="input" value={f.merchant} onChange={(e) => set("merchant", e.target.value)} placeholder={type === "income" ? "cth. Orang tua, Klien" : "cth. Warung Makan Bu Sri"} />
          </Field>
          <Field label="Deskripsi" className="sm:col-span-2">
            <input className="input" value={f.description} onChange={(e) => set("description", e.target.value)} placeholder="Opsional" />
          </Field>
        </div>
        {type === "expense" && (
          <div>
            <span className="label">Lampiran struk (opsional)</span>
            {receipt ? (
              <div className="surface flex items-center gap-3 p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={receipt} alt="Struk" className="size-16 rounded-lg object-cover" />
                <div className="flex-1 text-xs text-muted">Struk terlampir (dikompresi & disimpan lokal)</div>
                <Button size="sm" variant="ghost" icon="Trash2" onClick={() => setReceipt(undefined)}>
                  Hapus
                </Button>
              </div>
            ) : (
              <label className="surface flex cursor-pointer items-center justify-center gap-2 border-dashed p-4 text-sm text-muted hover:text-fg">
                <Icon name="Upload" size={16} /> Pilih foto struk
                <input type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
              </label>
            )}
          </div>
        )}
        {dup && (
          <div className="flex items-start gap-2 rounded-xl border border-warning/40 bg-warning/10 px-3 py-2.5 text-xs text-warning">
            <Icon name="Copy" size={14} className="mt-px shrink-0" />
            <span>
              Kemungkinan duplikat: {dup.merchant || dup.category} {money(dup.amount)} pada {fmtDate(dup.date)} {dup.time ?? ""}. Pastikan tidak dicatat dua kali.
            </span>
          </div>
        )}
        {error && <p className="text-sm text-danger">{error}</p>}
      </div>
    </Modal>
  );
}
