---
id: T-629
epik: "[[Production Readiness dan Integrasi Akuntansi]]"
status: done
agent: Codex, Claude (Pengaturan Tutup Buku 2026-07-31)
prioritas: tinggi
depends_on: [T-612]
created: 2026-07-31
---

# T-629 - Validasi dan Detail Tutup Buku

## Desain disetujui user

- Tutup Buku bulan penuh ditolak apabila, pada akhir periode, ada akun aktif
  dengan saldo abnormal negatif menurut arah normal akunnya (contoh Kas).
- Validasi hanya membaca jurnal posted dan tidak mengubah/menghapus jurnal.
- Tabel Tutup Buku Semua Bulan memuat periode nyata; Detail membuka layar penuh
  menutup sidebar dan hanya menyediakan tombol Kembali serta tabel jurnal
  posted (Tanggal, No. Transaksi, Nomor/Nama Akun, Deskripsi, Debit, Kredit).

## Di luar scope

- Saldo minus yang pengguna lihat di aplikasi Olsera bukan data aplikasi ini
  dan tidak akan diubah di database Bintang ERP.

## Verifikasi

- `accounting.tests_period_close`: 6/6 lulus, termasuk penolakan saldo Kas
  negatif dan endpoint detail periode yang hanya mengembalikan jurnal posted.
- `manage.py makemigrations --check --dry-run`: tidak ada migration tertunda.
- ESLint pada halaman, komponen, hook, dan service Tutup Buku: lulus.
- `npm.cmd run build`: lulus.
- `graphify update .`: selesai.

## Hasil implementasi

- `close_accounting_period()` menolak akun bersaldo abnormal negatif tanpa
  memodifikasi jurnal atau mengunci periode.
- `GET /api/accounting/periods/<id>/detail/` menyediakan baris jurnal posted
  untuk periode tersebut.
- Halaman Tutup Buku Semua Bulan memakai daftar periode nyata dan Detail
  menjadi layar penuh dengan satu aksi Kembali.

## Revisi UI 2026-07-31

- Menu aktif `TutupBukuTokoIni` yang masih membawa UI statis lama diganti
  dengan daftar periode API yang rapi dan tombol aksi `Detail`.
- Drawer pengaturan, akun closing contoh, toggle abaikan saldo minus, dan
  tampilan status yang sebelumnya menempati kolom aksi dihapus.
- ESLint halaman Tutup Buku, komponen Detail, hook, dan service: lulus.
- `npm.cmd run build`: lulus. Pemeriksaan browser visual tidak tersedia pada
  sesi ini; verifikasi visual akhir tetap perlu dilakukan di aplikasi.

## Keputusan yang diperlukan: Pengaturan Tutup Buku

- UI lama memiliki pilihan akun closing dan abaikan saldo minus, tetapi keduanya
  tidak pernah dipakai oleh service penutupan periode.
- Opsi abaikan saldo minus tidak dapat diaktifkan karena requirement user
  sebelumnya mewajibkan saldo normal terlebih dahulu.
- Agar akun closing benar-benar berfungsi, service harus membuat jurnal
  penutupan laba-rugi ke akun laba ditahan secara atomik dan idempoten. Ini
  mengubah saldo laporan sehingga membutuhkan persetujuan mapping jurnal user.
- Sementara, kolom Status dihapus dari Tutup Buku Toko Ini; status tetap hanya
  di Tutup Buku Toko Pusat & Cabang.

## Keputusan manager 2026-07-31 (Claude) — Pengaturan Tutup Buku diselesaikan

Instruksi eksplisit user: lanjutkan menyelesaikan bagian ini (menyimpang dari
alur biasa manager-tidak-coding, dikerjakan langsung oleh Claude karena user
minta eksplisit — preseden sama seperti T-619/T-622/T-625). **Tidak menyentuh
scope Codex yang sudah `in_progress`** — bagian ini murni menjawab 2 pertanyaan
terbuka yang ditinggalkan Codex di atas, tanpa mengubah validasi saldo
negatif/DRAFT yang sudah dibuat Codex.

