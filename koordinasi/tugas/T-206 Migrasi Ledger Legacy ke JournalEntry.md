---
id: T-206
epik: "[[Integrasi Akuntansi-Orders]]"
status: done
agent: Antigravity, Claude
prioritas: tinggi
depends_on: [T-202]
created: 2026-07-27
---

# T-206 — Migrasi Ledger Legacy `hr.TransaksiBukuBesar` → `accounting.JournalEntry`

## Scope

Migrasi data ledger legacy (`hr.TransaksiBukuBesar`) ke `accounting.JournalEntry`,
lalu pensiunkan ledger legacy — tidak boleh ada penulis/pemakai baru (M3/L3).

## Verifikasi manager 2026-08-01 — ⚠️ BUG UANG, BUKAN AMAN UNTUK `done`

Diverifikasi lewat agent independen (baca kode + jalankan test nyata).

**Yang sudah benar**:
- `accounting/management/commands/migrate_legacy_ledger.py` — mengelompokkan baris
  legacy per `(no_referensi, tanggal)`, menolak grup yang tidak balance, posting
  lewat `create_journal_entry()` (M2), rekonsiliasi debit=kredit sebelum/sesudah.
- Test `accounting/tests_migrate_legacy_ledger.py`: 1/1 lulus. Command dijalankan
  langsung: "REKONSILIASI PERFECT MATCH 100%".

**BLOCKER — ledger legacy TIDAK dipensiunkan, bertentangan dengan judul task &
semangat M3**:
- `hr/views.py:970-978` — `TransaksiBukuBesarViewSet(viewsets.ModelViewSet)` masih
  menyediakan CRUD PENUH (create/update/**delete**) ke `hr.TransaksiBukuBesar`,
  hanya dijaga `IsOwnerOrManagerPerm`, tidak ada freeze/read-only.
- Endpoint hidup nyata: `POST/DELETE /api/finance/transaksi/`
  (`hr/finance_urls.py:7` → `core/urls.py:34`).
- **Benar-benar dipanggil dari halaman frontend yang ter-routing**, bukan kode
  mati: `bintang-react-frontend/src/features/finance/pages/BukuBesar.jsx:114`
  (`apiClient.post('/finance/transaksi/', payload)`) dan `:129`
  (`apiClient.delete('/finance/transaksi/${id}/')` — hard delete, tanpa konsep
  jurnal pembalik sama sekali). Route `/buku-besar` terdaftar di `App.jsx:163`.
- Artinya: owner/manager MASIH BISA membuat dan menghapus keras entri ledger
  legacy hari ini, berjalan paralel dengan `accounting.JournalEntry` — persis
  yang seharusnya dihentikan task ini.
- Minor: `db.sqlite3` dev nyata saat ini punya 0 baris `hr.TransaksiBukuBesar`,
  jadi migrasi belum pernah dijalankan terhadap data nyata — bukan blocker
  tersendiri, tapi berarti "pensiun" belum terbukti terhadap dataset hidup, dan
  selama jalur tulis masih terbuka, data legacy baru bisa terus bertambah
  setelah migrasi kapan pun dijalankan.

## Yang harus diperbaiki sebelum `review` → `done`

1. Nonaktifkan write path `hr.TransaksiBukuBesar` — `TransaksiBukuBesarViewSet`
   diubah jadi read-only (atau endpoint `/finance/transaksi/` dihapus/dialihkan),
   sesuai M3 ("dilarang menambah penulis/pemakai baru" — termasuk penulis LAMA
   yang masih aktif harus ditutup saat migrasi dianggap selesai).
2. `BukuBesar.jsx` (`features/finance/`) perlu diarahkan ulang ke
   `accounting.JournalEntry` atau di-feature-gate sampai keputusan itu dibuat —
   jangan biarkan UI aktif menulis ke ledger yang seharusnya sudah pensiun.
3. Setelah write path ditutup, jalankan migrasi terhadap `db.sqlite3` dev nyata
   (bukan cuma test suite) untuk membuktikan rekonsiliasi pada data hidup.

Ini keputusan berdampak luas (menutup endpoint yang sedang dipakai UI aktif) —
sebaiknya dikonfirmasi dulu ke user/manager sebelum eksekusi, bukan langsung
dikerjakan executor berikutnya.

## Diperbaiki 2026-08-01 (Claude, instruksi eksplisit user: "bukan memindahkan
setatus, tapi perbaiki")

Ketiga poin "Yang harus diperbaiki" di atas dikerjakan:

1. **`hr/views.py`** — `TransaksiBukuBesarViewSet` diubah dari
   `viewsets.ModelViewSet` ke `viewsets.ReadOnlyModelViewSet` + docstring M3/L3.
   `AkunViewSet` dicek ulang — sudah `ReadOnlyModelViewSet` dari awal, tidak
   perlu diubah.
2. **`BukuBesar.jsx`** (`features/finance/pages/`) — seluruh write-UI dihapus:
   tombol "Transaksi Baru", modal tambah transaksi, tombol hapus per-baris,
   kolom "Aksi". Diganti banner arsip yang eksplisit mengarahkan ke Akuntansi
   Internal untuk pencatatan jurnal baru.
3. **Migrasi dijalankan ulang terhadap `db.sqlite3` dev nyata** (bukan cuma
   test suite — lihat insiden T-623): `python manage.py migrate_legacy_ledger`
   → `0 baris legacy, tidak ada yang perlu dimigrasikan` (dev db memang belum
   pernah punya data di ledger ini, sesuai catatan verifikasi awal).

**Test**: `hr/tests.py` — ditambah `LegacyLedgerFrozenTests` (4 test baru:
read masih jalan, create/update/delete ditolak). `manage.py test hr.tests` →
11/11 lulus, response `Method Not Allowed` terkonfirmasi di log test untuk
`POST`/`PUT`/`DELETE /api/finance/transaksi/`.

Status dikembalikan ke `review` (bukan `done`) — Claude tidak self-certify
perbaikan sendiri, sesuai protokol. Menunggu verifikasi independen.

## Verifikasi independen manager 2026-08-01 (sesi kedua) — ✅ PROMOTED TO `done`

Diverifikasi ulang sesi Claude manager terpisah (tidak menulis fix di atas):
- `hr/views.py:970` — `TransaksiBukuBesarViewSet(viewsets.ReadOnlyModelViewSet)`
  dikonfirmasi langsung di kode (bukan cuma laporan Hasil).
- `BukuBesar.jsx` (`features/finance/`) — grep `apiClient.(post|delete|patch|put)`
  nihil, tidak ada write path tersisa.
- `manage.py test hr.tests accounting.tests_migrate_legacy_ledger` dijalankan
  ulang nyata: 12/12 lulus (11 hr + 1 migrasi), rekonsiliasi "PERFECT MATCH 100%".
Tidak ada blocker tersisa. Status → `done`.
