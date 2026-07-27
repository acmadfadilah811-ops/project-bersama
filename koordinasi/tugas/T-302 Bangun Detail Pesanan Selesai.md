---
id: T-302
epik: "[[Perbaikan Orders]]"
status: backlog
agent: 
prioritas: sedang
depends_on: []
created: 2026-07-27
---

# T-302 — Bangun "Detail Pesanan Selesai" (tab Selesai)

> ⏸️ **TUNGGU referensi visual dari user** (screenshot/contoh tampilan, kemungkinan dari Olsera) sebelum mulai membangun. Bagian "Konten (default pragmatis)" di bawah ini HANYA fallback kalau referensi belum ada — begitu user kirim contoh, itu yang jadi acuan utama, bukan daftar di bawah. Jangan klaim task ini sebelum referensi masuk (cek [[Agent Board]]/note ini untuk update).
>
> **Verifikasi hasil dilakukan user sendiri lewat browser** — bukan lewat automated test visual. Setelah build, status `review`, tunggu konfirmasi user sebelum manager approve `done`.

## Scope

Saat ini tab **Selesai** di `Transaksi → Penjualan` memakai `OrderDetail.jsx` yang sama dengan tab Butuh Diproses (`Penjualan.jsx:160-171`, `setView('detail')`). Buat tampilan detail KHUSUS untuk order berstatus selesai — referensi: Olsera "Detail Pesanan Selesai".

## Ikuti pola yang SUDAH ADA — jangan bangun dari nol (koreksi 2026-07-27)

Manager sempat kira `OrderDetail.jsx` murni generik. Ternyata sudah ada preseden yang benar: untuk status `batal`, `OrderDetail.jsx` (baris 94-106) mendelegasikan ke komponen terpisah `CancelledOrderDetail.jsx` yang **memakai ulang** `OrderHeader.jsx` (sudah ada, dipakai bersama). **Ikuti pola identik ini untuk status `selesai`**:
1. Baca `OrderDetail.jsx`, `CancelledOrderDetail.jsx`, dan sub-komponen yang dipakai (`OrderHeader.jsx`, `CustomerCard.jsx`, `ShippingCard.jsx`, `PaymentCard.jsx`, `OrderLogSection.jsx`) dulu — semua di `features/transaksi/components/`, semua ukuran wajar (180-285 baris).
2. Buat `SelesaiOrderDetail.jsx` (nama menyesuaikan konvensi `CancelledOrderDetail.jsx`) — komponen tipis yang MEMAKAI ULANG card-card yang sudah ada (mode read-only sesuai kebutuhan), bukan menulis ulang tabel item/customer card dari nol.
3. Di `OrderDetail.jsx`, tambah cabang serupa baris 94 tapi untuk `order.status_global === 'selesai'` → delegasikan ke `SelesaiOrderDetail`.

## Konten (default pragmatis — REVISI kalau user kirim referensi Olsera)

Read-only/ringkasan (bukan form edit aktif — order sudah selesai):
- Info pesanan (No, tanggal, pelanggan, item, total, metode bayar) — via card yang sudah ada
- Status pembayaran final (lunas/sisa — sisa tagihan di order "selesai" itu anomali, tampilkan mencolok)
- Riwayat proses (`OrderLogSection` yang sudah ada, read-only)
- Aksi yang masuk akal: cetak invoice/struk, mulai proses retur — **jangan** aksi yang cuma relevan order aktif

## Rambu

- **Jangan bikin file baru yang menduplikasi `CustomerCard`/`ShippingCard`/`PaymentCard`/`OrderLogSection`** — pakai ulang persis seperti `CancelledOrderDetail.jsx` melakukannya (L4).
- Backend: jangan bikin endpoint baru kalau `GET /orders/:id/` sudah cukup (F2).
- ⚠️ Card-card yang dipakai ulang (`CustomerCard`, `ShippingCard`, `PaymentCard`) saat ini membaca `metadata` yang berasal dari hack JSON-di-`catatan_pelanggan` (lihat [[T-209 Bangun schema Order metadata]]). Task ini TIDAK perlu menunggu T-209 selesai — cukup pakai prop `metadata` apa adanya (interface sudah stabil); kalau T-209 lebih dulu selesai, sumber datanya akan berubah transparan tanpa task ini perlu diubah.

## Setelah selesai

Kalau order "selesai" ke depan mau ada aksi yang menyentuh akuntansi (misal cetak ulang bukti bayar, lihat status jurnal) — itu nunggu [[T-207]] (Epik Integrasi Akuntansi-Orders), jangan diaduk di sini (U1).

## Acceptance criteria

- [ ] Klik order di tab Selesai → tampilan detail baru, bukan `OrderDetail.jsx` generik lama
- [ ] User sudah cek di browser & konfirmasi kontennya sesuai kebutuhan (kalau belum sesuai, dicatat sebagai revisi di Hasil, bukan dianggap gagal)
- [ ] `npm run build` sukses
- [ ] File baru ≤ 300 baris (L5) — kalau butuh lebih, pecah ke sub-komponen

## Hasil

*(diisi saat dikerjakan)*
