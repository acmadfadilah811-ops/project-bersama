"""Skema kolom untuk kontrak tabel Laporan Pembelian."""


REPORT_COLUMNS = {
    'rincian-pembelian': [
        ('no_pembelian', 'No. Pembelian', 'text'), ('tanggal', 'Tanggal', 'date'),
        ('pembelian_oleh', 'Pembelian Oleh', 'text'), ('tanggal_diterima', 'Tanggal Diterima', 'date'),
        ('no_terima', 'No. Terima', 'text'), ('supplier', 'Supplier', 'text'),
        ('subtotal', 'Subtotal', 'money'), ('total_dibayar', 'Total Dibayar', 'money'),
        ('sisa', 'Sisa Tagihan', 'money'), ('status', 'Status', 'text'),
    ],
    'pembelian-tanggal': [('tanggal', 'Tanggal', 'date'), ('total', 'Total Pembelian', 'money')],
    'item-pembelian-tanggal': [
        ('tanggal', 'Tanggal', 'date'), ('produk', 'Produk', 'text'), ('sku', 'SKU', 'text'),
        ('qty', 'Qty', 'qty'), ('harga_beli', 'Harga Beli', 'money'), ('subtotal', 'Subtotal', 'money'),
    ],
    'pembelian-supplier': [
        ('supplier', 'Supplier', 'text'), ('email', 'Email', 'text'), ('total', 'Total Pembelian', 'money'),
    ],
    'pembelian-pembeli': [
        ('tgl_beli', 'Tgl. Beli', 'date'), ('staff', 'Staff', 'text'), ('total', 'Total Pembelian', 'money'),
    ],
    'retur-pembelian-tanggal': [
        ('no_pengembalian', 'No. Pengembalian', 'text'), ('tanggal', 'Tanggal', 'date'),
        ('harga_satuan', 'Harga Satuan', 'money'), ('qty', 'Qty', 'qty'), ('total', 'Total Retur', 'money'),
    ],
    'retur-pembelian-supplier': [
        ('no_pengembalian', 'No. Pengembalian', 'text'), ('supplier', 'Supplier', 'text'),
        ('email', 'Email', 'text'), ('total', 'Total Retur', 'money'),
    ],
    'pembayaran-belum-lunas': [
        ('no_pembelian', 'No. Pembelian', 'text'), ('tanggal', 'Tanggal', 'date'),
        ('supplier', 'Supplier', 'text'), ('total', 'Total Pembelian', 'money'),
        ('telah_dibayar', 'Telah Dibayar', 'money'), ('sisa', 'Sisa Tagihan', 'money'),
        ('jatuh_tempo', 'Jatuh Tempo', 'date'),
    ],
    'pembayaran-pembelian': [
        ('no_pembelian', 'No. Pembelian', 'text'), ('tanggal', 'Tanggal Pembayaran', 'date'),
        ('supplier', 'Supplier', 'text'), ('metode', 'Metode', 'text'), ('nominal', 'Nominal', 'money'),
        ('catatan', 'Catatan', 'text'),
    ],
    'rekomendasi-pembelian': [
        ('nama_produk', 'Nama Produk', 'text'), ('kategori_produk', 'Kategori Produk', 'text'),
        ('harga_beli', 'Harga Beli', 'money'), ('sedang_dikirim', 'Sedang Dikirim', 'qty'),
        ('qty_stok', 'Qty Stok', 'qty'), ('kekurangan_stok', 'Kekurangan Stok', 'qty'),
    ],
}
