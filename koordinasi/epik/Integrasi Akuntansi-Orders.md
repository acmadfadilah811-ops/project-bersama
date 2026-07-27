---
tags: [koordinasi, epik]
status: aktif
created: 2026-07-27
---

# Epik: Integrasi Akuntansi ↔ Orders

## Tujuan

Seluruh siklus keuangan pesanan (DP → pelunasan → piutang → HPP produksi) tercatat otomatis dan konsisten di Buku Besar.

## Kondisi awal (DIVERIFIKASI T-201, 2026-07-27)

Persis pola yang sama dengan POS sebelum T-102/T-103: **Order sama sekali belum terhubung ke `accounting.JournalEntry`.**

- ✅→❌ `record_payment_to_general_ledger()` (`api/views/orders.py:35`, dipanggil dari `bayar` baris 547 & `perform_create` baris 243) menulis **eksklusif ke ledger legacy** `hr.Akun`/`hr.TransaksiBukuBesar`. Nol koneksi ke `accounting.JournalEntry`. Akun hardcoded via `get_or_create` (`1-1000`/`1-1001`/`1-1002` aset, `4-1000` pendapatan) — di sistem yang salah, bukan `accounting.Account` (COA baru).
- ❌ Order jadi `selesai` (endpoint T-210 yang baru) — **tidak memicu posting apa pun**, cuma ubah status + activity log.
- ❌ **`DaftarPiutang.jsx` BUKAN dual-source-of-truth seperti dikira — ini mock data statis 501 baris, nol API call sama sekali** (`// Static mock data matching Screenshot 1`, baris 49). Piutang belum ditampilkan dari data asli apa pun.
- ✅ Idempotency payment (`idempotency_key`) melindungi ledger juga, bukan cuma payment update — dikonfirmasi di kode.
- ❌ `production_costing.py` — kalkulasi HPP murni untuk laporan, nol koneksi ke jurnal (legacy maupun baru).
- ✅ Diskon/kupon tidak bocor (nominal pembayaran sudah bersih via `update_totals()`), tapi tidak granular sebagai pos jurnal terpisah.

**Implikasi penting**: [[T-208 Bangun model Return]] & [[T-210 Endpoint aksi status Order]] (endpoint `batalkan`/`retur`) sudah `done`, tapi **T-207 (jurnal pembalik) belum bisa jalan** — tidak ada jurnal ASLI di ledger baru untuk dibalik. **T-202 harus duluan** (bangun posting Order→JournalEntry, mirip pola T-102/T-103 POS), baru T-207 masuk akal. Detail lengkap: [[T-201 Verifikasi alur Order-Jurnal]].

## Peta UI (dikonfirmasi manager, 2026-07-27 — dari laporan user)

User menunjuk area kerja konkret: **`bintang-react-frontend/src/features/transaksi/pages/Penjualan.jsx`** ("Transaksi → Penjualan"), 4 tab (`tabs`, baris 37-73):

| Tab | Kondisi (`match()`) | Makna akuntansi |
|---|---|---|
| Butuh Diproses | `status_global` bukan `selesai`/`batal`, bukan retur | Belum ada peristiwa keuangan baru (order aktif) |
| Selesai | `status_global === 'selesai'` | Kandidat titik pengakuan pendapatan/HPP final |
| Pengembalian | `catatan_pelanggan` mengandung marker `[PENGEMBALIAN - Tanggal: ..., Status: ..., Catatan: ...]` | Butuh jurnal pembalik (piutang/pendapatan berkurang) |
| Dibatalkan | `status_global === 'batal'` | Butuh jurnal pembalik kalau sudah ada DP/pembayaran tercatat |

⚠️ **Tech debt penting — SUDAH DIPUTUSKAN user 2026-07-27**: "Pengembalian" **bukan field/model asli** — cuma di-encode sebagai teks berpola di dalam `catatan_pelanggan` lalu di-regex-parse (`getReturnInfo()`, `Penjualan.jsx:12-35`). Keputusan: **bangun model Return yang layak** (bukan lanjutkan text-parsing) → [[T-208 Bangun model Return]].

**4 titik tulis ke backend** (via `apiClient`, dikonfirmasi grep — nol referensi akuntansi di seluruh folder `transaksi/`):
- `POST /orders/:id/bayar/` (`Penjualan.jsx:126`) — pembayaran, sudah di scope T-202
- `PATCH /orders/:id/` — dipanggil dari **3 tempat berbeda**: `Penjualan.jsx:292` (import status), `OrderDetail.jsx:53` (aksi di detail order), `ReturnOrderDetail.jsx:91` (submit retur) — kemungkinan besar transisi `selesai`/`batal`/penulisan marker retur terjadi lewat endpoint generik yang sama ini, bukan endpoint khusus per status.

## Non-goals

- Tidak mengubah alur status order (desain → proses → selesai) — hanya lapisan keuangannya.
- Tidak menggabungkan `CustomersPageLegacy` dan `CustomerSupplierApp` (bukan duplikat!).

## Risiko & rambu

- Jalur ini melewati **3 god nodes sekaligus**: `Order` (119), `Contact` (121), plus god file `api/views.py` — wajib extract-not-extend.
- Pembayaran order sudah punya **idempotency key** (audit Juli) — jurnal harus ikut idempotent.
- Diskon/kupon/pembulatan Rupiah sudah diperbaiki di audit — jangan sampai jurnal menghitung ulang dengan logika berbeda dari `promo_engine.py`.

## Task

Lihat status live di [[Agent Board]]. Backlog draft:

- [x] **T-201** — Verifikasi alur Order → Jurnal → [[T-201 Verifikasi alur Order-Jurnal]] ✅ **done** 2026-07-27 (manager). Hasil: Order 100% belum terhubung ke `accounting.JournalEntry`; `DaftarPiutang.jsx` ternyata mock data, bukan risiko dual-source; T-207 butuh T-202 duluan.
- [ ] **T-202 — PRIORITAS SEKARANG** — Bangun posting Order (DP/pelunasan) → `accounting.JournalEntry`, mirip pola T-102/T-103 (POS). Menggantikan `record_payment_to_general_ledger()` yang sekarang nulis ke ledger legacy. **Wajib desain dulu, approval manager (F1)** sebelum implementasi — termasuk mapping akun (pakai `accounting.Account`/COA, bukan hardcode `hr.Akun` baru), momen posting (saat `bayar`? saat `selesai`?), dan hook titik mana untuk T-207 nanti.
- [ ] **T-203** — Edge case: DP sebagian, diskon persen/nominal, kupon, pembulatan. Depends T-202.
- [ ] **T-204** — HPP order: konsumsi bahan (JobBoard/FIFO) → jurnal HPP saat order selesai. `production_costing.py` sudah ada kalkulasinya, tinggal disambungkan ke jurnal. Depends T-202.
- [ ] **T-205** — Test end-to-end. Depends T-202-T-204.
- [ ] **T-206** — Migrasi posting dari ledger legacy (`hr.Akun`/`TransaksiBukuBesar`) ke `accounting.JournalEntry`, lalu pensiunkan ledger legacy bertahap. Cakupan: pembayaran order (setelah T-202 ada penggantinya), inventory HPP/persediaan, production cost, `/api/finance/transaksi/`. *(Lahir dari temuan T-101.)* Depends T-202.
- [ ] **T-207** — Jurnal pembalik untuk transisi **Dibatalkan** & **Pengembalian**. **Depends T-202** (butuh jurnal asli dulu untuk dibalik — lihat temuan T-201) + [[T-208 Bangun model Return]] ✅ + [[T-210 Endpoint aksi status Order]] ✅ (hook di endpoint `batalkan`/`retur` yang sudah ada, bukan lagi PATCH lama). *(Lahir dari laporan user 2026-07-27.)*
- [x] **T-208** — Bangun model Return yang layak → [[T-208 Bangun model Return]] ✅ **done** 2026-07-27.
