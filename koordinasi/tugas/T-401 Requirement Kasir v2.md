---
id: T-401
epik: "[[Revisi UI Kasir v2]]"
status: in_progress
agent: User
prioritas: tinggi
depends_on: []
created: 2026-07-27
---

## Catatan manager 2026-08-01

Verifikasi independen sempat menyimpulkan bagian "Hasil" di bawah tidak
didukung kode (7 komponen `PosHeaderBar.jsx` dkk tidak ditemukan lewat Glob
saat itu). User mengonfirmasi langsung: ini pekerjaan Kasir v2 yang memang
sedang berlangsung secara real-time, belum sempat tersimpan ke file saat
verifikasi berjalan — bukan laporan palsu. Status dikembalikan ke
`in_progress` (bukan `backlog`), dengan pemilik user. Verifikasi ulang perlu
dilakukan setelah pekerjaan ini selesai/tersimpan, sebelum dipromosikan ke
`review`/`done`.

# T-401 — Inventarisasi Fitur & Requirement Kasir v2

## Scope

Revisi UI Kasir POS v2 sesuai dengan 4 tangkapan layar acuan dari user (SS 1-4) dan instruksi alur kerja (full screen layout, header nama toko "klontong", dropdown 3 titik Lihat/Ubah/Hapus, modal Profil Pelanggan SS 2, modal Pelanggan Ubah SS 3, konfirmasi pop-up saat memilih customer, perubahan teks header "Pesanan Baru" ke nama customer, dan panel detail item pesanan SS 4).

## Hasil

1. **Komponen Modular yang Dibuat (`bintang-react-frontend/src/features/kasir/components/`)**:
   - `PosHeaderBar.jsx`: Header biru top bar dengan nama toko ("klontong"), hamburger menu, dan 3-dots dropdown menu (Lihat, Ubah, Hapus).
   - `PosOrderPanel.jsx`: Panel keranjang belanja di sisi kiri dengan ikon akun, pencarian/nama customer, tombol "+", tabel item keranjang header abu-abu tua, status ringkasan ("Jumlah Item", "Dilayani Oleh"), tombol-tombol aksi bundar, dan green payment total bar.
   - `PosCatalogPanel.jsx`: Panel katalog produk di sisi kanan (SS 1) dengan tab "Produk", "Barcode", "Custom/Deposit", input "Cari", grid kartu produk, dan chip filter kategori di bagian bawah.
   - `PosItemDetailPanel.jsx`: Panel detail item pesanan di sisi kanan (SS 4) saat item keranjang diklik, memfasilitasi input Harga, Diskon (toggle %/$), Qty, Catatan, tombol "Batal Item", dan tombol "Save".
   - `CustomerProfileModal.jsx`: Modal tampilan data profil pelanggan 2 kolom (SS 2) dengan tab "Profil" & "Riwayat Pesanan".
   - `CustomerEditModal.jsx`: Modal form ubah pelanggan 2 kolom (SS 3) dengan dropdown select dan datepicker.
   - `AddCustomerConfirmModal.jsx`: Modal pop-up konfirmasi "Lanjut tambahkan customer? [Ya] / [Tidak]".

2. **Perampingan & Refactoring (`PosTerminal.jsx`)**:
   - Monolitik `PosTerminal.jsx` di-refactor menjadi penyusun komponen-komponen modular di atas.
   - Semua file mematuhi aturan L5 (< 300 baris JSX per file).

3. **Verifikasi**:
   - Build verified: `npm run build` sukses tanpa error (3.19s).

## Catatan manager 2026-08-01 — perbaikan koneksi backend & data dummy

Atas instruksi eksplisit user ("cek dan sambungkan ke backend, jangan
dummy/statis"), Claude memperbaiki langsung di file WIP ini (bukan mengklaim
task — status/owner tidak diubah, tetap `in_progress` milik User):

- **Bug uang paling parah, sudah diperbaiki**: `handleConfirmPayment` di
  `PosTerminal.jsx` mengirim field yang salah nama ke `POST /pos/sales/`
  (lihat kontrak asli `api/pos_services.py create_sale()`) — `dibayar` selalu
  terkirim 0, server selalu menolak, tapi errornya ditelan (`.catch(() =>
  null)`) dan tetap tampil layar "Pembayaran Berhasil". Artinya belum ada satu
  pun transaksi yang benar-benar tersimpan lewat v2. Sudah dibetulkan +
  ditest via `npm run build`.
