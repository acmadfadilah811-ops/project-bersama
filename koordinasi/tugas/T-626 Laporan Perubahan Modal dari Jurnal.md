---
id: T-626
epik: "[[Production Readiness dan Integrasi Akuntansi]]"
status: done
agent: Codex
prioritas: tinggi
depends_on: [T-610]
created: 2026-07-31
---

# T-626 - Laporan Perubahan Modal dari Jurnal

**Verifikasi manager 2026-08-01 — CONFIRMED, promosi ke `done`.** Rumus `modal_akhir = modal_awal + laba_bersih + investasi - penarikan` diverifikasi lewat test nyata (angka cocok), rekonsiliasi dengan Neraca terbukti by construction (query yang sama). `ledger.py` (533 baris) aman setelah limit L5 naik ke 1000.

## Desain laporan

- Modal awal: saldo kumulatif akun berklasifikasi Ekuitas sebelum `date_from`.
- Investasi: total kredit ke akun Ekuitas dalam periode.
- Penarikan: total debit ke akun Ekuitas dalam periode.
- Total laba: `laba_bersih` dari mesin Laba Rugi pada periode yang sama.
- Modal akhir: modal awal + laba + investasi - penarikan; harus cocok dengan
  komponen modal di Neraca (sebelum baris laba periode berjalan ditambahkan).

## Scope

- Endpoint read-only laporan perubahan modal dari jurnal terposting dan COA.
- Hubungkan UI Perubahan Modal, termasuk kontrol bulan/tahun, ke endpoint.
- Pertahankan tampilan lama dengan pemecahan komponen agar halaman tetap kecil.

## Verifikasi

- Menambah `GET /api/accounting/reports/changes-in-equity/` dengan permission
  Owner/Manager dan data hanya dari jurnal berstatus posted.
- UI Perubahan Modal sekarang memuat endpoint tersebut untuk periode Bulan
  atau Tahun; tampilan lama dipertahankan dan dipecah menjadi toolbar/report.
- `accounting.tests_balance_sheet` 7/7 lulus, termasuk skenario modal awal,
  investasi, penarikan, laba, dan modal akhir; `makemigrations --check` serta
  `manage.py check` lulus.
- ESLint file yang diubah dan build Vite lulus; `graphify update .` selesai
  (5.368 node, 15.162 edge).
