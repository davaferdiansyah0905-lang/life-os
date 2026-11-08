import type { IconName } from "@/components/icons";
import type { Priority, Settings } from "./types";

export const APP_NAME = "LifeOS";

export const SCHEDULE_CATEGORIES = [
  "Akademik",
  "Organisasi",
  "Kerja",
  "Pribadi",
  "Olahraga",
  "Ibadah",
  "Istirahat",
  "Lainnya",
] as const;

export const SCHEDULE_CATEGORY_META: Record<string, { color: string; icon: IconName }> = {
  Akademik: { color: "#3B82F6", icon: "GraduationCap" },
  Organisasi: { color: "#A78BFA", icon: "Users" },
  Kerja: { color: "#F59E0B", icon: "Briefcase" },
  Pribadi: { color: "#38BDF8", icon: "User" },
  Olahraga: { color: "#22C55E", icon: "Dumbbell" },
  Ibadah: { color: "#2DD4BF", icon: "Sparkles" },
  Istirahat: { color: "#64748B", icon: "Bed" },
  Lainnya: { color: "#94A3B8", icon: "Circle" },
};

/** Categories that count as "productive" hours in evaluations. */
export const PRODUCTIVE_CATEGORIES = ["Akademik", "Organisasi", "Kerja", "Olahraga"];
export const REST_CATEGORY = "Istirahat";

export const TASK_CATEGORIES = ["Akademik", "Organisasi", "Kerja", "Karier", "Pribadi", "Keuangan", "Lainnya"] as const;

export const PRIORITIES: { value: Priority; label: string; color: string; weight: number }[] = [
  { value: "low", label: "Rendah", color: "#94A3B8", weight: 1 },
  { value: "medium", label: "Sedang", color: "#38BDF8", weight: 2 },
  { value: "high", label: "Tinggi", color: "#F59E0B", weight: 3 },
  { value: "critical", label: "Kritis", color: "#EF4444", weight: 4 },
];
export const PRIORITY_META = Object.fromEntries(PRIORITIES.map((p) => [p.value, p])) as Record<
  Priority,
  (typeof PRIORITIES)[number]
>;

export const TASK_STATUS_META = {
  todo: { label: "To Do", color: "#94A3B8" },
  in_progress: { label: "In Progress", color: "#38BDF8" },
  completed: { label: "Selesai", color: "#22C55E" },
  overdue: { label: "Terlambat", color: "#EF4444" },
} as const;

export const INCOME_SOURCES = [
  "Uang Saku",
  "Beasiswa",
  "Magang",
  "Kerja Paruh Waktu",
  "Proyek",
  "Bisnis",
  "Lainnya (Pemasukan)",
] as const;

export const EXPENSE_CATEGORIES = [
  "Makanan & Minuman",
  "Transportasi",
  "Pendidikan",
  "Tempat Tinggal",
  "Belanja",
  "Hiburan",
  "Kesehatan",
  "Komunikasi",
  "Organisasi",
  "Tabungan",
  "Lainnya",
] as const;

export const SAVINGS_CATEGORY = "Tabungan";

export const FINANCE_CATEGORY_META: Record<string, { color: string; icon: IconName }> = {
  "Makanan & Minuman": { color: "#F59E0B", icon: "Utensils" },
  Transportasi: { color: "#38BDF8", icon: "Car" },
  Pendidikan: { color: "#3B82F6", icon: "GraduationCap" },
  "Tempat Tinggal": { color: "#A78BFA", icon: "House" },
  Belanja: { color: "#EC4899", icon: "ShoppingBag" },
  Hiburan: { color: "#F472B6", icon: "Film" },
  Kesehatan: { color: "#22C55E", icon: "HeartPulse" },
  Komunikasi: { color: "#2DD4BF", icon: "Smartphone" },
  Organisasi: { color: "#818CF8", icon: "Users" },
  Tabungan: { color: "#10B981", icon: "PiggyBank" },
  Lainnya: { color: "#94A3B8", icon: "Tag" },
  "Uang Saku": { color: "#22C55E", icon: "Wallet" },
  Beasiswa: { color: "#60A5FA", icon: "Award" },
  Magang: { color: "#38BDF8", icon: "Briefcase" },
  "Kerja Paruh Waktu": { color: "#2DD4BF", icon: "Clock" },
  Proyek: { color: "#A78BFA", icon: "Rocket" },
  Bisnis: { color: "#F59E0B", icon: "Store" },
  "Lainnya (Pemasukan)": { color: "#94A3B8", icon: "Banknote" },
};

