# Rekaman video kasir POS referensi ("kasir majoo.mp4", 6 menit 50 detik, 23 Okt 2026)

Frame diambil dengan ffmpeg (pergantian adegan), 151 gambar. Urutan alur di video:

## 1. Masuk kasir (layar PIN)
- Layar terbagi dua. Kiri: panel hijau bergambar ilustrasi, nama akun di kiri atas, tombol bahasa "IND" (bendera) di kanan atas, tagline di bawah.
- Kanan (putih): logo di atas, dropdown "Pilih Karyawan" + tombol scan (ikon QR) di sebelahnya, 6 titik PIN, teks "Masukkan PIN (Default PIN: 123456)", papan angka 3 kolom: 1-9, C, 0, hapus (⌫).
- Tekan angka tanpa memilih karyawan: dialog kecil "Pilih" / "Silakan pilih karyawan terlebih dahulu" / "OK".
- Titik PIN jadi hijau saat diisi, lalu logo berputar (loading) dan masuk.

## 2. Buka kasir
- Layar kasir tampil redup + kartu tengah: ilustrasi mesin kasir, "Halo OWNER BIMO / Sudah siap menerima pesanan?", tombol hijau "Buka Kasir" (ikon).
- Lalu panel kiri "Buka Kasir" (sheet dari kiri, lebar ~40%) dengan X, isian "Kas Awal" (100.000), teks "Nominal kas awal akan dijadikan sebagai modal kembalian", tombol "Buka Kasir" hijau di kanan atas header.

## 3. Layar kasir utama
- Header hijau: ikon menu (≡), logo bulat + "Akun demo Majoo - OWNER BIMO" + pill "• Status: Online"; logo di tengah; ikon lonceng (titik merah), ikon grid, ikon gembok; di kanan panel "Daftar Order >" (berangka "(1)" + titik merah bila ada order tersimpan).
- Kolom kiri "Kategori Produk" (ikon filter): Semua Kategori (aktif, bingkai hijau), Favorit, Produk Paket, Produk Layanan, Promo, Deposit, lalu kategori (Mie, COFFEE, SPAREPART, MAKANAN).
- Tengah: baris "Cari ..." + "⊕ Custom Amount" + ikon scan. Grid 4 kolom kartu produk: foto (atau inisial besar abu-abu, mis. "AB", "ACS"), badge stok kecil di pojok kiri atas, nama, harga. Kartu yang sudah di keranjang jadi hijau dengan angka jumlah di tengah.
- Kanan (keranjang): "Jenis Order ▾" (hijau) + "+ Pelanggan" (berganti jadi nama pelanggan dengan ikon). Kosong: "Silakan masukkan pesanan dari pelanggan". Isi: nomor order "CS/39/261023/0001", "Pesanan 1", baris "1  Espresso M  Rp 28.600 ⊗", ekstra di bawah nama ("+ cup (1x)", "+ Sugar (1x)"), baris promo "PROMO OPENING DEA 10%  (Rp 5.760) ⊗".
- Bawah keranjang: ikon tempat sampah (merah), ikon promo (%), "⤓ Simpan". Bar hijau "Bayar" dengan badge jumlah item + total "Rp 51.840 >".

## 4. Pelanggan
- "+ Pelanggan" membuka sheet kiri "Pilih Pelanggan" (sub "Terakhir diperbarui: 21 Oktober 2026, 17:08"), tombol "+ Pelanggan Baru". Tab grup: Semua, Tanpa Grup, SILVER, MEMBER B2B, PLATINUM, AGEN, DEPO, Member... Cari. Baris: nama, "+62… • kode", poin ("731 poin") dan tautan "Detail".
- "Pelanggan Baru": Kode Pelanggan* (otomatis), Nama Pelanggan* (Contoh: Andi), Jenis Kelamin* (Laki-Laki/Perempuan), Grup Pelanggan (opsional), Email (opsional), No Telepon* (+62), Tanggal Lahir (opsional); tombol Simpan di header.

## 5. Detail Produk (klik produk yang punya ekstra/satuan)
- Sheet kiri "Detail Produk", tombol "Simpan" di header. Kartu produk (inisial "K…"), nama, harga. "Kuantitas" (− 1 +), "Satuan" (dropdown "Cup").
- "Ekstra" + ikon scan. Grup ekstra: "Cup Cofee (Opsional, Hanya bisa pilih 1)" kartu "cup Rp 2.000" dengan − 0 +, "Stok tersedia: 0"; "Gula (Harus dipilih, Hanya bisa pilih 1)" kartu "Sugar Rp 2.000" / "No Sugar Rp 0".
- Harga di kepala sheet ikut naik saat ekstra dipilih (25.000 → 29.000).

## 6. Promo
- Ikon % membuka menu: Promo, Kupon, Poin, Promo Tersedia.
- "List Promosi" (sheet kiri, tombol Reset + Simpan): kartu promo "Promo Total Pembelian / PROMO OPENING DEA / PROMO / • Pembelian min Rp. 20,000 / • Diskon 10% / Pos", radio di kanan, kaki "Promo Berakhir … 5 jam 14 Menit" (merah).
- Setelah dipilih: baris promo masuk keranjang, total berkurang.

