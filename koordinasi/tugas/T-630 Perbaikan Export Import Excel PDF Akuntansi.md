---
id: T-630
epik: "[[Production Readiness dan Integrasi Akuntansi]]"
status: done
agent: Claude (instruksi eksplisit user, 2026-07-31)
prioritas: tinggi
depends_on: []
created: 2026-07-31
---

# T-630 — Perbaikan Export/Import Excel & PDF Akuntansi

## Scope

Audit lalu perbaiki semua titik Export/Import Excel & PDF di modul Akuntansi
Internal (`bintang-react-frontend/src/features/accounting/`) yang ternyata
palsu (alert/notify tanpa file nyata) atau tombol mati. Ditemukan lewat audit
manual — bukan dari laporan bug sebelumnya.

## Audit awal — 10 titik tidak berfungsi

**Toast/alert palsu (6)**: `Neraca.jsx` Export Excel, `LabaRugiSatuPeriode.jsx`
Export Excel, `ExportPiutangModal.jsx` (Daftar Piutang), `HutangExportModal.jsx`
(Semua Hutang), `SimpananPelanggan.jsx` Export PDF & Excel.

**Tombol mati tanpa `onClick` (4)**: "Cetak jurnal" di `JurnalTunggal.jsx`,
`MultiJurnal.jsx`, `HutangJurnalTunggal.jsx`, `HutangMultiJurnal.jsx` — 3 dari
4 bahkan `disabled` permanen (bukan kondisional ke jumlah draft/rows).

Yang sudah REAL (tidak disentuh): export Jurnal Umum/Buku Besar/Kas & Bank/
Rincian Mutasi Akun/Aset (lewat `downloadFile()` ke endpoint backend nyata).

## Hasil bagian 1 — perbaikan 10 titik

**Backend** (Excel via `openpyxl`, pola sama persis `ledger_export.py`/
`asset_export.py` yang sudah ada):
- `accounting/services/report_export.py` (baru): `build_balance_sheet_xlsx()`,
  `build_income_statement_xlsx()`.
- `GET /api/accounting/reports/balance-sheet/export/` (baru,
  `BalanceSheetExportView`), `GET /api/accounting/reports/income-statement/export/`
  (baru, `IncomeStatementExportView`) — permission `IsOwnerOrManager`.

**Frontend**:
- `Neraca.jsx`, `LabaRugiSatuPeriode.jsx`: Excel → `downloadFile()` ke endpoint
  baru di atas (bukan `alert()` lagi).
- `utils/exportXlsx.js` (baru): `exportRowsToXlsx()` — export client-side pakai
  `xlsx` (SheetJS, sudah jadi dependency, dipakai juga di modul inventory) untuk
  laporan yang sumbernya murni komputasi client-side (Piutang dari `/orders/`,
  Hutang dari `/purchases/`) — SENGAJA tidak duplikasi logika piutang/hutang ke
  backend hanya demi export.
- `ExportPiutangModal.jsx`, `HutangExportModal.jsx`: terima prop `rows` dari
  parent (`DaftarPiutang.jsx`/`SemuaHutang.jsx`, data yang sudah difilter
  tanggal/pencarian di halaman), filter tambahan oleh `status` yang dipilih di
  modal, lalu Excel nyata atau `window.print()` untuk PDF.
- `SimpananPelanggan.jsx`: Excel nyata (`exportRowsToXlsx`), PDF →
  `window.print()`.
- 4 tombol "Cetak jurnal": `onClick={() => window.print()}` + `disabled`
  diperbaiki jadi kondisional ke `drafts.length`/`rows.length` (3 di antaranya
  sebelumnya `disabled` permanen tanpa syarat apa pun).

**Perbaikan tambahan yang ditemukan saat mengerjakan (bukan drive-by, di file
yang sama)**:
- `ExportPiutangModal.jsx`/`HutangExportModal.jsx` punya bug pre-existing:
  `if (!isOpen) return null` diletakkan SEBELUM hooks (`useState`/`useEffect`)
  — pelanggaran React Rules of Hooks, ESLint error nyata. Dipindah ke bawah
  hooks.
- `ExportPiutangModal.jsx` (362 baris) melebihi hard limit JSX 300 (sudah 358
  baris sebelum disentuh). Sesuai `AGENTS.md` "sentuh file oversized = extract
  bukan extend": dipisah 2 komponen baru — `ExportRowRangeSelect.jsx` (dropdown
  "Baris") dan `ExportStatusButtons.jsx` (toggle status, dipakai juga referensi
  desain yang sama di Hutang) — hasil akhir 288 baris.

