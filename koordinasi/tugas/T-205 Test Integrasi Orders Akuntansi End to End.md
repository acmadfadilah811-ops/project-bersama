---
id: T-205
epik: "[[Integrasi Akuntansi-Orders]]"
status: done
agent: Claude (instruksi eksplisit user, 2026-08-01)
prioritas: tinggi
depends_on: [T-202, T-203, T-204]
created: 2026-08-01
---

# T-205 — Test Integrasi Orders-Akuntansi End-to-End

## Scope

Test integrasi end-to-end (pola T-106: APITestCase lewat HTTP nyata, bukan
fixture preset yang menyembunyikan bug resolusi) yang membuktikan seluruh
rantai Order→Akuntansi bekerja BENAR SECARA GABUNGAN, bukan cuma
masing-masing potongan (T-202/T-203/T-204) lulus terisolasi.

## File baru: `accounting/tests_order_integration_e2e.py`

`OrderAccountingEndToEndTestCase` — 2 test:

1. **`test_full_lifecycle_dp_pelunasan_overpay_guard_selesai_hpp`** — satu
   Order dari awal sampai selesai:
   - Order dengan diskon 10% (subtotal 500.000 → `total_harga` 450.000).
   - DP tunai 200.000 via `/bayar/` → jurnal D=K=200.000, baris pendapatan
     dikredit PERSIS 200.000 (bukan 500.000 kotor) — membuktikan diskon
     sudah netted sebelum posting (T-203 finding #2, bukan bug).
   - **Overpay 300.000 ditolak** (sisa cuma 250.000) → 400, `dp_dibayar`
     TIDAK berubah, TIDAK ada JournalEntry kedua (T-203 guard, dicek
     end-to-end lewat HTTP, bukan cuma unit test service).
   - Pelunasan tepat sisa 250.000 via QRIS (non-tunai) → sukses,
     `sisa_tagihan=0`, `settlement_status='unsettled'`.
   - **Rekonsiliasi lintas jurnal**: total baris pendapatan dari SEMUA
     `JournalEntry` `ORDER_PAYMENT` order ini = persis `total_harga`
     (450.000) — bukti tidak ada under/over-recognition setelah 2 kali
     bayar + 1 percobaan overpay yang ditolak.
   - Job + konsumsi bahan (5 unit @ Rp30.000) → `/selesaikan/` → jurnal
     HPP (T-204) D=K=150.000.
   - **Rekonsiliasi akhir**: gabungan 3 `JournalEntry` (DP + pelunasan +
     HPP) tetap balance sebagai satu kesatuan, grand total debit=kredit=
     Rp600.000 (200rb+250rb+150rb).
2. **`test_batalkan_after_dp_creates_balanced_reversal`** — Order dengan DP
   dibatalkan lewat `/batalkan/` → jurnal pembalik (T-207) benar-benar
   seimbang D=K=150.000, dicek dalam konteks lifecycle yang sama (bukan
   test T-207 yang terisolasi).

## Kenapa ini bukan sekadar duplikasi test yang sudah ada

Test per-fitur (`tests_order_posting.py`, `tests_order_reversal.py`,
`tests_order_hpp.py`) masing-masing menguji SATU mekanisme dengan fixture
minimal (kadang tanpa item nyata, tanpa diskon, tanpa kombinasi
DP+pelunasan+HPP dalam satu Order). Test ini sengaja mengombinasikan semua
tahap dalam SATU Order supaya kelas bug yang cuma muncul dari INTERAKSI
antar fitur (mis. diskon salah netted, overpay lolos di tengah siklus,
HPP dobel-hitung setelah 2x pembayaran) punya kesempatan terdeteksi —
persis pelajaran T-106 (hindari jebakan preset-fixture yang menyembunyikan
resolusi PaymentMethod yang salah).

## Verifikasi

- `accounting.tests_order_integration_e2e`: 2/2 lulus.
- Full suite `accounting api`: 339/339 lulus, 0 regresi.
- Tidak ada migration baru (test murni, tidak ada perubahan model/service).

Status `done` — diimplementasikan dan diverifikasi test nyata di sesi yang
sama oleh Claude (manager), sesuai instruksi eksplisit user untuk
mempercepat penyelesaian backlog akuntansi hari ini.
