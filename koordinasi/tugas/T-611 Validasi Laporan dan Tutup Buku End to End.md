---
id: T-611
epik: "[[Production Readiness dan Integrasi Akuntansi]]"
status: done
agent: Claude (instruksi eksplisit user, 2026-08-01)
prioritas: tinggi
depends_on: [T-601, T-206]
created: 2026-08-01
---

# T-611 — Validasi Laporan dan Tutup Buku End-to-End

## Scope

Setiap laporan (Neraca T-627, Laba Rugi T-626, Arus Kas T-628, Perubahan
Modal, Tutup Buku T-612/T-629) sudah punya test sendiri yang lulus
terisolasi. T-611 memvalidasi bahwa SEMUA laporan itu **saling
konsisten** ketika dihitung dari kumpulan jurnal nyata yang sama, dan
bahwa Tutup Buku benar-benar memblokir posting baru tanpa merusak angka
yang sudah dilaporkan.

## File baru: `accounting/tests_reports_close_period_e2e.py`

`ReportsAndClosePeriodEndToEndTestCase::test_reports_reconcile_and_close_period_blocks_new_posting`
— satu skenario:

1. Modal awal (bulan sebelumnya): Kas 1.000.000 + Persediaan 500.000,
   Modal 1.500.000 (persediaan butuh saldo awal supaya HPP tidak membuat
   akun itu negatif — lihat catatan bug tes di bawah).
2. POS sale (reuse mekanisme T-107 langsung): 1 unit produk, D Kas 25.000
   / K Pendapatan 25.000, plus D HPP 10.000 / K Persediaan 10.000.
3. Order payment (T-202): D Kas 150.000 / K Pendapatan 150.000.
4. **Sebelum tutup buku** — cross-check:
   - Neraca: `total_aset == total_kewajiban_modal` (invarian dasar).
   - Laba Rugi: `subtotal_pendapatan=175.000`, `subtotal_hpp=10.000`,
     `laba_bersih=165.000`.
   - Perubahan Modal: `modal_awal=1.500.000`, `total_laba` PERSIS sama
     dengan `laba_bersih` Laba Rugi (dua fungsi laporan berbeda, sumber
     data sama, harus konsisten).
   - Arus Kas: `saldo_kas_akhir` PERSIS sama dengan saldo riil akun Kas
     dari `get_account_balances()` (ledger langsung, bukan cuma
     dihitung ulang dengan rumus yang sama).
   - Baris "Pendapatan periode ini" di Neraca = `laba_bersih` Laba Rugi.
5. Tutup buku periode berjalan (`close_accounting_period`).
6. Percobaan posting jurnal baru ke tanggal dalam periode yang sudah
   closed → `ValidationError` (guard `create_journal_entry` aktif
   otomatis, desain T-612 poin 1).
7. **Setelah tutup buku** — Neraca dipanggil ulang: `total_aset` dan
   `total_kewajiban_modal` PERSIS sama dengan sebelum tutup buku (dan
   tetap balance) — percobaan post yang ditolak tidak meninggalkan efek
   samping apa pun.

## Bug ditemukan & diperbaiki SAAT MENULIS test ini (bukan di kode produksi)

Draft awal test gagal 2 kali sebelum benar — dicatat karena instruktif:

1. **Lupa set `Account.account_type`** — field ini terpisah dari
   `AccountClassification.account_type` (dan tidak auto-derive
   dari classification). `_income_statement_section()` membaca
   `account.account_type == "revenue"` langsung untuk menentukan arah
   (`kredit-debit` vs `debit-kredit`); tanpa itu, Pendapatan ikut arah
   default (debit-kredit) dan laba jadi -185.000 alih-alih +165.000.
   Fixture test lain (`tests_pos_posting.py` dkk) tidak kena masalah ini
   karena mereka cuma cek baris jurnal langsung, tidak memanggil
   `get_income_statement`.
2. **Persediaan tanpa saldo awal** — tutup buku ditolak (BENAR, ini guard
   T-629 bekerja: "saldo akun negatif diblokir") karena Persediaan
   langsung dikredit -10.000 dari HPP tanpa saldo debit awal. Diperbaiki
   dengan memberi Persediaan saldo awal 500.000 di jurnal modal awal —
   realistis (barang harus ada nilainya sebelum bisa dijual/dikonsumsi).

Kedua temuan ini murni kesalahan fixture test, BUKAN bug di kode
produksi — dicatat karena keduanya membuktikan 2 mekanisme produksi
(`account_type` revenue/expense sign, guard saldo negatif T-629) benar2
bekerja seperti didesain, bukan cuma lolos karena test tidak
menantangnya.

## Verifikasi

- `accounting.tests_reports_close_period_e2e`: 1/1 lulus.
- Full suite `accounting api`: 340/340 lulus, 0 regresi.
- Tidak ada migration baru (test murni).

Status `done` — diimplementasikan dan diverifikasi test nyata di sesi
yang sama oleh Claude (manager), sesuai instruksi eksplisit user untuk
mempercepat penyelesaian backlog akuntansi hari ini.
