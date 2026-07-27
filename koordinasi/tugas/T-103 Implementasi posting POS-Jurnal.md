---
id: T-103
epik: "[[Integrasi Akuntansi-POS]]"
status: done
agent: Antigravity
prioritas: tinggi
depends_on: [T-102]
created: 2026-07-27
completed: 2026-07-27
---

# T-103 — Implementasi Posting POSSale → JournalEntry

## Deskripsi
Implementasi posting otomatis transaksi `POSSale` (berstatus `paid`) ke `JournalEntry` berdasarkan desain ter-approve di [[T-102 Desain mapping POS-Jurnal]].

## Target Scope
1. **Service Posting Baru**: `accounting/services/pos_posting.py` (`should_post_sale()`, `post_pos_sale_journal(sale, actor)`).
2. **Field Tambahan di `AccountingSettings`**:
   - `pos_sales_revenue_account` (FK ke Account)
   - `pos_ppn_output_account` (FK ke Account)
3. **Mata Rantai `POSPaymentMethod` & `PaymentMethod`**:
   - Tambah FK `accounting_payment_method` di `POSPaymentMethod` (string ref `'accounting.PaymentMethod'`).
   - Field `PaymentMethod.is_cash` (Boolean, default False) untuk penanda kas fisik.
4. **Integration Point & Gating**:
   - Di `create_sale()` (`api/pos_services.py`).
   - `settlement_status` untuk tunai diset `not_applicable`.
5. **Perbaikan Filter Settlement**:
   - `settlement.py` hanya menyertakan sale `paid` (sale `void` atau `unpaid` tidak terikut).
6. **Backfill Command**: `manage.py backfill_pos_journals`.
7. **Unit Tests**: Menguji gating, idempotensi, balance debit/kredit, PPN, dan settlement.

## Hasil & Perubahan
- **File Baru**:
  - `bintang-advertising-backend/accounting/services/pos_posting.py`
  - `bintang-advertising-backend/accounting/management/commands/backfill_pos_journals.py`
  - `bintang-advertising-backend/accounting/tests_pos_posting.py`
  - `bintang-advertising-backend/accounting/migrations/0020_accountingsettings_pos_ppn_output_account_and_more.py`
  - `bintang-advertising-backend/api/migrations/0087_pospaymentmethod_accounting_payment_method.py`
- **File Diubah**:
  - `bintang-advertising-backend/accounting/models/settings.py` (tambah field `pos_sales_revenue_account`, `pos_ppn_output_account`)
  - `bintang-advertising-backend/accounting/models/cashbank.py` (tambah field `is_cash`)
  - `bintang-advertising-backend/api/models.py` (tambah field `accounting_payment_method` di `POSPaymentMethod`)
  - `bintang-advertising-backend/api/pos_services.py` (integrasi `resolve_and_assign_payment_method` & `post_pos_sale_journal`)
  - `bintang-advertising-backend/accounting/services/settlement.py` (penambahan filter `status='paid'` pada POSSale)
  - `bintang-advertising-backend/accounting/serializers/settings.py` (penambahan field baru ke serializer)
- **Verifikasi**:
  - Seluruh unit test di `accounting/tests_pos_posting.py` lulus (5/5).
  - Graph migration tetap satu leaf di `accounting` (0020) dan `api` (0087).
  - `graphify update .` berhasil dijalankan.

## Hasil Review Manager (2026-07-27)

**Verdict: BELUM di-approve `done`. Status dikembalikan ke `in_progress` — 2 perbaikan wajib sebelum resubmit.**

Metode review: baca semua diff (`git diff` + file baru), jalankan ulang 5 unit test secara independen (✅ lulus), jalankan suite penuh `api`+`accounting` (130 test → 3 gagal), isolasi pakai `git stash` untuk membuktikan ketiga kegagalan itu **sudah ada sebelum T-103** (bukan regresi — dikonfirmasi dengan menjalankan ulang 3 test itu di kode ter-stash, hasilnya identik gagal). Atomicity M5 diverifikasi langsung di `pos_services.py:301-310`: posting jurnal ada di dalam blok `with transaction.atomic():` yang sama dengan pembuatan sale — benar.

### 🔴 Wajib diperbaiki sebelum `done`

**1. Pelanggaran desain T-102 §4 — akuntansi belum lengkap bisa merobohkan transaksi kasir**
- Lokasi: `accounting/services/pos_posting.py:96-98`
- `should_post_sale()` tidak mengecek `pos_ppn_output_account`. Kalau sale punya `pajak > 0` tapi akun itu belum diisi di Pengaturan Akuntansi, `post_pos_sale_journal()` melempar `ValidationError` (Django core, bukan `rest_framework.exceptions.ValidationError` yang dipakai konsisten di `pos_services.py`) — DRF tidak menangkapnya jadi 400, kasir dapat 500 dan seluruh sale rollback.
- **Bertentangan langsung dengan keputusan manager yang sudah di-approve** ("kasir tidak boleh terblokir oleh salah konfigurasi").
- **Fix**: pindahkan pengecekan ke gating. Tambah di `should_post_sale()`: `if sale.pajak and sale.pajak > 0 and not settings_row.pos_ppn_output_account_id: return False, "Akun PPN Keluaran POS belum diatur."` — sale tetap tersimpan, posting di-skip + warning, backfill memulihkan nanti (pola yang sama persis dengan syarat gating lain).

