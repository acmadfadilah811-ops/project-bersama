---
id: T-604
epik: "[[Production Readiness dan Integrasi Akuntansi]]"
status: review
agent: Antigravity
prioritas: tinggi
depends_on: [T-601, T-603]
created: 2026-07-28
---

# T-604 — Hubungkan Rekonsiliasi Bank ke Backend

*Implementasi oleh Antigravity. Status `review` = menunggu approval manager.*

---

## Scope & Implementation

Menghubungkan `RekonsiliasiBank.jsx` ke backend REST API (`GET /api/accounting/bank-reconciliation/` & `POST /api/accounting/bank-reconciliation/match/`).

1. **Pengambilan Data Akun & Transaksi Belum Rekonsiliasi**:
   - `GET /api/accounting/cash-bank-accounts/`: Mengambil daftar akun kas/bank aktual untuk selector dropdown.
   - `GET /api/accounting/bank-reconciliation/`: Memuat 2 himpunan transaksi yang belum direkonsiliasi: `unreconciled_bank_statement` dan `unreconciled_internal` berdasarkan akun & rentang tanggal (`date_from`, `date_to`).
2. **Side-by-Side Matching Panel**:
   - Panel kiri menyajikan transaksi Bank Statement (`Pending`).
   - Panel kanan menyajikan transaksi Jurnal Buku Besar Internal.
   - Memilih 1 baris dari kiri dan 1 baris dari kanan mengaktifkan tombol **"Cocokkan & Rekonsiliasi"**.
3. **Eksekusi Match**:
   - `POST /api/accounting/bank-reconciliation/match/`: Mengirim `{ bank_statement_line, journal_entry_line }` untuk menandai status `RECONCILED` di backend dan memicu pembaruan otomatis list.
4. **Verifikasi Build**:
   - `npm run build` lulus 100% (2.46s).

---

## Acceptance Criteria

- [x] `RekonsiliasiBank.jsx` terhubung 100% ke backend REST API.
- [x] Pilihan akun kas/bank terhubung ke COA backend.
- [x] Dua panel pencocokan menyajikan data `unreconciled_bank_statement` & `unreconciled_internal`.
- [x] Eksekusi pencocokan manual (`match/`) berfungsi lancar.
- [x] Build produksi frontend lulus 100%.
