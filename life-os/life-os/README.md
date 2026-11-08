# LifeOS — Personal Life Management Dashboard

Pusat kendali pribadi Dava: **jadwal, tugas, keuangan, goals, catatan, analitik, notifikasi, dan PERSONAL AI** dalam satu aplikasi web Next.js yang bisa di-deploy gratis ke Vercel (`nama-anda.vercel.app`).

- 🔓 Tanpa login — langsung terbuka.
- 💾 Local-first — semua data tersimpan di **IndexedDB** browser (tetap ada setelah refresh / browser ditutup).
- 🇮🇩 Bahasa Indonesia, format Rupiah, zona waktu default **Asia/Jakarta**.
- 🧪 Berisi **data demo berlabel DEMO** yang bisa dihapus kapan saja (Pengaturan → Data → *Hapus demo*).

---

## 1. Deploy ke Vercel (gratis) — langkah demi langkah

> Tidak perlu install apa pun di komputer jika memakai cara A.

### Cara A — lewat GitHub (disarankan)
1. Buat akun di **github.com** dan **vercel.com** (login Vercel pakai akun GitHub).
2. Di GitHub klik **New repository** → beri nama `life-os` → **Create repository**.
3. Klik **uploading an existing file**, lalu seret **seluruh isi folder `life-os`** (bukan file zip-nya) → **Commit changes**.
4. Buka **vercel.com/new** → pilih repository `life-os` → **Import**.
5. Framework otomatis terdeteksi **Next.js**. Tidak perlu mengubah apa pun → klik **Deploy**.
6. Tunggu ±1–2 menit. Aplikasi aktif di `https://life-os-xxxx.vercel.app` 🎉
   (Ganti nama domain di **Project → Settings → Domains**, misalnya `dava-lifeos.vercel.app`.)

### Cara B — lewat Vercel CLI
```bash
npm i -g vercel
cd life-os
vercel        # ikuti pertanyaan, lalu
vercel --prod
```

### Menjalankan di komputer sendiri (opsional)
Butuh Node.js 18.18+ (disarankan 20/22).
```bash
cd life-os
npm install
npm run dev        # buka http://localhost:3000
```

---

## 2. Fitur opsional (environment variables)

Semua fitur inti berjalan **tanpa** variabel apa pun. Isi di Vercel: **Project → Settings → Environment Variables**, lalu **Redeploy**. Daftar lengkap ada di `.env.example`.

### a) PERSONAL AI & AI parser dengan LLM
| Variabel | Contoh |
|---|---|
| `LLM_PROVIDER` | `anthropic` atau `openai` (juga untuk API kompatibel OpenAI: Groq, Gemini, OpenRouter) |
| `LLM_API_KEY` | kunci API Anda |
| `LLM_MODEL` | `claude-haiku-5-5`, `gpt-4o-mini`, `llama-3.3-70b-versatile`, `gemini-2.0-flash` |
| `LLM_BASE_URL` | hanya untuk non-OpenAI, mis. Groq `https://api.groq.com/openai/v1`, Gemini `https://generativelanguage.googleapis.com/v1beta/openai` |

- Kunci API **hanya dibaca di server** (`/api/ai/*`), tidak pernah dikirim ke browser.
- Tanpa kunci, PERSONAL AI tetap bekerja dengan **mesin lokal berbasis aturan** yang menghitung langsung dari data Anda — dan UI menyatakannya dengan jelas ("Mode lokal"). Tidak ada AI palsu.
- Dengan kunci, LLM hanya menerima ringkasan data (jadwal 3 hari, tugas, ringkasan keuangan, goals) dan diinstruksikan untuk tidak mengarang. Usulan jadwal dari LLM **divalidasi ulang terhadap bentrok** sebelum disimpan.

