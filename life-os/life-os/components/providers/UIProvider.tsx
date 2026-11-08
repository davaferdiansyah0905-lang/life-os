"use client";

import * as React from "react";
import type { Goal, Note, Schedule, Task, Transaction } from "@/lib/types";

export type ModalState =
  | { kind: "task"; task?: Task; preset?: Partial<Task> }
  | { kind: "schedule"; schedule?: Schedule; preset?: Partial<Schedule> }
  | { kind: "transaction"; tx?: Transaction; preset?: Partial<Transaction> }
  | { kind: "goal"; goal?: Goal }
  | { kind: "note"; note?: Note; preset?: Partial<Note> }
  | { kind: "smart"; taskId: string }
  | { kind: "favorites" }
  | null;

export type FocusTarget = { type: "task" | "schedule" | "transaction" | "goal" | "note"; id: string; date?: string; query?: string } | null;

interface UICtx {
  modal: ModalState;
  openModal: (m: Exclude<ModalState, null>) => void;
  closeModal: () => void;
  focus: FocusTarget;
  setFocus: (f: FocusTarget) => void;
  assistantOpen: boolean;
  setAssistantOpen: (v: boolean) => void;
  mobileNavOpen: boolean;
  setMobileNavOpen: (v: boolean) => void;
}

const Ctx = React.createContext<UICtx | null>(null);

export function UIProvider({ children }: { children: React.ReactNode }) {
  const [modal, setModal] = React.useState<ModalState>(null);
  const [focus, setFocus] = React.useState<FocusTarget>(null);
  const [assistantOpen, setAssistantOpen] = React.useState(false);
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);
  const value = React.useMemo<UICtx>(
    () => ({
      modal,
      openModal: (m) => setModal(m),
      closeModal: () => setModal(null),
      focus,
      setFocus,
      assistantOpen,
      setAssistantOpen,
      mobileNavOpen,
      setMobileNavOpen,
    }),
    [modal, focus, assistantOpen, mobileNavOpen],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useUI() {
  const c = React.useContext(Ctx);
  if (!c) throw new Error("useUI must be used inside UIProvider");
  return c;
}
