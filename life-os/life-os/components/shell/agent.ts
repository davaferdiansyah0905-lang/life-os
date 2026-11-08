"use client";

import * as React from "react";
import type { AppData, Transaction, TxOrigin } from "@/lib/types";
import type { ParsedTransaction } from "@/lib/parser";
import { categorize } from "@/lib/parser";
import { findDuplicate } from "@/lib/finance";
import { nowLocal } from "@/lib/time";
import { money, uid } from "@/lib/format";
import { useData } from "../providers/DataProvider";

/** Convert a parsed notification into a Transaction record (pending unless it is certain). */
export function parsedToTransaction(p: ParsedTransaction, origin: TxOrigin, data: Pick<AppData, "transactions" | "rules" | "settings">): Transaction {
  const type = p.type ?? "expense";
  // apply user-learned category rules on the client as well
  const learned = p.merchant ? categorize(type, p.merchant, "", data.rules) : null;
  const category = learned?.learned ? learned.category : p.category;
  const base: Transaction = {
    id: uid("tx-"),
    type,
    amount: p.amount ?? 0,
    date: p.date,
    time: p.time ?? undefined,
    category,
    merchant: p.merchant ?? undefined,
    description: p.bank ? `Terdeteksi dari notifikasi ${p.bank}` : "Terdeteksi dari notifikasi",
    paymentMethod: p.paymentMethod,
    origin,
    status: "pending",
    confidence: p.confidence,
    issues: [...p.issues],
    createdAt: nowLocal(),
  };
  const dup = findDuplicate(data.transactions, base);
  if (dup) {
    base.duplicateOf = dup.id;
    base.issues = [...(base.issues ?? []), `Kemungkinan duplikat dengan ${dup.merchant || dup.category} ${money(dup.amount)} (${dup.date})`];
  }
  const threshold = data.settings.autoConfirmThreshold ?? 1;
  if (!dup && p.type && p.amount && (base.issues?.length ?? 0) === 0 && p.confidence >= threshold && threshold < 1) base.status = "confirmed";
  return base;
}

interface InboxItem {
  id: string;
  type: "income" | "expense" | null;
  amount: number | null;
  merchant: string | null;
  date: string;
  time: string | null;
  paymentMethod: string;
  category: string;
  confidence: number;
  issues: string[];
  bank?: string;
  engine: "rules" | "llm";
}

export function useAgentSync() {
  const data = useData();
  const dataRef = React.useRef(data);
  dataRef.current = data;
  const [syncing, setSyncing] = React.useState(false);
  const [lastError, setLastError] = React.useState<string>();

  const sync = React.useCallback(async (opts: { silent?: boolean } = {}) => {
    const d = dataRef.current;
    const token = d.settings.ingestToken?.trim();
    if (!token) {
      setLastError("Token integrasi belum diisi di Pengaturan → Integrasi.");
      return { ok: false, count: 0 };
    }
    setSyncing(true);
    try {
      const res = await fetch("/api/ingest", { headers: { authorization: `Bearer ${token}` }, cache: "no-store" });
      const j = (await res.json().catch(() => ({}))) as { items?: InboxItem[]; heartbeat?: string | null; detected?: number; parseErrors?: number; error?: string };
      if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
      const items = j.items ?? [];
      const created: Transaction[] = [];
      let working = d.transactions;
      for (const it of items) {
        const t = parsedToTransaction(
          { type: it.type, amount: it.amount, merchant: it.merchant, date: it.date, time: it.time, paymentMethod: it.paymentMethod, category: it.category, confidence: it.confidence, issues: it.issues ?? [], engine: it.engine, bank: it.bank },
          "android",
          { transactions: working, rules: d.rules, settings: d.settings },
        );
        created.push(t);
        working = [...working, t];
      }
      if (created.length) {
        await d.actions.upsertMany("transactions", created);
        const pending = created.filter((t) => t.status === "pending").length;
        d.actions.notify(
          { type: "transaction", title: `${created.length} transaksi terdeteksi dari Android`, body: pending ? `${pending} menunggu konfirmasi kamu.` : "Semua otomatis tercatat.", href: "/finance?tab=agent" },
          { toast: !opts.silent },
        );
      }
      await d.actions.updateAgent({ lastSync: nowLocal(), lastHeartbeat: j.heartbeat ?? d.agent.lastHeartbeat, detected: Math.max(d.agent.detected, j.detected ?? 0), parseErrors: j.parseErrors ?? d.agent.parseErrors });
      setLastError(undefined);
      return { ok: true, count: created.length };
    } catch (e) {
      setLastError((e as Error).message);
      return { ok: false, count: 0, error: (e as Error).message };
    } finally {
      setSyncing(false);
    }
  }, []);

  return { sync, syncing, lastError };
}
