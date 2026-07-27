# Perbaikan Frontend Berdasarkan Audit

Route permission default-deny, shift hanya milik user, angka Rupiah dibulatkan, transaksi dicegah double-submit, split bill langsung mengurangi keranjang setelah commit, pagination eksplisit, secret klien dihapus, security header ditambahkan, dan font sidebar diseragamkan ke 14px.

## Koreksi pagination v3
- Menambahkan `fetchAllPages()` yang selalu mengirim `page` dan `page_size`, mengikuti seluruh halaman, serta berhenti dengan error jelas pada batas aman 50.000 baris.
- Stock In/Out, papan produksi, Barcode, Label Harga, dan Tipe Spesial tidak lagi mengandalkan respons legacy tanpa pagination.
- Autocomplete produk Stock In/Out memakai pencarian server dengan `page=1&page_size=100`.
- Kegagalan pada seluruh alur tersebut kini terlihat oleh pengguna melalui state error atau alert.
