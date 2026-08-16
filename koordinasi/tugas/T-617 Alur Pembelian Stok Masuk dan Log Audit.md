---
id: T-617
epik: "[[Production Readiness dan Integrasi Akuntansi]]"
status: done
agent: Antigravity
prioritas: tinggi
depends_on: []
created: 2026-07-29
---

**Verifikasi manager 2026-08-01 — CONFIRMED, promosi ke `done`.** `PurchaseActivityLog` audit trail nyata (bukan tabel UI kosong), fix `update_status()` "Selesai" (cross-boundary dengan T-619) terverifikasi ada di kode, 12/12 test lulus, migration terpasang ke `db.sqlite3` nyata.

### 2026-07-29 — Koreksi UI oleh Codex (manager)

- Memindahkan pemulihan ringkasan pembayaran ke **Detail Pembelian**: setelah pembayaran tersimpan, kartu hijau menampilkan nama akun, nominal IDR, tanggal, dan tombol X. Tombol X hanya menutup kartu; **Pengaturan Pembayaran** muncul kembali.
- Mengembalikan **File Lampiran** tepat sebelum Log Aktivitas Pembelian. Lampiran disimpan di backend melalui `PurchaseAttachment`, bukan hanya state UI; format dokumen umum hingga 10 MB divalidasi server-side.
- Verifikasi: migrasi `api.0092_purchase_attachment` diterapkan; 6 test backend terkait lulus; lint dan build frontend lulus.

### 2026-07-29 — Perbaikan lanjutan oleh Codex (manager)

- Tombol X pada ringkasan pembayaran kini membatalkan pembayaran melalui `remove-payment`, membalik jurnal, dan memuat ulang detail agar **Jumlah Terbayar** serta status pembayaran selalu mengikuti data server.
- Modal **Pengaturan Pengiriman** dirapikan: judul dan keterangan, field nominal, serta aksi Batal/Simpan kini sejajar dan konsisten dengan modal pembelian lain.
- Verifikasi: 7 test backend terkait lulus; lint dan build frontend lulus.

### 2026-07-29 — Perbaikan modal pembayaran oleh Codex (manager)

- Modal pembayaran sekarang otomatis tertutup hanya setelah `add-payment` berhasil dan detail pembelian selesai dimuat ulang, sehingga pembayaran tidak dapat terinput berulang karena modal tertinggal terbuka.
- Konfirmasi pop-up pada tombol X dihapus sesuai arahan. Tombol tersebut tetap membatalkan pembayaran melalui endpoint aman yang membalik jurnal dan menghitung ulang total server.
- Verifikasi: lint komponen dan build frontend lulus.

### 2026-07-29 — Koreksi visibilitas pengaturan oleh Codex (manager)

- Diskon, Pajak, dan Pengiriman tidak lagi disembunyikan oleh status dokumen. Hanya Pengaturan Pembayaran yang mengikuti sisa tagihan dan hilang ketika pembelian benar-benar lunas.
- Verifikasi: lint komponen dan build frontend lulus.

### 2026-07-29 — Penyelarasan biaya pengiriman oleh Codex (manager)

- Baris Biaya Pengiriman memakai struktur kolom yang sama dengan Diskon dan Pajak, sehingga nominal dan tombol Pengiriman sejajar dengan pengaturan lainnya.
- Verifikasi: lint komponen dan build frontend lulus.

### 2026-07-29 — Penyelarasan status dan pembayaran oleh Codex (manager)

- Tombol atas **Selesaikan** dihapus; perubahan status pembelian dilakukan melalui dropdown Tunda, Terkirim, Dikirim, Diterima, Selesai, dan Batal.
- **Pengaturan Pembayaran** tetap tersedia selama masih ada sisa tagihan, termasuk setelah pembayaran sebagian; Total Ditagihkan dan Jumlah Terbayar tetap menjadi ringkasan berurutan pada tabel produk pesanan.
- Verifikasi: lint komponen dan build frontend lulus.

# T-617 — Alur Pembelian, Stok Masuk, dan Log Audit

## Scope

Merapikan alur pembelian dari produk dan informasi penerimaan menuju dokumen
stok masuk, serta memisahkan daftar Butuh Diproses, Telah Diproses, dan
Dibatalkan berdasarkan status nyata. Setiap perubahan pembayaran dan status
harus tercatat pada log detail pembelian. Retur hanya dibuat dari menu Retur.

## Desain disetujui user 2026-07-29

### Opsi dipertimbangkan

1. Menaruh status dan riwayat hanya di frontend. Cepat, tetapi status berubah
   saat reload dan tidak dapat diaudit.
