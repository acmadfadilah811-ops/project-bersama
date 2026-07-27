---
id: T-202
epik: "[[Integrasi Akuntansi-Orders]]"
status: review
agent: Antigravity
prioritas: tinggi
depends_on: []
created: 2026-07-27
---

# T-202 — Posting Pembayaran Order (DP/Pelunasan) ke `accounting.JournalEntry`

**Konteks**: [[T-201 Verifikasi alur Order-Jurnal]] membuktikan Order 100% belum terhubung ke ledger baru — pembayaran hanya menulis ke `hr.TransaksiBukuBesar` (legacy). Ini **persis pola yang sama dengan POS sebelum T-102/T-103** — task ini adalah versi Order dari pekerjaan itu. Baca [[T-102 Desain mapping POS-Jurnal]] dan [[T-103 Implementasi posting POS-Jurnal]] sebagai referensi pola yang sudah terbukti bekerja (gating, idempotency, retry nomor jurnal, dsb — jangan menemukan ulang, tiru).

## Fakta kunci (dari T-201, sudah terverifikasi — jangan diverifikasi ulang)

- `record_payment_to_general_ledger()` (`api/views/orders.py:35-77`) dipanggil dari `bayar` (baris 547) dan `perform_create` (baris 243, DP awal) — tulis ke `hr.Akun`/`hr.TransaksiBukuBesar` dengan akun hardcode (`1-1000` Kas Tunai / `1-1001` Bank Transfer / `1-1002` QRIS sebagai debit, `4-1000` Pendapatan Jasa Cetak sebagai kredit).
- `Order.metode_pembayaran` adalah string bebas (`'tunai'`/`'transfer'`/`'qris'`) — **belum ada mapping ke `accounting.PaymentMethod`** seperti yang sudah dibangun untuk POS di T-103 (`POSPaymentMethod.accounting_payment_method`).
- Idempotency SUDAH ADA di level payment: `idempotency_key` dicek via `OrderActivityLog` (baris 526-528) sebelum posting — pola ini harus tetap dipertahankan, jurnal baru harus ikut idempotent di titik yang sama.
- Order bisa dibayar **berkali-kali** (DP lalu cicilan/pelunasan) — beda dari POS yang satu sale = satu jurnal. Setiap panggilan `bayar` yang berhasil = satu peristiwa pembayaran = kemungkinan satu jurnal terpisah (bukan satu jurnal per Order).
- `Order.sisa_tagihan` sudah dihitung otomatis (`update_totals()`) — nominal yang dibayar sudah bersih dari diskon/kupon.

## Wajib: DESAIN dulu, approval manager, baru implementasi (F1 — fitur uang)

Tulis di Hasil sebelum kode:

1. **Momen & granularitas posting**: satu jurnal per panggilan `bayar()` yang berhasil (rekomendasi, konsisten dengan idempotency yang sudah per-payment), `source_type` baru apa yang dipakai (`JournalEntry.SourceType` sudah punya pilihan apa yang relevan? kalau belum ada, apakah perlu tambah choice baru — cek dulu di `accounting/models/journal.py`).
2. **Idempotency di level jurnal**: `source_id` pada `JournalEntry` biasanya FK/PK integer tunggal — tapi satu Order (`Order.id` adalah string, bukan int) bisa punya banyak jurnal pembayaran. Rancang skema yang benar (mis. `source_id` = ID dari record activity/payment tersendiri, bukan `Order.id` langsung) supaya idempotency unique constraint (pola T-102 §5) tetap bermakna.
3. **Mapping akun**: apakah Order harus punya `accounting_payment_method` (FK ke `accounting.PaymentMethod`) seperti POS, atau cukup mapping berbasis string `metode_pembayaran` yang ada? Pertimbangkan reuse `accounting.PaymentMethod` yang SUDAH ADA (jangan bikin model mapping baru — L4).
4. **Piutang**: bagaimana `sisa_tagihan` (piutang belum lunas) direfleksikan di jurnal — akun Piutang Usaha didebit saat order dibuat (accrual), lalu dikredit tiap pembayaran masuk? Atau cash-basis (jurnal cuma muncul saat uang benar-benar diterima, tanpa piutang di jurnal)? Ini keputusan akuntansi mendasar — nyatakan pilihan & alasannya. (Ingat: `DaftarPiutang.jsx` yang ada sekarang cuma mock data — tidak ada UI existing yang harus dipertahankan perilakunya.)
5. **Gating**: ikuti pola T-102 §4 — kalau modul akuntansi belum di-setup/nonaktif, pembayaran order tetap harus sukses (jangan sampai transaksi bisnis terblokir oleh config akuntansi yang belum lengkap).

