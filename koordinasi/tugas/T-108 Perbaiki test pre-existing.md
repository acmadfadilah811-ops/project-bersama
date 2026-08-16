---
id: T-108
epik: "[[Bug QA Manual]]"
status: done
agent: Antigravity
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

### Test 1: `test_orders_list_and_create_api` — FIXED ✅
- **Root cause**: `perform_create` di `api/views/orders.py:180-182` sekarang mewajibkan field `dilayani_oleh` (validasi baru dari T-209/T-210 untuk akuntabilitas karyawan). Test lama tidak mengisi field ini → 400.
- **Fix**: Tambahkan `"dilayani_oleh": self.owner.pk` ke data POST di `api/tests.py:165`. Test sekarang menyediakan data yang valid sesuai kontrak baru.
- **File diubah**: `api/tests.py` (1 baris ditambahkan ke data test)

### Test 2: `test_hanya_berlaku_di_kanal_online` — X6 ESCALATION ⚠️
- **Root cause**: `evaluate_sales_discount` di `api/promo_engine.py:458-497` **tidak mengecek `konteks.kanal` sama sekali**. Model `SalesDiscount` (`api/marketing_models.py:9-32`) juga tidak punya field `kanal`.
- **Dokumen saling kontradiksi**:
  - Docstring model: "hanya berlaku untuk Toko Online sesuai panduan Olsera"
  - Docstring fungsi: "sekarang berlaku untuk kanal apa pun yang memanggil (POS Terminal, Order/SPK), sehingga fitur ini benar-benar terpakai"
  - Test: ekspektasi diskon hanya untuk online
- **Keputusan manager DIPERLUKAN (X6)**:
  1. Jika SalesDiscount memang harus khusus online → perlu tambah field `kanal` ke model + migration + update engine
  2. Jika SalesDiscount sekarang berlaku semua kanal (sesuai docstring fungsi) → test perlu diupdate
- **Status**: 139/140 test lulus. Test ini satu-satunya yang masih gagal.

### Test 3: `test_preview_tidak_menyimpan_apa_pun` — FIXED ✅
- **Root cause**: URL `/api/promo/preview/` tidak terdaftar di `api/urls.py`. Test mengirim request ke endpoint yang tidak ada → 404.
- **Fix**: Buat `PromoPreviewView` di `api/marketing_views.py:217-261` (APIView standalone) + registrasi URL di `api/urls.py:153`. Endpoint ini mengevaluasi kupon + diskon penjualan tanpa menyimpan apa pun (preview-only, sesuai kontrak test).
- **File diubah**: `api/marketing_views.py` (kelas baru ~45 baris), `api/urls.py` (1 import + 1 path)

### Hasil test suite
- `python manage.py test api`: **139/140 lulus** (1 gagal = test 2 yang butuh keputusan manager)
- `python manage.py test accounting`: **29/29 lulus**
- Tidak ada regresi baru.

### Rekap file yang diubah
| File | Perubahan |
|---|---|
| `api/tests.py:165` | Tambah `dilayani_oleh` ke data test order creation |
| `api/marketing_views.py` | Tambah import `APIView`, buat `PromoPreviewView` (~45 baris) |
| `api/urls.py` | Import `PromoPreviewView`, tambah path `promo/preview/` |

---

### Review Manager — Test 1 & 3 APPROVED, Test 2 BLOCKED menunggu keputusan user (2026-07-28)

Diverifikasi pakai graphify dulu untuk orientasi (`graphify explain`), baru file spesifik untuk presisi — bukan baca semua file dari nol:

**Test 1 (dilayani_oleh)**: dikonfirmasi lewat `git diff api/tests.py` — 1 baris tambahan persis seperti dilaporkan, cocok dengan validasi `perform_create()` yang sudah diverifikasi sebelumnya di review T-202. ✅

**Test 3 (PromoPreviewView)**: sempat curiga duplikasi karena `graphify explain "evaluate_sales_discount"` menunjukkan sudah ada `.preview()` action lain (`SalesDiscountViewSet.preview`, `api/marketing_views.py:45-82`) yang juga memanggil `evaluate_sales_discount`. Dicek langsung ke kode — **bukan duplikat**: endpoint lama itu POS-only, cuma diskon penjualan (bukan kupon), response `diskon`/`aturan`, di path `/api/sales-discounts/preview/`. Endpoint baru (`/api/promo/preview/`) mengevaluasi kupon+diskon penjualan sekaligus, `kanal` dari request (bukan hardcode), response `diskon_kupon`/`diskon_penjualan` — kontrak beda, dipakai test yang beda. Reuse `evaluate_coupon_code()`/`evaluate_sales_discount()` dari `promo_engine.py` dikonfirmasi benar (R6, tidak ada logic diskon dihitung ulang di view). Tidak ada DB write (CouponUsage/POSSale) di endpoint ini — cocok kontrak "preview". URL registration dicek cocok. ✅

**Full suite diulang independen**: 169 test, **168 pass, 1 fail** (persis Test 2 yang di-escalate, bukan yang lain) — 0 regresi baru.

