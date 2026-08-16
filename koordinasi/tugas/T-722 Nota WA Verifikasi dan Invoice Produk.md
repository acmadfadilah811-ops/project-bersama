---
id: T-722
epik: "[[Revisi UI Kasir v2]]"
status: review
agent: Codex
prioritas: tinggi
depends_on: []
created: 2026-08-10
---

# T-722 — Nota WA Verifikasi dan Invoice Produk

## Scope

Menambah aksi Antrean WA untuk menyimpan/verifikasi nota dan mengirim invoice
pesanan ke nomor pelanggan. Invoice menampilkan nomor pesanan untuk tracking
serta ID produk/paket pada setiap item. Memperbaiki harga otomatis saat katalog
produk/paket dipilih, terutama nilai string `"0.00"` yang salah dianggap harga
online tersedia.

## Bukti akar masalah

- `WaOrderQueue.jsx:230-282` memakai operator `||` pada harga string dari API;
  nilai `"0.00"` bersifat truthy sehingga fallback ke harga toko tidak berjalan.
- `order_invoice_whatsapp.py:64-114` sudah membangun PDF invoice, tetapi item
  tidak menampilkan ID produk/paket dan service hanya mengirim invoice DP.
- Tidak ada aksi manual pengiriman invoice pada editor Antrean WA.

## Keputusan

Memperluas service invoice yang ada dan menambah endpoint tipis berizin
owner/manager/admin/kasir. Tidak ada perubahan harga, pembayaran, jurnal,
status SPK, atau migrasi; aksi hanya memakai snapshot `Order` yang telah
disimpan.

## Acceptance criteria

- [x] Tombol verifikasi menyimpan nota sebelum pengiriman invoice.
- [x] Invoice manual terkirim ke nomor WA valid dan tercatat sebagai aktivitas order.
- [x] PDF menampilkan ID Pesanan dan ID Produk/Paket per item.
- [x] Pemilihan produk/paket memakai harga online positif, lalu harga toko positif.
- [x] Regression test service/endpoint dan build frontend lulus.

## Hasil

2026-08-10: UI menambahkan **Simpan & Verifikasi Nota** dan **Kirim Invoice
WA**. Tombol kirim menyimpan nota lebih dahulu, lalu memanggil endpoint baru
berizin kasir. PDF invoice memuat nomor pesanan/tracking, ID item pesanan, dan
ID produk/paket jika terhubung ke katalog. Harga produk/paket kini memilih nilai
positif: online terlebih dahulu, lalu harga toko/offline; string API `"0.00"`
tidak lagi menghentikan fallback. Tes Django `api.tests_order_invoice_whatsapp`
5/5 dan build Vite lulus. Deploy VPS selesai dengan backup
`/opt/bintang/deploy/backups/20260810-093946-wa-invoice`; health, import
endpoint, bundle frontend, dan route tanpa autentikasi (401) terverifikasi.
Belum dilakukan pengiriman ke nomor pelanggan nyata; menunggu review independen.

## Verifikasi manager (2026-08-10) — tombol ada di kode, tapi user tidak menemukannya

User lapor tombol "Kirim Invoice WA" tidak ada, padahal sudah diminta ke Codex.
Kode ternyata SUDAH ada (dikonfirmasi identik dengan yang dideploy VPS), tapi
posisinya di sebelah tombol "Simpan & Verifikasi Nota" — di ATAS bagian
"Penerbitan SPK Produksi", bukan di bawahnya seperti diminta user. Kemungkinan
besar itu sebabnya user tidak melihatnya di lokasi yang diharapkan.
**Diperbaiki**: tombol dipindah jadi kartu aksi terpisah setelah kartu
"Penerbitan SPK Produksi" (di bagian paling bawah alur), dengan judul "Kirim
Invoice ke Pelanggan". Fungsinya tidak diubah (tetap simpan nota dulu via
`handleSaveOrderChanges({notify:false})` sebelum panggil endpoint invoice).
Build lulus, dideploy VPS bareng perbaikan T-720 (lihat catatan verifikasi
manager di [[T-720 Antrean WA Input Item Produk Katalog|T-720]]).
