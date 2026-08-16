---
id: T-715
epik: "[[Production Readiness dan Integrasi Akuntansi]]"
status: review
agent: Codex
prioritas: tinggi
depends_on: []
created: 2026-08-08
---

# T-715 - Resi POS WhatsApp Otomatis

## Bukti akar masalah

`PaymentSuccessModal.jsx` hanya menyediakan tombol manual ke
`POST /api/pos/sales/{id}/whatsapp-resi/`. `POSSaleViewSet.create()` hanya
menyimpan hasil `create_sale()` sehingga pembayaran POS sukses tidak pernah
menjadwalkan pengiriman resi otomatis. Endpoint manual juga belum menyimpan
status pengiriman, sehingga retry browser dapat mengirim resi ganda.

## Keputusan arsitektur

| Opsi | Konsekuensi |
|---|---|
| Frontend memanggil endpoint ketika modal sukses muncul | Bergantung browser/koneksi kasir dan rentan duplikasi saat render/retry. |
| Server memanggil Evolution setelah commit pembayaran | Mengirim hanya untuk transaksi tersimpan; dapat diaudit/idempoten; dipilih. |
| Worker/queue baru | Lebih kuat untuk retry terjadwal, tetapi memerlukan operasi/dependency baru di luar task ini. |

Pengiriman otomatis menggunakan nomor `POSSale.pelanggan.nomor_wa` sebagai
sumber kebenaran. Callback dijalankan setelah commit karena jurnal dan stok
harus sukses lebih dulu. State persisten `pending/sent/failed/skipped` mencatat
hasil tanpa menyimpan isi resi. Pesan hanya dikirim untuk transaksi `paid`; tanpa
pelanggan/nomor valid state menjadi `skipped`. Endpoint manual yang ada memakai
service sama dan tetap dapat menjadi jalur kirim ulang yang eksplisit.

## Scope

1. Tambahkan status audit pengiriman resi WhatsApp ke `POSSale` dan migration
   additive.
2. Tambahkan service penyusun/pengirim resi dengan normalisasi nomor,
   idempotensi pengiriman otomatis, dan error aman.
3. Jadwalkan pengiriman setelah commit transaksi POS lunas; tidak mengubah
   hasil pembayaran/jurnal bila gateway gagal.
4. Gunakan service pada endpoint kirim resi manual dan tambah regression test.

## Batas scope

- Tidak mengirim jika pelanggan belum dipilih atau nomor WA tidak valid.
- Tidak menambah provider WhatsApp atau worker baru.
- Tidak mengirim ulang transaksi historis secara massal.
- Koneksi Evolution nyata harus tetap diuji dengan satu transaksi UAT setelah
  deployment; build/test bukan bukti pesan diterima di perangkat pelanggan.

## Acceptance criteria

- [ ] Pembayaran POS lunas dengan pelanggan bernomor WA menjadwalkan satu resi.
- [ ] Duplikasi callback tidak mengirim resi kedua setelah status `sent`.
- [ ] Gagal gateway tidak membatalkan transaksi/jurnal dan statusnya terukur.
- [ ] Endpoint manual tetap berfungsi sebagai kirim ulang.
- [ ] Test area terkait dan `graphify update .` lulus.

## Hasil

- `POSSale` memiliki status pengiriman resi WhatsApp (`pending`, `sending`,
  `sent`, `failed`, `skipped`), nomor tujuan snapshot, waktu sukses, dan pesan
  error aman. Migration additive: `api.0103`.
- Service `api/services/pos_receipt_whatsapp.py` menormalisasi nomor Indonesia,
  menyusun resi dari snapshot transaksi, dan hanya mengirim otomatis satu kali
  untuk sale yang sudah `paid`. Tanpa pelanggan/nomor valid status menjadi
  `skipped`; kegagalan gateway menjadi `failed`, tanpa membatalkan sale, stok,
  atau jurnal.
- `create_sale()` menjadwalkan service setelah commit jurnal POS. Endpoint
  `POST /api/pos/sales/{id}/whatsapp-resi/` tetap menjadi jalur kirim ulang
  eksplisit dan memakai service yang sama.
- `api.tests_pos_email_resi` lulus 8/8 dan `accounting.tests_pos_integration`
  lulus 6/6. Migration diterapkan lokal/VPS; Django check dan health API VPS
  melaporkan database/cache `ok`. Pengiriman ke perangkat WhatsApp nyata belum
  diuji agar tidak mengirim resi ke pelanggan tanpa transaksi/nomor UAT yang
  disetujui.
