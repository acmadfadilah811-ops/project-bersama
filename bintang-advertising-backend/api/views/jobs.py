import logging
from rest_framework import viewsets, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from django.utils import timezone
from django.utils.dateparse import parse_date
from django.db import transaction
from django.db.models import Count, Prefetch, Q, Sum
from django.shortcuts import get_object_or_404

from ..models import (
    JobBoard, CustomUser, TahapProses, OrderActivityLog, InventoryItem, RestockHistory, ProductPrice, BillOfMaterials, BoMItem,
    PenggunaanMesin,
)
from ..serializers import JobBoardSerializer, TahapProsesSerializer
from ..permissions import (
    IsClockedIn, IsOwnerManagerAdminOrReadOnly, get_subordinate_divisi_ids, get_subordinate_user_ids,
    scoped_by_unit_bisnis,
)

from .inventory import kurangi_stok_produk_sumber, record_material_consumption_to_general_ledger

logger = logging.getLogger(__name__)


def _catat_aktivitas_order(job, user, tindakan, keterangan):
    """Catat OrderActivityLog — hanya berlaku untuk job dari alur order/WA.

    Job yang lahir dari POS (`pos_sale_item` terisi) tidak punya `Order`
    induk untuk dicatat, jadi dilewati diam-diam alih-alih crash.
    """
    if not job.order_item_id:
        return
    OrderActivityLog.objects.create(
        order=job.order_item.order,
        user=user,
        tindakan=tindakan,
        keterangan=keterangan,
    )


def deduct_job_materials_if_needed(job, user):
    """
    Mengurangi stok bahan baku. Prioritas pertama menggunakan sistem Bill of Materials (BoM).
    Jika BoM tidak ditemukan untuk produk/bahan terkait, fallback ke input manual di catatan_staff.
    Juga mencatat konsumsi bahan ke Buku Besar (HPP).
    """
    marker = f"Job #{job.id}"
    if RestockHistory.objects.filter(keterangan__icontains=marker).exists():
        return

    # Pemotongan BoM otomatis butuh field khusus OrderItem (bahan, luas) yang
    # tidak punya padanan di POSSaleItem. Job dari POS dilewati di sini —
    # staff tetap bisa input manual lewat JobMaterialDeductView.
    if not job.order_item_id:
        return

    order_item = job.order_item

    # 1. Cari BoM — utamakan tautan Product/Variant NYATA di order_item kalau
    # ada (mis. order dari katalog WA, lihat T-720), baru fallback ke
    # pencocokan teks bebas jenis_produk/bahan via ProductPrice legacy untuk
    # order lama/custom yang tidak punya FK produk sama sekali.
    bom = None
    if order_item.product_id:
        bom = BillOfMaterials.objects.filter(
            product_id=order_item.product_id, variant_id=order_item.variant_id,
        ).first()
        if not bom and order_item.variant_id:
            bom = BillOfMaterials.objects.filter(
                product_id=order_item.product_id, variant__isnull=True,
            ).first()

    if not bom:
        product = ProductPrice.objects.filter(nama_produk=order_item.jenis_produk, material=order_item.bahan).first()
        if not product:
            product = ProductPrice.objects.filter(nama_produk=order_item.jenis_produk).first()
        if product:
            bom = BillOfMaterials.objects.filter(product_price=product).first()
        
    if bom:
        # BoM dikaitkan ke order_item (product_id/variant_id), BUKAN ke
        # job/tahap tertentu -- kalau 1 order_item melewati beberapa job
        # (Desain -> Cetak -> Finishing, tiap forward bikin JobBoard row
        # baru), pencarian BoM di atas akan menemukan resep yang SAMA di
        # setiap tahap. Marker lama (f"Job #{job.id}") cuma mencegah JOB
        # yang sama diproses 2x, TIDAK mencegah bahan yang sama terpotong
        # ulang di tahap berikutnya untuk order_item yang sama -- bug
        # ditemukan audit 2026-09-09 (dorman, BoM belum pernah dipakai di
        # produksi saat ditemukan). Marker baru ini per-order_item supaya
        # BoM cuma terpotong SEKALI untuk 1 item, siapa pun job/tahap yang
        # memicunya pertama kali.
        order_item_marker = f"OrderItem #{order_item.id} BoM"
        if RestockHistory.objects.filter(keterangan__icontains=order_item_marker).exists():
            return
        with transaction.atomic():
            for bom_item in bom.items.all():
                item = bom_item.inventory_item
                # Lock item for update
                item = InventoryItem.objects.select_for_update().get(pk=item.pk)

                luas = order_item.luas
                if luas > 0:
                    qty_needed = round(luas * order_item.qty * bom_item.qty_required_per_unit, 4)
                else:
                    qty_needed = round(order_item.qty * bom_item.qty_required_per_unit, 4)

                if qty_needed <= 0:
                    continue
                if qty_needed > item.stok:
                    raise ValidationError(
                        {'error': f"Stok bahan '{item.nama}' tidak mencukupi untuk Job #{job.id}."}
                    )

                stok_awal = item.stok
                stok_akhir = max(0.0, round(item.stok - qty_needed, 4))

                RestockHistory.objects.create(
                    item=item,
                    user=user,
                    delta=-qty_needed,
                    stok_awal=stok_awal,
                    stok_akhir=stok_akhir,
                    keterangan=f"Pemakaian BoM otomatis | {order_item_marker} | Job #{job.id} | {bom.nama}",
                )

                item.stok = stok_akhir
                item.save()

                # Catat ke Buku Besar
                record_material_consumption_to_general_ledger(
                    item, qty_needed, ref_no=marker,
                    keterangan_konteks=f"Order {order_item.order_id} - {marker}", source_id=job.id,
                )
                kurangi_stok_produk_sumber(
                    item, qty_needed, user=user,
                    catatan=f"Pemakaian bahan resep | {order_item_marker} | Job #{job.id} | {bom.nama}",
                )
        return

    # 2. Fallback: Gunakan pemotongan manual dari catatan_staff
    materials_list = job.catatan_staff if isinstance(job.catatan_staff, list) else []
    if not materials_list:
        return
        
    # Cari indeks pembatas terakhir
    last_sep_idx = -1
    for i, mat in enumerate(materials_list):
        if str(mat.get('keterangan', '')).startswith('--- Dari Divisi:'):
            last_sep_idx = i
            
    current_mats = materials_list[last_sep_idx+1:] if last_sep_idx != -1 else materials_list
    
    with transaction.atomic():
        for mat in current_mats:
            item_id = mat.get('item_id', '')
            if not item_id:
                continue
                
            qty_val = mat.get('jumlah') or mat.get('qty') or 0
            try:
                qty = float(str(qty_val).replace(',', '.'))
            except (ValueError, TypeError):
                continue
                
            if qty <= 0:
                continue
                
            try:
                item = InventoryItem.objects.select_for_update().get(pk=item_id)
            except InventoryItem.DoesNotExist:
                continue
                
            stok_awal = item.stok
            if qty > stok_awal:
                raise ValidationError(
                    {'error': f"Stok bahan '{item.nama}' tidak mencukupi untuk Job #{job.id}."}
                )
            stok_akhir = max(0.0, round(item.stok - qty, 4))
            catatan_mat = mat.get('catatan', '')
            
            RestockHistory.objects.create(
                item=item,
                user=user,
                delta=-qty,
                stok_awal=stok_awal,
                stok_akhir=stok_akhir,
                keterangan=f"Pemakaian produksi otomatis | Job #{job.id} | {catatan_mat}".strip(' |'),
            )
            
            item.stok = stok_akhir
            item.save()
            
            # Catat ke Buku Besar
            record_material_consumption_to_general_ledger(
                item, qty, ref_no=marker,
                keterangan_konteks=f"Order {order_item.order_id} - {marker}", source_id=job.id,
            )
            kurangi_stok_produk_sumber(
                item, qty, user=user,
                catatan=f"Pemakaian bahan produksi | Job #{job.id} | {catatan_mat}".strip(' |'),
            )


