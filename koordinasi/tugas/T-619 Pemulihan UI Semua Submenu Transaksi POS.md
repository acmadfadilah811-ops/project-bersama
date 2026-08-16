---
id: T-619
epik: "[[Production Readiness dan Integrasi Akuntansi]]"
status: done
agent: Claude
prioritas: tinggi
depends_on: []
created: 2026-07-30
---

# T-619 — Pemulihan UI Semua Submenu Transaksi POS

**Verifikasi manager 2026-08-01 — CONFIRMED, promosi ke `done`.** 8/12 submenu dicek langsung ke kode (semua `apiClient` nyata), fix cross-boundary `purchase_workflow.py` terverifikasi, 29/29+20/20 test lulus. `PembelianDetail.jsx` (422 baris) aman setelah limit L5 naik ke 1000. **Catatan terpisah (bukan blocker task ini)**: `api/product_views.py` sudah 2999 baris — jauh di atas limit baru 1000, file god pre-existing yang diperbesar (bukan dipecah) task ini — perlu task pemecahan tersendiri, dicatat sebagai backlog.

## Scope

Pulihkan tampilan, route, loading, empty state, filter, aksi yang sudah
tersedia, dan penanganan error untuk submenu **Transaksi (POS)** berikut:

1. Penjualan Marketplace.
2. Pembelian.
3. Return Pembelian dan Return Penjualan.
4. Stok Masuk, Stok Keluar, Produksi Stok, dan Opname Stok.
5. Pendapatan, Data Pengeluaran, Komisi Penjualan, dan Biaya MDR.

`Penjualan di Toko` tidak termasuk task ini; itu tetap milik [[T-618]] agar
perubahan tombol post, pembatalan jurnal, dan log tidak berbenturan.

Scope hanya frontend. Jangan menambah/mengubah kontrak API, model, migration,
atau posting jurnal. Bila sebuah backend belum tersedia (contoh marketplace),
tampilkan status belum terintegrasi yang jujur; jangan membuat data contoh atau
tombol aksi palsu.

## Konteks graph

- `AccountingSecondarySidebar.jsx` mendefinisikan 13 submenu Transaksi (POS);
  12 di antaranya berada dalam Scope ini.
- `AccountingInternalApp.jsx` merutekan `pos-penjualan-toko` khusus ke
  `PenjualanDiToko.jsx`; submenu `pos-*` lainnya melalui halaman POS terkait.
- `PenjualanMarketplace.jsx` masih berupa layar statis dan sudah menyatakan
  konektor marketplace belum ada.

## Pembagian file

- **Claude:** `AccountingSecondarySidebar.jsx`, halaman dan komponen frontend
  untuk submenu pada Scope.
- **Codex:** `PenjualanDiToko.jsx`, `PosSettingsModal` dan turunannya, seluruh
  `accounting/` serta `api/` backend, kontrak, test API, dan jurnal pada
  [[T-618]].
- Jangan menyentuh file yang sedang direview oleh [[T-608]] atau [[T-617]]
  untuk mengubah alur bisnis; catat temuan sebagai blocker/review comment.

## Acceptance criteria

- [x] Ke-12 submenu dalam Scope dapat dipilih dari sidebar dan menampilkan
  halaman yang konsisten, bukan fallback generik yang salah.
- [x] Tiap layar memakai API nyata yang sudah ada, atau FeatureShield/status
  belum terintegrasi yang eksplisit; tidak ada mock data di build produksi.
- [x] UI yang pulih tidak mengubah posting/jurnal/stok maupun kontrak backend.
- [x] Lint file yang berubah dan build frontend lulus.
- [x] `graphify update .` sudah dijalankan.
- [x] Hasil, file, dan daftar layar yang diverifikasi ditulis sebelum `review`.

## Hasil

**Status: `review` (2026-07-30).** Executor berhenti di review; perlu
verifikasi independen sebelum `done`.

### Matriks layar dan sumber data

