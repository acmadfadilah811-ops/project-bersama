"""Approval hasil edit StarFoto oleh pelanggan lewat tautan WA (2026-10-11).

Alur: kasir konfirmasi -> SPK Edit -> editor unggah pratinjau (diberi watermark
server) -> "Kirim ke Pelanggan" menutup SPK Edit & mengirim tautan WA ->
pelanggan (tanpa login) menyetujui / minta revisi per foto ->
  - semua setuju  -> SPK Cetak terbit ke Operator
  - ada revisi    -> SPK Edit dibuka lagi untuk editor yang sama (batas revisi
                     di Pengaturan StarFoto)
Pelanggan tidak merespons > N jam -> muncul di daftar tertunda (lonceng kasir)
supaya staff menindaklanjuti / menyetujui atas nama pelanggan.
"""
import io
import logging
import os

from django.core import signing
from django.core.files.base import ContentFile
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from .. import spk
from ..models import JobBoard, OrderActivityLog
from ..starfoto_models import PesananFoto, PilihanFile, PratinjauEdit

logger = logging.getLogger(__name__)

SALT = 'approval-foto-v1'
BATAS_FOTO_BYTE = 15 * 1024 * 1024
ROLE_PENGELOLA = ('owner', 'manager', 'admin')
ROLE_KASIR = ('owner', 'manager', 'admin', 'kasir')


class TokenTidakValid(Exception):
    pass


# ---------------------------------------------------------------- utilitas
def _pengaturan():
    from .starfoto import pengaturan
    return pengaturan()


def _tahap(kunci, label):
    from .starfoto import _tahap as tahap
    return tahap(kunci, label)


