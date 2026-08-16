---
id: T-626
epik: "[[Production Readiness dan Integrasi Akuntansi]]"
status: done
agent: Claude
prioritas: tinggi
depends_on: []
created: 2026-07-31
---

# T-626 — Laba Rugi Satu & Multi Periode Source of Truth

**Verifikasi manager 2026-08-01 — CONFIRMED, promosi ke `done`.** Kedua halaman baca `accounting.JournalEntry` nyata, disclaimer perbandingan Laba Rugi Laporan Penjualan terbukti ada di kedua sisi, 7/7 test lulus. `ledger.py` (533 baris) aman setelah limit L5 naik ke 1000.

## Scope

User minta lanjut ke laporan Laba Rugi (Akuntansi) — Satu Periode & Multi Periode — dan minta disinkronkan dengan Laba Rugi yang sudah ada di Laporan Penjualan.

## Temuan awal

- `LabaRugiSatuPeriode.jsx` & `LabaRugiMultiPeriode.jsx`: 100% mock. Keduanya fetch ke `/accounting/ledger/` tapi hasil `await` dibuang begitu saja; seluruh baris akun hardcode `amount: 0`.
- `Laporan Penjualan > Laba/Rugi` (`reportListPenjualan.js` id `laba-rugi`, backend `rpt_laba_rugi` di `api/report_views.py:1096`) — SUDAH real & bekerja, tapi hitung dari `_sale_lines()` (Order+POS) dan `CashTransaction`, TIDAK LEWAT `accounting.JournalEntry`.

## Implementasi

- **Service baru**: `accounting/services/ledger.py::get_income_statement(date_from, date_to)` + `_income_statement_section()`. 5 seksi berdasar **nama klasifikasi COA** (Pendapatan, Harga Pokok Penjualan, Pengeluaran, Pendapatan Lain, Pengeluaran Lain) — bukan kode akun hardcode, supaya akun baru di klasifikasi yang sama otomatis ikut terhitung.
- **Sign akun kontra**: `amount` dihitung dari arah dasar `account_type` (revenue: kredit-debit, expense: debit-kredit) — SENGAJA tidak ikut membalik `is_contra` seperti `Account.normal_balance` biasa dipakai (`get_account_balances`/`get_account_movements`). Akibatnya akun kontra (Return Penjualan, Potongan Pembelian, dst) otomatis keluar negatif, dan subtotal section bisa flat-sum tanpa perlakuan khusus — persis asumsi desain UI lama (`reduce((acc,curr)=>acc+curr.amount,0)`).
- **Endpoint baru**: `GET /api/accounting/reports/income-statement/?date_from=&date_to=` (`IncomeStatementView`, `IsOwnerOrManager`).
- **Frontend**:
  - `LabaRugiSatuPeriode.jsx`: 1x call ke endpoint di atas, tampilkan section+total asli. Styling `isLink` (link kosmetik tanpa aksi di mock lama) dihapus.
  - `LabaRugiMultiPeriode.jsx`: 3x call paralel (1 per bulan quarter terpilih), digabung client-side per kode akun (union kode antar bulan, default 0 kalau tidak ada transaksi bulan itu). Total per bulan tetap dari server (M6), bukan dijumlah ulang di frontend.
- **Test baru**: `accounting/tests_income_statement.py` (5/5 lulus) — termasuk kasus akun kontra (Return Penjualan) net dengan benar, kalkulasi laba kotor/bersih, exclude tanggal di luar rentang, permission. Suite `accounting` penuh 104/104 lulus, `npm run build` lulus.

## ✅ Keputusan user (2026-07-31): Opsi 2 — tetap terpisah

User memilih: kedua laporan **sengaja dibiarkan terpisah** untuk tujuan berbeda (Laporan Penjualan = performa transaksi penjualan, Akuntansi = pembukuan resmi berbasis jurnal). Alasan user: dicek langsung ke aplikasi Olsera, di sana pun kedua laporan itu menampilkan angka yang berbeda — jadi ini bukan bug proyek ini, tapi pola yang memang lazim (2 laporan dengan sumber & tujuan berbeda).

**Mitigasi diterapkan**: disclaimer singkat ditambahkan di kedua sisi supaya user aplikasi tidak bingung kalau angkanya beda:
- `LabaRugiSatuPeriode.jsx` & `LabaRugiMultiPeriode.jsx` (Akuntansi): "Dihitung dari jurnal terposting ... bisa berbeda dari Laba Rugi di Laporan Penjualan ... sengaja terpisah untuk tujuan berbeda."
- `LaporanProduk.jsx` (`LabaRugiTable`, dipakai 2 tempat — accordion & detail penuh): "Dihitung dari transaksi penjualan (Order & POS) ... bisa berbeda dari Laba Rugi di menu Akuntansi ... sengaja terpisah untuk tujuan berbeda."

Tidak ada perubahan logika perhitungan di kedua sisi — murni penambahan teks penjelas. `npm run build` lulus setelah perubahan ini.

## Follow-up: Drill-down nominal akun ke Rincian Mutasi Akun (Claude, 2026-07-31)

