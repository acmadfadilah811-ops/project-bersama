---
id: T-628
epik: "[[Production Readiness dan Integrasi Akuntansi]]"
status: done
agent: Codex, Claude
prioritas: tinggi
depends_on: [T-610]
created: 2026-07-31
---

# T-628 - Laporan Arus Kas dari Jurnal

## Desain laporan

- Saldo awal/akhir berasal dari akun berklasifikasi `Kas & Bank` pada jurnal
  posted.
- Setiap jurnal dialokasikan tepat satu aktivitas (operasional, investasi, atau
  pendanaan) dan total aktivitas direkonsiliasi ke perubahan kas.

## Hasil

- Endpoint ringkasan dan rincian kategori Arus Kas memakai data jurnal asli.
- Nominal kategori nonnol membuka tabel rincian tanpa PDF/Excel; aksi titik
  tiga menampilkan Pasangan Jurnal dengan seluruh baris jurnal asli.
- Dropdown pada dua baris terakhir membuka ke atas agar tidak tertutup tabel.

## Follow-up pagination

- Tombol `<` dan `>` meminta halaman tertentu dengan `page_size=10`, dibatasi
  pada halaman valid, dan dinonaktifkan selama pemuatan.
- Tes server membuktikan perpindahan ke halaman kedua mengembalikan baris dan
  jumlah saldo berjalan yang benar.

## Verifikasi

- `accounting.tests_balance_sheet` mencakup rekonsiliasi, rincian, dan halaman
  kedua; lint target, build Vite, serta `graphify update .` telah lulus.
- Graph terakhir: 5.396 node dan 15.226 edge.

## Verifikasi independen manager 2026-08-01 (sesi kedua, first-time review) — ✅ PROMOTED TO `done`

Task ini belum pernah diverifikasi manager sebelumnya (terlewat batch 2026-08-01
sesi pertama). Dicek dari nol:
- Baca `get_cash_flow()`/`get_cash_flow_detail()`/`_cash_flow_bucket()`
  (`accounting/services/ledger.py:290-427`): setiap `JournalEntry` posted
  dengan `cash_delta != 0` dialokasikan tepat satu kategori (operasional/
  investasi/pendanaan) via `source_type` + klasifikasi akun lawan; total
  kategori by construction = total `cash_delta` asli, jadi
  `saldo_kas_akhir = saldo_kas_awal + total_kenaikan_kas` selalu rekonsiliasi
  (bukan angka independen yang bisa divergen).
- 4 test dikonfirmasi ada & lulus (`test_cash_flow_reconciles_...`,
  `..._detail_returns_real_cash_lines...`, `..._endpoint_returns_real_data`,
  `..._detail_endpoint_returns_paginated_rows`) — bagian dari full suite
  324/324 lulus.
- `CashFlowView`/`CashFlowDetailView` (`views/income_statement.py:94-127`):
  permission `IsOwnerOrManager`, `page_size` default 10 (sesuai klaim note),
  dibatasi `[1,100]`, kategori divalidasi whitelist (400 kalau tidak valid).
Tidak ada blocker. Status → `done`.