class JobMaterialDeductView(APIView):
    """
    POST /api/jobs/{job_id}/use-materials/
    Body: { materials: [{item_id: "INV-xxx", qty: 1.2, catatan: "..."}, ...] }
    Mengurangi stok inventori & mencatat RestockHistory per item.
    """
    permission_classes = [IsAuthenticated, IsClockedIn]

    def post(self, request, job_id):
        job = get_object_or_404(JobBoard, pk=job_id)

        # Staff hanya bisa input untuk job miliknya sendiri. SPV/Kordiv boleh
        # input untuk job MILIK BAWAHANNYA (rekursif) -- mereka sendiri tidak
        # pernah jadi pic_staff, jadi dibedakan dari staff biasa.
        if request.user.role == 'staff' and job.pic_staff != request.user:
            return Response({'error': 'Akses ditolak.'}, status=status.HTTP_403_FORBIDDEN)
        if request.user.role in ('spv', 'kordiv') and (
            not job.pic_staff_id or job.pic_staff_id not in get_subordinate_user_ids(request.user)
        ):
            return Response({'error': 'Akses ditolak.'}, status=status.HTTP_403_FORBIDDEN)

        materials = request.data.get('materials', [])
        if not materials:
            return Response({'error': 'Tidak ada bahan yang diinput.'}, status=status.HTTP_400_BAD_REQUEST)

        deducted = []
        errors   = []

        with transaction.atomic():
            for mat in materials:
                item_id = mat.get('item_id', '').strip()
                catatan = mat.get('catatan', '')

                # Parse qty — toleran terhadap koma desimal (1,2 → 1.2)
                try:
                    qty = float(str(mat.get('qty', 0)).replace(',', '.'))
                except (ValueError, TypeError):
                    errors.append(f"Qty tidak valid untuk item {item_id}")
                    continue

                if qty <= 0:
                    continue

                try:
                    item = InventoryItem.objects.select_for_update().get(pk=item_id)
                except InventoryItem.DoesNotExist:
                    errors.append(f"Item '{item_id}' tidak ditemukan di inventori.")
                    continue

                if qty > item.stok:
                    errors.append(f"Stok item '{item.nama}' tidak mencukupi (tersedia {item.stok}).")
                    continue

                stok_awal  = item.stok
                stok_akhir = max(0.0, round(item.stok - qty, 4))

                RestockHistory.objects.create(
                    item       = item,
                    user       = request.user,
                    delta      = -qty,
                    stok_awal  = stok_awal,
                    stok_akhir = stok_akhir,
                    keterangan = f"Pemakaian produksi | Job #{job_id} | {catatan}".strip(' |'),
                )

                item.stok = stok_akhir
                item.save()

                # Konsumsi manual harus mengikuti jalur jurnal yang sama
                # dengan pemakaian BoM; jangan biarkan stok berubah tanpa HPP.
                # Job dari POS tidak punya order_item (lihat
                # deduct_job_materials_if_needed) — konteks fallback ke
                # "Job #<id>" saja spy tidak crash akses order_item.order.id
                # yang None (bug ditemukan user 2026-08-15).
                marker = f"Job #{job_id}"
                konteks = f"Order {job.order_item.order_id} - {marker}" if job.order_item_id else marker
                record_material_consumption_to_general_ledger(
                    item, qty, ref_no=marker, keterangan_konteks=konteks, source_id=job.id,
                )
                kurangi_stok_produk_sumber(
                    item, qty, user=request.user,
                    catatan=f"Pemakaian bahan produksi | Job #{job_id} | {catatan}".strip(' |'),
                )

                deducted.append({
                    'item_id':  item.id,
                    'nama':     item.nama,
                    'satuan':   item.satuan,
                    'qty_used': qty,
                    'stok_baru': stok_akhir,
                })

        return Response({
            'ok':       True,
            'deducted': deducted,
            'errors':   errors,
            'total_items': len(deducted),
        }, status=status.HTTP_200_OK)