### b) Android Companion (deteksi otomatis transaksi QRIS)
1. Vercel → **Storage → Marketplace → Upstash (Redis)** → *Create* & hubungkan ke project (gratis). Vercel otomatis menambahkan `KV_REST_API_URL` & `KV_REST_API_TOKEN`.
2. Tambahkan `INGEST_TOKEN` = string acak ≥ 24 karakter (bisa dibuat dengan tombol **Buat** di Pengaturan → Integrasi).
3. Redeploy. Di dashboard: **Pengaturan → Integrasi** → tempel token yang sama → *Simpan token*.
4. Build aplikasi Android di folder `android-companion/` (lihat README di sana), isi URL `https://nama-anda.vercel.app` + token, lalu beri izin **Akses Notifikasi**.

Alur: QRIS di m-banking → notifikasi masuk → `NotificationListenerService` → `POST /api/ingest` (Bearer token) → server mem-parsing (aturan + LLM opsional) & **hanya menyimpan kolom transaksi** di antrean Redis → dashboard menarik antrean tiap 60 detik → transaksi masuk **Antrean Konfirmasi** (atau otomatis tercatat bila Anda mengaktifkan ambang keyakinan).

---

## 3. Peta fitur

| Halaman | Isi |
|---|---|
| **Ringkasan** | Sapaan sesuai waktu, jam digital live (WIB), kutipan motivasi harian (110 kutipan, 10 kategori, ganti otomatis tiap hari tanpa pengulangan hingga semua tampil, *More Inspiration*, simpan favorit), skor produktivitas, 6 kartu statistik, jadwal hari ini (aktivitas berjalan disorot + berikutnya), ringkasan keuangan + grafik 7 hari, deadline berwarna (biru/kuning/merah), goals, 5 tombol aksi cepat. |
| **Jadwal Saya** | Tampilan harian (timeline 24 jam), mingguan, bulanan; klik slot kosong untuk menambah; tambah/edit/duplikat/hapus (satu kejadian atau seluruh seri); jadwal berulang; **deteksi bentrok otomatis** dengan aktivitas yang bentrok, jam tumpang tindih, dan **saran slot alternatif** — tidak pernah menyimpan diam-diam; manajemen waktu harian (terjadwal, istirahat, waktu luang, tidak teralokasi); evaluasi mingguan. |
| **Tugas** | Judul, deskripsi, kategori, prioritas (Rendah–Kritis), mulai, deadline, estimasi, status (To Do/In Progress/Completed/Overdue otomatis), catatan, subtugas, progres; cari, filter kategori/prioritas/deadline, urutkan; tampilan List & Board (drag & drop); **Smart Deadline Planner** (cek jadwal → cari slot kosong → pilih waktu terbaik sesuai waktu favorit → cek bentrok → minta persetujuan; tidak pernah menimpa jadwal). |
| **Keuangan** | 7 kartu (saldo, pemasukan, pengeluaran, arus kas, anggaran, sisa, tabungan); 6 grafik interaktif (pemasukan vs pengeluaran, tren harian, distribusi kategori, arus kas, pertumbuhan tabungan, pemakaian anggaran) dengan filter Harian/Mingguan/Bulanan/Tahunan/Kustom; tabel transaksi (saldo setelah transaksi, cari, filter, urut, paginasi, edit, hapus, ekspor CSV); anggaran harian/mingguan/bulanan/per kategori dengan peringatan 80% & 100%; lampiran struk. |
| **AI Agent** (tab Keuangan) | Status kartu (terhubung, sinkron terakhir, terdeteksi, menunggu konfirmasi, error parsing), input teks notifikasi, **mode simulasi berlabel**, impor CSV (+ template), antrean konfirmasi, deteksi duplikat, **belajar dari koreksi kategori**, panduan integrasi & contoh `curl`. |
| **Goals & Impian** | Goal + milestone, progres otomatis, sisa waktu, riwayat pencapaian, peta perjalanan milestone, grafik progres vs waktu berjalan. |
| **Catatan** | Catatan cepat, jurnal harian, ide, info penting, akademik, karier — cari, kategori, sematkan, simpan otomatis. |
| **Analitik** | Skor harian/mingguan/bulanan, tingkat penyelesaian, jam produktif, hari terproduktif, tugas paling sering terlewat, tren keuangan, rasio tabungan, pola pengeluaran, perbandingan bulanan, dan **insight otomatis dari data nyata**. |
| **Pengaturan** | Nama, saldo awal, anggaran, mata uang (IDR default), format 12/24 jam, zona waktu, tema (Gelap/Midnight/Terang), notifikasi browser & waktu pengingat (5/15/30/60 menit/kustom), preferensi kutipan, integrasi, **ekspor/impor JSON, ekspor CSV, hapus data demo, hapus semua data** (dengan konfirmasi ketik `HAPUS`). |
| **PERSONAL AI** | Tombol melayang ✨ di semua halaman. Menjawab kegiatan hari ini, bentrok jadwal, pengeluaran, kategori terbesar, membuat sesi belajar bebas bentrok, tugas mendesak, dan evaluasi goal. |

