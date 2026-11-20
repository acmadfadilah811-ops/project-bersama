# Rekaman video backoffice referensi ("backoffice majoo.mp4", 12 menit 10 detik, 23 Okt 2026)

Diambil dengan ffmpeg (pergantian adegan, 84 gambar). Akun di video adalah akun demo **berlangganan penuh** (bukan trial),
jadi banyak fitur yang di akun trial kita terkunci terlihat terbuka. Topbar: Penjualan, Order Online, Appointment, Karyawan,
Keuangan, **Whatsapp**, Lainnya, Dana Siap Pakai. Bar bawah: "Segera bayar tagihan senilai Rp … ke VA BCA … Salin" + tombol merah
"Bayar Sekarang" (data tagihan akun, tidak perlu ditiru).

## Laporan Penjualan
- **Ringkasan Penjualan**: kotak hijau "Dengan pakai …, penjualanmu bulan ini meningkat senilai Rp 460.400"; KPI Total Pendapatan,
  Biaya Promosi, Total Penjualan, Penjualan Bersih, Total Laba Kotor (garis warna hijau, kuning, biru, biru muda, ungu);
  "Terakhir Diperbarui: beberapa detik yang lalu". Rincian: PENDAPATAN (Penjualan Kotor, Ongkos Kirim, Biaya Pelayanan,
  Biaya Layanan Transaksi, Pembulatan, …) dan BIAYA PROMOSI (Promo Pembelian, Promo Produk, Komplimen, TOTAL BIAYA PROMOSI).
- **Detail Penjualan** (versi penuh, per item): No Transaksi, Waktu Order, Waktu Bayar, Outlet, Pelanggan, Jenis Order, Nama Order,
  Nama Meja, Nama Produk, Kategori, Ekstra, Quantity, … ; tombol Atur Tabel, Filter, Ekspor Laporan; filter "Waktu Order".
- **Laporan Jenis Bayar / Jenis Order**: grafik (Hari ▾, Penjualan ▾), "Sembunyikan ^".
- **Laporan Void** (berisi data): KPI Total Void / Total Transaksi; filter "Semua Jenis Order"; kolom No Nota, Tanggal Void,
  Tanggal Order, Kasir, Otorisasi, Produk ("Air mineral, +4"), Subtotal Void, Jenis Order, Nama Meja.
- **Laporan Refund**: Atur Tabel + Ekspor; seg Semua/Tunai/Non Tunai; KPI Total Transaksi Refund / Total Refund;
  kolom No Transaksi Refund, Tanggal, Refund (Rp), Metode Pembayaran, Nama Outlet, ikon mata.

## Laporan lain
- **Penjualan Produk**: filter Semua Kategori, Semua Departemen, Pilih Jenis Order ("46 jenis order terpilih"), Semua Jenis Produk;
  seg Semua Produk / Produk Paket; Grafik Penjualan Produk.
- **Laporan Pajak**: kotak info "Menu Baru: Laporan Service Charge" + tautan; KPI Total Transaksi / Total DPP / Total Pajak;
  kolom Jenis Pajak, Transaksi, DPP (Rp), Total Pajak (Rp), ikon mata.
- **Laporan Tutup Kasir**: kolom Waktu Buka / Tutup Kasir ("Buka: 23 Oktober 2026, 16:32 / Tutup: -"), Kasir, Outlet,
  Modal Awal (Rp), Kas Masuk (Rp), Kas Keluar (Rp), Total Penerimaan Tunai (Rp), …
- **Absensi** (Laporan Karyawan): KPI Masuk Tepat Waktu, Terlambat Masuk, Masuk Lebih Cepat, Keluar Tepat Waktu,
  Keluar Lebih Cepat, Keluar Lebih Lama; kolom Nama, Tanggal, Jadwal Masuk, Jadwal Pulang, Absen Masuk (foto + jam),
  Absen Keluar, Total Jam Kerja Terjadwal, Total Jam Kerja Aktual, Outlet.
- **Lap. Ringkasan Persediaan**: KPI Total Nilai Persediaan; filter tanggal, Semua Kategori, Semua Jenis; kolom Nama Produk
  (+ label varian), SKU, Jenis, Kategori, Kuantitas, Satuan, Harga Modal, Total Nilai Persediaan.