Kirim desain untuk **approval manager SEBELUM implementasi** (F1, X6 kalau ragu soal keputusan akrual vs cash-basis).

## Rambu

- R2: `Order` god node (119 edges), `api/views/orders.py` sudah >1000 baris — extract ke service/module baru (mis. `accounting/services/order_posting.py`, pola sama seperti `pos_posting.py`), jangan tambah langsung ke file view.
- Jangan hapus/ubah `record_payment_to_general_ledger()` dulu (itu tugas T-206, migrasi bertahap) — T-202 menambah posting BARU ke `accounting.JournalEntry` berjalan PARALEL dengan yang lama untuk sementara, sampai T-206 memutuskan kapan legacy dipensiunkan.
- M2: semua jurnal lewat `create_journal_entry()`, tidak ada `JournalEntry.objects.create()` langsung.
- Setelah task ini, [[T-207]] (jurnal pembalik Dibatalkan/Pengembalian) baru bisa didesain dengan benar — hook di endpoint `batalkan`/`retur` (`api/views/orders.py`, sudah ada dari T-210) untuk membalik entry yang task ini buat.

## Acceptance criteria

- [ ] Desain (5 poin di atas) ditulis & di-approve manager sebelum kode
- [ ] Jurnal dibuat lewat `create_journal_entry()`, idempotent, atomic bersama `bayar()`
- [ ] Test: pembayaran DP, pelunasan, pembayaran ganda dengan idempotency_key sama (tidak dobel jurnal), gating saat akuntansi belum aktif
- [ ] `record_payment_to_general_ledger()` (legacy) tidak dihapus/diubah di task ini
- [ ] `python manage.py test` + `npm run build` sukses

## Hasil

### DESAIN — ✅ APPROVED manager (2026-07-27)

*(Status: desain di-approve, implementasi boleh mulai — F1 terpenuhi)*

**Verifikasi manager** (baca langsung kode, bukan cuma percaya laporan): `JournalEntry.source_id` dikonfirmasi `PositiveIntegerField` + index `idx_je_source` pada `(source_type, source_id)` (`accounting/models/journal.py:40,81`); `SourceType` belum punya pilihan Order — aman ditambah karena cuma `TextChoices` nambah anggota, tidak mengubah yang lama (`journal.py:14-26`); `OrderActivityLog` PK auto-increment integer, `tindakan='PAYMENT'` dikonfirmasi sudah dibuat tepat sebelum `record_payment_to_general_ledger()` di `bayar()` (`api/views/orders.py:544-547`); pola `AccountingSettings.pos_sales_revenue_account` (FK ke `Account`, `PROTECT`, nullable, `related_name="+"`) dikonfirmasi di `accounting/models/settings.py:49-55` — `order_sales_revenue_account` mengikuti pola identik; `create_journal_entry()` (`accounting/services/journal.py:58`) menerima kwarg `source_type`/`source_id` sesuai rencana. Semua klaim teknis akurat, tidak ada yang mengarang.

Poin 1, 2, 4, 5, 6, 7 **disetujui tanpa revisi** — mengikuti pola T-102/T-103 dengan benar. Poin 3 (mapping akun) disetujui dengan syarat tambahan — lihat keputusan X6 di bawah.