**Rumus keuangan** (hanya transaksi berstatus *Terkonfirmasi* — transaksi menunggu konfirmasi tidak dihitung, sehingga tidak ada double counting):
- Total Pemasukan = Σ pemasukan · Total Pengeluaran = Σ pengeluaran
- Arus Kas Bersih = Pemasukan − Pengeluaran
- Saldo = Saldo Awal + Pemasukan − Pengeluaran
- Sisa Anggaran = Anggaran Bulanan − Pengeluaran Bulan Ini
- Tabungan = pengeluaran berkategori **Tabungan** (uang dipindah ke rekening tabungan)

---

## 4. Arsitektur

```
app/
  layout.tsx, page.tsx, schedule/, tasks/, finance/, goals/, notes/, analytics/, settings/
  api/health       → status integrasi (boolean saja, tanpa rahasia)
  api/ai/chat      → PERSONAL AI via LLM (kunci di server)
  api/ai/parse     → parser notifikasi (aturan + LLM opsional)
  api/ingest       → endpoint Android companion (Bearer token + Upstash Redis)
components/
  shell/           → sidebar, topbar, navigasi mobile, pencarian global, notifikasi, pengingat, sinkron agent
  views/           → halaman-halaman
  forms/           → modal jadwal (deteksi bentrok), tugas, Smart Planner, transaksi, goal, catatan
  providers/       → DataProvider (IndexedDB), toast & dialog konfirmasi, state UI
  charts.tsx       → grafik SVG interaktif ringan
  icons.tsx        → ikon Lucide (inline, lisensi ISC)
lib/               → logika murni: waktu (Asia/Jakarta), jadwal & bentrok, planner, keuangan, parser, kutipan, analitik, asisten, CSV, demo
android-companion/ → aplikasi Kotlin (NotificationListenerService)
```

**Keputusan teknis** (dibuat agar build di Vercel paling stabil & ringan):
- Dependensi runtime hanya `next`, `react`, `react-dom` (+ Tailwind CSS v4 saat build).
- Penyimpanan memakai lapisan IndexedDB buatan sendiri (`lib/db.ts`, API mirip Dexie) dan grafik SVG buatan sendiri (`components/charts.tsx`) alih-alih Dexie/Recharts — fungsinya sama (persisten, interaktif, tooltip, responsif) tanpa paket tambahan.
- Komponen UI ditulis dengan pola shadcn/ui (Tailwind + komponen lokal) tanpa memasang Radix.
- `typescript.ignoreBuildErrors` diaktifkan agar deploy tidak pernah gagal karena perbedaan versi tipe; jalankan `npm run typecheck` untuk pemeriksaan tipe.

## 5. Keamanan & privasi
- Tidak pernah meminta password, PIN, atau OTP bank; tidak login ke aplikasi bank.
- Akses notifikasi Android hanya setelah izin eksplisit; notifikasi yang mengandung OTP/PIN diabaikan.
- Server hanya menyimpan kolom transaksi (tipe, nominal, merchant, tanggal, metode, kategori) — teks notifikasi lengkap dibuang setelah diparsing.
- Transaksi yang belum pasti masuk antrean konfirmasi terlebih dahulu.
- Endpoint `/api/ingest` dilindungi token (perbandingan *constant-time*).

## 6. Backup
Data ada di browser yang Anda pakai. Untuk pindah perangkat/browser: **Pengaturan → Ekspor semua (JSON)**, lalu di perangkat lain **Pulihkan dari JSON**. Lakukan backup rutin.
