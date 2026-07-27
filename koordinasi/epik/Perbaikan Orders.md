---
tags: [koordinasi, epik]
status: aktif
created: 2026-07-27
---

# Epik: Perbaikan Modul Orders

## Tujuan

Membereskan masalah-masalah yang masih ada di modul pesanan (di luar integrasi akuntansi — itu epik terpisah: [[Integrasi Akuntansi-Orders]]).

## Kondisi awal

User menyatakan *"bagian pesanan masih banyak yang perlu diperbaiki"* — **daftar spesifiknya belum ada**. Epik ini sengaja kosong sampai T-301 selesai: inventarisasi dulu, baru pecah jadi task.

Fakta yang sudah diketahui dari graph/dokumen:

- `Orders.jsx` ~2.500 baris — god file, harus dipecah kalau disentuh
- `api/views.py` ~3.700 baris berisi sebagian besar logic orders
- `OrderViewSet` punya fitur: stats, print-return, import-status-csv, pembayaran ke buku besar
- Alur order dari WhatsApp bot (`wa_logic.py`, `KasirAntreanWaTest`) ikut menulis ke Order
- SPK produksi lahir dari order item ATAU dari POS (`spk.py`, `SpkDariPosTest`)

## Task

- [ ] **T-301** — Inventarisasi masalah → [[T-301 Inventarisasi masalah Orders]]
  - Kumpulkan daftar keluhan/bug/kekurangan dari user (wajib — agent tidak boleh mengarang masalah)
  - Lengkapi dengan audit graph: `graphify query "order lifecycle"`, cek edge INFERRED di sekitar `Order` (92 edge inferred butuh verifikasi)
  - Output: daftar masalah terprioritisasi di note ini, lalu dipecah jadi T-302, T-303, … di [[Agent Board]]
- [ ] **T-209** — Bangun schema Order metadata yang layak (ganti hack JSON-di-catatan_pelanggan) → [[T-209 Bangun schema Order metadata]] — **wajib desain approved dulu (F1)**. Ini kemungkinan besar akar dari "rapikan dulu schema arsitektur" yang diminta user 2026-07-27. Status: desain di-review manager, 2 revisi diminta (konvensi nama, `pos_staff` duplikat `dilayani_oleh`).
- [ ] **T-210** — Endpoint aksi status Order (Selesaikan/Batalkan/Retur), ganti generic PATCH → [[T-210 Endpoint aksi status Order]] — **wajib desain approved dulu (API5)**. Depends T-208 (retur butuh model Return dulu). Ini jawaban atas permintaan user "router dan endpoint backend untuk semua alur".
- [ ] **T-302** — Bangun Detail Pesanan Selesai (ikuti pola `CancelledOrderDetail.jsx` — reuse card, jangan dari nol) → [[T-302 Bangun Detail Pesanan Selesai]]
- [ ] **T-303** — Audit & poles Detail Pesanan Dibatalkan (⚠️ SUDAH ADA sebagai `CancelledOrderDetail.jsx`, bukan bangun baru) → [[T-303 Bangun Detail Pesanan Dibatalkan]]

> Catatan: T-108 (3 test pre-existing) dipindah ke [[Bug QA Manual]] — bukan murni domain Orders (2 dari 3 test soal promo engine).
> Catatan: fitur "Pengembalian" (`ReturnOrderDetail.jsx`) sudah ada sebagai tampilan tersendiri — TIDAK perlu dibangun ulang, tapi datanya masih berupa text-parsing dari catatan pelanggan, bukan field/model asli (lihat [[Integrasi Akuntansi-Orders]] — keputusan model Return sudah diambil, → [[T-208 Bangun model Return]]).
> Catatan: T-304 (rencana cleanup `OrderDetail.jsx`) dibatalkan sebagai task terpisah — ternyata `OrderDetail.jsx` dan sub-komponennya (`OrderHeader`/`CustomerCard`/`ShippingCard`/`PaymentCard`/`OrderLogSection`/`CancelledOrderDetail`) sudah cukup rapi (180-285 baris masing-masing). Yang butuh dirapikan bukan pemecahan file React, tapi schema datanya — itulah T-209.
