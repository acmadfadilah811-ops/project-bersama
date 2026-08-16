---
id: T-620
epik: "[[Production Readiness dan Integrasi Akuntansi]]"
status: done
agent: Codex
prioritas: tinggi
depends_on: []
created: 2026-07-30
---

# T-620 — Integrasi Data Inventori pada Tampilan Akuntansi Stok

**Verifikasi manager 2026-08-01 — CONFIRMED, promosi ke `done`.** 4 view dicek langsung: semua panggil endpoint dokumen Inventori nyata (bukan UI Inventori lama), klaim perbaikan bug (tanggal dinamis, catatan bukan field fiktif, footer count nyata) terbukti di kode.

## Tujuan

Hubungkan empat layar stok milik Akuntansi (`StokMasuk`, `StokKeluar`,
`ProduksiStok`, dan `OpnameStok`) ke dokumen stok nyata dari Inventori tanpa
merutekan pengguna ke UI Inventori dan tanpa mengubah endpoint atau alur bisnis.

## Batas aman

- Hanya baca daftar dokumen dari endpoint Inventori yang sudah ada.
- Pertahankan layout dan pengaturan Akuntansi.
- Tombol post/batal-post tetap tidak melakukan mutasi sampai kontrak posting
  jurnal Akuntansi untuk dokumen stok diverifikasi terpisah.

## Verifikasi yang diwajibkan

- Lint file yang diubah, build frontend, dan test API dokumen stok terkait.
- `graphify update .` setelah perubahan.

## Hasil

- Ditambahkan hook bersama `useAccountingStockDocuments` yang membaca semua
  halaman endpoint dokumen stok, memfilter tanggal/nomor/status pada UI
  Akuntansi, serta menyediakan state memuat dan kegagalan request.
- `StokMasuk`, `StokKeluar`, `ProduksiStok`, dan `OpnameStok` kini masing-masing
  membaca `/stock-in-documents/`, `/stock-out-documents/`,
  `/stock-production-documents/`, dan `/stock-opname-documents/`.
- UI tetap milik Akuntansi. Tombol mutasi dokumen tetap nonaktif karena posting
  jurnal Akuntansi belum mempunyai kontrak yang terverifikasi.
- Review independen menemukan dan koreksi berikut telah diterapkan: tanggal
  awal tidak lagi hardcoded, kolom stok keluar memakai catatan dokumen (bukan
  akun debit yang tidak dikirim API), footer menunjukkan jumlah data aktual,
  dan seluruh pengaturan stok yang belum punya kontrak backend ditandai tidak
  dapat disimpan tanpa notifikasi sukses palsu.

## Bukti

- ESLint file yang diubah: lulus.
- `manage.py test api.tests_import api.tests_stock_out_reason api.tests_production_hpp`:
  20/20 lulus.
- `npm.cmd run build`: lulus; hanya peringatan ukuran bundle T-706.
- `graphify update .`: lulus, 4951 node dan 14205 edge.

## Status

`review` — review kode independen sudah lulus; perlu cek visual dengan sesi
pengguna sebelum `done`.
