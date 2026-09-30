"""Rincian insentif per SPK (2026-09-30). Aturan:

- Baris otomatis dibuat dari master JenisInsentif (aktif, divisi target =
  divisi tahap SPK) saat SPK terbit. Idempotent: (job, jenis) unik, nominal
  yang sudah dikustom Manager tidak ditimpa saat SPK diterbitkan ulang.
- JobBoard.insentif = jumlah semua baris (satu-satunya angka yang dibaca
  timecard/slip gaji/kinerja HR), disinkronkan setiap ada perubahan.
- Ubah manual (tambah/ubah/hapus) hanya untuk SPK yang belum selesai --
  begitu selesai insentifnya terkunci supaya gaji yang sudah dihitung tidak
  bergeser diam-diam.
"""
from django.db import transaction
from django.db.models import Sum
from rest_framework.exceptions import ValidationError

from ..insentif_models import InsentifPekerjaan, JenisInsentif
from ..models import JobBoard

NAMA_MANUAL = 'Insentif manual'
PESAN_TERKUNCI = 'SPK ini sudah selesai, insentifnya terkunci dan tidak bisa diubah lagi.'


def sinkron_total(job):
    total = job.rincian_insentif.aggregate(t=Sum('nominal'))['t'] or 0
    if job.insentif != total:
        JobBoard.objects.filter(pk=job.pk).update(insentif=total)
        job.insentif = total
    return total


def _pastikan_bisa_diubah(job):
    if job.status_pekerjaan == 'selesai':
        raise ValidationError({'error': PESAN_TERKUNCI})


@transaction.atomic
def terapkan_otomatis(job):
    """Tambahkan baris insentif dari master untuk divisi tahap SPK ini."""
    divisi_id = job.tahap.divisi_id if job.tahap_id else None
    if divisi_id:
        for jenis in JenisInsentif.objects.filter(aktif=True, divisi__id=divisi_id):
            InsentifPekerjaan.objects.get_or_create(
                job=job, jenis=jenis,
                defaults={'nama': jenis.nama, 'nominal': jenis.nominal_default, 'otomatis': True},
            )
    return sinkron_total(job)


@transaction.atomic
def set_baris_manual(job, nominal, user=None):
    """Satu baris 'Insentif manual' (nominal 0 = hapus). Dipakai jalur lama
    yang mengirim satu angka insentif (penerbitan SPK, ubah insentif SPK)."""
    nominal = max(0, int(nominal or 0))
    qs = job.rincian_insentif.filter(jenis__isnull=True, otomatis=False, nama=NAMA_MANUAL)
    baris = qs.first()
    if nominal == 0:
        qs.delete()
    elif baris:
        if baris.nominal != nominal:
            baris.nominal = nominal
            baris.save(update_fields=['nominal', 'diubah_pada'])
    else:
        InsentifPekerjaan.objects.create(job=job, nama=NAMA_MANUAL, nominal=nominal, dibuat_oleh=user)
    return sinkron_total(job)


@transaction.atomic
def atur_total(job, total, user=None):
    """Jalur lama 'ubah insentif' (satu angka total): baris manual diatur
    sehingga total SPK = angka itu; baris otomatis tidak disentuh. Kalau
    baris otomatis saja sudah melebihi total, total mengikuti baris otomatis."""
    _pastikan_bisa_diubah(job)
    lain = job.rincian_insentif.exclude(nama=NAMA_MANUAL, jenis__isnull=True, otomatis=False).aggregate(t=Sum('nominal'))['t'] or 0
    return set_baris_manual(job, max(0, int(total or 0) - lain), user)


def _angka(nominal):
    try:
        nilai = int(nominal)
    except (TypeError, ValueError):
        raise ValidationError({'nominal': 'Nominal harus berupa angka.'})
    if nilai < 0:
        raise ValidationError({'nominal': 'Nominal tidak boleh negatif.'})
    return nilai


@transaction.atomic
def tambah(job, user, *, jenis_id=None, nama='', nominal=None, catatan=''):
    _pastikan_bisa_diubah(job)
    jenis = None
    if jenis_id:
        jenis = JenisInsentif.objects.filter(pk=jenis_id, aktif=True).first()
        if not jenis:
            raise ValidationError({'jenis_id': 'Jenis insentif tidak ditemukan atau tidak aktif.'})
        if job.rincian_insentif.filter(jenis=jenis).exists():
            raise ValidationError({'jenis_id': f"Jenis '{jenis.nama}' sudah ada di SPK ini."})
        nama = jenis.nama
        if nominal in (None, ''):
            nominal = jenis.nominal_default
    nama = str(nama or '').strip()
    if not nama:
        raise ValidationError({'nama': 'Nama insentif wajib diisi.'})
    baris = InsentifPekerjaan.objects.create(
        job=job, jenis=jenis, nama=nama[:100], nominal=_angka(nominal),
        catatan=str(catatan or '')[:255], dibuat_oleh=user,
    )
    sinkron_total(job)
    return baris


@transaction.atomic
def ubah(baris, *, nominal=None, catatan=None):
    _pastikan_bisa_diubah(baris.job)
    if nominal is not None:
        baris.nominal = _angka(nominal)
    if catatan is not None:
        baris.catatan = str(catatan)[:255]
    baris.save()
    sinkron_total(baris.job)
    return baris


@transaction.atomic
def hapus(baris):
    job = baris.job
    _pastikan_bisa_diubah(job)
    baris.delete()
    sinkron_total(job)
