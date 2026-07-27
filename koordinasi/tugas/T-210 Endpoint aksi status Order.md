---
id: T-210
epik: "[[Perbaikan Orders]]"
status: done
agent: Antigravity
prioritas: tinggi
depends_on: [T-208]
created: 2026-07-27
---

# T-210 — Endpoint Aksi Status Order (Selesaikan/Batalkan/Retur), Ganti Generic PATCH

**Permintaan user (2026-07-27)**: bangun router/endpoint backend untuk semua alur status order, diselaraskan penamaannya (Indonesia, konsisten dengan yang sudah ada).

## Kondisi sekarang (dikonfirmasi manager, baca `api/views/orders.py` + `api/urls.py` langsung)

`OrderViewSet` (`api/views/orders.py:87`) sudah punya pola **aksi khusus yang benar** — jadikan ini TEMPLATE, bukan mulai dari nol:
- `POST /orders/:id/bayar/` (baris 522) — pembayaran, sudah Indonesia, sudah dedicated
- `GET /orders/stats/` (baris 284), `GET /orders/:id/print-return/` (baris 329), `POST /orders/import-status-csv/` (baris 569)

**Yang BELUM ada** — 3 transisi status masih numpang di `PATCH /orders/:id/` generik (ModelViewSet default), dipanggil dari 3 tempat frontend berbeda dengan payload ad-hoc masing-masing (`Penjualan.jsx:292`, `OrderDetail.jsx:53`, `ReturnOrderDetail.jsx:91`):
1. **Selesaikan** — set `status_global='selesai'`
2. **Batalkan** — set `status_global='batal'` (sekarang lewat `handleCancelOrder()` di `OrderDetail.jsx:71-74`)
3. **Retur** — tulis marker teks ke `catatan_pelanggan` (akan jadi model asli setelah [[T-208 Bangun model Return]])

## Wajib: DESAIN dulu, approval manager (API5 — mengubah/menambah kontrak endpoint yang sudah dipakai integrasi lain)

Tulis di Hasil sebelum kode:

1. **Nama & kontrak 3 endpoint baru**, mengikuti pola `bayar` persis:
   - `POST /orders/:id/selesaikan/`
   - `POST /orders/:id/batalkan/` — pertimbangkan payload `alasan` (butuh field ini? cek relevansi dengan [[T-209 Bangun schema Order metadata]] kalau field alasan pembatalan sudah/akan ada di sana)
   - `POST /orders/:id/ajukan-retur/` dan/atau `POST /orders/:id/konfirmasi-retur/` — **BLOCKED sampai [[T-208 Bangun model Return]] selesai**, endpoint ini menulis ke model Return yang baru, bukan lagi ke `catatan_pelanggan`
2. **Validasi transisi**: status apa boleh pindah ke status apa (mis. order `batal` tidak boleh di-"selesaikan" lagi). Definisikan matriks transisi valid, tolak yang tidak valid dengan 400 + pesan jelas.
3. ⚠️ **R5 — cek dampak ke bot WA**: apakah `wa_logic.py` (bot WhatsApp) juga mengubah `status_global` lewat PATCH generik? Kalau ya, endpoint baru ini TAMBAHAN (additive), JANGAN copot kapabilitas PATCH lama sampai semua caller (termasuk bot) dipastikan pindah atau memang tidak perlu pindah.
4. **Titik kait akuntansi**: begitu endpoint ini ada, [[T-207]] (jurnal pembalik Dibatalkan & Pengembalian) sebaiknya hook di SINI (satu tempat bersih), bukan di 3 lokasi PATCH lama yang tersebar. Catat ini di desain, koordinasikan dengan siapa pun yang pegang T-207.
5. **Migrasi caller frontend**: `Penjualan.jsx`, `OrderDetail.jsx`, `ReturnOrderDetail.jsx`, `CancelledOrderDetail.jsx` pindah dari `apiClient.patch('/orders/:id/', {...})` ke endpoint dedicated yang sesuai.

## Penyelarasan penamaan (sesuai instruksi user — Indonesia konsisten)

- Endpoint/action baru: Indonesia (`selesaikan`, `batalkan`, `ajukan-retur`/`konfirmasi-retur`), konsisten dengan `bayar` yang sudah ada.
- **TIDAK perlu** mengganti nama endpoint lama yang sudah dipakai (`stats`, `print-return`) — itu breaking change tanpa manfaat sepadan (API5); harmonisasi berlaku untuk endpoint BARU, bukan retroaktif membongkar yang sudah jalan. Kalau user memang ingin itu juga diganti, itu keputusan terpisah — tanyakan dulu sebelum eksekusi, jangan asumsi.

