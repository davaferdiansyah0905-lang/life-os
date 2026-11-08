// ─── Core domain types ──────────────────────────────────────────────

export type Priority = "low" | "medium" | "high" | "critical";
export type Recurrence = "none" | "daily" | "weekdays" | "weekly" | "monthly";

export interface Schedule {
  id: string;
  title: string;
  description?: string;
  date: string; // YYYY-MM-DD (first occurrence)
  start: string; // HH:mm
  end: string; // HH:mm ("24:00" allowed)
  category: string;
  priority: Priority;
  location?: string;
  recurrence: Recurrence;
  recurrenceUntil?: string; // YYYY-MM-DD
  excludedDates?: string[];
  completedDates?: string[];
  taskId?: string;
  isDemo?: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface Subtask {
  id: string;
  title: string;
  done: boolean;
}

export type TaskStatus = "todo" | "in_progress" | "completed";

export interface Task {
  id: string;
  title: string;
  description?: string;
  category: string;
  priority: Priority;
  startDate: string; // YYYY-MM-DD
  deadline: string; // YYYY-MM-DDTHH:mm (local, timezone from settings)
  estimatedMinutes: number;
  status: TaskStatus;
  completedAt?: string; // YYYY-MM-DDTHH:mm
  notes?: string;
  subtasks: Subtask[];
  progress: number; // 0..100 (manual when no subtasks)
  isDemo?: boolean;
  createdAt: string;
  updatedAt?: string;
}

export type TxType = "income" | "expense";
export type TxOrigin = "manual" | "csv" | "notification" | "android" | "simulation" | "assistant";

export interface Transaction {
  id: string;
  type: TxType;
  amount: number;
  date: string; // YYYY-MM-DD
  time?: string; // HH:mm
  category: string; // expense category OR income source
  merchant?: string; // expense merchant / income payer
  description?: string;
  paymentMethod: string;
  receipt?: string; // compressed data URL
  origin: TxOrigin;
  status: "confirmed" | "pending";
  confidence?: number;
  issues?: string[];
  duplicateOf?: string;
  isDemo?: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface Milestone {
  id: string;
  title: string;
  done: boolean;
  doneAt?: string;
}

export interface GoalHistory {
  at: string; // ISO-ish local
  text: string;
}

export interface Goal {
  id: string;
  title: string;
  description?: string;
  category: string;
  targetDate: string;
  startDate: string;
  priority: Priority;
  progressMode: "auto" | "manual";
  progress: number;
  milestones: Milestone[];
  notes?: string;
  status: "active" | "completed" | "paused";
  history: GoalHistory[];
  isDemo?: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  category: string;
  pinned: boolean;
  isDemo?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CategoryRule {
  id: string; // normalized merchant key
  merchant: string;
  category: string;
  hits: number;
  updatedAt: string;
}

export type NotificationType =
  | "schedule"
  | "deadline"
  | "overdue"
  | "conflict"
  | "budget"
  | "transaction"
  | "goal"
  | "system";

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  href?: string;
}

export interface Settings {
  name: string;
  initialBalance: number;
  monthlyBudget: number;
  weeklyBudget: number;
  dailyBudget: number;
  categoryBudgets: Record<string, number>;
  currency: string;
  timeFormat: "24h" | "12h";
  timezone: string;
  theme: "dark" | "midnight" | "light";
  notificationsEnabled: boolean;
  browserNotifications: boolean;
  reminderMinutes: number;
  quoteCategories: string[];
  activeHoursStart: string; // waking window used for "free time"
  activeHoursEnd: string;
  preferredWorkTime: "pagi" | "siang" | "sore" | "malam" | "fleksibel";
  ingestToken: string;
  autoConfirmThreshold: number; // 0..1 ; 1 = always ask
  aiAgentEnabled: boolean;
}

export interface AgentMeta {
  lastSync?: string;
  lastHeartbeat?: string;
  detected: number;
  parseErrors: number;
}

export interface AppData {
  schedules: Schedule[];
  tasks: Task[];
  transactions: Transaction[];
  goals: Goal[];
  notes: Note[];
  rules: CategoryRule[];
  notifications: AppNotification[];
  favorites: number[];
  settings: Settings;
  agent: AgentMeta;
}

export type CollectionName = "schedules" | "tasks" | "transactions" | "goals" | "notes" | "rules" | "notifications";

export interface CollectionMap {
  schedules: Schedule;
  tasks: Task;
  transactions: Transaction;
  goals: Goal;
  notes: Note;
  rules: CategoryRule;
  notifications: AppNotification;
}
