---
tags: [koordinasi, desain, payroll, bpjs, akuntansi]
created: 2026-09-21
status: menunggu-persetujuan
---

# Desain: Payroll (HR/Horilla) & BPJS → Akuntansi Bintang

> Wajib disetujui manager SEBELUM koding (Aturan Engineering **F1**: menyentuh uang & jurnal). Belum ada kode yang ditulis.

## 1. Tujuan
HR (Horilla) adalah **acuan penggajian** (keputusan user). Gaji bulanan yang sudah final di HR harus tercatat sebagai jurnal di akuntansi Bintang (Biaya gaji, Hutang gaji, BPJS), tanpa input ulang dan tanpa pencatatan ganda.

## 2. Kondisi sekarang (terbukti di VPS 2026-09-21)
- Payroll lama Bintang (`hr.SlipGaji`, `SlipGajiViewSet.pay_payroll`, hr/views.py:1238) mem-posting jurnal ke akun **`52100` dan `11100` yang TIDAK ADA** di COA (adanya 60100 Biaya gaji, 11101 Kas). Isinya 0 slip, 0 jurnal `payroll` → jalur **mati** (akan error bila dipakai).
- Slip HR: 1 slip (draft, data uji). **Nol** komponen Potongan (Deduction) → tidak ada BPJS/PPh sama sekali di HR. 1 Tunjangan ("Jabatan" 200.000) + tunjangan "Insentif Produksi" dari jembatan Bintang. Auto-generate slip aktif (tiap tanggal 1).
- HR sudah punya **iuran perusahaan** di Deduction (`employer_rate` → `employer_contribution_amount` tersimpan di `pay_head_data`). Jadi BPJS bisa dimodelkan **tanpa kode hitung baru**, cukup konfigurasi Deduction.
- Akuntansi Bintang punya pola baku: pemetaan akun di `AccountingSettings` + validasi fail-closed (contoh `services/purchase_accounts.py`), jurnal hanya lewat `create_journal_entry()` (M2), `SourceType.PAYROLL` sudah ada, pembalikan lewat `reversed_entry` (M7).
- Akun yang BELUM ada: Hutang gaji, Hutang BPJS, Beban BPJS perusahaan (dan Hutang PPh21 bila dipakai).

## 3. Arsitektur (Bintang MENARIK dari HR; tidak ada dorongan otomatis)
```
HR (baca-saja)                         Bintang
GET /api/insights/hr/payroll/  <────   Halaman "Posting Gaji" (Owner/Manager saja)
  ?tahun=&bulan=  (X-Api-Key)            1. Tarik ringkasan dari HR
                                         2. Pratinjau jurnal + pemeriksaan
                                         3. Klik "Posting" -> create_journal_entry()
                                         4. Simpan PayrollPosting (snapshot + hash)
```
- Kunci: `INSIGHTS_BRIDGE_API_KEY` (baca-saja; sudah dipakai insight). Bukan kunci tulis.
- Posting HANYA oleh Owner/Manager (M2), dipicu manual — bukan otomatis saat status HR berubah, supaya tidak ada jurnal muncul tanpa sepengetahuan finance.
- Angka SELALU ditarik ulang dari HR saat posting; angka kiriman browser tidak dipercaya (M6).

## 4. Endpoint HR baru (baca-saja)
`GET /api/insights/hr/payroll/?tahun=YYYY&bulan=M` → hanya slip berstatus `confirmed`/`paid` yang `end_date`-nya jatuh di bulan itu:
- `slip`: [{id, karyawan(pk), status, basic_pay, gross_pay, net_pay}]  (tanpa nama: id saja; nama diambil bila perlu untuk tampilan lewat pk)
- `komponen`: agregat per judul — `tunjangan` [{judul, total}], `potongan` [{judul, total, iuran_perusahaan_total}]
- `dikecualikan`: {draft: n, review_ongoing: n} (agar finance tahu ada yang belum final)
- `hash`: sidik jari isi (untuk deteksi perubahan setelah posting)

## 5. Pemetaan jurnal (inti F1)

### 5a. Pengakuan gaji (1 jurnal per periode/bulan) — `source_type=payroll`, `source_id=YYYYMM`
| Baris | Debit | Kredit |
|---|---|---|
| Biaya gaji (60100) = Σ gross − potongan pengurang beban (LOP/keterlambatan) | ✔ |  |
| Beban BPJS perusahaan (akun baru) = Σ iuran perusahaan | ✔ |  |
| Hutang gaji (akun baru) = Σ net_pay |  | ✔ |
| Hutang BPJS (akun baru) = Σ potongan BPJS karyawan + Σ iuran perusahaan |  | ✔ |
| Akun lain per pemetaan (mis. Hutang PPh21, Piutang karyawan/kasbon) = potongan terkait |  | ✔ |

Syarat seimbang: `gross + iuran_perusahaan = net + Σpotongan_karyawan + iuran_perusahaan` (Horilla: `net = gross − potongan`). Bila tidak seimbang → **ditolak**, tidak ada jurnal setengah jadi.

**Ilustrasi angka** (tarif hanya contoh — WAJIB dikonfirmasi, lihat §8): gaji pokok 3.000.000 + Jabatan 200.000 + Insentif 50.000 → gross 3.250.000. Potongan karyawan: Kesehatan 1% 30.000, JHT 2% 60.000, JP 1% 30.000 = 120.000 → net 3.130.000. Iuran perusahaan: Kesehatan 4% 120.000, JHT 3,7% 111.000, JP 2% 60.000, JKK 0,24% 7.200, JKM 0,3% 9.000 = 307.200.
- Dr Biaya gaji 3.250.000 · Dr Beban BPJS 307.200 = 3.557.200
- Cr Hutang gaji 3.130.000 · Cr Hutang BPJS 427.200 (120.000 + 307.200) = 3.557.200 ✔

