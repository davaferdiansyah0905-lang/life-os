// Rule-based banking-notification parser (works offline, client & server).
// An optional LLM pass (server side, /api/ai/parse) can refine the result.

import type { CategoryRule, TxType } from "./types";
import { normalizeKey, normalizeNumber } from "./format";
import { nowHM, todayKey } from "./time";

export interface ParsedTransaction {
  type: TxType | null;
  amount: number | null;
  merchant: string | null;
  date: string; // YYYY-MM-DD
  time: string | null;
  paymentMethod: string;
  category: string;
  confidence: number; // 0..1
  issues: string[];
  engine: "rules" | "llm";
  bank?: string;
  learned?: boolean;
}

const BANKS: [RegExp, string][] = [
  [/\bbca\b|mybca|klikbca/i, "BCA"],
  [/livin|mandiri/i, "Mandiri"],
  [/\bbri\b|brimo/i, "BRI"],
  [/\bbni\b|wondr/i, "BNI"],
  [/\bbsi\b|byond/i, "BSI"],
  [/jago/i, "Bank Jago"],
  [/seabank/i, "SeaBank"],
  [/blu\b|bcadigital/i, "blu"],
  [/cimb|octo/i, "CIMB Niaga"],
  [/permata/i, "Permata"],
  [/gopay/i, "GoPay"],
  [/\bovo\b/i, "OVO"],
  [/\bdana\b/i, "DANA"],
  [/shopeepay/i, "ShopeePay"],
];

const INCOME_HINTS = /(dana masuk|uang masuk|transfer masuk|menerima|diterima|terima (dana|transfer|uang)|kredit\b|\bcr\b|incoming|received|refund|pengembalian|cashback|gaji|top ?up (masuk|diterima)|telah masuk)/i;
const EXPENSE_HINTS = /(pembayaran|bayar|membayar|pembelian|debit\b|\bdb\b|transfer ke|transfer keluar|tarik tunai|penarikan|qris|payment|purchase|paid|dibayar|tagihan|berhasil dibayarkan|keluar)/i;

const CATEGORY_KEYWORDS: [string, RegExp][] = [
  ["Makanan & Minuman", /(warung|warteg|makan|resto|restoran|rm\.?\s|rumah makan|kopi|coffee|cafe|kafe|bakso|mie|mi ayam|nasi|ayam|sate|soto|martabak|kfc|mcd|mcdonald|burger|pizza|starbucks|janji jiwa|kenangan|fore|chatime|mixue|kantin|bakery|roti|food|grabfood|gofood|shopeefood|es teh|boba|seblak|geprek|padang|pecel|gorengan|minum|snack|jajan)/i],
  ["Transportasi", /(gojek|goride|gocar|grab(?!food)|maxim|indrive|ojek|ojol|bensin|pertamina|shell|bp akr|vivo|spbu|parkir|krl|commuter|transjakarta|tije|mrt|lrt|kai|kereta|tol|e-?toll|flazz|bus|damri|taksi|bluebird|travel)/i],
  ["Pendidikan", /(fotokopi|fotocopy|print|cetak|buku|gramedia|ukt|spp|kampus|universitas|kuliah|kursus|course|udemy|coursera|dicoding|toefl|ielts|sertifikasi|seminar|praktikum|jurnal|alat tulis|atk)/i],
  ["Komunikasi", /(pulsa|kuota|paket data|telkomsel|indosat|im3|xl\b|axis|tri\b|smartfren|by\.u|indihome|biznet|first media|wifi|internet)/i],
  ["Kesehatan", /(apotek|apotik|kimia farma|k-24|century|guardian|klinik|rumah sakit|\brs\b|dokter|halodoc|obat|bpjs|lab)/i],
  ["Tempat Tinggal", /(kos\b|kost|kontrakan|sewa|listrik|pln|token|pdam|air bersih|laundry|gas|elpiji)/i],
  ["Hiburan", /(netflix|spotify|youtube|disney|vidio|bioskop|xxi|cgv|cinepolis|game|steam|playstation|karaoke|tiket konser|loket)/i],
  ["Belanja", /(indomaret|alfamart|alfamidi|superindo|hypermart|transmart|tokopedia|shopee(?!pay|food)|lazada|blibli|tiktok shop|mall|uniqlo|h&m|zara|toko|minimarket|market)/i],
  ["Organisasi", /(iuran|kas himpunan|himpunan|ukm|bem|organisasi|panitia|kepanitiaan)/i],
  ["Tabungan", /(tabungan|nabung|deposito|reksadana|bibit|ajaib|investasi|saving)/i],
];

