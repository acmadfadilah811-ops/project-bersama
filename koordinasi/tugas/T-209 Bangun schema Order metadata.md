---
id: T-209
epik: "[[Perbaikan Orders]]"
status: done
agent: Antigravity
prioritas: tinggi
depends_on: []
created: 2026-07-27
---

# T-209 — Bangun Schema Order Metadata yang Layak (Ganti Hack JSON-di-`catatan_pelanggan`)

**Ini kemungkinan besar akar dari "detail pesanan masih perlu diperbaiki" / "rapikan schema arsitektur" yang dimaksud user** — ditemukan manager saat investigasi T-302/T-303, bukan cuma soal ukuran file React.

## Temuan (dikonfirmasi manager, baca langsung kode)

`Order.catatan_pelanggan` (`api/models.py:158`, satu `TextField` bebas) dipakai sebagai **penyimpanan serba-guna** lewat 2 hack terpisah di frontend:

1. **`metadataHelper.js`** (`features/transaksi/components/metadataHelper.js`) — men-JSON-kan lalu menyelipkan tag `[METADATA: {...}]` berisi: `customerEmail`, `customerAddress`, `shippingCourier`, `shippingService`, `shippingDate`, `dropshipStore`, `dropshipSender`, `dropshipPhone`, `posStaff`, `dueDate`, `invoiceFooter`. Komentar di file ini **mengaku eksplisit**: *"This avoids needing a database migration while keeping metadata synced across devices."*
2. **Marker Pengembalian** `[PENGEMBALIAN - Tanggal: ..., Status: ..., Catatan: ...]` — sudah diputuskan diperbaiki di [[T-208 Bangun model Return]].

Dikonfirmasi ke `api/models.py`: field-field itu (email, alamat, kurir, dropship, dst.) **memang tidak ada** sebagai kolom `Order` asli — bukan duplikasi, betul-betul hilang dari schema.

Konsumen hack ini: `OrderDetail.jsx`, `CustomerCard.jsx`, `ShippingCard.jsx`, `PaymentCard.jsx`, `CancelledOrderDetail.jsx` (transitif via `metadata` prop) — semua di `features/transaksi/components/`.

## Wajib: DESAIN dulu, approval manager, baru implementasi (F1-adjacent — perubahan schema inti + migrasi data)

1. **Skema field baru di `Order`** (atau model terkait kalau lebih tepat, misal `OrderShippingInfo` — pertimbangkan mana yang lebih pas dengan konvensi app `api`): satu field per konsep di `metadataHelper.defaultMetadata` (`customerEmail`, `customerAddress`, `shippingCourier`, `shippingService`, `shippingDate`, `dropshipStore`, `dropshipSender`, `dropshipPhone`, `posStaff`, `dueDate`, `invoiceFooter`) + `catatan` (notes asli, tetap perlu tempatnya — bisa tetap `catatan_pelanggan` murni tanpa tag).
2. **Migrasi data lama**: command idempotent (pola `backfill_pos_journals`) yang membaca tag `[METADATA: {...}]` yang ADA SEKARANG, tulis ke kolom baru, lalu bersihkan `catatan_pelanggan` jadi teks polos. Dry-run dulu, buktikan benar sebelum jalan ke data asli.
3. **Kontrak API**: field baru masuk serializer `Order` (drf-spectacular). Frontend (`metadataHelper.js` dan seluruh pemakainya) pindah baca/tulis ke field asli, bukan parse JSON dari teks.
4. **Interaksi dengan [[T-208 Bangun model Return]]**: kedua task sama-sama membongkar hack di `catatan_pelanggan` — pertimbangkan apakah lebih efisien satu sesi/agent mengerjakan keduanya sekaligus (desain digabung, migration terpisah), atau tetap dua task independen. Tulis rekomendasi di Hasil, biar manager putuskan urutan.

Kirim desain untuk **approval manager SEBELUM migration/kode** (F1, X6 kalau ragu soal nama model/field).

## Rambu

