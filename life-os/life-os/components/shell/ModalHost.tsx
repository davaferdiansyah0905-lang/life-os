"use client";

import { useUI } from "../providers/UIProvider";
import { ScheduleForm } from "../forms/ScheduleForm";
import { TaskForm } from "../forms/TaskForm";
import { TransactionForm } from "../forms/TransactionForm";
import { GoalForm } from "../forms/GoalForm";
import { NoteForm } from "../forms/NoteForm";
import { SmartPlanner } from "../forms/SmartPlanner";
import { FavoritesModal } from "../views/QuoteCard";

export function ModalHost() {
  const { modal, closeModal } = useUI();
  if (!modal) return null;
  switch (modal.kind) {
    case "task":
      return <TaskForm key={modal.task?.id ?? "new"} task={modal.task} preset={modal.preset} onClose={closeModal} />;
    case "schedule":
      return <ScheduleForm key={modal.schedule?.id ?? "new"} schedule={modal.schedule} preset={modal.preset} onClose={closeModal} />;
    case "transaction":
      return <TransactionForm key={modal.tx?.id ?? "new"} tx={modal.tx} preset={modal.preset} onClose={closeModal} />;
    case "goal":
      return <GoalForm key={modal.goal?.id ?? "new"} goal={modal.goal} onClose={closeModal} />;
    case "note":
      return <NoteForm key={modal.note?.id ?? "new"} note={modal.note} preset={modal.preset} onClose={closeModal} />;
    case "smart":
      return <SmartPlanner key={modal.taskId} taskId={modal.taskId} onClose={closeModal} />;
    case "favorites":
      return <FavoritesModal onClose={closeModal} />;
    default:
      return null;
  }
}