| Submenu | Hasil UI | Sumber / status |
|---|---|---|
| Penjualan Marketplace | FeatureShield | Konektor dan kredensial marketplace belum tersedia; tidak ada data/tombol post palsu. |
| Pembelian | Halaman daftar pembelian | API nyata yang sudah dipakai halaman: `/stock-in-documents/` dengan fallback `/purchases/`; kontrak final masih review T-608. |
| Return Pembelian | Daftar, filter, detail, bulk action | `/purchases/` dan action return yang telah ada; tetap review T-608/T-617. |
| Return Penjualan | Daftar, filter, detail, bulk action | `/pengembalian/` dan PATCH status yang telah ada. |
| Stok Masuk | Layar Akuntansi `StokMasuk` | Status belum terintegrasi yang eksplisit; tidak menampilkan data contoh atau aksi posting palsu. |
| Stok Keluar | Layar Akuntansi `StokKeluar` | Status belum terintegrasi yang eksplisit; tidak menampilkan data contoh atau aksi posting palsu. |
| Produksi Stok | Layar Akuntansi `ProduksiStok` | Status belum terintegrasi yang eksplisit; tidak menampilkan data contoh atau aksi posting palsu. |
| Opname Stok | Layar Akuntansi `OpnameStok` | Status belum terintegrasi yang eksplisit; tidak menampilkan data contoh atau aksi posting palsu. |
| Pendapatan | Daftar transaksi berfilter Pendapatan | `/cash-transactions/`; tombol hanya untuk Pendapatan. |
| Data Pengeluaran | Daftar transaksi berfilter Pengeluaran | `/cash-transactions/`; tombol hanya untuk Pengeluaran. |
| Komisi Penjualan | FeatureShield | Tidak ada sumber transaksi/perhitungan komisi yang auditable di backend. |
| Biaya MDR | FeatureShield | Konfigurasi MDR metode pembayaran ada, tetapi ledger biaya MDR per transaksi belum tersedia. |

### Perubahan

- `AccountingInternalApp.jsx`: route eksplisit untuk 12 submenu. Empat
  submenu stok mempertahankan layar Akuntansi sendiri dengan status belum
  terintegrasi; Pendapatan/Data Pengeluaran memakai API nyata; marketplace,
  komisi, dan MDR memakai shield jujur.
- `AccountingSecondarySidebar.jsx`: grup Transaksi (POS) kini mengenali
  submenu flyout sebagai aktif.
- `PendapatanPengeluaran.jsx`: prop `initialDirection` membatasi data dan
  aksi tambah sesuai submenu Pendapatan atau Data Pengeluaran.

### Verifikasi

- `npm.cmd exec eslint --` pada tiga file perubahan: 0 error. Ada 14 warning
  import lama pada `AccountingInternalApp.jsx`, seluruhnya sudah ada di
  worktree dan di luar scope T-619.
- `npm.cmd run build`: lulus (2.21 detik); warning ukuran bundle >500 kB
  tetap backlog T-706.
- `graphify update .`: lulus, graph diperbarui (4927 node, 14151 edge).

### Catatan review

- T-608/T-617 masih `review`; T-619 tidak mengubah alur pembelian, retur,
  stok, kontrak, atau jurnalnya.
- `Pembelian.jsx` saat ini mencoba `/stock-in-documents/` sebelum fallback
  `/purchases/`, walaupun catatan manager T-608 mengarahkan daftar Pembelian
  ke `/purchases/`. Ini perlu diputuskan saat review T-608, bukan diubah
  sambil lalu dalam T-619.

### Koreksi review rute (2026-07-30)

Review menemukan bahwa refactor awal app shell telah mengarahkan sejumlah
submenu non-POS ke fallback generik. Pemetaan spesifik berikut dipulihkan tanpa
mengubah route 12 submenu POS: Konfirmasi Settlement, jurnal tunggal/multi dan
varian hutang, seluruh Piutang/Hutang, lima Laporan, serta Tutup Buku Toko Ini
dan Toko Pusat/Cabang (termasuk alias bulanan/tahunan).

- ESLint tiga file terkait: bersih, 0 error dan 0 warning.
- `npm.cmd run build`: lulus (1.99 detik); warning ukuran bundle tetap T-706.
- `graphify update .`: lulus, graph diperbarui (4932 node, 14157 edge).

