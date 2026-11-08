// Demo data — every record is flagged `isDemo: true` and shown with a "DEMO" badge.
// Remove it any time from Settings → Data ("Hapus data demo").

import type { AppData, Goal, Note, Schedule, Task, Transaction } from "./types";
import { DEFAULT_SETTINGS } from "./constants";
import { addDays, addMonths, dayOfWeek, endOfMonth, nowLocal, startOfMonth, todayKey } from "./time";

function rng(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildDemoData(): Omit<AppData, "settings" | "agent" | "favorites" | "rules" | "notifications"> & {
  settings: Partial<AppData["settings"]>;
} {
  const today = todayKey();
  const now = nowLocal();
  const created = now;
  const r = rng(Number(today.replace(/-/g, "")) % 100000);
  const pick = <T,>(arr: T[]) => arr[Math.floor(r() * arr.length)];
  let idc = 0;
  const id = (p: string) => `demo-${p}-${++idc}`;

  // ── Schedules (recurring daily routine) ──
  const weekAgo = addDays(today, -21);
  const routine: [string, string, string, string, Schedule["recurrence"], Schedule["priority"], string?][] = [
    ["05:00", "06:00", "Rutinitas Pagi", "Ibadah", "daily", "medium", "Ibadah subuh, olah napas, dan merapikan kamar"],
    ["06:00", "06:45", "Sarapan", "Pribadi", "daily", "low"],
    ["07:00", "07:45", "Persiapan ke Kampus", "Pribadi", "weekdays", "low"],
    ["08:00", "10:00", "Kuliah", "Akademik", "weekdays", "high", "Kuliah reguler Teknik Telekomunikasi"],
    ["10:00", "12:00", "Belajar & Mengerjakan Tugas", "Akademik", "weekdays", "high"],
    ["12:00", "13:00", "Makan Siang & Istirahat", "Istirahat", "daily", "low"],
    ["13:00", "15:00", "Kegiatan Laboratorium", "Akademik", "weekdays", "high", "Praktikum Lab Jaringan"],
    ["15:00", "17:00", "Kegiatan Organisasi", "Organisasi", "weekdays", "medium", "Rapat & program kerja himpunan"],
    ["17:00", "18:00", "Olahraga", "Olahraga", "daily", "medium", "Lari sore / gym kampus"],
    ["19:00", "21:00", "Belajar & Proyek", "Akademik", "daily", "high", "Belajar mandiri, CCNA & proyek jaringan"],
    ["21:00", "21:30", "Review Aktivitas Harian", "Pribadi", "daily", "medium", "Evaluasi hari ini & rencana besok"],
    ["22:00", "24:00", "Istirahat Malam", "Istirahat", "daily", "low"],
  ];
  const locations: Record<string, string> = { Kuliah: "Gedung Elektro Lt. 3", "Kegiatan Laboratorium": "Lab Jaringan Komputer", "Kegiatan Organisasi": "Sekretariat Himpunan" };
  const schedules: Schedule[] = routine.map(([start, end, title, category, recurrence, priority, description]) => {
    const completedDates: string[] = [];
    for (let i = 1; i <= 20; i++) {
      const d = addDays(today, -i);
      const dow = dayOfWeek(d);
      if (recurrence === "weekdays" && (dow === 0 || dow === 6)) continue;
      if (r() < 0.82) completedDates.push(d);
    }
    return {
      id: id("sch"),
      title,
      description,
      date: weekAgo,
      start,
      end,
      category,
      priority,
      location: locations[title],
      recurrence,
      completedDates,
      isDemo: true,
      createdAt: created,
    };
  });
  // a couple of one-off events
  const sat = (() => {
    let d = addDays(today, 1);
    while (dayOfWeek(d) !== 6) d = addDays(d, 1);
    return d;
  })();
  schedules.push(
    { id: id("sch"), title: "Workshop Fiber Optik", description: "Workshop FTTH dari himpunan", date: sat, start: "09:00", end: "12:00", category: "Akademik", priority: "high", location: "Aula Fakultas", recurrence: "none", isDemo: true, createdAt: created },
    { id: id("sch"), title: "Quiz Elektromagnetika", date: addDays(today, 2), start: "07:00", end: "07:45", category: "Akademik", priority: "critical", location: "Ruang E-305", recurrence: "none", isDemo: true, createdAt: created, description: "Datang lebih awal" },
  );

  // ── Tasks ──
  const t = (
    title: string,
    deadlineOffset: number,
    time: string,
    category: string,
    priority: Task["priority"],
    est: number,
    status: Task["status"],
    subtasks: [string, boolean][] = [],
    description = "",
    completedOffset?: number,
  ): Task => ({
    id: id("task"),
    title,
    description,
    category,
    priority,
    startDate: addDays(today, Math.min(0, deadlineOffset) - 5),
    deadline: `${addDays(today, deadlineOffset)}T${time}`,
    estimatedMinutes: est,
    status,
    completedAt: status === "completed" ? `${addDays(today, completedOffset ?? deadlineOffset)}T${pick(["10:20", "16:45", "20:30", "21:10"])}` : undefined,
    subtasks: subtasks.map(([title, done]) => ({ id: id("sub"), title, done })),
    progress: status === "in_progress" ? 40 : 0,
    notes: "",
    isDemo: true,
    createdAt: created,
  });
  const tasks: Task[] = [
    t("Laporan Praktikum Telekomunikasi", 0, "23:59", "Akademik", "critical", 240, "in_progress", [["Olah data pengukuran", true], ["Tulis analisis", false], ["Kesimpulan & format", false]], "Modul 4: Modulasi Digital (ASK, FSK, PSK)"),
    t("Tugas Sinyal & Sistem Bab 5", 0, "17:00", "Akademik", "high", 120, "todo", [], "Soal 1–10, transformasi Fourier"),
    t("Kirim proposal program kerja himpunan", 0, "12:00", "Organisasi", "medium", 60, "completed", [], "", 0),
    t("Belajar CCNA — Modul VLAN & Trunking", 3, "21:00", "Karier", "high", 180, "todo", [["Baca materi", true], ["Lab Packet Tracer", false], ["Quiz latihan", false]]),
    t("Persiapan Quiz Elektromagnetika", 1, "22:00", "Akademik", "critical", 150, "todo", [["Rangkum persamaan Maxwell", false], ["Latihan soal", false]]),
    t("Update CV & portofolio LinkedIn", 6, "20:00", "Karier", "medium", 90, "todo"),
    t("Bayar iuran kas organisasi", -1, "17:00", "Organisasi", "low", 15, "todo"),
    t("Review jurnal IEEE untuk tugas besar", -2, "23:00", "Akademik", "high", 120, "todo"),
    t("Rekap anggaran bulan lalu", -3, "20:00", "Keuangan", "low", 30, "completed", [], "", -3),
    t("Tugas Pendahuluan Praktikum", -1, "07:00", "Akademik", "high", 90, "completed", [], "", -2),
    t("Slide presentasi Sistem Komunikasi", -4, "09:00", "Akademik", "medium", 120, "completed", [], "", -5),
    t("Daftar sertifikasi MikroTik MTCNA", 10, "17:00", "Karier", "medium", 30, "todo"),
    t("Laporan pertanggungjawaban acara", -6, "20:00", "Organisasi", "medium", 120, "completed", [], "", -6),
    t("Latihan soal Matematika Teknik", -8, "21:00", "Akademik", "medium", 90, "completed", [], "", -8),
  ];

  // ── Transactions (≈3 months) ──
  const transactions: Transaction[] = [];
  const tx = (date: string, type: Transaction["type"], amount: number, category: string, merchant: string, paymentMethod: string, description = "", time?: string) => {
    if (date > today) return;
    const at = time ?? `${String(7 + Math.floor(r() * 14)).padStart(2, "0")}:${String(Math.floor(r() * 60)).padStart(2, "0")}`;
    if (date === today && at > now.slice(11)) return; // no "future" spending today
    transactions.push({
      id: id("tx"),
      type,
      amount,
      date,
      time: at,
      category,
      merchant,
      description,
      paymentMethod,
      origin: "manual",
      status: "confirmed",
      isDemo: true,
      createdAt: created,
    });
  };
  const firstMonth = addMonths(startOfMonth(today), -2);
  for (let m = 0; m < 3; m++) {
    const ms = addMonths(firstMonth, m);
    tx(ms, "income", 3_500_000, "Uang Saku", "Kiriman Orang Tua", "Transfer Bank", "Uang saku bulanan", "08:00");
    tx(addDays(ms, 1), "expense", 900_000, "Tempat Tinggal", "Kost Griya Asri", "Transfer Bank", "Sewa kost bulanan", "09:00");
    tx(addDays(ms, 2), "expense", 300_000, "Tabungan", "Rekening Tabungan", "Transfer Bank", "Setor tabungan rutin", "09:30");
    tx(addDays(ms, 3), "expense", 75_000, "Komunikasi", "Telkomsel", "E-Wallet", "Paket data bulanan");
    if (m === 1) tx(addDays(ms, 14), "income", 1_200_000, "Beasiswa", "Beasiswa Prestasi Kampus", "Transfer Bank", "Beasiswa semester");
    if (m !== 1) tx(addDays(ms, 18), "income", 350_000 + m * 100_000, "Proyek", "Klien Desain Jaringan", "Transfer Bank", "Proyek setting jaringan kantor");
    const end = endOfMonth(ms);
    for (let d = ms; d <= end && d <= today; d = addDays(d, 1)) {
      // food 2x per day
      tx(d, "expense", pick([12_000, 15_000, 18_000, 20_000, 22_000, 25_000]), "Makanan & Minuman", pick(["Warung Makan Bu Sri", "Kantin Elektro", "Warteg Bahari", "Ayam Geprek Bensu", "Mie Ayam Pak Kumis"]), pick(["QRIS", "QRIS", "Tunai"]), "Makan siang", "12:15");
      tx(d, "expense", pick([15_000, 18_000, 20_000, 28_000]), "Makanan & Minuman", pick(["Nasi Padang Sederhana", "Bakso Solo", "Sate Madura", "Warung Makan Bu Sri"]), pick(["QRIS", "Tunai"]), "Makan malam", "18:40");
      if (r() < 0.35) tx(d, "expense", pick([18_000, 22_000, 25_000, 32_000]), "Makanan & Minuman", pick(["Kopi Kenangan", "Janji Jiwa", "Fore Coffee"]), "QRIS", "Kopi");
      const dow = dayOfWeek(d);
      if (dow >= 1 && dow <= 5 && r() < 0.55) tx(d, "expense", pick([10_000, 12_000, 15_000, 20_000]), "Transportasi", pick(["Gojek", "Grab", "KRL Commuter Line"]), pick(["E-Wallet", "QRIS"]), "Ke kampus");
      if (r() < 0.08) tx(d, "expense", pick([5_000, 12_000, 25_000, 85_000]), "Pendidikan", pick(["Fotocopy Berkah", "Gramedia", "Print Center Kampus"]), "QRIS", "Kebutuhan akademik");
      if (r() < 0.04) tx(d, "expense", pick([45_000, 60_000, 120_000]), "Belanja", pick(["Indomaret", "Alfamart", "Tokopedia"]), "QRIS", "Kebutuhan bulanan");
      if (r() < 0.03) tx(d, "expense", pick([50_000, 54_990]), "Hiburan", pick(["Bioskop XXI", "Spotify"]), "E-Wallet", "Hiburan");
    }
    tx(addDays(ms, 20), "expense", 50_000, "Organisasi", "Kas Himpunan", "Transfer Bank", "Iuran organisasi");
  }

  // ── Goals ──
  const g = (
    title: string,
    description: string,
    category: string,
    monthsAhead: number,
    priority: Goal["priority"],
    milestones: [string, boolean][],
  ): Goal => {
    const ms = milestones.map(([t, done], i) => ({ id: id("ms"), title: t, done, doneAt: done ? addDays(today, -60 + i * 9) : undefined }));
    return {
      id: id("goal"),
      title,
      description,
      category,
      targetDate: addMonths(today, monthsAhead),
      startDate: addMonths(today, -6),
      priority,
      progressMode: "auto",
      progress: 0,
      milestones: ms,
      notes: "",
      status: "active",
      history: ms.filter((m) => m.done).map((m) => ({ at: `${m.doneAt}T20:00`, text: `Milestone selesai: ${m.title}` })),
      isDemo: true,
      createdAt: created,
    };
  };
  const goals: Goal[] = [
    g("Menjadi Network Engineer Profesional", "Berkarier sebagai Network Engineer di perusahaan telekomunikasi terkemuka.", "Karier", 24, "critical", [
      ["Menyelesaikan S1 Teknik Telekomunikasi", false],
      ["Menguasai dasar-dasar jaringan", true],
      ["Lulus sertifikasi CCNA", false],
      ["Menyelesaikan program magang", false],
      ["Membangun proyek jaringan praktis", true],
      ["Melamar posisi Network Engineer", false],
    ]),
    g("Lulus dengan IPK ≥ 3,75 (Cum Laude)", "Lulus tepat waktu dengan prestasi akademik sangat baik.", "Akademik", 20, "high", [
      ["IPK semester ≥ 3,7", true],
      ["Tidak ada nilai di bawah B", true],
      ["Publikasi paper di konferensi nasional", false],
      ["Tugas akhir selesai tepat waktu", false],
    ]),
    g("Sertifikasi Internasional (CCNA & MTCNA)", "Mendapatkan minimal dua sertifikasi jaringan internasional.", "Sertifikasi", 8, "high", [
      ["Menyelesaikan materi CCNA 1–3", true],
      ["Latihan lab Packet Tracer 30 skenario", false],
      ["Ujian MTCNA", false],
      ["Ujian CCNA 200-301", false],
    ]),
    g("Dana Darurat Rp10 juta", "Mencapai kemandirian finansial bertahap mulai dari dana darurat.", "Keuangan", 14, "medium", [
      ["Tabungan Rp1 juta", true],
      ["Tabungan Rp3 juta", false],
      ["Tabungan Rp6 juta", false],
      ["Tabungan Rp10 juta", false],
    ]),
    g("Mengembangkan Kemampuan Kepemimpinan", "Memimpin divisi di himpunan dan belajar public speaking.", "Kepemimpinan", 10, "medium", [
      ["Menjadi koordinator divisi", true],
      ["Memimpin satu acara besar", true],
      ["Ikut pelatihan kepemimpinan (LKMM)", false],
    ]),
  ];

  // ── Notes ──
  const n = (title: string, content: string, category: string, pinned = false, offset = 0): Note => ({
    id: id("note"),
    title,
    content,
    category,
    pinned,
    isDemo: true,
    createdAt: `${addDays(today, offset)}T08:00`,
    updatedAt: `${addDays(today, offset)}T20:00`,
  });
  const notes: Note[] = [
    n("Target minggu ini", "1. Selesaikan laporan praktikum\n2. Lab VLAN di Packet Tracer\n3. Lari 3x\n4. Tidak jajan kopi lebih dari 2x", "Catatan Cepat", true, 0),
    n("Rumus penting Elektromagnetika", "• Hukum Gauss: ∮E·dA = Q/ε₀\n• Hukum Faraday: ∮E·dl = −dΦB/dt\n• Ampere-Maxwell: ∮B·dl = μ₀(I + ε₀ dΦE/dt)", "Catatan Akademik", true, -2),
    n("Ide proyek: monitoring jaringan kos", "Pakai Raspberry Pi + Grafana untuk memantau bandwidth WiFi kos. Bisa dijadikan portofolio.", "Ide & Inspirasi", false, -5),
    n("Jurnal — refleksi", "Hari ini cukup produktif. Kuliah lancar, tapi waktu belajar malam terpotong karena rapat. Besok mulai lebih awal.", "Jurnal Harian", false, -1),
    n("Info penting beasiswa", "Pendaftaran beasiswa prestasi dibuka bulan depan. Siapkan: transkrip, surat rekomendasi dosen, esai 500 kata.", "Info Penting", false, -3),
    n("Perusahaan target magang", "Telkom Indonesia, Telkomsel, XL Axiata, Indosat Ooredoo Hutchison, Huawei, Ericsson, Nokia.", "Catatan Karier", false, -7),
  ];

  return {
    schedules,
    tasks,
    transactions,
    goals,
    notes,
    settings: {
      ...DEFAULT_SETTINGS,
      initialBalance: 1_200_000,
      monthlyBudget: 3_300_000,
      weeklyBudget: 500_000,
      dailyBudget: 75_000,
      categoryBudgets: { "Makanan & Minuman": 1_600_000, Transportasi: 350_000, Hiburan: 150_000 },
    },
  };
}
