---
id: T-102
epik: "[[Integrasi Akuntansi-POS]]"
status: done
agent: Claude (manager)
prioritas: tinggi
depends_on: [T-101]
created: 2026-07-27
---

# T-102 — Desain Mapping Transaksi POS → Jurnal

*Desain oleh manager, berbasis verifikasi [[T-101 Verifikasi jembatan POS-Akuntansi]] + pembacaan `create_journal_entry()`, `PaymentMethod`, `POSSale`, `AccountingSettings`. Status `review` = menunggu approval user. Setelah di-approve → T-103 (implementasi) boleh diklaim executor.*

## 0. Fakta kunci yang mendasari desain

| Fakta | Bukti |
|---|---|
| `create_journal_entry()` sudah memvalidasi balance, periode tutup buku, lifecycle akuntansi (`is_active`, `accounting_start_date`), auto nomor `JU-YYYYMM-NNNN`, audit log, default `status=POSTED` | `accounting/services/journal.py:57-145` |
| `PaymentMethod` mencakup **CASH juga** (`payment_type` mis. 'Tunai'; `is_locked` untuk kas fisik) — bukan hanya non-tunai | `accounting/models/cashbank.py:36-64` |
| `POSSale.status`: `paid` / `hold` / `void`; punya `pajak`, `total`, `metode_bayar` (string), dan FK `accounting_payment_method` | `api/pos_models.py:6-73` |
| ⚠️ `accounting_payment_method` **tidak pernah diisi kode mana pun** (grep seluruh `api/` = hanya deklarasi model + migration 0086) → settlement selama ini berjalan di atas data kosong | temuan verifikasi 2026-07-27 |
| `AccountingSettings` belum punya field akun default penjualan/PPN; preseden pola sudah ada (`opening_balance_equity_account`) | `accounting/models/settings.py:39-48` |
| `settlement_status` hanya `unsettled`/`settled`; filter settlement tidak mengecualikan sale `void` maupun metode tunai | `api/pos_models.py:58-68`, `settlement.py:29-31` |

## 1. Keputusan arsitektur

- **D1 — Granularitas: per-sale, bukan rekap per-shift.** Satu `POSSale` paid = satu `JournalEntry` (`source_type=pos_sale`, `source_id=sale.id`). Alasan: idempotency per transaksi, jurnal pembalik void 1:1 (T-104), saldo akun transit otomatis cocok dengan settlement yang juga per-transaksi, drill-down jurnal → struk. Volume POS toko printing tidak akan membebani DB.
- **D2 — Satu jalur untuk tunai & non-tunai.** Karena `PaymentMethod` sudah memodelkan CASH, baris debit selalu `pm.account` — untuk tunai itu akun Kas fisik, untuk non-tunai itu akun piutang transit (yang kemudian dikreditkan settlement). Ini **menutup persis lubang T-101**: akun transit akhirnya punya sisi debit.
- **D3 — Momen posting: saat sale mencapai status `paid`.** Sale `hold` tidak dijurnal; dijurnal saat difinalkan.
  > ⚠️ **Koreksi 2026-07-27 (ditemukan saat review T-103)**: asumsi "hold→paid memanggil service yang sama" keliru — `POSSaleViewSet.http_method_names = ['get','post','head','options']`, tidak ada endpoint update/PATCH sama sekali. Sistem saat ini tidak punya jalur backend untuk finalisasi sale `hold` menjadi `paid`. Bukan defect T-103; ini gap pre-existing di seluruh sistem POS. Relevan untuk [[T-401 Requirement Kasir v2]].
- **D4 — Tanggal jurnal = `localdate(sale.created_at)`** — konsisten dengan pengelompokan settlement (`created_at__date`).
- **D5 — Diskon: net (v1).** Pendapatan dikreditkan sebesar nilai setelah semua diskon (manual/kupon/promo/penjualan/loyalti) — angka diskon per jenis sudah tersimpan di `POSSale` untuk pelaporan. Upgrade v2 (opsional, nanti): bruto + akun kontra "Diskon Penjualan" bila user ingin diskon tampak di Buku Besar.
- **D6 — PPN: baris sendiri.** Bila `pajak > 0` → KREDIT akun PPN Keluaran (bukan digabung ke pendapatan).
- **D7 — HPP di luar scope.** Posting HPP/persediaan terjerat ledger legacy (inventory & production masih menulis ke `hr`) — menunggu strategi T-206; dicatat sebagai T-107.
- **D8 — MDR tetap diakui saat settlement** (perilaku sekarang, benar secara akuntansi — biaya dipotong saat pencairan).

