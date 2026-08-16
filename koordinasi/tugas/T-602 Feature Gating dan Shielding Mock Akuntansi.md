---
id: T-602
epik: "[[Production Readiness dan Integrasi Akuntansi]]"
status: done
agent: Antigravity
prioritas: tinggi
depends_on: [T-601]
created: 2026-07-28
---

# T-602 — Feature Gating dan Shielding Mock Akuntansi

*Implementasi oleh Antigravity. Status `done` = disetujui manager setelah verifikasi 28 Juli 2026.*

---

## Scope & Implementation

Menghilangkan paparan data mock hardcoded dari build produksi pada seluruh 39 submenu Akuntansi yang belum terhubung ke backend API.

1. **Feature Shield Component (`FeatureShield.jsx`)**:
   - Dibuat komponen `src/features/accounting/components/FeatureShield.jsx` dengan status badge `[FEATURE GATED]`, penjelasan status pengembangan, dan penanda target task integrasi API.
   - **Zero Mock Numbers**: Menghilangkan seluruh angka tiruan/mock statis di UI produksi.
2. **Router Shielding (`AccountingInternalApp.jsx`)**:
   - Submenu aktif yang LIVE tetap dirender normal: `AccountingSettings`, `DaftarAkun`, `JurnalUmum`, `BukuBesar`, `ListKasBank`, `BankStatement` (siap untuk T-603), `Invoice`, `LogJurnal`.
   - Seluruh submenu non-live/mock (laporan finansial, jurnal manual, mutasi kas/pos, tutup buku, dll.) terlindungi di balik `<FeatureShield />`.
3. **Build Production Verification**:
   - `npm run build` lulus 100% (2.23s, zero compilation error).

---

## Acceptance Criteria

- [x] Tidak ada paparan angka/data mock pada build production untuk menu yang belum siap.
- [x] Seluruh submenu unreleased dilindungi dengan `FeatureShield`.
- [x] Submenu LIVE dan `BankStatement` (T-603) tetap berfungsi normal.
- [x] Build produksi Vite lulus 100%.

## Approval Manager — 2026-07-28

Disetujui `done` setelah pemeriksaan ulang. Ditemukan dan diperbaiki satu celah: submenu `hak-akses`/`penyesuaian-hak-akses` masih merender `PenyesuaianHakAkses` langsung walaupun statusnya `DISCONNECTED`; sekarang dirender melalui `FeatureShield` dengan target T-612. Build frontend lulus dan tidak ada error lint pada tiga file yang disentuh.
