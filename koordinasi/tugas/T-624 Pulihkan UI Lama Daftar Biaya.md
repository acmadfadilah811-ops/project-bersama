---
id: T-624
epik: "[[Production Readiness dan Integrasi Akuntansi]]"
status: done
agent: Codex
prioritas: tinggi
depends_on: [T-610]
created: 2026-07-30
---

# T-624 - Pulihkan UI Lama Daftar Biaya

**Verifikasi manager 2026-08-01 — CONFIRMED, promosi ke `done`.** `DaftarBiaya.jsx` baca `/accounting/accounts/` nyata (filter `account_type=expense`), bukan mock — klaim "100% mock" sebelumnya terbukti sudah terperbaiki.

## Scope

- Mengembalikan `DaftarBiaya.jsx` ke tampilan UI lama dari `HEAD` repo.
- Tidak mengubah endpoint, backend, atau kontrak data Biaya.

## Bukti awal

- Versi kerja saat ini mengganti UI lama 405 baris dengan halaman ringkas yang
  mengambil akun dari API.
- User meminta pemulihan tampilan lama secara eksplisit pada 2026-07-30.

## Verifikasi

- `DaftarBiaya.jsx` dipulihkan tepat ke versi `HEAD` (UI lama 405 baris).
- ESLint target dan `git diff --check` lulus tanpa error.
- `graphify update .` selesai (5.198 node, 14.796 edge).
