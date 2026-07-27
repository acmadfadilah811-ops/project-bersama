---
tags: [koordinasi, epik]
status: aktif
created: 2026-07-27
---

# Epik: Bug QA Manual

Bucket untuk bug yang ditemukan user langsung dari pemakaian aplikasi (bukan dari audit graph/kode), yang tidak masuk salah satu epik integrasi utama. Satu bug = satu task T-5xx, tidak digabung.

## Aturan khusus epik ini

- **B1 mutlak**: setiap task di sini WAJIB direproduksi ulang oleh executor sebelum menyentuh kode — laporan awal (dari user atau manager) adalah titik mulai, bukan bukti final.
- Kalau manager menulis hipotesis root cause di note task, itu **hipotesis**, bukan instruksi buta — executor tetap wajib konfirmasi sebelum fix (X6 kalau hipotesis ternyata salah).
- Perhatikan duplikasi modul yang sudah diketahui ([[Project Overview]] §3, [[Aturan Engineering]] R1/M3) — beberapa halaman punya versi lama & baru hidup berdampingan. Pastikan menyentuh file yang benar.

## Task

- [ ] **T-108** — 3 test pre-existing gagal (ditemukan saat review T-103) → [[T-108 Perbaiki test pre-existing]] *(dipindah dari Epik 3, lebih pas di sini)*
- [x] **T-501** — Bug navigasi Buku Besar (klik akun/ikon dokumen kembali ke daftar akun) → [[T-501 Bug navigasi Buku Besar]] ✅ **done** 2026-07-27
- [x] **T-502** — Decouple klik teks akun dari ikon dokumen + bug `hide_sidebar` identik di 2 halaman lain → [[T-502 Decouple klik akun dan pola hide_sidebar]] ✅ **done** 2026-07-27