const INCOME_SOURCE_KEYWORDS: [string, RegExp][] = [
  ["Beasiswa", /(beasiswa|scholarship|kip|lpdp)/i],
  ["Magang", /(magang|intern)/i],
  ["Kerja Paruh Waktu", /(part.?time|paruh waktu|shift)/i],
  ["Proyek", /(proyek|project|freelance|fee)/i],
  ["Bisnis", /(penjualan|jualan|order|bisnis|toko)/i],
  ["Uang Saku", /(uang saku|kiriman|ortu|orang tua|ayah|ibu|mama|papa|bapak)/i],
];

const MONTHS: Record<string, number> = {
  jan: 1, januari: 1, january: 1, feb: 2, februari: 2, february: 2, mar: 3, maret: 3, march: 3, apr: 4, april: 4,
  mei: 5, may: 5, jun: 6, juni: 6, june: 6, jul: 7, juli: 7, july: 7, agu: 8, agt: 8, agustus: 8, aug: 8, august: 8,
  sep: 9, sept: 9, september: 9, okt: 10, oktober: 10, oct: 10, october: 10, nov: 11, november: 11, des: 12, desember: 12, dec: 12, december: 12,
};

const pad = (n: number) => String(n).padStart(2, "0");

function extractAmount(text: string): number | null {
  const patterns = [
    /(?:rp\.?|idr)\s*([\d.,]+)/i,
    /(?:sebesar|senilai|nominal|amount|jumlah)\s*:?\s*(?:rp\.?|idr)?\s*([\d.,]+)/i,
    /([\d]{1,3}(?:[.,]\d{3})+(?:[.,]\d{2})?)/,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) {
      const v = normalizeNumber(m[1].replace(/[.,]$/, ""));
      if (v > 0) return v;
    }
  }
  return null;
}

function extractDate(text: string): { date: string | null; time: string | null } {
  let date: string | null = null;
  let time: string | null = null;
  const t = text.match(/\b([01]?\d|2[0-3])[:.]([0-5]\d)(?::[0-5]\d)?\s*(wib|wita|wit)?\b/i);
  if (t) time = `${pad(Number(t[1]))}:${t[2]}`;
  let m = text.match(/\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})\b/);
  if (m) {
    const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    const mo = Number(m[2]);
    const d = Number(m[1]);
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) date = `${y}-${pad(mo)}-${pad(d)}`;
  }
  if (!date) {
    m = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
    if (m) date = `${m[1]}-${m[2]}-${m[3]}`;
  }
  if (!date) {
    m = text.match(/\b(\d{1,2})\s+([a-z]{3,9})\.?\s+(\d{4})\b/i);
    if (m && MONTHS[m[2].toLowerCase()]) date = `${m[3]}-${pad(MONTHS[m[2].toLowerCase()])}-${pad(Number(m[1]))}`;
  }
  // a time match that is actually part of a date like 15.11.2026 must be ignored
  if (time && m && text.includes(`${t?.[1]}.${t?.[2]}.`)) time = null;
  return { date, time };
}