- **Lap. Detail Persediaan**: info "Harap pilih outlet dan produk terlebih dahulu untuk menampilkan data pada Laporan Detail
  Persediaan"; filter Pilih Outlet, Pilih Produk, Semua Jenis; kolom Outlet, Tanggal Transaksi, Transaksi, No Transaksi,
  Kuantitas, Satuan, Harga Jual/Beli, Stok. Ekspor: dialog "Ekspor Laporan / Laporan Detail Persediaan pada periode
  01 Oktober 2026 sampai 31 Oktober 2026 akan diekspor dan disimpan di perangkat yang digunakan. Lanjutkan?".

## Produk (versi penuh)
- Form produk: langkah **Varian** terbuka; "Tetapkan sebagai Induk"; switch "Izinkan Ubah Produk Tidak Dijual …".
- **Resep**: kotak info "Baru! Gunakan Master resep …" + tautan Pengaturan Resep; Resep Produk (ON);
  Pengaturan Master Resep: "Resep Manual Bahan Baku" / "Resep Menggunakan Master Resep"; baris Bahan Baku + Harga Modal +
  Takaran + Satuan + hapus; tombol "Tambah Bahan Baku".
- Langkah Ekstra di produk: tabel Nama Bahan Baku / Harga Modal / Takaran / Satuan per sub ekstra.
- Mode Ubah: tombol hapus (ikon tempat sampah merah) di kiri bawah; dialog "Batal Ubah Produk".
- "Buat Kategori Baru" di form produk membuka modal kecil "Tambah Kategori": Nama Kategori*, Urutan (0), Batal / Simpan.
- **Tambah Ekstra** (penuh): Nama Produk Ekstra* (0/50), Jenis Ekstra (Opsional / Wajib, keterangan "Pelanggan tidak wajib
  memilih sub ekstra yang tersedia"), Cara Pilih Ekstra (Pilih Salah Satu / Pilih Beberapa), Maks. Pilih Ekstra*,
  Tambah Produk Sub Ekstra (Buat Baru / Pilih Dari Inventori), Sub Ekstra: Nama Sub Ekstra (0/50) + Harga Jual.

## Inventori (versi penuh)
- Faktur Pembelian: tab "Daftar Faktur Pembelian" / "Menunggu Persetujuan"; filter tambahan "Pilih"; form punya tombol
  "Bulk Update" dan kolom "Serial Number / Batch Number".
- Daftar Stok: ikon segitiga merah di nama produk yang stoknya minim.
- Sidebar Inventori penuh: Daftar Bahan Baku, Pembelian Stok, Kelola Stok, Produksi Stok, Mutasi Antar Outlet, Daftar Pemasok.

## Promosi (melengkapi rekaman yang terputus)
- Daftar Promosi Per Total Pembelian: filter status berupa chip (Aktif ×, Inaktif ×, Kadaluarsa ×); kolom Nama, Tipe
  (Manual/Otomatis), Kriteria ("Min Pembelian : Rp 10.000" / "Min Pembelian : 1 pcs"), Bonus ("20 %"), Durasi, Outlet,
  Status (titik merah "Kadaluarsa"), menu ⋯.
- Langkah 2 **Ketentuan Promo**: kotak info "Promo berdasarkan minimum kuantitas dan bonus kombinasi hanya berlaku pada POS
  versi 3.2.23000 ke atas."; Promo Berdasarkan* (Min Pembelian (Rp) / Min Kuantitas (jumlah)) + nominal;
  Jenis Potongan* (Potongan (%) / Potongan (Rp) / Bonus Produk) + nilai; centang "Maksimal Potongan".
  Footer Simpan Draf / Kembali / Simpan.
- Konfirmasi "Simpan Promo": "Promo PROMO OPENING DEA akan disimpan dan tampil di daftar promo sesuai dengan pengaturan yang
  telah dilakukan. Lanjutkan?". Toast kuning "Sedang Menambahkan Promo! / Promo … sedang ditambahkan ke outlet … Silakan
  periksa log aktivitas promo".
