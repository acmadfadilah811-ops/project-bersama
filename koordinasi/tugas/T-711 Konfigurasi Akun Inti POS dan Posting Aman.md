---
id: T-711
epik: "[[Production Readiness dan Integrasi Akuntansi]]"
status: review
agent: Codex
prioritas: tinggi
depends_on: []
created: 2026-08-08
---

# T-711 - Konfigurasi Akun Inti POS dan Posting Aman

## Bukti akar masalah

Audit VPS 2026-08-08 menemukan 9 `POSSale` berstatus `paid` dan 0
`JournalEntry` dengan `source_type=pos_sale`. Auto-post aktif, tetapi
`pos_sales_revenue_account`, `pos_cogs_expense_account`, dan
`pos_inventory_account` kosong. `should_post_sale()` menolak transaksi
dengan alasan akun pendapatan POS belum diatur; seluruh transaksi juga memiliki
HPP sehingga dua akun HPP/Persediaan akan menjadi syarat berikutnya.

Penyebab UI: `AccountingSettingsSerializer` belum mengekspos dua field HPP
dan Persediaan, sementara `PosSettingsModal` tidak menyajikan ketiga akun inti
tersebut untuk dipilih.

## Desain disetujui user 2026-08-08

| Kejadian POS | Debit | Kredit | Mapping konfigurasi |
| --- | --- | --- | --- |
| Penjualan tunai/non-tunai | Akun metode pembayaran | Pendapatan Penjualan POS | `pos_sales_revenue_account` |
| HPP barang terlacak | HPP | Persediaan | `pos_cogs_expense_account`, `pos_inventory_account` |
| PPN bila ada | Akun metode pembayaran | PPN Keluaran | `pos_ppn_output_account` |

Alternatif yang ditolak: (1) membuat halaman konfigurasi baru, karena drawer
Pengaturan POS sudah menjadi source UI yang dipakai; (2) mengisi akun dan
memposting transaksi historis otomatis, karena keputusan akuntansi harus
disimpan eksplisit dan posting lama harus dipicu operator melalui tombol Post
yang sudah idempoten.

## Scope

1. Ekspos `pos_cogs_expense_account` dan `pos_inventory_account` pada kontrak
   `GET/PATCH /api/accounting/settings/` yang sudah ada.
2. Tambahkan Pendapatan POS, HPP, dan Persediaan pada drawer Pengaturan POS;
   `Terapkan Default` hanya memilih COA standar `40000`, `51000`, `11400`.
3. Validasi frontend sebelum simpan: tiga mapping inti dan mapping wajib yang
   sudah ada harus dipilih ketika auto-post POS aktif.
4. Pertahankan posting transaksi historis melalui endpoint manual yang sudah
   ada; tidak ada jurnal/backfill otomatis pada task ini.

## Risiko dan batas scope

- Tidak mengubah metode `create_journal_entry()`, source idempotensi, atau
  status bisnis POS.
- Tidak mengubah jurnal posted, tidak membuat jurnal untuk 9 transaksi lama,
  dan tidak menebak akun bisnis pengguna tanpa aksi Simpan eksplisit.
- Tidak membuat endpoint atau migration baru.

## Hasil 2026-08-08

- `AccountingSettingsSerializer` sekarang mengekspos dan menerima
  `pos_cogs_expense_account` serta `pos_inventory_account` melalui kontrak
  `GET/PATCH /api/accounting/settings/`; `pos_sales_revenue_account` sudah
  ada dan kini disajikan oleh UI yang sama.
- Drawer `Pengaturan POS` menampilkan tiga mapping wajib: Pendapatan Penjualan
  POS, HPP, dan Persediaan. Tombol `Terapkan Default` memilih `40000`,
  `51000`, `11400`, tetapi hanya menyimpan setelah operator menekan Simpan.
- Validasi UI hanya menahan penyimpanan ketika auto-post aktif dan salah satu
  dari tiga mapping inti belum dipilih. Akun pelengkap tidak lagi dipaksa
  walaupun tidak digunakan oleh mesin posting POS saat ini.
- Endpoint manual yang sudah ada tetap dipakai untuk transaksi lama:
  `POST /api/accounting/sales/pos/post/` dengan `sale_ids`. Tidak ada jurnal
  atau perubahan transaksi historis dari deploy ini.
- Verifikasi lokal: `manage.py test accounting.tests_pos_settings
  accounting.tests_pos_posting` (15 lulus), `makemigrations --check --dry-run`,
  dan `npm.cmd run build` lulus.
- Verifikasi VPS: backend `manage.py check` lulus, serializer aktif memuat
  tiga field, frontend dibuild/deploy ulang, dan container backend/frontend
  aktif. `graphify update .` telah dijalankan.
