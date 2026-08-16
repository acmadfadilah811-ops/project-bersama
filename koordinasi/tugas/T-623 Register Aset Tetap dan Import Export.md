---
id: T-623
epik: "[[Production Readiness dan Integrasi Akuntansi]]"
status: done
agent: Codex
prioritas: tinggi
depends_on: [T-610]
created: 2026-07-30
---

# T-623 - Register Aset Tetap dan Import Export

**Verifikasi manager 2026-08-01 — CONFIRMED, promosi ke `done`.** Migration `0031_fixed_asset_register` diverifikasi ULANG masih `[X]` terpasang di `db.sqlite3` nyata (insiden sebelumnya tetap fixed), 5/5 test lulus, tidak ada bypass `create_journal_entry()`.

## Desain disetujui manager

Disetujui user pada 2026-07-30 untuk membuat register aset persisten di app
`accounting`, dengan API CRUD, import CSV maksimum 500 baris, export Excel/PDF,
dan UI lama yang dipecah menjadi hook serta komponen kecil.

| Kejadian | Debit | Kredit |
|---|---|---|
| Perolehan aset | akun aset | akun kas/bank/hutang pilihan pengguna |
| Saldo awal aset | akun aset | akun saldo awal |
| Penyusutan | akun beban penyusutan | akun akumulasi penyusutan |

Semua jurnal melalui `create_journal_entry()`, memakai Decimal, atomik,
idempoten oleh source_type dan source_id. V1 tidak menjalankan penyusutan
otomatis maupun pelepasan aset.

## Scope

- Model, service, serializer, endpoint, dan test register aset.
- Import preview/commit CSV dan export Excel/PDF yang server-side.
- Pecah `DaftarAset.jsx` agar tidak lagi melebihi batas 300 baris.
- Hubungkan form tambah, daftar, dan modal import/export ke API aset.

## Bukti awal

- `DaftarAset.jsx` sudah berisi UI import/export, tetapi masih handler browser/local state.
- Backend `accounting` belum mempunyai model atau endpoint aset.
- File UI berada pada 1.584 baris dan harus diekstrak sebelum ditambah fitur.

## Kontrak API yang direncanakan

- `GET/POST /api/accounting/assets/`
- `GET/PATCH /api/accounting/assets/{id}/`
- `POST /api/accounting/assets/import/preview/`
- `POST /api/accounting/assets/import/commit/`
- `GET /api/accounting/assets/?export=xlsx|pdf`
- `GET /api/accounting/assets/import/template/`

## Hasil

- Menambah model `FixedAsset` dan migration `accounting/0031_fixed_asset_register.py`.
- Perolehan aset dan import CSV membuat jurnal posted melalui
  `create_journal_entry()` dalam transaksi atomik; kode aset unik mencegah
  pengulangan jurnal.
- Endpoint tersedia untuk daftar/tambah/detail aset, template CSV,
  preview+commit import, serta export `xlsx`/PDF dari `GET /assets/?export=`.
- UI Aset dipecah dari 1.584 menjadi halaman 33 baris, hook API, form aset,
  selector akun, dan modal import/export.
- Verifikasi: `accounting.tests_assets` 4/4 lulus, `makemigrations --check`
  dan `manage.py check` lulus; ESLint file aset dan build Vite lulus.
- Perbaikan follow-up: pemuatan COA dipisahkan dari pemuatan aset; dropdown
  tetap menampilkan akun bila endpoint aset gagal. Test kontrak lookup COA
  memastikan `account_type` dan `is_contra` tersedia (suite 5/5 lulus).

## Di luar scope

- Penyusutan otomatis berkala dan pelepasan aset belum dibuat; akun penyusutan
  disimpan pada register untuk task lanjutan.

## 🚨 Bug kritis ditemukan (Claude, 2026-07-30) — SUDAH DIPERBAIKI

User minta cek bug + buat data dummy di menu Aset. Ditemukan: **migration
`accounting.0031_fixed_asset_register` belum pernah dijalankan di database
dev asli** (`showmigrations accounting` menunjukkan `[ ]` — cuma pernah jalan
di database test sementara Django, bukan `db.sqlite3` yang dipakai app
sungguhan). Akibatnya seluruh fitur Aset (list, tambah, import/export) akan
**error 500 (`no such table: accounting_fixed_asset`)** kalau dicoba di
aplikasi nyata — bukan cuma tampil kosong seperti kasus Biaya sebelumnya, tapi
benar-benar crash.

**Perbaikan**: `python manage.py migrate accounting` dijalankan — tabel
sekarang ada, tidak ada migration lain yang tertinggal (dicek
`showmigrations` seluruh app, bersih). Ini murni menjalankan migration yang
sudah ditulis Codex dengan benar; tidak ada perubahan kode/skema.

**Verifikasi setelah fix**: `accounting.tests_assets` 5/5 lulus (pakai DB test
sendiri, tidak kena bug ini — makanya lolos review meski DB dev asli belum
ter-migrate). Dicoba end-to-end lewat `APIClient` nyata setelah migrate: GET
`/api/accounting/assets/` 200 OK, POST `create_fixed_asset()` sukses bikin
jurnal perolehan balanced.

**Data dummy dibuat** (asal `create_fixed_asset()`, bukan bypass, deskripsi
berlabel `[DUMMY]`):
- `AST-DUMMY-001` — Laptop Kantor, Rp 15.000.000 (residu 1.000.000), akun
  Peralatan (11500)/Akumulasi Penyusutan Peralatan (11600)/Beban Penyusutan
  (60400), dibayar tunai (Kas 11101) → jurnal `JU-202607-0034`.
- `AST-DUMMY-002` — Mesin Produksi, Rp 85.000.000 (residu 5.000.000), akun
  Aset Tetap (12000)/Akumulasi Penyusutan Aset Tetap (14000)/Beban Penyusutan
  (60400), dibeli kredit (Hutang Dagang 21000) → jurnal `JU-202607-0035`.

**Pelajaran untuk protokol**: `python manage.py test` TIDAK membuktikan
migration sudah diterapkan ke DB nyata (test selalu migrate DB sementara dari
nol). Sebelum menandai task `review`/`done` yang menambah migration baru,
perlu tambahan langkah `manage.py showmigrations <app>` terhadap `db.sqlite3`
dev asli, bukan cuma suite test. Disarankan ditambahkan ke checklist
Definition of Done di [[Aturan Engineering]].
