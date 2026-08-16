from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from api.permissions import IsOwnerManagerAdminOrReadOnly, IsOwnerManagerAdminOrKasir

from .marketing_models import (
    SalesDiscount, DiscountCoupon, POSPromotion,
    LoyaltyPointSetting, LoyaltyPointRedemption
)
from .marketing_serializers import (
    SalesDiscountSerializer, DiscountCouponSerializer, POSPromotionSerializer,
    LoyaltyPointSettingSerializer, LoyaltyPointRedemptionSerializer
)



class SalesDiscountViewSet(viewsets.ModelViewSet):
    """Diskon Penjualan: Marketing > Voucher & Diskon > Diskon Penjualan.

    Berlaku otomatis tanpa kode di POS Terminal & Order/SPK saat syarat minimal
    terpenuhi (lihat promo_engine.evaluate_sales_discount)."""
    queryset = SalesDiscount.objects.all()
    serializer_class = SalesDiscountSerializer
    permission_classes = [IsOwnerManagerAdminOrReadOnly]

    def get_permissions(self):
        # 'preview' murni baca (hitung estimasi diskon), dipakai kasir di POS/SPK —
        # tidak boleh ikut kena batasan CRUD yang mengunci write-role saja.
        if self.action == 'preview':
            return [IsOwnerManagerAdminOrKasir()]
        return super().get_permissions()

    def perform_create(self, serializer):
        serializer.save(dibuat_oleh=self.request.user)

    @action(detail=True, methods=['post'], url_path='toggle-status')
    def toggle_status(self, request, pk=None):
        instance = self.get_object()
        instance.is_active = not instance.is_active
        instance.save()
        return Response(self.get_serializer(instance).data)

    @action(detail=False, methods=['post'], url_path='preview')
    def preview(self, request):
        """Estimasi Diskon Penjualan otomatis untuk keranjang saat ini.

        Dipakai kasir (POS Terminal & Order/SPK) untuk menampilkan potongan
        sebelum transaksi disimpan — nilai final tetap dihitung ulang & mengikat
        di server saat transaksi benar-benar dibuat (create_sale / perform_create).
        """
        from decimal import Decimal
        from .models import Contact
        from .product_models import Product, ProductPackage
        from .promo_engine import BarisKeranjang, KonteksPromo, evaluate_sales_discount
        from .marketing_models import KANAL_POS

        subtotal = request.data.get('subtotal', 0)
        pelanggan_id = request.data.get('pelanggan')
        pelanggan = Contact.objects.filter(pk=pelanggan_id).first() if pelanggan_id else None

        raw_items = request.data.get('items') or []
        baris = []
        for item in raw_items:
            pid = item.get('product_id') or item.get('product')
            prod = Product.objects.filter(pk=pid).first() if pid else None
            package_id = item.get('package_id') or item.get('paket_id')
            package = ProductPackage.objects.filter(pk=package_id).first() if package_id else None
            qty = Decimal(str(item.get('qty', 1) or 1))
            harga = Decimal(str(item.get('harga', 0) or 0))
            if package:
                harga = Decimal(str(package.harga_jual_offline or 0))
            baris.append(BarisKeranjang(product=prod, package=package, qty=qty, harga=harga, subtotal=harga * qty))

        konteks = KonteksPromo(
            baris=baris, subtotal=Decimal(str(subtotal or 0)), pelanggan=pelanggan, kanal=KANAL_POS,
        )
        nilai, aturan = evaluate_sales_discount(konteks)
        return Response({
            # Nilai uang dikirim sebagai string agar Decimal tidak berubah
            # menjadi float biner saat melewati JSON.
            'diskon': str(nilai),
            'aturan': ({
                'id': aturan.id, 'tipe_diskon': aturan.tipe_diskon,
                'jumlah_diskon': str(aturan.jumlah_diskon),
            } if aturan else None),
        })


