---
id: T-207
epik: "[[Integrasi Akuntansi-Orders]]"
status: done
agent: Antigravity, Claude
prioritas: sedang
depends_on: [T-202]
created: 2026-07-27
---

# T-207 — Jurnal Pembalik untuk Transisi Dibatalkan & Pengembalian

## Scope

Hook jurnal pembalik di endpoint `batalkan`/`retur` Order yang sudah ada
(T-202 sudah selesai, sudah ada jurnal asli untuk dibalik).

## Verifikasi manager 2026-08-01 — ⚠️ BUG UANG (M5), BUKAN AMAN UNTUK `done`

Diverifikasi lewat agent independen (baca kode + jalankan test nyata).

**Yang sudah benar**:
- Hook ada dan bekerja untuk jalur normal: `api/views/orders.py:614-618`
  (`batalkan`) dan `:680-684` (`retur`) memanggil `post_order_reversal_journal()`
  (`accounting/services/order_posting.py:229`) — membuat `JournalEntry` pembalik
  yang benar, idempotent (cek `reversed_entry` dulu), tidak pernah
  edit/hapus jurnal asli (M7/L7 dipatuhi).
- Test `accounting/tests_order_reversal.py`: 4/4 lulus (pembalikan pembatalan,
  pembalikan retur, idempotency retry, skip aman kalau tidak ada jurnal asli),
  debit=kredit diverifikasi tiap test.

**BLOCKER — pelanggaran M5 ("jurnal gagal = seluruh transaksi rollback")**:
- Kedua hook dibungkus `except Exception as e: logger.error(...)` di
  `api/views/orders.py:617-618` dan `:683-684` — bukan dibiarkan propagate.
- Karena seluruh aksi ada di dalam `@transaction.atomic`, kalau
  `post_order_reversal_journal()` gagal karena alasan apa pun, exception itu
  DITELAN dan cuma di-log — tapi `order.status_global='batal'`, `OrderActivityLog`,
  dan (untuk retur) baris `PengembalianOrder` baru **tetap ter-commit**, sementara
  jurnal pembaliknya diam-diam TIDAK PERNAH terposting.
- Ini kebalikan tepat dari M5. Bandingkan dengan pola yang SUDAH BENAR di file
  yang sama untuk jalur pembayaran DP/pelunasan: `_post_order_payment(...)` di
  `api/views/orders.py:524` TIDAK dibungkus try/except, sehingga kegagalan
  posting di situ benar-benar me-rollback seluruh blok atomic.
- Tidak ada satu pun dari 4 test yang ada mensimulasikan kegagalan di dalam
  panggilan reversal — jadi gap ini tidak pernah kelihatan di test suite. Ini
  persis jenis titik buta yang membuat insiden T-103 terjadi (laporan "Hasil"
  terlihat lengkap, tapi ada pelanggaran desain yang lolos).

**Catatan bukan dari task ini**: `api/views/orders.py` sudah 1238 baris, jauh di
atas limit Python 400 (L5) — file sudah oversized sebelum T-207 disentuh, T-207
cuma menambah ~10 baris. Dicatat sesuai kewajiban checklist DoD, bukan blocker
task ini secara langsung.

## Yang harus diperbaiki sebelum `review` → `done`

1. Hapus `try/except` yang menelan exception di kedua hook (`batalkan` & `retur`)
   — biarkan kegagalan `post_order_reversal_journal()` propagate supaya
   `@transaction.atomic` benar-benar rollback semuanya (status Order, activity
   log, PengembalianOrder ikut batal, bukan cuma jurnalnya).
2. Tambah test yang men-simulasikan kegagalan di dalam reversal (mis. mock
   `create_journal_entry` melempar exception) dan assert bahwa status Order
   TIDAK berubah setelah rollback — supaya gap ini tidak berulang tanpa
   terdeteksi test.

## Diperbaiki 2026-08-01 (Claude, instruksi eksplisit user)

- `try/except Exception` dihapus dari `batalkan()` dan `retur()`
  (`api/views/orders.py`) — kegagalan `post_order_reversal_journal()` sekarang
  propagate dan `@transaction.atomic` rollback penuh.
- 2 test baru ditambahkan ke `accounting/tests_order_reversal.py`:
  `test_batalkan_reversal_failure_rolls_back_order_status` dan
  `test_retur_reversal_failure_rolls_back_pengembalian_order` — men-mock
  `post_order_reversal_journal` melempar `RuntimeError`, assert status Order
  tetap semula & tidak ada `PengembalianOrder`/`JournalEntry` yang ter-commit.
- `accounting.tests_order_reversal`: 6/6 lulus (4 lama + 2 baru).

Status dikembalikan ke `review` — perbaikan oleh Claude sendiri, TIDAK
ditandai `done` sendiri sesuai protokol (butuh verifikasi independen lain).

## Verifikasi independen manager 2026-08-01 (sesi kedua) — ✅ PROMOTED TO `done`

Diverifikasi ulang sesi Claude manager terpisah (tidak menulis fix di atas):
- `api/views/orders.py:614-618` (`batalkan`) dan `:680-684` (`retur`) dikonfirmasi
  langsung: tidak ada `try/except` membungkus `post_order_reversal_journal()` lagi.
- `manage.py test accounting.tests_order_reversal` dijalankan ulang nyata: 6/6
  lulus, termasuk 2 test kegagalan yang benar-benar memicu `RuntimeError` lewat
  mock dan assert rollback (status Order & `PengembalianOrder` tidak ter-commit).
Tidak ada blocker tersisa. Status → `done`.
