---
id: T-710
epik: "[[Production Readiness dan Integrasi Akuntansi]]"
status: review
agent: Codex
prioritas: tinggi
depends_on: []
created: 2026-08-07
---

# T-710 - Setup COA dan Pembayaran Pembelian

## Scope

Memulihkan bootstrap COA pada instalasi baru dan membetulkan pencatatan
DP/pelunasan Pembelian supaya
pembayaran pada dokumen Butuh Diproses memakai akun serta jurnal yang tepat.

UI Daftar Akun lama dipertahankan sebagai `DaftarAkun.jsx`; wizard Pengaturan
Awal tetap terdiri dari tiga langkah seperti desain user.

## Desain disetujui user 2026-08-07

1. COA standar dibuat melalui bootstrap eksplisit yang idempoten, bukan data
   migration. Wizard tidak boleh selesai sebelum COA dan mapping pembelian siap.
2. Mapping Pembelian disimpan di `AccountingSettings`: Persediaan, Hutang
   Dagang, dan Uang Muka Pembelian. Default COA standar: 11400, 21000, 11710.
3. `PurchasePayment` menyimpan akun bayar, jenis `advance` atau `settlement`,
   dan snapshot akun. DP sebelum penerimaan dijurnal Debit Uang Muka / Kredit
   Kas-Bank. Pelunasan setelah penerimaan dijurnal Debit Hutang / Kredit Kas-Bank.
4. Status pembayaran diturunkan dari pembayaran nyata. Toggle tidak boleh
   membuat pembayaran tanpa pilihan akun.

## Mapping jurnal

| Kejadian | Debit | Kredit |
| --- | --- | --- |
| DP sebelum barang diterima | Uang Muka Pembelian | Kas/Bank terpilih |
| Penerimaan dan post stok | Persediaan | Hutang Dagang |
| Aplikasi DP saat penerimaan | Hutang Dagang | Uang Muka Pembelian |
| Pelunasan setelah penerimaan | Hutang Dagang | Kas/Bank terpilih |

## Acceptance criteria

- [x] COA dan klasifikasi standar dapat dibootstrap aman pada database kosong.
- [x] Setup awal menampilkan Daftar Akun dan tidak selesai tanpa mapping pembelian.
- [x] Pembayaran detail Pembelian menyimpan akun/jumlah/jenis secara persisten.
- [x] Jurnal seimbang, idempoten, atomik, dan pembalikan tetap audit-safe.
- [x] Test backend dan build frontend area terkait lulus.
- [x] `graphify update .` dijalankan (percobaan mencapai batas waktu 124 detik; tidak mengubah source).

## Hasil

### Koreksi owner 2026-08-08

Penambahan langkah keempat Daftar Akun dibatalkan. UI lama `DaftarAkun.jsx`
memang sudah ada di monorepo dan bukan desain langkah wizard. Wizard dipulihkan
ke tiga langkah: Cara Pembayaran, Pengaturan Akuntansi, Ringkasan. Langkah
pertama memuat daftar Cara Pembayaran, bukan langkah Daftar Akun terpisah.

- **Verifikasi koreksi UI**: `npm.cmd run build` lulus. Bundle frontend VPS
  `index-2RaPLxvO.js` diperiksa: tidak memuat `4. Ringkasan` dan memuat
  `1. Cara Pembayaran`.

- **Status**: `review`; menunggu verifikasi independen manager.
- **Backend**: `AccountingSettings` mendapat mapping Persediaan, Hutang Dagang, dan Uang Muka Pembelian. `PurchasePayment` kini menyimpan akun pembayaran, jenis `advance`/`settlement`, dan snapshot akun.
- **Endpoint baru**: `POST /api/accounting/settings/bootstrap-default-coa/` (owner/manager) untuk menjalankan COA standar idempoten.
- **Endpoint berubah**: `POST /api/accounting/settings/complete-setup/` menolak setup tanpa mapping akun Pembelian; `POST /api/purchases/{id}/add-payment/` wajib memakai akun Kas & Bank aktif dan menghitung DP/pelunasan dari status penerimaan.
- **Migration**: `accounting.0036_purchase_account_mappings`, `api.0100_purchasepayment_account_and_type`.
- **Jurnal**: DP = D Uang Muka Pembelian / K Kas-Bank; Stok Masuk = D Persediaan / K Hutang Dagang + aplikasi DP di jurnal Stok Masuk; pelunasan = D Hutang Dagang / K Kas-Bank. Semua lewat `create_journal_entry()` dengan source idempoten dan transaksi atomik.
- **Frontend**: wizard tetap tiga langkah; daftar Cara Pembayaran memuat akun Kas & Bank terkait, dan modal Pembayaran hanya menampilkan akun Kas & Bank serta menerangkan DP otomatis sebelum penerimaan. Toggle kini membuka modal pembayaran, bukan membuat transaksi tanpa akun.
- **Verifikasi lokal**: `manage.py check`, `makemigrations --check --dry-run`, migration dev database, 7 test `accounting.tests_purchase_payment_posting accounting.tests_pos_settings`, dan `npm.cmd run build` lulus.
- **Verifikasi VPS**: `accounting.0036` dan `api.0100` applied; 48 akun, 21 klasifikasi, mapping `11400/21000/11710`; `manage.py check` lulus.
- **Catatan deploy**: source VPS lama tidak memiliki migration `api.0098` yang ada pada worktree lokal. Untuk migrasi VPS, `api.0100` di VPS ditautkan ke leaf `api.0099` yang tersedia; sinkronisasi deployment berikutnya perlu membawa `api.0098` sebelum menyalin dependency lokal apa adanya.

### Perbaikan daftar dan Atur Akun 2026-08-08

- Root cause daftar kosong: `PaymentMethod` di VPS berjumlah `0`, padahal command
  idempoten `seed_payment_methods` sudah tersedia. Command dijalankan dan
  memuat 13 metode default, semuanya dipetakan awal ke `11101 - Kas`.
- Root cause dropdown akun hanya satu/kosong: `CashBankAccount` di VPS berjumlah
  `0`. Command idempoten `seed_cash_bank_accounts` dijalankan dan memuat enam
  opsi: `11101`, `11102`, `11103`, `11104`, `23000`, dan `23500`.
- Panel **Atur Akun** dipindahkan ke baris penuh di bawah toolbar ketika baris
  dicentang. Dropdown kini lebar penuh dengan lebar minimum 16rem; tombol
  Batal/Perbarui tidak lagi mendorongnya keluar dari modal.
- Modal wizard diperlebar dari `max-w-4xl` menjadi `max-w-6xl` dan tetap
  responsif pada layar kecil.
- Verifikasi: `npm.cmd run build` lulus; frontend VPS direbuild, container
  aktif, dan bundle aktif memuat label `Akun pembayaran untuk metode terpilih`.
