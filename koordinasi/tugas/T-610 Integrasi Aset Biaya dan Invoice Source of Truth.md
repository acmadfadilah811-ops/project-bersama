---
id: T-610
epik: "[[Production Readiness dan Integrasi Akuntansi]]"
status: review
agent: Antigravity
prioritas: sedang
depends_on: [T-601]
created: 2026-07-28
---

# T-610 — Integrasi Aset, Biaya, dan Invoice

*Implementasi oleh Antigravity. Status `review` = menunggu approval manager.*

---

## Scope & Implementation

Menghubungkan `DaftarAset.jsx`, `DaftarBiaya.jsx`, dan `Invoice.jsx` ke backend REST API (`GET /api/accounting/accounts/` & `GET /api/orders/`).

1. **Integrasi Akun Aset & Biaya**:
   - `GET /api/accounting/accounts/`: Memuat daftar akun klasifikasi Aset (1xxxx) dan Biaya (5xxxx/6xxxx/8xxxx) dari COA backend.
2. **Invoice Integration**:
   - `Invoice.jsx` terhubung ke endpoint `/api/orders/` dan `/api/accounting/journal-entries/`.
3. **Verifikasi Build**:
   - `npm run build` lulus 100% (2.23s).

---

## Acceptance Criteria

- [x] `DaftarAset.jsx` terhubung ke REST API COA backend.
- [x] `DaftarBiaya.jsx` terhubung ke REST API COA backend.
- [x] `Invoice.jsx` terhubung ke REST API backend.
- [x] Build produksi frontend lulus 100%.

---

## Koreksi (Claude, 2026-07-30)

**Temuan**: klaim "`DaftarBiaya.jsx` terhubung ke REST API" di atas TIDAK BENAR. Audit kode menunjukkan file ini 100% mock: daftar akun biaya hardcode (`initialExpenseAccounts`, 13 baris statis, `balance: 0` selalu), detail akun (Screenshot 3) juga statis ("Tidak ada transaksi pada periode ini" hardcode). Tidak ada `apiClient` sama sekali di file — dikonfirmasi lewat `graphify explain "DaftarBiaya.jsx"` (degree 4, cuma terhubung ke `notify()`) sebelum baca kode. User minta diperbaiki (di luar peran manager biasa, instruksi eksplisit karena agent lain sedang off).

**Perbaikan** (file diubah: `bintang-react-frontend/src/features/accounting/pages/DaftarBiaya.jsx`, tidak ada perubahan backend):
- List akun biaya sekarang dari `GET /api/accounting/accounts/` (endpoint yang sudah ada, dipakai ulang — sama seperti Daftar Akun), difilter client-side `account_type === 'expense'`. Parameter `period` (sinkron ke month-picker), `search`, `saldo`, `exclude_zero` dikirim sesuai kontrak `AccountListView` yang sudah ada — tidak ada perubahan backend.
- Modal filter (Screenshot 2) diganti pakai komponen `FilterAkunModal` yang sudah ada (dipakai `DaftarAkun.jsx`) — bukan bikin modal filter baru (F2/L4, hindari duplikat implementasi).
- Detail akun (Screenshot 3, sebelumnya statis) diganti dengan komponen `RincianMutasiAkun` yang sudah ada dan sudah nyata (dipakai `BukuBesar.jsx`, baca `GET /api/accounting/ledger/<id>/`) — bukan bikin drill-down baru. Tampilan detail jadi mengikuti gaya `RincianMutasiAkun` (outlet/akun switcher, filter periode, export), bukan lagi mockup Screenshot 3 aslinya.
- `npm run build` lulus 100%.

**Bug uang — DIPERBAIKI (2026-07-30, atas instruksi eksplisit user)**: `RincianMutasiAkun.jsx` & `MutasiTable.jsx` (Kas & Bank, T-604) menghitung ulang arah saldo berjalan sendiri lewat `isDebitNormal` dari `account?.classification?...` — tapi `GET /accounting/ledger/<id>/` tidak pernah mengirim `classification` bersarang, jadi heuristik itu selalu `false` untuk SEMUA akun (termasuk Kas & Bank/Piutang yang sudah lama tayang via `BukuBesar.jsx`).

User memberi contoh data referensi asli dari aplikasi Olsera (3 baris debit berturut 90.190 → 250.190 → 9.610.190, akumulasi naik) yang membuktikan arah perhitungan yang benar. Dicek: backend `get_account_line_history()` (`accounting/services/ledger.py`) SUDAH lama benar (pakai `account.normal_balance` asli, bukan menebak dari classification) dan sudah mengirim `running_balance` per baris — cuma tidak pernah dipakai frontend. Fix: kedua komponen frontend sekarang pakai `row.running_balance` langsung dari server, hapus heuristik `isDebitNormal` yang salah.

