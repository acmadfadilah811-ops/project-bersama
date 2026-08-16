---
id: T-615
epik: "[[Production Readiness dan Integrasi Akuntansi]]"
status: done
agent: Codex (manager)
prioritas: tinggi
depends_on: [T-210, T-608, T-613]
created: 2026-07-29
---

# T-615 — Pemulihan UI Return Penjualan dan Pembelian

## Requirement

Pulihkan submenu `Return Penjualan` dan `Return Pembelian` yang sebelumnya
hilang/tidak tersambung. Keduanya harus memakai data nyata, dapat membuka detail,
dan mempertahankan aksi yang sudah tersedia di modul transaksi.

## Desain yang dipilih — disetujui user 2026-07-29

### Opsi yang dipertimbangkan

1. Membuat halaman/list/detail baru khusus Akuntansi. Ini memberi kontrol layout
   penuh, tetapi menduplikasi alur API, status, dan aksi retur yang sudah ada.
2. Memakai ulang halaman transaksi yang sudah menjadi source-of-truth, lalu
   memasang adapter routing submenu Akuntansi. Perubahannya lebih kecil dan
   menjaga satu kontrak API serta satu detail screen.

### Keputusan

Memilih opsi 2:

- Return penjualan memakai halaman `transaksi/Penjualan` pada tab
  `pengembalian`, dengan `ReturnOrderDetail` untuk detail.
- Return pembelian memakai halaman `transaksi/Pembelian` pada tab `retur`,
  dengan `PembelianDetail` untuk detail dan aksi `post-retur`.
- Tidak membuat endpoint, model, migration, atau jalur posting baru.
- Perbaikan ini dilakukan langsung oleh **Codex sebagai manager**, atas instruksi
  user, bukan klaim pekerjaan agent lain.

## Kontrak API yang dipakai

- Return penjualan: `GET /api/orders/`, `GET /api/orders/{id}/`,
  `POST /api/orders/{id}/retur/`, `PATCH /api/pengembalian/{id}/`.
- Return pembelian: `GET /api/purchases/`, `POST /api/purchases/{id}/create-retur/`,
  `GET /api/purchases/{id}/`, `POST /api/purchases/{id}/post-retur/`.

## Batasan uang/stok

Tidak mengubah mapping jurnal atau perhitungan nominal. Posting retur pembelian
tetap melewati service stok/FIFO dan posting jurnal yang sudah ada. Tidak ada
float, ledger legacy, atau mutation langsung dari UI.

## Koreksi manager 2026-07-29

Implementasi adapter ke menu transaksi dibatalkan setelah koreksi user. Layar
Return Penjualan dan Return Pembelian harus tetap menjadi halaman mandiri di
Akuntansi; yang dibagi hanya source-of-truth API dan detail data, bukan navigasi
atau komponen halaman transaksi.

## Hasil

- Perbaikan dilakukan langsung oleh **Codex sebagai manager**.
- Adapter ke halaman transaksi dibatalkan dari implementasi final sesuai koreksi user.
- `ReturPenjualan.jsx` tetap menjadi halaman Akuntansi mandiri dengan tampilan tabel custom, filter tanggal/status, settings drawer, dan detail `ReturPenjualanDetail`.
- `ReturPembelian.jsx` tetap menjadi halaman Akuntansi mandiri dengan tampilan tabel custom, filter tanggal/status, dan detail `ReturPembelianDetail`.
- Return penjualan membaca `/pengembalian/`, detail membaca `/orders/{id}/`, dan perubahan status/catatan memakai `PATCH /pengembalian/{id}/`.
- Return pembelian membaca `/purchases/`, hanya menampilkan `is_retur`, detail membaca `/purchases/{id}/`, dan aksi memakai `post-retur`/`cancel`.
- Source-of-truth tetap endpoint existing; tidak ada migration atau endpoint baru.
- Tampilan tanggal preset return diperbaiki agar dinamis, tidak lagi hardcoded ke 2026-07-26.

## Verifikasi

- ESLint file terkait: **0 error**, 25 warning pre-existing/import unused.
- ESLint file terkait: **0 error**, 24 warning pre-existing di `AccountingInternalApp.jsx`.
- `npm.cmd run build`: **lulus**.
- `manage.py check`: **lulus** dari verifikasi backend sebelumnya; backend endpoint tidak berubah pada koreksi ini.
- `manage.py makemigrations --check`: **lulus** dari verifikasi backend sebelumnya.
- `manage.py test api.tests_order_status_actions`: **15/15 lulus** dari verifikasi backend sebelumnya.
- `graphify update .`: **lulus**, graph 4.699 nodes / 13.540 edges.
