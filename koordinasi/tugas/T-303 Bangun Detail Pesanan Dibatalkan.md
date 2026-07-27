---
id: T-303
epik: "[[Perbaikan Orders]]"
status: backlog
agent: 
prioritas: sedang
depends_on: []
created: 2026-07-27
---

# T-303 — Audit & Poles "Detail Pesanan Dibatalkan" (SUDAH ADA, bukan bangun baru)

> ⚠️ **KOREKSI 2026-07-27**: manager sempat salah menyimpulkan tab Dibatalkan belum punya detail sendiri. Setelah baca kode `OrderDetail.jsx` langsung (baris 94-106): kalau `order.status_global === 'batal'`, sudah didelegasikan ke komponen terpisah **`CancelledOrderDetail.jsx`** (180 baris, memakai ulang `OrderHeader`, ukuran wajar — bukan god file). Jadi task ini BUKAN "bangun dari nol" — scope-nya audit apakah yang sudah ada ini cukup/sesuai referensi Olsera, dan poles kalau perlu.
>
> ⏸️ Tetap **TUNGGU referensi visual dari user** untuk pembanding — begitu user kirim contoh Olsera, bandingkan dengan `CancelledOrderDetail.jsx` yang sudah ada, baru putuskan apa yang perlu diubah.
>
> **Verifikasi hasil dilakukan user sendiri lewat browser.**

## Scope

1. Baca `bintang-react-frontend/src/features/transaksi/components/CancelledOrderDetail.jsx` (sudah ada) — dokumentasikan isinya sekarang: apa yang ditampilkan, aksi apa yang tersedia.
2. Bandingkan dengan referensi Olsera yang dikirim user.
3. Kalau ada gap → revisi `CancelledOrderDetail.jsx` (bukan bikin file baru — jangan duplikasi, L4).
4. Kalau sudah cukup sesuai → laporkan di Hasil, tidak perlu perubahan kode.

## Rambu

- Perbaikan di file yang sudah ada, JANGAN bikin file baru "DetailPesananDibatalkan.jsx" — itu duplikat (L4).
- Kalau butuh field baru di `Order` (misal alasan pembatalan formal) — cek dulu apakah sudah tercakup dalam kerja [[T-209 Bangun schema Order metadata]] (field serupa kemungkinan sudah dalam rencana di sana), jangan bikin migration terpisah tanpa cek dulu.

## Acceptance criteria

- [ ] Kondisi `CancelledOrderDetail.jsx` sekarang terdokumentasi di Hasil
- [ ] Perbandingan dengan referensi Olsera (setelah diterima) terdokumentasi
- [ ] Revisi (kalau ada) diterapkan di file yang sama, bukan file baru
- [ ] User sudah cek di browser & konfirmasi
- [ ] `npm run build` sukses
- [ ] File tidak melebihi hard limit (L5)

## Hasil

*(diisi saat dikerjakan)*
