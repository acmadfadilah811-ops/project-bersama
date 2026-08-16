---
id: T-726
epik: "[[Production Readiness dan Integrasi Akuntansi]]"
status: review
agent: Codex
prioritas: tinggi
depends_on: []
created: 2026-08-12
---

# T-726 — Kategori dan Opsi Interaktif Bot WhatsApp

## Scope

Respons katalog bot WhatsApp menampilkan kategori produk aktif, bukan seluruh
produk/paket. Setelah daftar kategori, pelanggan mendapat tiga quick reply:
Order, Tanya Detail, dan Lainnya.

## Keputusan arsitektur

| Opsi | Konsekuensi |
|---|---|
| Kategori dijadikan tombol dinamis | Tidak dipilih; quick reply WhatsApp dibatasi tiga dan jumlah kategori dapat berubah. |
| Kategori sebagai teks, tindakan sebagai tiga quick reply | Dipilih; memakai mekanisme tombol Evolution yang sudah ada dan menjaga daftar kategori lengkap. |
| Interactive list baru | Tidak dipilih; menambah kontrak gateway baru padahal kebutuhan cukup dengan quick reply yang sudah teruji. |

Fallback teks dan kompatibilitas ID tombol lama dipertahankan. Tidak ada
perubahan harga, order, pembayaran, jurnal, stok, endpoint, atau schema.

## Acceptance criteria

- [x] Daftar katalog hanya memuat ProductCategory aktif dan mengikuti urutan.
- [x] Nama produk, paket, dan harga tidak muncul pada daftar awal.
- [x] Respons katalog ditandai untuk dikirim sebagai tiga quick reply tindakan.
- [x] Tap Order, Tanya Detail, dan Lainnya masuk ke respons rule-based yang sesuai.
- [x] Regression test WA lulus.

## Hasil

Perubahan ada di api/wa_logic.py dan api/tests_wa_logic.py. Test WA 45/45
lulus. Dua file dibackup dan dideploy ke VPS; backend healthy, health Nginx dan
backend langsung HTTP 200. Sanity runtime menemukan 34 kategori dan tiga ID
tombol. Tidak ada pesan WA nyata yang dikirim.
