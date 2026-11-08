import { completeJSON, extractJSON } from "./llm";
import type { ParsedTransaction } from "@/lib/parser";
import { EXPENSE_CATEGORIES, INCOME_SOURCES, PAYMENT_METHODS } from "@/lib/constants";

export async function refineWithLLM(text: string, base: ParsedTransaction): Promise<ParsedTransaction> {
  const system =
    "Kamu adalah parser notifikasi transaksi perbankan Indonesia. Keluarkan HANYA JSON valid tanpa teks lain. " +
    "Jangan mengarang: jika suatu nilai tidak ada di teks, isi null. " +
    `Skema: {"type":"income"|"expense"|null,"amount":number|null,"merchant":string|null,"date":"YYYY-MM-DD"|null,"time":"HH:mm"|null,` +
    `"paymentMethod":one of ${JSON.stringify(PAYMENT_METHODS)},"category":one of ${JSON.stringify([...EXPENSE_CATEGORIES, ...INCOME_SOURCES])},` +
    `"ambiguous":string[] (daftar hal yang tidak jelas)}`;
  const raw = await completeJSON(system, `Notifikasi:\n"""${text.slice(0, 600)}"""\nHasil parser aturan (boleh dikoreksi): ${JSON.stringify(base)}`, { maxTokens: 400, timeoutMs: 15000 });
  const j = extractJSON<Record<string, unknown>>(raw);
  if (!j) return base;
  const cats: readonly string[] = [...EXPENSE_CATEGORIES, ...INCOME_SOURCES];
  const type = j.type === "income" || j.type === "expense" ? j.type : base.type;
  const amount = typeof j.amount === "number" && j.amount > 0 ? j.amount : base.amount;
  const merged: ParsedTransaction = {
    ...base,
    type,
    amount,
    merchant: typeof j.merchant === "string" && j.merchant.trim() ? j.merchant.trim().slice(0, 60) : base.merchant,
    date: typeof j.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(j.date) ? j.date : base.date,
    time: typeof j.time === "string" && /^\d{2}:\d{2}$/.test(j.time) ? j.time : base.time,
    paymentMethod: typeof j.paymentMethod === "string" && (PAYMENT_METHODS as readonly string[]).includes(j.paymentMethod) ? j.paymentMethod : base.paymentMethod,
    // learned user rules always win over the model
    category: base.learned ? base.category : typeof j.category === "string" && cats.includes(j.category) ? j.category : base.category,
    engine: "llm",
  };
  const amb = Array.isArray(j.ambiguous) ? (j.ambiguous as unknown[]).filter((x): x is string => typeof x === "string").slice(0, 4) : [];
  merged.issues = [...new Set([...base.issues.filter((i) => !(merged.amount && i.startsWith("Nominal")) && !(merged.type && i.startsWith("Jenis")) && !(merged.merchant && i.startsWith("Nama"))), ...amb])];
  let conf = base.confidence;
  if (!base.type && merged.type) conf += 0.2;
  if (!base.amount && merged.amount) conf += 0.25;
  if (!base.merchant && merged.merchant) conf += 0.1;
  merged.confidence = Math.min(0.97, Math.round(conf * 100) / 100);
  return merged;
}