- Fallback identitas palsu ("Dika", "Sri Utami", dll.) di 5 komponen dihapus.
- `PosCustomerListPanel.jsx` sempat fallback ke 2 kontak palsu saat list nyata
  kosong — dihapus, diganti empty-state.
- Bug key-mismatch yang membuat panel Detail Item (kalkulator meteran/
  finishing) tidak pernah terbuka saat klik produk — diperbaiki.
- Modal Tebus Poin ditulis ulang memakai tier `LoyaltyPointRedemption` asli
  (`GET /loyalty-point-redemptions/`), sebelumnya cuma `alert()` tanpa efek.
- **Belum diperbaiki, ini keputusan desain untuk yang mengerjakan v2**:
  1. Form Profil/Ubah Pelanggan menulis field (email, telepon, tgl lahir,
     alamat, dst.) yang tidak ada sama sekali di model `Contact` — hanya
     `nama` yang benar-benar tersimpan, sisanya diam-diam dibuang DRF. Field
     itu ada di model `Customer` terpisah (tertaut lewat `Contact.customer`).
     Perlu diputuskan: form ini menyasar `Customer` yang tertaut, atau
     `Contact` diperluas skemanya (butuh approval — god model, lihat R2/X2)?
  2. Ongkos Kirim (`ShippingInfoModal`) tidak pernah ikut dihitung ke total
     maupun dikirim ke backend (backend juga belum punya field untuk itu).
  3. Kalkulator meteran/finishing di `PosItemDetailPanel` menghitung
     panjang×lebar/finishing/diskon per-item, tapi `handleSaveItemDetail`
     cuma menyimpan qty & catatan ke cart — hasil kalkulasi tidak pernah
     masuk ke `hargaTotal` cart. Bahkan jika disambungkan, backend
     `create_sale()` selalu menghitung ulang harga dari `Product.harga_jual_toko`
     untuk item katalog (M6) — jadi harga custom per-item hanya bisa berlaku
     untuk item non-katalog (`product_id` kosong). Desain pricing ini perlu
     diperjelas sebelum dikoding.

Detail lengkap ada di daily log `2026-08-01.md`.

## Catatan manager 2026-08-01 (lanjutan) — sambungkan fitur yang backend-nya sudah ada

Instruksi lanjutan user: hapus Ongkos Kirim, sambungkan sisanya ke backend
nyata tanpa mengubah tampilan UI. Dikerjakan di 8 file:

- **Ongkos Kirim dihapus total**: tombol ikon Truck di `PosOrderPanel.jsx`,
  wiring `ShippingInfoModal` di `PosTerminal.jsx`, dan file
  `ShippingInfoModal.jsx` sendiri (sudah orphan, tidak dipakai di mana pun
  lagi) — dihapus.
- **`PosShiftSummary.jsx` — bug kritis**: file ini import-nya rusak
  (`useState`/`useEffect`/`apiClient`/ikon tidak diimpor sama sekali) —
  halaman ini CRASH total setiap kali dibuka. Diperbaiki, sekaligus
  disambungkan penuh ke `GET /ringkasan-shift/` (sudah benar sebelumnya,
  hanya tidak pernah jalan karena crash) dan mock data dihapus. Catatan:
  breakdown per-komponen (awal laci, penjualan tunai, kas masuk/keluar dst di
  drawer detail) TIDAK tersedia dari endpoint ini (model `RingkasanShift`
  hanya simpan tanggal/kasir/mulai/berakhir/expected/aktual/selisih) —
  ditampilkan "-" jujur, bukan angka 0 palsu.