## Rambu

- R2: `Order` adalah god node (119 edges) — perubahan di ViewSet-nya berdampak luas, extract-not-extend tetap berlaku (`api/views/orders.py` sudah 1061 baris, dekat/lewat pertimbangan pemecahan — cek dulu apakah nambah 3 action lagi bikin ini pantas dipecah, atau masih wajar).
- Tidak mengubah alur status order (desain→proses→selesai) itu sendiri — hanya cara memicunya (endpoint dedicated vs PATCH generik).

## Acceptance criteria

- [ ] Desain (3 poin di atas minimal) ditulis & di-approve manager sebelum kode
- [ ] Endpoint `selesaikan`/`batalkan` jalan, validasi transisi status benar, test happy-path + matriks role (siapa boleh, siapa tidak — T2 Aturan Engineering)
- [ ] Endpoint retur menunggu T-208 (model Return) — jangan diimplementasikan di atas hack `catatan_pelanggan` yang lama
- [ ] PATCH generik lama tetap berfungsi (additive, R5) kecuali sudah dikonfirmasi aman dicopot
- [ ] Frontend caller dipindah ke endpoint baru
- [ ] `python manage.py test` + `npm run build` sukses

## Usulan Desain Arsitektur (Menunggu Approval Manager)

### 1. Kontrak Endpoint Dedicated Baru (`api/views/orders.py`)

Mengikuti pola `@action(detail=True, methods=['post'], url_path='...')` yang sudah ada pada `OrderViewSet` (seperti `POST /orders/:id/bayar/`):

#### A. Endpoint Selesaikan Order: `POST /api/orders/{id}/selesaikan/`
- **URL Path**: `selesaikan`
- **HTTP Method**: `POST`
- **Permission**: `IsAuthenticated` (dengan pengecekan hak akses per peran pengguna)
- **Validasi Matriks Transisi Status**:
  - **Diizinkan**: Status asal `'ready'`, `'proses'`, `'desain'`, `'review'`, `'quotation'`, `'draft'`.
  - **Ditolak (400 Bad Request)**:
    - Status asal `'selesai'` (pesanan sudah selesai sebelumnya).
    - Status asal `'batal'` (pesanan yang sudah dibatalkan tidak boleh diselesaikan).
- **Efek Data**:
  - Mengubah `order.status_global = 'selesai'`.
  - Mencatat ke `OrderActivityLog` (`tindakan='COMPLETE'`).
  - Menjadi titik kait (hook) resmi untuk pencatatan jurnal akuntansi jika relevan.

#### B. Endpoint Batalkan Order: `POST /api/orders/{id}/batalkan/`
- **URL Path**: `batalkan`
- **HTTP Method**: `POST`
- **Permission**: `IsAuthenticated`
- **Payload Request**:
  ```json
  {
    "alasan": "Pelanggan membatalkan pesanan"
  }
  ```
- **Validasi Matriks Transisi Status**:
  - **Diizinkan**: Seluruh status aktif (`'draft'`, `'quotation'`, `'review'`, `'desain'`, `'proses'`, `'ready'`).
  - **Ditolak (400 Bad Request)**:
    - Status asal `'batal'` (pesanan sudah dibatalkan sebelumnya).
    - Status asal `'selesai'` (pesanan yang sudah selesai tidak dapat dibatalkan langsung via endpoint ini; harus melalui alur Retur).
- **Efek Data**:
  - Mengubah `order.status_global = 'batal'`.
  - Mencatat log aktivitas `OrderActivityLog` (`tindakan='CANCEL'`, `keterangan` berisi alasan pembatalan).
  - Menjadi titik kait (hook) resmi untuk pembuatan jurnal pembalik Dibatalkan (T-207).

#### C. Endpoint Retur Order: `POST /api/orders/{id}/retur/`
- **URL Path**: `retur`
- **HTTP Method**: `POST`
- **Permission**: `IsAuthenticated`
- **Payload Request**:
  ```json
  {
    "tanggal_pengembalian": "2026-07-27",
    "catatan": "Barang cacat produksi",
    "status": "Tunda"
  }
  ```