class DiscountCouponViewSet(viewsets.ModelViewSet):
    """Kupon Diskon: Marketing > Voucher & Diskon > Kupon Diskon."""
    queryset = DiscountCoupon.objects.all()
    serializer_class = DiscountCouponSerializer
    permission_classes = [IsOwnerManagerAdminOrReadOnly]

    def get_permissions(self):
        # 'evaluate' murni baca (cek & hitung nilai kupon), dipakai kasir di POS —
        # sebelumnya ikut terkunci ke role write-only sehingga kasir tak bisa pakai
        # kupon sama sekali lewat endpoint ini.
        if self.action == 'evaluate':
            return [IsOwnerManagerAdminOrKasir()]
        return super().get_permissions()

    def perform_create(self, serializer):
        serializer.save(dibuat_oleh=self.request.user)

    @action(detail=True, methods=['post'], url_path='toggle-status')
    def toggle_status(self, request, pk=None):
        instance = self.get_object()
        instance.is_active = not instance.is_active
        instance.save()
        return Response(self.get_serializer(instance).data)

    @action(detail=False, methods=['post'], url_path='evaluate')
    def evaluate(self, request):
        from decimal import Decimal
        from .models import Contact
        from .product_models import Product, ProductPackage
        from .promo_engine import BarisKeranjang, KonteksPromo, evaluate_coupon_code
        from .marketing_models import KANAL_POS

        kode = request.data.get('kode', '').strip()
        subtotal = request.data.get('subtotal', 0)
        pelanggan_id = request.data.get('pelanggan')

        pelanggan = None
        if pelanggan_id:
            pelanggan = Contact.objects.filter(pk=pelanggan_id).first()

        raw_items = request.data.get('items') or []
        baris = []
        for item in raw_items:
            pid = item.get('product_id') or item.get('product')
            prod = Product.objects.filter(pk=pid).first() if pid else None
            package_id = item.get('package_id') or item.get('paket_id')
            package = ProductPackage.objects.filter(pk=package_id).first() if package_id else None
            qty = Decimal(str(item.get('qty', 1) or 1))
            harga = Decimal(str(item.get('harga', 0) or 0))
            if package:
                harga = Decimal(str(package.harga_jual_offline or 0))
            baris.append(BarisKeranjang(
                product=prod,
                package=package,
                qty=qty,
                harga=harga,
                subtotal=harga * qty
            ))

        konteks = KonteksPromo(
            baris=baris,
            subtotal=Decimal(str(subtotal or 0)),
            pelanggan=pelanggan,
            kanal=KANAL_POS,
        )
        hasil = evaluate_coupon_code(kode, konteks)
        if not hasil.ok:
            return Response({'ok': False, 'alasan': hasil.alasan}, status=400)

        return Response({
            'ok': True,
            'kupon': {
                'id': hasil.kupon.id,
                'kode': hasil.kupon.kode,
                'judul': hasil.kupon.judul,
                'tipe_diskon': hasil.kupon.tipe_diskon,
                'jumlah_diskon': str(hasil.kupon.jumlah_diskon),
                'maksimal_jumlah_diskon': str(hasil.kupon.maksimal_jumlah_diskon),
                'min_total_pesanan': str(hasil.kupon.min_total_pesanan),
            },
            'diskon': str(hasil.diskon),
            'alasan': hasil.alasan,
        })


class POSPromotionViewSet(viewsets.ModelViewSet):
    """Promosi (POS): Marketing > Voucher & Diskon > Promosi (POS) — tipe BX/DQ/DA/FI."""
    queryset = POSPromotion.objects.all()
    serializer_class = POSPromotionSerializer
    permission_classes = [IsOwnerManagerAdminOrReadOnly]

    def perform_create(self, serializer):
        serializer.save(dibuat_oleh=self.request.user)

    @action(detail=True, methods=['post'], url_path='toggle-status')
    def toggle_status(self, request, pk=None):
        instance = self.get_object()
        instance.is_active = not instance.is_active
        instance.save()
        return Response(self.get_serializer(instance).data)

    @action(detail=True, methods=['post'], url_path='duplicate')
    def duplicate(self, request, pk=None):
        """Dipakai tombol "Salin Diskon" — duplikasi promosi yang sudah ada jadi draft baru
        (judul diberi suffix "(Copy)") agar tinggal disesuaikan lalu disimpan."""
        instance = self.get_object()
        instance.pk = None
        instance._state.adding = True
        instance.judul = f"{instance.judul} (Copy)"
        instance.dibuat_oleh = request.user
        instance.save()
        return Response(self.get_serializer(instance).data, status=201)