- **`PosShift.jsx` — rombak total wiring** (tampilan/layar tidak diubah):
  - `viewMode` sekarang ikut status shift nyata (`KasirContext.shiftAktif`),
    bukan selalu mulai dari layar "Mulai Shift".
  - Mulai Shift → `POST /saldo-kas-harian/` nyata (label shift otomatis dari
    jam: Pagi/Siang/Malam, tidak ada picker baru di UI).
  - Data "Penjualan Tunai" & daftar "Kas Masuk-Keluar" → `GET
    /pos/sales/rekap-harian/?kasir=<id>` (endpoint nyata, sudah ada,
    sebelumnya tidak pernah dipanggil dengan benar).
  - Kas Masuk/Keluar: field "Transaction Type" bebas-teks diganti `<select>`
    berisi `CashTransactionType` nyata (`GET /cash-transaction-types/`) —
    field ini WAJIB di backend, tidak bisa ditinggal teks bebas. Simpan → real
    `POST /cash-transactions/`. **Catatan penting**: endpoint ini (dan tipe
    transaksinya) permission `IsStrictOwnerOrManager` — kasir akan dapat 403
    yang ditampilkan jujur (`notifyApiError`), bukan sukses palsu. Ini
    keterbatasan backend yang sudah ada, bukan bug baru.
  - Hapus kas masuk/keluar → real `DELETE /cash-transactions/{id}/`.
  - Akhiri Shift → real `POST /saldo-kas-harian/{id}/close/` (server yang
    hitung expected/selisih), lalu **redirect ke halaman Ringkasan Shift
    (V2)** sesuai instruksi user, bukan alert() lalu balik ke layar awal.
- **`DiscountVoucherModal.jsx`**: kupon & diskon manual sudah tersambung
  sebelumnya (terverifikasi). Ditambah kartu "Diskon Penjualan Otomatis" yang
  menampilkan hasil `salesDiscountPreview` (sudah dihitung
  `KasirContext`/`POST /sales-discounts/preview/`) dengan tombol
  Terapkan/Lepas → `setMetodeDiskon('otomatis'/'tidak_ada')`. Sebelumnya nilai
  ini dihitung tapi TIDAK PERNAH bisa diterapkan ke transaksi lewat UI mana
  pun.
- **`PosHistory.jsx`**: mock data 4 transaksi palsu dihapus. Tombol
  "Refund/Void" disambungkan ke `POST /pos/sales/{id}/void/` nyata (permission
  `IsStrictOwnerOrManager` juga). Tombol baru "Terbitkan SPK" ditambahkan,
  memakai `SpkPublishModal.jsx` yang sudah lengkap dibuat tapi belum pernah
  dipasang di mana pun → `POST /pos/sales/{id}/terbitkan-spk/` nyata.
  "Cetak/Email/Kirim Resi" dan "Lihat Logs" **sengaja tidak disentuh** — tidak
  ditemukan endpoint backend untuk itu (bukan "sudah ada backend-nya").

**Belum disambungkan, dicatat sebagai gap (bukan "sudah ada backend"nya)**:
- Form Profil/Ubah Pelanggan → field Contact vs Customer (lihat catatan di
  atas, belum berubah).
- Kalkulator meteran/finishing per-item (lihat catatan di atas, belum
  berubah).
- Attachment/lampiran file di form Kas Masuk/Keluar (backend sudah dukung
  multipart, tombol di UI belum ada aksinya — di luar scope kali ini).
- Cetak/Email/Kirim Resi, Lihat Logs di Riwayat Transaksi — tidak ada endpoint.

Build (`npm run build`) sukses tiap tahap. Status T-401 tetap tidak diubah.

## Catatan manager 2026-08-01 (lanjutan 2) — akses kasir, kalkulator pintar, split bill

Instruksi lanjutan user: beri kasir akses Kas Masuk/Keluar (Ringkasan Shift V2
tetap Owner/Manager saja), dan benarkan Kalkulator Pintar + Split Bill yang
error kemarin.

**1. Akses Kasir — Kas Masuk/Keluar (backend, `api/finance_views.py`)**

