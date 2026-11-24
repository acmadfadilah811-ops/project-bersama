"""Bagi sisa qty SPK ke operator lain (2026-11-24).

Kasus: order dengan qty besar tidak bisa dikerjakan satu operator dalam satu
waktu, jadi sisanya dilimpahkan ke operator lain. Operator yang sedang
mengerjakan job (`dikerjakan`) membagi sebagian qty-nya -- job asal
menyusut qty-nya, dan sebuah JobBoard baru (tahap & sumber yang SAMA, status
'antrean') dibuat untuk operator tujuan. Insentif tetap lewat jalur yang
sudah ada (services/insentif_pekerjaan) -- job baru otomatis dapat baris
insentifnya sendiri lewat signal post_save JobBoard; job asal yang qty-nya
menyusut di-resinkron supaya baris otomatis qty/m2-nya ikut prorata, tidak
dobel (lihat insentif_pekerjaan.resinkron_qty).
"""
from decimal import Decimal, InvalidOperation

from django.db import transaction
from rest_framework.exceptions import ValidationError

from ..models import JobBoard
from . import insentif_pekerjaan


def _qty_saat_ini(job):
    """Qty yang masih ditanggung job ini -- qty_dikerjakan bila sudah pernah
    dibagi, atau qty penuh item sumbernya kalau belum."""
    if job.qty_dikerjakan is not None:
        return job.qty_dikerjakan
    item = job.order_item or job.pos_sale_item
    return Decimal(str(item.qty or 0)) if item else Decimal('0')


def _operator_valid(job, operator, user):
    if operator.pk == user.pk:
        raise ValidationError({'error': 'Tidak bisa membagi pekerjaan ke diri sendiri.'})
    if operator.role != 'staff':
        raise ValidationError({'error': 'Operator tujuan harus staff.'})
    if not job.tahap_id or operator.divisi_id != job.tahap.divisi_id:
        raise ValidationError({'error': 'Operator tujuan harus dari divisi yang sama dengan tahap SPK ini.'})


@transaction.atomic
def bagi_ke_operator(job, operator, qty_pindah, user):
    if job.status_pekerjaan != 'dikerjakan':
        raise ValidationError({'error': "Hanya SPK yang sedang 'Dikerjakan' yang bisa dibagi ke operator lain."})
    if job.pic_staff_id != user.pk:
        raise ValidationError({'error': 'Hanya operator yang mengerjakan SPK ini yang bisa membaginya.'})
    _operator_valid(job, operator, user)

    try:
        qty_pindah = Decimal(str(qty_pindah))
    except (InvalidOperation, TypeError, ValueError):
        raise ValidationError({'error': 'Qty yang dipindah harus berupa angka.'})
    if qty_pindah <= 0:
        raise ValidationError({'error': 'Qty yang dipindah harus lebih dari 0.'})

    qty_sekarang = _qty_saat_ini(job)
    if qty_pindah >= qty_sekarang:
        raise ValidationError({
            'error': f'Qty yang dipindah ({qty_pindah}) harus kurang dari qty SPK ini saat ini ({qty_sekarang}). '
                     'Kalau ingin menyerahkan seluruh pekerjaan, gunakan alur Teruskan/Forward biasa.',
        })

    job = JobBoard.objects.select_for_update(of=('self',)).get(pk=job.pk)
    job.qty_dikerjakan = qty_sekarang - qty_pindah
    job.save(update_fields=['qty_dikerjakan'])
    insentif_pekerjaan.resinkron_qty(job)

    job_baru = JobBoard.objects.create(
        order_item=job.order_item, pos_sale_item=job.pos_sale_item, tahap=job.tahap,
        pic_staff=operator, status_pekerjaan='antrean', qty_dikerjakan=qty_pindah,
        deadline=job.deadline, deadline_jam=job.deadline_jam,
    )
    return job, job_baru
