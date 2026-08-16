---
tags: [koordinasi, epik]
status: aktif
created: 2026-07-27
---

# Epik: Revisi UI Kasir (POS v2)

## Tujuan

Membangun ulang tampilan kasir versi baru: melengkapi fitur yang belum ada, sekaligus mengeluarkan layar kasir dari daftar god file (`PointOfSale.jsx` ~3.400 baris) menjadi struktur feature-folder + hooks yang sehat.

## Aturan khusus epik ini

1. **Replacement terkontrol, bukan versi paralel (L4).** V2 dibangun per-bagian di `src/features/pos/` (folder + hooks); setiap bagian yang selesai **menggantikan** bagian lama, dan di akhir epik file lama dihapus. Tidak boleh ada dua kasir hidup berdampingan di routing.
2. **Kontrak API = drf-spectacular** (F2/API5). UI baru tidak boleh mengarang endpoint/field; kebutuhan endpoint baru → task backend terpisah lewat board.
3. **Aturan bisnis tetap di server** (API1, R6): UI hanya menampilkan; blokir-blokir POS (`pos_settings.py`: blokir jual stok kosong, harga di bawah harga beli, dst.) dan perhitungan diskon (`promo_engine.py`) tidak boleh dihitung ulang versi sendiri di frontend.
4. **Interlock dengan [[Integrasi Akuntansi-POS]]**: T-103 menambah mapping metode bayar → `accounting.PaymentMethod`. Layar pembayaran v2 harus memakai kontrak itu (picker metode bayar dari master, bukan string bebas). Desain layar pembayaran menunggu kontrak T-103 stabil.
5. Komponen `.jsx` ≤ 300 baris hard limit (L5); logic di `useX()` hooks; HTTP via `apiClient` (F4).

## Task

- [ ] **T-401** — Inventarisasi fitur & requirement kasir v2 → [[T-401 Requirement Kasir v2]] *(butuh input user — daftar fitur yang belum ada)*
- [ ] **T-402** — Desain arsitektur v2: peta layar, struktur `features/pos/`, urutan migrasi per-bagian, rencana penghapusan file lama. *(manager, setelah T-401)*
- [ ] T-403+ — Implementasi per layar/bagian *(dipecah dari T-402)*

## Checklist Koneksi Data Asli (ditambahkan 2026-07-31, Claude manager)

Ditulis setelah audit langsung ke kode `PosTerminal.jsx`/`api/pos_settings.py` (bukan
generik) dan pola bug berulang yang ditemukan minggu ini di modul lain (T-614, T-629,
T-630) — export/import palsu, tombol tanpa `onClick`, field relasi kosong dari
sumbernya. Berlaku untuk SEMUA task implementasi T-403+.

### 1. Satu-satunya jalur baca aturan POS: `pos_settings.py` → `/pos/sales/pos-rules/`

`api/pos_settings.py` docstring-nya eksplisit: *"Sebelumnya seluruh setelan di menu
Pengaturan POS hanya tersimpan di `SystemConfig` tanpa ada satu pun kode yang
membacanya saat transaksi berjalan — toggle bisa diaktifkan tapi POS tetap
berperilaku sama."* Modul ini dibuat justru untuk menutup celah itu — penegakan di
server, UI cuma cermin.

`PosTerminal.jsx` (kode lama, sudah BENAR) memanggil `GET /api/pos/sales/pos-rules/`
(action di `POSSaleViewSet`, `api/pos_views.py`) untuk dapat aturan jadi
(`blokir_stok_kosong`, `blokir_harga_dibawah_beli`, `blokir_tahan_pesanan`,
`wajib_shift_aktif`, `sembunyikan_stok`, `disable_add_custom_item`, `hide_splitbill`,
`passkey`, dst) — **BUKAN** membaca `pos_ext_settings`/`pos_stok_*` mentah dari
`/business-settings/` lalu menafsirkan sendiri kondisi if/else di frontend.

**Aturan v2**: pola ini WAJIB dipertahankan/diperluas, bukan dibongkar. Kalau layar
baru butuh aturan POS yang belum ada di `pos-rules`, tambah field baru di endpoint
itu (via fungsi baru di `pos_settings.py`) — jangan pernah menghitung ulang logika
blokir di React. Pelanggaran ini persis R6 (`promo_engine.py`) tapi untuk domain
aturan POS.

### 2. Temuan: 3 toggle "Mode - cek stok" tersimpan tapi tidak ditegakkan

Dicek langsung (grep seluruh backend): `pos_stok_selalu_cek_sebelum_order`,
`pos_stok_transfer_harus_proses_penerima`, `pos_stok_posting_otomatis_laba_rugi`
HANYA muncul di `api/serializers.py` (baca/tulis `SystemConfig`) — tidak dibaca di
`pos_settings.py` atau file lain manapun. Beda dari 2 toggle "cek stok" lain
(`pos_stok_blokir_jual_jika_kosong`, `pos_stok_blokir_hapus_jika_ada`) yang sudah
benar ditegakkan lewat `blokir_jual_jika_stok_kosong()`/`blokir_hapus_produk_jika_ada_stok()`.

**Bukan tugas untuk dikerjakan sekarang** — tapi kalau v2 butuh salah satu dari 3
toggle ini benar-benar berfungsi di alur transaksi, itu task BACKEND terpisah
(tambah fungsi enforcement di `pos_settings.py` + titik pakainya), bukan
"tinggal sambungkan UI" — datanya memang belum pernah dipakai di mana pun.

### 3. Checklist "selesai" per layar (sebelum status `review`)

Pola bug yang berulang ditemukan minggu ini — wajib dicek manual di kode, bukan
diasumsikan dari tampilan:

- [ ] Tombol/aksi yang **terlihat** menyimpan benar-benar memanggil `apiClient` ke
      endpoint nyata — bukan `alert()`/`notify()` sukses tanpa request apa pun
      (ditemukan di 6 titik export Akuntansi, T-630).
- [ ] Setiap tombol interaktif punya `onClick` yang jelas — jangan asumsi dari
      styling "terlihat aktif" (4 tombol "Cetak jurnal" ternyata mati total, 3 di
      antaranya malah `disabled` permanen, T-630).
- [ ] State awal (`useState(default)`) ditimpa respons `GET` nyata saat mount —
      kalau fetch gagal diam-diam, jangan biarkan default hardcode terlihat
      seolah data server.
- [ ] Field yang menampilkan data relasi (nama pelanggan/supplier, dst.) dicek
      SAMPAI titik posting/create-nya — field bisa ada di model+serializer tapi
      tetap kosong kalau kode yang membuat datanya tidak pernah mengisi FK itu
      (kasus nyata: `JournalEntryLine.customer` kosong untuk semua transaksi POS
      karena `pos_posting.py` tidak pernah mengisinya — lihat T-630).
- [ ] Toggle/pengaturan baru: sebelum diklaim "berfungsi", grep apakah nilainya
      benar-benar DIBACA di luar file serializer/model-nya sendiri (lihat poin 2
      di atas) — tersimpan ≠ ditegakkan.