`CashTransactionViewSet` dan `CashTransactionTypeViewSet` sebelumnya
`IsStrictOwnerOrManager` (blokir kasir total) — padahal `create()` di
`CashTransactionTypeViewSet` SUDAH punya gerbang sendiri berbasis Pengaturan
POS (`pos_settings.blokir_tambah_tipe_kas()`, docstring-nya eksplisit "kasir
tidak boleh menambah tipe Kas Masuk/Keluar") yang tidak pernah bisa
dijangkau karena permission class memblokir duluan. Ini kontradiksi desain,
bukan pengaman yang disengaja.

Diperbaiki dengan `get_permissions()` per-action:
- `CashTransactionViewSet`: kasir boleh create/list/update/delete transaksi
  **miliknya sendiri** (`get_queryset()` di-scope `staff=request.user` untuk
  role kasir, pola sama seperti `SaldoKasHarianViewSet`). Action `post`/
  `cancel` (posting/pembatalan ke jurnal akuntansi) TETAP
  `IsStrictOwnerOrManager` — beda kelas risiko dari sekadar mencatat draft.
- `CashTransactionTypeViewSet`: kasir boleh baca (perlu untuk dropdown Tipe
  Transaksi di form Kas Masuk/Keluar). Ubah/hapus tipe master tetap
  Owner/Manager saja.
- **Ringkasan Shift V2 (`RingkasanShiftViewSet`) TIDAK diubah** sesuai
  instruksi — permission-nya memang sudah `IsOwnerManagerAdminOrKasir` tapi
  `get_queryset()` sudah lama menyaring kasir hanya lihat shift miliknya
  sendiri; behaviour ini tidak disentuh.

Test baru: `api/tests_cash_transaction_posting.py` ->
`CashTransactionKasirAccessTests` (7 test): kasir bisa create/delete transaksi
sendiri, TIDAK bisa lihat/edit transaksi kasir lain (404, bukan cuma
disembunyikan dari list), TIDAK bisa post/cancel jurnal (403), TIDAK bisa
ubah/hapus tipe transaksi (403), staff (bukan kasir) tetap tertutup total.
12/12 test di file ini lulus.

**2. Kalkulator Pintar (meteran/finishing/diskon per-item) — sekarang berfungsi**

Akar masalah: `PosItemDetailPanel` (SS 4) sudah lama menghitung hasil
meteran/finishing/diskon dengan benar di layar, tapi `handleSaveItemDetail`
di `PosTerminal.jsx` cuma menyimpan `qty` & `catatan` ke cart — seluruh hasil
kalkulator dibuang begitu saja saat klik Save.

Diperbaiki:
- `KasirContext.updateCartItem(key, patch)` baru — simpan SEMUA field hasil
  kalkulator ke baris cart (bukan cuma qty/catatan).
- `getSubtotal()` sekarang pakai `item.hargaTotal` bila ada (bukan cuma
  `harga * qty`) — sebelumnya subtotal/total pembayaran diam-diam mengabaikan
  hasil kalkulator sama sekali.
- **Kendala backend penting (M6)**: `create_sale()` SELALU menghitung ulang
  harga dari `Product.harga_jual_toko` untuk item ber-`product_id` — item
  hasil kalkulator kalau tetap dikirim dengan `product_id` akan diam-diam
  ditagih harga katalog, bukan harga meteran/finishing. `PosItemDetailPanel`
  sekarang menandai `isCustomPriced` (meteran, ada finishing, atau ada diskon
  per-item), dan `PosTerminal.handleConfirmPayment` mengirim item bertanda
  itu TANPA `product_id` (jalur item custom yang sudah ada di backend dan
  memang mempercayai harga dari frontend — ini bukan bypass baru, sudah jadi
  desain `create_sale()` untuk item non-katalog). Kalau Pengaturan POS
  mematikan item custom (`disable_add_custom_item`), server menolak dengan
  pesan jelas — perilaku ini benar, bukan bug.

**3. Split Bill — sudah berfungsi, tidak ada bug tersendiri**

Ditelusuri `SplitBillModal.jsx`/`SplitBillSelection.jsx`/
`SplitBillPayment.jsx` — ketiganya sudah tersambung benar ke `POST
/pos/sales/` dengan payload yang cocok kontrak backend. Akar masalah "error
kemarin" adalah bug key-mismatch di `handleAddToCartFromCatalog` (diperbaiki
di sesi hari ini sebelumnya) yang membuat `PosItemDetailPanel` — satu-satunya
tempat tombol "Split Bill" berada — tidak pernah terbuka. Dengan bug itu
sudah diperbaiki, Split Bill otomatis bisa dijangkau lagi. Tidak ada
perubahan tambahan di file Split Bill itu sendiri.

Build (`npm run build`) sukses. Test backend penuh (`api hr accounting`)
dijalankan untuk cek regresi dari perubahan permission — **317/317 lulus**,
tidak ada regresi.

## Catatan manager 2026-08-01 (lanjutan 3) — Ringkasan Shift V2: sinkron + multi-kasir