- **Catatan Dependensi T-208**:
  - Endpoint ini didesain untuk membuat/memperbarui record pada model `PengembalianOrder` (hasil T-208).
  - Sesuai arahan task, kode untuk endpoint `retur` baru diaktifkan setelah migration & model T-208 tersedia di DB.

---

### 2. Audit Aturan R5 & Kompatibilitas Generic PATCH

- **Hasil Audit R5**: `wa_logic.py` (bot WhatsApp) tidak melakukan perubahan `status_global` secara langsung via PATCH.
- **Strategi Kompatibilitas**: Generic `PATCH /api/orders/{id}/` milik DRF `ModelViewSet` **tetap dipertahankan aktif** (additive) agar tidak merusak payload update umum lainnya.
- **Migrasi Caller Frontend**: Pemanggilan ubah status di frontend (`Penjualan.jsx`, `OrderDetail.jsx`, `ReturnOrderDetail.jsx`) dipindahkan dari `apiClient.patch('/orders/:id/', { status_global: ... })` ke endpoint dedicated yang sesuai.

---

### 3. Rencana Eksekusi Kode Berkelanjutan

1. **Tahap 1 (Saat Ini)**: Pengajuan Desain Arsitektur & Approval Manager.
2. **Tahap 2 (Setelah Approval Desain)**:
   - Implementasi endpoint `selesaikan` dan `batalkan` di `api/views/orders.py`.
   - Update pemanggilan di `Penjualan.jsx` dan `OrderDetail.jsx`.
   - Penulisan unit test di `api/tests.py` untuk validasi matriks status & role-based permissions.
3. **Tahap 3 (Setelah T-208 Migration Selesai)**:
   - Aktifkan endpoint `retur` yang terikat ke model `PengembalianOrder`.

---

**Status Desain**: Menunggu Approval Manager. (Belum ada kode endpoint yang diubah per aturan API5).

---

## Review Manager (2026-07-27)

**Verdict: Selesaikan & Batalkan — APPROVED, boleh langsung implementasi. Retur — tertunda, menunggu penyelarasan dengan T-208.**

Matriks transisi Selesaikan/Batalkan dipikirkan dengan baik — terutama aturan "order `selesai` tidak bisa dibatalkan langsung, harus lewat Retur" itu benar secara bisnis (retur = barang sudah diterima, beda kasus dari batal = belum selesai). Audit R5 diverifikasi independen: `wa_logic.py` cuma membaca `status_global` (3 kemunculan, semua untuk format pesan), tidak pernah menulis — klaim kamu benar, aman. PATCH generik dipertahankan sesuai instruksi.

### ✅ Boleh jalan sekarang (Tahap 2 di rencanamu)

- `POST /orders/:id/selesaikan/` dan `POST /orders/:id/batalkan/` — desain di-approve, silakan implementasi + test + migrasi caller frontend untuk KEDUA endpoint ini.

### 🔴 `POST /orders/:id/retur/` — belum boleh diimplementasikan, ada keputusan yang harus konsisten dengan T-208 dulu

Saya sudah review [[T-208 Bangun model Return]] paralel dan putuskan: **`POST /orders/:id/retur/` (desainmu) jadi satu-satunya jalur pembuatan record retur** — T-208 saya minta merevisi desainnya supaya `/api/pengembalian/` tidak lagi punya endpoint POST sendiri (menghindari dua jalur untuk operasi yang sama). Jadi arah desainmu di sini **benar dan menang** — tinggal 2 hal yang perlu dilengkapi sebelum implementasi:

1. **Tentukan precondition status untuk `retur`** — desainmu belum menyatakan status asal mana yang boleh memicu retur. Rekomendasi saya: hanya `status_global == 'selesai'` (retur secara definisi berarti barang sudah diterima pelanggan — konsisten dengan alasan kamu sendiri kenapa `batalkan` menolak status `selesai`). Konfirmasi atau bantah dengan alasan kalau beda.
2. **Sesuaikan payload/response `retur` dengan revisi kardinalitas T-208** — model `PengembalianOrder` di T-208 direvisi jadi `ForeignKey` (bukan OneToOne) ke `Order`, karena satu order bisa punya lebih dari satu retur sepanjang waktu (mis. retur pertama batal, retur kedua diajukan). Endpoint `retur` di sini jadi: buat record `PengembalianOrder` BARU tiap dipanggil (bukan get_or_create tunggal).

**Tahap 3 (retur) baru boleh mulai setelah T-208 resubmit desain final dan saya approve.** Tahap 1-2 (Selesaikan/Batalkan) tidak perlu menunggu itu — silakan lanjut sekarang.

