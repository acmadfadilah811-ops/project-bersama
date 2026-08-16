---
id: T-212
epik: "[[Integrasi Akuntansi-Orders]]"
status: backlog
agent:
prioritas: tinggi
depends_on: [T-211]
created: 2026-07-28
---

# T-212 — Implementasi Settlement Ledger-Based untuk Order

*Task implementasi hasil pemecahan [[T-211 Desain Partisipasi Order di Mesin Settlement|T-211]] (desain `done`, approved manager 2026-07-28). Baca bagian "Approval Manager — 2026-07-28 (FINAL)" di T-211 SEBELUM mulai — itu adalah kontrak yang mengikat task ini.*

## Scope

Implementasi Opsi B (ledger-based settlement) **HANYA untuk sisi Order** di `accounting/services/settlement.py`. Jalur POS (`pos_batches`/`pos_qs`, baris 50-55 & 139-144 saat ini) **DILARANG diubah** — sudah benar & sudah lolos test T-104/T-106.

1. Migration `accounting`:
   - `JournalEntryLine.settlement_status` — `CharField(max_length=20, choices=[not_applicable, unsettled, settled, void], default='not_applicable')`.
   - Index `idx_jel_settlement` pada `(account, settlement_status)`.
   - `UniqueConstraint(fields=['source_type','source_id','date'], name='uniq_je_source_date')` pada `JournalEntry`.
2. `accounting/services/order_posting.py`: baris DEBIT transit pembayaran non-tunai Order diberi `settlement_status='unsettled'` saat posting (T-202 sudah ada, ini revisi kecil).
3. `accounting/services/settlement.py`: ganti blok `order_batches`/`order_qs` dari query `Order.objects.filter(...)` langsung menjadi query `JournalEntryLine.objects.filter(account=pm.account, settlement_status='unsettled', journal_entry__date=batch_date)`. Tambahkan `select_for_update()` (row-lock) pada idempotency check + baris yang di-settle, di dalam blok `transaction.atomic()` yang sudah ada. Tangkap `IntegrityError` dari `UniqueConstraint` sebagai "sudah ada, kembalikan existing" (bukan 500).
4. Kontrak endpoint `GET /api/accounting/settlements/` & `POST /api/accounting/settlements/confirm/` (`accounting/views/settlement.py`) **TIDAK BERUBAH** — tidak perlu sentuh view/serializer kecuali internal service berubah.

## Acceptance criteria

- [ ] Migration baru (leaf tunggal), reverse aman (DB2/DB3).
- [ ] Blok Order di `settlement.py` pakai `JournalEntryLine` transit, blok POS tidak tersentuh sama sekali (diff review harus menunjukkan ini).
- [ ] Test idempotency: confirm batch yang sama 2x → tetap 1 `JournalEntry` (baik lewat app-level check maupun lewat `IntegrityError` catch).
- [ ] Test concurrency: 2 request confirm paralel untuk batch yang sama → tidak dobel jurnal (test dengan `select_for_update` + thread atau transaction test eksplisit).
- [ ] Test balance: total debit == total kredit tiap `JournalEntry` yang dihasilkan.
- [ ] Regression penuh `accounting` + `api` suite lulus, termasuk suite POS settlement lama (T-104/T-106) — pastikan benar-benar tidak ada perubahan perilaku di sana.
- [ ] Authorization tidak berubah (`IsOwnerOrManager` tetap).
- [ ] Tidak ada file melebihi hard limit (Python 400).
- [ ] `graphify update .` sudah dijalankan.

## Hasil

*(Diisi saat selesai — wajib sebelum status `review`/`done`)*

- **File diubah**:
- **Migration**:
- **Keputusan penting / catatan untuk agent lain**:
