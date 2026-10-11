"""Dinas luar staff (2026-10-11). Satu pintu aturan bisnisnya.

- Sesi foto outdoor: petugas (fotografer/asisten) wajib Mulai Dinas di lokasi
  (GPS + selfie) sebelum sesi dimulai, lalu Selesai Dinas setelahnya.
- Dinas non-sesi: hanya bila `dinas_luar_non_sesi` aktif di Pengaturan StarFoto.
- Uang transport (opsional): nominal Pengaturan StarFoto dicatat di dinas dan,
  untuk dinas sesi, ditambahkan sebagai baris insentif SPK petugas supaya ikut
  slip gaji (lewat services/insentif_pekerjaan, satu pintu insentif).
- Staff yang sedang dinas / punya sesi outdoor hari ini boleh membuka halaman
  sesi walau belum absen di kantor (geofence kantor tidak relevan saat dinas).
"""
from decimal import Decimal, InvalidOperation

from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from ..dinas_models import DinasLuar
from ..models import JobBoard
from ..starfoto_models import SesiFoto

BATAS_FOTO_BYTE = 8 * 1024 * 1024


def _koordinat(data, awalan):
    try:
        lat = Decimal(str(data.get(f'{awalan}lat'))).quantize(Decimal('0.000001'))
        lng = Decimal(str(data.get(f'{awalan}lng'))).quantize(Decimal('0.000001'))
    except (InvalidOperation, TypeError, ValueError):
        raise ValidationError({'error': 'Lokasi GPS wajib. Izinkan akses lokasi di browser HP lalu coba lagi.'})
    if not (Decimal('-90') <= lat <= Decimal('90') and Decimal('-180') <= lng <= Decimal('180')):
        raise ValidationError({'error': 'Koordinat GPS tidak valid.'})
    try:
        akurasi = int(float(data.get(f'{awalan}akurasi'))) if data.get(f'{awalan}akurasi') not in (None, '') else None
    except (TypeError, ValueError):
        akurasi = None
    return lat, lng, akurasi


def _foto(files):
    foto = files.get('foto') if files else None
    if not foto:
        raise ValidationError({'error': 'Foto selfie di lokasi wajib diambil.'})
    if foto.size > BATAS_FOTO_BYTE:
        raise ValidationError({'error': 'Ukuran foto maksimal 8 MB.'})
    if not (getattr(foto, 'content_type', '') or '').startswith('image/'):
        raise ValidationError({'error': 'File harus berupa foto.'})
    return foto


def _pengaturan():
    from .starfoto import pengaturan
    return pengaturan()


def sesi_outdoor_hari_ini(user):
    return SesiFoto.objects.filter(
        Q(fotografer=user) | Q(asisten=user), lokasi='outdoor', mulai__date=timezone.localdate(),
    ).exclude(status='batal')


def punya_akses_dinas(user):
    """True bila staff sedang dinas atau dijadwalkan sesi outdoor hari ini."""
    if not getattr(user, 'is_authenticated', False):
        return False
    return DinasLuar.objects.filter(staff=user, status='berjalan').exists() or sesi_outdoor_hari_ini(user).exists()


def _tambah_uang_transport(dinas, user):
    from ..insentif_models import InsentifPekerjaan
    from . import insentif_pekerjaan
    from .starfoto import _tahap_id_sesi

    sesi = dinas.sesi
    job = JobBoard.objects.filter(
        order_item_id=sesi.pesanan.paket_item_id, tahap_id__in=_tahap_id_sesi(), pic_staff=user,
    ).exclude(status_pekerjaan__in=['selesai', 'batal']).first()
    if job is None:
        return
    InsentifPekerjaan.objects.create(
        job=job, nama=f'Uang transport dinas luar (sesi {sesi.urutan})'[:100],
        nominal=int(dinas.uang_transport), catatan=f'Dinas luar #{dinas.pk}', dibuat_oleh=user,
    )
    insentif_pekerjaan.sinkron_total(job)


