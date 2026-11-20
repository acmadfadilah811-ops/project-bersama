# Rekaman referensi: Inventori (22 Okt 2026)

Belum dibangun di prototipe. Data uji di referensi: pemasok "[TES] Agen Kopi", bahan "[TES] Gula Aren" (TESBB01), SO/261022/0001, ST/261022/0001, PO/261022/0001 (status Menunggu).

## Daftar Pemasok
- Kolom: Kode Pemasok, Nama, Keterangan, Alamat, No Telepon. Menu baris: Ubah, Hapus.
- Form "Tambah Pemasok", kartu kiri judul "Info Pemasok", isian 2 kolom: Kode Pemasok* (otomatis, ph "Contoh: ABC123"), Nama Pemasok* ("Contoh: Agen Telur"), Email* ("Contoh: sd@gmail.com"), No. Telepon* ("Contoh: 08122222222"), Alamat* (textarea), Negara (Indonesia, nonaktif), Provinsi, Kota.
- "Informasi Rekening": baris Nama Pemilik Rekening ("Contoh: Sari Darapah") / Bank (Pilih) / Nomor Rekening ("Contoh: 7867383333") + ikon hapus; tombol outline "+ Tambah Rekening". Keterangan textarea ("Contoh: Pesan bulanan 10 krat").
- Validasi: "Nama Pemasok tidak boleh kosong", "Email tidak boleh kosong", "No. Telepon Pemasok tidak boleh kosong", "Alamat tidak boleh kosong".
- Konfirmasi "Simpan Data Pemasok": "Pemasok <b>{kode}</b> akan disimpan dan tampil di daftar pemasok sesuai dengan pengaturan yang telah dilakukan. Lanjutkan?" Toast "Data Pemasok berhasil ditambahkan".

## Daftar Bahan Baku
- Kotak info biru di atas kartu: "Data yang tampil berdasarkan Outlet Utama (by cafe)". Tautan: ikon riwayat, Impor Bahan Baku, Ekspor Bahan Baku.
- Kolom: centang, SKU, Nama, Satuan, tombol + (pemilih kolom: daftar centang huruf besar dengan garis pemisah, kolom pertama nonaktif, tanpa judul). Menu baris: Ubah, Hapus (teks merah). Centang baris: tombol merah "Hapus 1 Bahan Baku".
- Form "Tambah Bahan": Daftar Outlet* (chip by cafe), Nama Bahan Baku* ("Contoh: Tepung"), Monitor Persediaan switch "Aktifkan monitor persediaan", Pengingat Stok Minimum (nonaktif bila monitor OFF), "Informasi Satuan" + outline "Tambah Satuan".
- Tabel satuan: SATUAN* ("Contoh: Botol") / [KONVERSI: baris 1 = 1 nonaktif, baris tambahan default 2] / HARGA BELI (Rp, aktif hanya bila monitor ON) / SKU* ("Contoh: BB001") + hapus di baris tambahan.
- Validasi: "Nama bahan baku harus diisi", "Mohon lengkapi nama satuan", "Mohon lengkapi SKU" (di bawah tabel).
- Konfirmasi "Simpan Bahan Baku": "Bahan Baku <b>{nama}</b> akan disimpan dan tampil di daftar stok. Lanjutkan?" Toast "Bahan baku {nama} berhasil ditambahkan".

## Daftar Stok
- Kotak info biru "Menu Baru - Tambah Bahan Baku" (sudah ada di prototipe). Filter: cari, tanggal, seg Semua/Produk/Bahan; baris 2: Jumlah Stok, Semua Kategori, Sertakan Kolom.
- Kolom: SKU, Nama, Jenis, Awal, Masuk, Terjual, Akhir, Satuan, ikon mata. Hanya bahan + produk dengan monitor persediaan.
- Jumlah Stok = popover "Rentang Jumlah Stok Akhir" MIN/MAKS, centang "Tampilkan Stok Minim", tombol Reset / Proses.
- Sertakan Kolom: Pilih Semua, Keluar, Terbuang, Terproduksi, Transit.
- Ikon mata: modal "Daftar Stok Semua Outlet" (sub "Detail stok dari semua outlet"), baris "SKU : … Nama Produk : … Jenis : …", cari + Sertakan Kolom, tabel Outlet/Awal/Masuk/Terjual/Akhir/Satuan.