function extractMerchant(text: string): string | null {
  const clean = text.replace(/\s+/g, " ");
  const patterns = [
    /(?:merchant|nama merchant|toko)\s*[:\-]\s*([^.,;\n]+)/i,
    /(?:pembayaran|bayar|pembelian|transaksi)[^.]*?\s(?:di|ke|pada merchant)\s+([A-Za-z0-9][^.,;\n]*?)(?=\s+(?:pada|tgl|tanggal|sebesar|senilai|dengan|via|menggunakan|ref|no\.?|berhasil)\b|[.,;\n]|$)/i,
    /\b(?:di|at)\s+([A-Z0-9][^.,;\n]*?)(?=\s+(?:pada|tgl|tanggal|sebesar|senilai|dengan|via|menggunakan|ref|berhasil)\b|[.,;\n]|$)/,
    /(?:dari|from)\s+([A-Za-z][^.,;\n]*?)(?=\s+(?:pada|tgl|tanggal|sebesar|senilai|ke|via|ref)\b|[.,;\n]|$)/i,
    /(?:transfer ke|ke rekening|kepada|to)\s+([A-Za-z][^.,;\n]*?)(?=\s+(?:pada|tgl|tanggal|sebesar|senilai|via|ref)\b|[.,;\n]|$)/i,
  ];
  for (const p of patterns) {
    const m = clean.match(p);
    if (m) {
      const name = m[1]
        .replace(/\b(rp\.?|idr)\s*[\d.,]+/gi, "")
        .replace(/\s{2,}/g, " ")
        .trim()
        .replace(/[\s\-:]+$/, "");
      if (name && name.length >= 2 && name.length <= 60 && !/^\d+$/.test(name)) return titleCase(name);
    }
  }
  return null;
}

function titleCase(s: string) {
  if (s !== s.toUpperCase() && s !== s.toLowerCase()) return s;
  return s.toLowerCase().replace(/\b([a-z])/g, (c) => c.toUpperCase());
}

function detectPayment(text: string): string {
  if (/qris/i.test(text)) return "QRIS";
  if (/virtual account|\bva\b/i.test(text)) return "Virtual Account";
  if (/kartu kredit|credit card/i.test(text)) return "Kartu Kredit";
  if (/gopay|ovo|\bdana\b|shopeepay|linkaja|e-?wallet/i.test(text)) return "E-Wallet";
  if (/debit card|kartu debit|\bedc\b|gpn/i.test(text)) return "Kartu Debit";
  if (/transfer|bi-?fast|rtgs|skn|rekening/i.test(text)) return "Transfer Bank";
  if (/tarik tunai|atm/i.test(text)) return "Tunai";
  return "Lainnya";
}

export function categorize(type: TxType, merchant: string | null, text: string, rules: CategoryRule[] = []): { category: string; learned: boolean } {
  if (merchant) {
    const key = normalizeKey(merchant);
    const rule = rules.find((r) => r.id === key) ?? rules.find((r) => key && (key.includes(r.id) || r.id.includes(key)) && r.id.length >= 4);
    if (rule) return { category: rule.category, learned: true };
  }
  const hay = `${merchant ?? ""} ${text}`;
  if (type === "income") {
    for (const [cat, re] of INCOME_SOURCE_KEYWORDS) if (re.test(hay)) return { category: cat, learned: false };
    return { category: "Lainnya (Pemasukan)", learned: false };
  }
  // merchant name is the strongest signal: test it first
  if (merchant) for (const [cat, re] of CATEGORY_KEYWORDS) if (re.test(merchant)) return { category: cat, learned: false };
  for (const [cat, re] of CATEGORY_KEYWORDS) if (re.test(text)) return { category: cat, learned: false };
  return { category: "Lainnya", learned: false };
}