**Jurnal penutup fisik DITOLAK** (bukan dibangun): Neraca (`get_balance_sheet`,
`ledger.py:435-441`) sudah eksplisit mengaku menghitung "Pendapatan periode
ini" langsung dari `get_income_statement(date_from, date_to)` per rentang
tanggal, BUKAN dari jurnal penutup — dan tutup buku di app ini berjalan
BULANAN (bukan tahunan). Kalau jurnal penutup fisik dibuat per bulan (debit
Pendapatan/kredit Beban tanggal akhir bulan yang sama), baris itu akan
menol-kan agregasi Laba Rugi bulan tersebut sendiri saat dibaca ulang —
merusak laporan historis yang sudah benar (T-627). Pendekatan computed
retained-earnings ini sama dengan software modern (Xero/QBO) dan Olsera —
"Akun Closing" di sana pun bukan trigger jurnal manual, melainkan penanda akun
ekuitas tujuan laba berjalan.

**Implementasi (2 bagian, low-risk, tanpa jurnal baru):**

1. **Akun Closing jadi nyata**: field baru `AccountingSettings.closing_account`
   (migration `0033_accountingsettings_closing_account`, FK ke `Account`,
   nullable, pola sama persis dengan `opening_balance_equity_account`).
   `get_balance_sheet()` (`accounting/services/ledger.py:448-455`) memakainya
   untuk memberi label akun nyata pada baris "Pendapatan periode ini" —
   `id` baris tetap `None` (bukan id akun closing) supaya TIDAK bisa
   di-drilldown seolah mutasi tercatat sungguhan (baris ini nilai terhitung).
   UI: drawer baru `PengaturanTutupBukuDrawer.jsx`, dibuka dari tombol
   "Pengaturan" (ikon gear) di `TutupBukuTokoIni.jsx` — PATCH
   `/api/accounting/settings/` field `closing_account`.
2. **Toggle "abaikan saldo minus" disambungkan**: field `Account.ignore_minus_closing`
   (sudah ada sejak migration `0019`, sudah ada di form Tambah/Ubah Akun,
   tapi belum dipakai) sekarang dibaca di
   `get_negative_account_balances()` (`accounting/services/period.py:11-23`) —
   akun yang ditandai `True` dikecualikan dari blokir saldo negatif saat tutup
   buku. Tidak ada UI baru untuk ini — toggle sudah ada di Daftar Akun.

**Endpoint berubah**: tidak ada endpoint baru. `GET/PATCH
/api/accounting/settings/` (sudah ada) sekarang menerima/mengembalikan
`closing_account`, `closing_account_code`, `closing_account_name`.

**Test baru**:
- `tests_balance_sheet.py::test_current_period_income_labeled_with_configured_closing_account`
  — label & code baris "Pendapatan periode ini" ikut akun closing yang
  dikonfigurasi, `id` tetap `None`.
- `tests_period_close.py::test_close_period_allowed_when_negative_account_flagged_ignore_minus_closing`
  — akun `ignore_minus_closing=True` bersaldo negatif tidak lagi memblokir
  tutup buku.
- Suite lama tidak diubah, tetap lulus tanpa modifikasi assertion (fallback
  `closing_account=None` menjaga label default "Pendapatan periode ini" persis
  seperti sebelumnya).

**Verifikasi**:
- `accounting.tests_period_close` + `accounting.tests_balance_sheet`: 19/19 lulus.
- `manage.py makemigrations --check --dry-run`: tidak ada migration tertunda.
- ESLint `TutupBukuTokoIni.jsx` + `PengaturanTutupBukuDrawer.jsx`: lulus.
- `npm run build`: lulus (2.33s).
- Full suite `accounting api`: 285/285 lulus, 0 regresi.
- Migration `0033_accountingsettings_closing_account` DIJALANKAN (`migrate accounting`)
  terhadap `db.sqlite3` dev asli (bukan cuma lolos test suite yang migrate DB
  temporer) — diverifikasi lewat shell nyata, field `closing_account` bisa
  diakses, default `None` (insiden T-623 dijadikan pelajaran).
