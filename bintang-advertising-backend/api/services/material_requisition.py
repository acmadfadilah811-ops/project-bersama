"""Logika Permintaan Bahan (Material Requisition): Kordiv/SPV -> persetujuan ->
gudang menyiapkan -> pemohon menerima. View hanya memanggil fungsi di sini.

TIDAK mengubah stok (InventoryItem.stok) maupun jurnal -- lihat requisition_models.py.

Siapa boleh apa:
- Mengajukan : kordiv, spv (manager/owner boleh atas nama sendiri).
- Menyetujui/menolak : owner & manager (semua); SPV hanya utk permintaan BAWAHANNYA
  (bukan miliknya sendiri) -- pola sama dgn scoping Papan Kerja (get_subordinate_user_ids).
- Menyiapkan : admin (gudang), manager, owner.
- Menerima : pemohon sendiri.
- Membatalkan: pemohon (selama masih 'diajukan'); owner/manager (sebelum diterima).
"""

from decimal import Decimal, InvalidOperation

from django.db import IntegrityError, transaction
from django.utils import timezone

from api.models import InventoryItem, JobBoard, MaterialRequisition, MaterialRequisitionItem
from api.permissions import get_subordinate_user_ids

MAKS_ITEM = 30
ROLE_PEMOHON = ('kordiv', 'spv', 'manager', 'owner')
ROLE_GUDANG = ('admin', 'manager', 'owner')
ROLE_LIHAT_SEMUA = ('owner', 'manager', 'admin')
ROLE_BOLEH_AKSES = ('owner', 'manager', 'admin', 'spv', 'kordiv')
STATUS_AKTIF = ('diajukan', 'disetujui', 'disiapkan')


class RequisitionError(Exception):
    """Aturan alur dilanggar (status salah, qty tidak valid, dsb) -> HTTP 400."""


class RequisitionForbidden(Exception):
    """Pengguna tidak berhak melakukan aksi ini -> HTTP 403."""


def _role(user):
    return getattr(user, 'role', '')


def queryset_untuk(user):
    """Permintaan yang boleh DILIHAT pengguna (scoping di sisi server)."""
    qs = MaterialRequisition.objects.select_related(
        'pemohon', 'divisi', 'job', 'disetujui_oleh', 'disiapkan_oleh',
    ).prefetch_related('items__item')
    role = _role(user)
    if role in ROLE_LIHAT_SEMUA:
        return qs
    if role == 'spv':
        return qs.filter(pemohon_id__in=get_subordinate_user_ids(user))
    if role == 'kordiv':
        return qs.filter(pemohon=user)
    return qs.none()


def boleh_menyetujui(user, req):
    role = _role(user)
    # Pemisahan tugas: tak seorang pun menyetujui permintaannya sendiri (kecuali Owner).
    if req.pemohon_id == user.id and role != 'owner':
        return False
    if role in ('owner', 'manager'):
        return True
    if role == 'spv':
        return req.pemohon_id in get_subordinate_user_ids(user)
    return False


def _ke_decimal(nilai, nama):
    try:
        d = Decimal(str(nilai).replace(',', '.'))
    except (InvalidOperation, ValueError, TypeError):
        raise RequisitionError(f'Qty untuk {nama} tidak valid.')
    if d.is_nan() or d.is_infinite():
        raise RequisitionError(f'Qty untuk {nama} tidak valid.')
    return d


def _nomor_baru():
    prefix = f"MR{timezone.localdate().strftime('%y%m%d')}-"
    last = MaterialRequisition.objects.filter(nomor__startswith=prefix).order_by('-nomor').first()
    urut = 1
    if last:
        try:
            urut = int(last.nomor[len(prefix):]) + 1
        except ValueError:
            urut = 1
    return f'{prefix}{urut:04d}'


def _ambil_terkunci(req_id):
    try:
        return MaterialRequisition.objects.select_for_update().get(pk=req_id)
    except MaterialRequisition.DoesNotExist:
        raise RequisitionError('Permintaan tidak ditemukan.')