**Temuan dilaporkan, TIDAK diperbaiki (di luar scope, terlalu besar &
berisiko)**: `JurnalTunggal.jsx` (789 baris), `MultiJurnal.jsx` (768),
`HutangJurnalTunggal.jsx` (731), `HutangMultiJurnal.jsx` (717) — SEMUA sudah
melebihi hard limit JSX 300 sejak SEBELUM disentuh (2,4–2,6x lipat), perubahan
saya di situ cuma 2–3 baris (`onClick`, perbaikan `disabled`). Memecah form
jurnal finansial 700+ baris jadi komponen kecil adalah pekerjaan besar
tersendiri dengan risiko nyata ke form entri transaksi — butuh task terpisah,
bukan disisipkan di sini.

**Verifikasi bagian 1**:
- `accounting.tests_balance_sheet` + `accounting.tests_income_statement`:
  21/21 lulus (termasuk 4 test baru untuk endpoint export).
- ESLint semua file yang diubah: lulus (0 error; warning yang ada semua
  pre-existing, bukan dari perubahan ini).
- `npm run build`: lulus.
- Tidak ada migration baru (tidak ada perubahan model).

## Hasil bagian 2 — akar masalah kolom Pelanggan/Supplier & Email kosong

User laporan tambahan: export Excel tidak ada nama pelanggan/supplier/email,
dan tampilan Kas & Bank juga tidak menampilkannya padahal kolomnya ada.

**Akar masalah** (dikonfirmasi baca kode, bukan tebakan): `MutasiTable.jsx`
sudah punya kolom "Pelanggan / Supplier" dan sudah benar merender
`row.pelanggan_supplier` — tapi field itu SELALU KOSONG untuk transaksi
POS/Order karena:
- `JournalEntryLine.customer`/`.supplier` (sumber field itu) merujuk ke model
  `Customer`/`Supplier` (`api.customer_models`, py punya `email`).
- POS merujuk pelanggan ke model **`Contact`** (`api.models`) — SENGAJA
  dipisah dari `Customer` ("supaya tidak bercampur dengan alur order WA",
  komentar eksplisit di `customer_models.py`). Order malah tidak pakai FK
  sama sekali (cuma `CharField nomor_wa`/`nama`).
- `pos_posting.py`/`order_posting.py` karena itu TIDAK PERNAH mengisi
  `customer=`/`supplier=` saat posting — bukan bug tulis kolom, field-nya
  memang tidak pernah diisi dari sumbernya.
- Email TIDAK ADA SAMA SEKALI di `Contact`/`Order` — hanya ada di `Customer`/
  `Supplier`.

**Keputusan (approved user)**: JANGAN menebak lewat pencocokan nomor HP dsb
(risiko salah pasang pelanggan ke jurnal) — ambil nama APA ADANYA langsung
dari transaksi asal via `JournalEntry.source_type`/`source_id`, bukan lewat FK
Customer/Supplier yang memang tidak kompatibel tipe.

**Implementasi**: `_resolve_pelanggan_supplier()` baru di
`accounting/services/ledger.py`, dipakai `get_account_line_history()`:
1. FK `line.customer`/`line.supplier` eksplisit dulu (jurnal manual
   Piutang/Hutang yang pilih Customer/Supplier langsung) — email tersedia.
2. Kalau kosong, resolve dari transaksi sumber:
   - `POS_SALE`: `POSSale.pelanggan` (Contact) → nama; email cuma kalau
     `Contact.customer` (tautan opsional ke akun member) terisi.
   - `ORDER_PAYMENT`: **PENTING** — `source_id` di sini adalah
     `OrderActivityLog.id`, BUKAN `Order.id` (Order PK-nya string, field
     `source_id` integer) — salah asumsi ini sempat bikin test saya gagal,
     dikoreksi setelah baca `order_posting.py` langsung. Ambil `.order` dari
     activity log, lalu cari `Contact` by `nomor_wa` untuk email opsional.
   - `PURCHASE_PAYMENT`: sama, `source_id` = `PurchasePayment.id` (BUKAN
     `Purchase.id`) — dikoreksi dari kesalahan yang sama, lihat
     `purchase_posting.py`. Ambil `.purchase.supplier_ref` (email) atau
     `.purchase.supplier` (teks, tanpa email) sebagai fallback.
   - `PURCHASE` (bare, tanpa `_PAYMENT`): dicek — TIDAK PERNAH benar-benar
     dipakai di kode posting manapun, jadi cabang ini dihapus dari desain
     (bukan didiamkan sebagai dead code yang menyesatkan).
3. Kalau semua di atas kosong → `("", "")`, tidak crash.