User kasih contoh detail: nominal di Laba Rugi harus biru+bisa diklik, membuka tampilan persis Rincian Mutasi Akun (Buku Besar/Biaya) dengan kolom Tanggal/No.Transaksi/Nama Toko/Deskripsi(+sub-baris Pembeli/Supplier)/Debit/Kredit/Jumlah/Aksi, filter dropdown Semua/No.Transaksi/Tgl Transaksi/Pelanggan/Supplier, dan Aksi berisi dropdown Pasangan Jurnal.

**Backend**:
- `_income_statement_section()` (`accounting/services/ledger.py`) sekarang menyertakan `id` akun per baris — dibutuhkan `RincianMutasiAkun` untuk drill-down.
- `get_account_line_history()` ditambah `processed_by_name` per baris (dari `journal_entry.posted_by`/`created_by`, fallback "Sistem") — dipakai kolom "Nama Toko".
- Label `pelanggan_supplier` diubah dari "Pelanggan: X" jadi **"Pembeli: X"** (sesuai contoh baru user; sebelumnya "Pelanggan:" adalah tebakan saya sendiri, belum pernah dikonfirmasi presisi).
- `LedgerLineSerializer` +field `processed_by_name`.

**Frontend**:
- `RincianMutasiAkunTable.jsx` (dipakai bersama Buku Besar/Biaya — R1, sengaja tidak disentuh `MutasiTable.jsx`/Kas & Bank karena tidak diminta): kolom "Pelanggan / Supplier" diganti "Nama Toko" (`processed_by_name`); `pelanggan_supplier` pindah jadi sub-baris di sel Deskripsi (bersama `external_document_no` kalau ada).
- Filter dropdown `RincianMutasiAkun.jsx` +opsi "Tgl Transaksi" (dulu belum ada, sekarang match contoh user).
- `LabaRugiSatuPeriode.jsx`: nominal akun jadi tombol biru (`onViewAccount`), klik membuka `RincianMutasiAkun` (reuse, bukan bikin baru) untuk akun itu, rentang tanggal ikut filter Laba Rugi yang aktif. Fetch daftar akun (`/accounting/accounts/?semua_akun=true`) untuk dropdown pemilih akun di header drill-down.
- File 646 baris sebelum disentuh (pelanggaran lama L5) — dipecah jadi 4: `LabaRugiSatuPeriode.jsx` (296), `LabaRugiToolbar.jsx`, `LabaRugiFilterModal.jsx`, `LabaRugiSatuPeriodeReport.jsx`.

**Verifikasi**: suite `accounting` 104/104 lulus (termasuk 2 test lama yang disesuaikan ke label "Pembeli:"), `npm run build` lulus. Dicoba end-to-end via `APIClient` nyata: klik akun 40000 di Laba Rugi → `id` akun didapat → `GET /accounting/ledger/<id>/` mengembalikan baris asli dengan `processed_by_name`, `running_balance` benar (500.000 lalu 0 setelah retur).

**Multi Periode belum dapat drill-down ini** — di luar scope kali ini (user cuma kasih contoh untuk Satu Periode); bisa ditambahkan menyusul kalau diminta.

**Follow-up kecil**: nominal Rp 0,00 tidak lagi jadi tombol biru/klik (`LabaRugiSatuPeriodeReport.jsx::AccountRow` — kondisi `Number(item.amount) !== 0` ditambahkan), karena akun tanpa mutasi di periode itu memang tidak ada rincian untuk ditampilkan. `npm run build` lulus.

## Temuan sinkronisasi awal (arsip — sudah diputuskan di atas)

Dibandingkan hasil kedua laporan untuk periode sama (Juli 2026, data dummy sesi ini + data nyata):

| | Akuntansi (ledger) | Laporan Penjualan (sales) |
|---|---|---|
| Pendapatan | Rp 0 | Rp 2.704.000 |
| HPP | Rp 10.060.000 | Rp 885.000 |
| Laba Kotor | -Rp 10.060.000 | Rp 1.219.000 |
| Laba Bersih | -Rp 13.955.000 | Rp 1.669.000 |

Bukan bug — masing-masing benar untuk sumber datanya. Tapi ini bukti nyata dua "kebenaran" finansial berbeda hidup berdampingan di app yang sama, gaung temuan T-101/T-201 dari awal proyek ini (POS/Order historically belum terhubung penuh ke jurnal — sedang dikerjakan T-618, HPP-saat-jual masih backlog T-107).

**Pertanyaan untuk manager/user**:
1. Apakah `rpt_laba_rugi` (Laporan Penjualan) diarahkan ulang untuk memanggil `get_income_statement()` yang sama persis (single source of truth) — konsekuensinya laporan itu akan ikut menampakkan gap posting yang belum selesai (T-618/T-107), bisa terlihat seperti "rugi besar" sampai gap itu tertutup?
2. Atau kedua laporan sengaja dipertahankan terpisah (Laporan Penjualan = performa penjualan operasional, Akuntansi = pembukuan resmi berbasis jurnal) dengan disclaimer jelas di UI bahwa keduanya BUKAN angka yang sama?
3. Kalau opsi 1 dipilih — apakah menunggu T-618/T-107 selesai dulu, atau jalan sekarang dengan gap yang diketahui?

Tidak diputuskan sepihak karena menyangkut kepercayaan angka finansial yang ditampilkan ke user (F1).
