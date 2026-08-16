---
tags: [histori, status, accounting, production-readiness]
created: 2026-07-30
owner: Codex manager
---

# Histori Status Terkini — 2026-07-30

## Ringkasan keputusan manager

Aplikasi belum boleh dibuka untuk traffic production penuh. Kondisi saat ini
cukup untuk UAT terkontrol pada alur yang sudah diverifikasi, tetapi bukti
operasional production (restore VPS, beban, deploy, rollback, dan UAT finansial)
belum lengkap.

Estimasi kerja, **bukan approval go-live**:

| Area | Estimasi | Dasar singkat |
|---|---:|---|
| Core backend akuntansi | 80–85% | Jurnal, POS, Order, Kas/Bank, COA, piutang/hutang dan fondasi pembelian/retur tersedia. |
| Integrasi UI–API akuntansi | 70–75% | Banyak layar sudah live; beberapa masih review, settlement belum tersambung, dan T-618 masih dikerjakan. |
| Operasional production penuh | 45–55% | Restore PostgreSQL VPS, load test, runbook deploy, dan rollback belum dibuktikan. |
| Kesiapan keseluruhan | 65–70% | Layak UAT terbatas, belum full production. |

## Perubahan dan verifikasi hari ini

- **T-619 Pemulihan UI Transaksi POS** selesai oleh executor dan berpindah ke
  `review`: 12 submenu kini memiliki route eksplisit. Empat submenu stok
  memakai dokumen inventori nyata; Pendapatan/Data Pengeluaran memakai
  `/cash-transactions/` dengan filter arah; marketplace, komisi, dan MDR
  menampilkan shield jujur karena sumber live belum tersedia. Tidak ada
  kontrak API, jurnal, atau alur stok yang diubah.
- Verifikasi T-619: ESLint file perubahan 0 error, build Vite lulus, dan
  `graphify update .` lulus (4927 node, 14151 edge). Warning bundle besar
  tetap tercatat di T-706; 14 warning import lama app shell tidak diubah
  karena berada di luar scope task.
- Koreksi review T-619 memulihkan rute non-POS yang sempat jatuh ke fallback:
  settlement, jurnal, Piutang/Hutang, laporan, dan dua varian tutup buku.
  Setelah pemetaan spesifik kembali, ESLint terkait bersih 0 error/0 warning,
  build lulus, dan graph diperbarui ulang (4932 node, 14157 edge).
- Koreksi desain T-619 mengembalikan empat submenu stok POS ke layar
  Akuntansi sendiri, bukan ke halaman Inventory. Keempat layar menyatakan
  belum terintegrasi secara eksplisit tanpa data atau aksi palsu; build dan
  graph update ulang lulus (4933 node, 14158 edge).

- **Pengaturan akun default POS** diperbaiki dari state React sementara menjadi
  konfigurasi yang disimpan melalui `PATCH /api/accounting/settings/`.
  Setelah simpan, drawer menampilkan **Akun default aktif** dan tombol **Ubah**.
- Migration `0027_accountingsettings_pos_default_accounts` sempat tertinggal
  dari database aplikasi. Ini membuat endpoint Settings gagal dibaca, wizard
  Akuntansi kembali ke awal, dan pengguna tersangkut di step Ringkasan.
  Migration sudah diterapkan. Status aktual menunjukkan Akuntansi aktif dan
  `initial_setup_completed_at` terisi.
- **Log Memposting Otomatis POS** ditambahkan: setiap aktif/nonaktif disimpan
  pada `POSPostingSettingsAuditLog`, dengan waktu, aksi, nilai sebelum/sesudah,
  nama pengguna, dan email pengguna. Tombol **Log** tersedia di drawer POS.
  Histori baru tercatat mulai fitur ini diterapkan; perubahan masa lalu tidak
  dibuat-buat/backfill tanpa sumber audit asli.
- Migration `0028_pospostingsettingsauditlog` sudah diterapkan.
- Verifikasi yang lulus: `manage.py check`, `makemigrations --check --dry-run`,
  test `accounting.tests_pos_settings` (2/2), lint komponen POS, dan build
  frontend Vite. Build masih memberi peringatan bundle besar; ini masuk T-706.

## Task belum selesai — prioritas production