@transaction.atomic
def mulai(user, data, files):
    lat, lng, akurasi = _koordinat(data, '')
    foto = _foto(files)
    atur = _pengaturan()
    if DinasLuar.objects.select_for_update().filter(staff=user, status='berjalan').exists():
        raise ValidationError({'error': 'Masih ada dinas yang belum diselesaikan. Selesaikan dulu dinas sebelumnya.'})

    sesi = None
    tujuan = str(data.get('tujuan') or '').strip()[:200]
    alamat = str(data.get('alamat') or '').strip()[:255]
    if data.get('sesi_id'):
        sesi = SesiFoto.objects.select_for_update(of=('self',)).select_related('pesanan__order').filter(
            pk=data.get('sesi_id'),
        ).first()
        if sesi is None:
            raise ValidationError({'error': 'Sesi tidak ditemukan.'})
        if user.pk not in (sesi.fotografer_id, sesi.asisten_id):
            raise PermissionDenied('Hanya fotografer/asisten sesi ini yang dapat memulai dinas untuk sesi ini.')
        if sesi.lokasi != 'outdoor':
            raise ValidationError({'error': 'Dinas luar hanya untuk sesi outdoor.'})
        if sesi.status not in ('terjadwal', 'berlangsung') or sesi.pesanan.order.status_global == 'batal':
            raise ValidationError({'error': 'Sesi ini sudah selesai atau dibatalkan.'})
        if DinasLuar.objects.filter(staff=user, sesi=sesi).exists():
            raise ValidationError({'error': 'Dinas untuk sesi ini sudah tercatat.'})
        tujuan = tujuan or f'Sesi foto outdoor {sesi.pesanan.order.nama}'
        alamat = alamat or sesi.alamat
    else:
        if not atur['dinas_luar_non_sesi']:
            raise ValidationError({'error': 'Dinas luar di luar sesi foto belum diaktifkan di Pengaturan StarFoto.'})
        if not tujuan:
            raise ValidationError({'error': 'Tujuan dinas wajib diisi.'})

    uang = Decimal(str(atur['uang_transport_nominal'])) if atur['uang_transport'] else Decimal('0')
    dinas = DinasLuar.objects.create(
        staff=user, sesi=sesi, tujuan=tujuan, alamat=alamat, mulai_pada=timezone.now(),
        mulai_lat=lat, mulai_lng=lng, mulai_akurasi=akurasi, mulai_foto=foto, uang_transport=uang,
        catatan=str(data.get('catatan') or '')[:255],
    )
    if uang > 0 and sesi is not None:
        _tambah_uang_transport(dinas, user)
    return dinas


@transaction.atomic
def selesai(user, dinas_id, data, files):
    dinas = DinasLuar.objects.select_for_update().filter(pk=dinas_id).first()
    if dinas is None:
        raise ValidationError({'error': 'Dinas tidak ditemukan.'})
    if dinas.staff_id != user.pk:
        raise PermissionDenied('Hanya staff yang bersangkutan yang dapat menyelesaikan dinas ini.')
    if dinas.status != 'berjalan':
        raise ValidationError({'error': 'Dinas ini sudah selesai.'})
    lat, lng, akurasi = _koordinat(data, '')
    dinas.selesai_foto = _foto(files)
    dinas.selesai_pada = timezone.now()
    dinas.selesai_lat, dinas.selesai_lng, dinas.selesai_akurasi = lat, lng, akurasi
    dinas.status = 'selesai'
    dinas.save()
    return dinas


def dinas_sesi_berjalan(user, sesi):
    return DinasLuar.objects.filter(staff=user, sesi=sesi).exists()


def daftar(user, dari, sampai, staff_id=None):
    """Rekap: staff melihat miliknya; SPV/Kordiv bawahannya; owner/manager/admin semua."""
    from ..permissions import get_subordinate_user_ids

    qs = DinasLuar.objects.select_related('staff', 'sesi__pesanan__order').filter(
        mulai_pada__date__gte=dari, mulai_pada__date__lte=sampai,
    )
    if user.role in ('spv', 'kordiv'):
        qs = qs.filter(staff_id__in=get_subordinate_user_ids(user))
    elif user.role not in ('owner', 'manager', 'admin'):
        qs = qs.filter(staff=user)
    if staff_id:
        qs = qs.filter(staff_id=staff_id)
    return qs