export function parseNotification(raw: string, rules: CategoryRule[] = [], ref: Date = new Date()): ParsedTransaction {
  const text = (raw || "").replace(/\s+/g, " ").trim();
  const issues: string[] = [];
  if (!text) {
    return { type: null, amount: null, merchant: null, date: todayKey(ref), time: null, paymentMethod: "Lainnya", category: "Lainnya", confidence: 0, issues: ["Teks kosong"], engine: "rules" };
  }
  const incomeHit = INCOME_HINTS.test(text);
  const expenseHit = EXPENSE_HINTS.test(text);
  let type: TxType | null = null;
  if (incomeHit && !expenseHit) type = "income";
  else if (expenseHit && !incomeHit) type = "expense";
  else if (incomeHit && expenseHit) {
    // e.g. "Anda menerima pembayaran" → income ; "Pembayaran QRIS ... berhasil diterima merchant" → expense
    type = /(anda|kamu) (menerima|terima)|dana masuk|transfer masuk|uang masuk/i.test(text) ? "income" : "expense";
  }
  if (!type) issues.push("Jenis transaksi tidak jelas (masuk/keluar)");

  const amount = extractAmount(text);
  if (!amount) issues.push("Nominal tidak ditemukan");

  const merchant = extractMerchant(text);
  if (!merchant) issues.push(type === "income" ? "Nama pengirim tidak ditemukan" : "Nama merchant tidak ditemukan");

  const { date, time } = extractDate(text);
  const bank = BANKS.find(([re]) => re.test(text))?.[1];
  const paymentMethod = detectPayment(text);
  const { category, learned } = categorize(type ?? "expense", merchant, text, rules);
  if (!/berhasil|sukses|success|telah|sudah|diterima|masuk/i.test(text)) issues.push("Status transaksi tidak disebutkan berhasil");
  if (/gagal|failed|dibatalkan|ditolak|pending/i.test(text)) issues.push("Notifikasi menyebut transaksi gagal/pending");

  let confidence = 0;
  if (type) confidence += 0.3;
  if (amount) confidence += 0.35;
  if (merchant) confidence += 0.15;
  if (category !== "Lainnya" && category !== "Lainnya (Pemasukan)") confidence += 0.1;
  if (paymentMethod !== "Lainnya") confidence += 0.05;
  if (/berhasil|sukses|success/i.test(text)) confidence += 0.05;
  if (/gagal|failed|dibatalkan|ditolak/i.test(text)) confidence = Math.min(confidence, 0.3);

  return {
    type,
    amount,
    merchant,
    date: date ?? todayKey(ref),
    time: time ?? (date ? null : nowHM(ref)),
    paymentMethod,
    category,
    confidence: Math.round(Math.min(1, confidence) * 100) / 100,
    issues,
    engine: "rules",
    bank,
    learned,
  };
}

/** Sample notifications used by the simulation mode (clearly labelled as simulation in the UI). */
export const SAMPLE_NOTIFICATIONS = [
  "Transaksi QRIS berhasil. Pembayaran Rp25.000 di Warung Makan.",
  "BCA: Pembayaran QRIS sebesar Rp18.500 di KOPI KENANGAN MARGONDA berhasil pada 09/11/2026 08:12 WIB.",
  "Livin' by Mandiri: Transaksi QRIS Rp32.000 ke GOJEK INDONESIA berhasil. Ref 8812731.",
  "BRImo: Dana masuk Rp1.500.000 dari BEASISWA KAMPUS ke rekening Anda berhasil.",
  "GoPay: Kamu berhasil bayar Rp15.000 di Fotocopy Berkah Jaya pakai QRIS.",
  "DANA: Pembayaran Rp55.000 ke Telkomsel berhasil. Paket data 15GB aktif.",
  "BNI: Transfer masuk Rp250.000 dari PROJECT DESAIN WEB telah diterima.",
  "SeaBank: Pembayaran QRIS Rp12.000 di Indomaret Pondok Cina berhasil",
  "OVO: Pembayaran di Apotek K-24 sebesar Rp47.500 berhasil.",
  "Bank Jago: Pembayaran Rp22.000 ke Mie Ayam Pak Kumis. Saldo tersisa Rp1.234.567",
];