## 7. Simpan order & Daftar Order
- Tombol Simpan: toast hitam "Berhasil simpan order!". Header "Daftar Order (1)".
- Kosongkan keranjang yang belum disimpan: dialog "Order Belum Disimpan / Semua produk yang belum tersimpan di dalam order ini akan dihapus. Lanjutkan?" (Batal / Lanjutkan).
- "Daftar Order": header hijau dengan ← , Filter, Cari. Kiri "Kategori Order": Semua (n), Kasir (n), Order Online (n), Faktur Penjualan (n). Kolom: Jenis, Nama, No Transaksi, Tanggal, Status, Tagihan. Kosong: "Belum Ada Pesanan / Saatnya tingkatkan promosimu!".
- "Detail Order": PESANAN (+ Tambah Pesanan), daftar item; kanan total besar "Rp 51.840", tanggal, jenis, nomor; Kasir, No Urut, Pelanggan; RINCIAN PEMBAYARAN (Subtotal 2 Produk, promo, Total); tombol "Batalkan" (merah garis) dan "Bayar"; "Cetak" di header.
- "Batalkan" → sheet "Void - Rp 51.840": No Void Order, Otorisasi Oleh (Pilih), Metode Otorisasi (PIN / Kode), PIN (Contoh: 1234), Alasan Pembatalan (Batal Pesan / Salah Proses / Lainnya), Catatan (opsional), tombol "Proses".

## 8. Pembayaran
- Header "← Pembayaran • Status: Online". Kartu atas: Total Tagihan / Sisa Tagihan (merah) / Kembalian (biru). Baris aksi: Pisah Bayar (menu Pisah Jumlah / Pisah Produk), Jadikan Invoice, Catatan.
- Kiri "Metode Pembayaran": Tunai, Nontunai, Transfer, QRIS, Komplimen, Deposit. Tunai: tombol "Uang Pas", "Rp 100.000", "Rp 200.000", "Lainnya".
- QRIS: "QRIS … Dinamis" → sheet "QRIS Dinamis Belum Aktif / Aktifkan QRIS Dinamis kamu terlebih dahulu, ya!" + tombol "Cek Pembayaran".
- Kanan ringkasan pesanan; bawah "Total 2 Produk Rp 51.840" + tombol "Proses Bayar".
- Sukses: kartu tengah di latar hijau: centang, "Sukses!", Total Tagihan, Tunai, Kembalian; tombol "Bagikan Struk" (garis), "Cetak" (garis), "Selesai" (hijau).
- "Bagikan Struk": tab WhatsApp / SMS / Email, isian nomor, tombol "Kirim".

## 9. Menu samping (≡)
- Panel putih: logo + nama akun, sub nama, "ID Pelanggan #0252064" (ikon salin). Menu: Kasir, Penjualan, Laporan, Absensi, Inventori, Pengaturan, majoo Care, Tutup Kasir. Bawah: "Keluar Kasir".
- Penjualan: kartu "Total Penjualan Rp 0" / "Total Transaksi 0", kolom Jenis, Nama, No Transaksi, Waktu, Kasir, Pembayaran; kosong "Belum Ada Penjualan / Tetap semangat dan mulai buat penjualan sekarang". Filter + Cari di header.
- Laporan: kiri "Kategori Laporan": Ringkasan Penjualan, 10 Laporan Teratas, Komisi, Void, Kasir, Kas Kasir, Produk Terjual, Jenis Bayar, Kepuasan Pelanggan, Lainnya, Penjualan Deposit. Filter "Hari ini" + tanggal.
- Kas Kasir: kartu Pemasukan / Pengeluaran / Total Refund / Total Kas Kasir / Total Penjualan; tabel Nama, Jenis Transaksi, Kategori, Jumlah ("Modal Awal  Uang Masuk  Rp 100.000"); tombol "+ Transaksi" → "Tambah Transaksi Kas Kasir": Unggah Foto, Jenis Transaksi (Uang Masuk / Uang Keluar), Nama Transaksi (0/150), Nominal, Kategori (Lainnya; "Tambahkan kategori kas kasir di Pengaturan Kasir"), Catatan (opsional).
- Pengaturan: OPERASIONAL (Produk & Kategori, Order Online, Struk & Biaya, Pajak, Kasir, Perangkat, Notifikasi Suara, Pembayaran Nontunai, Promo, Refund, Cetak Barcode), AKUN (Daftar Notifikasi 22, Daftar Pesan 12, Bahasa, Keluar).
- Struk & Biaya: "Lihat Tampilan Struk" (pratinjau struk 58mm), TAMPILAN STRUK (Struk, Surat Jalan, Label), STRUK KASIR (Header Struk "Thank you for shopping…", Footer Struk).

## 10. Tutup kasir
- "Tutup Kasir • OWNER BIMO": Buka Kasir / Tutup Kasir (tanggal-jam), PIN verifikasi (papan angka).
- Dialog "Tutup Kasir / Kasir OWNER BIMO akan ditutup. Lanjutkan?" (Batal / Ya, Lanjutkan).
- "Laporan Tutup Kasir • OWNER BIMO" + tombol "Tutup Kasir": Waktu Buka/Tutup, Modal Awal, Tunai, Total Penerimaan Kasir, Total Penerimaan, Saldo Akhir, Penerimaan Pajak, Penerimaan Biaya Layanan, Transaksi Selesai, Transaksi Belum Terbayar, Transaksi Belum Terbayar (Rp), Total Tunai Sistem, Produk Terjual, Ekstra Terjual; centang Cetak di printer / Cetak produk terjual / Cetak ekstra terjual.
- Lalu kembali ke layar PIN.