**2. Deviasi dari desain T-102 §6 — `is_cash` seharusnya otoritatif, bukan sekadar salah satu sinyal**
- Lokasi: `api/pos_services.py:336-342`
- Saat `pm_accounting` berhasil ter-resolve dengan `is_cash=False`, kondisi `elif metode_str.lower() in ('cash','tunai')` tetap bisa membuat `is_cash_method=True` — string mengalahkan flag akuntansi yang sudah eksplisit diisi False.
- **Fix**: string fallback hanya boleh dipakai kalau `pm_accounting is None` (belum ter-resolve sama sekali). Kalau `pm_accounting` resolve, pakai `pm_accounting.is_cash` apa adanya (True maupun False), titik — jangan biarkan string menimpa.

### 🟡 Tidak blocking, tapi wajib dicatat

**3. Tiga test pre-existing gagal, tidak terkait T-103** (dipindah ke task terpisah, lihat [[T-108 Perbaiki test pre-existing]]):
- `api.tests.ApiTestCase.test_orders_list_and_create_api` (400 != 201)
- `api.tests_promo_engine.DiskonPenjualanTestCase.test_hanya_berlaku_di_kanal_online` (diskon "online-only" bocor ke kanal POS)
- `api.tests_promo_engine.IntegrasiPOSTestCase.test_preview_tidak_menyimpan_apa_pun` (404 di endpoint preview)

**4. Koreksi desain saya sendiri (T-102 D3), bukan defect Antigravity**: asumsi "hold→paid memanggil service yang sama" ternyata tidak berlaku — `POSSaleViewSet.http_method_names = ['get','post','head','options']`, artinya **tidak ada endpoint update/PATCH sama sekali** di backend untuk transisi status sale. Sale `hold` tidak punya jalur finalisasi backend saat ini (kemungkinan ditangani penuh di state frontend, atau memang gap lama di sistem). Tidak menuntut perbaikan di T-103 — dicatat di [[T-102 Desain mapping POS-Jurnal]] sebagai koreksi, dan flag untuk [[T-401 Requirement Kasir v2]] karena relevan dengan revisi UI kasir.

### Yang sudah benar (tidak perlu diubah)
Mapping D/K, PPN baris terpisah (untuk kasus akun sudah diisi), idempotency + retry `entry_number`, filter settlement `status='paid'`, backfill command (gating & dry-run benar), struktur file & migration.

---

### 🔄 Resubmission untuk Review Manager (2026-07-27)

Perbaikan terhadap 2 temuan wajib telah selesai diimplementasikan:

1. **Fix 1 (Pengecekan Gating PPN)**:
   - Pengecekan `pos_ppn_output_account` telah dipindahkan ke `should_post_sale()` di `accounting/services/pos_posting.py`.
   - Jika `sale.pajak > 0` dan `pos_ppn_output_account` belum diatur, `should_post_sale()` mengembalikan `(False, "Akun PPN Keluaran POS (pos_ppn_output_account) belum diatur di Pengaturan Akuntansi.")`.
   - Transaksi kasir tetap tersimpan aman tanpa error 500/rollback, posting di-skip + log warning, dan backfill dapat memulihkannya nanti.
   - Dibuat unit test `test_sale_with_ppn_missing_account_skips_posting`.

2. **Fix 2 (Otoritas `is_cash` dari `pm_accounting`)**:
   - Di `api/pos_services.py:resolve_and_assign_payment_method()`, jika `pm_accounting` ter-resolve, `is_cash_method = pm_accounting.is_cash` digunakan secara langsung dan eksplisit.
   - String matching fallback (`metode_str.lower() in ('cash', 'tunai')`) HANYA dievaluasi bila `pm_accounting is None`.
   - Dibuat unit test `test_resolved_non_cash_pm_overrides_string_name`.

**Status**: Mengajukan ulang untuk review manager (`status: review`). Unit tests 7/7 lulus (OK), `graphify update .` tuntas.

---

### ✅ Approval Final Manager (2026-07-27)

Diverifikasi independen (bukan sekadar percaya laporan):
- Baca langsung kode fix di `pos_posting.py:44-46` (gating PPN) dan `pos_services.py:336-339` (`is_cash` otoritatif) — keduanya persis sesuai instruksi.
- Jalankan ulang `accounting.tests_pos_posting` → **7/7 pass**, termasuk 2 test baru yang memang menguji tepat sasaran dua temuan (`test_sale_with_ppn_missing_account_skips_posting`, `test_resolved_non_cash_pm_overrides_string_name`).
- Jalankan ulang full suite `api`+`accounting` (132 test) → **persis 3 kegagalan pre-existing yang sama** (sudah di [[T-108 Perbaiki test pre-existing]]), nol regresi baru.
- `graphify update .` terkonfirmasi fresh.

**T-103 DITERIMA — status `done`.** T-104/T-105/T-106/T-107 sekarang tidak lagi terblokir dependency.