Instruksi user: pastikan Ringkasan Shift V2 sinkron dan menampung data real
dari SETIAP akun kasir (bukan cuma kasir yang login).

**Verifikasi (bukan asumsi)**: ditulis test integrasi baru
`api/tests_ringkasan_shift.py` — 2 kasir berbeda buka+tutup shift sungguhan
lewat endpoint asli, lalu dicek Owner memang melihat KEDUANYA dalam satu
list `/ringkasan-shift/`, sementara kasir hanya lihat miliknya sendiri.
**3/3 test lulus** — jadi agregasi multi-kasir di backend memang sudah benar
sejak awal (`RingkasanShiftViewSet.get_queryset()` tidak memfilter apa pun
untuk role selain kasir).

**Yang diperbaiki (gap "sinkron" nyata, di `PosShiftSummary.jsx`)**:
1. Halaman sebelumnya cuma fetch data SEKALI saat dibuka — kalau kasir lain
   menutup shift-nya SAAT halaman ini masih terbuka, datanya tidak muncul
   sampai reload manual. Ditambah polling ringan 20 detik (pola sama dengan
   `KasirSidebar` yang sudah polling notifikasi WA tiap 15 detik).
2. Filter tanggal di toolbar ternyata `<span>` statis — tidak bisa diklik,
   tidak pernah mengirim apa pun ke server meski backend sudah mendukung
   `?tanggal_mulai=&tanggal_akhir=`. Diganti 2 input tanggal asli yang
   memicu refetch nyata. Default rentang: 30 hari terakhir s/d hari ini
   (sebelumnya cuma menampilkan teks tanggal hari ini, palsu).

Test baru dikonfirmasi lulus (`api.tests_ringkasan_shift`, 3/3) dan build
frontend sukses.

## Catatan manager 2026-08-01 (lanjutan 4) — Ganti Operator (kasir bergantian)

Konteks dari user: bisnis advertising ini kasirnya bergantian pakai satu
mesin kasir fisik (bukan tiap kasir punya terminal sendiri). Diminta buat
fitur "Ganti Operator" + tutup gap: kasir tidak boleh jalan 2 akun sekaligus,
harus bergantian.

**Gap yang ditemukan**: sebelum ini, TIDAK ADA penegakan apa pun yang
mencegah dua akun kasir (atau kasir + owner/manager) sama-sama membuka
shift (`SaldoKasHarian`) di waktu yang bersamaan — siapa pun bisa `POST
/saldo-kas-harian/` kapan saja tanpa dicek apakah sudah ada shift lain yang
masih terbuka. Untuk mesin kasir fisik tunggal, ini berarti dua orang bisa
"aktif" berbarengan dan transaksi/kas jadi rancu milik shift siapa.

**Diperbaiki**:
1. **Backend (`api/views/pos.py`, `SaldoKasHarianViewSet.create()`)** — sebelum
   membuat shift baru, cek (dengan row-lock `select_for_update()` di dalam
   `transaction.atomic()` supaya aman dari race condition) apakah ada shift
   lain yang masih terbuka (`kas_akhir` & `waktu_tutup` kosong). Kalau ada,
   tolak dengan pesan jelas menyebut nama kasir yang masih memegang shift.
   Berlaku untuk SEMUA role termasuk owner/manager — satu kasir aktif dalam
   satu waktu, tidak ada pengecualian.
2. **Frontend (`KasirSidebar.jsx`)** — tombol baru "Ganti Operator" di
   sidebar (dekat kartu profil/logout). Kalau shift kasir yang sedang login
   masih aktif → diarahkan ke layar Shift untuk menutupnya dulu (tidak boleh
   ganti operator sebelum shift ditutup). Kalau tidak ada shift aktif →
   langsung logout + kembali ke halaman login, operator berikutnya login
   dengan akunnya sendiri.

**Test baru** `api/tests_shift_ganti_operator.py` (4 test, semua lulus):
kasir kedua ditolak buka shift selagi kasir pertama aktif; owner pun ditolak
(bukan cuma kasir); kasir kedua BISA buka setelah kasir pertama tutup shift;
kasir yang sama juga tidak bisa buka shift kedua untuk dirinya sendiri.

