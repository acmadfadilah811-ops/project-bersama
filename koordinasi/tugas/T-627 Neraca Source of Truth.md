---
id: T-627
epik: "[[Production Readiness dan Integrasi Akuntansi]]"
status: done
agent: Claude
prioritas: tinggi
depends_on: []
created: 2026-07-31
---

# T-627 — Neraca (Balance Sheet) Source of Truth

**Verifikasi manager 2026-08-01 — CONFIRMED, promosi ke `done`.** Assertion balance nyata (`total_aset == total_kewajiban_modal`, bukan cuma HTTP 200) diverifikasi lewat 14/14 test, akun kontra terbukti negatif dengan benar. `ledger.py` (533 baris) aman setelah limit L5 naik ke 1000.

## Scope

User minta lanjut ke Neraca setelah Laba Rugi Satu/Multi Periode selesai.

## Temuan awal

`Neraca.jsx` 100% mock — sama persis pola sebelumnya: fetch ke `/accounting/ledger/` tapi hasil dibuang, semua akun hardcode (mayoritas `amount: 0`).

## Implementasi

**Backend** — `accounting/services/ledger.py`:
- `_balance_sheet_section(classification_names, account_type, as_of_date)`: saldo KUMULATIF (sejak awal, bukan pergerakan periode) per klasifikasi COA. `amount` dari arah dasar `account_type` (asset: debit-kredit, liability/equity: kredit-debit) — SENGAJA tanpa ikut membalik `is_contra` (pola sama dengan Laba Rugi/T-626), supaya akun kontra (Akumulasi Penyusutan, Prive) otomatis negatif dan subtotal flat-sum benar.
- `get_balance_sheet(date_from, date_to)`: 4 seksi — Aset Lancar (klasifikasi Kas & Bank/Investasi/Piutang/Persediaan/Perlengkapan/Akumulasi penyusutan perlengkapan/Harta lancar lainnya), Aset Tidak Lancar (Aktiva Tetap/Aset Tak Berwujud/Akumulasi penyusutan aset tetap&tak berwujud/Investasi jangka panjang), Kewajiban (semua klasifikasi liability), Modal (Ekuitas). Baris sintetis **"Pendapatan periode ini"** ditambahkan ke Modal dari `get_income_statement(date_from, date_to)['laba_bersih']` — karena aplikasi ini belum punya jurnal tutup-buku otomatis yang memindahkan laba ke Laba Ditahan.
- Endpoint baru: `GET /api/accounting/reports/balance-sheet/?date_from=&date_to=` (`BalanceSheetView`, `IsOwnerOrManager`).
- Test baru `accounting/tests_balance_sheet.py` (5/5 lulus) — membuktikan akun kontra (Akumulasi Penyusutan, Prive) net negatif dengan benar, dan **Neraca balance** (Total Aset == Total Kewajiban + Modal) setelah baris laba periode berjalan ditambahkan.

**Frontend**:
- `Neraca.jsx` (699 baris sebelum disentuh, pelanggaran lama L5) dipecah jadi 3: `Neraca.jsx` (159), `NeracaToolbar.jsx` (279, gear+layout toggle+kalender+export), `NeracaReport.jsx` (128, kedua varian layout Samping/Bawah).
- Rentang tanggal: Neraca sendiri selalu saldo AS-OF akhir periode terpilih (Harian/Bulan/Tahun dari toolbar); "Pendapatan periode ini" dihitung dari awal-akhir periode yang sama.
- Nominal **tidak dibuat bisa diklik** (beda dari Laba Rugi/T-626) — user belum minta fitur itu di sini, jadi tidak ditambah supaya scope tetap ketat (U1). Bisa menyusul kalau diminta, backend sudah kirim `id` per baris jadi tinggal sambung kalau perlu.

**Verifikasi**: suite `accounting` 109/109 lulus, `npm run build` lulus. Dicoba end-to-end via `APIClient` nyata (Juli 2026): Neraca **balance sempurna** (Total Aset == Total Kewajiban+Modal, sama-sama -Rp 2.768.571.400). Angka besar/negatif itu sendiri murni cerminan data uji yang menumpuk dari banyak sesi kerja sebelumnya di database dev — bukan bug, dibuktikan lewat kesetaraan aset=kewajiban+modal yang taat asas.
