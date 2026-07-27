---
id: T-108
epik: "[[Bug QA Manual]]"
status: backlog
agent: 
prioritas: sedang
depends_on: []
created: 2026-07-27
---

# T-108 — Perbaiki 3 Test Pre-existing yang Gagal

## Scope

Ditemukan manager saat review [[T-103 Implementasi posting POS-Jurnal|T-103]] — dikonfirmasi **sudah gagal sebelum T-103** (diverifikasi via `git stash`, bukan regresi task manapun). Belum ada yang menyadari/menangani sebelumnya. Tiga test, kemungkinan 2-3 root cause berbeda — boleh dipecah agent kalau perlu.

1. **`api.tests.ApiTestCase.test_orders_list_and_create_api`** — `AssertionError: 400 != 201`. Endpoint create order menolak request yang harusnya valid di test. Cek `api/tests.py:167` vs validasi terbaru di `OrderViewSet`/serializer — kemungkinan ada field wajib baru (kupon/diskon dari commit terakhir: "Support coupons in orders creation") yang tidak diisi test lama.
2. **`api.tests_promo_engine.DiskonPenjualanTestCase.test_hanya_berlaku_di_kanal_online`** — diskon yang seharusnya cuma berlaku kanal online ikut ter-apply di kanal POS (`Decimal('10000.00') != Decimal('0')`). Cek `promo_engine.py` — kemungkinan pengecekan kanal (`kanal`/`channel`) hilang atau salah kondisi.
3. **`api.tests_promo_engine.IntegrasiPOSTestCase.test_preview_tidak_menyimpan_apa_pun`** — endpoint `/api/promo/preview/` return 404 (`HttpResponseNotFound`). Kemungkinan route belum terdaftar atau berubah path — cek `urls.py` vs test.

## Acceptance criteria

- [ ] Ikuti B1 (reproduksi dulu, satu test = satu concern — boleh 1 PR/commit per test kalau root cause beda)
- [ ] Akar masalah diperbaiki, bukan menyesuaikan assertion test ke perilaku salah (B2, T4 — dilarang melemahkan test)
- [ ] Kalau ternyata perilaku SEKARANG yang benar dan test-nya yang salah/using: eskalasi ke manager (X6) sebelum mengubah assertion, jangan asumsi sendiri
- [ ] Suite `api` penuh lulus setelah fix (`python manage.py test api accounting`)

## Hasil

*(diisi saat dikerjakan)*
