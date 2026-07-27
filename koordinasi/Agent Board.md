---
tags: [koordinasi, board]
created: 2026-07-27
---

# 🎛️ Agent Board — Pusat Koordinasi

Satu-satunya papan status untuk semua pekerjaan agent. Cara pakai ada di [[Protokol Agent]]. Detail scope per area ada di note epik masing-masing.

> **Prioritas saat ini (2026-07-27):**
> 1. ✅ **T-103 DONE** (approved manager, 2 revisi tuntas, 7/7 test + regression check bersih). **T-104/T-105/T-106/T-107 sekarang siap diklaim** (dependency lepas).
> 2. **T-501 SIAP DIKLAIM, prioritas tinggi** — bug navigasi Buku Besar (temuan user langsung dari pemakaian app). Manager sudah tulis hipotesis root cause + file yang benar; executor wajib reproduksi dulu (B1) sebelum fix.
> 3. **T-201** siap diklaim (verifikasi Order→jurnal, read-only).
> 4. **T-108** siap diklaim (3 test pre-existing, tidak terkait T-103, tidak mendesak).
> 5. Menunggu **input user**: [[T-301 Inventarisasi masalah Orders|T-301]] (masalah orders lain, kalau ada) & [[T-401 Requirement Kasir v2|T-401]] bagian A (fitur kasir v2).
> 6. **T-302 & T-303 DITAHAN** (keputusan user 2026-07-27) — perbaikan UI ditunda dulu, fokus ke backend (T-208, T-210). Jangan diklaim sampai user angkat lagi.
> 7. **🎉 Fondasi backend Orders TUNTAS**: T-208, T-209, T-210 semua `done` & approved. Hack `catatan_pelanggan` resmi pensiun untuk data baru.
> 8. **T-201 done (manager) — temuan penting**: Order 100% belum terhubung ke `accounting.JournalEntry` (persis pola POS sebelum T-102/103). `DaftarPiutang.jsx` ternyata mock data, bukan risiko dual-source. **T-207 TIDAK BISA jalan sebelum T-202** (tidak ada jurnal asli untuk dibalik) — urutan direvisi: **T-202 sekarang prioritas**, T-207 depends T-202.
> 9. **T-202 desain APPROVED manager (2026-07-27)**, verifikasi independen ke kode bersih — implementasi boleh mulai (Antigravity). Keputusan: akun pendapatan Order (`order_sales_revenue_account`) **terpisah** dari akun POS, wajib `help_text` pembeda; piutang cash-basis (bukan accrual) untuk v1.

## Epik 1 — [[Integrasi Akuntansi-POS]]

| ID | Task | Status | Agent | Prioritas | Depends on |
|---|---|---|---|---|---|
| [[T-101 Verifikasi jembatan POS-Akuntansi\|T-101]] | Verifikasi jembatan POS→Akuntansi yang sudah ada | `done` | Claude Code | tinggi | — |
| [[T-102 Desain mapping POS-Jurnal\|T-102]] | Desain mapping transaksi POS → jurnal (tunai, non-tunai, PPN, gating, idempotency) | `done` ✅ approved | Claude (manager) | tinggi | T-101 |
| [[T-103 Implementasi posting POS-Jurnal\|T-103]] | Implementasi posting POSSale → JournalEntry sesuai desain T-102 | `done` ✅ | Antigravity | tinggi | T-102 |
| T-104 | **[SIAP DIKLAIM]** Void/retur POS → jurnal pembalik + guard `settlement_status` saat void | `backlog` | — | sedang | — |
| T-105 | **[SIAP DIKLAIM]** Rekonsiliasi shift vs jurnal + indikator sale `paid` yang belum terposting | `backlog` | — | sedang | — |
| T-106 | **[SIAP DIKLAIM]** Test integrasi POS-akuntansi end-to-end | `backlog` | — | tinggi | — |
| T-107 | HPP penjualan POS → jurnal (D HPP / K Persediaan) | `backlog` | — | sedang | T-206 |

## Epik 2 — [[Integrasi Akuntansi-Orders]]

| ID | Task | Status | Agent | Prioritas | Depends on |
|---|---|---|---|---|---|
| [[T-201 Verifikasi alur Order-Jurnal\|T-201]] | ✅ Verifikasi alur Order→Jurnal — **done** (manager). Order 100% belum terhubung ke `accounting.JournalEntry`; `DaftarPiutang.jsx` ternyata mock data (bukan dual-source) | `done` ✅ | Claude (manager) | tinggi | — |
| [[T-202 Posting Order ke Jurnal\|T-202]] | **[DIKEMBALIKAN — FIX DIPERLUKAN]** Implementasi ditolak manager: `Order.accounting_payment_method` tidak pernah di-resolve dari `metode_pembayaran` (beda dari POS di `pos_services.py`) — posting akan selalu skip di produksi. Lihat §Review Manager di note task | `in_progress` | Antigravity | **tinggi** | — |
| T-203 | Edge case DP/pelunasan: diskon, kupon, pembulatan | `backlog` | — | sedang | T-202 |
| T-204 | HPP order (bahan baku via JobBoard) → jurnal HPP — `production_costing.py` sudah ada kalkulasinya | `backlog` | — | sedang | T-202 |
| T-205 | Test integrasi Orders-akuntansi end-to-end | `backlog` | — | tinggi | T-202, T-203, T-204 |
| T-206 | Migrasi ledger legacy `hr.TransaksiBukuBesar` → `accounting.JournalEntry`, pensiunkan legacy | `backlog` | — | **tinggi** | T-202 |
| T-207 | Jurnal pembalik untuk transisi Dibatalkan & Pengembalian — hook di endpoint `batalkan`/`retur` yang sudah ada | `backlog` | — | sedang | **T-202** |
| [[T-208 Bangun model Return\|T-208]] | ✅ Model `PengembalianOrder`, migration, backfill, API GET/PATCH **APPROVED & done** | `done` ✅ | Antigravity | sedang | — |

