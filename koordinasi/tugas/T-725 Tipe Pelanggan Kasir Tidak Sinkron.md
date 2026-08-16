---
id: T-725
epik: "[[Bug QA Manual]]"
status: review
agent: Claude
prioritas: sedang
depends_on: ["T-724"]
created: 2026-08-11
---

# T-725 — Tipe Pelanggan di Kasir tidak sinkron dengan Pelanggan & Supplier

## Scope

User lapor setelah [[T-724 Tanggal Gabung dan Transaksi Terakhir Pelanggan|T-724]] (import 2 tipe pelanggan baru, Agen & MOU): di Kasir, Tipe Pelanggan "belum terhubung, sepertinya karena tidak sinkron". Diaudit langsung, ternyata bug nyata 3 lapis — bukan cuma tidak sinkron, tapi memang putus total dari data asli.

## Temuan

1. **Baca (list)** — `ContactSerializer` (`api/serializers.py`) sama sekali tidak mengekspos `customer_group`. Daftar pelanggan Kasir (`PosCustomerListPanel.jsx`) baca `customer.tipe_pelanggan` yang tidak pernah ada di response API → selalu jatuh ke fallback `'Guest'` untuk SEMUA kontak, apa pun kategori sungguhannya.
2. **Pilih (dropdown)** — `CustomerEditModal.jsx` (form Tambah/Ubah Pelanggan di Kasir) dropdown Tipe Pelanggan hardcode `Guest/Regular/VIP` — nilai fiktif, tidak pernah cocok dengan `CustomerGroup` asli (Agen/MOU/Gold/dst). Kasir memang tidak bisa pilih "Agen"/"MOU" sama sekali.
3. **Simpan (write)** — `handleSaveEditCustomer` (`PosTerminal.jsx`) POST/PATCH ke `/api/customers/` tidak pernah mengirim field `customer_group` — bahkan kalau dropdown-nya benar, pilihannya tidak akan tersimpan.

## Perbaikan

- `ContactSerializer`: tambah `customer_group` (id) & `customer_group_nama`, sourced dari `Customer` yang tertaut (`contact.customer.customer_group`).
- `ContactViewSet.get_queryset()`: `select_related('customer__customer_group')` supaya tidak N+1.
- `CustomerEditModal.jsx`: dropdown sekarang `fetch /customer-groups/` asli (opsi "Guest" tetap ada untuk representasi "tanpa kategori", persis pola di `AddCustomerModal.jsx` modul Pelanggan & Supplier).
- `PosTerminal.jsx::handleSaveEditCustomer`: `customer_group` ikut dikirim di payload create & update `/customers/`.
- `PosCustomerListPanel.jsx` & `CustomerProfileModal.jsx`: baca `customer_group_nama` (nyata), bukan `tipe_pelanggan`/`kategori` (field yang tidak pernah ada di response).

## Verifikasi

- 3 test baru (`api/tests_contact_customer_group.py`): kontak tertaut Customer berkategori, tanpa Customer tertaut, dan tertaut Customer tanpa kategori — 3/3 lulus.
- Full suite `api`: 318/319 lulus (dijalankan 2x). 1 gagal — `test_kasir_tidak_bisa_ubah_pengaturan_supplier`, **pre-existing tidak terkait** (lihat [[T-724 Tanggal Gabung dan Transaksi Terakhir Pelanggan|T-724]]). Sempat muncul 1 kegagalan tambahan soal urutan Order (`tests_order_filter.py`) di satu run tapi TIDAK reproduce di run berikutnya maupun saat dijalankan terisolasi — flaky pre-existing (kemungkinan resolusi timestamp), dikonfirmasi bukan dari perubahan task ini.
- ESLint file yang diubah: 0 error (cuma warning lama yang sudah ada sebelumnya).
- **Belum dites lewat browser sungguhan** — verifikasi sejauh ini di level API (endpoint & payload persis yang dipanggil UI). Kalau perlu kepastian visual, perlu jalan dev server dan cek langsung di Kasir.
- **Belum disentuh di VPS** sama sekali, termasuk field T-724.

## File diubah

- `bintang-advertising-backend/api/serializers.py`
- `bintang-advertising-backend/api/views/contacts.py`
- `bintang-advertising-backend/api/tests_contact_customer_group.py`
- `bintang-react-frontend/src/features/kasir/components/CustomerEditModal.jsx`
- `bintang-react-frontend/src/features/kasir/components/PosCustomerListPanel.jsx`
- `bintang-react-frontend/src/features/kasir/components/CustomerProfileModal.jsx`
- `bintang-react-frontend/src/features/kasir/pages/PosTerminal.jsx`