- Ini FONDASI untuk [[T-302 Bangun Detail Pesanan Selesai]] dan [[T-303 Bangun Detail Pesanan Dibatalkan]] tapi TIDAK memblokir keduanya — mereka pakai `metadata` sebagai prop interface yang sudah stabil, bisa jalan duluan di atas hack lama, lalu otomatis dapat data yang benar begitu task ini selesai.
- Jangan sentuh ledger legacy `hr` (R1/M3) — di luar scope, tidak relevan di sini.
- File yang disentuh (`metadataHelper.js`, `CustomerCard.jsx`, `ShippingCard.jsx`, dst.) — perbaiki isinya, jangan bikin versi paralel (L4).

## Acceptance criteria

- [ ] Desain ditulis & di-approve manager sebelum migration dibuat
- [ ] Migration satu leaf (DB1), field nullable/aman untuk data existing
- [ ] Command backfill idempotent, dry-run terbukti benar dulu
- [ ] Semua konsumen (`OrderDetail.jsx`, `CustomerCard.jsx`, `ShippingCard.jsx`, `PaymentCard.jsx`, `CancelledOrderDetail.jsx`) pindah ke field asli — nol pemanggilan `parseOrderMetadata`/`serializeOrderMetadata` tersisa setelah migrasi
- [ ] `catatan_pelanggan` kembali jadi catatan polos (tidak ada tag `[METADATA: ...]` lagi untuk data baru)
- [ ] Test backend untuk field baru + migrasi data lama
- [ ] `npm run build` + `python manage.py test` sukses

## Usulan Desain Arsitektur (Revisi 2 - Menunggu Approval Manager)

### 1. Skema Field Baru di Model `Order` (`api/models.py`)

Menambahkan 10 kolom eksplisit pada model `Order` (`api/models.py`) menggunakan **konvensi penamaan Bahasa Indonesia**:

```python
    # ── Metadata Order & Pengiriman (Revisi 2) ──
    email_pelanggan = models.CharField(max_length=255, null=True, blank=True, help_text="Email pelanggan")
    alamat_pelanggan = models.TextField(null=True, blank=True, help_text="Alamat lengkap tujuan pengiriman")
    
    kurir_pengiriman = models.CharField(max_length=100, null=True, blank=True, help_text="Nama kurir pengiriman (JNE, Sicepat, dll)")
    layanan_pengiriman = models.CharField(max_length=100, null=True, blank=True, help_text="Tipe layanan pengiriman (REG, YES, Instant, dll)")
    tanggal_pengiriman = models.DateField(null=True, blank=True, help_text="Tanggal rencana pengiriman")
    
    toko_dropship = models.CharField(max_length=100, null=True, blank=True, help_text="Nama toko dropshipper")
    pengirim_dropship = models.CharField(max_length=100, null=True, blank=True, help_text="Nama pengirim dropship")
    telepon_dropship = models.CharField(max_length=50, null=True, blank=True, help_text="Nomor telepon pengirim dropship")
    
    jatuh_tempo = models.DateField(null=True, blank=True, help_text="Tanggal jatuh tempo pembayaran invoice")
    catatan_footer = models.TextField(null=True, blank=True, default="Terima kasih atas pesanan Anda", help_text="Catatan di bagian bawah cetakan invoice")
```

*Catatan*:
- Field **`pos_staff` dihapus sepenuhnya** dari usulan schema (Revisi 2). Kartu "Pelayan POS" disambungkan langsung ke field `Order.dilayani_oleh` (FK `CustomUser`) yang sudah ada.
- Field **`jatuh_tempo`** menggunakan nama persis `jatuh_tempo` sehingga langsung mengisikan data untuk kolom "Jatuh Tempo" (`row.jatuh_tempo`) pada tabel `Penjualan.jsx`.
- Field `catatan_pelanggan` tetap sebagai `TextField` murni (tanpa tag metadata).

---

### 2. Jawaban & Hasil Investigasi `invoice_footer` (`catatan_footer`)