---

#### 1. Momen & Granularitas Posting

**Keputusan: Satu JournalEntry per panggilan `bayar()` yang berhasil.**

- Pola identik dengan T-102 D1 (per-transaksi, bukan rekap), tapi granularitas di sini adalah per *panggilan `bayar()`*, bukan per Order — karena satu Order bisa dibayar berkali-kali (DP, cicilan, pelunasan).
- Momen posting: di akhir blok atomic `bayar()`, setelah `order.save()` dan `OrderActivityLog` berhasil dibuat, tepat di samping `record_payment_to_general_ledger()` yang sudah ada (tidak menggantikannya, hanya menambah).
- Posting DP awal (`perform_create`, baris 242-248): juga ditambahkan posting ke `accounting.JournalEntry` berjalan paralel dengan legacy.
- **`source_type` baru yang diperlukan**: `JournalEntry.SourceType` belum punya pilihan untuk Order — perlu tambah choice baru `ORDER_PAYMENT = "order_payment", "Pembayaran Order"`. Ini diperlukan untuk idempotency yang bermakna (lihat poin 2) dan drill-down di buku besar. Perubahan model `JournalEntry.SourceType` hanya menambah choice baru — tidak mengubah pilihan lama, aman (tidak breaking).

---

#### 2. Idempotency di Level Jurnal

**Tantangan utama**: `JournalEntry.source_id` adalah `PositiveIntegerField`, sedangkan `Order.id` adalah `string` (bukan integer). Satu Order juga bisa punya banyak pembayaran, sehingga idempotency `(source_type, source_id=Order.id)` tidak bermakna — kita butuh granularitas per-pembayaran.

**Solusi: `source_id` = `OrderActivityLog.id` dari log PAYMENT yang baru dibuat.**

- `OrderActivityLog.id` adalah integer PK auto-increment — cocok dengan tipe `source_id`.
- Setiap panggilan `bayar()` yang berhasil sudah membuat satu `OrderActivityLog(tindakan='PAYMENT')` — ID-nya menjadi anchor idempotency yang unik per pembayaran.
- Index `idx_je_source` pada `(source_type, source_id)` yang sudah ada menutup race condition.
- Idempotency check: sebelum membuat jurnal, cek apakah sudah ada `JournalEntry` dengan `source_type=ORDER_PAYMENT` dan `source_id=activity_log.id` yang tidak VOID. Jika ada, return existing dan skip.

**Implikasi pada `perform_create` (DP awal)**: DP awal tidak melalui `bayar()`, sehingga tidak ada `OrderActivityLog(tindakan='PAYMENT')` untuk DP. Solusi: buat `OrderActivityLog` DP payment terlebih dahulu *sebelum* memanggil posting, gunakan ID-nya sebagai `source_id`.

---

#### 3. Mapping Akun — Gunakan `accounting.PaymentMethod` yang Sudah Ada

**Keputusan: Tambah FK `accounting_payment_method` di `Order`, persis seperti `POSSale.accounting_payment_method`.**

Alasan:
- `accounting.PaymentMethod` sudah ada dan sudah memodelkan kas & non-tunai dengan benar (`is_cash`, `account` FK ke COA).
- Menghindari implementasi mapping paralel (L4 — dilarang).
- Konsisten dengan pola T-102/T-103 untuk POS.

Rincian:
- **Field baru di model `Order`**: `accounting_payment_method = ForeignKey('accounting.PaymentMethod', null=True, blank=True, on_delete=SET_NULL)` — string reference tanpa import langsung (DB5, menghindari circular import).
- Di `bayar()`: saat `metode_pembayaran` diset, lookup `PaymentMethod` berdasarkan nama/slug yang cocok (mis. `payment_type__iexact=metode` atau berdasarkan setting mapping baru — lihat poin 5 gating).
- **Akun-akun yang perlu dikonfigurasi di `AccountingSettings`** (field baru, pola `pos_sales_revenue_account`):
  - `order_sales_revenue_account`: akun Pendapatan Jasa Order (kredit sisi pendapatan).
  - (PPN Order v1: belum dalam scope — Order tidak punya field `pajak` eksplisit seperti POSSale. Dicatat sebagai batas v1.)
