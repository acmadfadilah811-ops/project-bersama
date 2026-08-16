---
id: T-106
epik: "[[Integrasi Akuntansi-POS]]"
status: done
agent: Antigravity
prioritas: tinggi
depends_on: [T-103]
created: 2026-07-27
---

# T-106 — Test Integrasi POS-Akuntansi End-to-End

**Konteks**: T-101/T-102/T-103 sudah `done` & approved — POS sale (tunai & non-tunai) sudah auto-posting ke `accounting.JournalEntry`, settlement non-tunai juga sudah berjalan. Task T-106 BUKAN menambah fitur baru — tugasnya membuktikan alur itu benar end-to-end lewat endpoint API SUNGGUHAN (`APITestCase` + `self.client.post()`), bukan lewat pintasan service-level atau fixture yang di-preset manual.

## Pelajaran Penting (T-202 Review Lesson)

- **JANGAN me-preset field kunci** (seperti `accounting_payment_method` atau `settlement_status`) secara manual via ORM pada model fixture di `setUp()`.
- Test harus membuktikan bahwa alur API sungguhan (`POST /api/pos/sales/`, `POST /api/accounting/settlements/confirm/`, dst.) **sendiri yang me-resolve** `accounting_payment_method` dari request payload dan menginisialisasi `JournalEntry` dengan benar.

## Scope Test Coverage (5 Poin Wajib)

1. `POST /api/pos/sales/` sungguhan dengan metode **tunai** -> assert `POSSale` terbuat DAN `JournalEntry` terbuat otomatis dengan D=K benar, `accounting_payment_method` ter-resolve dari payload request.
2. `POST /api/pos/sales/` sungguhan dengan metode **non-tunai** -> assert resolusi `PaymentMethod` dari payload (nama/tipe) benar dan `settlement_status = 'unsettled'`.
3. Alur **settlement non-tunai** lewat endpoint API `GET /api/accounting/settlements/` dan `POST /api/accounting/settlements/confirm/` -> assert `JournalEntry` settlement terbentuk, akun transit di-debit/kredit dengan benar, status `POSSale` berubah jadi `'settled'`.
4. **Idempotency**: ulangi request/operasi yang sama -> tetap 1 `JournalEntry`.
5. **Dokumentasi Void (behavior saat ini)**: pembatalan sale via `POST /api/pos/sales/:id/void/` belum menghasilkan jurnal pembalik (scope T-104) -> sertakan 1 test yang membuktikan behavior saat ini secara eksplisit tanpa mencoba memperbaikinya (U1).

---

## Hasil

### IMPLEMENTASI TEST (Siap Review Manager)

- **File Baru**: `accounting/tests_pos_integration.py` (`POSAccountingIntegrationTestCase` yang mewarisi `APITestCase`).
- **Poin Test Ter-cover (6/6 Pass)**:
  1. `test_e2e_cash_sale_creates_journal_entry`: `POST /api/pos/sales/` dengan `metode_bayar: "Cash"` -> resolusi `accounting_payment_method` dan `settlement_status = 'not_applicable'` terbukti via API pipeline (tanpa preset ORM), `JournalEntry` terbuat (D Kas / K Revenue, D=K).
  2. `test_e2e_non_cash_sale_creates_journal_entry_transit`: `POST /api/pos/sales/` dengan `metode_bayar: "QRIS"` -> resolusi `accounting_payment_method` dan `settlement_status = 'unsettled'`, `JournalEntry` terbuat (D Transit / K Revenue, D=K).
  3. `test_e2e_settlement_workflow_via_api`: Alur settlement lengkap via REST API: `GET /api/accounting/settlements/` -> `POST /api/accounting/settlements/confirm/` -> `JournalEntry` settlement terbuat (D Bank / K Transit, D=K), `POSSale.settlement_status` berubah jadi `'settled'`.
  4. `test_e2e_idempotency_posting_sale` & `test_e2e_idempotency_settlement_list`: Panggilan ulang posting / re-check settlement list tidak menghasilkan duplikat `JournalEntry` atau sisa batch.
  5. `test_document_current_void_behavior`: `POST /api/pos/sales/:id/void/` mengubah `POSSale.status` ke `'void'`, namun `JournalEntry` asli tetap berstatus `'posted'` (mendokumentasikan behavior saat ini sebelum T-104).

### Status Running & Verifikasi Test
- `python manage.py test accounting.tests_pos_integration`: **6 passed, 0 failed**.
- `python manage.py test api accounting`: **163 passed, 3 pre-existing failures** (bebas regresi baru).
- `graphify update .`: **4241 nodes, 12616 edges, 335 communities**.

---

### ✅ Review Manager — APPROVED `done` (2026-07-27)

Diverifikasi independen (baca kode + jalankan ulang test, bukan percaya laporan):
- `python manage.py test accounting.tests_pos_integration` diulang → **6/6 pass**, cocok.
- `python manage.py test api accounting` diulang → **166 test total, 163 pass, 2 fail + 1 error** — persis 3 kegagalan pre-existing yang sama (`test_orders_list_and_create_api`, `test_hanya_berlaku_di_kanal_online`, `test_preview_tidak_menyimpan_apa_pun`), nol regresi baru.
- Scope dicek via `git status`: hanya 2 file baru (`accounting/tests_pos_integration.py` + note task ini) — tidak ada kode T-102/T-103 yang tersentuh.
- Setiap klaim teknis di test di-cross-check ke kode asli: `AccountType.ASSET` (TextChoices, `accounting/models/coa.py:4`), `code_range_start`/`code_range_end` (field asli di `AccountClassification`), response shape `SettlementListView` (`total`/`results`, `accounting/views/settlement.py:27-32`) dan `SettlementConfirmView` (`confirmed_count`/`journal_entries`, baris 63-68), field `SettlementBatchSerializer` (`payment_method_id`/`total_amount`) — semua akurat, tidak ada yang mengarang.
- **Poin paling penting**: test #1 dan #2 terbukti benar-benar menghindari jebakan T-202 — `accounting_payment_method` TIDAK di-preset di fixture sale, dan assertion membuktikan field itu ter-resolve otomatis lewat pipeline `POST /api/pos/sales/` sungguhan. `test_e2e_idempotency_posting_sale` memanggil `post_pos_sale_journal()` langsung (bukan lewat API) — ini SAH karena mengetes jaminan idempotency fungsi itu sendiri (skenario "dipanggil ulang untuk sale yang sama" secara alami tidak bisa dipicu lewat POST kedua, karena POST kedua akan bikin sale baru, bukan mengulang sale yang sama), bukan jalan pintas menghindari bagian sulit — resolusi payload sudah dibuktikan terpisah di test #1/#2.

Task ini **selesai, tidak perlu revisi**. T-104/T-105/T-107 (Epik 1) masih backlog, siap diklaim berikutnya.
