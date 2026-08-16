---
id: T-211
epik: "[[Integrasi Akuntansi-Orders]]"
status: done
agent: Antigravity
prioritas: sedang
depends_on: [T-202]
created: 2026-07-28
---

# T-211 — Desain Partisipasi Pembayaran Order yang Dicicil di Mesin Settlement

*Dokumen desain arsitektur tertulis (F1, M1-M8). Dibuat oleh Antigravity berbasis temuan review T-202 & feedback manager. Status `review` = menunggu approval manager & user sebelum implementasi.*

---

## 0. Latar Belakang & Masalah Schema Aktual

| Kondisi | Penjelasan & Fakta Kode | Bukti Kode |
|---|---|---|
| **POS vs Order** | Transaksi POS (`POSSale`) dibayar 1x lunas (`POSSale.total` = nominal pembayaran). Sedangkan `Order` mendukung pembayaran **bertahap / dicicil** (DP 50%, Pelunasan 50%, tambahan biaya). | `api/pos_models.py:L6-L73`, `api/views/orders.py:L319-L334` |
| **Keterbatasan `settlement.py` Asli** | `settlement.py` melakukan `Order.objects.filter(_non_cash_filter()).annotate(total=Sum("total_harga"))`. `total_harga` merepresentasikan total nilai pesanan (misal Rp 2.000.000), bukan nominal aktual DP yang dibayar non-tunai saat itu (misal Rp 1.000.000). | `accounting/services/settlement.py:L61, L152` |
| **Karakteristik Schema `JournalEntry`** | In `accounting.models`, nama model baris jurnal adalah **`JournalEntryLine`** (bukan `JournalItem`). Atribut `source_id` pada `JournalEntry` adalah **`models.PositiveIntegerField`** (integer, bukan string). | `accounting/models/journal.py:L41, L91` |
| **Penetralan Sementara di T-202** | Di T-202, `resolve_and_assign_order_payment_method()` menyetel `order.settlement_status = "not_applicable"` untuk semua pembayaran Order agar Order tidak salah teragregasi di `settlement.py` sebelum ada desain T-211. | `accounting/services/order_posting.py:L115-L125` |

---

## 1. Persyaratan & Batasan Finansial (F1, M1-M8)

1. **M1**: Semua perhitungan nominal uang wajib menggunakan `Decimal` dengan quantize Rupiah.
2. **M2**: Pencatatan jurnal settlement HANYA melalui satu pintu `create_journal_entry()`.
3. **M4**: Settlement bersifat idempotent — `JournalEntry.source_id` (PositiveIntegerField) diisi `pm.id` (ID PaymentMethod) dengan `source_type=SETTLEMENT` dan `date=batch_date`.
4. **M5**: Operasi konfirmasi settlement (pembuatan jurnal + update status settled) dibungkus `transaction.atomic`.
5. **M7**: Pembatalan / reversal pembayaran yang sudah di-settle wajib menggunakan jurnal pembalik.

---

## 2. Perbandingan Pendekatan Arsitektur

### Opsi A — Domain-Driven Payment Entity (`OrderPayment` / `OrderActivityLog` per-pembayaran)

* **Konsep**: Memodelkan setiap peristiwa pembayaran Order sebagai entitas per-pembayaran individual (model `OrderPayment` baru atau memperluas `OrderActivityLog` tipe `PAYMENT`) yang memiliki atribut: `order_id`, `amount`, `accounting_payment_method`, `settlement_status` (`not_applicable` | `unsettled` | `settled` | `void`), dan `payment_date`.
* **Partisipasi di `settlement.py`**: `get_settlement_batches()` mengagregasi `POSSale` (1x bayar) + `OrderPayment` (per-pembayaran) yang berstatus `unsettled`.
* **Kelebihan**:
  - Sangat jelas secara domain bisnis (setiap kuitansi DP/pelunasan memiliki atribut settlement sendiri).
  - Memungkinkan DP via QRIS (non-tunai, `unsettled`) dan Pelunasan via Cash (tunai, `not_applicable`) terpisah secara alami.
* **Kekurangan / Risiko**:
  - Membutuhkan penambahan model baru (`OrderPayment`) atau perubahan schema pada `OrderActivityLog` (memerlukan approval eskalasi manager X2/X5).
  - Setiap modul bisnis baru di masa depan (misal Sewa Aset / Franchise) akan menuntut modifikasi subquery di `settlement.py`.

---

### Opsi B — Accounting-Centric / Ledger-Based Settlement (Membaca `JournalEntryLine` Transit) — 🌟 DIREKOMENDASIKAN