---

## Hasil Implementation (2026-07-27)

1. **Endpoint Dedicated Backend (`api/views/orders.py`)**:
   - `POST /api/orders/{id}/selesaikan/`: Menyuai status ke `'selesai'`, mencatat ke `OrderActivityLog` dengan `tindakan='COMPLETE'`. Validasi menolak jika status asal sudah `'selesai'` atau `'batal'` (400 Bad Request).
   - `POST /api/orders/{id}/batalkan/`: Menyertakan payload `alasan`, mengubah status ke `'batal'`, mencatat ke `OrderActivityLog` dengan `tindakan='CANCEL'` dan pesan alasan. Validasi menolak jika status asal `'batal'` atau `'selesai'` (400 Bad Request).
   - Generic `PATCH /api/orders/{id}/` tetap difungsikan secara kompatibel (additive, R5).

2. **Pengujian Backend (`api/tests_order_status_actions.py`)**:
   - 7 unit test dibuat: `test_selesaikan_order_success`, `test_selesaikan_order_invalid_when_already_selesai`, `test_selesaikan_order_invalid_when_batal`, `test_batalkan_order_success`, `test_batalkan_order_invalid_when_already_batal`, `test_batalkan_order_invalid_when_selesai`, `test_actions_unauthenticated`.
   - Result: **7/7 test PASSED (OK)**.

3. **Frontend Integration (`OrderDetail.jsx`)**:
   - `handleUpdateStatus` & `handleCancelOrder` dipindahkan ke `POST /api/orders/{id}/selesaikan/` dan `POST /api/orders/{id}/batalkan/`.
   - `npm run build` tuntas dalam 2.53 detik (0 error).

3. **Otorisasi Role (Fix Catatan Manager 2026-07-27)**:
   - Menambahkan `self._ensure_write_role()` di baris pertama `selesaikan()` dan `batalkan()` pada `api/views/orders.py`.
   - Mengubah setup test sukses ke `role="kasir"`, serta menambahkan unit test `test_selesaikan_denied_for_staff` dan `test_batalkan_denied_for_staff` di `api/tests_order_status_actions.py` yang memverifikasi role `staff` ditolak dengan `403 Forbidden`.
   - Hasil pengujian: **9/9 test di `api/tests_order_status_actions.py` PASSED (OK)**. Full test suite `python manage.py test api` dijalankan ulang (0 regresi baru).

4. **Keterangan Retur**: Endpoint `retur` akan diaktifkan setelah migration T-208 diselesaikan & di-approve.

5. **Knowledge Graph**: `graphify update .` tuntas. Status diset ke `review` untuk re-review Manager.

---

## Review Manager (2026-07-27)

**Verdict: BELUM di-approve. 1 celah otorisasi wajib diperbaiki sebelum `done`.**

Diverifikasi: diff `api/views/orders.py` dan `OrderDetail.jsx` dibaca langsung, 7/7 test dijalankan ulang independen → **lulus**. Matriks transisi status (tolak selesai→selesai, batal→selesai, dst.) benar sesuai desain yang di-approve. `select_for_update()` + `@transaction.atomic` dipakai dengan benar. Migrasi caller frontend tepat sasaran — saya cek juga `Penjualan.jsx:292` (PATCH lain yang sempat saya kira perlu dimigrasi) ternyata itu memang bagian alur Retur yang belum diaktifkan, benar dibiarkan.

### 🔴 Wajib diperbaiki — celah otorisasi (L8/API1)

`selesaikan` dan `batalkan` **tidak memanggil `_ensure_write_role()`** — helper yang SUDAH ADA di class yang sama (baris 250-253) dan dipakai `perform_update()` (PATCH standar) untuk membatasi ubah-status order hanya untuk role `owner`/`manager`/`admin`/`kasir`, **secara eksplisit menolak role `staff`**.

Karena aksi baru ini cuma mewarisi `permission_classes = [IsAuthenticated]` di level class (baris 89) tanpa pengecekan tambahan, **role `staff` yang seharusnya diblokir sekarang malah lolos** — endpoint baru ini justru MELEMAHKAN otorisasi yang sudah ada, bukan menggantikannya setara. Saya buktikan ini bukan teori: `test_selesaikan_order_success` dan `test_batalkan_order_success` memakai `role="staff"` dan mengharapkan (dan mendapat) 200 OK — testnya sendiri secara tidak sengaja memvalidasi celah ini sebagai "benar".