## 2. Mapping jurnal

Untuk setiap `POSSale` berstatus `paid` (nilai dari field DB, dihitung server — M6):

| Baris | Akun | Debit | Kredit |
|---|---|---|---|
| 1 | `sale.accounting_payment_method.account` (Kas fisik / piutang transit) | `total` | |
| 2 | `AccountingSettings.pos_sales_revenue_account` (baru) | | `total − pajak` |
| 3 *(hanya bila `pajak > 0`)* | `AccountingSettings.pos_ppn_output_account` (baru) | | `pajak` |

Balance terjamin: `total = (total − pajak) + pajak`. `kembalian` tidak pernah masuk jurnal (bukan pendapatan). Deskripsi entry: `"Penjualan POS {nomor}"`; description baris memuat metode bayar.

**Siklus non-tunai jadi utuh:**
1. Sale paid → `D Piutang Transit / K Penjualan (+ K PPN)`  ← *baru, T-103*
2. Konfirmasi Settlement → `D Bank (net) + D Biaya MDR / K Piutang Transit (gross)`  ← *sudah ada*
3. Saldo transit per metode kembali 0 setelah settle. ✅

## 3. Mata rantai yang hilang: pengisian `accounting_payment_method`

- Master metode bayar POS (model `POSPaymentMethod`, migration 0069) diberi FK `accounting_payment_method → accounting.PaymentMethod` (**string reference `'accounting.PaymentMethod'`, tanpa import** — preseden migration 0086; hindari circular import, DB5).
- Admin memetakan sekali di pengaturan; saat sale dibuat, mapping disalin ke `POSSale.accounting_payment_method` (snapshot — perubahan mapping tidak mengubah sale lama).
- **VERIFY-1 (executor T-103):** pastikan struktur `POSPaymentMethod` dan asal nilai `metode_bayar` di `create_sale()`/serializer; kalau master tidak memadai, eskalasi X6 sebelum menyimpang dari desain.

## 4. Gating — kapan posting aktif

Posting dijalankan **hanya bila semua terpenuhi**:
1. `AccountingSettings` ada, `is_active=True`, `initial_setup_completed_at` terisi;
2. `pos_sales_revenue_account` terkonfigurasi;
3. Tanggal sale ≥ `accounting_start_date`;
4. `accounting_payment_method` sale ter-resolve.

Perilaku:
- **Semua terpenuhi** → posting WAJIB dan atomic bersama pembuatan sale (M5): jurnal gagal = sale rollback.
- **Gagal syarat 1–3 (modul belum aktif/di-setup)** → skip tanpa error (POS harus tetap jalan seperti sekarang), log info.
- **Gagal syarat 4 saja (aktif tapi mapping metode belum diisi)** → ⚖️ **keputusan manager: sale TETAP diterima, posting di-skip + log warning** — kasir tidak boleh terblokir oleh salah konfigurasi; kelengkapan dipulihkan lewat **backfill command idempotent** (§6) setelah mapping dibetulkan. *Alternatif yang ditolak: memblokir sale (mengorbankan operasional) — user boleh veto saat approve.* Mitigasi: T-105 menambah indikator "sale paid belum terposting".

## 5. Idempotency (M4)

- `UniqueConstraint(fields=[source_type, source_id], condition=Q(source_id__isnull=False) & Q(reversed_entry__isnull=True), name="uniq_je_source_active")` di `JournalEntry` — jurnal pembalik (T-104, `reversed_entry` terisi) bebas dari constraint.
- Service: cek-ada-dulu → buat; tangkap `IntegrityError` → kembalikan entry yang sudah ada (race-safe).
- ⚠️ **Risiko concurrency nomor jurnal**: `_generate_entry_number()` rawan tabrakan `entry_number` (unique) saat dua sale bersamaan → service wajib retry singkat (≤3x) saat `IntegrityError` pada `entry_number`. Jangan mengubah generator global (dipakai jurnal manual).