* **Konsep**: Mesin settlement tidak lagi melakukan query ke tabel-tabel bisnis (`POSSale`, `Order`), melainkan query langsung ke `accounting.JournalEntryLine` yang terdebit pada akun **Piutang Transit / Dana Menggantung** (`PaymentMethod.account`).
  - **Dibutuhkan usulan migrasi schema**: Menambahkan field `settlement_status` (`CharField(max_length=20, default='not_applicable')`) pada model `JournalEntryLine`.
  - Saat POS atau Order dibayar non-tunai, `order_posting.py` / `pos_posting.py` membuat `JournalEntry` dengan baris DEBIT `JournalEntryLine` pada akun transit `PaymentMethod.account` sebesar nominal `amount` pembayaran aktual, dengan `settlement_status='unsettled'`.
* **Partisipasi di `settlement.py`**:
  - `get_settlement_batches()` hanya query 1 tabel: `JournalEntryLine.objects.filter(account_id__in=pm_accounts, settlement_status="unsettled", debit__gt=0)`.
  - Grouping berdasarkan `(journal_entry.date, journal_entry.lines.account.payment_method)` → `Sum("debit")`.
* **Kelebihan**:
  1. **Decoupling Tertinggi**: Mesin settlement murni beroperasi di layer Akuntansi. `settlement.py` tidak perlu peduli apakah transaksi berasal dari POS, DP Order, Pelunasan Order, atau modul bisnis baru di masa depan.
  2. **Nominal 100% Presisi**: Nominal yang di-settle terjamin persis sama dengan angka yang diposting oleh `order_posting.py` (M1/M6), tanpa risiko salah hitung `total_harga` invoice vs nominal cicilan.
  3. **Tanpa Perubahan pada Model God `Order`**: Tidak perlu menambah model/FK baru di app `api`.
* **Kekurangan / Risiko**:
  - Membutuhkan usulan migrasi schema untuk menambah field `settlement_status` pada `JournalEntryLine`.

---

## 3. Detail Rancangan Arsitektur (Opsi B - Rekomendasi)

### 3.1 Lifecycle Status & Transisi

```text
[Pembayaran Order / POS] 
         │
         ▼ (order_posting.py / pos_posting.py)
   Posting Jurnal ───► DEBIT Transit (JournalEntryLine) [settlement_status: 'unsettled']
         │
         ├───► (User Konfirmasi Settlement via UI)
         │       └─► settlement.py ───► DEBIT Bank (cair) + DEBIT MDR / KREDIT Transit
         │                              [JournalEntryLine.settlement_status: 'settled']
         │
         └───► (Jika Pembayaran Dibatalkan / Void sebelum Settlement)
                 └─► Jurnal Pembalik (T-207) ───► KREDIT Transit [settlement_status: 'void']
```

| Status | Deskripsi |
|---|---|
| `not_applicable` | Pembayaran tunai (Kas fisik) — tidak pernah butuh settlement. |
| `unsettled` | Pembayaran non-tunai sudah diposting ke Jurnal Transit, menunggu pencairan bank. |
| `settled` | Dana sudah dikonfirmasi cair ke rekening Bank perusahaan oleh finance. |
| `void` | Pembayaran dibatalkan/dibalik sebelum sempat di-settle. |

---

### 3.2 Handling Nominal per-Pembayaran (DP & Pelunasan)

1. **Pembayaran DP Order Rp 1.000.000 via QRIS**:
   - `order_posting.py` membuat `JournalEntry #1`: DEBIT `JournalEntryLine` Akun Transit QRIS Rp 1.000.000 [`settlement_status='unsettled'`] / KREDIT Pendapatan Order Rp 1.000.000.
2. **Pembayaran Pelunasan Order Rp 1.000.000 via Transfer BCA**:
   - `order_posting.py` membuat `JournalEntry #2`: DEBIT `JournalEntryLine` Akun Transit BCA Rp 1.000.000 [`settlement_status='unsettled'`] / KREDIT Pendapatan Order Rp 1.000.000.
3. **Pencairan Settlement**:
   - `settlement.py` mengagregasi `JournalEntryLine` `unsettled` berdasarkan `payment_method_id` & `date`, menghasilkan nominal **Rp 1.000.000** (presisi per-pembayaran), bukan `total_harga` Rp 2.000.000.

---

### 3.3 Idempotency Key Kompatibel Schema (M4)

- Model `JournalEntry.source_id` adalah `models.PositiveIntegerField` (integer).
- Idempotency key settlement menggunakan kombinasi `source_type = JournalEntry.SourceType.SETTLEMENT`, `source_id = pm.id` (PositiveIntegerField milik `PaymentMethod`), dan `date = batch_date`:
  ```python
  existing = JournalEntry.objects.filter(
      source_type=JournalEntry.SourceType.SETTLEMENT,
      source_id=pm.id,
      date=batch_date,
      status=JournalEntry.Status.POSTED,
  ).first()
  ```
