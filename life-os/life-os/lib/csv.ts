import type { Transaction } from "./types";
import { runningBalances, sortChrono } from "./finance";
import { EXPENSE_CATEGORIES, INCOME_SOURCES } from "./constants";
import { normalizeNumber } from "./format";

const esc = (v: unknown) => {
  const s = v === undefined || v === null ? "" : String(v);
  return /[",;\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const ORIGIN_LABEL: Record<string, string> = {
  manual: "Manual",
  csv: "Impor CSV",
  notification: "Teks Notifikasi",
  android: "Android Companion",
  simulation: "Simulasi",
  assistant: "Personal AI",
};

export function transactionsToCSV(all: Transaction[], initialBalance: number) {
  const balances = runningBalances(all, initialBalance);
  const header = ["Tanggal", "Waktu", "Tipe", "Nama Transaksi", "Kategori/Sumber", "Pemasukan", "Pengeluaran", "Saldo Setelah Transaksi", "Metode Pembayaran", "Deskripsi", "Status", "Asal Data"];
  const rows = sortChrono(all).map((t) => [
    t.date,
    t.time ?? "",
    t.type === "income" ? "Pemasukan" : "Pengeluaran",
    t.merchant || t.description || t.category,
    t.category,
    t.type === "income" ? t.amount : "",
    t.type === "expense" ? t.amount : "",
    balances.get(t.id) ?? "",
    t.paymentMethod,
    t.description ?? "",
    t.status === "confirmed" ? "Terkonfirmasi" : "Menunggu konfirmasi",
    t.isDemo ? "DEMO" : ORIGIN_LABEL[t.origin] ?? t.origin,
  ]);
  return "﻿" + [header, ...rows].map((r) => r.map(esc).join(",")).join("\r\n");
}

export const CSV_TEMPLATE =
  "﻿tanggal,waktu,tipe,jumlah,kategori,nama,metode,deskripsi\r\n" +
  "2026-11-01,08:00,pemasukan,3500000,Uang Saku,Kiriman Orang Tua,Transfer Bank,Uang saku bulanan\r\n" +
  "2026-11-02,12:15,pengeluaran,25000,Makanan & Minuman,Warung Makan,QRIS,Makan siang\r\n";

/** Minimal RFC-4180 CSV parser (handles quotes, commas/semicolons). */
export function parseCSV(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const firstLine = src.split(/\r?\n/)[0] ?? "";
  const delim = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === delim) {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      if (row.some((x) => x.trim() !== "")) rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  row.push(field);
  if (row.some((x) => x.trim() !== "")) rows.push(row);
  return rows;
}

export interface CsvImportRow {
  ok: boolean;
  error?: string;
  tx?: Omit<Transaction, "id" | "createdAt" | "origin" | "status">;
}

function normDate(s: string): string | null {
  const v = s.trim();
  let m = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = v.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
  if (m) {
    const y = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  return null;
}

export function csvToTransactions(text: string): CsvImportRow[] {
  const rows = parseCSV(text);
  if (rows.length < 2) return [];
  const head = rows[0].map((h) => h.trim().toLowerCase());
  const col = (...names: string[]) => head.findIndex((h) => names.some((n) => h === n || h.includes(n)));
  const ci = {
    date: col("tanggal", "date"),
    time: col("waktu", "time", "jam"),
    type: col("tipe", "type", "jenis"),
    amount: col("jumlah", "amount", "nominal"),
    income: col("pemasukan", "income", "kredit", "credit"),
    expense: col("pengeluaran", "expense", "debit"),
    category: col("kategori", "category", "sumber"),
    name: col("nama", "merchant", "name", "keterangan"),
    method: col("metode", "method", "payment"),
    desc: col("deskripsi", "description", "catatan"),
  };
  if (ci.date < 0) return [{ ok: false, error: "Kolom 'tanggal' tidak ditemukan pada header CSV." }];
  return rows.slice(1).map((r, i) => {
    const get = (k: number) => (k >= 0 ? (r[k] ?? "").trim() : "");
    const date = normDate(get(ci.date));
    if (!date) return { ok: false, error: `Baris ${i + 2}: tanggal tidak valid` };
    let type: "income" | "expense" | null = null;
    let amount = 0;
    if (ci.amount >= 0) {
      const raw = get(ci.amount);
      amount = Math.abs(normalizeNumber(raw));
      const tv = get(ci.type).toLowerCase();
      if (/masuk|pemasukan|income|kredit|cr/.test(tv)) type = "income";
      else if (/keluar|pengeluaran|expense|debit|db/.test(tv)) type = "expense";
      else if (raw.trim().startsWith("-")) type = "expense";
      else type = tv ? null : "expense";
    } else {
      const inc = normalizeNumber(get(ci.income));
      const exp = normalizeNumber(get(ci.expense));
      if (inc > 0) {
        type = "income";
        amount = inc;
      } else if (exp > 0) {
        type = "expense";
        amount = Math.abs(exp);
      }
    }
    if (!type) return { ok: false, error: `Baris ${i + 2}: tipe transaksi tidak dikenali` };
    if (!amount) return { ok: false, error: `Baris ${i + 2}: jumlah kosong/0` };
    const rawCat = get(ci.category);
    const list: readonly string[] = type === "income" ? INCOME_SOURCES : EXPENSE_CATEGORIES;
    const category = list.find((c) => c.toLowerCase() === rawCat.toLowerCase()) ?? (type === "income" ? "Lainnya (Pemasukan)" : "Lainnya");
    const time = get(ci.time).match(/^\d{1,2}[:.]\d{2}/) ? get(ci.time).replace(".", ":").padStart(5, "0").slice(0, 5) : undefined;
    return {
      ok: true,
      tx: {
        type,
        amount,
        date,
        time,
        category,
        merchant: get(ci.name) || undefined,
        description: get(ci.desc) || (rawCat && category !== rawCat ? rawCat : undefined),
        paymentMethod: get(ci.method) || "Lainnya",
      },
    };
  });
}

export function downloadText(filename: string, text: string, mime = "text/csv;charset=utf-8") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