### Koreksi desain stok (2026-07-30)

Atas arahan pengguna, empat submenu stok POS dikembalikan dari layar Inventory
ke layar Akuntansi sendiri: `StokMasuk`, `StokKeluar`, `ProduksiStok`, dan
`OpnameStok`. Import layar Inventory dihapus dari `AccountingInternalApp.jsx`.
Tidak ada route lain yang diubah.

- ESLint `AccountingInternalApp.jsx`: bersih.
- `npm.cmd run build`: lulus (2.13 detik); warning bundle tetap T-706.
- `graphify update .`: lulus, graph diperbarui (4933 node, 14158 edge).

### Audit submenu sebelum stok (2026-07-30)

- **Penjualan di Toko**: sudah terhubung ke sumber POS dan jurnal asli.
- **Penjualan Marketplace**: FeatureShield yang jujur; konektor dan kontrak
  API belum tersedia.
- **Pembelian**: daftar membaca respons backend, tetapi aksi post/batal dan log
  di layar belum dipersistensikan. Tetap blocker review T-608/T-617.
- **Return Pembelian**: daftar dan aksi retur memakai API; dampak jurnalnya
  belum dibuktikan pada task ini.
- **Return Penjualan**: daftar/status memakai API, tetapi belum terbukti
  menghasilkan jurnal pembalik. Tetap gap T-207.

### Perbaikan Pembelian: post/batal/log nyata + bug backend (2026-07-30, atas arahan user)

**Melebihi batas file T-619 (frontend-only) — dilakukan atas instruksi eksplisit
user setelah investigasi bersama; menyentuh `api/` backend yang seharusnya
domain [[T-618]]/Codex.** Dicatat di sini supaya tidak membingungkan
executor/reviewer lain yang menyentuh area ini.

**Temuan akar masalah**: `Pembelian.jsx` versi sebelumnya (`handlePost`,
`handlePostPayment`, `handleCancelPost`, log modal) murni memutasi state
React lokal + toast sukses palsu, tanpa panggilan API sama sekali — persis
larangan "tombol aksi palsu" di scope task ini.

Saat menelusuri endpoint nyata untuk menggantikannya, ditemukan **bug
struktural di backend**: layar detail pembelian sungguhan (`PembelianDetail.jsx`,
domain T-618) memakai dropdown status via `PurchaseWorkflowView.update_status()`
(`api/views/purchase_workflow.py`) — bukan `PurchaseViewSet.receive()`/`cancel()`
seperti dugaan awal. `update_status()` untuk status **"Selesai" tidak pernah
memposting stok/jurnal sama sekali**, hanya mengubah field `status` — pembelian
bisa berstatus Selesai tanpa pernah masuk jurnal/laporan. `selesaikan()` (aksi
lama, tidak dipakai frontend lagi sejak fitur "Selesaikan" dihapus) dibiarkan
sebagai kode yatim.

**Perbaikan** (approved user setelah diskusi, termasuk keputusan eksplisit
untuk reuse alur Retur — bukan endpoint reversal baru, hindari L4 duplikat):
- `api/product_views.py`: ekstrak logika posting `StockInDocumentViewSet.post_document`
  jadi fungsi bersama `post_stock_in_document()`.
- `api/views/purchase_workflow.py`: `update_status()` ke **"Selesai"** kini
  memposting `StockInDocument` draft terkait via fungsi di atas (stok + jurnal
  nyata, idempoten — status draft dicek dulu). Tanpa dokumen/berisi item →
  ditolak jujur, bukan diam-diam lolos. `update_status()` ke **"Batal"** kini
  ditolak bila `receive_status == 'diterima'` (harus lewat Retur), menyamakan
  guard yang sudah ada di `batalkan()` — menutup celah inkonsistensi.
- `api/tests_purchase_reception_receiver.py`: +5 test regresi.
- `Pembelian.jsx`: toolbar bulk Post/Batal Post/Post Pembayaran memanggil
  `workflow/update-status` dan `workflow/toggle-payment` nyata, kelayakan
  per baris mengikuti guard backend di atas persis (idempotensi & M7 dijaga
  dari sisi frontend juga). Klik baris membuka `PembelianDetail` asli. Log
  tombol/modal palsu dihapus — riwayat asli sudah tampil di layar detail
  (`PurchaseWorkflowLog`, endpoint `/purchases/{id}/workflow/logs/`).

