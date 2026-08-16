---
tags: [koordinasi, aturan]
created: 2026-07-27
updated: 2026-07-27
---

# ⚖️ Aturan Engineering — Perbaikan Kode & Penambahan Fitur

Aturan teknis yang **mengikat semua executor agent**. Setiap aturan punya ID (U1, M2, L5, …) — reviewer menolak task dengan menyebut ID yang dilanggar.

**Pembagian peran:**
- **Manager** (user + sesi Claude manajer): menetapkan aturan, menyetujui desain, mereview task `review`, memutus eskalasi. Tidak mengeksekusi kode.
- **Executor** (agent lain): mengerjakan task dari [[Agent Board]] mengikuti [[Protokol Agent]] + dokumen ini.

**Kedudukan dokumen**: melengkapi `AGENTS.md` (struktur kode) dan [[Protokol Agent]] (alur kerja). Kalau ada yang bertentangan → berhenti, eskalasi ke manager (X1). Dilarang memilih sendiri mana yang menang.

---

## U — Aturan Umum (semua perubahan)

- **U1** — Satu task = satu concern. Menemukan masalah lain → catat sebagai task baru di backlog epik terkait, JANGAN dikerjakan sekalian.
- **U2** — Dilarang mengubah kode yang belum dibaca. Sebelum edit, buktikan paham: kutip `file:baris` penyebab/lokasi di note task.
- **U3** — Graph dulu: `graphify query/path/explain` → baru baca file yang ditunjuk. Dilarang scan/grep buta ratusan file.
- **U4** — Ikuti idiom yang sudah ada di area yang disentuh: penamaan, struktur, dan **Bahasa Indonesia** untuk docstring/komentar/pesan user (konvensi repo ini).
- **U5** — Diff sekecil mungkin yang menyelesaikan task. Refactor di luar scope = task terpisah dengan persetujuan manager.
- **U6** — Dependency baru (pip/npm) wajib persetujuan manager SEBELUM dipakai.
- **U7** — Setelah kode berubah: test area terkait dijalankan + `graphify update .`.

## B — Perbaikan Bug

- **B1** — Reproduksi dulu: tulis test yang gagal atau bukti konkret (request/response, traceback). Tidak bisa direproduksi → `blocked`, tanya user. Dilarang memperbaiki bug yang belum terbukti ada.
- **B2** — Perbaiki akar masalah, bukan gejala. Dilarang: `try/except` yang menelan error, default diam-diam, menyembunyikan pesan kegagalan dari pengguna.
- **B3** — Setiap bugfix WAJIB membawa regression test: gagal sebelum fix, lulus sesudahnya.
- **B4** — No drive-by changes: jangan "sekalian merapikan" hal lain di file yang sama (kecuali kewajiban pecah god file dari `AGENTS.md`).
- **B5** — Bug keamanan atau bug uang: prioritas tertinggi + WAJIB dilaporkan ke manager di board — tidak boleh hanya diperbaiki diam-diam.

## F — Penambahan Fitur