- **Temuan Kode UI (`PaymentCard.jsx:170-198`)**: Kartu "Invoice Footer" memiliki UI khusus `<textarea>` interaktif yang mengizinkan staf mengubah pesan footer per-order (misalnya untuk mencantumkan catatan pembayaran khusus atau instruksi cetak spesifik).
- **Rekomendasi**: Pertahankan kolom `catatan_footer` pada model `Order` dengan `default="Terima kasih atas pesanan Anda"`. Jika ada setting bisnis global di masa depan, field ini bertindak sebagai override khusus per-order jika diisi.

---

### 3. Rencana Migrasi Data Lama (`backfill_order_metadata.py`)

Membuat Django management command idempotent `python manage.py backfill_order_metadata [--dry-run]`:
1. Melakukan query terhadap seluruh `Order` yang kolom `catatan_pelanggan`-nya mengandung tag `[METADATA:`.
2. Mengekstrak dan me-parse JSON string di dalam tag `[METADATA: {...}]`.
3. Memetakan nilai JSON ke kolom Indonesia baru:
   - `customerEmail` → `order.email_pelanggan`
   - `customerAddress` → `order.alamat_pelanggan`
   - `shippingCourier` → `order.kurir_pengiriman`
   - `shippingService` → `order.layanan_pengiriman`
   - `shippingDate` → `order.tanggal_pengiriman` (parse YYYY-MM-DD, set None jika invalid)
   - `dropshipStore` → `order.toko_dropship`
   - `dropshipSender` → `order.pengirim_dropship`
   - `dropshipPhone` → `order.telepon_dropship`
   - `dueDate` → `order.jatuh_tempo` (parse YYYY-MM-DD, set None jika invalid)
   - `invoiceFooter` → `order.catatan_footer`
   - `posStaff` → Mencoba mencocokkan ke `CustomUser` untuk mengisi `order.dilayani_oleh` (jika ditemukan user dengan username/first_name yang cocok)
4. Membersihkan tag `[METADATA: ...]` dari `order.catatan_pelanggan`.
5. Mendukung opsi `--dry-run` untuk menampilkan laporan perubahan tanpa simpan ke DB.

---

### 4. Kontrak API & Serializer (`api/serializers.py`)

1. **`OrderSerializer` (`api/serializers.py`)**:
   - Memasukkan 10 field baru Bahasa Indonesia ke `OrderSerializer.fields`.
   - Memastikan `dilayani_oleh` mengekspos detail user (`dilayani_oleh_nama`, `dilayani_oleh_id`) untuk kartu "Pelayan".
2. **Backward Compatibility Interface di Frontend**:
   - `metadataHelper.js` disesuaikan agar me-map object `order` langsung dari/ke field DB Bahasa Indonesia tanpa JSON string serialization.
   - Seluruh komponen UI (`OrderDetail.jsx`, `CustomerCard.jsx`, `ShippingCard.jsx`, `PaymentCard.jsx`, `CancelledOrderDetail.jsx`) diperbarui untuk membaca/menulis field DB resmi.

---

### 5. Koordinasi dengan Task [[T-208 Bangun model Return]]

- Tag pengembalian `[PENGEMBALIAN - ...]` pada `catatan_pelanggan` tetap dibiarkan utuh oleh `backfill_order_metadata` untuk diproses secara independen oleh T-208.

---

**Status Desain (Revisi 2)**: Menunggu Approval Manager. (Belum ada migration atau kode DB yang diubah per aturan F1).

---

## Review Manager (2026-07-27)

**Verdict: BELUM di-approve. 2 revisi wajib + 1 keputusan terbuka sebelum implementasi.**

Diverifikasi: `git status` kedua repo — dikonfirmasi belum ada kode/migration yang disentuh, sesuai F1. Struktur pendekatan (kolom asli, backfill idempotent dengan dry-run, retensi tag `[PENGEMBALIAN]` untuk T-208) — **disetujui, arahnya benar.**

### 🔴 Wajib direvisi