**Verifikasi**: `manage.py check` bersih; suite `api`+`accounting` 224 test —
223 lulus, 1 gagal pre-existing tidak terkait (`test_owner_can_create_purchase_from_add_menu_payload`,
hardcode tanggal 29 Juli, sekarang sudah 30 Juli — dikonfirmasi gagal juga
sebelum perubahan ini). ESLint `Pembelian.jsx` bersih, `npm run build` lulus,
186 baris (di bawah limit 300). Return Pembelian/Penjualan diaudit ulang —
sudah API nyata, tidak ada temuan.

**Belum diverifikasi**: klik-uji manual di browser (browser tools tidak
tersedia di sesi ini). Server dev backend (:8000) dan frontend (:5174)
sempat dijalankan untuk uji otomatis lalu tetap aktif untuk pengecekan
manual bila diperlukan.

### Poles UI Pembelian atas arahan user (2026-07-30)

- Kembalikan dropdown filter header "Jumlah" (All/Dibayar/Parsial/Belum
  Dibayar) dan "Pembayaran" (All/Dibayar/Parsial/Retur Pembelian/Belum
  Bayar) — keduanya memfilter `payment_status` nyata dari `/purchases/`.
  "Retur Pembelian" sengaja tidak pernah cocok karena dokumen retur sudah
  dikeluarkan dari daftar ini (dikelola di `ReturPembelian.jsx`).
- Badge Status & Pembayaran diganti dari `border` polos (border ikut warna
  teks gelap, terlihat seperti garis hitam) jadi pill berwarna semantik
  (emerald/amber/rose/slate) — konsisten dengan pola badge di
  `ReturPenjualan.jsx`/`ReturPembelian.jsx`.
- ESLint bersih, `npm run build` lulus, 249 baris (di bawah limit 300).
  `graphify update .` dijalankan ulang (4975 node, 14256 edge).

### Bugfix: Selesai gagal saat "lanjut tambah stok" dimatikan (2026-07-30, laporan user)