| ID | Status | Pekerjaan tersisa / blocker |
|---|---|---|
| [[T-618 Penjualan POS Source of Truth dan Posting Manual\|T-618]] | `in_progress` | Selesaikan review end-to-end data Penjualan di Toko, post/batal-post, mapping fallback akun transit, dan log jurnal nyata. |
| [[T-105 Rekonsiliasi shift vs jurnal\|T-105]] | `review` | Review hasil rekonsiliasi shift POS dan indikator transaksi lunas yang belum diposting. |
| [[T-107 HPP penjualan POS\|T-107]] | `backlog` | Jurnal HPP/Persediaan untuk penjualan POS belum final. |
| [[T-203 Edge case DP dan pelunasan Order\|T-203]] | `backlog` | Diskon, kupon, pembulatan, dan skenario pembayaran Order belum ditutup. |
| [[T-204 HPP Order\|T-204]] | `backlog` | Jurnal HPP Order belum selesai. |
| [[T-205 Test integrasi Orders–Akuntansi\|T-205]] | `backlog` | Uji end-to-end Order belum lengkap. |
| [[T-206 Migrasi ledger legacy HR\|T-206]] | `review` | Review migrasi/pensiun penulis ledger legacy. |
| [[T-207 Jurnal pembalik Order\|T-207]] | `review` | Review pembatalan dan pengembalian Order ke jurnal pembalik. |
| [[T-212 Settlement ledger-based Order\|T-212]] | `review` | Final review idempotensi, concurrency, dan saldo settlement. |
| T-605 Settlement UI | `backlog` | UI settlement belum boleh disambungkan sebelum T-212 disetujui. |
| T-611 Validasi laporan dan tutup buku | `backlog` | Laporan dan close-period end-to-end belum divalidasi. |
| [[T-612 Modul Tutup Buku dan Audit Trail Akuntansi\|T-612]] | `review` | Menunggu review close-period dan guard posting. |
| [[T-614 Desain Matriks Permission Granular\|T-614]] | `backlog` | Backend permission granular belum ada; perlu desain sebelum implementasi. |

## Task belum selesai — pembelian, stok, dan pemulihan UI

| ID | Status | Pekerjaan tersisa |
|---|---|---|
| [[T-608 Hubungkan Pembelian Retur dan Pergerakan Stok\|T-608]] | `review` | Review kontrak sumber data dan mutasi pembelian/retur/stok. |
| [[T-617 Alur Pembelian Stok Masuk dan Log Audit\|T-617]] | `review` | UAT detail pembelian, penerimaan, stok masuk, pembayaran, lampiran, dan log. |
| [[T-613 Restore UI Akuntansi Setelah Integrasi API\|T-613]] | `review` | Review pemulihan layout, filter, modal, tanggal, footer, dan endpoint nyata. |
| T-301 Inventarisasi masalah Orders | `backlog` | Menunggu inventaris masalah tambahan dari pemakaian. |
| T-302 Detail Pesanan Selesai | `backlog` | Menunggu referensi visual pengguna. |
| T-303 Detail Pesanan Dibatalkan | `backlog` | Menunggu referensi visual pengguna. |
| T-401 s.d. T-403+ Kasir v2 | `backlog` | Requirement dan desain kasir v2 belum dimulai. |

## Task belum selesai — engineering production

| ID | Status | Bukti yang masih wajib ada |
|---|---|---|
| [[T-703 Database Migration Backup dan Restore Drill\|T-703]] | `blocked` | Restore PostgreSQL nyata di VPS/staging dan pengukuran RTO. Kode backup/restore sudah direview, tetapi tool/akses VPS belum tersedia. |
| T-704 Observability dan incident handling | `backlog` | Readiness/alerting, slow-query, dan alur incident belum dibuktikan. |
| T-705 Performance dan load test | `backlog` | Target 50 req/s, 100 concurrent user, dan p95 belum diuji. |
| T-706 Frontend production hardening | `backlog` | Code-splitting bundle, error boundary, dan smoke test per-role belum tuntas. |
| T-707 Runbook deploy dan rollback | `backlog` | Runbook, skrip rollback, dan drill deployment belum diverifikasi. |
| T-708 Final go-live dan UAT finansial | `backlog` | Sign-off hanya dapat dilakukan setelah seluruh gate kritis di atas tertutup. |

## Catatan risiko terbuka

- `check --deploy` sebelumnya masih menghasilkan banyak warning DRF Spectacular
  dan warning keamanan yang bergantung pada konfigurasi `DEBUG=False` staging.
- Bundle frontend masih jauh di atas ambang warning Vite; build lulus tetapi
  bukan bukti performa pengguna akhir.
- Settlement, laporan, tutup buku, HPP, permission granular, dan operasi VPS
  adalah penahan go-live yang lebih penting daripada penyempurnaan visual.
- Knowledge graph belum diperbarui setelah perubahan sesi ini karena launcher
  Graphify tidak tersedia pada environment kerja saat ini; ini harus dijalankan
  kembali sebelum handover/deploy berikutnya.

## Urutan tindak lanjut

1. Tutup dan review T-618, T-617, T-608, T-612, T-105, T-206, T-207, dan T-212.
2. Kerjakan T-605, T-611, T-614, HPP, serta test integrasi yang masih backlog.
3. Sediakan akses VPS staging untuk menutup T-703.
4. Jalankan T-704 sampai T-707, lalu UAT finansial dan sign-off T-708.

## Catatan manager

Dokumen ini dibuat dan diperbarui oleh **Codex manager** berdasarkan status
Board, kode yang sedang dikerjakan, dan hasil verifikasi lokal pada 2026-07-30.
Status `review` bukan berarti selesai; hanya `done` setelah review independen
yang boleh dihitung sebagai selesai.
