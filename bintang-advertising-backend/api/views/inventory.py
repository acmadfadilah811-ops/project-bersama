import uuid
import logging
from rest_framework import viewsets, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from django.db import transaction

import os
import json
from rest_framework.decorators import action

from ..models import InventoryItem, RestockHistory, ProductPrice, BillOfMaterials, BoMItem
from ..serializers import (
    InventoryItemSerializer, ProductPriceSerializer, BillOfMaterialsSerializer, BoMItemSerializer
)
from ..permissions import IsOwnerManagerAdminOrReadOnly, IsOwnerManagerOrAdmin, IsOwnerOrManager

logger = logging.getLogger(__name__)


def record_material_consumption_to_general_ledger(inventory_item, qty, ref_no, keterangan_konteks, source_id=None):
    """
    Mencatat konsumsi bahan baku ke Buku Besar (Double-Entry Bookkeeping) sebagai Beban HPP.

    Referensi generik (ref_no/keterangan_konteks/source_id), BUKAN objek `job`
    spesifik lagi — dulu fungsi ini langsung akses `job.order_item.order.id`,
    yang CRASH untuk job dari POS (order_item selalu None di situ, lihat
    JobMaterialDeductView) & tidak bisa dipakai sama sekali dari
    pos_services.create_sale untuk pemotongan BoM otomatis lewat kasir
    (instruksi & bug ditemukan user 2026-08-15).
    """
    try:
        # Hitung nilai HPP (kuantitas * cost_per_unit)
        cost = qty * (inventory_item.cost_per_unit or 0.0)
        if cost <= 0:
            return

        ket_tx = f"HPP Otomatis: {inventory_item.nama} ({qty} {inventory_item.satuan}) - {keterangan_konteks}"

        # Forward to Official Double-Entry Ledger (accounting.JournalEntry)
        try:
            from accounting.models import Account, JournalEntry
            from accounting.services.journal import create_journal_entry
            from decimal import Decimal, ROUND_HALF_UP

            acc_hpp = Account.objects.filter(code="51000").first()
            acc_persediaan = Account.objects.filter(code="11400").first()
            if not acc_hpp or not acc_persediaan:
                raise RuntimeError("COA HPP 51000 dan Persediaan 11400 wajib tersedia.")
            amt = Decimal(str(cost)).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
            if amt > 0:
                create_journal_entry(
                    date=timezone.localdate(),
                    lines=[
                        {"account": acc_hpp, "debit": amt, "kredit": 0, "description": ket_tx, "external_document_no": ref_no},
                        {"account": acc_persediaan, "debit": 0, "kredit": amt, "description": ket_tx, "external_document_no": ref_no},
                    ],
                    description=ket_tx,
                    source_type=JournalEntry.SourceType.PRODUCTION,
                    source_id=source_id,
                )
        except Exception as err:
            logger.error(f"Gagal mencatat JournalEntry HPP: {err}")
            raise
    except Exception as e:
        logger.error(f"Gagal mencatat jurnal HPP otomatis ({ref_no}): {e}", exc_info=True)
        raise


class InventoryItemViewSet(viewsets.ModelViewSet):
    serializer_class   = InventoryItemSerializer
    permission_classes = [IsOwnerManagerAdminOrReadOnly]

    def get_queryset(self):
        qs = InventoryItem.objects.prefetch_related('history').order_by('kategori', 'nama')
        if kat := self.request.query_params.get('kategori'):
            qs = qs.filter(kategori__icontains=kat)
        if q := self.request.query_params.get('search'):
            qs = qs.filter(nama__icontains=q)
        if self.request.query_params.get('kritis') == 'true':
            from django.db.models import F
            qs = qs.filter(stok__lt=F('min_stok'))
        return qs

    def perform_create(self, serializer):
        """Auto-generate ID: INV-YYYYMMDD-XXXX"""
        today    = timezone.now().strftime('%Y%m%d')
        short_id = uuid.uuid4().hex[:4].upper()
        inv_id   = f'INV-{today}-{short_id}'
        serializer.save(id=inv_id)

    def update(self, request, *args, **kwargs):
        # Mencegah modifikasi stok manual saat update item
        if 'stok' in request.data:
            instance = self.get_object()
            try:
                new_stok = float(request.data['stok'])
                if abs(new_stok - float(instance.stok)) > 0.0001:
                    return Response(
                        {"error": "Stok tidak dapat diubah secara manual pada menu edit. Gunakan tombol 'Restock' atau 'Penyesuaian Stok' agar riwayat mutasi tercatat."},
                        status=status.HTTP_400_BAD_REQUEST
                    )
            except (ValueError, TypeError):
                pass
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        kwargs['partial'] = True
        return self.update(request, *args, **kwargs)