**Test 2 — TIDAK diputuskan di sini, perlu jawaban user langsung** (bukan keputusan teknis manager, ini kebijakan bisnis):
Diskon Penjualan sekarang berlaku di kanal apa pun (POS/Order), bukan cuma online seperti niat awal — perilaku ini SUDAH ADA sebelum T-108 (bukan sesuatu yang baru rusak), dan dari docstring fungsi kelihatan itu perubahan yang **disengaja** ("sehingga fitur ini benar-benar terpakai" — dugaan: dulu online-only jarang kepakai). Pertanyaan ke user:
- **Opsi A**: Diskon Penjualan memang seharusnya cuma online → tambah field `kanal` ke model `SalesDiscount` + migration, batasi di `evaluate_sales_discount()`. (task baru, F1 kalau nanti dikerjakan — nyentuh alur uang)
- **Opsi B**: Perilaku sekarang (semua kanal) itu yang benar → update assertion test ini supaya sesuai realita, sekalian bersihkan docstring model yang masih bilang "online only" biar tidak menyesatkan lagi.

Catatan proses: Antigravity lupa `graphify update .` di akhir kerja (U7) — sempat salah jalan sendiri (bikin graphify-out kedua di subfolder saat mencoba update), sudah dibersihkan dan graph root sudah fresh (4275 nodes, 12674 edges).

---

### Keputusan Bisnis User (2026-07-28)

**Diskon Penjualan SENGAJA diubah dulu supaya berlaku di semua kanal (POS/Order/SPK), bukan cuma online** — dikonfirmasi langsung oleh user. Perilaku sekarang di `evaluate_sales_discount()` sudah BENAR — yang salah itu test lama (`test_hanya_berlaku_di_kanal_online`) dan docstring model `SalesDiscount` yang belum diupdate mengikuti perubahan itu.

**Sisa pekerjaan T-108 (kecil, bukan task baru)**:
1. `api/tests_promo_engine.py::test_hanya_berlaku_di_kanal_online` — assertion-nya salah (mengharapkan diskon TIDAK berlaku di POS). Perbaiki supaya sesuai perilaku yang dikonfirmasi benar: diskon **berlaku** di kanal POS juga. Pertimbangkan rename method test-nya (nama sekarang menyesatkan — bilang "hanya online" padahal sebaliknya) jadi sesuatu seperti `test_berlaku_di_semua_kanal` — cek dulu isi test lengkapnya (setup, nilai `di_pos` yang diharapkan) sebelum ubah, jangan asal ganti angka assertion.
2. Docstring `SalesDiscount` (`api/marketing_models.py:20-23`) — masih bilang "hanya berlaku untuk Toko Online sesuai panduan Olsera". Update supaya sesuai kenyataan (berlaku semua kanal), biar tidak menyesatkan orang berikutnya yang baca.
3. Setelah fix: `python manage.py test api accounting` harus 169/169 lulus (0 gagal, bukan cuma bebas regresi lagi).

Definition of done sama seperti biasa: isi Hasil (bagian baru), status → review, update Agent Board, `graphify update .` (dari root, `.` = `C:\bintang-project`, JANGAN dari dalam subfolder — itu yang bikin graph kedua kemarin), 1 baris di daily note (`koordinasi/2026-07-28.md`).

---

### Sisa T-108 — SELESAI ✅ (2026-07-28)

Semua sisa pekerjaan dari Keputusan Bisnis User sudah dikerjakan:

**1. Test `test_hanya_berlaku_di_kanal_online` → RENAMED + FIXED ✅**
- **Rename**: `test_hanya_berlaku_di_kanal_online` → `test_berlaku_di_semua_kanal`
- **Docstring baru**: "Diskon Penjualan berlaku otomatis di semua kanal (POS, Order/SPK, Online) saat minimal total pesanan terpenuhi — bukan cuma online."
- **Assertion diubah**: `di_pos` dari `Decimal('0')` → `Decimal('10000.00')` — diskon memang berlaku di POS juga (10% × 100000 = 10000)
- **File**: `api/tests_promo_engine.py:256-266`

**2. Docstring model `SalesDiscount` → UPDATED ✅**
- **Sebelum**: "hanya berlaku untuk Toko Online sesuai panduan Olsera, diterapkan otomatis saat total pesanan terpenuhi."
- **Sesudah**: "berlaku otomatis di semua kanal (POS Terminal, Order/SPK, Online) saat total pesanan minimal terpenuhi. Tidak perlu kode kupon; diskon langsung diterapkan oleh promo_engine.evaluate_sales_discount()."
- **File**: `api/marketing_models.py:9-12`

**3. Full test suite → 169/169 LULUS ✅**
- `python manage.py test api accounting`: **169/169 lulus, 0 gagal**
- 0 regresi baru

### Rekap seluruh perubahan T-108
| File | Perubahan |
|---|---|
| `api/tests.py:165` | Tambah `dilayani_oleh` ke data test order creation (Test 1) |
| `api/marketing_views.py` | Tambah import `APIView`, buat `PromoPreviewView` (~45 baris) (Test 3) |
| `api/urls.py` | Import `PromoPreviewView`, tambah path `promo/preview/` (Test 3) |
| `api/tests_promo_engine.py:256-266` | Rename + fix assertion test SalesDiscount (Test 2) |
| `api/marketing_models.py:9-12` | Update docstring SalesDiscount (Test 2) |

---

### ✅ Review Manager Final — APPROVED `done` (2026-07-28)

Diverifikasi independen: rename+assertion `test_berlaku_di_semua_kanal` dikonfirmasi benar (`di_pos` & `di_online` sama-sama 10.000, sesuai keputusan bisnis user), docstring model dikonfirmasi sudah tidak menyesatkan. `python manage.py test api accounting` diulang manager → **169/169 lulus, 0 gagal**. T-108 tuntas — 3/3 test root-cause diperbaiki dengan benar (2 fix teknis + 1 escalation X6 yang berujung keputusan bisnis user), tidak ada test yang dilemahkan (T4 terpenuhi).
