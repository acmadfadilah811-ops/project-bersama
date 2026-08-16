---
id: T-720
judul: Antrean WA Input Item Produk Katalog
status: review
agent: Codex
prioritas: tinggi
depends_on: []
---

# T-720 — Antrean WA: Input Item Produk Katalog

## Scope

Hubungkan Detail Nota Pelanggan pada Antrean WA ke katalog `Product` dan
`ProductVariant`, dengan tetap mendukung item custom untuk pekerjaan cetak.

## Bukti akar masalah

- `WaOrderQueue.jsx:~540` hanya menyediakan paket dan input teks manual.
  Payload simpan pada `~260` tidak pernah mengirim FK `product`/`variant`.
- `OrderItem` sudah mempunyai FK produk dan varian, dan `OrderItemSerializer`
  sudah mengekspos keduanya. Karena FK tidak diisi, laporan berbasis produk
  tidak dapat mengaitkan order WA dengan master katalog.

## Desain

- Pilih produk/varian dari `GET /products/`; harga katalog WA menjadi harga
  satuan tampilan dan total baris dikirim sebagai harga_jual (harga satuan ×
  qty), sesuai perhitungan total backend.
- Pilihan produk dan paket saling eksklusif. Item custom tetap bisa memakai
  nama dan harga manual.
- Tidak mengubah model, endpoint, harga master, stok, atau jurnal.

## Hasil

- Menambahkan `WaOrderItemProductSource.jsx` agar setiap item dapat memilih
  produk katalog, varian, paket, atau tetap menjadi item custom.
- `WaOrderQueue.jsx` sekarang memuat katalog produk aktif, menyimpan FK
  `product` dan `variant` bersama item, serta memakai harga online (fallback
  harga toko) sebagai harga satuan yang terkunci untuk item katalog.
- Harga yang dipersistenkan sebagai `harga_jual` adalah total baris
  (`harga_satuan × qty`), sesuai kalkulasi `OrderItem.save()` dan total Order
  backend. Item custom tetap dapat memasukkan harga satuan sendiri.
- Verifikasi: `npm.cmd run build` lulus. `graphify update .` dijalankan tetapi
  menolak menimpa graph karena pemindaian sandbox kehilangan dependency yang
  tidak dapat dibaca (6.955 node vs graph lama 20.611 node); tidak memakai
  `--force` agar graph proyek tidak rusak.
- Umpan balik UI: dropdown kini tampil eksplisit di bawah label **Pilih Produk
  Katalog**, dengan placeholder `-- Pilih produk dari katalog --`; paket
  ditampilkan terpisah agar tidak dikira sebagai produk biasa. Build diulang
  dan tetap lulus.
- Deploy VPS 2026-08-09: hanya `WaOrderQueue.jsx` dan
  `WaOrderItemProductSource.jsx` diunggah setelah backup ke
  `/opt/bintang/deploy/backups/20260809-192539-wa-catalog-dropdown`.
  Container frontend direbuild dan direcreate; health API via Nginx mengembalikan
  database/cache `ok`, dan bundle live terverifikasi memuat `Pilih Produk Katalog`.

## Verifikasi manager (2026-08-10) — user lapor "berantakan", 2 bug nyata ditemukan & diperbaiki

User lapor langsung: layout tabel item berantakan, dan harga selalu balik ke 0
walau produk katalog sudah dipilih benar. Investigasi kode (bukan cuma baca
laporan) menemukan:

1. **Bug uang/UX nyata — root cause harga balik ke 0**: `WaOrderQueue.jsx`
   polling `fetchQueue()` tiap 15 detik memanggil `handleSelectOrder(refreshed)`
   setiap kali order yang sedang dibuka di editor masih ada di daftar. Karena
   `handleSelectOrder` membangun ulang SELURUH state form (`editItems` dkk) dari
   data server, dan harga yang baru dipilih kasir dari dropdown produk belum
   sempat ter-`PATCH` ke server, polling ini diam-diam menimpa harga yang baru
   dipilih kembali ke 0 (nilai `harga_jual` lama di DB) — persis di tengah kasir
   mengedit. Ini bukan bug perhitungan harga (perhitungan sudah benar), tapi race
   condition antara auto-refresh dan sesi edit aktif. **Diperbaiki**: poll
   sekarang hanya menyegarkan `selectedOrder` (untuk header: status/sisa
   tagihan) tanpa menimpa field form yang sedang diedit; reload penuh form
   tetap terjadi kalau kasir klik ulang kartu order di daftar kiri.
2. **Layout tabel item berantakan**: kolom pertama (`WaOrderItemProductSource`)
   menumpuk 3-4 kontrol (pilih produk, varian, paket, nama custom) tanpa
   `vertical-align: top`, sehingga kolom lain (P×L, Qty, Harga, Subtotal, hapus)
   ikut tergeser ke tengah baris yang jadi tinggi — plus satu `<td>` memakai
   `display:flex` langsung (kombinasi tidak stabil lintas browser). **Diperbaiki**:
   semua `<td>` diberi `align-top`, `flex` dipindah ke `<div>` di dalam `<td>`,
   dan `WaOrderItemProductSource` tidak lagi menampilkan baris nama custom
   read-only yang redundan saat produk/paket katalog sudah dipilih (mengurangi
   tumpukan elemen).

Build (`npm run build`) dan `eslint` pada 2 file lulus (0 error, warning yang
ada pre-existing, bukan dari perubahan ini). Dideploy ke VPS (backup
`WaOrderQueue.jsx.bak_20260810-waqueue-fix` /
`WaOrderItemProductSource.jsx.bak_20260810-waqueue-fix`), `docker compose build
frontend && up -d frontend`, health `/api/health/` 200, bundle live
dikonfirmasi memuat kode baru (`align-top`, string heading invoice baru).
**Belum ada verifikasi visual browser langsung** (user belum konfirmasi
tampilan akhir) — mohon user cek langsung di kasir dan kabari kalau masih ada
yang aneh.
