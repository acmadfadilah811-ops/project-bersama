---
id: T-621
epik: "[[Production Readiness dan Integrasi Akuntansi]]"
status: done
agent: Codex
prioritas: tinggi
depends_on: []
created: 2026-07-30
---

# T-621 — Piutang dan Form Jurnal Source of Truth

**Verifikasi manager 2026-08-01 — CONFIRMED, promosi ke `done`.** `DaftarPiutang.jsx` baca `/orders/` nyata, `JurnalTunggal`/`MultiJurnal` POST ke `/accounting/journal-entries/` nyata, tidak ada bypass `create_journal_entry()` (M2), 128/128 test lulus. `JurnalTunggal.jsx` (789)/`MultiJurnal.jsx` (768)/`DaftarPiutang.jsx` (377 baris) aman setelah limit L5 naik ke 1000. Minor non-blocking: tombol Simpan di form jurnal manual belum ada guard anti-double-click.

## Tujuan

Sambungkan daftar Piutang ke field Order yang dihitung backend serta perbaiki
Form Jurnal Tunggal dan Multi Jurnal agar memakai COA/lookup nyata dan hanya
menyatakan sukses setelah `POST /api/accounting/journal-entries/` berhasil.

## Batas aman

- Gunakan `sisa_tagihan` dari serializer Order, bukan hitungan ulang frontend.
- Semua penulisan jurnal melalui `JournalEntryCreateSerializer` dan
  `create_journal_entry()` yang sudah ada.
- Jangan membuat endpoint finansial baru atau menghapus jurnal.

## Hasil implementasi

- `DaftarPiutang.jsx` membaca `GET /api/orders/` berhalaman dan memakai
  `sisa_tagihan` dari backend sebagai sisa piutang; tidak lagi memakai baris
  contoh statis.
- `JurnalTunggal.jsx` dan `MultiJurnal.jsx` dikembalikan ke layout UI lama
  dari baseline repo. Pilihan akun (dan departemen pada Multi Jurnal) kini
  berasal dari API Akuntansi; sukses hanya muncul setelah
  `POST /api/accounting/journal-entries/` berhasil.
- Multi Jurnal memeriksa debit/kredit seimbang sebelum mengirim payload
  `lines` dengan field backend `kredit`. Jurnal Tunggal memvalidasi setiap
  draf dan menyisakan draf yang belum berhasil bila salah satu POST ditolak.
- Popup Pasangan Jurnal pada daftar utama Piutang mengambil baris `JournalEntry`
  nyata berdasarkan ID aktivitas pembayaran Order; tidak lagi memakai empat
  baris hardcode.

## Verifikasi

- `npx.cmd eslint --quiet` untuk tiga halaman terkait: lulus.
- `npm.cmd run build`: lulus.
- `manage.py test accounting.tests_journal_ledger_integration`: 5/5 lulus,
  termasuk filter jurnal pembayaran Order berdasarkan source ID.

## Menunggu review

- Verifikasi visual independen untuk memastikan kedua form sama dengan UI
  lama pada runtime browser serta cek akses akun berotorisasi.