export const PAYMENT_METHODS = [
  "Tunai",
  "QRIS",
  "Transfer Bank",
  "Kartu Debit",
  "E-Wallet",
  "Kartu Kredit",
  "Virtual Account",
  "Lainnya",
] as const;

export const GOAL_CATEGORIES = [
  "Akademik",
  "Karier",
  "Keuangan",
  "Pengembangan Diri",
  "Sertifikasi",
  "Bisnis",
  "Kepemimpinan",
  "Kesehatan",
  "Lainnya",
] as const;

export const GOAL_CATEGORY_META: Record<string, { color: string; icon: IconName }> = {
  Akademik: { color: "#3B82F6", icon: "GraduationCap" },
  Karier: { color: "#38BDF8", icon: "Briefcase" },
  Keuangan: { color: "#22C55E", icon: "PiggyBank" },
  "Pengembangan Diri": { color: "#A78BFA", icon: "Brain" },
  Sertifikasi: { color: "#F59E0B", icon: "Award" },
  Bisnis: { color: "#EC4899", icon: "Rocket" },
  Kepemimpinan: { color: "#818CF8", icon: "Flag" },
  Kesehatan: { color: "#10B981", icon: "HeartPulse" },
  Lainnya: { color: "#94A3B8", icon: "Target" },
};

export const NOTE_CATEGORIES = [
  "Catatan Cepat",
  "Jurnal Harian",
  "Ide & Inspirasi",
  "Info Penting",
  "Catatan Akademik",
  "Catatan Karier",
] as const;

export const NOTE_CATEGORY_META: Record<string, { color: string; icon: IconName }> = {
  "Catatan Cepat": { color: "#38BDF8", icon: "Zap" },
  "Jurnal Harian": { color: "#A78BFA", icon: "BookOpen" },
  "Ide & Inspirasi": { color: "#F59E0B", icon: "Lightbulb" },
  "Info Penting": { color: "#EF4444", icon: "Info" },
  "Catatan Akademik": { color: "#3B82F6", icon: "GraduationCap" },
  "Catatan Karier": { color: "#22C55E", icon: "Briefcase" },
};

export const QUOTE_CATEGORIES = [
  "Disiplin",
  "Mimpi & Ambisi",
  "Perjuangan & Ketekunan",
  "Kepemimpinan",
  "Kesuksesan",
  "Pengembangan Diri",
  "Pendidikan",
  "Karier",
  "Manajemen Waktu",
  "Konsistensi",
] as const;

export const WORK_WINDOWS: Record<Settings["preferredWorkTime"], { label: string; from: string; to: string }> = {
  pagi: { label: "Pagi (05:00–11:00)", from: "05:00", to: "11:00" },
  siang: { label: "Siang (11:00–15:00)", from: "11:00", to: "15:00" },
  sore: { label: "Sore (15:00–18:30)", from: "15:00", to: "18:30" },
  malam: { label: "Malam (18:30–23:00)", from: "18:30", to: "23:00" },
  fleksibel: { label: "Fleksibel (06:00–23:00)", from: "06:00", to: "23:00" },
};

export const DEFAULT_SETTINGS: Settings = {
  name: "Dava",
  initialBalance: 0,
  monthlyBudget: 0,
  weeklyBudget: 0,
  dailyBudget: 0,
  categoryBudgets: {},
  currency: "IDR",
  timeFormat: "24h",
  timezone: "Asia/Jakarta",
  theme: "dark",
  notificationsEnabled: true,
  browserNotifications: false,
  reminderMinutes: 15,
  quoteCategories: [...QUOTE_CATEGORIES],
  activeHoursStart: "05:00",
  activeHoursEnd: "22:00",
  preferredWorkTime: "malam",
  ingestToken: "",
  autoConfirmThreshold: 1,
  aiAgentEnabled: true,
};

export const CURRENCIES = [
  { code: "IDR", label: "Rupiah (IDR)", locale: "id-ID" },
  { code: "USD", label: "US Dollar (USD)", locale: "en-US" },
  { code: "SGD", label: "Singapore Dollar (SGD)", locale: "en-SG" },
  { code: "MYR", label: "Ringgit (MYR)", locale: "ms-MY" },
  { code: "EUR", label: "Euro (EUR)", locale: "de-DE" },
];

export const TIMEZONES = ["Asia/Jakarta", "Asia/Makassar", "Asia/Jayapura", "Asia/Singapore", "Asia/Kuala_Lumpur", "Asia/Tokyo", "Europe/London", "UTC"];
