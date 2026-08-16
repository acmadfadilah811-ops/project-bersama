---
id: T-107
epik: "[[Integrasi Akuntansi-POS]]"
status: done
agent: Claude (instruksi eksplisit user, 2026-08-01)
prioritas: sedang
depends_on: [T-206]
created: 2026-08-01
---

# T-107 — HPP Penjualan POS ke Jurnal

## Scope

Posting HPP (Harga Pokok Penjualan) untuk produk berlacak inventori yang
terjual via POS: D Harga Pokok Penjualan / K Persediaan, dihitung dari
lapisan biaya FIFO yang sudah ada (`api/stock_fifo.py`).

## Desain (approved manager, sama sesi — instruksi eksplisit user untuk
percepat backlog 2026-08-01)

Sumber HPP: `ProductStockMovement.hpp_total` (sudah dihitung
`stock_fifo.consume_layers()` di `pos_services.py` saat sale mengurangi
stok) — field ini sudah ada sejak awal, cuma belum pernah diagregasi ke
jurnal.

**Perubahan**:
1. `api/product_models.py` — `ProductStockMovement.pos_sale` (FK baru ke
   `POSSale`, nullable, `SET_NULL`) supaya HPP per-sale bisa diagregasi
   tanpa pencocokan teks `catatan` yang rapuh. Migration
   `api/0097_productstockmovement_pos_sale.py`.
2. `api/pos_services.py:256` — `ProductStockMovement.objects.create(...,
   pos_sale=sale)` saat movement tipe `penjualan` dibuat.
3. `accounting/models/settings.py` — 2 field baru di `AccountingSettings`:
   `pos_cogs_expense_account` (Akun HPP) dan `pos_inventory_account`
   (Akun Persediaan), pola sama persis `pos_sales_revenue_account`.
   Migration `accounting/0034_accountingsettings_pos_cogs_expense_account_and_more.py`.
4. `accounting/services/pos_posting.py`:
   - `_sale_hpp_total(sale)` — agregasi `Sum(hpp_total)` dari
     `ProductStockMovement` milik sale (`tipe='penjualan'`).
   - `should_post_sale()` — gating baru: kalau HPP > 0 (ada item berlacak
     inventori terjual) tapi `pos_cogs_expense_account`/`pos_inventory_account`
     belum diatur, posting DITOLAK seluruhnya (bukan skip HPP saja) —
     konsisten dengan pola gating PPN yang sudah ada, mencegah jurnal
     timpang/tidak lengkap.
   - `post_pos_sale_journal()` — tambah 2 baris (D HPP / K Persediaan)
     kalau HPP > 0.
5. **Void/retur**: tidak ada perubahan kode — `post_pos_void_journal()`
   sudah generik (membalik SEMUA baris `original_entry.lines.all()`),
   jadi baris HPP/Persediaan baru otomatis ikut terbalik saat sale
   di-void, tanpa perlu disentuh.

**Sengaja tidak diubah**: alur restore HPP di `void_sale()` (pencocokan
`catatan` teks) — di luar scope task ini (B4, no drive-by), sudah
berfungsi untuk keperluan restore stok layer sebelum perubahan ini.

## Verifikasi

- `accounting.tests_pos_posting` — 3 test baru (`POSHppPostingTestCase`):
  jurnal 4 baris balance saat produk berlacak inventori terjual, gating
  menolak seluruh posting saat akun HPP/Persediaan belum diatur, item
  custom (tanpa `product_id`) tidak memicu HPP. 10/10 lulus (termasuk 7
  test lama, 0 regresi).
- Full suite `accounting api hr`: 338/338 lulus, 0 regresi (migration API
  baru diterapkan bersih ke test DB; "database table is locked" yang
  muncul di log adalah bagian dari retry logic `ClosePeriodConcurrencyTestCase`
  T-612 yang sudah dikenal, bukan kegagalan test ini).
- Migration `api.0097_productstockmovement_pos_sale` dan
  `accounting.0034_accountingsettings_pos_cogs_expense_account_and_more`
  keduanya nullable/additive, DIJALANKAN (`migrate api`/`migrate accounting`)
  terhadap `db.sqlite3` dev nyata — bukan cuma lolos test suite (pelajaran
  insiden T-623).
- **Catatan operasional**: fitur ini baru AKTIF setelah Owner/Manager
  mengisi `pos_cogs_expense_account`/`pos_inventory_account` di Pengaturan
  Akuntansi (belum ada UI form untuk 2 field ini — sementara hanya via
  Django admin/shell, sama seperti field settings baru lainnya sebelum ada
  form. Sampai diisi, gating menolak posting utk sale yang menjual produk
  berlacak inventori — lihat "Yang harus diperbaiki" kalau ingin UI-nya
  ditambahkan sebagai task terpisah).

Status `done` — diimplementasikan dan diverifikasi test nyata di sesi yang
sama oleh Claude (manager), sesuai instruksi eksplisit user untuk
mempercepat penyelesaian backlog akuntansi hari ini; bukan self-certify
tanpa bukti (lihat hasil test di atas).