## Epik 3 — [[Perbaikan Orders]]

| ID | Task | Status | Agent | Prioritas | Depends on |
|---|---|---|---|---|---|
| [[T-301 Inventarisasi masalah Orders\|T-301]] | Inventarisasi masalah di modul Orders (temuan #1 masuk: 4 tab Penjualan butuh detail masing-masing; masih menunggu temuan lain) | `backlog` | — | tinggi | — |
| [[T-209 Bangun schema Order metadata\|T-209]] | ✅ 10 field metadata Indonesia, migration, backfill, frontend **APPROVED & done** | `done` ✅ | Antigravity | **tinggi** | — |
| [[T-210 Endpoint aksi status Order\|T-210]] | ✅ Selesaikan, Batalkan, Retur — **SEMUA APPROVED & done** (15/15 test, 0 regresi, build verified) | `done` ✅ | Antigravity | **tinggi** | T-208 ✅ |
| [[T-302 Bangun Detail Pesanan Selesai\|T-302]] | ⏸️ **[TUNGGU REFERENSI VISUAL USER]** Bangun Detail Pesanan Selesai — ikuti pola `CancelledOrderDetail.jsx` (reuse card, jangan dari nol) | `backlog` | — | sedang | — |
| [[T-303 Bangun Detail Pesanan Dibatalkan\|T-303]] | ⏸️ **[TUNGGU REFERENSI VISUAL USER]** Audit & poles Detail Pesanan Dibatalkan (⚠️ SUDAH ADA sebagai `CancelledOrderDetail.jsx`, bukan bangun baru) | `backlog` | — | sedang | — |
| ~~T-304~~ | ❌ Dibatalkan — premis salah, `OrderDetail.jsx` sudah rapi; masalah sesungguhnya di schema data (→ T-209) | `dibatalkan` | — | — | — |

## Epik 4 — [[Revisi UI Kasir v2]]

| ID | Task | Status | Agent | Prioritas | Depends on |
|---|---|---|---|---|---|
| [[T-401 Requirement Kasir v2\|T-401]] | Inventarisasi fitur & requirement kasir v2 | `backlog` | — | tinggi | **input user** |
| T-402 | Desain arsitektur v2 (peta layar, struktur `features/pos/`, rencana replacement) | `backlog` | — | tinggi | T-401 |
| T-403+ | Implementasi per layar (dipecah dari T-402) | — | — | — | T-402 |

## Epik 5 — [[Bug QA Manual]]

| ID | Task | Status | Agent | Prioritas | Depends on |
|---|---|---|---|---|---|
| [[T-501 Bug navigasi Buku Besar\|T-501]] | Bug navigasi Buku Besar — klik akun/ikon dokumen kembali ke daftar akun | `done` ✅ | Antigravity | tinggi | — |
| [[T-502 Decouple klik akun dan pola hide_sidebar\|T-502]] | Decouple klik teks akun dari ikon dokumen + perbaiki bug `hide_sidebar` identik di ListKasBank.jsx & JurnalUmum.jsx | `done` ✅ | Antigravity | sedang | — |
| [[T-108 Perbaiki test pre-existing\|T-108]] | Perbaiki 3 test pre-existing yang gagal (ditemukan saat review T-103, bukan regresi) | `backlog` | — | sedang | — |

## Selesai

| ID | Task | Agent | Tanggal |
|---|---|---|---|
| T-101 | Verifikasi jembatan POS→Akuntansi (hasil: POS tidak pernah dijurnal; ditemukan 2 ledger paralel → T-206) | Claude Code | 2026-07-27 |
| T-102 | Desain mapping POS→Jurnal (approved user, tanpa revisi) | Claude (manager) | 2026-07-27 |
| T-103 | Implementasi posting POS→Jurnal (2 revisi tuntas: gating PPN, is_cash otoritatif; 7/7 test; 0 regresi baru) | Antigravity | 2026-07-27 |
| T-501 | Bug navigasi Buku Besar — hipotesis manager (race condition `useSearchParams`) terbukti 100%, fix minimal & bersih, build verified | Antigravity | 2026-07-27 |
| T-502 | Decouple klik teks akun dari ikon dokumen + fix `hide_sidebar` di ListKasBank.jsx & JurnalUmum.jsx (audit B1 dikonfirmasi manager, tidak ada redundansi di keduanya) | Antigravity | 2026-07-27 |
| T-208 | Model `PengembalianOrder` (FK), migration, backfill idempotent, API GET/PATCH — desain 2 revisi, implementasi bersih | Antigravity | 2026-07-27 |
| T-209 | 10 field metadata Order berbahasa Indonesia, ganti hack JSON-di-catatan_pelanggan, `pos_staff`→`dilayani_oleh` | Antigravity | 2026-07-27 |
| T-210 | Endpoint dedicated Selesaikan/Batalkan/Retur — celah otorisasi ditemukan & diperbaiki, kardinalitas FK diuji eksplisit, 15/15 test | Antigravity | 2026-07-27 |
| T-201 | Verifikasi alur Order→Jurnal (hasil: 100% belum terhubung, sama pola POS; DaftarPiutang.jsx ternyata mock data; T-207 butuh T-202 duluan) | Claude (manager) | 2026-07-27 |

---

**Catatan penataan ulang board**: task T-1xx/T-2xx selain verifikasi masih *draft* — angka dan scope-nya boleh direvisi setelah T-101/T-201 selesai. Jangan tambah task implementasi baru sebelum task verifikasi epiknya selesai.