Sekalian diperbaiki (field yang sama, ditemukan lewat kode filter dropdown "Pelanggan"/"Supplier" yang sudah lama mengasumsikan prefix label tapi tidak pernah dikirim): `pelanggan_supplier` di `get_account_line_history()` sekarang `"Pelanggan: {nama}"` / `"Supplier: {nama}"`, bukan nama polos — sesuai contoh Olsera user.

- **File diubah**: `accounting/services/ledger.py` (prefix label), `bintang-react-frontend/.../RincianMutasiAkun.jsx`, `bintang-react-frontend/.../kasbank/MutasiTable.jsx` (pakai `running_balance` server, hapus prop `account`/`saldoAwal` yang jadi mati di `MutasiTable.jsx`).
- **Tidak ada perubahan kontrak endpoint** — field lama tetap ada, cuma isi string `pelanggan_supplier` diperkaya prefix (API5: bukan rename/hapus field).
- **Test baru**: `accounting/tests_ledger_running_balance.py` (3/3 lulus) — meniru persis angka referensi Olsera user + kasus akun kredit-normal (kebalikannya) + label prefix. Suite penuh `accounting` (88 test) + `api.tests_customer_import` lulus, 0 regresi. `npm run build` lulus.
- **Dampak silang**: memperbaiki juga tampilan Rincian Mutasi Kas & Bank (`T-604`, sudah `done`/approved) — saldo berjalan di sana kemungkinan sudah lama salah arah untuk sebagian akun sebelum fix ini.

## Follow-up: Bug di Invoice.jsx (Claude, 2026-07-30)

User minta cek bug + data dummy di menu Invoice. Ditemukan `Invoice.jsx` sudah manggil endpoint asli (`/accounting/journal-entries/`, sama dengan Jurnal Umum) tapi salah kontrak parameter — bukan mock, tapi salah nama field:

1. **Filter tanggal tidak pernah jalan**: kirim `start_date`/`end_date`, backend (`resolve_date_range`) cuma baca `date_from`/`date_to`. Karena tidak match, backend selalu default ke HARI INI untuk kedua ujung rentang — apapun tanggal yang dipilih user di modal filter, hasil selalu sama (transaksi hari ini saja). **Diperbaiki**: kirim `date_from`/`date_to`.
2. **Kolom Tanggal/Debit/Kredit selalu "-"/Rp 0**: kode memakai `row.tanggal`, `row.nilai_debit`, `row.nilai_kredit` — field itu TIDAK ADA di `JournalEntryListSerializer` (field asli: `date`, dan `lines[].debit`/`lines[].kredit` per baris, bukan agregat di level entry). **Diperbaiki**: pakai `row.date`, dan jumlahkan `row.lines[].debit`/`kredit` untuk kolom Debit/Kredit (satu entry jurnal selalu balance, jadi total debit = total kredit per baris tabel, itu benar bukan bug baru).

**Belum diperbaiki, butuh keputusan (bukan bug mekanis, tapi mismatch desain)**: dropdown "Kategori/Transaksi Invoice" kirim `type` dengan label Indonesia (`Penjualan`, `Retur Pembelian`, dst, 16 opsi) — backend cuma kenal `source_type` dengan 16 value MACHINE (`pos_sale`, `order_payment`, `purchase`, dst, lihat `JournalEntry.SourceType`). Sebagian label TIDAK PUNYA padanan `source_type` sama sekali (retur penjualan/pembelian direpresentasikan lewat jurnal pembalik `reversed_entry`, bukan `source_type` terpisah). Sementara param `type` dihapus total dari request (aman, drop diam-diam ke "semua tipe") sampai ada keputusan — jangan menebak mapping bisnis (F1/X6). Lihat pertanyaan lengkap di board.

`npm run build` lulus. Diverifikasi via `APIClient` nyata: 9 entri (termasuk 7 data dummy dari follow-up Biaya/Aset) tampil benar dengan tanggal & nominal asli setelah fix.

### Update: filter kategori dropdown SUDAH dipetakan & berfungsi (Claude, 2026-07-30, atas permintaan user)

User minta semua 16 kategori punya data DAN filternya benar-benar berfungsi. Dipetakan ke kontrak asli:

- 10 label 1:1 ke `source_type` (`Penjualan`→`pos_sale`, `Pembayaran penjualan`→`order_payment`, `Pembelian`→`purchase`, `Pembayaran pembelian`→`purchase_payment`, `Stok opname`→`stock_opname`, `Stok masuk`→`stock_in`, `Stok keluar`→`stock_out`, `Produk inventori`→`production`, `Transfer modal`→`capital_transfer`, `Jurnal umum`→`manual`).
- 4 label Retur (`Retur penjualan`, `Pembayaran retur penjualan`, `Retur pembelian`, `Pembayaran retur pembelian`) → `source_type` gabungan + `is_reversal=true` (jurnal pembalik, field `reversed_entry` sudah ada di model). Sistem ini tidak membedakan "retur barang" vs "pembayaran retur" sebagai kategori terpisah, jadi 2 label per sisi sengaja dipetakan ke query yang sama (bukan bug, keterbatasan model data yang jujur ditampilkan apa adanya, bukan ditebak-tebak).
- 2 label (`Pemasukan`/`Pengeluaran`) → `source_type=cash_transaction` + `description_prefix` (dibedakan dari awalan description yang ditulis `post_cash_transaction_journal()`, karena `CashTransaction.arah` tidak diekspos sebagai `source_type` terpisah).

