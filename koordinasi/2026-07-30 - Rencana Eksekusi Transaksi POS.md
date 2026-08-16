---
tags: [koordinasi, pos, akuntansi, prioritas-hari-ini]
created: 2026-07-30
---

# Rencana Eksekusi Transaksi POS — 2026-07-30

## Tujuan hari ini

Menutup jalur Transaksi (POS) secara jujur: setiap submenu harus memiliki UI
yang pulih dan mengarah ke data/API nyata, atau secara eksplisit menyatakan
integrasi eksternal yang belum ada. Tidak ada data mock yang dipresentasikan
sebagai transaksi nyata.

## Opsi pembagian yang dipertimbangkan

1. **Bagi per layar secara vertikal** — cepat terlihat, tetapi kedua agent akan
   sama-sama menyentuh API, jurnal, dan halaman pusat; risiko konflik dan
   regresi finansial tinggi.
2. **Bagi per lapisan** — Codex menangani data/jurnal/test, Claude menangani
   UI dan pemulihan layar. Ini menjaga satu pemilik untuk kontrak finansial dan
   memungkinkan pekerjaan paralel pada file berbeda.

**Keputusan:** opsi 2. Aturan M2, M4, M5, M7, API1, dan T1-T3 tetap berlaku
untuk semua perubahan POS.

## Pembagian kerja

| Pemilik | Task | Submenu / keluaran | Batas aman |
|---|---|---|---|
| Codex | [[T-618]] | Penjualan di Toko: daftar sumber asli, post/post pembayaran, batal post, log transaksi, pengaturan auto-post, serta API/integration test. | Satu jalur jurnal `create_journal_entry()`, idempoten, reversal; tidak mengubah UI submenu milik Claude. |
| Claude | [[T-619]] | 12 submenu: Penjualan Marketplace; Pembelian; Return Pembelian/Penjualan; Stok Masuk/Keluar/Produksi/Opname; Pendapatan; Data Pengeluaran; Komisi Penjualan; Biaya MDR. | Frontend saja. API belum tersedia harus ditampilkan sebagai belum terintegrasi, bukan mock. Jangan mengubah alur T-608/T-617 yang sedang review. |
| Codex | Final integration gate | Cek route, permission, response nyata, test API, lint/build, dan review independent hasil T-619. | Hanya manager yang mengubah status `review` menjadi `done`. |

## Urutan kerja hari ini

1. **Paralel sekarang:** Codex menutup test/edge case T-618; Claude memulihkan
   UI dalam T-619 berdasarkan route yang telah ada.
2. **Handoff:** Claude berhenti di `review` dengan matriks 12 layar, file
   berubah, API yang dipakai, dan bukti lint/build.
3. **Gate Codex:** uji kontrak nyata dan visual per layar yang diubah. Layar
   marketplace tetap `belum terintegrasi` sampai konektor/credential resmi
   tersedia; itu bukan alasan membuat data fiktif.
4. **Penutupan:** update graph dan Board. Status `done` hanya setelah review
   independen, bukan karena build lulus.

## Risiko terbuka

- [[T-608]], [[T-613]], dan [[T-617]] masih `review`; temuan bisnis pada area
  tersebut tidak boleh di-fix sambil lalu.
- Integrasi marketplace tidak dapat dinyatakan live tanpa kontrak dan akses
  ke penyedia marketplace.
- “Selesai hari ini” berarti scope UI/API yang dapat diverifikasi lokal;
  bukan approval production atau pengganti UAT finansial/VPS.
