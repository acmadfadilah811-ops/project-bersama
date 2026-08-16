---
id: T-618
epik: "[[Production Readiness dan Integrasi Akuntansi]]"
status: done
agent: Codex manager, Claude
prioritas: tinggi
depends_on: [T-607]
created: 2026-07-29
---

# T-618 — Penjualan POS Source of Truth dan Posting Manual

## Bukti akar masalah

- `PenjualanDiToko.jsx` membaca `/api/pos/sales/`, tetapi memetakan field yang tidak ada pada serializer POS (`waktu_transaksi`, `pelanggan_nama`, `tanggal`). Tanggal/pelanggan tabel dapat salah.
- Status jurnal dan aksi Post/Post Pembayaran/Batal Post sebelumnya hanya mengubah state React; log transaksi juga dibuat lokal.
- Endpoint read-only `/api/accounting/sales/?source=pos&category=pos` sudah membaca `POSSale` dan `JournalEntry` asli, tetapi belum dipakai halaman ini.

## Desain disetujui user (2026-07-29)

| Alur | Keputusan |
|---|---|
| Daftar | Pakai endpoint Accounting Sales dengan `source=pos` dan `category=pos`; status berasal dari `JournalEntry`. |
| Post / Post Pembayaran | Satu jalur idempoten `post_pos_sale_journal()`. Pada POS lunas, pembayaran dan penjualan memang satu jurnal. |
| Mapping belum ada | Bila default PaymentMethod POS di Pengaturan dipilih, snapshot sale memakai metode itu; akun tujuan adalah akun transit dari metode tersebut. Bila kosong, posting ditolak jujur dan tidak mengira pembayaran sebagai kas. |
| Batal Post | Buat jurnal pembalik melalui `create_journal_entry()`, tidak mengubah/menghapus jurnal posted (M7). Sale tetap paid, tetapi tidak diposting otomatis ulang; endpoint Post menolak sale yang sudah dibalik. |
| Log | Format ringkas: `Aksi manual post POS dari #<nomor> oleh <email> pada <tanggal waktu>`, dari audit jurnal nyata. |

## Edge case wajib

- Batch diulang: satu jurnal aktif per sale (idempoten).
- Default mapping kosong/PaymentMethod tidak aktif: respons error per sale tanpa jurnal baru.
- Sale bukan `paid`, jurnal sudah dibalik, periode tutup buku, dan role selain owner/manager: ditolak server-side.
- Pembalikan tetap debit=kredit dan tercatat audit; tidak ada pemostingan ulang otomatis.

## Kontrak baru

- `POST /api/accounting/sales/pos/post/` — body `{"sale_ids": [1, 2]}`.
- `POST /api/accounting/sales/pos/cancel-post/` — body sama; pembalikan jurnal.
- `GET /api/accounting/sales/pos/<sale_id>/log/` — audit jurnal POS.
- `PATCH /api/accounting/settings/` menambah `pos_auto_post_enabled` dan `default_pos_payment_method`.

## Hasil

- **API action dan audit (2026-07-30):** `POST /api/accounting/sales/pos/post/`,
  `POST /api/accounting/sales/pos/cancel-post/`, dan
  `GET /api/accounting/sales/pos/<sale_id>/log/` diuji dengan API request nyata.
  Post dan cancel berulang idempoten, post ulang setelah reversal ditolak,
  role staff menerima 403, dan mapping PaymentMethod kosong menerima 400 tanpa
  membuat jurnal.
- **Bukti:** `accounting.tests_sales_actions`, `tests_pos_settings`,
  `tests_pos_void`, dan `tests_close_period` lulus 17/17. Guard periode tutup
  buku juga ikut lulus.
- **Belum ditutup:** perlu review UI Penjualan di Toko pada browser terautentikasi
  dan review independen sebelum status dapat berubah menjadi `done`.

## Catatan manager Codex — 2026-07-30

- Saya memperbaiki drawer **Pengaturan POS** yang sebelumnya hanya menyimpan state React dan daftar akun hardcoded.
- Pengaturan kini disimpan melalui `PATCH /api/accounting/settings/`: auto-post, baris diskon, metode pembayaran transit, dan sembilan akun default POS.
- Setelah simpan, drawer menampilkan ringkasan **Akun default aktif** serta tombol **Ubah**; konfigurasi tidak hilang saat drawer ditutup.
- Migration `0027_accountingsettings_pos_default_accounts` wajib diterapkan sebelum fitur dipakai di environment lain.
- Verifikasi: lint komponen dan production build lulus; `manage.py check`, `makemigrations --check --dry-run`, serta `manage.py test accounting.tests_pos_settings` (1/1) juga lulus.
- **Perbaikan lanjutan 2026-07-30:** migration `0027` sempat belum diterapkan pada database aplikasi. Hal ini membuat endpoint Settings gagal membaca kolom baru, sehingga wizard tampak kembali ke awal dan berhenti di Ringkasan. Migration kini sudah diterapkan; status setup aktual tetap aktif dan `initial_setup_completed_at` terisi. Regresi endpoint `complete-setup` ditambah dan lulus (2/2 test).
- **Audit auto-post 2026-07-30:** Saya menambahkan `POSPostingSettingsAuditLog` dan `GET /api/accounting/settings/pos-posting-logs/`. Perubahan aktif/nonaktif auto-post POS kini mencatat aksi, waktu, nilai sebelum/sesudah, nama pengguna, dan email. Tombol **Log** pada drawer menampilkan histori ini. Migration `0028` sudah diterapkan; test API 2/2, lint komponen, dan build frontend lulus.

## Verifikasi independen manager 2026-08-01 (sesi kedua) — ✅ PROMOTED TO `done`

Task ini `in_progress` milik Codex manager, bukan `review` — diambil alih
setelah dikonfirmasi user Codex sudah tidak aktif (catatan terakhir
2026-07-30, tidak ada progres 2 hari).

- `manage.py test accounting.tests_sales_actions accounting.tests_pos_settings
  accounting.tests_pos_void accounting.tests_close_period`: 19/19 lulus.
- Kontrak endpoint dikonfirmasi ada & terdaftar (`accounting/urls.py:71-73`):
  `POST /sales/pos/post/`, `POST /sales/pos/cancel-post/`,
  `GET /sales/pos/<id>/log/`.
- `PenjualanDiToko.jsx` dikonfirmasi memanggil endpoint asli ini persis
  sesuai kontrak (`fetchPenjualanToko` → `/accounting/sales/?source=pos&category=pos`,
  `handlePost`/`handlePostPayment`/`handleCancelPost` → endpoint post/cancel-post,
  `handleOpenRowLog` → endpoint log) — bukan lagi state React lokal.
- `AccountingSalesView` (`accounting/views/sales.py`) dikonfirmasi
  mengembalikan field persis yang diharapkan frontend (`source_id`,
  `payment_status`, `journal_status`).
- **Cek visual di browser TIDAK dilakukan** — user menolak instalasi
  ekstensi Claude in Chrome saat verifikasi ini berlangsung, dan secara
  eksplisit menyetujui task ditutup berdasarkan bukti kode+test saja
  (tanpa screenshot/klik manual), given evidence di atas cukup meyakinkan.
Status → `done`.