## Stok Opname
- Form "Tambah Stok Opname", kartu "Informasi Stok Opname": Daftar Outlet* (Pilih Outlet), Nomor Stok Opname ("Contoh: SO/261022/0001", "Jika kosong akan diisi otomatis oleh sistem"), Tanggal Transaksi (sekarang), Catatan ("Contoh: Barang Hilang").
- Rincian Barang + outline "Atur Barang" (tanpa outlet: toast merah "Silahkan Pilih outlet terlebih dahulu"); Semua Kategori, seg Semua/Produk/Bahan, cari.
- Tabel: SKU, Barang, Stok Sistem (nonaktif), Stok Aktual, Satuan (pilihan), Selisih ("1.000 gram"), Harga Modal (nonaktif), hapus; baris Catatan per barang (0/50).
- Modal "Pilih Produk": cari, Semua, Semua Kategori; kolom ›, centang, SKU, Produk, Kategori, Jenis, Stok, Harga Beli, Harga Jual; Batal / Simpan.
- Footer: outline "Simpan Draf" kiri, Batal, Simpan. Konfirmasi "Simpan Stok Opname": "Menyimpan stok opname akan mengubah stok barang saat ini & tidak dapat dibatalkan. Lanjutkan?" Status daftar "Berhasil".
- Detail "Detail Stok Opname": kartu kiri Status + "Terakhir diperbarui {waktu} oleh Bayu"; kartu "Lihat Detail Jurnal" + outline "Lihat Jurnal"; form nonaktif; footer Cetak / Tutup.
- Modal "Detail Jurnal": No Transaksi, Deskripsi, Kode Akun, Nama Akun, Debit, Kredit (+). Akun 1-10202 Persediaan Barang Mentah dan 8-80100 Penyesuaian Persediaan.

## Stok Terbuang
- Seperti opname; outlet sudah terisi, tanpa judul kartu; Nomor "Contoh: ST/261022/0001"; Catatan "Contoh: Sudah Kadaluwarsa"; filter "Pilih Kategori".
- Kolom: SKU, Barang, Stok (nonaktif + satuan), Stok Terbuang (teks "Stok tersedia: 1000"), Satuan, Harga Modal ("Rp 0,00"), hapus.
- Jumlah 0: toast merah "Gagal!" "Stok terbuang tidak boleh kosong". Konfirmasi "Simpan Stok terbuang": "Menyimpan stok terbuang akan mengubah stok barang saat ini dan tidak dapat dibatalkan. Lanjutkan?" Toast "Stok terbuang berhasil ditambahkan". Status "Selesai".