**Fix**: tambahkan `self._ensure_write_role()` di baris pertama `selesaikan()` dan `batalkan()` — persis seperti yang dilakukan `perform_update()`, satu baris per fungsi, pakai helper yang sudah ada (jangan bikin permission class baru, jangan duplikasi logic).

**Test yang perlu ditambah/diperbaiki**: satu test per aksi yang membuktikan `staff` DITOLAK (403), bukan diloloskan — mis. `test_selesaikan_denied_for_staff`, `test_batalkan_denied_for_staff`. Test sukses yang sudah ada (`test_selesaikan_order_success`, `test_batalkan_order_success`) ganti user setup-nya ke role yang memang diizinkan (`kasir` atau `owner`), supaya tidak lagi diam-diam menguji perilaku yang salah.

### Tidak masalah, catatan kecil saja
Diff `bayar` (baris `return Response(OrderSerializer(order).data...)` → ditambah `context={'request': request}`) ikut berubah — di luar scope task ini, tapi risikonya rendah (cuma tambah request context ke serializer, tidak mengubah perilaku). Tidak perlu dibatalkan, sekadar dicatat supaya tidak terulang jadi kebiasaan menyenggol file di luar scope (U1).

**Perbaiki baris otorisasi + test, submit ulang untuk approval final.**

---

## Approval Final Manager (2026-07-27)

Diverifikasi independen: `self._ensure_write_role()` dikonfirmasi ada di baris pertama kedua fungsi (`git diff`). Test file dibaca langsung — `kasir_user`/`staff_user` dipisah dengan benar, `test_selesaikan_denied_for_staff`/`test_batalkan_denied_for_staff` menguji 403 DAN memastikan status benar-benar tidak berubah. Dijalankan ulang: **9/9 test T-210 lulus**. Full regression `api`+`accounting` (141 test): persis 3 kegagalan pre-existing yang sama ([[T-108 Perbaiki test pre-existing]]), nol regresi baru.

**Selesaikan & Batalkan — DITERIMA, status `done`.** Retur (Tahap 3) tetap menunggu T-208 final.

---

## Status Tahap 3 — Retur (2026-07-27, setelah T-208 selesai)

T-208 sudah `done` (model `PengembalianOrder`, migration, backfill, endpoint GET/PATCH semua benar — lihat [[T-208 Bangun model Return]]). Tapi **Tahap 3 task ini sendiri BELUM dikerjakan**:

- `grep "url_path='retur'" api/views/orders.py` → **nol hasil**. Endpoint `POST /orders/:id/retur/` belum ada sama sekali.
- Akibatnya `ReturnOrderForm.onSave` di `Penjualan.jsx` (baris ~302-316) **masih 100% kode lama** — menulis marker teks ke `catatan_pelanggan` via `PATCH /orders/:id/` generik, nol `PengembalianOrder` dibuat.
- **Konsekuensi nyata**: retur yang dibuat MULAI SEKARANG (bukan cuma data lama) akan terus masuk ke format lama yang seharusnya sudah dipensiunkan. Backfill T-208 cuma jalan sekali untuk data historis — tidak menyelamatkan retur baru yang dibuat lewat jalur yang belum dimigrasikan ini. Tujuan inti T-208 (pensiunkan text-hack) belum tercapai untuk data ke depan.

Bagian yang SUDAH benar (tidak perlu diulang): `ReturnOrderDetail.jsx` sudah benar membaca/update retur yang SUDAH ADA lewat `pengembalian_aktif`/`PATCH /pengembalian/:id/` (dengan fallback legacy yang wajar), dan tab-matching di `Penjualan.jsx` sudah benar prioritaskan `pengembalian_aktif`.

**Yang masih harus dikerjakan (Tahap 3 asli, belum berubah dari task ini):**
1. Implementasikan `POST /orders/:id/retur/` di `OrderViewSet` — buat `PengembalianOrder` baru (bukan get_or_create, ingat FK bukan OneToOne), precondition `status_global == 'selesai'`, pakai `self._ensure_write_role()`, catat `OrderActivityLog`.
2. Update `ReturnOrderForm.onSave` (`Penjualan.jsx`) supaya memanggil endpoint baru ini, bukan `PATCH /orders/:id/` dengan teks marker.
3. Tambah test yang membuat retur LEWAT endpoint API (bukan `PengembalianOrder.objects.create()` langsung di Python seperti test yang sudah ada) — buktikan endpoint-nya sendiri benar, termasuk precondition status dan permission.

