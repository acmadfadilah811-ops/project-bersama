"""Pengembalian pekerjaan ke tahap sebelumnya (PRD-05 UAT, 2026-09-29).

Alur:
  1. Divisi berikutnya (mis. Operator) `ajukan()` -- alasan wajib. Job pengaju
     jadi 'kendala' (terkunci: tidak bisa dimulai selama menunggu).
  2. Staff tujuan (PIC tahap sebelumnya, mis. staff Editor) `terima()` atau
     `tolak()` -- TANPA persetujuan Kordiv/SPV (revisi 2026-09-29: terlalu
     berbelit). Cadangan bila PIC belum ada/berhalangan: staff lain di divisi
     tujuan (kalau job tujuan tanpa PIC), Kordiv/SPV divisi itu, atau
     owner/manager/admin.
     - terima: job tahap sebelumnya dibuka lagi ('antrean', alasan masuk ke
       catatan staff) dan job pengaju kembali 'antrean' (tetap tertahan
       aturan PRD-04 sampai tahap sebelumnya selesai lagi).
     - tolak : job pengaju kembali 'antrean' dan lanjut dikerjakan; alasan
       penolakan tercatat.
Setiap langkah tercatat di log aktivitas order.
"""
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from ..models import JobBoard, OrderActivityLog
from ..pengembalian_job_models import PengembalianJob
from ..permissions import get_subordinate_divisi_ids, get_subordinate_user_ids

STATUS_BOLEH_DIKEMBALIKAN = ('antrean', 'dikerjakan', 'kendala')
ROLE_BEBAS = ('owner', 'manager', 'admin')


def _catat(job, user, tindakan, keterangan):
    if not job.order_item_id:
        return  # job POS tidak punya Order induk untuk log
    OrderActivityLog.objects.create(
        order=job.order_item.order, user=user, tindakan=tindakan, keterangan=keterangan,
    )


def _saudara(job):
    if job.order_item_id:
        return JobBoard.objects.filter(order_item_id=job.order_item_id)
    return JobBoard.objects.filter(pos_sale_item_id=job.pos_sale_item_id)


def job_tahap_sebelumnya(job):
    """Job tahap terdekat SEBELUM `job` pada item yang sama, atau None."""
    if not job.tahap_id:
        return None
    return (
        _saudara(job).filter(tahap__urutan__lt=job.tahap.urutan)
        .select_related('tahap', 'tahap__divisi')
        .order_by('-tahap__urutan', '-id')
        .first()
    )


def menunggu_untuk(job):
    return PengembalianJob.objects.filter(job=job, status=PengembalianJob.Status.MENUNGGU).first()


def boleh_mengajukan(user, job):
    if user.role in ROLE_BEBAS:
        return True
    if user.role == 'staff':
        return job.pic_staff_id == user.id
    if user.role in ('spv', 'kordiv'):
        return bool(job.pic_staff_id) and job.pic_staff_id in get_subordinate_user_ids(user)
    return False


def boleh_memutuskan(user, pengembalian):
    """Penerima utama: staff PIC job tahap tujuan. Cadangan: staff divisi
    tujuan bila job tujuan tanpa PIC; SPV/Kordiv yang divisi timnya mencakup
    divisi tujuan; owner/manager/admin."""
    if user.role in ROLE_BEBAS:
        return True
    tujuan = pengembalian.job_tujuan
    if tujuan.pic_staff_id:
        if tujuan.pic_staff_id == user.id:
            return True
    elif user.role == 'staff' and tujuan.tahap_id and user.divisi_id == tujuan.tahap.divisi_id:
        return True
    if user.role in ('spv', 'kordiv'):
        return bool(tujuan.tahap_id) and tujuan.tahap.divisi_id in get_subordinate_divisi_ids(user)
    return False


def queryset_untuk_penerima(user):
    """Permintaan yang boleh diputuskan `user` (semua bila owner/manager/admin)."""
    qs = PengembalianJob.objects.select_related(
        'job__tahap', 'job_tujuan__tahap__divisi', 'diajukan_oleh',
    )
    if user.role in ROLE_BEBAS:
        return qs
    kondisi = Q(job_tujuan__pic_staff=user)
    if user.role == 'staff' and user.divisi_id:
        kondisi |= Q(job_tujuan__pic_staff__isnull=True, job_tujuan__tahap__divisi_id=user.divisi_id)
    if user.role in ('spv', 'kordiv'):
        kondisi |= Q(job_tujuan__tahap__divisi_id__in=get_subordinate_divisi_ids(user))
    return qs.filter(kondisi)