def buat_permintaan(user, *, keperluan='', items=None, job_id=None):
    if _role(user) not in ROLE_PEMOHON:
        raise RequisitionForbidden('Hanya Kordiv atau SPV yang dapat mengajukan permintaan bahan.')
    items = items or []
    if not items:
        raise RequisitionError('Tambahkan minimal satu bahan.')
    if len(items) > MAKS_ITEM:
        raise RequisitionError(f'Maksimal {MAKS_ITEM} bahan per permintaan.')

    baris = []
    dilihat = set()
    for entri in items:
        item_id = str((entri or {}).get('item_id') or '').strip()
        if not item_id:
            raise RequisitionError('Setiap baris wajib memilih bahan.')
        if item_id in dilihat:
            raise RequisitionError('Satu bahan hanya boleh muncul sekali per permintaan.')
        dilihat.add(item_id)
        qty = _ke_decimal(entri.get('qty'), item_id)
        if qty <= 0:
            raise RequisitionError('Qty harus lebih besar dari 0.')
        baris.append((item_id, qty, str(entri.get('catatan') or '').strip()[:255]))

    bahan = {b.id: b for b in InventoryItem.objects.filter(pk__in=[b[0] for b in baris])}
    hilang = [b[0] for b in baris if b[0] not in bahan]
    if hilang:
        raise RequisitionError(f"Bahan tidak ditemukan: {', '.join(hilang)}.")

    job = None
    if job_id:
        job = JobBoard.objects.filter(pk=job_id).first()
        if not job:
            raise RequisitionError('Pekerjaan terkait tidak ditemukan.')

    for percobaan in range(5):
        try:
            with transaction.atomic():
                req = MaterialRequisition.objects.create(
                    nomor=_nomor_baru(), pemohon=user, divisi=user.divisi, job=job,
                    keperluan=(keperluan or '').strip(),
                )
                MaterialRequisitionItem.objects.bulk_create([
                    MaterialRequisitionItem(requisition=req, item=bahan[i], qty_diminta=q, catatan=c)
                    for i, q, c in baris
                ])
            return req
        except IntegrityError:
            # Dua permintaan bersamaan dapat nomor yang sama -> coba lagi dgn nomor baru.
            if percobaan == 4:
                raise
    return req  # pragma: no cover


def _qty_per_item(req, peta, dasar, nama_dasar):
    """Kembalikan {item_row.id: Decimal}: nilai dari `peta` (item_id -> qty) atau
    default `dasar`(row); wajib 0 <= qty <= batas."""
    hasil = {}
    peta = {str(k): v for k, v in (peta or {}).items()}
    for row in req.items.all():
        batas = dasar(row)
        qty = _ke_decimal(peta[row.item_id], row.item_id) if row.item_id in peta else batas
        if qty < 0 or qty > batas:
            raise RequisitionError(
                f'Qty {row.item.nama} harus antara 0 dan {batas.normalize():f} ({nama_dasar}).'
            )
        hasil[row.id] = qty
    return hasil


@transaction.atomic
def setujui(req_id, user, qty_disetujui=None):
    req = _ambil_terkunci(req_id)
    if req.status != 'diajukan':
        raise RequisitionError('Hanya permintaan berstatus Diajukan yang dapat disetujui.')
    if not boleh_menyetujui(user, req):
        raise RequisitionForbidden('Anda tidak berwenang menyetujui permintaan ini.')

    per_baris = _qty_per_item(req, qty_disetujui, lambda r: r.qty_diminta, 'qty diminta')
    if not any(q > 0 for q in per_baris.values()):
        raise RequisitionError('Semua qty 0 -- gunakan Tolak bila permintaan tidak dipenuhi.')
    for row in req.items.all():
        row.qty_disetujui = per_baris[row.id]
        row.save(update_fields=['qty_disetujui'])
    req.status = 'disetujui'
    req.disetujui_oleh = user
    req.disetujui_pada = timezone.now()
    req.save(update_fields=['status', 'disetujui_oleh', 'disetujui_pada', 'updated_at'])
    return req


@transaction.atomic
def tolak(req_id, user, alasan):
    req = _ambil_terkunci(req_id)
    if req.status != 'diajukan':
        raise RequisitionError('Hanya permintaan berstatus Diajukan yang dapat ditolak.')
    if not boleh_menyetujui(user, req):
        raise RequisitionForbidden('Anda tidak berwenang menolak permintaan ini.')
    alasan = (alasan or '').strip()
    if not alasan:
        raise RequisitionError('Alasan penolakan wajib diisi.')
    req.status = 'ditolak'
    req.catatan_penolakan = alasan
    req.disetujui_oleh = user
    req.disetujui_pada = timezone.now()
    req.save(update_fields=['status', 'catatan_penolakan', 'disetujui_oleh', 'disetujui_pada', 'updated_at'])
    return req