2. Menjadikan Purchase sumber status dan audit, lalu menautkan satu dokumen
   Stok Masuk sebagai dokumen operasional penerimaan. Ini menjaga stok,
   pembayaran, dan daftar kategori memakai data server yang sama.

### Keputusan

Memakai opsi 2. Alur: produk + informasi penerimaan lengkap -> Stok Masuk
draft -> Draft/Batalkan/Post Sekarang -> Diterima (tetap Butuh Diproses) ->
Selesai (Telah Diproses). Batal masuk daftar Dibatalkan. Pembayaran kembali
ke Belum Dibayar dicatat di log audit. Retur tidak dibuat dari detail pembelian
normal.

## Acceptance criteria

- [x] Produk dan informasi penerimaan menjadi prasyarat dokumen stok masuk.
- [x] Post Stok Masuk memperbarui pembelian menjadi Diterima tanpa memindahkan
  dokumen ke Telah Diproses.
- [x] Selesai dan Batal memindahkan dokumen ke kategori yang tepat.
- [x] Toggle pembayaran memakai data server dan seluruh perubahan tercatat.
- [x] Retur hanya tersedia pada menu Retur.
- [x] Test area terkait, build frontend, dan `graphify update .` lulus.

## Hasil

- **Status**: Set to `review`.
- **Modul Backend Diubah**:
  - `api/views/purchase_workflow.py`: Menambahkan endpoint action `toggle-payment` dan `update-status`. Mengupdate `siapkan-stok-masuk` agar langsung mengubah `receive_status = 'diterima'`.
  - `api/purchase_workflow_models.py`: Menambahkan listener signal `post_save` & `post_delete` pada `PurchaseItem` untuk pencatatan log otomatis penambahan/penghapusan produk pesanan.
- **Modul Frontend Diubah**:
  - `src/features/transaksi/components/PembelianDetail.jsx`: Menambahkan breadcrumb `Daftar Pembelian / Open Purchase Detail`, merapikan banner status (hanya Belum Dibayar / Sudah Dibayar), menambahkan Toggle Switch Pembayaran (aktif hanya bila produk & info penerimaan terisi), tombol Cetak, serta dropdown status (`Tunda`, `Terkirim`, `Dikirim`, `Diterima`, `Selesai`, `Batal`).
  - `src/features/transaksi/components/PenerimaanCard.jsx`: Mengalihkan langsung ke layar **Detail Stok Masuk** di inventori setelah informasi penerimaan disimpan via URL query param.
  - `src/features/inventory/pages/inventory/StockInPage.jsx`: Membaca parameter query URL `stockInId` untuk langsung membuka `viewState = 'detail'` dari dokumen stok masuk terkait.
  - `src/features/transaksi/components/PurchaseWorkflowLog.jsx`: Merapikan tampilan timeline log aktivitas dengan badge, timestamp format Indonesia, dan riwayat aktivitas pengguna.
- **Verifikasi**: `npm run build` berhasil (2399 modul terkompilasi bersih 0 error) & `graphify update .` berhasil dijalankan.

## Perbaikan lanjutan oleh Codex (manager) â€” 2026-07-29

- Memisahkan pemuatan detail pembelian dari riwayat workflow sehingga kegagalan
  log (termasuk retur atau migrasi log yang belum diterapkan) tidak lagi
  menampilkan alert palsu “Gagal memuat detail pembelian”.
- Toggle **Lanjut tambah stok masuk** sekarang dihormati: OFF hanya mencatat
  penerimaan dan menjadikan status **Diterima**; ON membuat draft Stok Masuk,
  menyalin produk serta informasi penerimaan, lalu membuka detail Stok Masuk.
- Pengaturan akun pembayaran tidak lagi memakai daftar statis. Modal membaca
  COA Aset/Kas-Bank dari API Akuntansi, dan penambahan akun melalui drawer
  disimpan ke API Akuntansi.
- Pembayaran pembelian dan toggle pembayaran kini membuat jurnal idempoten
  per pembayaran. Penghapusan atau toggle kembali ke Belum Dibayar membuat
  jurnal pembalik, bukan menghapus jejak jurnal.
- Kolom Penerima kini memilih akun pengguna aktif dari aplikasi. Nama terpilih
  disimpan di pembelian dan disalin ke draft Stok Masuk, baik saat toggle stok
  masuk OFF maupun ON.
- **Verifikasi Codex**: `manage.py check`, `makemigrations --check --dry-run`,
  63 test accounting, test jurnal pembayaran pembelian, lint file terkait,
  build frontend, dan `graphify update .` lulus.