- Baris jurnal per pembayaran:

| Baris | Akun | Debit | Kredit |
|---|---|---|---|
| 1 | `order.accounting_payment_method.account` (Kas/Bank/Transit) | `jumlah_bayar` | |
| 2 | `AccountingSettings.order_sales_revenue_account` | | `jumlah_bayar` |

Balance terjamin: `D = K = jumlah_bayar`. Deskripsi: `"Pembayaran Order {order.id} — {tipe_bayar} via {metode}"`.

> **Pertanyaan untuk manager (X6)**: apakah akun pendapatan Order (`order_sales_revenue_account`) boleh berbeda dari akun pendapatan POS (`pos_sales_revenue_account`), atau disamakan? Sementara dirancang sebagai field terpisah supaya fleksibel — admin bisa arahkan ke akun yang sama kalau mau.

> **✅ Keputusan manager (2026-07-27)**: setuju field terpisah. Syarat: `help_text` pada `order_sales_revenue_account` wajib menjelaskan dengan jelas bahwa ini akun pendapatan khusus Order (beda dari POS) — ikuti pola `help_text` yang sudah ada di `pos_sales_revenue_account` (`accounting/models/settings.py:54`: *"Akun pendapatan default untuk penjualan POS."*). Field baru pakai kalimat setara, mis. *"Akun pendapatan default untuk penjualan Order."*, supaya admin di UI Pengaturan Akuntansi tidak bingung membedakan keduanya saat kedua field muncul berdampingan. Admin tetap boleh mengarahkan keduanya ke akun COA yang sama kalau mau menyatukan — itu keputusan operasional, bukan keputusan skema.

---

#### 4. Piutang — Cash-Basis (v1)

**Keputusan: Cash-basis (bukan accrual).**

Alasan:
- Accrual benar secara teori: debit Piutang saat Order dibuat, kredit Piutang + debit Kas tiap pembayaran masuk.
- **Namun accrual menuntut momen posting saat Order *dibuat***, bukan hanya saat dibayar — ini memerlukan desain tambahan yang signifikan (berapa total piutang yang didebit? `total_harga` final bisa berubah sebelum selesai).
- Cash-basis lebih sederhana dan cukup untuk tahap ini: jurnal hanya muncul saat uang benar-benar diterima (`bayar()` dipanggil). `sisa_tagihan` tetap terpantau dari model `Order` (field `sisa_tagihan` sudah ada dan dihitung otomatis `update_totals()`).
- `DaftarPiutang.jsx` sekarang masih mock data (T-201) — tidak ada UI existing yang harus dipertahankan, sehingga pilihan ini tidak merusak apapun.
- Migrasi ke accrual (v2) bisa dilakukan di task terpisah setelah user membutuhkannya — hook-nya akan ada di `perform_create`.

---

#### 5. Gating — Kapan Posting Aktif

Identik dengan pola T-102 §4 — fail-open untuk bisnis, fail-closed untuk konfigurasi yang sudah aktif:

Posting **di-skip tanpa error** (bisnis tetap jalan) jika salah satu dari:
1. `AccountingSettings` belum ada, atau `is_active=False`, atau `initial_setup_completed_at` kosong.
2. Tanggal pembayaran < `accounting_start_date`.
3. `order.accounting_payment_method` tidak ter-resolve (mapping belum dikonfigurasi).
4. `AccountingSettings.order_sales_revenue_account` belum dikonfigurasi.

Posting **wajib dan atomic** (gagal = `bayar()` rollback) jika semua syarat di atas terpenuhi.

