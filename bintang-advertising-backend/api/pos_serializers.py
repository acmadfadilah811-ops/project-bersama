from rest_framework import serializers
from .pos_models import POSSale, POSSaleItem, POSVoidRequest
from .product_serializers import SaleItemAddonSerializer

class POSSaleItemSerializer(serializers.ModelSerializer):
    addons = SaleItemAddonSerializer(many=True, read_only=True)
    # SPK dari item POS (jobs) — bentuknya sama dgn OrderItemSerializer.jobs,
    # dipakai panel "Pesanan & Pelunasan" utk pantau status produksi transaksi
    # POS Lunas, bukan cuma alur Order/DP (lihat POSSale.diambil_pada).
    jobs = serializers.SerializerMethodField()

    class Meta:
        model = POSSaleItem
        fields = '__all__'

    def get_jobs(self, obj):
        from .serializers import JobBoardSerializer
        return JobBoardSerializer(obj.jobs.all(), many=True, context=self.context).data

class POSSaleSerializer(serializers.ModelSerializer):
    items = POSSaleItemSerializer(many=True, read_only=True)
    kasir_name = serializers.ReadOnlyField(source='kasir.username')
    pelanggan_name = serializers.ReadOnlyField(source='pelanggan.nama')
    dilayani_oleh_nama = serializers.SerializerMethodField()
    diskon_total = serializers.SerializerMethodField()

    class Meta:
        model = POSSale
        fields = '__all__'

    def get_dilayani_oleh_nama(self, obj):
        u = obj.dilayani_oleh
        if not u:
            return None
        return (f"{u.first_name} {u.last_name}".strip() or u.username)

    def get_diskon_total(self, obj):
        from .services.pos_receipt_whatsapp import hitung_total_diskon_resi
        return hitung_total_diskon_resi(obj)


class POSVoidRequestSerializer(serializers.ModelSerializer):
    diminta_oleh_nama = serializers.SerializerMethodField()
    disetujui_oleh_nama = serializers.SerializerMethodField()
    sale_nomor = serializers.ReadOnlyField(source='sale.nomor')
    otp_code = serializers.SerializerMethodField()
    kadaluarsa = serializers.SerializerMethodField()

    class Meta:
        model = POSVoidRequest
        fields = [
            'id', 'sale', 'sale_nomor', 'diminta_oleh', 'diminta_oleh_nama',
            'alasan', 'status', 'otp_code', 'disetujui_oleh', 'disetujui_oleh_nama',
            'alasan_tolak', 'dibuat_pada', 'disetujui_pada', 'kadaluarsa_pada',
            'digunakan_pada', 'kadaluarsa',
        ]
        read_only_fields = fields

    def get_diminta_oleh_nama(self, obj):
        return obj.diminta_oleh.username if obj.diminta_oleh else None

    def get_disetujui_oleh_nama(self, obj):
        return obj.disetujui_oleh.username if obj.disetujui_oleh else None

    def get_kadaluarsa(self, obj):
        from django.utils import timezone as _tz
        return bool(obj.kadaluarsa_pada and _tz.now() > obj.kadaluarsa_pada)

    def get_otp_code(self, obj):
        # Sama seperti OrderVoidRequestSerializer: kode cuma boleh terlihat
        # owner/manager (approver) ATAU kasir yang mengajukan permintaan ini
        # sendiri, dan hanya saat statusnya 'disetujui' & belum kadaluarsa.
        request = self.context.get('request')
        user = getattr(request, 'user', None) if request else None
        if not user or obj.status != 'disetujui' or self.get_kadaluarsa(obj):
            return ''
        if getattr(user, 'role', '') in ('owner', 'manager'):
            return obj.otp_code
        if obj.diminta_oleh_id == getattr(user, 'id', None):
            return obj.otp_code
        return ''