@transaction.atomic
def ajukan(user, job, alasan):
    alasan = (alasan or '').strip()
    if not alasan:
        raise ValidationError({'alasan': 'Alasan pengembalian wajib diisi.'})
    if not boleh_mengajukan(user, job):
        raise PermissionDenied('Anda tidak memiliki akses ke job ini.')
    job = JobBoard.objects.select_for_update(of=('self',)).get(pk=job.pk)
    if job.status_pekerjaan not in STATUS_BOLEH_DIKEMBALIKAN:
        raise ValidationError({'error': f"Job berstatus '{job.status_pekerjaan}' tidak bisa dikembalikan."})
    if menunggu_untuk(job):
        raise ValidationError({'error': 'Pengembalian job ini masih menunggu keputusan divisi tujuan.'})
    tujuan = job_tahap_sebelumnya(job)
    if not tujuan:
        raise ValidationError({'error': 'Tidak ada tahap sebelumnya untuk item ini.'})

    pengembalian = PengembalianJob.objects.create(
        job=job, job_tujuan=tujuan, alasan=alasan, diajukan_oleh=user,
    )
    job.status_pekerjaan = 'kendala'
    job.save(update_fields=['status_pekerjaan'])
    _catat(
        job, user, 'RETURN_REQUEST',
        f"Pengembalian '{job.nama_produk}' ke tahap '{tujuan.tahap.nama}' diajukan oleh "
        f"'{user.username}'. Alasan: {alasan}",
    )
    return pengembalian


def _ambil_menunggu(user, pk):
    try:
        pengembalian = PengembalianJob.objects.select_for_update().get(pk=pk)
    except PengembalianJob.DoesNotExist:
        raise ValidationError({'error': 'Permintaan pengembalian tidak ditemukan.'})
    if pengembalian.status != PengembalianJob.Status.MENUNGGU:
        raise ValidationError({'error': f"Permintaan ini sudah {pengembalian.get_status_display().lower()}."})
    if not boleh_memutuskan(user, pengembalian):
        raise PermissionDenied('Hanya staff tujuan (PIC tahap sebelumnya) yang dapat memutuskan pengembalian ini.')
    return pengembalian


def _tutup(pengembalian, user, status, catatan):
    pengembalian.status = status
    pengembalian.diputuskan_oleh = user
    pengembalian.diputuskan_pada = timezone.now()
    pengembalian.catatan_keputusan = (catatan or '').strip()
    pengembalian.save()


@transaction.atomic
def terima(user, pk, catatan=''):
    pengembalian = _ambil_menunggu(user, pk)
    job, tujuan = pengembalian.job, pengembalian.job_tujuan

    # Buka lagi tahap sebelumnya; alasan ikut ke catatan staff supaya terbaca
    # di layar kerjanya.
    catatan_lama = tujuan.catatan_staff if isinstance(tujuan.catatan_staff, list) else []
    tujuan.catatan_staff = catatan_lama + [{
        'keterangan': f"--- Dikembalikan dari tahap: {job.tahap.nama if job.tahap else '-'} ---",
        'qty': '-', 'satuan': '-',
        'catatan': f"Alasan: {pengembalian.alasan}",
        'gdrive_link': '',
    }]
    tujuan.status_pekerjaan = 'antrean'
    tujuan.waktu_mulai = None
    tujuan.waktu_selesai = None
    tujuan.otp_code = ''
    tujuan.otp_requested = False
    tujuan.otp_sent = False
    tujuan.save()

    job.status_pekerjaan = 'antrean'
    job.waktu_mulai = None
    job.save(update_fields=['status_pekerjaan', 'waktu_mulai'])

    _tutup(pengembalian, user, PengembalianJob.Status.DITERIMA, catatan)
    _catat(
        tujuan, user, 'RETURN_ACCEPT',
        f"Pengembalian '{tujuan.nama_produk}' diterima '{user.username}': tahap "
        f"'{tujuan.tahap.nama}' dibuka lagi. Alasan: {pengembalian.alasan}",
    )
    return pengembalian


@transaction.atomic
def tolak(user, pk, catatan=''):
    catatan = (catatan or '').strip()
    if not catatan:
        raise ValidationError({'catatan': 'Alasan penolakan wajib diisi.'})
    pengembalian = _ambil_menunggu(user, pk)
    job = pengembalian.job
    job.status_pekerjaan = 'antrean'
    job.save(update_fields=['status_pekerjaan'])
    _tutup(pengembalian, user, PengembalianJob.Status.DITOLAK, catatan)
    _catat(
        job, user, 'RETURN_REJECT',
        f"Pengembalian '{job.nama_produk}' ditolak '{user.username}'. Alasan: {catatan}",
    )
    return pengembalian
