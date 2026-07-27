---
id: T-101
epik: "[[Integrasi Akuntansi-POS]]"
status: done
agent: Claude Code (sesi 2026-07-27)
prioritas: tinggi
depends_on: []
created: 2026-07-27
---

# T-101 — Verifikasi jembatan POS → Akuntansi yang sudah ada

## Scope

Memetakan kondisi **sebenarnya** koneksi POS ↔ Akuntansi sebelum ada yang mulai implementasi. Read-only — task ini tidak mengubah kode sama sekali.

Pertanyaan yang harus terjawab:

1. Apakah `POSSale` saat ini menghasilkan `JournalEntry`? Lewat jalur mana (langsung / settlement / tidak sama sekali)?
2. `services/settlement.py` mencakup transaksi apa saja — non-tunai saja? Bagaimana tunai?
3. `create_journal_entry()` — generik atau khusus opening balance? Bisa dipakai ulang?
4. Mapping `PaymentMethod` → `Account` ("Atur Akun" di `views/cashbank.py`) — sudah lengkap dipakai di mana saja?
5. `SaldoKasHarian` / `RingkasanShift` — berhenti di rekap POS atau nyambung ke buku besar?
6. Void POS (`void_sale()`) — ada dampak jurnalnya sekarang?

## Cara kerja

```powershell
graphify path "POSSale" "JournalEntry"
graphify explain "settlement"
graphify query "bagaimana transaksi POS dicatat ke akuntansi"
graphify query "PaymentMethod account mapping"
```
Baru setelah itu baca file yang ditunjuk graph (bukan grep buta).

## Acceptance criteria

- [x] Keenam pertanyaan terjawab dengan bukti (file:baris atau output graph)
- [x] Diagram/tabel alur "yang sudah ada vs yang bolong" ditulis di bagian Hasil
- [x] Rekomendasi konkret untuk scope T-102/T-103 (revisi backlog kalau perlu)
- [x] Bagian "Kondisi awal" di [[Integrasi Akuntansi-POS]] diupdate dari ✳️ menjadi ✅/❌

## Hasil

*Dikerjakan Claude Code, 2026-07-27. Metode: `graphify path/query` → baca file yang ditunjuk graph → grep tertarget. Read-only, tidak ada kode diubah.*

### Jawaban 6 pertanyaan

**1. Apakah POSSale menghasilkan JournalEntry? — ❌ TIDAK saat penjualan.**
`create_sale()`/`void_sale()` di `api/pos_services.py` tidak menyentuh ledger mana pun (grep `journal|BukuBesar|Akun|settlement` = nol hasil). Satu-satunya jalur POSSale → JournalEntry adalah Konfirmasi Settlement manual (graph: 2 hop via `services/settlement.py`, EXTRACTED).

**2. Cakupan `services/settlement.py` — non-tunai saja, dan ada lubang akuntansi.**
Filter: `settlement_status="unsettled"` + `accounting_payment_method` terisi (`settlement.py:29-31`) — gabungan POSSale + Order per (tanggal, metode). Jurnal saat confirm: DEBIT bank tujuan (net) / DEBIT biaya MDR / **KREDIT `PaymentMethod.account`** (piutang transit) (`settlement.py:164-198`).
⚠️ **Lubang**: tidak ada jurnal sisi penjualan yang pernah MENDEBIT akun transit itu (D Piutang GoPay / K Penjualan tidak pernah dibuat siapa pun) → settlement mengkredit akun yang saldonya tidak pernah diisi → saldo transit jadi negatif dan **pendapatan POS tidak pernah tercatat** di ledger baru.

**3. `create_journal_entry()` generik? — ✅ YA.**
Definisi: `accounting/services/journal.py:58`. Pemakai saat ini 4 (semua internal accounting): jurnal manual (`serializers/journal.py:154`), saldo awal (`opening_balance.py:54`), import CSV (`journal_import.py:192`), settlement (`settlement.py:192`). Aman dipakai ulang untuk POS. Bonus: enum `SourceType` sudah menyediakan `pos_sale`, `purchase`, `stock_in/out`, `production`, `payroll`, `cash_transaction` (`models/journal.py:14-26`) — **desain integrasi sudah disiapkan, implementasinya yang belum ada**. Index `idx_je_source (source_type, source_id)` sudah terpasang → fondasi idempotency siap.