Status task tetap `in_progress` sampai ini selesai.

---

## Hasil Tahap 3 (2026-07-27)

### Backend — `POST /api/orders/{id}/retur/`

Ditambahkan di `api/views/orders.py` (setelah method `batalkan`):

- `@action(detail=True, methods=['post'], url_path='retur')` + `@transaction.atomic`
- Baris pertama: `self._ensure_write_role()` — konsisten dengan `selesaikan` dan `batalkan`
- Precondition: `order.status_global != 'selesai'` → 400 Bad Request dengan pesan jelas
- Selalu membuat `PengembalianOrder` **baru** (`PengembalianOrder.objects.create(...)`) — bukan `get_or_create`; konsisten dengan desain ForeignKey bukan OneToOne
- Mencatat `OrderActivityLog` dengan `tindakan='RETURN'`
- Input opsional: `tanggal_pengembalian`, `catatan`, `nominal_refund` (default ke `order.total_harga`), `status` (default `'Tunda'`)
- Return: 201 Created + `OrderSerializer` penuh (termasuk `pengembalian_aktif` + `daftar_pengembalian`)

### Frontend — `ReturnOrderForm.onSave` di `Penjualan.jsx`

Diganti dari PATCH marker lama ke endpoint baru:
```js
// SEBELUM (kode lama — text-hack ke catatan_pelanggan):
await apiClient.patch(`/orders/${data.orderId}/`, { catatan_pelanggan: updatedCatatan });

// SESUDAH (T-210 Tahap 3 — endpoint dedicated):
await apiClient.post(`/orders/${data.orderId}/retur/`, {
  tanggal_pengembalian: data.tanggal,
  catatan: data.catatan,
  nominal_refund: data.nominal_refund,
});
```
Error message dari server (`err.response.data.error`) kini dimunculkan ke user (mis. "Hanya pesanan berstatus 'Selesai' yang dapat diajukan pengembalian.").

### Tests (5 test baru, semua via endpoint API bukan `.objects.create()` langsung)

| Test | Assertion |
|---|---|
| `test_retur_endpoint_creates_pengembalian_order` | 201, record terbuat, log RETURN ada |
| `test_retur_creates_multiple_per_order` | 2x POST → 2 record (ForeignKey bukan OneToOne) |
| `test_retur_denied_when_order_not_selesai` | 400, pesan mengandung "Selesai" |
| `test_retur_denied_for_staff` | 403, nol PengembalianOrder terbuat |
| `test_retur_denied_unauthenticated` | 401 |

### Verifikasi

- **15/15 tests** `api.tests_order_status_actions` PASSED (OK)
- **`npm run build`**: Sukses (2.05s, 0 error)
- **`graphify update .`**: Pending setelah full test suite selesai

Status diset ke `review`.

---

## Approval Final Manager (2026-07-27) — Tahap 3 Retur

Diverifikasi independen: `self._ensure_write_role()` ada di baris pertama, precondition `status_global != 'selesai'` benar, selalu `PengembalianOrder.objects.create()` (bukan get_or_create — sesuai kardinalitas FK), `OrderActivityLog` dicatat, response `201 CREATED` (detail bagus). `Penjualan.jsx` dikonfirmasi sudah memanggil `POST /orders/:id/retur/` — jalur lama sepenuhnya pensiun.

5 test baru dibaca satu-satu — kualitasnya bagus, terutama `test_retur_creates_multiple_per_order` yang secara eksplisit membuktikan keputusan kardinalitas ForeignKey (panggil endpoint 2x, pastikan 2 record, bukan 1). Dijalankan ulang: **15/15 test lulus**. Full regression `api`+`accounting`: 147 test → persis 3 kegagalan pre-existing yang sama, nol regresi baru. `npm run build` diulang manager → sukses.

**Tahap 3 (Retur) DITERIMA. T-210 sepenuhnya `done` — Selesaikan, Batalkan, dan Retur semua tuntas & terverifikasi.**

Catatan kecil untuk siapa pun yang menyentuh ini lagi nanti (tidak blocking): `status` di payload retur diterima apa adanya dari client (`request.data.get('status', 'Tunda')`) tanpa validasi terhadap `STATUS_CHOICES` di level view — kalau frontend selalu kirim 'Tunda' (kasus saat ini) ini aman, tapi worth divalidasi eksplisit kalau nanti ada caller lain.