def beri_watermark(berkas):
    """JPEG maks 1600px dengan teks 'STARFOTO · PRATINJAU' diagonal berulang."""
    from PIL import Image, ImageDraw, ImageFont, ImageOps

    try:
        img = ImageOps.exif_transpose(Image.open(berkas)).convert('RGB')
    except Exception:
        raise ValidationError({'error': 'File bukan gambar yang valid.'})
    img.thumbnail((1600, 1600))
    lapisan = Image.new('RGBA', img.size, (0, 0, 0, 0))
    gambar = ImageDraw.Draw(lapisan)
    ukuran = max(18, img.width // 22)
    try:
        huruf = ImageFont.load_default(size=ukuran)
    except TypeError:
        huruf = ImageFont.load_default()
    teks = 'STARFOTO · PRATINJAU'
    langkah_x, langkah_y = ukuran * 14, ukuran * 5
    for y in range(-img.height, img.height * 2, langkah_y):
        for x in range(-img.width, img.width * 2, langkah_x):
            gambar.text((x + (y // langkah_y % 2) * langkah_x // 2, y), teks, font=huruf, fill=(255, 255, 255, 90))
    lapisan = lapisan.rotate(25, resample=Image.BICUBIC)
    hasil = Image.alpha_composite(img.convert('RGBA'), lapisan).convert('RGB')
    keluaran = io.BytesIO()
    hasil.save(keluaran, 'JPEG', quality=80)
    return ContentFile(keluaran.getvalue(), name='pratinjau.jpg')


def buang_berkas_pratinjau(qs):
    """Hapus file pratinjau dari server; barisnya tetap (riwayat keputusan &
    catatan pelanggan). Foto asli hasil edit ada di PC editor, server hanya
    perlu pratinjau selama pelanggan belum memutuskan (2026-10-15).
    File baru dihapus setelah transaksi tersimpan."""
    jumlah = 0
    for foto in qs.exclude(berkas=''):
        nama, storage = foto.berkas.name, foto.berkas.storage
        PratinjauEdit.objects.filter(pk=foto.pk).update(berkas='')
        transaction.on_commit(lambda nama=nama, storage=storage: storage.delete(nama))
        jumlah += 1
    return jumlah


def buat_token(pesanan):
    return signing.dumps({'p': pesanan.pk, 'r': pesanan.approval_putaran}, salt=SALT, compress=True)


def baca_token(token):
    hari = max(1, _pengaturan()['masa_link_hari'] or 7)
    try:
        data = signing.loads(token, salt=SALT, max_age=hari * 86400)
    except signing.SignatureExpired:
        raise TokenTidakValid('Tautan sudah kedaluwarsa. Hubungi kami untuk tautan baru.')
    except signing.BadSignature:
        raise TokenTidakValid('Tautan tidak valid.')
    pesanan = PesananFoto.objects.select_related('order', 'paket_item').filter(pk=data.get('p')).first()
    if pesanan is None:
        raise TokenTidakValid('Pesanan tidak ditemukan.')
    return pesanan, data.get('r')


def url_approval(pesanan):
    from .resi_digital import DEFAULT_PUBLIC_URL
    dasar = os.getenv('ERP_PUBLIC_URL', DEFAULT_PUBLIC_URL).rstrip('/')
    return f'{dasar}/approval-foto/{buat_token(pesanan)}'


def _job(pesanan, kunci):
    tahap_id = _pengaturan()[kunci]
    return JobBoard.objects.filter(order_item_id=pesanan.paket_item_id, tahap_id=tahap_id).order_by('-id').first()


def _boleh_edit(user, pesanan):
    if user.role in ROLE_PENGELOLA:
        return True
    job = _job(pesanan, 'tahap_edit_id')
    if job and job.pic_staff_id == user.pk:
        return True
    tahap = _tahap('tahap_edit_id', 'Edit')
    return user.role in ('staff', 'spv', 'kordiv') and user.divisi_id == tahap.divisi_id


def _putaran_draf(pesanan):
    return pesanan.approval_putaran + (0 if pesanan.approval_status == 'menunggu' else 1)


def batas_revisi():
    return _pengaturan()['batas_revisi']


def revisi_terpakai(pesanan):
    return max(0, pesanan.approval_putaran - 1)


# ---------------------------------------------------------------- editor
def antrean_edit(user):
    """Pesanan foto yang menunggu hasil edit (baru / revisi) untuk divisi editor."""
    qs = PesananFoto.objects.select_related('order', 'paket_item__product__paket_foto').prefetch_related(
        'pilihan_file', 'pratinjau',
    ).filter(status='dikonfirmasi', approval_status__in=['', 'revisi']).exclude(order__status_global='batal')
    tahap_id = _pengaturan()['tahap_edit_id']
    aktif = JobBoard.objects.filter(tahap_id=tahap_id, status_pekerjaan__in=['antrean', 'dikerjakan', 'kendala'])
    if user.role not in ROLE_PENGELOLA:
        aktif = aktif.filter(pic_staff=user) | aktif.filter(pic_staff__isnull=True)
    return qs.filter(paket_item_id__in=aktif.values('order_item_id')).order_by('dikonfirmasi_pada')


@transaction.atomic
def unggah_pratinjau(pesanan_id, user, berkas, pilihan_file_id=None):
    pesanan = PesananFoto.objects.select_for_update().get(pk=pesanan_id)
    if not _boleh_edit(user, pesanan):
        raise PermissionDenied('Hanya editor yang dapat mengunggah pratinjau.')
    if pesanan.status != 'dikonfirmasi' or pesanan.approval_status not in ('', 'revisi'):
        raise ValidationError({'error': 'Pesanan ini tidak sedang menunggu hasil edit.'})
    if not berkas:
        raise ValidationError({'error': 'Pilih foto hasil edit.'})
    if berkas.size > BATAS_FOTO_BYTE:
        raise ValidationError({'error': 'Ukuran foto maksimal 15 MB.'})
    pilihan = None
    if pilihan_file_id:
        pilihan = PilihanFile.objects.filter(pk=pilihan_file_id, pesanan=pesanan).first()
        if pilihan is None:
            raise ValidationError({'error': 'File pilihan tidak valid.'})
    return PratinjauEdit.objects.create(
        pesanan=pesanan, putaran=_putaran_draf(pesanan), pilihan_file=pilihan,
        berkas=beri_watermark(berkas), diunggah_oleh=user,
    )


@transaction.atomic
def hapus_pratinjau(pratinjau_id, user):
    pratinjau = PratinjauEdit.objects.select_related('pesanan').select_for_update(of=('self',)).get(pk=pratinjau_id)
    if not _boleh_edit(user, pratinjau.pesanan):
        raise PermissionDenied('Hanya editor yang dapat menghapus pratinjau.')
    if pratinjau.putaran != _putaran_draf(pratinjau.pesanan) or pratinjau.pesanan.approval_status == 'menunggu':
        raise ValidationError({'error': 'Pratinjau yang sudah dikirim ke pelanggan tidak bisa dihapus.'})
    pratinjau.berkas.delete(save=False)
    pratinjau.delete()


def _kirim_wa(pesanan, pembuka):
    from ..wa_logic import get_business_name
    from ..whatsapp_client import whatsapp_client
    from .pos_receipt_whatsapp import normalisasi_nomor_whatsapp

    order = pesanan.order
    nomor = normalisasi_nomor_whatsapp(order.nomor_wa)
    if not nomor:
        return False
    teks = (
        f"Halo Kak {order.nama} 🙏\n{pembuka}\n\n"
        f"📸 Lihat & setujui hasil edit di sini:\n{url_approval(pesanan)}\n\n"
        f"Tiap foto bisa disetujui atau diminta revisi (sisa revisi: "
        f"{max(0, batas_revisi() - revisi_terpakai(pesanan))}x).\n— {get_business_name()}"
    )
    try:
        return bool(whatsapp_client.send_text_message(nomor, teks))
    except Exception:
        logger.exception('Kirim tautan approval foto gagal untuk pesanan %s.', pesanan.pk)
        return False


@transaction.atomic
def kirim_ke_pelanggan(pesanan_id, user):
    pesanan = PesananFoto.objects.select_for_update(of=('self',)).select_related('order').get(pk=pesanan_id)
    if not _boleh_edit(user, pesanan):
        raise PermissionDenied('Hanya editor yang dapat mengirim hasil edit.')
    if pesanan.status != 'dikonfirmasi' or pesanan.approval_status not in ('', 'revisi'):
        raise ValidationError({'error': 'Pesanan ini tidak sedang menunggu hasil edit.'})
    putaran = _putaran_draf(pesanan)
    if not pesanan.pratinjau.filter(putaran=putaran).exists():
        raise ValidationError({'error': 'Unggah minimal satu pratinjau hasil edit.'})
    sekarang = timezone.now()
    job = _job(pesanan, 'tahap_edit_id')
    if job and job.status_pekerjaan not in ('selesai', 'batal'):
        job.status_pekerjaan, job.waktu_selesai = 'selesai', sekarang
        if not job.waktu_mulai:
            job.waktu_mulai = sekarang
        if not job.pic_staff_id and user.role in ('staff', 'spv', 'kordiv'):
            job.pic_staff = user
        job.save()
    buang_berkas_pratinjau(pesanan.pratinjau.filter(putaran__lt=putaran))
    pesanan.approval_status, pesanan.approval_putaran = 'menunggu', putaran
    pesanan.approval_dikirim_pada, pesanan.approval_oleh = sekarang, ''
    pesanan.save(update_fields=['approval_status', 'approval_putaran', 'approval_dikirim_pada', 'approval_oleh'])
    OrderActivityLog.objects.create(
        order=pesanan.order, user=user, tindakan='KIRIM_APPROVAL_FOTO',
        keterangan=f'Hasil edit putaran {putaran} dikirim ke pelanggan untuk disetujui.',
    )
    pk = pesanan.pk
    transaction.on_commit(lambda: _kirim_wa(PesananFoto.objects.select_related('order').get(pk=pk),
                                            'Hasil edit foto Kakak sudah siap.'))
    return pesanan


# ---------------------------------------------------------------- keputusan
def data_publik(token):
    pesanan, putaran_token = baca_token(token)
    usang = putaran_token != pesanan.approval_putaran
    foto = pesanan.pratinjau.filter(putaran=pesanan.approval_putaran).select_related('pilihan_file')
    from .resi_digital import _info_toko
    return {
        'toko': _info_toko(),
        'pelanggan': pesanan.order.nama,
        'order_id': pesanan.order_id,
        'paket': pesanan.paket_item.jenis_produk,
        'status': 'usang' if usang else pesanan.approval_status,
        'putaran': pesanan.approval_putaran,
        'sisa_revisi': max(0, batas_revisi() - revisi_terpakai(pesanan)),
        'foto': [] if usang else [{
            'id': f.id,
            'nomor_file': f.pilihan_file.nomor_file if f.pilihan_file_id else '',
            'peruntukan': f.pilihan_file.peruntukan if f.pilihan_file_id else '',
            'keputusan': f.keputusan,
            'catatan': f.catatan_pelanggan,
        } for f in foto],
    }


def berkas_publik(token, foto_id):
    pesanan, putaran_token = baca_token(token)
    foto = pesanan.pratinjau.filter(pk=foto_id, putaran=putaran_token).exclude(berkas='').first()
    if foto is None:
        raise TokenTidakValid('Foto tidak ditemukan.')
    return foto.berkas


@transaction.atomic
def putuskan(pesanan_id, keputusan, oleh, user=None):
    """`keputusan`: [{id, setuju, catatan}] untuk semua foto putaran berjalan."""
    pesanan = PesananFoto.objects.select_for_update(of=('self',)).select_related('order', 'paket_item').get(pk=pesanan_id)
    if pesanan.approval_status != 'menunggu':
        raise ValidationError({'error': 'Hasil edit ini sudah diputuskan.'})
    foto = {f.id: f for f in pesanan.pratinjau.select_for_update().filter(putaran=pesanan.approval_putaran)}
    per_id = {}
    for raw in keputusan or []:
        try:
            per_id[int(raw.get('id'))] = raw
        except (TypeError, ValueError, AttributeError):
            raise ValidationError({'error': 'Keputusan tidak valid.'})
    if set(per_id) != set(foto):
        raise ValidationError({'error': 'Setujui atau minta revisi untuk semua foto.'})
    ada_revisi = False
    for fid, f in foto.items():
        setuju = str(per_id[fid].get('setuju')).strip().lower() in ('true', '1', 'ya')
        f.keputusan = 'setuju' if setuju else 'revisi'
        f.catatan_pelanggan = str(per_id[fid].get('catatan') or '')[:1000]
        if not setuju and not f.catatan_pelanggan.strip():
            raise ValidationError({'error': 'Tulis catatan revisi untuk foto yang ingin diperbaiki.'})
        ada_revisi = ada_revisi or not setuju
    if ada_revisi and revisi_terpakai(pesanan) >= batas_revisi():
        raise ValidationError({'error': 'Batas revisi sudah tercapai. Silakan hubungi kami untuk perubahan lebih lanjut.'})
    for f in foto.values():
        f.save(update_fields=['keputusan', 'catatan_pelanggan'])

    sekarang = timezone.now()
    pesanan.approval_diputus_pada, pesanan.approval_oleh = sekarang, oleh
    job_edit = _job(pesanan, 'tahap_edit_id')
    deadline = job_edit.deadline if job_edit else None
    deadline_jam = job_edit.deadline_jam if job_edit else None
    if ada_revisi:
        pesanan.approval_status = 'revisi'
        spk.terbitkan([pesanan.paket_item], field='order_item', tahap=_tahap('tahap_edit_id', 'Edit'),
                      staff=job_edit.pic_staff if job_edit else None, deadline=deadline, deadline_jam=deadline_jam)
        keterangan = f'Pelanggan minta revisi hasil edit (revisi ke-{pesanan.approval_putaran}); SPK Edit dibuka lagi.'
    else:
        pesanan.approval_status = 'disetujui'
        buang_berkas_pratinjau(pesanan.pratinjau.all())
        tahap_cetak = _tahap('tahap_cetak_id', 'Cetak')
        spk.terbitkan([pesanan.paket_item], field='order_item', tahap=tahap_cetak, staff=None,
                      deadline=deadline, deadline_jam=deadline_jam)
        keterangan = f'Hasil edit disetujui; SPK Cetak diterbitkan ke {tahap_cetak.divisi.nama}.'
    pesanan.save(update_fields=['approval_status', 'approval_diputus_pada', 'approval_oleh'])
    OrderActivityLog.objects.create(
        order=pesanan.order, user=user, tindakan='APPROVAL_FOTO', keterangan=f'{keterangan} (oleh {oleh})',
    )
    return pesanan


def putuskan_publik(token, keputusan):
    pesanan, putaran_token = baca_token(token)
    if putaran_token != pesanan.approval_putaran:
        raise ValidationError({'error': 'Tautan ini sudah diperbarui. Buka tautan terbaru dari WhatsApp kami.'})
    return putuskan(pesanan.pk, keputusan, 'pelanggan')


def putuskan_staff(pesanan_id, user, keputusan):
    if user.role not in ROLE_KASIR:
        raise PermissionDenied('Hanya kasir/owner yang dapat memutuskan atas nama pelanggan.')
    return putuskan(pesanan_id, keputusan, user.username, user)


# ---------------------------------------------------------------- tindak lanjut
def tertunda():
    """Approval yang belum direspons lebih dari `pengingat_approval_jam`."""
    jam = _pengaturan()['pengingat_approval_jam'] or 24
    batas = timezone.now() - timezone.timedelta(hours=jam)
    return PesananFoto.objects.select_related('order').filter(
        approval_status='menunggu', approval_dikirim_pada__lt=batas,
    ).exclude(order__status_global='batal').order_by('approval_dikirim_pada')


@transaction.atomic
def kirim_ulang(pesanan_id, user):
    if user.role not in ROLE_KASIR:
        raise PermissionDenied('Hanya kasir/owner yang dapat mengirim ulang tautan.')
    pesanan = PesananFoto.objects.select_for_update(of=('self',)).select_related('order').get(pk=pesanan_id)
    if pesanan.approval_status != 'menunggu':
        raise ValidationError({'error': 'Pesanan ini tidak sedang menunggu persetujuan pelanggan.'})
    pesanan.approval_dikirim_pada = timezone.now()
    pesanan.save(update_fields=['approval_dikirim_pada'])
    OrderActivityLog.objects.create(order=pesanan.order, user=user, tindakan='KIRIM_APPROVAL_FOTO',
                                    keterangan='Tautan approval hasil edit dikirim ulang.')
    pk = pesanan.pk
    transaction.on_commit(lambda: _kirim_wa(PesananFoto.objects.select_related('order').get(pk=pk),
                                            'Mengingatkan, hasil edit foto Kakak menunggu persetujuan.'))
    return pesanan