**4. Mapping PaymentMethod → Account — ✅ lengkap & siap pakai.**
`PaymentMethod` (`accounting/models/cashbank.py:36`): `account` (piutang transit), `mdr_debit_account`, `mdr_percent` — dipakai settlement (`settlement.py:132-160`). `Order` & `POSSale` sudah punya FK `accounting_payment_method` + `settlement_status` (migration `0086`; `api/models.py:196`, `api/pos_models.py:62`).

**5. SaldoKasHarian / RingkasanShift → buku besar? — ❌ TIDAK.**
Murni rekap POS (`api/models.py:904`). Nol referensi di `accounting/`, tidak posting ke ledger mana pun.

**6. Void POS → jurnal? — ❌ TIDAK, dan ada dugaan bug.**
`void` action (`api/pos_views.py:259`) → `void_sale()` tanpa dampak jurnal. ⚠️ **Dugaan bug**: `void_sale` tidak menyentuh `settlement_status`, dan filter settlement tidak meng-exclude sale ber-status void → POS non-tunai yang di-void bisa ikut ter-settle (dijurnal + ditandai settled padahal batal). **Verifikasi field status POSSale di T-104.**

### Temuan besar di luar scope (→ task baru, tidak dikerjakan di sini)

**DUA BUKU BESAR PARALEL HIDUP BERDAMPINGAN** — pelanggaran aturan #1 `AGENTS.md`:
- **Legacy**: `hr.Akun` + `hr.TransaksiBukuBesar`, dipakai oleh: pembayaran order DP/pelunasan (`api/views/orders.py:35` `record_payment_to_general_ledger()`, dipanggil dari `perform_create` L242 & action `bayar` L522), HPP/persediaan inventory (`api/views/inventory.py:19,34`), production cost (`api/production_models.py:29` FK ke `hr.Akun`), endpoint `/api/finance/transaksi/` (`hr/views.py:970`). Akun dibuat via `get_or_create` hardcoded.
- **Baru**: `accounting.JournalEntry` — hanya manual/saldo awal/import/settlement.
- Risiko nyata: Order non-tunai tercatat **dobel** (legacy saat bayar + ledger baru saat settlement) dan tidak lengkap di keduanya.
- → Dicatat sebagai **T-206** di [[Integrasi Akuntansi-Orders]].

### Tabel: alur uang vs pencatatan (kondisi sekarang)

| Alur uang | Ledger baru (`JournalEntry`) | Ledger legacy (`hr`) |
|---|---|---|
| POS tunai | ❌ | ❌ |
| POS non-tunai (saat sale) | ❌ | ❌ |
| POS non-tunai (saat settlement confirm) | ✅ D bank / D MDR / K transit | ❌ |
| POS void | ❌ (malah berisiko ikut settlement) | ❌ |
| Tutup shift kasir | ❌ | ❌ |
| Order DP/pelunasan | ❌ | ✅ D kas / K pendapatan |

### Rekomendasi scope T-102–T-105 (revisi backlog)

- **T-102 (desain)**: mapping D/K sale-time — tunai: D Kas POS / K Penjualan; non-tunai: D `PaymentMethod.account` / K Penjualan (baru settlement-nya nyambung benar). Putuskan juga: posting per-sale vs rekap per-shift; usulan: per-sale dengan `source_type=pos_sale, source_id=POSSale.id` (idempotent via `idx_je_source`). Sertakan perlakuan diskon/kupon/loyalty.
- **T-103 (implementasi)**: service di sisi accounting (mis. `accounting/services/pos_posting.py`) dipanggil dari `create_sale` — bukan logic di view. ⚠️ Risiko teknis: `accounting` sudah import `api.models` (settlement) — kalau `api.pos_services` import `accounting.services` balik, potensi circular import; pakai lazy import di dalam fungsi. Graph saat ini bebas cycle — jaga tetap begitu.
- **T-104 (void)**: jurnal pembalik (field `reversed_entry` sudah ada di model) + exclude sale void dari filter settlement + guard `settlement_status`.
- **T-105 (shift)**: relevan hanya jika T-102 memutuskan rekap per-shift untuk tunai; kalau per-sale, T-105 berubah jadi rekonsiliasi (bandingkan jurnal vs `SaldoKasHarian`).