class LoyaltyPointSettingViewSet(viewsets.ModelViewSet):
    """Pengaturan Loyalty Point."""
    queryset = LoyaltyPointSetting.objects.all()
    serializer_class = LoyaltyPointSettingSerializer
    permission_classes = [IsOwnerManagerAdminOrReadOnly]

    def list(self, request, *args, **kwargs):
        setting = LoyaltyPointSetting.objects.first()
        if not setting:
            setting = LoyaltyPointSetting.objects.create()
        serializer = self.get_serializer(setting)
        return Response(serializer.data)


class LoyaltyPointRedemptionViewSet(viewsets.ModelViewSet):
    """Penukaran Point."""
    queryset = LoyaltyPointRedemption.objects.all()
    serializer_class = LoyaltyPointRedemptionSerializer
    permission_classes = [IsOwnerManagerAdminOrReadOnly]


class PromoPreviewView(APIView):
    """Pratinjau promo (kupon + diskon penjualan) tanpa menyimpan apa pun.

    Dipakai kasir di POS/SPK untuk menampilkan estimasi potongan sebelum
    transaksi benar-benar dibuat. Endpoint ini murni baca — tidak membuat
    CouponUsage, POSSale, atau record lainnya.
    """
    permission_classes = [IsOwnerManagerAdminOrKasir]

    def post(self, request):
        from decimal import Decimal
        from .models import Contact
        from .product_models import Product, ProductPackage
        from .promo_engine import (
            BarisKeranjang, KonteksPromo,
            evaluate_coupon_code, evaluate_sales_discount,
        )

        kanal = request.data.get('kanal', 'pos')
        kupon_kode = request.data.get('kupon_kode', '')
        subtotal = request.data.get('subtotal', 0)
        pelanggan_id = request.data.get('pelanggan')
        pelanggan = Contact.objects.filter(pk=pelanggan_id).first() if pelanggan_id else None

        raw_items = request.data.get('items') or []
        baris = []
        for item in raw_items:
            pid = item.get('product_id') or item.get('product')
            prod = Product.objects.filter(pk=pid).first() if pid else None
            package_id = item.get('package_id') or item.get('paket_id')
            package = ProductPackage.objects.filter(pk=package_id).first() if package_id else None
            qty = Decimal(str(item.get('qty', 1) or 1))
            harga = Decimal(str(item.get('harga', 0) or 0))
            if package:
                harga = Decimal(str(package.harga_jual_offline or 0))
            elif harga <= 0 and prod:
                harga = Decimal(str(prod.harga_jual_toko or 0))
            baris.append(BarisKeranjang(product=prod, package=package, qty=qty, harga=harga,
                                       subtotal=harga * qty))

        ctx_subtotal = Decimal(str(subtotal or 0))
        if not ctx_subtotal:
            ctx_subtotal = sum((b.subtotal for b in baris), Decimal('0'))
        konteks = KonteksPromo(
            baris=baris, subtotal=ctx_subtotal, pelanggan=pelanggan, kanal=kanal,
        )

        diskon_kupon = Decimal('0')
        if kupon_kode:
            hasil = evaluate_coupon_code(kupon_kode, konteks)
            if hasil.ok:
                diskon_kupon = hasil.diskon

        diskon_penjualan, _ = evaluate_sales_discount(konteks)

        return Response({
            # Kirim sebagai string agar tidak kehilangan presisi Decimal di JSON.
            'diskon_kupon': str(diskon_kupon),
            'diskon_penjualan': str(diskon_penjualan),
        })