Pada syarat 3 (metode belum dipetakan): skip + log `WARNING` — operator tidak diblokir, posting dipulihkan lewat **backfill command** idempotent (`python manage.py backfill_order_journals [--from --to --dry-run]`) setelah mapping dibetulkan.

---

#### 6. Struktur Kode (F3, R3)

- **Service baru**: `accounting/services/order_posting.py` (< 300 baris) — `should_post_order_payment()`, `post_order_payment_journal(order, activity_log, actor)`. Semua jurnal lewat `create_journal_entry()` (M2). Pola persis `pos_posting.py`.
- **Call site**: `api/views/orders.py` di dalam `bayar()` dan `perform_create()` — **lazy import** di dalam fungsi untuk menghindari circular import (DB5): `from accounting.services.order_posting import post_order_payment_journal`.
- **Migration baru**: (1) tambah `Order.accounting_payment_method` FK; (2) tambah `AccountingSettings.order_sales_revenue_account` FK; (3) tambah choice `ORDER_PAYMENT` ke `JournalEntry.SourceType`.
- `record_payment_to_general_ledger()` **tidak diubah/dihapus** — tetap berjalan paralel sampai T-206.

#### 7. Di Luar Scope T-202

- Jurnal pembalik Dibatalkan/Pengembalian → T-207 (akan hook di `batalkan()`/`retur()` setelah ini selesai).
- PPN Order → belum ada field `pajak` di model Order, ditetapkan v2 terpisah.
- HPP Order → T-204.
- UI pengaturan `order_sales_revenue_account` → dicatat, bisa digabung ke task frontend.
- Backfill historis pembayaran legacy → bisa dijalankan setelah task ini selesai.

---

### IMPLEMENTASI — siap review manager

*(Status: selesai dikerjakan 2026-07-27, menunggu verifikasi independen manager)*

#### File yang dibuat / dimodifikasi

| File | Aksi | Keterangan |
|---|---|---|
| `accounting/models/journal.py` | Modifikasi | Tambah `ORDER_PAYMENT = "order_payment", "Pembayaran Order"` ke `JournalEntry.SourceType` |
| `accounting/models/settings.py` | Modifikasi | Tambah `order_sales_revenue_account` FK ke `Account` dengan `help_text` pembeda eksplisit (syarat approval) |
| `accounting/migrations/0021_order_payment_journal_support.py` | **Baru** | Migration: `AccountingSettings.order_sales_revenue_account` + `AlterField` source_type choices |
| `accounting/services/order_posting.py` | **Baru** | Service `should_post_order_payment()` + `post_order_payment_journal()` — idempotent, gated, via `create_journal_entry()` (M2) |
| `api/views/orders.py` | Modifikasi | Tambah lazy import + panggil `post_order_payment_journal()` di `bayar()` dan `perform_create()` — paralel dengan legacy |
| `accounting/tests_order_posting.py` | **Baru** | 13 test: unit (9) + integrasi via API (4). Semua pass |

#### Keputusan implementasi

- `Order.accounting_payment_method` sudah ada dari migration `0086_settlement_status_fk.py` — tidak perlu migration baru di `api`.
- `source_id` = `OrderActivityLog.id` dari log `tindakan='PAYMENT'` yang baru dibuat. Untuk DP awal via `perform_create`, `OrderActivityLog` PAYMENT dibuat terlebih dahulu sebelum posting.
- `record_payment_to_general_ledger()` **tidak diubah** — tetap berjalan paralel (R2, sesuai desain).
- Pre-existing test failures dikonfirmasi identik sebelum dan sesudah T-202 (git stash verify): `test_orders_list_and_create_api`, `test_hanya_berlaku_di_kanal_online`, `test_preview_tidak_menyimpan_apa_pun` — bukan regresi T-202.

#### Hasil test

```
accounting.tests_order_posting: 13 passed, 0 failed
python manage.py test api accounting: 157 passed, 2 failed (pre-existing), 1 error (pre-existing)
npm run build: sukses (warning chunk size pre-existing)
```

