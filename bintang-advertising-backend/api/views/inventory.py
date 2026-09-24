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
from ..permissions import IsOwnerManagerAdminSpvFinanceOrReadOnly, IsOwnerManagerOrAdmin

logger = logging.getLogger(__name__)


def record_material_consumption_to_general_ledger(inventory_item, qty, ref_no, keterangan_konteks, source_id=None, nilai=None):
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
        # Nilai HPP: `nilai` eksplisit (biaya FIFO produk sumber, lihat
        # catat_pemakaian_bahan) menang; kalau tidak ada, kuantitas * cost_per_unit.
        cost = nilai if nilai is not None else qty * (inventory_item.cost_per_unit or 0.0)
        if cost <= 0:
            return

        # Batas kolom jurnal: deskripsi 255, nomor dokumen 50 (PostgreSQL menolak
        # lebih panjang -- penanda POS "POS <nomor> - Produk #<id>/<varian>" bisa
        # melewati 50 untuk id produk 5 digit atau produk bervarian).
        ket_tx = f"HPP Otomatis: {inventory_item.nama} ({qty} {inventory_item.satuan}) - {keterangan_konteks}"[:255]
        ref_no = str(ref_no)[:50]

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


def kurangi_stok_produk_sumber(inventory_item, qty, *, user, catatan):
    """Ikut memotong stok Product katalog yang menjadi sumber `inventory_item`
    (2026-09-24, instruksi user: bahan resep terpakai tapi stok di menu Stok
    produk bahannya tidak berkurang).

    Bahan baku resep dipilih dari katalog Produk, lalu dicerminkan jadi
    InventoryItem (`InventoryItem.product`, lihat
    `_get_or_create_inventory_item_for_product`). Pemakaian resep sebelumnya
    hanya memotong InventoryItem.stok -- qty_stok Product sumbernya diam di
    angka awal, jadi menu Stok (yang membaca Product) tidak pernah berubah.

    Dicatat sebagai mutasi 'keluar' lewat stock_fifo.consume_layers (M8), TANPA
    `pos_sale` (agregasi HPP penjualan POS hanya menjumlah mutasi tipe
    'penjualan', jadi tidak dobel). Fungsi ini sendiri tidak membuat jurnal --
    `catat_pemakaian_bahan` yang menjurnalkan senilai `hpp_total` mutasi ini.
    Wajib dipanggil di dalam transaction.atomic (row-lock)."""
    if not inventory_item.product_id:
        return None

    from decimal import Decimal, ROUND_HALF_UP
    from .. import stock_fifo
    from ..product_models import Product, ProductStockMovement

    qty_dec = Decimal(str(qty)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
    if qty_dec <= 0:
        return None

    product = Product.objects.select_for_update().get(pk=inventory_item.product_id)
    # Produk bervarian menyimpan stok di level varian, bukan qty_stok produk.
    if not product.lacak_inventori or product.has_variant:
        return None

    stok_awal = product.qty_stok
    qty_dec = min(qty_dec, max(stok_awal, Decimal('0')))
    if qty_dec <= 0:
        return None

    product.qty_stok = stok_awal - qty_dec
    product.save(update_fields=['qty_stok'])
    movement = ProductStockMovement(
        product=product, variant=None, user=user, tipe='keluar', qty=qty_dec,
        stok_awal=stok_awal, stok_akhir=product.qty_stok,
        catatan=catatan, tanggal=timezone.localdate(),
    )
    # Stok bahan sudah dipotong oleh alur pemakaian ini sendiri -- jangan
    # dicerminkan lagi oleh sinyal sinkron stok produk (services/bahan_baku_sync).
    movement._lewati_cermin_bahan = True
    movement.save()
    stock_fifo.consume_layers(product, None, qty_dec, movement=movement)
    return movement


def catat_pemakaian_bahan(inventory_item, qty, *, user, ref_no, keterangan_konteks, source_id, catatan_stok):
    """Satu pintu pencatatan pemakaian bahan resep (POS & produksi): potong stok
    Product sumber (FIFO), lalu jurnal HPP bahan (Dr HPP 51000 / Kr Persediaan
    11400) senilai biaya FIFO yang baru dikonsumsi itu.

    Sebelumnya jurnal memakai `InventoryItem.cost_per_unit`, padahal bahan yang
    dicerminkan dari katalog Produk selalu bernilai 0 -> jurnal dilewati diam-diam
    (produksi: 0 jurnal HPP bahan, Persediaan tidak pernah berkurang di buku besar;
    ditemukan 2026-09-24). Bahan tanpa Product sumber tetap memakai cost_per_unit.
    Wajib dipanggil di dalam transaction.atomic (M5)."""
    movement = kurangi_stok_produk_sumber(inventory_item, qty, user=user, catatan=catatan_stok)
    nilai = movement.hpp_total if movement is not None and movement.hpp_total else None
    record_material_consumption_to_general_ledger(
        inventory_item, qty, ref_no=ref_no, keterangan_konteks=keterangan_konteks,
        source_id=source_id, nilai=nilai,
    )


class InventoryItemViewSet(viewsets.ModelViewSet):
    serializer_class   = InventoryItemSerializer
    permission_classes = [IsOwnerManagerAdminSpvFinanceOrReadOnly]

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

    @action(detail=False, methods=['get'], url_path='summary')
    def summary(self, request):
        """Pergerakan stok Bahan Baku (RestockHistory) -- pasangan dari
        ProductStockMovementViewSet.summary di product_views.py, TAPI
        untuk InventoryItem (bahan baku resep/BoM), bukan Product jadi
        barang. Sebelumnya halaman "Pergerakan Stok" cuma menampilkan
        Product, bahan baku yang terpotong otomatis lewat BoM (order/POS)
        sama sekali tidak kelihatan di sana (keluhan user 2026-09-24) --
        endpoint ini yang dipanggil dari tab "Bahan Baku" di halaman itu.

        RestockHistory tidak punya field `tipe` seperti ProductStockMovement
        (masuk/keluar/penjualan/pengembalian) -- cuma `delta` (+ = masuk,
        - = keluar), jadi ringkasannya lebih sederhana: in/out saja.
        """
        from django.utils.dateparse import parse_date

        start_date_str = request.query_params.get('start_date')
        end_date_str = request.query_params.get('end_date')
        start_date = parse_date(start_date_str) if start_date_str else timezone.localdate()
        end_date = parse_date(end_date_str) if end_date_str else timezone.localdate()
        if not start_date or not end_date:
            return Response({'error': 'Format tanggal tidak valid'}, status=400)

        items_qs = self.get_queryset()
        page = self.paginate_queryset(items_qs)
        items = page if page is not None else items_qs

        item_ids = [i.id for i in items]
        histories = RestockHistory.objects.filter(item_id__in=item_ids).order_by('waktu')

        by_item = {item.id: [] for item in items}
        for h in histories:
            by_item.setdefault(h.item_id, []).append(h)

        result = []
        for item in items:
            rows = by_item.get(item.id, [])
            before = [h for h in rows if h.waktu.date() < start_date]
            during = [h for h in rows if start_date <= h.waktu.date() <= end_date]
            after = [h for h in rows if h.waktu.date() > end_date]

            if before:
                initial_val = before[-1].stok_akhir
            elif during:
                initial_val = during[0].stok_awal
            elif after:
                initial_val = after[0].stok_awal
            else:
                initial_val = item.stok

            in_qty = sum(h.delta for h in during if h.delta > 0)
            out_qty = sum(-h.delta for h in during if h.delta < 0)

            if during:
                sisa_val = during[-1].stok_akhir
            elif before:
                sisa_val = before[-1].stok_akhir
            else:
                sisa_val = initial_val

            result.append({
                'id': f'inv-{item.id}',
                'group': item.kategori or 'Bahan Baku',
                'product': item.nama,
                'sku': item.id,
                'satuan': item.satuan,
                'initial': float(initial_val),
                'in': float(in_qty),
                # RestockHistory tidak membedakan penjualan/retur seperti
                # ProductStockMovement -- semua pengurangan (BoM, restock
                # manual negatif, penyesuaian) digabung jadi 'out' saja.
                'returnStock': 0.0,
                'sales': 0.0,
                'out': float(out_qty),
                'sisa': float(sisa_val),
            })

        if page is not None:
            return self.get_paginated_response(result)
        return Response(result)


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
    permission_classes = [IsOwnerManagerAdminSpvFinanceOrReadOnly]

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
    # Baca (GET) dibuka untuk staff -- WorkspaceSPK.jsx perlu ini untuk
    # deteksi resep otomatis di dropdown "Pilih Bahan" (instruksi user
    # 2026-09-09); ubah/hapus resep tetap Owner/Manager/Admin saja.
    permission_classes = [IsOwnerManagerAdminSpvFinanceOrReadOnly]

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
    # Bug ditemukan user 2026-09-24: stok selalu di-hardcode 0 di sini,
    # padahal docstring fungsi ini sendiri menjanjikan "disinkron otomatis
    # dari Product" -- akibatnya resep baru SELALU dianggap kehabisan bahan
    # (order/POS ditolak "tidak mencukupi") walau Product sumbernya stoknya
    # banyak. Disinkron NYATA di sini sekarang, tapi cuma SEKALI saat
    # InventoryItem ini pertama kali dibuat. Sesudahnya HANYA pemakaian resep
    # yang dicerminkan ke Product (`kurangi_stok_produk_sumber`); stok masuk
    # Product / restock InventoryItem tetap dua stok terpisah (known gap).
    return InventoryItem.objects.create(
        nama=product.nama,
        satuan=product.satuan or 'pcs',
        kategori=kategori_nama,
        stok=float(product.qty_stok or 0),
        product=product,
    )


class BoMItemViewSet(viewsets.ModelViewSet):
    queryset = BoMItem.objects.select_related('bom', 'inventory_item').all()
    serializer_class = BoMItemSerializer
    # Baca dibuka untuk staff (sama alasan dengan BillOfMaterialsViewSet di
    # atas); ubah/hapus tetap Owner/Manager/Admin saja.
    permission_classes = [IsOwnerManagerAdminSpvFinanceOrReadOnly]

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
