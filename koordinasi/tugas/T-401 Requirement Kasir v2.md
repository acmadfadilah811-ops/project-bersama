---
id: T-401
epik: "[[Revisi UI Kasir v2]]"
status: backlog
agent: 
prioritas: tinggi
depends_on: []
created: 2026-07-27
---

# T-401 — Inventarisasi Fitur & Requirement Kasir v2

## Scope

Mengubah "kasir mau direvisi, ada fitur yang belum dibuat" menjadi daftar requirement konkret. Tanpa ini, T-402 (desain) tidak boleh jalan — agent dilarang mengarang fitur (B1/F1).

## A. Dari user — WAJIB diisi dulu

> ❓ **[USER — isi]** Layar mana yang dimaksud "tampilan kasir"?
> - [ ] POS retail / kasir toko (`PointOfSale.jsx` — layar jual cepat, keranjang, bayar)
> - [ ] Aplikasi kasir pesanan (`KasirApp.jsx` — antrean order/WA, buat pesanan, invoice)
> - [ ] Keduanya

> ❓ **[USER — isi]** Daftar fitur yang **belum ada** dan mau dibuat di v2 (tulis bebas, satu baris satu fitur):
> - …

> ❓ **[USER — isi]** Yang paling mengganggu di tampilan sekarang (keluhan UX, alur yang lambat, dsb.):
> - …

## B. Dari audit (executor, setelah bagian A terisi)

- `graphify explain "PointOfSale"` + `graphify explain "KasirApp"` — peta komponen & alur data sekarang
- Inventaris fitur backend yang SUDAH ada tapi belum muncul di UI kasir (kupon/promo via `promo_engine`, loyalty redeem/earn, split bill, UOM/multi-satuan, PassKey verifikasi aksi sensitif, mode stok POS, antrean device `POSAntrianDevice`) — bandingkan dengan daftar user
- Catat semua endpoint yang dipakai layar kasir sekarang (dari kode + skema drf-spectacular) sebagai baseline kontrak

## Acceptance criteria

- [ ] Bagian A terisi oleh user (kalau kosong → tanya, jangan lanjut)
- [ ] Matriks fitur: sudah ada di UI / ada di backend belum di UI / belum ada sama sekali (butuh task backend baru)
- [ ] Daftar baseline endpoint kasir terdokumentasi
- [ ] Output diserahkan ke manager untuk T-402 (desain arsitektur v2)

## Hasil

*(diisi setelah dikerjakan)*
