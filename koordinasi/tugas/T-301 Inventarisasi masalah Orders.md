---
id: T-301
epik: "[[Perbaikan Orders]]"
status: backlog
agent: 
prioritas: tinggi
depends_on: []
created: 2026-07-27
---

# T-301 — Inventarisasi masalah modul Orders

## Scope

Mengubah *"masih banyak yang perlu diperbaiki"* menjadi daftar masalah konkret dan terprioritisasi. Read-only terhadap kode.

Dua sumber, dua-duanya wajib:

**A. Dari user — Temuan #1 (masuk, 2026-07-27):**

**Masalah**: Di `Transaksi → Penjualan` (`features/transaksi/pages/Penjualan.jsx`), 4 tab (Butuh Diproses/Selesai/Pengembalian/Dibatalkan) seharusnya masing-masing punya tampilan detail sendiri saat order diklik (pola referensi: Olsera — "Open Order Detail", "Detail Pesanan Selesai", "Detail Pengembalian", "Detail Pesanan Dibatalkan").

**Dikonfirmasi manager langsung dari kode** (`Penjualan.jsx` baris 138-172, tombol No. Pesanan tiap baris tabel):
- Tab **Pengembalian** → `setView('return-detail')` → `ReturnOrderDetail.jsx` — **sudah ada, distinct.**
- Tab **Butuh Diproses**, **Selesai**, **Dibatalkan** → ketiganya `setView('detail')` → `OrderDetail.jsx` (`features/transaksi/components/OrderDetail.jsx`) — **komponen yang SAMA, tidak dibedakan sama sekali.**

→ "Detail Pesanan Selesai" dan "Detail Pesanan Dibatalkan" **belum ada sebagai tampilan berbeda** — inilah kemungkinan besar sumber "detail pesanan masih perlu diperbaiki" dari laporan awal user.

Dipecah jadi task konkret: [[T-302 Bangun Detail Pesanan Selesai]], [[T-303 Bangun Detail Pesanan Dibatalkan]], [[T-304 Rapikan Open Order Detail]].

> ❓ **[USER — masih terbuka]** Selain temuan di atas, ada keluhan/bug lain di bagian pesanan? Contoh format: "status order tidak update setelah X", "input pesanan WA sering salah parsing", dst.

**B. Dari audit graph (pelengkap):**
- `graphify query "order lifecycle status transitions"`
- `graphify explain "OrderViewSet"`
- 92 edge INFERRED di sekitar `Order` — mana yang nyata, mana yang salah
- Cek konsistensi 3 pintu masuk order: manual (Penjualan.jsx) / WA bot (`wa_logic.py`) / POS→SPK (`spk.py`)

## Acceptance criteria

- [ ] Daftar masalah dari user sudah masuk (kalau kosong → tanya user, jangan lanjut sendiri)
- [ ] Tiap masalah ditulis: gejala → dugaan lokasi (file/modul dari graph) → prioritas (tinggi/sedang/rendah)
- [ ] Dipecah jadi task T-302, T-303, … dan didaftarkan di [[Agent Board]]
- [ ] Masalah yang ternyata milik epik akuntansi dipindah ke [[Integrasi Akuntansi-Orders]], bukan digandakan

## Hasil

*(diisi agent yang mengerjakan)*