**Field baru `email`**: ditambahkan ke `get_account_line_history()` rows,
`LedgerLineSerializer` (`accounting/serializers/accounts.py`), dan kolom
Excel baru "Pelanggan/Supplier" + "Email" di `ledger_export.py`
(`build_ledger_account_export`, `build_ledger_all_accounts_detail_export` —
sebelumnya SENGAJA dihilangkan supaya sama persis PDF referensi Olsera lama;
keputusan itu ditimpa user karena data pelanggan/supplier dianggap penting).

**Piutang/Hutang (`ExportPiutangModal`/`HutangExportModal`) TIDAK ditambah
kolom Email** — sumber datanya (`Order.nama`, `Purchase.supplier` teks) memang
tidak pernah punya email sama sekali, beda kasus dari Kas & Bank/Buku Besar.

**Verifikasi bagian 2**:
- `accounting.tests_ledger_running_balance`: 8/8 lulus — termasuk 4 test baru
  (`LedgerPelangganSupplierSourceFallbackTest`: POS_SALE dengan member email,
  ORDER_PAYMENT tanpa email, PURCHASE_PAYMENT dengan email, tanpa source sama
  sekali) + 1 test baru parsing xlsx asli (`LedgerAccountExportColumnsTest`,
  buka file pakai `openpyxl.load_workbook` untuk pastikan kolom & isi benar,
  bukan cuma cek status 200).
- Full suite `accounting api`: 297/297 lulus, 0 regresi.
- Tidak ada migration baru.
- `graphify update .`: selesai (5494 nodes, 15491 edges).

## Follow-up yang belum dikerjakan (dicatat, bukan diabaikan)

- `JurnalTunggal.jsx`/`MultiJurnal.jsx`/`HutangJurnalTunggal.jsx`/
  `HutangMultiJurnal.jsx` melebihi hard limit JSX 300 baris (700+ baris) —
  butuh task pemecahan komponen tersendiri.
- `DaftarAkun.jsx` (Daftar Akun/COA) tidak punya export sama sekali (bukan
  rusak, memang belum pernah dibangun).
- ~~Kolom "Pelanggan/Supplier" di tabel on-screen `RincianMutasiAkun.jsx`~~ —
  **diperbaiki 2026-08-01** (lihat bagian di bawah).
- `MutasiTable.jsx` (Kas & Bank) MASIH belum render kolom Email di layar
  (`row.pelanggan_supplier` sudah tampil, `row.email` belum) — di luar scope
  perbaikan di bawah (user minta spesifik laporan Laba Rugi), dicatat sebagai
  follow-up terpisah kalau konsistensi lintas-halaman diperlukan nanti.

## Perbaikan 2026-08-01 — Email & Dilayani Oleh di drilldown Laba Rugi (instruksi user)

User minta laporan Laba Rugi (drilldown per akun, komponen
`RincianMutasiAkun.jsx`/`RincianMutasiAkunTable.jsx` — dipakai bareng oleh
Neraca T-625 dan Laba Rugi Satu Periode) menampilkan email pelanggan +
staf yang melayani ("service order").

**Ditemukan saat investigasi**: `email` sudah dihitung backend sejak T-630
bagian 2, tapi TIDAK PERNAH dirender di tabel on-screen ini (cuma
`pelanggan_supplier` yang tampil) — gap follow-up lama yang belum sempat
ditutup, sekarang sekalian diperbaiki.

**Backend** (`accounting/services/ledger.py`):
- `_resolve_dilayani_oleh(journal_entry, line)` baru — sama pola dengan
  `_resolve_pelanggan_supplier`, ambil dari transaksi asal via
  source_type/source_id (bukan tebakan): `POSSale.dilayani_oleh` untuk
  POS_SALE, `Order.dilayani_oleh` (via `OrderActivityLog`) untuk
  ORDER_PAYMENT. Beda konsep dari `processed_by_name` yang sudah ada
  (itu siapa yang POSTING jurnal, bukan siapa yang melayani pelanggan).
- `get_account_line_history()` rows: field baru `dilayani_oleh`.
- `LedgerLineSerializer`: field baru `dilayani_oleh`.
- `ledger_export.py` (Excel Rincian Mutasi Akun + Detail Buku Besar Semua
  Akun): kolom baru "Dilayani Oleh" ditambahkan di kedua export.

**Frontend** (`RincianMutasiAkunTable.jsx`):
- Kolom baru "Dilayani Oleh".
- `row.email` sekarang dirender sebagai sub-baris di bawah nama
  pelanggan/supplier (sebelumnya dihitung backend tapi tidak pernah
  ditampilkan).

**Test baru** (`accounting/tests_ledger_running_balance.py`): POS_SALE dan
ORDER_PAYMENT dengan `dilayani_oleh` terisi menampilkan nama staf yang
benar; kosong kalau tidak diisi; kolom "Dilayani Oleh" dikonfirmasi ada di
export Excel (parsing xlsx asli, bukan cuma cek status 200).

