---
id: T-724
epik: "[[Bug QA Manual]]"
status: review
agent: Claude
prioritas: sedang
depends_on: []
created: 2026-08-11
---

# T-724 — Field Tanggal Gabung & Transaksi Terakhir di Pelanggan

## Scope

User minta import 2 file Excel data pelanggan lama (Agen 320 baris, MOU 40 baris) dari sistem Olsera lama. File sumber punya kolom "Join Date" dan "Last Transaction Date" yang tidak punya tempat di model `Customer` — sebelumnya cuma dimasukkan ke kolom Catatan sebagai teks. User minta dilengkapi jadi field asli, terlihat di detail pelanggan dan saat export.

Catatan: kolom "Tanggal Aktif" yang sudah ada di tabel daftar Pelanggan sengaja TIDAK diubah — itu tetap `created_at` (kapan record dibuat di sistem ini), sudah ada komentar penjelas di kode sebelumnya. Field baru ini konsepnya beda (histori sesungguhnya, bisa jauh sebelum record dibuat di sistem kita).

## Perubahan

- **Model**: `Customer.tanggal_bergabung` dan `Customer.transaksi_terakhir` (keduanya `DateField(null=True, blank=True)`) — migration `0112_customer_tanggal_bergabung_and_more`.
- **Import CSV** (`customer_views.py::import_csv`): baca kolom opsional `join_date`/`tanggal_gabung` dan `last_transaction_date`/`transaksi_terakhir` kalau ada di file (tidak ada di template Olsera standar, jadi tidak wajib).
- **Export** (`export_views.py::ExportCustomersView`): 2 kolom baru "Tanggal Gabung" dan "Transaksi Terakhir" ditambahkan ke xlsx.
- **Frontend**: `CustomerDetailPage.jsx` (Profil Pelanggan → Lainnya) dan `AddCustomerModal.jsx` (bisa diisi manual saat Tambah/Ubah Pelanggan) + preview kolom di `CustomerImportPreview.jsx`.

## Verifikasi

- Test baru `test_tanggal_gabung_dan_transaksi_terakhir_opsional` (`tests_customer_import.py`) — 4/4 lulus.
- Full suite `api`: 316 test, **315 lulus, 1 gagal** (`test_kasir_tidak_bisa_ubah_pengaturan_supplier`) — **dikonfirmasi pre-existing, tidak berkaitan** dengan perubahan task ini (diff `git diff HEAD` menunjukkan perubahan permission Supplier ke `IsOwnerManagerAdminOrKasir` sudah ada di working tree SEBELUM task ini dikerjakan; test lama belum di-update mengikuti keputusan produk 2026-08-10 yang sudah didokumentasikan di docstring `SupplierViewSet`). Perlu ditindaklanjuti terpisah — test-nya yang basi, bukan kodenya.
- 360 pelanggan (320 Agen + 40 MOU) diimpor ulang di sandbox lokal (SQLite) dengan field baru terisi, dikonfirmasi lewat export xlsx (`Tanggal Gabung`/`Transaksi Terakhir` terisi tanggal asli, bukan `-`).
- **Belum disentuh sama sekali di VPS** — user akan import sendiri di VPS setelah fitur ini dipastikan siap. VPS butuh `git pull`/sync file + migration `0112` sebelum kolom baru ini bisa dipakai di sana (lihat [[Deploy VPS]]).

## File diubah

- `bintang-advertising-backend/api/customer_models.py`
- `bintang-advertising-backend/api/customer_views.py`
- `bintang-advertising-backend/api/export_views.py`
- `bintang-advertising-backend/api/migrations/0112_customer_tanggal_bergabung_and_more.py`
- `bintang-advertising-backend/api/tests_customer_import.py`
- `bintang-react-frontend/src/features/customerSupplier/components/CustomerDetailPage.jsx`
- `bintang-react-frontend/src/features/customerSupplier/components/AddCustomerModal.jsx`
- `bintang-react-frontend/src/features/customerSupplier/components/CustomerImportPreview.jsx`