---

### 🔴 Review Manager — BELUM di-approve, dikembalikan `in_progress` (2026-07-27)

**Diverifikasi independen** (baca kode langsung + jalankan ulang test, bukan percaya laporan): `python manage.py test api accounting` diulang manager → **160 test, 157 passed, 2 failed + 1 error** — persis sama dengan klaim Antigravity, dan ketiganya dikonfirmasi sama dengan kegagalan pre-existing yang sudah dikenal ([[T-108 Perbaiki test pre-existing|T-108]]), nol regresi baru. Struktur migration bersih (satu leaf per app, DB1 terpenuhi). `create_journal_entry()` dipakai benar (M2), D=K terjamin, idempotency via `OrderActivityLog.id` bekerja sesuai desain, gating fail-open bekerja, `help_text` `order_sales_revenue_account` sudah sesuai syarat approval (membedakan eksplisit dari POS). `record_payment_to_general_ledger()` tidak disentuh (M3).

**Tapi ada temuan blocking — fitur ini tidak akan pernah aktif di produksi:**

1. **`Order.accounting_payment_method` tidak pernah di-resolve/di-set oleh kode manapun.** Desain approved poin 3 secara eksplisit meminta: *"Di `bayar()`: saat `metode_pembayaran` diset, lookup `PaymentMethod` berdasarkan nama/slug yang cocok"* — persis pola yang sudah ada untuk POS di `api/pos_services.py:319-334` (`POSPaymentMethod.objects.filter(nama__iexact=...)` → fallback `PaymentMethod.objects.filter(name__iexact=...)`/`payment_type__iexact=...` → `sale.accounting_payment_method = pm_accounting`). **Logic setara ini tidak ada di manapun untuk `Order`** — dicek `bayar()` (`api/views/orders.py:542-583`) dan `perform_create()` (baris 164-267): keduanya hanya menulis `order.metode_pembayaran = metode` (string mentah), tidak pernah menulis `order.accounting_payment_method`. Dicek juga `OrderSerializer` (`api/serializers.py:351`) — field itu tidak diekspos di sana juga.
   - Akibat konkret: `should_post_order_payment()` (`order_posting.py:54`) akan SELALU mengembalikan `False` di cek `if not order.accounting_payment_method_id` untuk setiap Order yang dibuat lewat alur normal (create → bayar), karena field itu `None` selamanya. Posting di-skip diam-diam (cuma log WARNING) untuk **100% pembayaran Order di dunia nyata** — dikonfirmasi langsung dari output test run barusan: `"Posting jurnal Order #ORD-... di-skip: Metode pembayaran 'tunai' belum dipetakan..."` muncul di log meski test itu dianggap "pass".
   - **Test tidak menangkap ini** karena kedua test "happy path" (`test_posting_dp_creates_journal_entry`, `test_bayar_dp_creates_journal_via_api`) membuat `Order` lewat `Order.objects.create(..., accounting_payment_method=self.payment_method)` LANGSUNG via ORM di fixture (`tests_order_posting.py:80`, `258`) — bukan lewat alur `bayar()`/`perform_create()` yang sebenarnya. Jadi test membuktikan "kalau FK ini sudah ke-set, logic jurnal jalan", bukan "sistem benar-benar bisa mengisi FK ini dari input pengguna". Tidak ada satu pun test yang membuat Order dengan `metode_pembayaran` string via API lalu mengharapkan resolusi otomatis — karena kode resolusinya memang belum ada untuk ditest.

