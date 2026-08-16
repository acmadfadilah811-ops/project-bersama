---
id: T-616
epik: "[[Production Readiness dan Integrasi Akuntansi]]"
status: done
agent: Codex (manager)
prioritas: tinggi
depends_on: [T-615]
created: 2026-07-29
---

# T-616 — Toolbar Bulk Post Return Akuntansi

## Requirement

Pulihkan checkbox per baris dan menu atas tabel `Batal Post` serta `Post` pada
halaman mandiri Akuntansi untuk Return Penjualan dan Return Pembelian.

## Hasil

- Perbaikan dilakukan langsung oleh **Codex sebagai manager**.
- Header checkbox memilih semua baris yang sedang terlihat; checkbox baris
  memilih return individual.
- Toolbar aktif ketika ada baris yang dipilih dan kembali nonaktif setelah
  selection dikosongkan.
- Return Penjualan memakai `PATCH /api/pengembalian/{id}/` dengan transisi
  `Tunda -> Dikonfirmasi` untuk `Post` dan `Dikonfirmasi -> Tunda` untuk
  `Batal Post`.
- Return Pembelian memakai endpoint source-of-truth `post-retur` dan `cancel`;
  hanya return berstatus `draft` yang diproses.
- Dropdown status pada dua layar return memakai tiga status Akuntansi: `All`,
  `Terposting`, dan `Belum Terposting`. Mappingnya adalah `Dikonfirmasi` atau
  pembelian `selesai` ke `Terposting`; `Draft`, `Tunda`, dan `Batal` ke
  `Belum Terposting`.
- Pemrosesan bulk memakai request API nyata, notifikasi hasil, reload daftar,
  dan tidak mengubah navigasi ke menu Transaksi.

## Detail Pembelian

`Pembelian.jsx` sekarang meneruskan mode tab ke `PembelianDetail`, sehingga
detail Butuh Diproses, Telah Diproses, Retur, dan Dibatalkan memiliki konteks
header masing-masing. Dokumen Dibatalkan ditampilkan read-only; detail retur
tetap mempertahankan aksi retur yang sesuai.

## Catatan Akuntansi

Pada Return Penjualan, backend saat ini belum memiliki endpoint posting/unpost
khusus; endpoint return membuat jurnal pembalik ketika return diajukan.
Karena itu toolbar mengubah status workflow return melalui kontrak PATCH yang
tersedia, bukan membuat atau menghapus jurnal dari frontend. Endpoint khusus
untuk reversal posting dapat dibuat sebagai task backend terpisah bila alur
unpost jurnal memang diperlukan.

## Verifikasi

- ESLint dua halaman: **0 error**.
- ESLint halaman Pembelian dan komponen detail: **0 error**.
- `npm.cmd run build`: **lulus**.
- `git diff --check`: **lulus** untuk dua halaman.
- `graphify update .`: **lulus**.