- `graphify update .`: selesai (5437 nodes, 15332 edges).

Status `review` — menunggu verifikasi independen sebelum `done` sesuai
protokol (executor/Claude tidak menandai task sendiri jadi `done`).

## Tambahan 2026-07-31 (Claude, instruksi eksplisit user) — Tutup Buku Semua Bulan

User minta tombol untuk menutup banyak bulan sekaligus, bukan cuma bulan
berjalan. Opsi yang dipilih user: **satu tombol "Tutup Buku" dengan dropdown
2 opsi** — "Tutup Buku Bulan Ini" (perilaku lama, tidak berubah) dan "Tutup
Buku Semua Bulan" (baru).

**Semantik "Tutup Buku Semua Bulan"**: menutup semua `AccountingPeriod`
berstatus Terbuka yang **sudah berakhir** (`end_date < hari ini`) untuk tahun
terpilih di tabel — bulan berjalan yang belum selesai TIDAK ikut. Diproses
satu per satu urut dari yang tertua; tiap periode independen (sudah atomic
sendiri di `close_accounting_period()`) — kegagalan satu periode (mis. saldo
negatif) TIDAK menghentikan proses periode lain, hasilnya dilaporkan per
periode supaya user tahu bulan mana yang masih perlu diperbaiki. Aman
ditutup di luar urutan karena validasi saldo tiap periode sudah kumulatif
sampai `end_date`-nya sendiri (bukan bergantung status periode sebelumnya).

**Backend**:
- `close_all_open_periods(*, fiscal_year=None, actor=None)` —
  `accounting/services/period.py`. Return `(closed, failed)`.
- `POST /api/accounting/periods/close-all/` — `AccountingPeriodCloseAllView`
  (`accounting/views/period.py`), permission `IsStrictOwnerOrManager` (sama
  dengan close single-period). Body `{"confirm": true, "fiscal_year": <opsional>}`.
  Response: `{closed_count, failed_count, closed: [...], failed: [{period, reason}]}`.

**Frontend**: `closeAllAccountingPeriods(fiscalYear)` di `services/periods.js`;
`TutupBukuTokoIni.jsx` header sekarang satu tombol "Tutup Buku" (dropdown,
klik-luar-untuk-tutup) dengan 2 opsi, modal konfirmasi terpisah, dan modal
hasil (jumlah berhasil/gagal + daftar bulan gagal & alasannya).

**Test baru** (`tests_period_close.py::CloseAllOpenPeriodsTestCase`, 4 test):
periode berjalan tidak ikut tertutup; kegagalan satu periode tidak
menghentikan periode lain yang valid; permission matrix endpoint (403
non-owner/manager, 400 tanpa `confirm`, 200 dengan hasil per periode).

**Verifikasi**:
- `accounting.tests_period_close` (14 test termasuk yang baru): lulus.
- `manage.py makemigrations --check --dry-run`: tidak ada migration baru
  (tidak ada perubahan model di bagian ini).
- ESLint `TutupBukuTokoIni.jsx` + `services/periods.js`: lulus.
- `npm run build`: lulus (2.33s).
- Full suite `accounting api`: 288/288 lulus, 0 regresi.

## Verifikasi independen manager 2026-08-01 (sesi kedua) — ✅ PROMOTED TO `done`

- Migration `0033_accountingsettings_closing_account` dikonfirmasi `[X]` di
  `db.sqlite3` dev nyata (`showmigrations accounting`).
- `manage.py test accounting api` dijalankan ulang penuh: 324/324 lulus (angka
  lebih tinggi dari laporan 288 karena batch mencakup test task lain juga),
  0 gagal.
Tidak ada blocker tersisa. Status → `done`.