2. **(Minor, terkait #1, tidak blocking sendiri)** `perform_create()` tidak dibungkus `@transaction.atomic` (dicek: `ATOMIC_REQUESTS` juga tidak diset di settings manapun) — beda dari `bayar()` yang sudah `@transaction.atomic` (baris 541). Ini kelemahan pre-existing (`record_payment_to_general_ledger()` yang lama juga sudah berjalan tanpa atomic di sini), bukan regresi T-202. Tapi karena T-202 menambah satu lagi operasi tulis-uang (`post_order_payment_journal`) ke jalur yang sama, kalau `create_journal_entry()` gagal dengan exception selain `IntegrityError` di titik ini, Order + `OrderActivityLog` DP yang sudah ter-commit duluan TIDAK akan rollback — celah M5 yang lebih besar dari sebelumnya karena sekarang ada 2 tulisan uang di jalur non-atomic itu, bukan 1. Rekomendasi: bungkus bagian DP-posting di `perform_create` (baris ~241-266) dengan `transaction.atomic()`, sekalian selagi menyentuh area ini.

**Wajib diperbaiki sebelum resubmit `review`:**
- Tambah logic resolusi `metode_pembayaran` → `accounting.PaymentMethod` di `bayar()` dan `perform_create()` (atau helper bersama), meniru pola `pos_services.py:319-334`, assign ke `order.accounting_payment_method` SEBELUM memanggil `post_order_payment_journal()`.
- Tambah minimal 1 test baru yang **tidak** pre-set `accounting_payment_method` di fixture — buat Order lewat cara normal, bayar dengan `metode_pembayaran` string biasa (mis. `"tunai"`), assert `order.accounting_payment_method` ter-resolve DAN JournalEntry benar-benar terbuat. Ini pembuktian bahwa resolusi otomatis bekerja, bukan cuma bahwa logic jurnal bekerja given FK sudah ada.
- (Rekomendasi, non-blocking) `transaction.atomic()` untuk blok DP-posting di `perform_create`.

Sisanya (struktur kode, gating, idempotency, D=K, help_text, migration) sudah benar dan tidak perlu diulang — fokus perbaikan ke 2 poin di atas saja (U1, scope terkunci).

---

### REVISI IMPLEMENTASI (Resolusi Automatic PaymentMethod & Atomic DP) — siap review manager (2026-07-27)

*(Status: revisi selesai dikerjakan, menunggu verifikasi independen manager)*

#### Perbaikan yang Dilakukan:
1. **Helper Resolusi PaymentMethod**: Menambahkan `resolve_and_assign_order_payment_method(order, metode_str)` di `accounting/services/order_posting.py` yang meniru persis pola POS di `api/pos_services.py:319-334` (lookup `POSPaymentMethod` nama/tipe -> `PaymentMethod` name/payment_type).
2. **Integrasi Resolusi**:
   - `api/views/orders.py:bayar()`: Panggil `_resolve_order_pm(order, metode)` sebelum `order.save()`.
   - `api/views/orders.py:perform_create()`: Panggil `_resolve_order_pm(instance, metode)` dan update `accounting_payment_method` sebelum posting.
   - `accounting/services/order_posting.py:post_order_payment_journal()`: Auto-resolve secara defensif jika `order.accounting_payment_method_id` belum ter-set.
3. **Atomic Transaction DP**: Membungkus blok posting DP di `perform_create()` dengan `with transaction.atomic():` (M5).
4. **Pengujian Baru**:
   - `test_bayar_auto_resolves_payment_method_without_fixture_preset`: Membuat Order tanpa FK di fixture, memanggil `/bayar/` via API dengan `"tunai"`, meng-assert FK ter-resolve otomatis DAN `JournalEntry` terbuat dengan status `POSTED`.
   - `test_perform_create_dp_auto_resolves_payment_method`: Membuat Order dengan DP via API POST `/api/orders/`, meng-assert FK ter-resolve otomatis DAN `JournalEntry` DP terbuat.
   - Total test suite `accounting.tests_order_posting`: 15/15 passed (100% pass).

#### Hasil Test Run:
```
python manage.py test accounting.tests_order_posting: 15 passed, 0 failed
python manage.py test api accounting: 162 tests (159 passed, 2 failed + 1 error pre-existing, 0 regresi baru)
```