## Pemesanan Stok (PO)
- Daftar: tanggal, Semua Jenis Pemesanan; kolom No. Pemesanan Stok, Jenis Pemesanan, Tanggal Pemesanan, Pemasok, Outlet, Dibuat Oleh, Uang Muka (Rp), Tagihan (Rp), Status, +.
- Wizard 2 langkah (nav kiri "Informasi Pemesanan Stok" / "Detail Pemesanan Stok", footer Kembali / Selanjutnya).
- Langkah 1: info biru "Permintaan Aset hanya Tersedia pada Paket Prime+". "Jenis Pemesanan": kartu radio "Pemesanan Barang Jual" (Pilih opsi ini untuk membuat pemesanan barang jual) / "Pemesanan Aset" (nonaktif). "Sumber Stok": "Tanpa Referensi" (Kirim pemesanan form yang tersedia) / "Referensikan Permintaan Barang" (Tambahkan stok melalui permintaan barang). Kartu "Informasi Pemesanan Stok": Daftar Outlet*, Pemasok*, Alamat* ("(Pilih pemasok terlebih dahulu)"), Nomor ("Contoh: PO/261022/0001"), Tanggal Pemesanan Stok*.
- Langkah 2 "Detail Pemesanan Stok": Rincian Barang + Atur Barang. Tabel Barang, Jumlah, Satuan, Harga Satuan, Diskon (%), Total, hapus; baris CATATAN "Keterangan ({nama})".
- Bagian bawah: Diskon (Jenis Diskon, Diskon (Rp), Nominal Diskon), Pajak (Jenis Pajak: Tanpa Pajak / Pajak (10%) / Harga Termasuk Pajak (10%) / Pajak (11%) / Harga Termasuk Pajak (11%) / Pajak (12%) …, Nominal pajak), Biaya Lainnya (outline "Tambah Biaya Lainnya"), Uang Muka (switch), Total Harga (Subtotal Barang, Diskon (Rp), Tanpa Pajak, Total Harga). Footer: Simpan Draf, Kembali, Simpan.
- Batal: "Batal Tambah Pemesanan Stok" — "Membatalkan proses ini akan menghapus seluruh data yang telah diinput. Lanjutkan?" (Ya, Lanjutkan teks / Simpan Draf hijau).
- Simpan: "Simpan Pemesanan Stok" — "Pemesanan Stok akan disimpan dan tampil di daftar pembelian stok sesuai dengan pengaturan yang telah dilakukan. Lanjutkan?" Toast "Pemesanan Stok berhasil ditambahkan", lalu halaman "Preview Pemesanan Stok".
- Preview: tabel kunci-nilai (Jenis Pemesanan, Outlet, Nomor, Pemasok, Tanggal, Dibuat Oleh, Status "Menunggu"), Detail barang, Total Harga. Footer: merah "Void", "Tindakan ▲" (Cetak Pemesanan Stok, Kirim Email, Buat Faktur Pembelian, Buat Pengiriman Pembelian), "Tutup".

## Faktur Pembelian (dari PO: Tindakan > Buat Faktur Pembelian)
- Dialog "Buat Faktur Pembelian": "Anda akan dialihkan ke halaman Tambah Faktur Pembelian. Lanjutkan?"
- Form "Tambah Faktur Pembelian", nav kiri "Sumber Stok" / "Detail Stok". Info biru "Permintaan Asset hanya tersedia pada paket Prime+".
- "Jenis Pembelian": kartu "Pembelian Barang Jual" / "Pembelian Aset". "Sumber Stok > Pilih Sumber": "Tanpa Nomor Referensi" (Tambahkan stok masuk manual melalui form yang tersedia) / "Referensikan Pemesanan Stok" (Tambahkan stok melalui pemesanan stok (PO)).
- Kartu "Detail Stok": No. Pemesanan Stok* (nonaktif), "Referensikan Pengiriman Pembelian" (outline "+ Pilih Pengiriman Pembelian"), No. Faktur (0/25, "Contoh: FA/261022/0001"), Distribusi (Pemasok / Outlet Tujuan nonaktif + Alamat, No Ponsel, Email), Tanggal (Tanggal Pesan nonaktif + tanggal faktur), Termin Pembayaran* (radio "Pilih Jangka Waktu" [7 Hari] + jatuh tempo nonaktif / "Pilih Tanggal (Manual)").
- Barang + outline "Atur Barang Diterima". Kolom Produk, Harga Beli (Rp), Satuan, Diterima, Sisa, Diskon %, Total (Rp); baris "Terima Stok" switch ON + hapus.
- Ringkasan: Subtotal Barang, Diskon (Rp), Tanpa Pajak, Biaya Lainnya, Total Harga, Sisa Tagihan; Keterangan; kartu "Unggah File" (Excel/Word/PDF/JPG/PNG/ZIP, maks 5 file, maks 2 MB). Footer: Simpan Draf / Batal / Simpan.
- Konfirmasi "Simpan Faktur Pembelian": "Faktur Pembelian akan disimpan dan tampil di daftar Faktur Pembelian. Lanjutkan?" Toast "<b>Faktur Pembelian</b> berhasil disimpan", lalu "Preview Faktur Pembelian".
- Preview: kartu Status "Belum Lunas" + "Terakhir diperbarui -"; Detail Faktur Pembelian (Jenis, Nomor FA/…, Tanggal Dibuat, Dibuat Oleh, Nomor Pemesanan Stok, Tanggal Pesan, Jatuh Tempo, Outlet Tujuan + kontak outlet, Kepada pemasok); Detail Produk; Subtotal n Produk, Diskon, Pajak, Total Harga, Sisa Tagihan, Keterangan. Footer: outline "✎ Ubah", "Tindakan ▲" (Cetak, Kirim Email, Bayar Faktur), Tutup. JANGAN salin kontak outlet asli (email/HP pemilik akun).
- Daftar Faktur: KPI Faktur Pembelian / Belum Dibayar / Sudah Dibayar / Jatuh Tempo / Void. Kolom: Tanggal, Nama Pemasok, No Faktur, Jenis Pembelian, Produk, Jumlah, Jenis ("Referensikan Pemesanan Stok"), Jatuh Tempo, Sisa Tagihan (Rp), Total (Rp), Outlet, Dibuat Oleh, Status (Belum Lunas).