- **F1** — Fitur yang menyentuh **uang, jurnal, atau stok** wajib desain tertulis yang di-approve manager SEBELUM koding: tabel mapping debit/kredit, alur status, daftar edge case.
- **F2** — Sebelum membangun: cek fitur/endpoint/model serupa via graphify + skema drf-spectacular. Dilarang implementasi paralel (aturan #1 `AGENTS.md`).
- **F3** — Backend: logic di `services/`, view tipis (parse → panggil service → response), serializer terpisah. **App `accounting` adalah contoh pola yang benar di repo ini — tiru strukturnya.**
- **F4** — Frontend: feature folder (`src/features/<domain>/`), logic di custom hook (`useX`), HTTP hanya via `apiClient`, notifikasi via `notify()`/`notifyApiError()`.
- **F5** — Endpoint baru: permission class server-side + terdaftar di skema drf-spectacular + dicatat di note task (method, path, payload, role yang boleh).
- **F6** — Kode baru dilarang menulis ke ledger legacy `hr` (lihat M3).

## M — Uang & Akuntansi (aturan paling ketat di project ini)

- **M1** — Semua nilai uang = `Decimal`. Float untuk uang dilarang total. Pembulatan Rupiah eksplisit (`quantize`), konsisten dengan pola yang sudah ada.
- **M2** — Jurnal HANYA lewat satu pintu: `create_journal_entry()` (`accounting/services/journal.py:58`). Dilarang `JournalEntry.objects.create()` langsung di luar service tersebut.
- **M3** — Ledger legacy `hr.Akun`/`hr.TransaksiBukuBesar` **DIBEKUKAN**: dilarang menambah penulis/pemakai baru. Semua posting baru → `accounting.JournalEntry`. Migrasi pemakai lama hanya lewat T-206 (terkontrol, bukan sambil lalu).
- **M4** — Posting finansial harus **idempotent**: pakai `source_type` + `source_id` (index `idx_je_source` sudah ada). Operasi diulang → tetap satu jurnal, bukan dobel.
- **M5** — Jurnal dibuat `transaction.atomic` BERSAMA operasi bisnisnya: jurnal gagal = seluruh transaksi rollback (pola audit Juli 2026).
- **M6** — Angka transaksi dihitung ulang server-side dari database. Dilarang memakai harga/total/diskon kiriman frontend sebagai kebenaran.
- **M7** — Pembatalan (void/retur) = **jurnal pembalik** (field `reversed_entry` sudah tersedia). Jurnal berstatus `posted` tidak pernah di-edit atau di-delete.
- **M8** — Mutasi stok bernilai uang (HPP/FIFO) hanya lewat service stok yang ada (row-lock, konsumsi layer FIFO). Dilarang mutasi stok langsung di view.

## API — Endpoint & Kontrak

- **API1** — Authorization di backend: permission class + `get_queryset` scoping. Menyembunyikan menu di frontend ≠ keamanan.
- **API2** — Verb dikunci: GET tanpa side effect; perubahan data hanya POST/PATCH/DELETE dengan permission yang tepat.
- **API3** — Endpoint list wajib pagination eksplisit (pola `OptionalPageNumberPagination`; frontend pakai `fetchAllPages()` dengan cap 50.000).
- **API4** — Error response tidak membocorkan internal (no traceback ke client); pesan untuk pengguna dalam Bahasa Indonesia.
- **API5** — Dilarang mengubah kontrak endpoint lama (rename/hapus field, ubah bentuk response) tanpa persetujuan manager — frontend, bot WA, dan integrasi lain bergantung padanya.

## DB — Database & Migration

- **DB1** — Graph migration selalu **satu leaf**. Nama migration deskriptif.
- **DB2** — Dilarang mengedit migration yang sudah ada. Koreksi = migration baru.
- **DB3** — Migration data (backfill) harus punya reverse (atau `RunPython.noop` + alasan tertulis) dan aman dijalankan ulang.
- **DB4** — Dilarang menyentuh `db.sqlite3` langsung — itu data development user.
- **DB5** — FK/relasi lintas app baru (`api` ↔ `accounting` ↔ `hr`) wajib approval manager. Waspada circular import: `accounting` sudah meng-import `api.models` — arah sebaliknya pakai lazy import di dalam fungsi. Graph saat ini bebas cycle; jaga tetap begitu.

## T — Testing

- **T1** — Ikuti pola test yang ada: `APITestCase`, file `tests_*.py` per domain.
- **T2** — Endpoint baru minimal: happy path + matriks role (siapa 200, siapa 403) + satu edge case.
- **T3** — Test finansial wajib assert: (a) total debit == total kredit, (b) idempotensi — operasi 2x → jurnal tetap 1, (c) rollback saat gagal di tengah.
- **T4** — Dilarang melemahkan/menghapus/skip test yang ada supaya lulus. Test lama gagal = perbaiki kodenya atau eskalasi.
- **T5** — Sebelum status `review`: suite area yang disentuh lulus (mis. `python manage.py test api accounting`).

## R — Ranjau Spesifik Project

- **R1** — Empat pasang modul mirip **bukan duplikat** ([[Project Overview]] §3) — dilarang hapus/gabung.
- **R2** — God nodes (`apiClient`, `Order`, `Contact`, `CustomUser`, `IsOwnerOrManager`, `Product`, `JobBoard`): perubahan signature/perilaku wajib approval manager — dampaknya menyebar ke 85–163 titik.
- **R3** — Kode orders/inventory/pos baru masuk modul domain di package `api/views/` (sudah ada `orders.py`, `inventory.py`, `pos.py`, `users.py`) — dilarang menambah ke file monolitik. Extract-not-extend (`AGENTS.md`).
- **R4** — Alur settlement bergantung `settlement_status` + `accounting_payment_method`: setiap perubahan alur non-tunai wajib menjaga sale void tidak ikut ter-settle (dugaan bug aktif — T-104).
- **R5** — Bot WA (`wa_logic.py`, webhook Fonnte/Evolution, `AllowAny`) menulis `Order` tanpa manusia login — perubahan model/serializer Order wajib cek dampak ke alur bot.
- **R6** — `promo_engine.py` satu-satunya sumber kebenaran diskon/kupon/promo. Dilarang menghitung diskon versi sendiri di tempat lain (jurnal pun harus memakai hasil promo_engine).

## L — Larangan Keras (pelanggaran = task ditolak saat review)

- **L1** — Membuat ledger/buku besar ketiga.
- **L2** — Posting jurnal tanpa lewat `create_journal_entry()`.
- **L3** — Menambah pemakai baru ledger legacy `hr`.
- **L4** — Implementasi duplikat dari fitur yang sudah ada.
- **L5** — File melebihi hard limit: 1000 baris (Python maupun JSX). *(Diperbarui 2026-08-01 oleh user — sebelumnya 400/300, direvisi jadi 1000 untuk keduanya.)*
- **L6** — Uang dalam float.
- **L7** — Edit/hapus jurnal `posted`.
- **L8** — Endpoint tanpa permission server-side.
- **L9** — Melemahkan mekanisme security hasil audit (throttle, lockout, fail-closed, row-lock, idempotency key).
- **L10** — Mengerjakan task `in_progress` milik agent lain, atau bekerja di luar scope task yang diklaim.

## X — Wajib Berhenti & Eskalasi ke Manager

Ubah status task → `blocked`, tulis pertanyaan di note task, tandai di [[Agent Board]], **jangan lanjut menebak**, bila:

- **X1** — Aturan bertentangan (antar dokumen, atau dengan kondisi kode nyata).
- **X2** — Butuh perubahan skema pada god model (`Order`, `Contact`, `Product`, `CustomUser`).
- **X3** — Menemukan bug keamanan atau indikasi data korup.
- **X4** — Fix yang benar menuntut refactor melebihi scope/limit file.
- **X5** — Butuh dependency baru, FK lintas app, atau mengubah kontrak API lama.
- **X6** — Ragu. Bertanya di note task selalu lebih murah daripada salah arah.

## ✅ Checklist Definition of Done (isi di note task sebelum `review`)

- [ ] Scope persis sesuai note task (U1)
- [ ] Bukti akar masalah / desain approved ada di note task (B1/F1)
- [ ] Test baru lulus + suite area terkait lulus (T5)
- [ ] Migration baru? Jalankan `manage.py showmigrations <app>` terhadap `db.sqlite3` dev asli (bukan cuma test suite — `manage.py test` selalu migrate DB sementara dari nol, jadi tidak membuktikan migration sudah diterapkan ke DB nyata; insiden 2026-07-30, T-623 lolos 5/5 test tapi fitur Aset 500 di app nyata karena migration belum ter-`migrate`)
- [ ] Tidak melanggar satu pun L1–L10
- [ ] Tidak ada file melebihi hard limit (L5)
- [ ] Endpoint baru/berubah terdokumentasi di note task (F5)
- [ ] `graphify update .` sudah dijalankan (U7)
- [ ] [[Agent Board]] + daily note diupdate