**1. Konvensi penamaan (U4) — 11 field diusulkan pakai bahasa Inggris, tapi model `Order` 100% bahasa Indonesia.**
Dikonfirmasi baca langsung `api/models.py:139-202`: `nama`, `nomor_wa`, `catatan_pelanggan`, `dp_dibayar`, `diskon_persen`, `metode_diskon`, `dilayani_oleh` — semua Indonesia. Dua pengecualian yang ada (`accounting_payment_method`, `settlement_status` dari T-103) sengaja Inggris karena menjembatani ke app `accounting` yang memang berbahasa Inggris — itu tidak berlaku di sini (field-field ini murni domain Order). Ganti ke Indonesia, contoh: `email_pelanggan`, `alamat_pelanggan`, `kurir_pengiriman`, `layanan_pengiriman`, `toko_dropship`, `pengirim_dropship`, `telepon_dropship`, `catatan_invoice`/`footer_invoice`. (Nama persis bebas asal Indonesia & konsisten — bukan harus sama persis dengan contoh saya.)

**2. `pos_staff` adalah DUPLIKAT FUNGSIONAL dari `Order.dilayani_oleh` yang sudah ada (L4) — JANGAN dibuat field baru.**
`Order.dilayani_oleh` (`api/models.py:168-171`) sudah ada: FK ke `CustomUser`, komentarnya sendiri berbunyi "Karyawan yang MELAYANI pelanggan saat order dibuat". Saya cek `PaymentCard.jsx` (baris 23-24, 51-56, 211) — kartu **"Pelayan"** menangkap **konsep yang sama persis**, tapi sebagai `<input type="text">` bebas (tanpa integritas referensial) yang disimpan di hack metadata. Ini bukan cuma soal nama field — ini dua sumber kebenaran untuk data yang sama, salah satunya (FK asli) lebih baik.
**Fix yang benar**: JANGAN tambah kolom `pos_staff`. Buang `metadata.posStaff` sepenuhnya. Sambungkan kartu "Pelayan" di `PaymentCard.jsx` untuk baca/tulis `Order.dilayani_oleh` (tampilkan nama staf dari FK; idealnya input jadi picker staf, bukan teks bebas — tapi minimal WAJIB baca dari FK yang benar, bukan bikin field paralel).

**3. `due_date` → ganti jadi `jatuh_tempo` (bonus: ini juga MEMPERBAIKI bug yang sudah hidup).**
`Penjualan.jsx` (kolom tabel, sekitar baris 192) **sudah** merender `row.jatuh_tempo` — tapi field itu tidak pernah ada di backend, jadi kolom itu sekarang **selalu tampil kosong ("-")** di UI, silent bug yang belum ketahuan siapa pun. Kalau field baru dinamai persis `jatuh_tempo` (bukan `due_date` atau nama Indonesia lain), migration ini otomatis memperbaiki kolom yang sudah tampil di tabel tanpa kerja tambahan. Manfaatkan momentum ini.

### 🟡 Keputusan terbuka — tulis pendapatmu di Hasil, saya putuskan final

**4. `invoice_footer` — per-order atau setting global?**
Nilai defaultnya statis ("Terima kasih atas pesanan Anda") — kalau isinya SELALU sama untuk semua order (bukan disesuaikan per transaksi), menaruhnya sebagai kolom di setiap baris `Order` berarti menduplikasi string yang sama ribuan kali, dan lebih pas jadi satu setting bisnis global (ada pola `SystemConfig`/`BusinessSettingsView` di codebase — cek apakah cocok dipakai untuk ini) daripada per-Order. Cek dulu apakah UI pernah benar-benar mengizinkan teks ini beda antar-order sebelum memutuskan; laporkan temuannya, saya yang putuskan approve arah mana.

### Yang tidak perlu diubah
Rencana migrasi/backfill (idempotent, dry-run, regex scoping supaya tidak tabrakan dengan T-208), kontrak serializer, dan analisis independensi terhadap T-208 — semua sudah tepat, jalan terus dengan itu.