## Pembayaran Faktur (Tindakan > Bayar Faktur)
- Dialog "Bayar Faktur": "Anda akan dialihkan ke halaman Pembayaran Faktur. Lanjutkan?"
- Form "Tambah Pembayaran Faktur", kartu "Informasi Pembayaran Faktur": Pilih Outlet*, Jenis Pembayaran* (akun: 1-10001 - Kas Outlet, 1-10002 - Rekening Bank, 1-10003 - Kas Kasir Outlet, 1-10004 - Giro, 1-19001 - Ayat Silang Kas & Bank, 1-19002 - Ayat Silang Buka / Tutup Kasir), Jenis Transaksi (kartu radio Pemesanan Stok / Tanpa Nomor Referensi), Pemasok, Tanggal Transaksi, No Transaksi ("Contoh: PFA/261022/0001", "Nomor transaksi akan terisi otomatis jika dikosongkan").
- "Daftar Pembelian": tab "Faktur Pembelian", centang "Bayar Semua"; kolom Tanggal Pembelian, No Faktur, Jatuh Tempo, Tagihan, Potongan, Pembayaran, Sisa Tagihan; baris Total. Unggah File. Footer Batal / Simpan.
- Konfirmasi "Simpan Pembayaran Faktur": "Pembayaran Faktur akan disimpan dan tampil di daftar pembelian sesuai dengan pengaturan yang telah dilakukan. Lanjutkan?" Tanpa nominal: toast merah "Gagal!" "<b>Pembayaran Faktur</b> tidak ada yang dibayarkan".

## Produksi Stok
- Form "Tambah Produksi Stok", nav kiri "Informasi Produksi Stok" / "Stok Sumber & Hasil".
- Langkah 1: Outlet (by cafe), No Produksi Stok ("Contoh: SP/261022/0001", otomatis), Tanggal Produksi. Footer: Simpan Draf (nonaktif) / Lanjutkan.
- Langkah 2: Sumber Data* kartu radio "Buat Data Baru" (Tambah data baru sesuai dengan kebutuhan) / "Gunakan Template" (Gunakan data dari template produksi yang pernah dibuat).
  - "Stok Sumber": kolom SKU, Nama Barang, Stok Tersedia, Jumlah*, Satuan, Harga Modal + tombol "Tambah Sumber".
  - "Stok Hasil": kolom SKU, Nama Barang, Jumlah*, Satuan, Harga, Total + "Tambah Hasil".
  - Catatan ("Contoh: Produksi sebagian"); "Simpan Template" centang "Simpan ke Template Produksi Stok" + Nama Template ("Contoh: Template produksi kopi"). Footer Simpan Draf / Kembali / Simpan.

## Belum direkam
Mutasi Antar Outlet (butuh lebih dari 1 outlet). Data uji tambahan: FA/261022/0001 (Belum Lunas).
