---
id: T-713
epik: "[[Production Readiness dan Integrasi Akuntansi]]"
status: review
agent: Codex
prioritas: tinggi
depends_on: [T-710]
created: 2026-08-08
---

# T-713 - Penanda Administratif Pembayaran Pembelian

## Bukti akar masalah

Toggle pada banner detail Pembelian saat ini membuka modal Pengaturan
Pembayaran. Ini menyamakan penanda visual dengan pencatatan pembayaran nyata,
padahal operator memerlukan toggle hanya untuk mengubah teks `Belum Dibayar`
dan `Sudah Dibayar` tanpa mengisi akun maupun nominal.

## Keputusan user 2026-08-08

Toggle adalah penanda administratif yang tersimpan. Pengaturan Pembayaran
tetap menjadi satu-satunya jalur untuk membuat `PurchasePayment`, mengubah
`total_dibayar`/`payment_status`, dan menghasilkan jurnal pembayaran.

| Kondisi toggle | `payment_marked_paid` | pembayaran / `total_dibayar` | jurnal |
|---|---|---|---|
| Mati | `false` | tidak berubah | tidak dibuat |
| Aktif | `true` | tidak berubah | tidak dibuat |

## Scope

1. Tambahkan flag `Purchase.payment_marked_paid` dan migration additive dengan
   default `false` bagi dokumen lama.
2. Ubah endpoint workflow toggle agar mengubah flag secara atomik, memberi log
   audit, dan menolak dokumen non-draft/tanpa produk/yang sudah punya pembayaran
   nyata.
3. Ubah banner frontend agar memanggil endpoint itu dan menyegarkan detail,
   tanpa membuka modal pembayaran.
4. Tambahkan regression test bahwa toggle tidak membuat pembayaran maupun jurnal.

## Batas scope

- Tidak mengubah nominal total, jumlah terbayar, `payment_status`, atau jurnal.
- Tidak mengubah desain pembayaran nyata maupun guard pembatalan/retur.

## Konteks graph

`graphify query "PembelianDetail toggle payment PurchaseWorkflowView toggle_payment payment status"`
menautkan `PembelianDetail.jsx` ke `PurchaseWorkflowView.toggle_payment()`;
jalur pembayaran nyata tetap melalui endpoint pembelian dan model jurnal.

## Acceptance criteria

- [ ] Toggle tidak membuka Pengaturan Pembayaran.
- [ ] Toggle tersimpan setelah refresh dan hanya mengubah label banner.
- [ ] `total_dibayar` tetap 0 serta tidak ada `PurchasePayment`/jurnal baru.
- [ ] Authorization dan validasi workflow tetap server-side.
- [ ] `graphify update .` sudah dijalankan.

## Hasil

- `Purchase.payment_marked_paid` dan migration additive `api.0102` menyimpan
  penanda administratif dengan default `false` untuk pembelian lama.
- `POST /api/purchases/{id}/workflow/toggle-payment/` kini hanya membalik flag
  di dalam transaksi dan menulis audit log. Endpoint tidak membuat
  `PurchasePayment`, tidak mengubah `payment_status`/`total_dibayar`, dan tidak
  membuat jurnal. Pembelian dengan pembayaran nyata tetap harus diubah lewat
  Pengaturan Pembayaran.
- Banner `PembelianDetail` memanggil endpoint toggle lalu memuat ulang detail;
  modal Pengaturan Pembayaran hanya dibuka oleh aksi pembayaran pada ringkasan
  pesanan. Label berubah antara `Sudah Dibayar` dan `Belum Dibayar` tanpa
  memutasi nominal.
- Regression suite `api.tests_purchase_reception_receiver` lulus 14/14,
  `makemigrations --check --dry-run`, Django check, dan build frontend lulus.
  Migration diterapkan di local dan VPS. Backend/frontend VPS direcreate,
  Nginx valid, bundle frontend memuat marker toggle, dan `/api/health/`
  melaporkan database/cache `ok`.