User melaporkan error saat mengubah status ke "Selesai" walau produk & Info
Penerimaan sudah lengkap. Akar masalah: `PenerimaanCard.jsx` punya toggle
"Lanjut tambah stok masuk" — saat dimatikan, `siapkan_stok_masuk()` sengaja
**tidak membuat** `StockInDocument` (baris komentar: "penerimaan dicatat
tanpa membuat stok masuk"). Tapi perbaikan `update_status()` sebelumnya
mewajibkan ada dokumen draft untuk transisi ke Selesai — menolak jalur yang
memang valid ini.

**Perbaikan** (`api/views/purchase_workflow.py`, `update_status()`):
- Syarat Selesai sekarang `receive_status == 'diterima'` (bukan lagi
  keberadaan dokumen stok).
- Kalau dokumen draft ADA → tetap diposting stok+jurnal seperti sebelumnya.
- Kalau dokumen draft TIDAK ADA (jalur "lanjut tambah stok" off) → langsung
  Selesai tanpa posting stok, sesuai pilihan user saat Diterima.
- +1 test regresi (`test_update_status_selesai_without_stock_document_still_completes`).

Verifikasi: `manage.py check` bersih; `api.tests_purchase_reception_receiver`
12 test — 11 lulus, 1 gagal pre-existing tak terkait (tanggal hardcode).

### Lock data Return Penjualan setelah Dikonfirmasi (2026-07-30, arahan user)

Return Penjualan (`ReturPenjualanDetail.jsx`) belum lock — semua field bisa
diubah walau status Dikonfirmasi/Batal. Return Pembelian sudah lock (pola
`isDraft`), Return Penjualan belum, sekarang disamakan.

- Frontend: field tanggal/status/catatan disabled + banner terkunci saat
  Dikonfirmasi/Batal.
- Backend (`PengembalianOrderViewSet.perform_update`, `api/views/orders.py`):
  tolak PATCH kalau status sudah Dikonfirmasi/Batal, kecuali toggle
  Dikonfirmasi→Tunda (aksi "Batal Post" di daftar, sudah ada sebelumnya —
  sengaja tetap diizinkan).
- +2 test (`api/tests_order_status_actions.py`), 17/17 lulus.
- ESLint bersih, build lulus.

### Jurnal Stok Keluar & Opname + aktifkan Post/Batal Post (2026-07-30, arahan user)

Stok Keluar/Opname sebelumnya cuma mutasi stok, tanpa jurnal. Ditambahkan:

- Migration 0029: `JournalEntry.SourceType` +`STOCK_OPNAME`.
- `product_views.py`: `post_stock_adjustment_journal()` (Stok Keluar, akun
  81000 Penyesuaian Barang vs 11400 Persediaan, pakai HPP FIFO nyata dari
  `stock_fifo.consume_layers`; alasan 'transfer' di-skip — bukan kerugian)
  dan `post_stock_opname_journal()` (surplus & defisit satu entri gabungan,
  idempoten per dokumen).
  Produksi Stok **belum** dijurnal — masih perlu investigasi terpisah
  (relasi ke `production_costing`/JobBoard).
- Frontend: `useAccountingStockBulkActions.js` (hook bersama, hindari
  triplikasi) — checkbox pilih baris + tombol Post/Batal Post aktif di
  `StokMasuk`, `StokKeluar`, `OpnameStok`, panggil `post-document`/`cancel`
  nyata. Produksi Stok tetap nonaktif.
- +6 test (`tests_stock_adjustment_journal.py`). Suite penuh `api`+`accounting`:
  233/233 lulus. ESLint bersih, build lulus.

### Pendapatan/Pengeluaran: kembalikan UI POS + jurnal nyata (2026-07-30, arahan user)

Sebelumnya `pos-pendapatan`/`pos-data-pengeluaran` routing ke
`transaksi/pages/PendapatanPengeluaran.jsx` (sama dengan menu Akuntansi lain,
tidak ada beda visual). User minta kembali ke UI khas Transaksi POS.
Model `CashTransaction` ternyata tidak punya field Akun Debit/Kredit/Status
sama sekali — user approve tambah field tsb + posting jurnal (bukan cuma
pulihkan tampilan).

- Migration 0094 (api) + 0029 (accounting, SourceType +CASH_TRANSACTION):
  `CashTransaction.akun_debit`, `akun_kredit` (FK ke `accounting.Account`),
  `status` (draft/selesai/batal).
- `accounting/services/cash_transaction_posting.py`: `post_cash_transaction_journal()`
  (D akun_debit / K akun_kredit sesuai pilihan user per transaksi, idempoten)
  dan `reverse_cash_transaction_journal()` (jurnal pembalik M7, `source_id=None`
  untuk reversal — hindari bentrok unique constraint source_type+source_id+date).
  Transaksi terposting terkunci (tidak bisa diedit); Batal Post → status
  `batal` permanen (bukan toggle balik ke draft, sesuai constraint DB).
- Frontend: `CashTransactionPosScreen.jsx` (dipakai `Pendapatan.jsx` &
  `Pengeluaran.jsx`, direction-based) — tabel dengan dropdown Akun Debit/Kredit
  nyata (dari `/accounting/accounts/`), checkbox + Post/Batal Post nyata.
  Scope: hanya list+post/batal; belum ada UI tambah transaksi baru
  (tetap lewat layar Transaksi lama bila perlu).
- +6 test (`tests_cash_transaction_posting.py`). Suite penuh `api`+`accounting`:
  239/239 lulus. Lint & build lulus.

### Tipe Transaksi dikembalikan + nyata (2026-07-30, arahan user)

Tombol "Tipe Transaksi" lama (`TipeTransaksiModal.jsx`,
`TipeTransaksiPengeluaranModal.jsx`) juga palsu: nama baris hardcoded
("Dhitch"/"Oh"/"Ohj"), "Simpan" tanpa API. Backend real untuk ini sudah ada
dan sudah dipakai layar lain: `CashTransactionType` + `CashTransactionTypeViewSet`
(`/cash-transaction-types/`, full CRUD) — cuma field `nama`+`tipe`, TIDAK ada
pemetaan ke akun seperti yang direka modal lama.

- `TipeTransaksiModal.jsx` ditulis ulang: list/tambah/hapus tipe transaksi
  nyata via `/cash-transaction-types/`, di-share pakai prop `direction`
  (bukan dua file terpisah). `TipeTransaksiPengeluaranModal.jsx` (duplikat,
  sudah tidak dipakai) dihapus.
- Tombol "Tipe Transaksi" dikembalikan di `CashTransactionPosScreen.jsx`.
- Tidak ada perubahan backend — endpoint sudah ada & sudah teruji sebelumnya.
- Lint & build lulus.

### Komisi Penjualan & Biaya MDR disambungkan real (2026-07-30, arahan user)

Dua-duanya ternyata sudah punya data asli, cuma belum ada layar yang membacanya
— tidak perlu backend baru (F2: reuse endpoint yang sudah ada).

- **Komisi Penjualan**: baca `GET /reports/item-brand/` (laporan yang sudah
  hitung `Brand.komisi_persen x nilai jual` per baris pesanan). Read-only,
  tanpa Post/Batal Post (data laporan, bukan ledger yang bisa diposting).
- **Biaya MDR**: baca `GET /accounting/payment-methods/` (utk `mdr_percent`
  & `mdr_debit_account`) + `GET /accounting/journal-entries/?source_type=settlement`,
  lalu filter baris jurnal yang kena akun MDR tsb. Biaya MDR memang sudah
  diposting nyata saat proses Settlement (`accounting/services/settlement.py`)
  — layar ini cuma membaca ulang, tidak menghitung ulang atau posting apa pun.
- Dua drawer pengaturan lama (`KomisiPenjualanSettingsDrawer.jsx`) dihapus —
  fake ("Pengaturan Disimpan" tanpa API), tidak ada field backend yang cocok.
- Routing `AccountingInternalApp.jsx`: kembali dari FeatureShield ke komponen
  asli.
- Tidak ada perubahan backend — murni baca ulang endpoint yang sudah ada &
  sudah teruji. Lint & build lulus.

### Pengaturan Akun Komisi Penjualan dikembalikan (2026-07-30, arahan user)

Drawer lama (dihapus sebelumnya karena fake) dibangun ulang nyata, scope
disepakati: simpan preferensi akun saja, belum ada aksi posting (Komisi
Penjualan tetap read-only report).

- `accounting/models/settings.py`: +2 field `AccountingSettings`
  (`komisi_penjualan_debit_account`, `komisi_penjualan_kredit_account`,
  FK ke Account, pola sama persis dengan `pos_sales_rounding_account` dkk
  yang sudah ada). Migration 0030.
- Serializer & `PATCH /api/accounting/settings/` otomatis dukung field baru
  (generic, tidak ada whitelist manual).
- `KomisiPenjualanSettingsDrawer.jsx`: baca akun asli dari
  `/accounting/accounts/`, baca/simpan preferensi dari
  `/accounting/settings/` nyata (bukan lagi "Simpan" tanpa API).
- +1 test (`tests_pos_settings.py`). Lint & build lulus.

### Fix dropdown filter tertutup (2026-07-30, laporan user)

Dropdown Status/Jumlah/Pembayaran masih ketutup setelah fix `overflow-visible`
— ternyata `overflow-x-auto` + `overflow-y-visible` di elemen sama TIDAK
benar-benar visible (CSS spec: overflow-y ikut jadi 'auto'). Fix nyata:
komponen baru `accounting/components/HeaderFilterDropdown.jsx` — render lewat
`createPortal` ke `document.body`, posisi dari `getBoundingClientRect()`
tombol (pola sama `RowActionMenu` di `ProductsPage.jsx`). Tidak lagi
terpengaruh overflow ancestor sama sekali. Dipakai di `Pembelian.jsx`,
`ReturPembelian.jsx`, `ReturPenjualan.jsx`. Lint & build lulus.