- Jika batch settlement yang sama di-confirm ulang pada tanggal yang sama untuk `PaymentMethod` tersebut, service mengembalikan `existing` entry tanpa menduplikasi jurnal.

---

### 3.4 Atomicity (M5)

- Eksekusi `confirm_settlement_batches()` dibungkus `with transaction.atomic()`:
  1. Buat `JournalEntry` settlement (D Bank, D MDR / K Transit).
  2. Update `JournalEntryLine` asal dari `unsettled` → `settled`.
  3. Jika terjadi kegagalan di tengah (koneksi DB terputus), seluruh jurnal & mutasi status di-rollback.

---

### 3.5 Reversal (M7 & Void/Retur)

* **Skenario 1: Order Dibatalkan SEBELUM Settlement**
  - Jurnal pembalik (T-207) membalik posting awal: KREDIT Transit / DEBIT Pendapatan Order.
  - `JournalEntryLine` transit awal diubah dari `unsettled` menjadi `void` (sehingga tidak muncul di list batch settlement).
* **Skenario 2: Order Dibatalkan SETELAH Settlement**
  - Uang non-tunai sudah cair di rekening Bank perusahaan.
  - Jurnal pembalik (T-207) membalik posting awal: KREDIT Bank (pengembalian dana ke pelanggan) / DEBIT Pendapatan Order.
  - Status `settled` pada settlement awal tidak diubah (karena dana bank memang sempat cair & kemudian dikembalikan).

---

### 3.6 Mapping Jurnal End-to-End

| Langkah | Baris Jurnal (`JournalEntryLine`) | Debit | Kredit | Status / Keterangan |
|---|---|---|---|---|
| **1. Posting Bayar DP Order (T-202)** | D: Transit PaymentMethod (11201)<br>K: Pendapatan Order (40100) | Rp 1.000.000<br>— | —<br>Rp 1.000.000 | `settlement_status = 'unsettled'` |
| **2. Posting Bayar Pelunasan (T-202)** | D: Transit PaymentMethod (11201)<br>K: Pendapatan Order (40100) | Rp 1.000.000<br>— | —<br>Rp 1.000.000 | `settlement_status = 'unsettled'` |
| **3. Konfirmasi Settlement (T-211)** | D: Bank BCA (11102)<br>D: Biaya MDR 1% (60500)<br>K: Transit PaymentMethod (11201) | Rp 1.980.000<br>Rp 20.000<br>— | —<br>—<br>Rp 2.000.000 | `settlement_status` berubah `'settled'`<br>Saldo akun transit kembali **Rp 0** |

---

## 4. Kesimpulan & Langkah Selanjutnya

- **Rekomendasi**: Menyetujui **Opsi B (Ledger-Based Settlement)** karena lebih bersih, decoupled dari model bisnis, presisi per DP/pelunasan, dan kompatibel dengan schema `JournalEntry` / `JournalEntryLine`.
- **Implementasi**: Menunggu approval tertulis dari manager sebelum eksekusi koding.

## Review Manager — 2026-07-28 (MASIH PERLU REVISI)

Schema dan opsi arsitektur sudah diperbaiki, tetapi desain belum siap disetujui karena belum menetapkan constraint unik/idempotency pada level database, strategi row locking untuk konfirmasi bersamaan, serta perilaku partial settlement dan refund secara normatif. Tambahkan keputusan final dan migration contract sebelum implementasi.

## Approval Manager — 2026-07-28 (FINAL)

Diverifikasi langsung ke kode: `accounting/services/settlement.py` (211 baris) dan `accounting/views/settlement.py` dibaca penuh. Kontrak endpoint yang sudah live hari ini: `GET /api/accounting/settlements/?date_from=&date_to=` (`SettlementListView`) dan `POST /api/accounting/settlements/confirm/` (`SettlementConfirmView`), keduanya `permission_classes=[IsOwnerOrManager]`. `get_settlement_batches()`/`confirm_settlement_batches()` SAAT INI masih query `Order.objects.filter(_non_cash_filter()...)` langsung (baris 57-61, 145-149) — kode lama peninggalan sebelum T-211, saat ini inert/kosong karena T-202 menyetel `order.settlement_status='not_applicable'`. Resolusi 4 poin revisi:

1. **Scope diperkecil — HANYA blok Order, jalur POS TIDAK disentuh.** `pos_batches`/`pos_qs` (query ke `POSSale`, baris 50-55 & 139-144) sudah benar & sudah lolos test T-104/T-106 (`POSSale.total` = nominal aktual dibayar, tidak ada masalah presisi seperti `Order.total_harga`). **Dilarang diubah** — U5 (diff minimal), hindari regresi ke jalur yang sudah production-approved. Opsi B HANYA menggantikan blok `order_batches`/`order_qs`.
2. **Kontrak API TIDAK BERUBAH.** `GET .../settlements/` dan `POST .../settlements/confirm/` tetap persis sama bentuknya (request/response/permission) — yang berubah murni sumber data internal Order (dari `Order.total_harga` → `JournalEntryLine.debit` transit). **T-605 boleh mulai terhadap kontrak ini apa adanya**, tidak perlu menunggu perubahan kontrak.
3. **Migration contract disetujui**:
   - `JournalEntryLine` + field baru `settlement_status`: `CharField(max_length=20, choices=[('not_applicable','Tidak berlaku'),('unsettled','Belum settle'),('settled','Sudah settle'),('void','Dibatalkan')], default='not_applicable')`.
   - Index baru: `models.Index(fields=['account', 'settlement_status'], name='idx_jel_settlement')`.
   - `JournalEntry` + **`UniqueConstraint(fields=['source_type','source_id','date'], name='uniq_je_source_date')`** — constraint DB-level sungguhan (bukan sekadar app-level check-then-act), resolusi poin revisi #1. `source_type` lain tetap aman: kombinasi `(source_type, source_id)` mereka sudah unik secara alami per M4, menambah `date` ke constraint tidak menabrak data sah yang ada.
   - `order_posting.py` (T-202): baris DEBIT transit pembayaran non-tunai Order diberi `settlement_status='unsettled'` saat posting. `Order.settlement_status` boleh tetap permanen `'not_applicable'` — sumber kebenaran settlement pindah ke `JournalEntryLine`, bukan `Order`.
4. **Row locking (resolusi poin revisi #2).** Di dalam `confirm_settlement_batches()` (`@transaction.atomic` sudah ada), tambahkan `select_for_update()` pada pengecekan idempotency DAN pada baris transit yang mau di-settle, dalam blok atomic yang sama:
   ```python
   with transaction.atomic():
       existing = JournalEntry.objects.select_for_update().filter(
           source_type=JournalEntry.SourceType.SETTLEMENT, source_id=pm.id, date=batch_date,
       ).first()
       if existing:
           entries_created.append(existing); continue
       lines_qs = JournalEntryLine.objects.select_for_update().filter(
           account=pm.account, settlement_status="unsettled", journal_entry__date=batch_date,
       )
       ...
   ```
   Row-lock mencegah race dalam proses yang sama; `UniqueConstraint` (poin 3) adalah jaring pengaman terakhir lintas proses — tangkap `IntegrityError` sebagai "sudah ada, kembalikan existing", jangan biarkan menjadi 500.
5. **Partial settlement: TIDAK didukung di v1.** Settlement selalu confirm satu batch penuh (payment_method+date) dalam satu `JournalEntry`. Selisih nominal cair riil vs total batch (mis. gateway shortpay) ditangani sebagai jurnal penyesuaian manual TERPISAH setelah batch di-settle penuh, bukan partial settlement — menjaga idempotency key 1:1 dengan 1 JournalEntry.
6. **Refund/reversal setelah settlement: ratifikasi §3.5 Skenario 2 (sudah benar).** Jurnal pembalik (T-207) untuk Order yang batal SETELAH settlement WAJIB membalik posisi Bank, BUKAN mengubah `settlement_status='settled'` pada `JournalEntryLine` asal (tetap immutable selamanya, L7). Reversal WAJIB bertanggal **hari ini** (tanggal aksi), bukan tanggal transaksi asli — pola ini sudah benar dipakai T-104 (`post_pos_void_journal` pakai `date=today`, `accounting/services/pos_posting.py:186`) dan WAJIB direplikasi persis oleh T-207. Ini otomatis aman terhadap guard periode tertutup di `create_journal_entry()` (`accounting/services/journal.py:104-105`, sudah ada & aktif) — reversal tidak pernah gagal gara-gara periode transaksi asli sudah closed.

**Disetujui. T-211 (desain) → `done`.** Implementasi dipecah ke task baru **[[T-212 Implementasi Settlement Ledger-Based Order]]** (backend: migration + refactor blok Order di `settlement.py` sesuai 6 poin di atas + test idempotency/concurrency/balance). T-605 (hubungkan frontend Settlement) depends_on diperbarui ke T-212, bukan T-211 — frontend menunggu backend Order-side selesai supaya batch yang ditampilkan sudah presisi.