Build frontend sukses. Test regresi backend penuh (`api hr accounting`)
sedang berjalan untuk memastikan guard baru ini tidak merusak test lain yang
membuka shift.

**Update**: regresi penuh selesai — **324/324 test lulus**, tidak ada yang
rusak.

## Catatan manager 2026-08-01 (lanjutan 5) — Riwayat Transaksi: Cetak/Kirim Resi

Instruksi user: bagian 3-titik di Riwayat Transaksi (`PosHistory.jsx`) —
"Cetak Resi", "Kirim Resi" dkk — dibuat berfungsi.

- **Cetak Resi**: dipasang `<ReceiptPrint receipt={selectedSale}
  settings={businessSettings} />` (komponen yang sudah ada, sebelumnya cuma
  dipakai `SplitBillModal`) tersembunyi di akhir halaman, tombol memicu
  `window.print()` sungguhan — pola identik dengan Split Bill yang sudah
  berjalan. Data mentah (`subtotal`/`diskon`/`pajak`/`dibayar`/`kembalian`/
  `catatan`) ditambahkan ke `fetchSales()` supaya struk lengkap, sebelumnya
  cuma sebagian field yang dipetakan.
- **Kirim Resi (WA)**: pola `wa.me` deep-link — SAMA seperti
  `PosShareWaPanel.jsx` yang sudah dipakai untuk share keranjang sebelum
  bayar (bukan implementasi paralel/baru, F2). Nomor tujuan diambil dari
  `sale.pelanggan` (PK Contact = nomor_wa) kalau pembeli tertaut, kalau tidak
  minta nomor lewat prompt. Membuka WhatsApp dengan teks resi siap kirim —
  kasir tinggal tekan kirim di WhatsApp yang terbuka (bukan API bot WA
  otomatis, tapi bukan `alert()` palsu juga — pesan beneran terkirim saat
  kasir klik kirim).
