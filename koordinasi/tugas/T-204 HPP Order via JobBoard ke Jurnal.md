---
id: T-204
epik: "[[Integrasi Akuntansi-Orders]]"
status: done
agent: Claude (instruksi eksplisit user, 2026-08-01)
prioritas: sedang
depends_on: [T-202]
created: 2026-08-01
---

# T-204 — HPP Order (Bahan Baku via JobBoard) ke Jurnal

## Konteks penting — fondasi data lemah (disclosure ke manager)

Sumber HPP untuk task ini adalah sistem inventori **lama**
(`InventoryItem`/`RestockHistory`), BUKAN sistem `Product`/`StockLayer`
FIFO yang dipakai POS di T-107. Dua masalah struktural pre-existing,
BUKAN diperkenalkan task ini, tapi diwarisi apa adanya:

1. `InventoryItem.cost_per_unit` dan `RestockHistory.delta` adalah
   **FloatField** — pelanggaran M1 ("uang dalam float dilarang total")
   yang sudah ada sejak sistem ini dibuat. Dikonversi ke `Decimal` via
   `str()` di titik masuk `compute_order_material_hpp()` supaya tidak ada
   aritmetika float yang lolos ke jurnal, tapi presisi sumber datanya
   sendiri tetap float.
2. Tautan job→konsumsi bahan HANYA lewat **regex `"Job #<id>"` di kolom
   teks bebas `keterangan`** (`RestockHistory`) — tidak ada FK langsung.
   Pola ini SUDAH ADA sebelumnya (dipakai `OrderSerializer.get_hpp_bahan`
   untuk tampilan margin%, `api/serializers.py:418-463`) — task ini
   REUSE pola yang sama untuk posting jurnal, tidak mengarang cara baru.

**Keputusan eksplisit user**: lanjutkan implementasi best-effort meski
fondasi ini lemah, lebih baik ada progress daripada tidak sama sekali.
Direkomendasikan sebagai catatan follow-up: migrasi jangka panjang
`InventoryItem`/`RestockHistory` → `Product`/`StockLayer` (skema yang
sudah dipakai T-107, sudah Decimal, sudah FK based) akan menghilangkan
kelemahan ini sekaligus.

## Desain (approved manager, sesi sama — instruksi eksplisit user)

**Trigger**: saat Order diselesaikan (`POST /api/orders/{id}/selesaikan/`,
T-210), BUKAN per-progress job — HPP adalah event akuntansi diskrit,
konsisten dengan pola "selesai = titik potong" yang sudah dipakai di
tempat lain (mis. tutup buku).

**Perubahan**:
1. `accounting/models/journal.py` — `JournalEntry.SourceType` tambah
   `ORDER_MATERIAL_HPP`. `accounting/models/settings.py` — 2 field baru
   di `AccountingSettings`: `order_hpp_expense_account`,
   `order_material_inventory_account` (terpisah dari punya POS/T-107,
   supaya COA yang membedakan HPP produk jadi vs bahan baku produksi
   tetap bisa; boleh diarahkan ke akun yang sama kalau tidak perlu
   dibedakan). Migration
   `accounting/0035_accountingsettings_order_hpp_expense_account_and_more.py`.
2. `accounting/services/order_posting.py`:
   - `compute_order_material_hpp(order)` — jumlahkan
     `abs(delta) * cost_per_unit` dari `RestockHistory` yang cocok
     `job.id` milik Order ini (lewat `OrderItem.jobs`), konversi
     Decimal di titik ini.
   - `post_order_material_hpp_journal(order, actor, activity_log)` —
     idempotent via `source_id = OrderActivityLog('COMPLETE').id`
     (Order.pk adalah **string**, tidak bisa jadi `source_id`
     `PositiveIntegerField` langsung — beda dari T-107/T-203 yang FK-nya
     `int`). Gating fail-open (akun belum diatur / HPP nol → skip
     dengan log warning, bukan error) — konsisten pola task lain di file
     ini.
3. `api/views/orders.py` — aksi `selesaikan()`: panggil
   `post_order_material_hpp_journal(order, actor, activity_log=complete_log)`
   setelah `OrderActivityLog` 'COMPLETE' dibuat. Tidak dibungkus
   try/except (M5) — kegagalan (bukan gating, benar-benar error) akan
   rollback seluruh `@transaction.atomic` aksi `selesaikan()`.

**Sengaja tidak diubah**: `OrderSerializer.get_hpp_bahan()` (logika
serupa untuk tampilan margin% di UI) — tidak di-refactor untuk share
kode dengan servis baru ini (U5/B4, no drive-by refactor); duplikasi
kecil diterima karena kedua pemanggil punya kebutuhan cache/konteks
berbeda (serializer di-cache lintas banyak order per request halaman
list, servis jurnal cuma 1 order per event selesai).

## Test baru (`accounting/tests_order_hpp.py`, 8 test)

- `compute_order_material_hpp`: jumlah benar dari RestockHistory
  bertanda Job#, nol kalau tidak ada job.
- `post_order_material_hpp_journal`: jurnal 2 baris balance, idempotent
  (activity_log sama → entry sama), skip kalau akun belum diatur, skip
  kalau tidak ada bahan terkonsumsi.
- Integrasi penuh lewat `POST /api/orders/:id/selesaikan/`: jurnal HPP
  benar-benar terbuat dengan nominal tepat, dan order tanpa job/bahan
  tetap bisa diselesaikan (gating tidak jadi blocker).

## Verifikasi

- `accounting.tests_order_hpp`: 8/8 lulus.
- Full suite `accounting api`: 337/337 lulus, 0 regresi.
- Migration `accounting.0035_accountingsettings_order_hpp_expense_account_and_more`
  DIJALANKAN (`migrate accounting`) terhadap `db.sqlite3` dev nyata.
- **Catatan operasional**: sama seperti T-107, belum ada UI form untuk 2
  field akun baru ini (pola sama dengan field `AccountingSettings`
  lainnya yang juga belum ada form — lihat T-107). Sampai diisi lewat
  admin/shell, HPP Order di-skip aman (bukan block selesaikan()).

Status `done` — diimplementasikan dan diverifikasi test nyata di sesi
yang sama oleh Claude (manager), sesuai instruksi eksplisit user untuk
best-effort menyelesaikan backlog akuntansi hari ini meski fondasi data
sumbernya (sistem inventori lama) diketahui lemah — risiko didisclosure
di atas, bukan disembunyikan (B5).