**Verifikasi**: 11/11 test file ini lulus (3 baru). Full suite
`accounting api`: 343/343 lulus, 0 regresi. `npm run build` sukses. Tidak
ada migration (tidak ada perubahan model).

## Perbaikan 2026-08-01 (lanjutan) — Email juga di Kas & Bank + Laporan Penjualan

User minta email pelanggan juga ditampilkan di `MutasiTable.jsx` (Kas &
Bank, di luar Laba Rugi) DAN ditambahkan ke Excel "Laporan Penjualan".

**`MutasiTable.jsx`** (Kas & Bank): `row.email` sekarang dirender sebagai
sub-baris di bawah `pelanggan_supplier` — pola sama persis dengan
`RincianMutasiAkunTable.jsx` di atas. Data backend sudah ada sejak awal
T-630, cuma belum pernah dirender di komponen ini juga.

**Laporan Penjualan** — ditelusuri, laporan yang benar-benar live (bukan
placeholder UI) adalah `ExportSalesDetailsView`
(`GET /api/export/sales-details/`, dipakai fitur "Rincian Penjualan" —
format legacy 48 kolom meniru Olsera). 29 laporan lain di
`reportListPenjualan.js` masih konfigurasi statis/placeholder (dicatat
eksplisit di komentar file itu sendiri), di luar scope permintaan ini.

**2 bug crash ditemukan SAAT investigasi export ini** (bukan disebabkan
perubahan sekarang, sudah ada sejak awal):
1. `Order.kasir` — field ini TIDAK PERNAH ada di model `Order` (cuma
   `SaldoKasHarian` yang punya `kasir`). Baris `o.kasir.get_full_name()`
   melempar `AttributeError` setiap ada Order di rentang tanggal → seluruh
   export gagal 500 (`except Exception` generik menangkapnya jadi pesan
   error, bukan crash mentah, tapi laporan tetap gagal total). Diperbaiki
   ke `o.dilayani_oleh` (field asli Order — staf yang melayani).
2. `Order.diskon` — juga tidak ada (field aslinya `diskon_persen`),
   AttributeError sama persis, di baris yang sama. Diperbaiki.

Kedua bug ini membuat export "Rincian Penjualan" **selalu gagal** kalau
ada satu saja Order dalam rentang tanggal — baru ketahuan sekarang karena
tidak ada test sebelumnya untuk endpoint ini sama sekali.

**Ditambahkan**: kolom baru "Email Pelanggan" (kolom ke-49, ditambahkan di
akhir supaya tidak menggeser posisi 48 kolom lama yang meniru format
Olsera). Resolusi email:
- POS: `POSSale.pelanggan.customer.email` (Contact tertaut member).
- Order: cari `Contact` via `nomor_wa`, lalu `.customer.email` — sama pola
  dengan `_resolve_pelanggan_supplier` di `accounting/services/ledger.py`.
Kosong kalau kontak tidak tertaut ke akun member (Contact sendiri memang
tidak punya field email, lihat gap T-401).

**Test baru** (`api/tests_export_sales_details.py`, file baru — endpoint
ini sebelumnya tidak ada test sama sekali): crash Order dibuktikan hilang
(export 200 + 1 baris data, bukan 500), kolom Email Pelanggan ada dan
terisi benar untuk POS+Order yang tertaut member, kosong untuk yang tidak
tertaut.

**Verifikasi**: 3/3 test baru lulus. Full suite `accounting api`:
346/346 lulus, 0 regresi. `npm run build` sukses. Tidak ada migration.

Status `review` — bukan `done`, sesuai protokol (executor/Claude tidak
menandai task sendiri jadi `done`).

## Verifikasi independen manager 2026-08-01 (sesi kedua) — ✅ PROMOTED TO `done`

- `report_export.py`, `BalanceSheetExportView`, `IncomeStatementExportView`
  dikonfirmasi ada & terdaftar di `urls.py`.
- `manage.py test accounting api` full suite dijalankan ulang: 324/324 lulus
  (mencakup `tests_balance_sheet`, `tests_income_statement`,
  `tests_ledger_running_balance` termasuk `LedgerPelangganSupplierSourceFallbackTest`
  dan `LedgerAccountExportColumnsTest`).
- `npm run build`: lulus bersih.
- Follow-up yang dicatat belum dikerjakan (JurnalTunggal.jsx dkk 700+ baris,
  DaftarAkun.jsx tanpa export) TETAP backlog terpisah, bukan blocker task ini
  yang scope-nya sudah U1 (satu concern: perbaiki 10 titik export palsu +
  akar masalah kolom Pelanggan/Supplier).
Tidak ada blocker tersisa. Status → `done`.
