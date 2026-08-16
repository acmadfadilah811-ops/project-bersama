---
id: T-712
epik: "[[Production Readiness dan Integrasi Akuntansi]]"
status: review
agent: Codex
prioritas: tinggi
depends_on: []
created: 2026-08-08
---

# T-712 - Status Pengiriman Pembelian Persisten

## Bukti akar masalah

Dropdown frontend menawarkan `Tunda`, `Terkirim`, `Dikirim`, `Diterima`,
`Selesai`, dan `Batal`. Namun `Purchase` hanya menyimpan `status`
(`draft/selesai/batal`) dan `receive_status` (`tunda/diterima`). Endpoint
`workflow/update-status/` memetakan `Terkirim` dan `Dikirim` kembali ke
`draft/tunda`, sehingga setelah refresh UI selalu menampilkan Tunda.

## Keputusan user 2026-08-08

Tambahkan status pengiriman persisten untuk dua tahap transit. Status akhir
`Diterima`, `Selesai`, dan `Batal` tetap menggunakan guard stok/jurnal yang
sudah ada; perubahan ini tidak mengubah kebijakan pembatalan setelah penerimaan
atau membuat jurnal/pembayaran baru.

## Scope

1. Tambahkan `Purchase.delivery_status` dengan `tunda/terkirim/dikirim` dan
   migrasi additive yang memberi default `tunda` untuk data lama.
2. Simpan nilai tersebut lewat endpoint status yang sudah ada dan baca kembali
   pada dropdown detail.
3. Tambahkan regression test transisi Terkirim dan Dikirim serta pastikan
   status penerimaan/dokumen tidak berubah.

## Batas scope

- Tidak mengubah toggle pembayaran atau jurnal `PurchasePayment`.
- Batal setelah penerimaan tetap diblokir karena stok/jurnal sudah dapat
  terposting; perubahan kebijakan tersebut adalah keputusan finansial terpisah.

## Hasil 2026-08-08

- `Purchase.delivery_status` menambah tiga nilai persisten: `tunda`,
  `terkirim`, dan `dikirim`; migration additive `api.0101` memberi default
  `tunda` ke dokumen lama.
- `POST /api/purchases/{id}/workflow/update-status/` kini menyimpan tahap
  Terkirim/Dikirim tanpa mengubah `status`, `receive_status`, stok, pembayaran,
  atau jurnal. `Diterima`, `Selesai`, dan `Batal` tetap memakai guard lama.
- Dropdown `PembelianDetail` membaca `delivery_status` setelah refresh, sehingga
  pilihan tidak lagi kembali ke Tunda.
- Regression suite `api.tests_purchase_reception_receiver` lulus 13/13.
  Fixture suite juga diselaraskan dengan mapping akun Pembelian yang kini wajib
  untuk test stok/pembayaran. `makemigrations --check --dry-run` dan build
  frontend lulus.
- Migration diterapkan pada database development lokal dan VPS; VPS backend
  `manage.py check` lulus serta container backend/frontend sehat. `graphify
  update .` telah dijalankan.