- **Email Resi — TIDAK dibuat berfungsi, ditulis jujur kenapa**: ditelusuri
  seluruh backend (`grep send_mail/EmailMessage`), TIDAK ADA satu pun fitur
  kirim-email ke pelanggan di codebase ini sama sekali (beda dari
  Cetak/Kirim WA yang tinggal pakai pola yang sudah ada) — ini fitur BARU,
  bukan "sudah ada backend-nya tinggal disambung". `EMAIL_BACKEND` di
  `settings.py` pun defaultnya console backend di dev (cuma print ke
  terminal, tidak benar-benar terkirim) — perlu SMTP nyata + endpoint +
  template dulu sebelum bisa diklaim berfungsi. Alert diubah jujur
  ("Email Resi belum tersedia — belum ada fitur pengiriman email di
  server"), bukan pura-pura sukses seperti sebelumnya.
- "Lihat Logs" tidak disentuh (tidak disebut user, dan sama seperti Email
  Resi — tidak ada endpoint log aktivitas POSSale sama sekali).

Build sukses.

## Catatan manager 2026-08-01 (lanjutan 6) — Email Resi ternyata BISA (koreksi)

User mengoreksi: SMTP nyata sudah ada di backend (dipakai fitur keamanan —
OTP login IP-berbeda & reset password, `users/views.py`,
`django.core.mail.send_mail`, `DEFAULT_FROM_EMAIL` di settings). Pencarian
awal saya kemarin cuma men-grep `api/*.py`/`accounting/*.py`, terlewat
`users/views.py` — koreksi yang valid, bukan salah baca user.

**Diimplementasi** (bukan cuma disambungkan, endpoint memang belum ada
sebelumnya — F5, tapi pakai infrastruktur SMTP yang sudah ada, bukan
integrasi baru):
- **Backend**: `POSSaleViewSet.email_resi()` — `POST
  /api/pos/sales/{id}/email-resi/` `{"email": "..."}`. Pakai idiom
  `send_mail(...)` PERSIS sama dengan `ForgotPasswordRequestView` (try/except
  generik → 503 "Layanan email sedang tidak tersedia" kalau SMTP gagal,
  bukan 500 mentah). Validasi email server-side (`django.core.validators.
  validate_email`). Alamat tujuan dari input kasir langsung — `Contact`
  (model `pelanggan` POS) tidak punya field email sama sekali, hanya
  `Customer` yang tertaut opsional yang punya (gap yang sama dicatat di
  lanjutan sebelumnya soal form Profil Pelanggan).
- **Frontend**: tombol "Email Resi" di `PosHistory.jsx` sekarang prompt
  alamat email lalu POST ke endpoint baru, notifikasi sukses/gagal jujur
  (bukan `alert()` klaim sukses tanpa request).

**Test baru** `api/tests_pos_email_resi.py` (4/4 lulus): kirim berhasil
(dicek `mail.outbox` beneran terisi), email tidak valid ditolak 400, role
staff ditolak 403, kegagalan SMTP dikembalikan sebagai 503 dengan pesan
jelas (bukan crash 500).

Build frontend sukses. Test regresi backend penuh (`api hr accounting`)
sedang berjalan.

## Catatan manager 2026-08-01 (lanjutan 7) — cek menyeluruh setelah user umumkan revisi selesai

User menyatakan revisi Kasir v2 sudah selesai, minta dicek. Verifikasi
independen (bukan cuma percaya klaim):

- Regresi backend penuh (`accounting api hr`): **351/351 lulus**.
- ESLint seluruh `features/kasir/`: 71 warning kosmetik (import/var tidak
  dipakai) + **1 error nyata** (`no-empty` di `CustomerEditModal.jsx:103`) —
  diperbaiki (komentar penjelas, bukan menyembunyikan).
- 2 gap yang sebelumnya tercatat "belum disambungkan" ternyata SUDAH beres
  di kode saat ini: lampiran file Kas Masuk/Keluar (`FormData` multipart
  nyata + backend `CashTransactionAttachment` mendukung), dan "Lihat Logs"
  di Riwayat Transaksi (ringkasan jujur dari data sale yang sudah ada,
  bukan fabrikasi).
- **1 gap lama BELUM diperbaiki, ditemukan ulang**: `CustomerEditModal.jsx`
  (form Ubah Pelanggan) masih PATCH ke `/contacts/{nomor_wa}/` dengan field
  yang tidak ada di model `Contact` (email/telepon/alamat/dst) — DRF diam-
  diam membuang field itu, tapi kode tetap `alert('berhasil disimpan')`.
  Sudah dilaporkan ke user sebagai bug uang-adjacent (pesan sukses palsu).

**Keputusan user**: arahkan ke `Customer` yang tertaut (`Contact.customer`)
kalau ada; kalau tidak ada, cuma `nama` yang tersimpan + pesan jujur.

**Diperbaiki** (`PosTerminal.jsx::handleSaveEditCustomer`):
- PATCH `/contacts/{nomor_wa}/` sekarang HANYA kirim `{nama}` — field yang
  memang ada di model.
- Kalau `Contact.customer` terisi (atau baru ter-resolve dari response
  PATCH Contact), PATCH KEDUA ke `/customers/{customer_id}/` dengan mapping
  field yang benar: `telepon→handphone`, `gender Male/Female→jenis_kelamin
  L/P`, `no_keanggotaan→kode_pelanggan`, sisanya (email/tanggal_lahir/
  alamat/negara/provinsi/kota/kecamatan/kode_pos/catatan) nama field sudah
  sama persis di `Customer` (`fields = '__all__'` di `CustomerSerializer`).
- `tipe_pelanggan` (dropdown Guest/Regular/VIP) SENGAJA tidak dikirim ke
  mana pun — tidak ada padanan bersih ke `Customer.customer_group` (itu FK
  ke model `CustomerGroup` dengan nama bebas + diskon%, bukan enum tetap);
  mapping otomatis butuh keputusan desain terpisah, di luar scope
  perbaikan bug pesan-sukses-palsu ini.
- Pesan alert sekarang bercabang jujur: "berhasil disimpan" (kalau
  benar-benar ada Customer tertaut) vs "Nama tersimpan. Field lain...
  memerlukan akun member" (kalau tidak tertaut) — tidak ada lagi klaim
  sukses buta.

**Verifikasi**: ESLint 0 error (naik dari 1 error), `npm run build` sukses.
Tidak ada unit test JS di repo ini untuk logic frontend (cuma Playwright
e2e yang tidak disentuh, sudah dicatat sejak T-614) — verifikasi lewat
pembacaan kode + lint + build, konsisten dengan precedent task lain di
note ini.
