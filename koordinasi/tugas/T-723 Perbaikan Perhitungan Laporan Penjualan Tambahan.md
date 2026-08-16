---
id: T-723
epik: "[[Bug QA Manual]]"
status: review
agent: Claude
prioritas: tinggi
depends_on: []
created: 2026-08-11
---

# T-723 — Perbaikan perhitungan laporan penjualan tambahan (`sales_report_extensions.py`)

## Scope

User tanya proaktif: "bagian laporan rincian penjualan apakah perhitungannya aman?" — diaudit langsung, ditemukan 2 bug nyata di `api/services/sales_report_extensions.py` (modul laporan turunan yang dipakai bersama halaman Laporan, BUKAN laporan utama "Rincian Penjualan" di `report_views.py::rpt_rincian_penjualan` yang sudah dicek dan terbukti benar).

**Catatan lintas-batas**: berkaitan dengan area T-719 (Export Rincian Penjualan Format Lengkap, `in_progress` milik Codex) tapi TIDAK menyentuh file yang sama — T-719 soal skema export/format kolom (`export_views.py`), task ini soal bug perhitungan angka di laporan turunan (`sales_report_extensions.py`). Mohon dicek saat review T-719 supaya tidak tumpang tindih.

## Temuan & Perbaikan

### Bug 1 — `_orders()` default hanya status `'selesai'`, tidak sinkron dengan laporan utama

Laporan utama "Rincian Penjualan" (`report_views.py::_orders_in_range`) menghitung SEMUA status Order kecuali `'batal'` sebagai penjualan. Tapi `sales_report_extensions.py::_orders()` defaultnya `status_global__in=('selesai',)` — cuma order yang SUDAH selesai produksi. Efeknya: laporan turunan yang memakai helper ini (`Penjualan berdasarkan Tanggal/Pelanggan/Jam/Penjual`, `Item Penjualan Berdasarkan Koleksi/Pelanggan`, `Item Penjualan berdasarkan Pelunasan Non Kredit`, `Rincian Penjualan Kredit`) selalu menampilkan total LEBIH KECIL dari laporan utama untuk periode yang sama — order yang masih `'proses'/'desain'/'ready'` (tapi sudah tercatat sebagai penjualan di laporan utama) terlewat begitu saja di laporan-laporan ini.

**Perbaikan**: default `_orders()` diubah dari allow-list `('selesai',)` jadi `.exclude(status_global='batal')` — persis pola `_orders_in_range()` di report_views.py. Parameter `statuses` tetap bisa dipakai manual kalau ada caller yang benar-benar butuh filter status spesifik (belum ada saat ini).

### Bug 2 — Diskon di "Rincian Penjualan Kredit" dihitung dari basis yang salah

`Order.total_harga` SUDAH bersih setelah semua diskon (persen + kupon + otomatis) — lihat `Order.update_totals()`/`save()`: `total_harga = subtotal - potongan(diskon_persen) - kupon - otomatis`. Tapi `credit_sales()` menghitung kolom "Diskon" dengan `total_harga * diskon_persen / 100` — mengambil persentase dari angka yang SUDAH terdiskon, bukan dari subtotal aslinya, sehingga nilai diskon yang ditampilkan lebih kecil dari nominal diskon sebenarnya (dan sama sekali mengabaikan diskon kupon/otomatis). Laporan `_paid_rows()` di file yang sama sudah punya cara hitung yang benar untuk kasus persis sama (`max(0, subtotal_item - total_harga)`) — cuma tidak dipakai ulang di `credit_sales()`.

**Perbaikan**: `credit_sales()` sekarang pakai formula yang sama: `diskon = max(0, sum(item.harga_jual) - order.total_harga)`.

## Verifikasi

- 2 test baru ditambahkan ke `api/tests_sales_report_extensions.py`: `test_diskon_kredit_dihitung_dari_subtotal_bukan_dari_total_setelah_diskon`, `test_penjualan_berdasarkan_tanggal_mencakup_order_belum_selesai`.
- 7/7 test lulus lokal (5 pre-existing + 2 baru), 0 regresi.
- Dideploy ke VPS (rebuild+restart `backend`), health check 200. 301 di test dalam container = artefak test-harness dikenal (`SECURE_SSL_REDIRECT`, lihat catatan di task-task sebelumnya), bukan bug.
- Diverifikasi langsung ke database produksi lewat `APIRequestFactory` + transaksi yang di-rollback (tidak ada data tersisa): order kredit diskon 10% dengan subtotal 100.000/total 90.000 sekarang benar tampil diskon `10.000` (sebelumnya `9.000`); order berstatus `'proses'` sekarang ikut terhitung di laporan "Penjualan berdasarkan Penjual".

## File diubah

- `bintang-advertising-backend/api/services/sales_report_extensions.py`
- `bintang-advertising-backend/api/tests_sales_report_extensions.py`
