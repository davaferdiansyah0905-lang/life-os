"use client";

import * as React from "react";
import { Icon, type IconName } from "../icons";
import { cn } from "@/lib/format";
import { Button, Modal } from "../ui";

type ToastKind = "success" | "error" | "info" | "warning";
interface ToastItem {
  id: number;
  kind: ToastKind;
  title: string;
  body?: string;
}

interface ConfirmOpts {
  title: string;
  message?: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  requireText?: string; // user must type this to confirm
}

const ToastCtx = React.createContext<{ toast: (kind: ToastKind, title: string, body?: string) => void; confirm: (o: ConfirmOpts) => Promise<boolean> } | null>(null);

const META: Record<ToastKind, { icon: IconName; color: string }> = {
  success: { icon: "CircleCheck", color: "#22C55E" },
  error: { icon: "CircleAlert", color: "#EF4444" },
  info: { icon: "Info", color: "#38BDF8" },
  warning: { icon: "TriangleAlert", color: "#F59E0B" },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<ToastItem[]>([]);
  const idRef = React.useRef(0);
  const [pending, setPending] = React.useState<(ConfirmOpts & { resolve: (v: boolean) => void }) | null>(null);
  const [typed, setTyped] = React.useState("");

  const dismiss = React.useCallback((id: number) => setItems((xs) => xs.filter((x) => x.id !== id)), []);
  const toast = React.useCallback(
    (kind: ToastKind, title: string, body?: string) => {
      const id = ++idRef.current;
      setItems((xs) => [...xs.slice(-3), { id, kind, title, body }]);
      setTimeout(() => dismiss(id), kind === "error" ? 6000 : 3800);
    },
    [dismiss],
  );
  const confirm = React.useCallback((o: ConfirmOpts) => new Promise<boolean>((resolve) => {
    setTyped("");
    setPending({ ...o, resolve });
  }), []);
  const close = (v: boolean) => {
    pending?.resolve(v);
    setPending(null);
  };
  const value = React.useMemo(() => ({ toast, confirm }), [toast, confirm]);

  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-3 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-[100] flex flex-col items-center gap-2 sm:inset-x-auto sm:right-5 sm:bottom-5 sm:items-end lg:bottom-5">
        {items.map((t) => (
          <div key={t.id} role="status" className="pointer-events-auto flex w-full max-w-sm animate-slide-up items-start gap-3 rounded-2xl border border-line-strong bg-elevated/95 px-4 py-3 shadow-[var(--shadow-pop)] backdrop-blur">
            <Icon name={META[t.kind].icon} size={18} style={{ color: META[t.kind].color }} className="mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{t.title}</p>
              {t.body && <p className="mt-0.5 text-xs text-muted">{t.body}</p>}
            </div>
            <button onClick={() => dismiss(t.id)} className="text-muted hover:text-fg" aria-label="Tutup notifikasi">
              <Icon name="X" size={14} />
            </button>
          </div>
        ))}
      </div>
      <Modal
        open={!!pending}
        onClose={() => close(false)}
        title={pending?.title ?? ""}
        icon={pending?.danger ? "TriangleAlert" : "Info"}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => close(false)}>
              {pending?.cancelText ?? "Batal"}
            </Button>
            <Button variant={pending?.danger ? "danger" : "primary"} disabled={!!pending?.requireText && typed.trim() !== pending.requireText} onClick={() => close(true)}>
              {pending?.confirmText ?? "Ya, lanjutkan"}
            </Button>
          </>
        }
      >
        <div className={cn("text-sm text-muted")}>{pending?.message}</div>
        {pending?.requireText && (
          <div className="mt-4">
            <label className="label">
              Ketik <span className="font-mono text-danger">{pending.requireText}</span> untuk konfirmasi
            </label>
            <input className="input" value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus />
          </div>
        )}
      </Modal>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const ctx = React.useContext(ToastCtx);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}
