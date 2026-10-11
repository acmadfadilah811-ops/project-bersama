"""Serializer pesanan sesi foto StarFoto (2026-10-11)."""
from rest_framework import serializers

from .dinas_models import DinasLuar
from .protected_media import protected_media_url
from .starfoto_models import PaketFoto, PesananFoto, PilihanFile, SesiFoto, UsulanTambahan


class PaketFotoSerializer(serializers.ModelSerializer):
    nama = serializers.CharField(source='product.nama', read_only=True)
    harga = serializers.DecimalField(source='product.harga_jual_toko', max_digits=12, decimal_places=2, read_only=True)
    kategori = serializers.IntegerField(source='product.kategori_id', read_only=True, default=None)
    kategori_nama = serializers.CharField(source='product.kategori.nama', read_only=True, default='')
    addon_tambah_orang_nama = serializers.CharField(source='addon_tambah_orang.nama', read_only=True, default=None)
    addon_tambah_orang_harga = serializers.DecimalField(
        source='addon_tambah_orang.harga', max_digits=12, decimal_places=2, read_only=True, default=None,
    )

    class Meta:
        model = PaketFoto
        fields = [
            'id', 'product', 'nama', 'harga', 'kategori', 'kategori_nama', 'kuota_orang', 'addon_tambah_orang', 'addon_tambah_orang_nama',
            'addon_tambah_orang_harga', 'jumlah_edit', 'jumlah_sesi', 'durasi_menit', 'lokasi',
            'dp_minimal_persen', 'isi_paket',
        ]

    def validate_product(self, product):
        if product.lacak_inventori:
            raise serializers.ValidationError('Paket foto harus produk jasa (stok tidak dilacak).')
        return product

    def validate_dp_minimal_persen(self, nilai):
        if nilai is not None and not 0 <= nilai <= 100:
            raise serializers.ValidationError('DP minimal harus antara 0 sampai 100 persen.')
        return nilai


class SesiFotoSerializer(serializers.ModelSerializer):
    fotografer_nama = serializers.CharField(source='fotografer.username', read_only=True)
    asisten_nama = serializers.CharField(source='asisten.username', read_only=True, default=None)
    order_id = serializers.CharField(source='pesanan.order_id', read_only=True)
    pesanan_id = serializers.IntegerField(source='pesanan.id', read_only=True)
    pelanggan = serializers.CharField(source='pesanan.order.nama', read_only=True)
    paket = serializers.CharField(source='pesanan.paket_item.jenis_produk', read_only=True)
    paket_product = serializers.IntegerField(source='pesanan.paket_item.product_id', read_only=True)
    nomor_kantong = serializers.CharField(source='pesanan.nomor_kantong', read_only=True)
    background = serializers.CharField(source='pesanan.background', read_only=True)
    jumlah_orang = serializers.IntegerField(source='pesanan.jumlah_orang', read_only=True)
    status_pesanan = serializers.CharField(source='pesanan.status', read_only=True)

    class Meta:
        model = SesiFoto
        fields = [
            'id', 'pesanan_id', 'order_id', 'pelanggan', 'paket', 'paket_product', 'nomor_kantong', 'background',
            'jumlah_orang', 'urutan', 'mulai',
            'durasi_menit', 'lokasi', 'alamat', 'fotografer', 'fotografer_nama', 'asisten', 'asisten_nama',
            'status', 'status_pesanan', 'mulai_aktual', 'selesai_aktual',
        ]


class UsulanTambahanSerializer(serializers.ModelSerializer):
    diusulkan_oleh_nama = serializers.CharField(source='diusulkan_oleh.username', read_only=True, default=None)
    harga_satuan = serializers.SerializerMethodField()

    class Meta:
        model = UsulanTambahan
        fields = [
            'id', 'addon', 'product', 'variant', 'nama', 'qty', 'catatan', 'status', 'alasan_tolak',
            'diusulkan_oleh_nama', 'diusulkan_pada', 'diputus_pada', 'harga_satuan',
        ]

    def get_harga_satuan(self, obj):
        # Pratinjau untuk kasir; harga yang ditagih dihitung ulang server saat konfirmasi.
        if obj.addon_id:
            return str(obj.addon.harga)
        harga = obj.variant.harga_jual_toko if obj.variant_id else obj.product.harga_jual_toko
        return str(harga or 0)


class PilihanFileSerializer(serializers.ModelSerializer):
    class Meta:
        model = PilihanFile
        fields = ['id', 'nomor_file', 'peruntukan', 'catatan', 'urutan']


class PesananFotoSerializer(serializers.ModelSerializer):
    pelanggan = serializers.CharField(source='order.nama', read_only=True)
    nomor_wa = serializers.CharField(source='order.nomor_wa', read_only=True)
    paket = serializers.CharField(source='paket_item.jenis_produk', read_only=True)
    paket_product = serializers.IntegerField(source='paket_item.product_id', read_only=True)
    jumlah_edit = serializers.IntegerField(source='paket_item.product.paket_foto.jumlah_edit', read_only=True)
    total_harga = serializers.IntegerField(source='order.total_harga', read_only=True)
    sisa_tagihan = serializers.IntegerField(source='order.sisa_tagihan', read_only=True)
    status_order = serializers.CharField(source='order.status_global', read_only=True)
    sesi = SesiFotoSerializer(many=True, read_only=True)
    usulan = UsulanTambahanSerializer(many=True, read_only=True)
    pilihan_file = PilihanFileSerializer(many=True, read_only=True)

    class Meta:
        model = PesananFoto
        fields = [
            'id', 'order', 'pelanggan', 'nomor_wa', 'paket', 'paket_product', 'jumlah_edit', 'jenis', 'status', 'jumlah_orang',
            'nomor_kantong', 'background', 'catatan_file', 'total_harga', 'sisa_tagihan', 'status_order',
            'dikonfirmasi_pada', 'dibuat_pada', 'sesi', 'usulan', 'pilihan_file',
        ]



class DinasLuarSerializer(serializers.ModelSerializer):
    """Foto selfie lewat link terlindung bertanda tangan (protected_media)."""
    staff_nama = serializers.SerializerMethodField()
    sesi_info = serializers.SerializerMethodField()
    mulai_foto = serializers.SerializerMethodField()
    selesai_foto = serializers.SerializerMethodField()
    durasi_menit = serializers.SerializerMethodField()

    class Meta:
        model = DinasLuar
        fields = [
            'id', 'staff', 'staff_nama', 'sesi', 'sesi_info', 'tujuan', 'alamat', 'status',
            'mulai_pada', 'mulai_lat', 'mulai_lng', 'mulai_akurasi', 'mulai_foto',
            'selesai_pada', 'selesai_lat', 'selesai_lng', 'selesai_akurasi', 'selesai_foto',
            'durasi_menit', 'uang_transport', 'catatan',
        ]

    def get_staff_nama(self, obj):
        return obj.staff.get_full_name() or obj.staff.username

    def get_sesi_info(self, obj):
        if not obj.sesi_id:
            return None
        return {'order_id': obj.sesi.pesanan.order_id, 'pelanggan': obj.sesi.pesanan.order.nama, 'urutan': obj.sesi.urutan}

    def _foto(self, berkas):
        return protected_media_url(berkas, self.context.get('request')) if berkas else None

    def get_mulai_foto(self, obj):
        return self._foto(obj.mulai_foto)

    def get_selesai_foto(self, obj):
        return self._foto(obj.selesai_foto)

    def get_durasi_menit(self, obj):
        if not obj.selesai_pada:
            return None
        return int((obj.selesai_pada - obj.mulai_pada).total_seconds() // 60)