class JobBoardViewSet(viewsets.ModelViewSet):
    serializer_class = JobBoardSerializer
    permission_classes = [IsAuthenticated, IsClockedIn]

    def get_permissions(self):
        # SPV/Kordiv TIDAK PERNAH jadi pic_staff (lihat get_queryset() di
        # bawah) -- mereka cuma mengawasi/assign, tidak pernah "mengerjakan"
        # job sendiri, jadi status clock-in mereka sendiri tidak relevan sama
        # sekali utk endpoint ini (beda dgn staff, yang memang harus clock-in
        # sebelum mulai kerja di papan kerjanya). Tanpa pengecualian ini,
        # SPV/Kordiv yang belum clock-in hari itu ke-403 di halaman landing
        # mereka sendiri (Papan Kerja Tim) -- bug ditemukan 2026-09-18.
        if getattr(self.request.user, 'role', None) in ('spv', 'kordiv'):
            return [IsAuthenticated()]
        return super().get_permissions()

    @transaction.atomic
    def perform_update(self, serializer):
        # Ambil status sebelum update
        # Jangan lock hasil ``select_related`` dari get_queryset(): kedua FK
        # sumber SPK nullable (order_item/pos_sale_item), sehingga PostgreSQL
        # menolak FOR UPDATE pada outer join saat staff menyimpan draf.
        old_instance = JobBoard.objects.select_for_update(of=('self',)).get(pk=serializer.instance.pk)
        old_status = old_instance.status_pekerjaan
        new_status = serializer.validated_data.get('status_pekerjaan', old_status)

        # ✅ FIX: Validasi status transition — mencegah status lompat tidak valid
        VALID_TRANSITIONS = {
            'antrean':   ['dikerjakan', 'kendala', 'gagal', 'batal', 'antrean'],
            'dikerjakan':['selesai', 'kendala', 'gagal', 'batal', 'antrean', 'dikerjakan'],
            'kendala':   ['dikerjakan', 'antrean', 'gagal', 'batal', 'kendala'],
            'selesai':   [],  # Status final — tidak bisa diubah lagi
            'gagal':     ['antrean'],  # Bisa di-retry dari gagal
            'batal':     [],  # Status final
        }
        allowed = VALID_TRANSITIONS.get(old_status, [])
        if new_status != old_status and new_status not in allowed:
            from rest_framework.exceptions import ValidationError as DRFValidationError
            raise DRFValidationError(
                {"status_pekerjaan": f"Transisi status '{old_status}' → '{new_status}' tidak diizinkan."}
            )
        
        # Simpan pembaruan
        serializer.instance._current_user = self.request.user
        job = serializer.save()
        new_status = job.status_pekerjaan
        
        # Jalankan logika sinkronisasi jika status berubah
        if old_status != new_status:
            user = self.request.user
            
            # 1. Kembali ke Antrean
            if new_status == 'antrean':
                job.waktu_mulai = None
                job.waktu_selesai = None
                job.save()

                tahap_nama = job.tahap.nama if job.tahap else "Tahap Awal"
                _catat_aktivitas_order(
                    job, user, "RESET_JOB",
                    f"Pengerjaan item '{job.nama_produk}' pada tahap '{tahap_nama}' dikembalikan ke Antrean"
                )

            # 2. Mulai Dikerjakan
            elif new_status == 'dikerjakan':
                if not job.waktu_mulai:
                    job.waktu_mulai = timezone.now()
                job.waktu_selesai = None
                job.save()

                tahap_nama = job.tahap.nama if job.tahap else "Tahap Awal"
                _catat_aktivitas_order(
                    job, user, "START_JOB",
                    f"Staff '{user.username}' mulai memproses pengerjaan item '{job.nama_produk}' pada tahap '{tahap_nama}'"
                )

            # 3. Selesai Sukses
            elif new_status == 'selesai':
                if not job.waktu_selesai:
                    job.waktu_selesai = timezone.now()
                # Reset OTP fields
                job.otp_code = ''
                job.otp_requested = False
                job.otp_sent = False
                job.save()

                tahap_nama = job.tahap.nama if job.tahap else "Tahap Awal"
                _catat_aktivitas_order(
                    job, user, "COMPLETE_JOB",
                    f"Staff '{user.username}' berhasil menyelesaikan pengerjaan item '{job.nama_produk}' pada tahap '{tahap_nama}'"
                )

                # Potong stok bahan otomatis
                deduct_job_materials_if_needed(job, user)

                # Cek kelengkapan pesanan secara global — hanya berlaku untuk
                # job dari alur order (job POS tidak punya Order induk)
                if job.order_item_id:
                    order = job.order_item.order
                    active_jobs_exist = JobBoard.objects.filter(
                        order_item__order=order,
                        status_pekerjaan__in=['antrean', 'dikerjakan', 'kendala']
                    ).exists()
                    if not active_jobs_exist:
                        order.status_global = 'ready'
                        order._current_user = user
                        order.save()

                        OrderActivityLog.objects.create(
                            order=order,
                            user=user,
                            tindakan="READY_ORDER",
                            keterangan="Semua item selesai diproduksi. Status pesanan diubah otomatis menjadi 'Siap Diambil'."
                        )

            # 4. Gagal / Batal
            elif new_status in ('gagal', 'batal'):
                if not job.waktu_selesai:
                    job.waktu_selesai = timezone.now()
                # Reset OTP fields
                job.otp_code = ''
                job.otp_requested = False
                job.otp_sent = False
                job.save()

                tahap_nama = job.tahap.nama if job.tahap else "Tahap Awal"
                _catat_aktivitas_order(
                    job, user, "FAIL_JOB",
                    f"Pengerjaan item '{job.nama_produk}' pada tahap '{tahap_nama}' gagal/dibatalkan (Status: {job.get_status_pekerjaan_display()})"
                )

            # 5. Kendala
            elif new_status == 'kendala':
                job.waktu_selesai = None
                job.save()

                tahap_nama = job.tahap.nama if job.tahap else "Tahap Awal"
                _catat_aktivitas_order(
                    job, user, "CONSTRAINT_JOB",
                    f"Pengerjaan item '{job.nama_produk}' pada tahap '{tahap_nama}' mengalami kendala"
                )

    def get_queryset(self):
        user = self.request.user
        base_qs = JobBoard.objects.select_related(
            'tahap',
            'tahap__divisi',
            'pic_staff',
            'pic_staff__divisi',
            'order_item',
            'order_item__order'
        ).prefetch_related(
            # Riwayat pekerjaan staff (KanbanPersonal, job 'selesai') perlu
            # menampilkan mesin apa yang dipakai per job -- tanpa prefetch ini
            # tiap job memicu query sendiri (N+1) untuk penggunaan_mesin_ringkas
            # di JobBoardSerializer (fitur 2026-09-09).
            Prefetch(
                'penggunaan_mesin',
                queryset=PenggunaanMesin.objects.select_related('mesin').order_by('-waktu'),
            ),
        ).order_by('-id')

        # Owner, Manager & Admin bisa lihat semua job
        if user.role in ['owner', 'manager', 'admin']:
            scoped_qs = base_qs
        # SPV/Kordiv: bisa lihat & kelola job milik SELURUH bawahannya
        # (rekursif, lihat get_subordinate_user_ids) -- cabang organisasi
        # sendiri saja, tidak pernah divisi/cabang SPV lain. `pic_staff_id__in`
        # sudah otomatis mencakup job milik SPV/Kordiv sendiri juga, karena
        # get_subordinate_user_ids() menyertakan id user itu sendiri -- sejak
        # 2026-09-23 SPV/Kordiv BOLEH jadi pic_staff (klaim & kerjakan job
        # sendiri seperti staff, instruksi user), bukan cuma mengawasi/assign.
        # DITAMBAH: job yang BELUM ditugaskan (pic_staff kosong) di divisi
        # TIM bawahannya -- tanpa ini, `pic_staff_id__in=[...]` tidak pernah
        # cocok dengan NULL, jadi Kordiv tidak pernah bisa lihat/assign job
        # unassigned sama sekali (gap ditemukan saat membangun fitur "Assign
        # Staff" Papan Kerja Kordiv, sama seperti aturan unassigned staff di
        # bawah). Sengaja pakai get_subordinate_divisi_ids(), BUKAN
        # `user.divisi_id` -- SPV lazimnya TIDAK punya divisi sendiri
        # (mengawasi beberapa Kordiv/divisi sekaligus), jadi `user.divisi_id`
        # membuat SPV TIDAK PERNAH melihat job unassigned sama sekali (bug
        # ditemukan 2026-09-23, sebelumnya cuma fail-open ke lingkup
        # bawahan tanpa unassigned -- sekarang benar-benar scoped ke divisi
        # tim, bukan dihilangkan).
        elif user.role in ('spv', 'kordiv'):
            divisi_ids = get_subordinate_divisi_ids(user)
            scoped_qs = base_qs.filter(
                Q(pic_staff_id__in=get_subordinate_user_ids(user)) |
                Q(pic_staff__isnull=True, tahap__divisi_id__in=divisi_ids)
            )
        # Staff: bisa lihat job miliknya ATAU job unassigned di divisinya
        elif user.divisi:
            scoped_qs = base_qs.filter(
                Q(pic_staff=user) |
                Q(pic_staff__isnull=True, tahap__divisi=user.divisi)
            )
        else:
            scoped_qs = base_qs.filter(pic_staff=user)

        # ── Filter opsional (papan produksi staff, fitur 2026-09-07) ──
        # Sebelumnya frontend menarik SELURUH riwayat job (semua status,
        # semua waktu) setiap buka Papan Kerja SPK -- job 'selesai' dari
        # bulan/tahun lalu tetap ikut tertarik, dan tanpa page/page_size
        # OptionalPageNumberPagination diam-diam berhenti di 1000 baris
        # (job lebih lama hilang tanpa peringatan). Filter ini DITERAPKAN
        # SETELAH scoping role di atas -- tidak pernah menggantikannya,
        # jadi staff tetap tidak bisa lihat job staff lain / divisi lain
        # walau filter ini dipasang.
        status_pekerjaan = self.request.query_params.get('status_pekerjaan')
        if status_pekerjaan:
            status_list = [s.strip() for s in status_pekerjaan.split(',') if s.strip()]
            if status_list:
                scoped_qs = scoped_qs.filter(status_pekerjaan__in=status_list)

        if str(self.request.query_params.get('unassigned') or '').strip().lower() in ('1', 'true', 'yes'):
            scoped_qs = scoped_qs.filter(pic_staff__isnull=True)

        if str(self.request.query_params.get('mine') or '').strip().lower() in ('1', 'true', 'yes'):
            scoped_qs = scoped_qs.filter(pic_staff=user)

        tahap = self.request.query_params.get('tahap')
        if tahap:
            scoped_qs = scoped_qs.filter(tahap__nama__iexact=tahap.strip())

        # waktu_selesai sudah punya index gabungan (pic_staff, waktu_selesai)
        # -- dipakai kolom "Selesai" Kanban Personal supaya default terbatas
        # ke hari ini, bukan seluruh riwayat.
        date_from = parse_date(self.request.query_params.get('date_from') or '')
        date_to = parse_date(self.request.query_params.get('date_to') or '')
        if date_from:
            scoped_qs = scoped_qs.filter(waktu_selesai__date__gte=date_from)
        if date_to:
            scoped_qs = scoped_qs.filter(waktu_selesai__date__lte=date_to)

        return scoped_qs

    @action(detail=False, methods=['get'], url_path='ringkasan-tim', permission_classes=[IsAuthenticated])
    def ringkasan_tim(self, request):
        """
        Ringkasan kinerja tim untuk SPV/Koordinator Divisi: jumlah job per
        status (dikerjakan/selesai/gagal/dst) + laporan pemakaian mesin,
        mencakup seluruh bawahan di cabang organisasinya (rekursif -- lihat
        get_subordinate_user_ids()). Hanya angka rekap, BUKAN daftar detail
        per-job -- SPV/Kordiv tidak diberi akses buka satu-satu pekerjaan
        bawahannya, cuma ringkasannya (batasan yang disepakati).

        Khusus role spv/kordiv -- role lain pakai jalur yang sudah ada:
        staff lihat job miliknya sendiri lewat /api/jobs/ biasa, owner/
        manager/admin sudah lihat semua job company-wide di sana juga.

        SENGAJA tidak pakai IsClockedIn (beda dgn permission_classes default
        ViewSet ini) -- ini halaman LANDING SPV/Kordiv setelah login
        (RingkasanTim.jsx), read-only, jadi status clock-in SI PENONTON
        tidak relevan sama sekali utk bisa melihat ringkasan timnya sendiri
        (bug ditemukan 2026-09-18: SPV/Kordiv yang belum clock-in hari itu
        ke-403 & landing page-nya sendiri gagal dimuat, "Gagal memuat data
        tim").
        """
        user = request.user
        if user.role not in ('spv', 'kordiv'):
            return Response(
                {'error': 'Endpoint ini khusus akun SPV/Koordinator Divisi.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        subordinate_ids = get_subordinate_user_ids(user)

        status_counts = dict(
            JobBoard.objects.filter(pic_staff_id__in=subordinate_ids)
            .values_list('status_pekerjaan')
            .annotate(jumlah=Count('id'))
            .values_list('status_pekerjaan', 'jumlah')
        )

        # Job selesai HARI INI (bukan sepanjang masa seperti job_per_status
        # di atas) & job belum dialokasikan di divisi Kordiv sendiri -- dua
        # angka ini dipakai kartu ringkasan Papan Kerja Kordiv ("Selesai
        # Hari Ini" & "N SPK belum dialokasikan"). Unassigned cuma dihitung
        # kalau user punya divisi (SPV lintas-divisi tidak, konsisten
        # dengan get_queryset() di atas).
        selesai_hari_ini = JobBoard.objects.filter(
            pic_staff_id__in=subordinate_ids, status_pekerjaan='selesai',
            waktu_selesai__date=timezone.localdate(),
        ).count()
        job_belum_dialokasikan = 0
        if user.divisi_id:
            job_belum_dialokasikan = JobBoard.objects.filter(
                pic_staff__isnull=True, tahap__divisi=user.divisi,
            ).count()

        # Beban kerja per staff bawahan -- job aktif saat ini (snapshot) +
        # proporsi selesai/total job yang TERSENTUH (mulai atau selesai)
        # dalam 7 hari terakhir, dipakai grid "Beban Kerja Staff" di Papan
        # Kerja Kordiv. Staff tanpa job tersentuh minggu ini tetap muncul
        # (persen_selesai_minggu_ini = None, bukan dibagi nol).
        tujuh_hari_lalu = timezone.now() - timezone.timedelta(days=7)
        beban_staff = []
        staff_bawahan = CustomUser.objects.filter(
            id__in=subordinate_ids, role='staff',
        ).exclude(id=user.id)
        for staff in staff_bawahan:
            job_aktif = JobBoard.objects.filter(
                pic_staff=staff, status_pekerjaan__in=('antrean', 'dikerjakan', 'kendala'),
            ).count()
            minggu_ini_qs = JobBoard.objects.filter(pic_staff=staff).filter(
                Q(waktu_mulai__gte=tujuh_hari_lalu) | Q(waktu_selesai__gte=tujuh_hari_lalu)
            )
            total_minggu_ini = minggu_ini_qs.count()
            selesai_minggu_ini = minggu_ini_qs.filter(status_pekerjaan='selesai').count()
            beban_staff.append({
                'staff_id': staff.id,
                'nama': staff.get_full_name() or staff.username,
                'job_aktif': job_aktif,
                'selesai_minggu_ini': selesai_minggu_ini,
                'total_minggu_ini': total_minggu_ini,
                'persen_selesai_minggu_ini': (
                    round(selesai_minggu_ini / total_minggu_ini * 100) if total_minggu_ini else None
                ),
            })
        beban_staff.sort(key=lambda b: b['job_aktif'], reverse=True)

        # Akun Kordiv bawahan -- khusus dipakai SPV. Sebelumnya SPV tidak pernah
        # melihat IDENTITAS Kordiv yang melapor kepadanya di endpoint mana pun
        # (CustomUserViewSet/direktori karyawan dibatasi owner/manager/admin,
        # "Beban Kerja Staff" sengaja hanya role='staff') -- cuma angka agregat
        # per-divisi yang terlihat, tanpa tahu siapa Kordiv-nya. Ini SENGAJA
        # ringkas (identitas + divisi + ringkasan tim Kordiv itu saja, BUKAN
        # akses penuh ke profil/data HR Kordiv) -- keputusan disepakati
        # 2026-09-22: SPV harus bisa melihat akun Kordiv bawahannya.
        kordiv_bawahan = []
        qs_kordiv = CustomUser.objects.filter(
            id__in=subordinate_ids, role='kordiv',
        ).exclude(id=user.id).select_related('divisi')
        for k in qs_kordiv:
            tim_kordiv_ids = get_subordinate_user_ids(k) - {k.id}
            job_aktif_tim = JobBoard.objects.filter(
                pic_staff_id__in=tim_kordiv_ids,
                status_pekerjaan__in=('antrean', 'dikerjakan', 'kendala'),
            ).count()
            kordiv_bawahan.append({
                'id': k.id,
                'username': k.username,
                'nama': k.get_full_name() or k.username,
                'divisi_nama': k.divisi.nama if k.divisi else None,
                'no_hp': k.no_hp,
                'jumlah_staff': CustomUser.objects.filter(id__in=tim_kordiv_ids, role='staff').count(),
                'job_aktif_tim': job_aktif_tim,
            })
        kordiv_bawahan.sort(key=lambda kd: kd['nama'])

        # Perbandingan antar divisi -- khusus dipakai SPV (mengawasi lintas
        # Kordiv/divisi sekaligus, tidak seperti Kordiv yang cuma 1 divisi
        # sendiri) supaya cepat lihat divisi mana yang keteteran. Dikelompokkan
        # dari `tahap__divisi` (divisi produksi tempat job berjalan), BUKAN
        # `pic_staff__divisi` -- keduanya biasanya sama tapi tahap yang
        # menentukan "divisi ini yang sedang keteteran", bukan afiliasi staff.
        # Selalu dihitung (murah, 1 query agregat) -- frontend yang memilih
        # menampilkan cuma untuk role spv.
        beban_divisi = list(
            JobBoard.objects.filter(pic_staff_id__in=subordinate_ids, tahap__divisi__isnull=False)
            .values('tahap__divisi_id', 'tahap__divisi__nama')
            .annotate(
                job_aktif=Count('id', filter=Q(status_pekerjaan__in=('antrean', 'dikerjakan', 'kendala'))),
                selesai_hari_ini=Count('id', filter=Q(
                    status_pekerjaan='selesai', waktu_selesai__date=timezone.localdate(),
                )),
                kendala=Count('id', filter=Q(status_pekerjaan='kendala')),
            )
            .order_by('-job_aktif')
        )
        beban_divisi = [
            {
                'divisi_id': row['tahap__divisi_id'],
                'nama': row['tahap__divisi__nama'],
                'job_aktif': row['job_aktif'],
                'selesai_hari_ini': row['selesai_hari_ini'],
                'kendala': row['kendala'],
            }
            for row in beban_divisi
        ]

        pemakaian_mesin = list(
            PenggunaanMesin.objects.filter(operator_id__in=subordinate_ids)
            .values('mesin__nama')
            .annotate(
                jumlah_pemakaian=Count('id'),
                total_lembar_color=Sum('lembar_color'),
                total_lembar_mono=Sum('lembar_mono'),
            )
            .order_by('-jumlah_pemakaian')
        )

        return Response({
            'jumlah_anggota_tim': len(subordinate_ids) - 1,  # tidak menghitung diri sendiri
            'job_per_status': status_counts,
            'selesai_hari_ini': selesai_hari_ini,
            'job_belum_dialokasikan': job_belum_dialokasikan,
            'beban_staff': beban_staff,
            'kordiv_bawahan': kordiv_bawahan,
            'beban_divisi': beban_divisi,
            'pemakaian_mesin': pemakaian_mesin,
        })

    @action(detail=True, methods=['post'], url_path='assign-staff', permission_classes=[IsAuthenticated, IsClockedIn])
    def assign_staff(self, request, pk=None):
        """POST /api/jobs/{id}/assign-staff/ — SPV/Kordiv menugaskan job yang
        BELUM ditugaskan (pic_staff kosong) ke salah satu staff bawahannya.

        Padanan spk.resolve_staff() (dipakai /orders/{id}/assign/ untuk
        menerbitkan SPK baru) tapi untuk JobBoard yang SUDAH ada -- dibuat
        endpoint action terpisah, BUKAN lewat PATCH /api/jobs/{id}/ biasa,
        karena JobBoardSerializer.get_fields() sengaja mengunci field
        `pic_staff` jadi read-only untuk role selain owner/manager/admin
        (bersama insentif/biaya_desain/deadline, field sensitif lain) --
        mengubah itu untuk SPV/Kordiv akan ikut membuka field lain yang
        memang tidak boleh mereka ubah.
        """
        user = request.user
        if user.role not in ('spv', 'kordiv'):
            return Response(
                {'error': 'Hanya SPV/Koordinator Divisi yang dapat menugaskan job ke staff.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        job = self.get_object()  # get_queryset() sudah scope -- di luar cakupan otomatis 404
        if job.pic_staff_id:
            return Response({'error': 'Job ini sudah ditugaskan ke staff lain.'}, status=status.HTTP_400_BAD_REQUEST)

        staff_id = request.data.get('staff_id') or request.data.get('pic_staff')
        try:
            staff = CustomUser.objects.get(pk=staff_id, role='staff')
        except (CustomUser.DoesNotExist, ValueError, TypeError):
            return Response({'error': 'Staff tidak ditemukan.'}, status=status.HTTP_404_NOT_FOUND)
        if staff.pk not in get_subordinate_user_ids(user):
            return Response(
                {'error': 'Anda hanya dapat menugaskan job ke staff bawahan Anda sendiri.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        job.pic_staff = staff
        job.status_pekerjaan = 'antrean'
        job.save(update_fields=['pic_staff', 'status_pekerjaan'])

        tahap_nama = job.tahap.nama if job.tahap else "Tahap Awal"
        _catat_aktivitas_order(
            job, user, "ASSIGN_JOB",
            f"'{user.username}' menugaskan item '{job.nama_produk}' pada tahap '{tahap_nama}' ke staff '{staff.username}'"
        )

        return Response({
            'message': f'Job berhasil ditugaskan ke {staff.username}.',
            'job': JobBoardSerializer(job, context={'request': request}).data,
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated, IsClockedIn])
    def claim(self, request, pk=None):
        """POST /api/jobs/{id}/claim/ — Staff mengklaim job unassigned milik
        divisinya. SPV/Kordiv boleh klaim & kerjakan job sendiri juga sejak
        2026-09-23 (instruksi user), dicek terhadap divisi TIM bawahannya
        (get_subordinate_divisi_ids) -- bukan `user.divisi` langsung, karena
        SPV lazimnya tidak punya divisi sendiri (mengawasi beberapa
        Kordiv/divisi sekaligus) dan sebagian akun Kordiv pun belum
        ditandai divisi-nya."""
        job = self.get_object()
        user = request.user

        if job.pic_staff:
            return Response({'error': f'Job sudah diambil oleh {job.pic_staff.username}.'}, status=status.HTTP_400_BAD_REQUEST)

        if user.role in ('spv', 'kordiv'):
            divisi_ids = get_subordinate_divisi_ids(user)
            if not job.tahap or job.tahap.divisi_id not in divisi_ids:
                return Response({'error': 'Anda hanya dapat mengklaim pekerjaan dari divisi tim Anda sendiri.'}, status=status.HTTP_403_FORBIDDEN)
        elif not user.divisi or (job.tahap and job.tahap.divisi != user.divisi):
            return Response({'error': 'Anda hanya dapat mengklaim pekerjaan dari divisi Anda sendiri.'}, status=status.HTTP_403_FORBIDDEN)

        job.pic_staff = user
        job.status_pekerjaan = 'antrean'
        job.save()

        tahap_nama = job.tahap.nama if job.tahap else "Tahap Awal"
        _catat_aktivitas_order(
            job, user, "CLAIM_JOB",
            f"Staff '{user.username}' mengambil/mengklaim item '{job.nama_produk}' pada tahap '{tahap_nama}'"
        )

        return Response({
            'message': 'Pekerjaan berhasil diklaim.',
            'job': JobBoardSerializer(job).data
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated, IsClockedIn])
    def start(self, request, pk=None):
        """POST /api/jobs/{id}/start/ — Staff memulai pengerjaan job"""
        job = self.get_object()
        user = request.user
        
        if job.pic_staff != user:
            return Response({'error': 'Hanya PIC staff yang dapat memulai pekerjaan ini.'}, status=status.HTTP_403_FORBIDDEN)
            
        # ✅ Enforce transition rule: only antrean/kendala/gagal -> dikerjakan
        if job.status_pekerjaan not in ('antrean', 'kendala', 'gagal'):
            return Response(
                {'error': f"Transisi status '{job.status_pekerjaan}' → 'dikerjakan' tidak diizinkan. Pekerjaan harus dalam Antrean, Kendala, atau Gagal."},
                status=status.HTTP_400_BAD_REQUEST
            )

        job.status_pekerjaan = 'dikerjakan'
        job.waktu_mulai = timezone.now()
        job.save()

        tahap_nama = job.tahap.nama if job.tahap else "Tahap Awal"
        _catat_aktivitas_order(
            job, user, "START_JOB",
            f"Staff '{user.username}' mulai memproses pengerjaan item '{job.nama_produk}' pada tahap '{tahap_nama}'"
        )

        return Response({
            'message': 'Pekerjaan dimulai.',
            'job': JobBoardSerializer(job).data
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated, IsClockedIn])
    def complete(self, request, pk=None):
        """POST /api/jobs/{id}/complete/ — Staff menyelesaikan pengerjaan job secara langsung (bebas OTP)"""
        job = self.get_object()
        user = request.user
        
        if job.pic_staff != user:
            return Response({'error': 'Hanya PIC staff yang dapat menyelesaikan pekerjaan ini.'}, status=status.HTTP_403_FORBIDDEN)
            
        # ✅ Enforce transition rule: only dikerjakan -> selesai
        if job.status_pekerjaan != 'dikerjakan':
            return Response(
                {'error': f"Transisi status '{job.status_pekerjaan}' → 'selesai' tidak diizinkan. Pekerjaan harus berstatus 'Sedang Dikerjakan' sebelum diselesaikan."},
                status=status.HTTP_400_BAD_REQUEST
            )

        job.status_pekerjaan = 'selesai'
        job.waktu_selesai = timezone.now()
        # Reset OTP fields
        job.otp_code = ''
        job.otp_requested = False
        job.otp_sent = False
        job.save()

        tahap_nama = job.tahap.nama if job.tahap else "Tahap Awal"
        _catat_aktivitas_order(
            job, user, "COMPLETE_JOB",
            f"Staff '{user.username}' berhasil menyelesaikan pengerjaan item '{job.nama_produk}' pada tahap '{tahap_nama}'"
        )

        # Potong bahan otomatis ke inventori
        deduct_job_materials_if_needed(job, user)

        # Cek apakah seluruh job dari semua item dalam pesanan ini sudah selesai
        # — hanya berlaku untuk job dari alur order (job POS tidak punya Order induk)
        if job.order_item_id:
            order = job.order_item.order
            active_jobs_exist = JobBoard.objects.filter(
                order_item__order=order,
                status_pekerjaan__in=['antrean', 'dikerjakan', 'kendala']
            ).exists()

            if not active_jobs_exist:
                order.status_global = 'ready'
                order._current_user = user
                order.save()

                OrderActivityLog.objects.create(
                    order=order,
                    user=user,
                    tindakan="READY_ORDER",
                    keterangan="Semua item selesai diproduksi. Status pesanan diubah otomatis menjadi 'Siap Diambil'."
                )

        return Response({
            'message': 'Pekerjaan berhasil diselesaikan.',
            'job': JobBoardSerializer(job).data
        }, status=status.HTTP_200_OK)

    def update(self, request, *args, **kwargs):
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        return super().partial_update(request, *args, **kwargs)


class TahapProsesViewSet(viewsets.ModelViewSet):
    queryset = TahapProses.objects.select_related('divisi').all()
    serializer_class = TahapProsesSerializer
    permission_classes = [IsOwnerManagerAdminOrReadOnly]

    def get_queryset(self):
        qs = super().get_queryset()
        # Sama dgn DivisiViewSet: kasir hanya melihat tahap milik divisi unit bisnisnya.
        if getattr(self.request.user, 'role', None) == 'kasir':
            qs = scoped_by_unit_bisnis(qs, self.request.user, field='divisi__unit_bisnis')
        return qs
