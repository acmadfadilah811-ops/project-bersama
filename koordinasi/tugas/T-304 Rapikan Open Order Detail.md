---
id: T-304
epik: "[[Perbaikan Orders]]"
status: dibatalkan
agent: 
prioritas: rendah
depends_on: [T-302, T-303]
created: 2026-07-27
---

> ❌ **DIBATALKAN 2026-07-27** — premis task ini salah. Investigasi manager menemukan `OrderDetail.jsx` dan sub-komponennya sudah cukup rapi (180-285 baris, sudah dipecah jadi `OrderHeader`/`CustomerCard`/`ShippingCard`/`PaymentCard`/`OrderLogSection`), dan "Dibatalkan" TERNYATA sudah punya `CancelledOrderDetail.jsx` sendiri (bukan berbagi dengan Butuh Diproses seperti dikira). Masalah arsitektur sesungguhnya ada di schema data (`catatan_pelanggan` overloaded), bukan pemecahan komponen React — lihat [[T-209 Bangun schema Order metadata]].

# T-304 — ~~Rapikan "Open Order Detail"~~ (dibatalkan, lihat catatan di atas)

## Scope

Setelah [[T-302 Bangun Detail Pesanan Selesai]] dan [[T-303 Bangun Detail Pesanan Dibatalkan]] selesai, `OrderDetail.jsx` (`features/transaksi/components/OrderDetail.jsx`) seharusnya hanya perlu melayani satu kasus: tab **Butuh Diproses** ("Open Order Detail" di Olsera).

## Kerjaan

1. Cek apakah `OrderDetail.jsx` punya logic/kondisional yang sebelumnya menangani kasus "selesai" atau "dibatalkan" (menyesuaikan status_global) — kalau ada, hapus/sederhanakan sekarang karena sudah ditangani T-302/T-303.
2. Update `Penjualan.jsx` supaya `setView('detail')` (baris 165) hanya dipakai dari tab Butuh Diproses; tab Selesai/Dibatalkan memanggil view baru dari T-302/T-303.
3. Ini juga titik yang pas untuk audit apa saja yang MASIH kurang di "Open Order Detail" sendiri (kalau ada keluhan spesifik dari user soal tampilan ini, cross-check di [[T-301 Inventarisasi masalah Orders]] bagian A).

## Acceptance criteria

- [ ] `Penjualan.jsx` merutekan 3 tab (Butuh Diproses/Selesai/Dibatalkan) ke 3 komponen detail yang benar
- [ ] `OrderDetail.jsx` tidak lagi punya logic mati/tidak terpakai untuk kasus selesai/dibatalkan
- [ ] Tidak ada file yang melebihi hard limit setelah cleanup
- [ ] `npm run build` sukses + regression check manual keempat tab

## Hasil

*(diisi saat dikerjakan)*