@transaction.atomic
def siapkan(req_id, user, qty_disiapkan=None):
    """Gudang menandai bahan sudah disiapkan. Mengembalikan (req, peringatan_stok):
    peringatan hanya informasi (stok tercatat < qty disiapkan) -- TIDAK memblokir
    dan TIDAK mengubah stok."""
    req = _ambil_terkunci(req_id)
    if req.status != 'disetujui':
        raise RequisitionError('Hanya permintaan berstatus Disetujui yang dapat disiapkan.')
    if _role(user) not in ROLE_GUDANG:
        raise RequisitionForbidden('Hanya gudang (Admin) yang dapat menyiapkan bahan.')

    per_baris = _qty_per_item(req, qty_disiapkan, lambda r: r.qty_disetujui or Decimal('0'), 'qty disetujui')
    peringatan = []
    for row in req.items.select_related('item'):
        row.qty_disiapkan = per_baris[row.id]
        row.save(update_fields=['qty_disiapkan'])
        stok = Decimal(str(row.item.stok))
        if row.qty_disiapkan > stok:
            peringatan.append({
                'item_id': row.item_id, 'nama': row.item.nama, 'satuan': row.item.satuan,
                'disiapkan': str(row.qty_disiapkan), 'stok_tercatat': str(stok),
            })
    req.status = 'disiapkan'
    req.disiapkan_oleh = user
    req.disiapkan_pada = timezone.now()
    req.save(update_fields=['status', 'disiapkan_oleh', 'disiapkan_pada', 'updated_at'])
    return req, peringatan


@transaction.atomic
def terima(req_id, user):
    req = _ambil_terkunci(req_id)
    if req.status != 'disiapkan':
        raise RequisitionError('Hanya permintaan berstatus Disiapkan yang dapat diterima.')
    if req.pemohon_id != user.id:
        raise RequisitionForbidden('Hanya pemohon yang dapat menandai bahan sudah diterima.')
    req.status = 'diterima'
    req.diterima_pada = timezone.now()
    req.save(update_fields=['status', 'diterima_pada', 'updated_at'])
    return req


@transaction.atomic
def batalkan(req_id, user):
    req = _ambil_terkunci(req_id)
    role = _role(user)
    if role in ('owner', 'manager'):
        boleh_status = STATUS_AKTIF
    elif req.pemohon_id == user.id:
        boleh_status = ('diajukan',)
    else:
        raise RequisitionForbidden('Anda tidak berwenang membatalkan permintaan ini.')
    if req.status not in boleh_status:
        raise RequisitionError('Permintaan pada status ini tidak dapat dibatalkan.')
    req.status = 'batal'
    req.save(update_fields=['status', 'updated_at'])
    return req


def aksi_untuk(user, req):
    """Aksi yang boleh dilakukan `user` pada `req` saat ini -- sumber kebenaran tunggal
    yang dipakai UI untuk menampilkan tombol (aturan TIDAK diduplikasi di frontend)."""
    role = _role(user)
    aksi = []
    if req.status == 'diajukan' and boleh_menyetujui(user, req):
        aksi += ['setujui', 'tolak']
    if req.status == 'disetujui' and role in ROLE_GUDANG:
        aksi.append('siapkan')
    if req.status == 'disiapkan' and req.pemohon_id == user.id:
        aksi.append('terima')
    if (role in ('owner', 'manager') and req.status in STATUS_AKTIF) or (
            req.pemohon_id == user.id and req.status == 'diajukan'):
        aksi.append('batalkan')
    return aksi


def ringkasan(user):
    """Angka utk badge/notifikasi -- menghitung HANYA yang menuntut tindakan pengguna ini."""
    role = _role(user)
    data = {'menunggu_persetujuan': 0, 'menunggu_disiapkan': 0, 'siap_diterima': 0}
    if role in ('owner', 'manager'):
        data['menunggu_persetujuan'] = MaterialRequisition.objects.filter(status='diajukan').count()
    elif role == 'spv':
        bawahan = get_subordinate_user_ids(user) - {user.id}
        data['menunggu_persetujuan'] = MaterialRequisition.objects.filter(
            status='diajukan', pemohon_id__in=bawahan).count()
    if role in ROLE_GUDANG:
        data['menunggu_disiapkan'] = MaterialRequisition.objects.filter(status='disetujui').count()
    if role in ROLE_PEMOHON:
        data['siap_diterima'] = MaterialRequisition.objects.filter(status='disiapkan', pemohon=user).count()
    data['total'] = sum(data.values())
    return data