### 5b. Pembayaran gaji ke karyawan (jurnal terpisah) — `source_type=payroll_payment`
- Dr Hutang gaji = Σ net · Cr Kas/Bank (dipilih Owner/Manager, akun Kas & Bank aktif) — pola sama `purchase_payments`.
- MVP: satu kali untuk seluruh periode. Pembayaran sebagian/per orang → pakai Transaksi Kas yang sudah ada (debit Hutang gaji).

### 5c. Setor BPJS/PPh ke pihak ketiga
- **Tanpa kode baru**: pakai Transaksi Kas Keluar yang sudah ada dengan akun debit = Hutang BPJS (diverifikasi Admin Finance → diposting Owner).

## 6. Alur status & koreksi
`Belum diposting → Diposting (versi 1) → [data HR berubah] → Berbeda dari HR → Koreksi (balik versi lama, M7 + posting versi baru)`
- Model baru `PayrollPosting` (periode unik per versi aktif, journal FK, payload snapshot, hash, posted_by/at, status aktif/dibalik). Kunci baris (`select_for_update`) saat posting agar klik ganda tidak menghasilkan jurnal ganda (M4/M5).
- Jurnal terposting **tidak pernah** diedit/dihapus; koreksi = jurnal pembalik (`reversed_entry`) + jurnal baru, keduanya atomik.
- Pembayaran (5b) tidak bisa dibuat sebelum pengakuan; bila pengakuan dibalik dan sudah ada pembayaran → tolak (balik pembayaran dulu).

## 7. Kasus tepi (harus lolos tes)
1. Ada slip `draft`/`review_ongoing` di bulan itu → tampil peringatan; posting hanya untuk yang final (opsi: tolak bila ada yang belum final — lihat keputusan D2).
2. Judul komponen HR belum dipetakan ke akun → posting **ditolak** (fail-closed), pesan menyebut judulnya.
3. Periode sudah Tutup Buku / sebelum Mulai Akuntansi → ditolak oleh `create_journal_entry`.
4. Posting dua kali (klik ganda/2 admin) → hanya satu jurnal.
5. HR mati/timeout → pesan jelas, tidak ada jurnal.
6. Slip berlintas bulan → dimasukkan ke bulan `end_date`; slip 1 hari (seperti data uji) tetap valid tapi diberi tanda.
7. Pembulatan: HR memakai float → dikonversi `Decimal(str())`, dibulatkan Rupiah per komponen; selisih bila ada → ditolak (tidak diserap diam-diam).
8. Potongan pengurang beban (LOP/keterlambatan) bukan kewajiban → mengurangi Biaya gaji, tidak dikreditkan ke hutang.
9. Slip berubah status kembali ke draft setelah diposting → terdeteksi lewat `hash`, tampil "Berbeda dari HR".
10. `federal_tax` (pajak bawaan Horilla ala AS) ≠ PPh21 Indonesia → bila bernilai >0 dan belum dipetakan → ditolak.

## 8. Yang BUKAN bagian rancangan ini (jujur)
- **PPh21** (progresif/TER): Horilla tidak punya PPh21 Indonesia. Tidak diimplementasi; komponen pajak harus dipetakan manual atau dibiarkan 0.
- **Tarif & batas upah BPJS** tidak saya kunci di kode. Tarif (Kesehatan, JHT, JP, JKK sesuai kelas risiko, JKM) dan plafon upah berubah berkala → dikonfigurasi di Horilla (Deduction) dan harus dikonfirmasi ke ketentuan BPJS terbaru + status kepesertaan perusahaan.
- Reimbursement HR → akuntansi (fase berikutnya).
- Tunai vs akrual, lihat D1.

## 9. Perubahan kode (setelah disetujui)
**Bintang**: (1) migrasi `AccountingSettings` +field pemetaan akun gaji; (2) model `PayrollPosting`; (3) `accounting/services/payroll_accounts.py` (validasi fail-closed) + `payroll_posting.py` (pratinjau, posting, koreksi, pembayaran); (4) endpoint + halaman "Posting Gaji"; (5) **matikan** `SlipGajiViewSet.pay_payroll` legacy (M3: ledger legacy dibekukan; jalur ini juga rusak); (6) tes: seimbang, idempoten, fail-closed, koreksi, periode tertutup, hak akses.
**HR**: endpoint `insights/hr/payroll/` + tes; konfigurasi Deduction BPJS (data, bukan kode).
**Akun baru** (dibuat lewat UI COA / seed): Hutang gaji, Hutang BPJS, Beban BPJS perusahaan.

## 10. Keputusan yang dibutuhkan dari manager/user
- **D1** Akrual 2 langkah (pengakuan + pembayaran) **atau** tunai 1 langkah saat dibayar? *Rekomendasi: akrual* (sistem ini sudah akrual untuk piutang/hutang pembelian).
- **D2** Posting hanya bila SEMUA slip bulan itu sudah final, atau boleh parsial? *Rekomendasi: semua final* (parsial menyulitkan koreksi).
- **D3** Apakah perusahaan terdaftar BPJS? Program mana (Kesehatan/JHT/JP/JKK/JKM)? Tarif & plafon resmi yang berlaku?
- **D4** Kode & nama 3 akun baru; boleh dibuat/seed?
- **D5** Setuju payroll lama Bintang dimatikan?