## 6. Perubahan pendukung (masuk scope T-103)

1. **Perbaikan filter settlement** (`settlement.py`): sisi POS wajib `status='paid'` — sekaligus menutup dugaan bug T-101 (sale void ikut ter-settle); sisi Order tidak berubah di task ini.
2. **`settlement_status` untuk tunai**: tambah choice `not_applicable`; sale dengan `PaymentMethod` kas di-set `not_applicable` saat dibuat (tunai tidak pernah masuk batch settlement). Penanda kas: field baru `PaymentMethod.is_cash` (boolean, di-seed True untuk Tunai) — lebih tegas daripada mencocokkan string `payment_type`.
3. **Field baru `AccountingSettings`**: `pos_sales_revenue_account`, `pos_ppn_output_account` (FK Account, nullable, pola `opening_balance_equity_account`). UI pengaturannya menyusul (lihat §8).
4. **Backfill command**: `python manage.py backfill_pos_journals [--from --to --dry-run]` — posting jurnal untuk semua sale `paid` yang belum punya entry (aman diulang berkat §5). Dipakai untuk: (a) sale yang ter-skip karena salah konfigurasi, (b) opsional backfill historis bila user mau.

## 7. Struktur kode (F3, R3)

- Service baru: `accounting/services/pos_posting.py` (< 300 baris) — `should_post_sale()`, `post_pos_sale_journal(sale, actor)`, dipakai juga backfill command. Semua jurnal tetap lewat `create_journal_entry()` (M2).
- Call site: `api/pos_services.py` di akhir blok atomic `create_sale()` (dan titik hold→paid) — **lazy import di dalam fungsi** (DB5).
- Dilarang menaruh logic posting di view/serializer (F3) atau menulis `JournalEntry.objects.create()` langsung (L2).

## 8. Di luar scope T-103 (task lain)

- Jurnal pembalik void/retur + guard `settlement_status` saat void → **T-104**.
- Indikator "paid belum terposting" + rekonsiliasi shift vs jurnal → **T-105**.
- UI Pengaturan Akuntansi untuk 2 akun baru + mapping metode POS (frontend) → digabung ke **T-105** atau task frontend terpisah saat pecah kerja.
- HPP POS → **T-107** (menunggu T-206). Konsekuensi jujur: sampai T-107, Laba/Rugi ledger baru berisi omzet tanpa HPP POS.
- Loyalty point sebagai liability akrual → belum dirancang (v1: `diskon_loyalti` net ke pendapatan).

## 9. Kriteria terima implementasi (dipakai mereview T-103)

- [ ] Semua test T3: balance (D=K), idempotensi (2x panggil → 1 entry), rollback saat gagal di tengah
- [ ] Gating: modul nonaktif → 0 jurnal & sale sukses; aktif+lengkap → jurnal wajib; aktif+mapping kosong → sale sukses + warning + backfill memulihkan
- [ ] Tunai: `settlement_status='not_applicable'`, tidak muncul di batch settlement
- [ ] Non-tunai: transit terdebit saat sale, saldo transit 0 setelah settlement (test end-to-end dua langkah)
- [ ] `pajak > 0` → baris PPN terpisah; `pajak = 0` → 2 baris saja
- [ ] Sale `hold` tidak dijurnal; difinalkan → terjurnal sekali
- [ ] Sale `void` tidak pernah masuk batch settlement
- [ ] Tidak melanggar L1–L10; file baru < hard limit; migration satu leaf (DB1)

## Hasil

**✅ DI-APPROVE USER 2026-07-27, tanpa revisi** — termasuk dua keputusan manager: (1) sale tetap diterima saat mapping metode kosong (skip + backfill), (2) diskon net di v1. Desain ini mengikat untuk T-103; penyimpangan apa pun wajib eskalasi (X1/X6), bukan improvisasi.