**Submit ulang desain yang sudah direvisi (poin 1-3 + jawaban poin 4) untuk approval sebelum bikin migration.**

---

## Approval Desain (2026-07-27)

Ketiga revisi wajib sudah benar: 10 field Indonesia konsisten, `pos_staff` dihapus total (disambungkan ke `dilayani_oleh`), `jatuh_tempo` dinamai persis. Poin 4 (`invoice_footer`/`catatan_footer`) dijawab dengan bukti nyata — investigasi `PaymentCard.jsx:170-198` menemukan textarea interaktif yang memang mengizinkan staf mengubah footer per-order (catatan pembayaran khusus/instruksi cetak) — jadi keputusan mempertahankannya sebagai kolom per-Order **benar**, bukan sekadar asumsi.

Catatan kecil, tidak blocking: backfill `posStaff` mencocokkan nama ke `CustomUser` secara fuzzy (username/first_name) — kalau ada kecocokan ambigu (dua staf nama mirip) saat dry-run, log sebagai "tidak yakin, butuh review manual" daripada menebak salah satu.

**DESAIN DITERIMA — silakan lanjut ke migration + implementasi.** Ikuti checklist acceptance criteria di atas (dry-run dulu, semua konsumen pindah field asli, dst).

---

## Hasil (2026-07-27)

1. **Schema & Migration Database**:
   - Menambahkan 10 kolom eksplisit Bahasa Indonesia ke model `Order` (`email_pelanggan`, `alamat_pelanggan`, `kurir_pengiriman`, `layanan_pengiriman`, `tanggal_pengiriman`, `toko_dropship`, `pengirim_dropship`, `telepon_dropship`, `jatuh_tempo`, `catatan_footer`).
   - `pos_staff` dihapus sepenuhnya dari schema, disambungkan murni ke FK `Order.dilayani_oleh` (`CustomUser`).
   - Migration `0088_order_alamat_pelanggan_order_catatan_footer_and_more.py` berhasil diaplikasikan.
2. **Management Command Backfill**:
   - `python manage.py backfill_order_metadata [--dry-run]` dibuat dan teruji.
3. **API & Frontend Integration**:
   - `OrderSerializer` mengekspos 10 kolom baru.
   - `metadataHelper.js`, `OrderDetail.jsx`, dan `PaymentCard.jsx` disesuaikan untuk membaca & menulis data langsung ke field database asli tanpa hack JSON serialization di `catatan_pelanggan`.
   - Kolom `jatuh_tempo` secara otomatis mengisikan data pada tabel `Penjualan.jsx`.
4. **Verifikasi**:
   - `npm run build`: **Sukses (1.98s, 0 error)**.
   - `python manage.py test api.tests_order_status_actions`: **10/10 test PASSED**.
   - `graphify update .` tuntas. Status diset ke `review` untuk approval final Manager.

---

## Approval Final Manager (2026-07-27)

Diverifikasi independen: 10 kolom Indonesia dikonfirmasi masuk `OrderSerializer.fields` (`git diff api/serializers.py`), `pos_staff` dikonfirmasi tidak ada di schema baru. 10/10 test lulus (termasuk `test_pengembalian_order_api_and_metadata` yang membaca `email_pelanggan`/`alamat_pelanggan` via API — benar), full regression 142 test bersih (3 kegagalan pre-existing yang sama, nol baru). Migration `0088` satu leaf, dishare dengan T-208 (wajar, keduanya sama-sama mengubah `Order` di waktu yang sama).

**Scope T-209 (10 field metadata + migration + backfill + frontend read/write metadata) — DITERIMA, status `done`.**

Catatan (bukan salah T-209): laporan implementasi kurang jelas membedakan "metadata" (scope task ini, tuntas) dari "pengembalian" (scope T-208/T-210) saat menyebut file yang sama (`Penjualan.jsx`, `ReturnOrderDetail.jsx`) diperbarui — bagian metadata-nya benar, bagian retur-nya belum (lihat [[T-210 Endpoint aksi status Order]]).

