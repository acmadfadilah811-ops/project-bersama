---
tags: [koordinasi, epik]
status: aktif
created: 2026-07-27
---

# Epik: Integrasi Akuntansi ↔ POS

## Tujuan

Setiap transaksi kasir POS (penjualan tunai/non-tunai, void, retur, tutup shift) otomatis menghasilkan jurnal double-entry yang benar di modul Akuntansi Internal — tanpa input manual.

## Kondisi awal (diverifikasi T-101, 2026-07-27)

Kesimpulan: **user benar — penjualan POS tidak pernah tercatat ke buku besar.** Yang ada baru infrastruktur (enum SourceType, mapping PaymentMethod→Account, settlement non-tunai). Detail + bukti file:baris di [[T-101 Verifikasi jembatan POS-Akuntansi]].

- ✅ `services/settlement.py` — settlement non-tunai POSSale+Order → JournalEntry, jalan. ⚠️ Tapi mengkredit akun transit yang tidak pernah didebit siapa pun (jurnal sisi penjualan tidak ada) → pendapatan POS tak pernah tercatat.
- ✅ `create_journal_entry()` — generik, satu pintu, siap dipakai ulang. `SourceType.POS_SALE` + index idempotency sudah disiapkan tapi belum ada pemakainya.
- ✅ Mapping `PaymentMethod` → `Account` (+ MDR) lengkap; `POSSale`/`Order` sudah punya FK `accounting_payment_method` (migration 0086).
- ❌ `SaldoKasHarian` / `RingkasanShift` — berhenti di rekap POS, tidak nyambung ke ledger mana pun.
- ❌ `void_sale()` — tanpa jurnal pembalik; dugaan bug: sale void bisa ikut ter-settle (cek di T-104).
- ‼️ Temuan lintas-epik: ada **ledger legacy `hr.TransaksiBukuBesar`** yang masih dipakai pembayaran order & inventory → [[Integrasi Akuntansi-Orders]] (T-206).

## Non-goals

- Tidak menyentuh mesin loyalty (`pos_services.py`) kecuali nilai diskon poin harus masuk jurnal.
- Tidak redesign UI kasir — murni lapisan pencatatan.

## Risiko & rambu

- `Order` (119 edges) dan god file `api/views.py` ada di jalur ini — patuhi aturan extract-not-extend.
- Posting jurnal harus **atomic bersama transaksi POS** (ikut pola row-lock + rollback yang sudah dipasang audit security).
- Idempotency: transaksi yang sama tidak boleh menghasilkan jurnal dobel (pembayaran order sudah punya idempotency key — pakai pola yang sama).

## Task

Lihat status live di [[Agent Board]].

- [x] **T-101** — Verifikasi jembatan yang sudah ada → [[T-101 Verifikasi jembatan POS-Akuntansi]] ✅ 2026-07-27
- [x] **T-102** — Desain mapping transaksi → jurnal → [[T-102 Desain mapping POS-Jurnal]] ✅ approved user 2026-07-27
- [x] **T-103** — Implementasi sesuai desain T-102 ✅ **done** 2026-07-27 (Antigravity, 2 revisi tuntas setelah review manager: gating PPN, `is_cash` otoritatif). 7/7 test + full regression check bersih.
- [ ] **T-104** — Void/retur POS → jurnal pembalik (`reversed_entry`) + guard `settlement_status` saat void.
- [ ] **T-105** — Rekonsiliasi shift vs jurnal + indikator sale `paid` belum terposting + UI pengaturan akun POS.
- [ ] **T-106** — Test end-to-end (ikut pola `IntegrasiPOSTestCase` yang sudah ada).
- [ ] **T-107** — HPP penjualan POS → jurnal (menunggu strategi T-206; sampai itu, L/R ledger baru = omzet tanpa HPP POS).
