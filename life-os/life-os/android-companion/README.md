# LifeOS Companion (Android)

Aplikasi Kotlin kecil yang membaca notifikasi transaksi (QRIS, transfer, e-wallet) **setelah Anda memberi izin Akses Notifikasi**, lalu mengirimnya ke dashboard LifeOS (`/api/ingest`).

## Build & pasang
1. Install **Android Studio** (versi terbaru).
2. *File → Open* → pilih folder `android-companion`. Android Studio akan mengunduh Gradle & SDK yang dibutuhkan (jika diminta membuat Gradle wrapper, setujui).
3. Sambungkan HP (aktifkan *USB debugging*) → klik **Run ▶**. Atau *Build → Build APK(s)* lalu salin APK ke HP.

## Pengaturan di HP
1. Buka **LifeOS Companion**.
2. Isi **URL dashboard** (`https://nama-anda.vercel.app`) dan **Token** (sama dengan `INGEST_TOKEN` di Vercel).
3. Tekan **Beri izin Akses Notifikasi** → aktifkan *LifeOS — deteksi transaksi*.
4. Tekan **Tes koneksi** → harus muncul "Terhubung ✔". Status di dashboard (Keuangan → AI Agent) menjadi *Terhubung*.
5. Tekan **Kirim notifikasi contoh** → transaksi contoh muncul di Antrean Konfirmasi.

## Cara kerja & privasi
- Default: memantau semua aplikasi, tetapi **hanya** meneruskan notifikasi yang memuat nominal (Rp/IDR) **dan** kata transaksi (QRIS, pembayaran, transfer, dana masuk, …).
- Notifikasi yang mengandung OTP / PIN / kata sandi **selalu diabaikan**.
- Bisa dibatasi ke daftar paket aplikasi bank/e-wallet tertentu (matikan opsi "Pantau semua aplikasi"). Nama paket bawaan adalah perkiraan umum — sesuaikan jika aplikasi bank Anda berbeda.
- Jika offline, data disimpan di antrean kecil di HP dan dikirim ulang otomatis.
- Server hanya menyimpan hasil parsing (nominal, merchant, tanggal, metode, kategori), bukan teks notifikasi lengkap.
- Aplikasi tidak pernah meminta password/PIN/OTP dan tidak membuka aplikasi bank.

Catatan: beberapa produsen (Xiaomi, Oppo, Vivo) mematikan layanan latar belakang secara agresif — izinkan *Autostart* dan nonaktifkan *Battery optimization* untuk LifeOS Companion.
