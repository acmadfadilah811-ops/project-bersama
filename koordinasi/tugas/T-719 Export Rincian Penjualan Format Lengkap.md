---
id: T-719
judul: Export Rincian Penjualan Format Lengkap
status: in_progress
agent: Codex
prioritas: tinggi
depends_on: []
---

# T-719 — Export Rincian Penjualan Format Lengkap

## Scope

Menyamakan ekspor Excel `Rincian Penjualan` dengan workbook referensi pengguna,
tanpa menambah atau memaksa seluruh kolom ekspor tampil di tabel UI.

## Bukti dan desain

- Referensi memiliki 36 kolom, termasuk metadata pelanggan, dua penerimaan
  pembayaran, referensi, dan status lunas.
- `api/report_views.py:1114` hanya membangun 25 kolom tampilan ringkas dan
  `ReportExportView` pada file yang sama mengekspor skema itu; tidak ada jalur
  ekspor rinci yang terpisah.
- File tersebut sudah melampaui hard limit L5, sehingga endpoint khusus akan
  ditempatkan di modul view baru dan memakai service pembentuk data baru.
- Sumber data: `Order`/`OrderPayment` untuk pesanan dan cicilan; `POSSale` dan
  `ProductStockMovement.hpp_total` untuk POS; `Contact.customer`/`Customer`
  untuk profil pelanggan. Kolom yang belum direkam secara persisten (misalnya
  ongkir, pembulatan, dan payment charge) dibiarkan kosong, bukan bernilai 0
  buatan.

## Di luar scope


- Perubahan tabel UI laporan.
- Menambah field atau jurnal finansial baru hanya untuk kebutuhan ekspor.
- Menyatukan laporan stok masuk/keluar (ditunda oleh pengguna).

## Hasil


*(diisi setelah implementasi dan verifikasi)*
