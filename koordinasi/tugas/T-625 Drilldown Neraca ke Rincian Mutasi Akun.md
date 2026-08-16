---
id: T-625
epik: "[[Production Readiness dan Integrasi Akuntansi]]"
status: done
agent: Codex
prioritas: tinggi
depends_on: [T-610]
created: 2026-07-31
---

# T-625 - Drilldown Neraca ke Rincian Mutasi Akun

**Verifikasi manager 2026-08-01 — CONFIRMED, promosi ke `done`.** Baris sintetis "Pendapatan periode ini" terbukti TIDAK bisa diklik (`id: null` sengaja, dijaga test), akun asli membuka Rincian Mutasi Akun nyata via endpoint Buku Besar asli.

## Scope

- Nominal akun Neraca yang bukan nol membuka `RincianMutasiAkun`.
- Rincian menggunakan endpoint Buku Besar yang sudah ada serta rentang tanggal
  laporan yang sedang dipilih.

## Bukti awal

- API Neraca sudah mengembalikan `id`, `code`, `name`, dan `amount` per akun.
- `NeracaReport` telah memiliki komponen tombol nominal, tetapi callback-nya
  belum diteruskan dari halaman Neraca.

## Verifikasi

- Nominal akun Neraca nonnol kini membuka `RincianMutasiAkun`; nilai total
  agregat dan "Pendapatan periode ini" tetap bukan tautan karena tidak
  mewakili satu akun jurnal.
- Rentang tanggal laporan diteruskan sebagai rentang awal rincian, sehingga
  saldo awal dan mutasi menjelaskan saldo kumulatif Neraca pada `date_to`.
- ESLint tidak memiliki error (tersisa satu peringatan dependency hook lama),
  build Vite lulus, dan `accounting.tests_balance_sheet` 5/5 lulus.
- `graphify update .` selesai (5.351 node, 15.129 edge).
