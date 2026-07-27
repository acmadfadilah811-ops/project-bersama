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