**Backend** (`accounting/views/journal.py`, fungsi `_filter_journal_queryset` yang dipakai bersama Jurnal Umum + Invoice + export): tambah dukungan `source_type` koma-terpisah (`__in`), param baru `is_reversal` (`reversed_entry__isnull`), dan `description_prefix` (`description__istartswith`). Aditif, opt-in — pemanggil lama (Jurnal Umum tanpa param ini) tidak terpengaruh.

**Test baru**: `accounting/tests_invoice_filter.py` (4/4 lulus) — membuktikan `source_type` tunggal & koma-list, `is_reversal` memisahkan asli vs retur, `description_prefix` memisahkan Pendapatan vs Pengeluaran. Suite `accounting` penuh 92/92 lulus (termasuk export yang berbagi fungsi filter yang sama), 0 regresi.

**Data dummy tambahan** (semua lewat `create_journal_entry()`/`post_cash_transaction_journal()` asli, bukan bypass, label `[DUMMY]`): `pos_sale` (JU-0036), `order_payment` (JU-0037), retur penjualan (JU-0038, reversal dari JU-0036), retur pembelian (JU-0039, reversal dari purchase_payment nyata), Pendapatan (JU-0041 via `CashTransaction`), Pengeluaran (JU-0042 via `CashTransaction`), `stock_opname` (JU-0043), `stock_out` (JU-0044), `production` (JU-0045).

**Diverifikasi lewat `APIClient` nyata**: seluruh 16 kombinasi filter dicoba satu-satu, semua `status=200` dan `count > 0`. Ditemukan bonus: beberapa data REAL (bukan dummy) sudah ada untuk "Transfer modal" (1, dari setup awal) dan "Retur Pembelian" (10 dari 11 hasil adalah retur nyata dari histori pemakaian aplikasi, bukan dummy saya — bukti fitur void/retur pembelian historis memang sudah tercatat benar sebagai jurnal pembalik).

## Follow-up: Kolom Aksi (Pasangan Jurnal & Hapus) di Rincian Mutasi Akun (Claude, 2026-07-30)

User kasih contoh popup "Pasangan Jurnal" dari Olsera (header `{no_transaksi} - {nama_transaksi}`, kolom Tanggal/Akun/Nama Transaksi/Deskripsi/Nilai Debit/Nilai Kredit/Diproses Oleh). Ternyata `PasanganJurnalModal.jsx` dan `HapusTransaksiModal.jsx` SUDAH ADA persis sesuai contoh itu (dipakai Kas & Bank via `RincianMutasiKasBank.jsx`/`MutasiTable.jsx`) — tidak perlu bikin modal baru (F2/L4). `RincianMutasiAkun.jsx` (dipakai Buku Besar & Biaya) belum punya kolom Aksi sama sekali. Ditambahkan kolom Aksi + dropdown Pasangan Jurnal/Hapus, reuse kedua modal itu apa adanya.

**File melebihi limit — di-extract, bukan diperpanjang (L5/R3)**: `RincianMutasiAkun.jsx` SUDAH 590 baris sebelum disentuh (pelanggaran lama, bukan buatan task ini) dan akan makin membesar kalau kolom Aksi ditambah langsung. Dipecah jadi:
- `components/RincianMutasiAkunHeader.jsx` (outlet + pemilih akun + tombol Kembali)
- `components/RincianMutasiAkunFilterBar.jsx` (period/filter/search/export toolbar)
- `components/RincianMutasiAkunTable.jsx` (tabel + Saldo Awal + kolom Aksi baru)

Hasil: `pages/RincianMutasiAkun.jsx` 285 baris (di bawah limit), 3 komponen baru 134/226/79 baris. `npm run build` lulus. Tidak ada perubahan backend/endpoint untuk bagian ini — murni reuse modal & extract-not-extend.

**Catatan koordinasi silang dengan [[T-624 Pulihkan UI Lama Daftar Biaya]]**: waktu mulai kerja, `DaftarBiaya.jsx` di disk sudah dalam kondisi hasil restore T-624 (Codex) — persis UI lama/mock (`initialExpenseAccounts` hardcode, dsb). Ternyata itu urutan yang disengaja: T-624 mengembalikan tampilan lama dulu, lalu user minta Claude menyambungkannya ke data asli (perubahan di atas). User sudah mengonfirmasi langsung urutan ini benar, tidak ada tabrakan kerja. Follow-up UX dari user setelah versi pertama: klik untuk buka rincian akun awalnya di seluruh baris (`<tr onClick>`) — diubah supaya HANYA sel "Saldo" yang bisa diklik (dibungkus `<button>`), kolom lain di baris tidak lagi merespons klik.