class InventoryRestockView(APIView):
    """POST /api/inventory/<pk>/restock/ — Tambah/kurangi stok dan catat history."""
    permission_classes = [IsOwnerManagerOrAdmin]

    def post(self, request, pk):
        delta_raw  = request.data.get('delta')
        keterangan = request.data.get('keterangan', '')

        if delta_raw is None:
            return Response(
                {'error': 'delta wajib diisi (+ tambah, - kurangi)'},
                status=status.HTTP_400_BAD_REQUEST
            )
        try:
            delta = float(delta_raw)
        except (ValueError, TypeError):
            return Response(
                {'error': 'delta harus berupa angka'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # ✅ FIX: Gunakan select_for_update() + transaction.atomic() untuk
        # mencegah race condition ketika ada 2+ request bersamaan mengubah stok
        with transaction.atomic():
            item = InventoryItem.objects.select_for_update().get(pk=pk)
            stok_awal  = item.stok
            stok_akhir = max(0.0, item.stok + delta)

            item.stok = stok_akhir
            item.save()

            RestockHistory.objects.create(
                item       = item,
                user       = request.user,
                delta      = delta,
                stok_awal  = stok_awal,
                stok_akhir = stok_akhir,
                keterangan = keterangan,
            )

        return Response({
            'ok':       True,
            'id':       item.id,
            'nama':     item.nama,
            'stok_baru': stok_akhir,
        }, status=status.HTTP_200_OK)


class ProductPriceViewSet(viewsets.ModelViewSet):
    queryset = ProductPrice.objects.all()
    serializer_class = ProductPriceSerializer
    permission_classes = [IsOwnerManagerAdminOrReadOnly]

    @action(detail=False, methods=['post'], url_path='seed')
    def seed_prices(self, request):
        from django.conf import settings
        
        path = os.path.join(settings.BASE_DIR, '..', 'bintang_advertising_app', 'data', 'db_harga.json')
        if not os.path.exists(path):
            path = os.path.join(settings.BASE_DIR, 'db_harga.json')
            
        if not os.path.exists(path):
            return Response({"detail": "File db_harga.json tidak ditemukan."}, status=status.HTTP_404_NOT_FOUND)
            
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            
        # Hapus data lama
        ProductPrice.objects.all().delete()
        
        created_count = 0
        for cat_key, cat_val in data.items():
            for prod_name, prod_val in cat_val.items():
                if isinstance(prod_val, str):
                    clean_price = int(float(prod_val.replace('.', '')))
                    ProductPrice.objects.create(
                        kategori=cat_key,
                        nama_produk=prod_name,
                        harga=clean_price,
                        price_type='flat'
                    )
                    created_count += 1
                elif isinstance(prod_val, dict):
                    keys = list(prod_val.keys())
                    is_qty_tier = any('lbr' in k.lower() or 'pcs' in k.lower() or 'box' in k.lower() or '>' in k.lower() for k in keys)
                    
                    if is_qty_tier:
                        cleaned_tiers = {}
                        for tk, tv in prod_val.items():
                            cleaned_tiers[tk] = int(float(tv.replace('.', '')))
                        ProductPrice.objects.create(
                            kategori=cat_key,
                            nama_produk=prod_name,
                            price_type='tiered',
                            tiers=cleaned_tiers
                        )
                        created_count += 1
                    else:
                        for mat_name, mat_val in prod_val.items():
                            if isinstance(mat_val, str):
                                clean_price = int(float(mat_val.replace('.', '')))
                                ProductPrice.objects.create(
                                    kategori=cat_key,
                                    nama_produk=prod_name,
                                    material=mat_name,
                                    harga=clean_price,
                                    price_type='flat'
                                )
                                created_count += 1
                            elif isinstance(mat_val, dict):
                                cleaned_tiers = {}
                                for tk, tv in mat_val.items():
                                    cleaned_tiers[tk] = int(float(tv.replace('.', '')))
                                ProductPrice.objects.create(
                                    kategori=cat_key,
                                    nama_produk=prod_name,
                                    material=mat_name,
                                    price_type='tiered',
                                    tiers=cleaned_tiers
                                )
                                created_count += 1
                                
        return Response({"detail": f"Berhasil mengimpor {created_count} produk dari db_harga.json."})


class BillOfMaterialsViewSet(viewsets.ModelViewSet):
    queryset = BillOfMaterials.objects.select_related(
        'product', 'variant', 'product_price',
    ).prefetch_related('items__inventory_item').all()
    serializer_class = BillOfMaterialsSerializer
    permission_classes = [IsOwnerOrManager]

    def get_queryset(self):
        queryset = self.queryset
        # `product_id`/`variant_id` = tautan BARU ke katalog Product asli
        # (dipakai UI "Tambah Bahan" — bug ditemukan & diperbaiki 2026-08-12,
        # lihat migration 0114). `product_name`/`material` = jalur LAMA via
        # ProductPrice, dipertahankan untuk kompatibilitas caller lama
        # (mis. import CSV yang cuma punya nama produk, bukan ID).
        product_id = self.request.query_params.get('product_id')
        if product_id:
            queryset = queryset.filter(product_id=product_id)
            variant_id = self.request.query_params.get('variant_id')
            if variant_id is not None:
                if variant_id == '' or variant_id.lower() == 'null':
                    queryset = queryset.filter(variant__isnull=True)
                else:
                    queryset = queryset.filter(variant_id=variant_id)
            return queryset

        product_name = self.request.query_params.get('product_name')
        if product_name:
            queryset = queryset.filter(product_price__nama_produk=product_name)
        material = self.request.query_params.get('material')
        if material is not None:
            if material == '' or material.lower() == 'null':
                queryset = queryset.filter(product_price__material__isnull=True) | queryset.filter(product_price__material='')
            else:
                queryset = queryset.filter(product_price__material=material)
        return queryset

    @action(detail=False, methods=['post'], url_path='get-or-create-for-product')
    def get_or_create_for_product(self, request):
        product_id = request.data.get('product_id')
        if product_id:
            from ..product_models import Product, ProductVariant

            try:
                product_obj = Product.objects.get(pk=product_id)
            except (Product.DoesNotExist, ValueError, TypeError):
                return Response({'error': 'Produk tidak ditemukan.'}, status=status.HTTP_404_NOT_FOUND)

            variant_id = request.data.get('variant_id')
            variant_obj = None
            if variant_id:
                try:
                    variant_obj = ProductVariant.objects.get(pk=variant_id, product=product_obj)
                except (ProductVariant.DoesNotExist, ValueError, TypeError):
                    return Response({'error': 'Varian tidak ditemukan untuk produk ini.'}, status=status.HTTP_404_NOT_FOUND)

            with transaction.atomic():
                bom_obj, created = BillOfMaterials.objects.get_or_create(
                    product=product_obj,
                    variant=variant_obj,
                    defaults={'nama': f"BoM {product_obj.nama}" + (f" - {variant_obj.nama_varian}" if variant_obj else "")}
                )
            serializer = self.get_serializer(bom_obj)
            return Response(serializer.data, status=status.HTTP_200_OK)

        # Jalur lama (legacy ProductPrice, dicocokkan dari nama) — dipertahankan
        # untuk caller yang belum kirim product_id (mis. import CSV).
        product_name = request.data.get('product_name')
        if not product_name:
            return Response({'error': 'product_id atau product_name wajib diisi'}, status=status.HTTP_400_BAD_REQUEST)
        product_name = product_name.strip()

        material = request.data.get('material')
        if material:
            material = material.strip()
            if material == '0' or material.lower() == 'null':
                material = None
        else:
            material = None

        with transaction.atomic():
            # Find or create ProductPrice
            product_price_obj = ProductPrice.objects.filter(nama_produk=product_name, material=material).first()
            if not product_price_obj:
                if not material:
                    product_price_obj = ProductPrice.objects.filter(nama_produk=product_name).first()
                if not product_price_obj:
                    product_price_obj = ProductPrice.objects.create(
                        kategori="Umum",
                        nama_produk=product_name,
                        material=material,
                        harga=0
                    )

            # Find or create BillOfMaterials
            bom_obj, created = BillOfMaterials.objects.get_or_create(
                product_price=product_price_obj,
                defaults={'nama': f"BoM {product_price_obj.nama_produk}" + (f" - {product_price_obj.material}" if product_price_obj.material else "")}
            )

        serializer = self.get_serializer(bom_obj)
        return Response(serializer.data, status=status.HTTP_200_OK)


def _get_or_create_inventory_item_for_product(product):
    """Cari/buat InventoryItem yang mewakili `product` sebagai bahan baku resep.

    Bahan baku (mis. kertas Ivory) dikelola sebagai Product biasa di katalog
    (1500+ item), bukan lewat menu "Bahan Baku" (InventoryItem) yang nyaris
    tidak pernah diisi. Supaya pencarian bahan di resep bisa baca dari
    katalog Produk tapi BoMItem tetap memakai FK InventoryItem yang sudah
    ada (dipakai logic potong stok produksi di views/jobs.py), item
    InventoryItem disinkron otomatis dari Product saat pertama kali dipilih.
    """
    existing = InventoryItem.objects.filter(product=product).first()
    if existing:
        return existing
    kategori_nama = product.kategori.nama if product.kategori_id else 'Bahan Baku'
    return InventoryItem.objects.create(
        nama=product.nama,
        satuan=product.satuan or 'pcs',
        kategori=kategori_nama,
        stok=0.0,
        product=product,
    )


class BoMItemViewSet(viewsets.ModelViewSet):
    queryset = BoMItem.objects.select_related('bom', 'inventory_item').all()
    serializer_class = BoMItemSerializer
    permission_classes = [IsOwnerOrManager]

    @action(detail=False, methods=['post'], url_path='create-from-product')
    def create_from_product(self, request):
        """Tambah/ubah item resep dari hasil pencarian Produk (bukan InventoryItem)."""
        from ..product_models import Product

        bom_id = request.data.get('bom')
        product_id = request.data.get('product_id')
        qty_raw = request.data.get('qty_required_per_unit')
        if not bom_id or not product_id:
            return Response({'error': 'bom dan product_id wajib diisi'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            qty = float(qty_raw)
        except (TypeError, ValueError):
            return Response({'error': 'qty_required_per_unit harus berupa angka'}, status=status.HTTP_400_BAD_REQUEST)
        if qty <= 0:
            return Response({'error': 'qty_required_per_unit harus lebih besar dari 0'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            bom_obj = BillOfMaterials.objects.get(pk=bom_id)
        except (BillOfMaterials.DoesNotExist, ValueError, TypeError):
            return Response({'error': 'Resep (BoM) tidak ditemukan.'}, status=status.HTTP_404_NOT_FOUND)
        try:
            product_obj = Product.objects.get(pk=product_id)
        except (Product.DoesNotExist, ValueError, TypeError):
            return Response({'error': 'Produk bahan baku tidak ditemukan.'}, status=status.HTTP_404_NOT_FOUND)

        with transaction.atomic():
            inv_item = _get_or_create_inventory_item_for_product(product_obj)
            bom_item_obj, created = BoMItem.objects.get_or_create(
                bom=bom_obj,
                inventory_item=inv_item,
                defaults={'qty_required_per_unit': qty}
            )
            if not created:
                bom_item_obj.qty_required_per_unit = qty
                bom_item_obj.save()

        serializer = self.get_serializer(bom_item_obj)
        return Response(serializer.data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)
