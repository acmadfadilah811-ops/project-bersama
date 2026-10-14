"""Pesanan sesi foto StarFoto (2026-10-11). Satu pintu aturan bisnisnya.

Alur: kasir membuat pesanan lewat checkout kasir biasa (`checkout-pos`) dengan
blok `starfoto` -> SPK Sesi Foto (fotografer) & Asisten Foto -> fotografer
mengusulkan tambahan saat sesi -> sesi selesai -> kasir mengonfirmasi usulan
& pilihan file -> SPK Edit -> (Edit selesai) SPK Cetak otomatis -> Siap Diambil.

Uang: tidak ada jurnal baru. DP/pelunasan tetap lewat alur pembayaran pesanan
(Uang Muka Pelanggan) dan pendapatan diakui saat pesanan selesai. Usulan
tambahan baru menambah tagihan setelah disetujui kasir; harga selalu dari master
(Addon/Product), bukan dari klien (M6). Stok pigura lewat service FIFO (M8).
"""
import datetime
from decimal import ROUND_UP, Decimal, InvalidOperation

from django.db import transaction
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework.exceptions import PermissionDenied, ValidationError

from .. import pos_settings, spk
from ..models import (
    CustomUser, JobBoard, OrderActivityLog, OrderItem, SystemConfig, TahapProses,
)
from ..product_models import Addon, Product, ProductVariant, SaleItemAddon
from ..starfoto_models import PesananFoto, PilihanFile, SesiFoto, UsulanTambahan

ROLE_KASIR = ('owner', 'manager', 'admin', 'kasir')

# kunci SystemConfig -> (nama pengaturan, default, tipe)
PENGATURAN = {
    'dp_minimal_persen': ('starfoto_dp_minimal_persen', '50', 'desimal'),
    'durasi_default_menit': ('starfoto_durasi_default_menit', '30', 'angka'),
    'jumlah_studio': ('starfoto_jumlah_studio', '1', 'angka'),
    'dinas_luar_non_sesi': ('starfoto_dinas_luar_non_sesi', 'False', 'bool'),
    'uang_transport': ('starfoto_uang_transport', 'False', 'bool'),
    # Rupiah per dinas luar per petugas (dipakai bila uang_transport aktif).
    'uang_transport_nominal': ('starfoto_uang_transport_nominal', '0', 'rupiah'),
    'tahap_sesi_id': ('starfoto_tahap_sesi_id', '', 'id'),
    'tahap_asisten_id': ('starfoto_tahap_asisten_id', '', 'id'),
    'tahap_edit_id': ('starfoto_tahap_edit_id', '', 'id'),
    'tahap_cetak_id': ('starfoto_tahap_cetak_id', '', 'id'),
    # Nomor kantong terakhir yang terpakai; pesanan baru = nomor ini + 1.
    'kantong_terakhir': ('starfoto_kantong_terakhir', '', 'teks'),
    # Approval hasil edit oleh pelanggan (2026-10-11).
    'batas_revisi': ('starfoto_batas_revisi', '2', 'angka0'),
    'pengingat_approval_jam': ('starfoto_pengingat_approval_jam', '24', 'angka'),
    'masa_link_hari': ('starfoto_masa_link_hari', '7', 'angka'),
}


# ---------------------------------------------------------------- pengaturan
def _ubah_tipe(nilai, tipe):
    nilai = '' if nilai is None else str(nilai).strip()
    if tipe == 'bool':
        return nilai.lower() in ('true', '1', 'ya', 'on')
    if tipe == 'teks':
        return nilai
    if tipe == 'rupiah':
        return int(nilai) if nilai.isdigit() else 0
    if tipe == 'id':
        return int(nilai) if nilai.isdigit() else None
    if tipe in ('angka', 'angka0'):
        return int(nilai) if nilai.isdigit() else 0
    try:
        return Decimal(nilai or '0')
    except InvalidOperation:
        return Decimal('0')


def pengaturan():
    tersimpan = dict(
        SystemConfig.objects.filter(key__in=[k for k, _d, _t in PENGATURAN.values()]).values_list('key', 'value')
    )
    return {nama: _ubah_tipe(tersimpan.get(kunci, bawaan), tipe) for nama, (kunci, bawaan, tipe) in PENGATURAN.items()}


@transaction.atomic
def simpan_pengaturan(data):
    galat = {}
    for nama, nilai in (data or {}).items():
        if nama not in PENGATURAN:
            continue
        kunci, _bawaan, tipe = PENGATURAN[nama]
        teks = '' if nilai is None else str(nilai).strip()
        if tipe == 'desimal':
            try:
                angka = Decimal(teks)
            except InvalidOperation:
                galat[nama] = 'Harus berupa angka.'
                continue
            if not Decimal('0') <= angka <= Decimal('100'):
                galat[nama] = 'Harus antara 0 sampai 100.'
                continue
        elif tipe == 'angka' and (not teks.isdigit() or int(teks) < 1):
            galat[nama] = 'Harus bilangan bulat minimal 1.'
            continue
        elif tipe == 'angka0' and not teks.isdigit():
            galat[nama] = 'Harus bilangan bulat 0 atau lebih.'
            continue
        elif tipe == 'id' and teks:
            if not teks.isdigit() or not TahapProses.objects.filter(pk=int(teks)).exists():
                galat[nama] = 'Tahap tidak ditemukan.'
                continue
        elif tipe == 'bool':
            teks = 'True' if _ubah_tipe(teks, 'bool') else 'False'
        elif tipe == 'rupiah' and not (teks or '0').isdigit():
            galat[nama] = 'Nominal harus angka rupiah (tanpa titik/koma).'
            continue
        elif tipe == 'teks' and teks and not teks.isdigit():
            galat[nama] = 'Nomor kantong harus berupa angka.'
            continue
        SystemConfig.objects.update_or_create(key=kunci, defaults={'value': teks})
    if galat:
        raise ValidationError(galat)
    return pengaturan()


def _naik(nomor):
    return str(int(nomor) + 1).zfill(len(nomor))


def kantong_berikutnya():
    """Perkiraan nomor kantong (amplop bernomor urut) pesanan berikutnya:
    nomor terakhir di Pengaturan + 1, panjang digit dipertahankan (018595 -> 018596)."""
    terakhir = pengaturan()['kantong_terakhir']
    return _naik(terakhir) if terakhir else '000001'


def ambil_kantong_baru():
    """Nomor kantong otomatis saat pesanan disimpan. Baris pengaturan dikunci
    (select_for_update) supaya dua kasir bersamaan tidak mendapat nomor sama;
    nomor yang sudah terpakai (mis. diisi manual) dilewati."""
    kunci = PENGATURAN['kantong_terakhir'][0]
    SystemConfig.objects.get_or_create(key=kunci, defaults={'value': ''})
    cfg = SystemConfig.objects.select_for_update().get(key=kunci)
    nomor = _naik(cfg.value.strip()) if cfg.value.strip().isdigit() else '000001'
    while PesananFoto.objects.filter(nomor_kantong=nomor).exists():
        nomor = _naik(nomor)
    cfg.value = nomor
    cfg.save(update_fields=['value'])
    return nomor


def _cek_kantong(nomor):
    if not nomor:
        return
    dipakai = PesananFoto.objects.filter(nomor_kantong__iexact=nomor).exclude(status='batal').exclude(
        order__status_global='batal',
    ).select_related('order').first()
    if dipakai:
        raise ValidationError({'error': f'No. kantong {nomor} sudah dipakai pesanan {dipakai.order_id} ({dipakai.order.nama}).'})


def _tahap(nama_pengaturan, label):
    tahap_id = pengaturan()[nama_pengaturan]
    tahap = TahapProses.objects.select_related('divisi').filter(pk=tahap_id).first() if tahap_id else None
    if not tahap:
        raise ValidationError({'error': f"Tahap {label} StarFoto belum diatur di Pengaturan StarFoto."})
    return tahap


def _tahap_id_sesi():
    atur = pengaturan()
    return {i for i in (atur['tahap_sesi_id'], atur['tahap_asisten_id']) if i}


# ---------------------------------------------------------------- pembuatan
def _rupiah_naik(nilai):
    return Decimal(nilai).quantize(Decimal('1'), rounding=ROUND_UP)


def dp_minimal(paket, total):
    persen = paket.dp_minimal_persen if paket.dp_minimal_persen is not None else pengaturan()['dp_minimal_persen']
    return _rupiah_naik(Decimal(str(total or 0)) * Decimal(str(persen)) / Decimal('100'))


def _int(nilai, label, minimal=0):
    try:
        angka = int(nilai)
    except (TypeError, ValueError):
        raise ValidationError({'error': f'{label} tidak valid.'})
    if angka < minimal:
        raise ValidationError({'error': f'{label} minimal {minimal}.'})
    return angka


def _petugas(user_id, label, tahap):
    """Fotografer/asisten: staff aktif. Kasir boleh menunjuk langsung karena
    jadwal sesi adalah janji ke pelanggan (berbeda dari SPK produksi biasa yang
    ditunjuk kepala divisi)."""
    if not user_id:
        return None
    petugas = CustomUser.objects.filter(
        pk=user_id, is_active=True, role__in=('staff', 'spv', 'kordiv'),
    ).first()
    if not petugas:
        raise ValidationError({'error': f'{label} tidak ditemukan atau nonaktif.'})
    if tahap.divisi_id and petugas.divisi_id and petugas.divisi_id != tahap.divisi_id:
        raise ValidationError({'error': f"{label} '{petugas.username}' bukan anggota divisi {tahap.divisi.nama}."})
    return petugas


def _cek_bentrok(mulai, durasi, lokasi, kecuali_pesanan=None):
    if lokasi != 'studio':
        return
    selesai = mulai + datetime.timedelta(minutes=durasi)
    calon = SesiFoto.objects.filter(
        lokasi='studio', mulai__lt=selesai, mulai__gte=mulai - datetime.timedelta(hours=12),
    ).exclude(status='batal').exclude(pesanan__status='batal')
    if kecuali_pesanan is not None:
        calon = calon.exclude(pesanan=kecuali_pesanan)
    bentrok = [s for s in calon if s.mulai + datetime.timedelta(minutes=s.durasi_menit) > mulai]
    if len(bentrok) >= max(1, pengaturan()['jumlah_studio']):
        jam = ', '.join(timezone.localtime(s.mulai).strftime('%H:%M') for s in bentrok)
        raise ValidationError({'error': f'Jadwal studio bentrok dengan sesi lain (mulai {jam}). Pilih jam lain.'})


def terbitkan_dari_checkout(order, data, user, jumlah_bayar):
    """Dipanggil checkout_pos (di dalam transaksinya) menggantikan SPK umum.
    Kembalikan (jobs, staff, tahap) seperti jalur SPK biasa."""
    if not isinstance(data, dict):
        raise ValidationError({'error': 'Data pesanan StarFoto tidak valid.'})

    items = [it for it in order.items.select_related('product__paket_foto') if it.product_id
             and hasattr(it.product, 'paket_foto')]
    if len(items) != 1:
        raise ValidationError({'error': 'Pesanan StarFoto harus berisi tepat satu paket foto.'})
    paket_item = items[0]
    paket = paket_item.product.paket_foto

    jumlah_orang = _int(data.get('jumlah_orang') or paket.kuota_orang, 'Jumlah orang', 1)
    kelebihan = max(0, jumlah_orang - paket.kuota_orang)
    if kelebihan and paket.addon_tambah_orang_id:
        qty_tambah = sum(
            (a.qty for a in SaleItemAddon.objects.filter(order_item=paket_item, addon_id=paket.addon_tambah_orang_id)),
            Decimal('0'),
        )
        if qty_tambah < kelebihan:
            raise ValidationError({'error': (
                f'Paket {paket.product.nama} untuk {paket.kuota_orang} orang. Tambahkan '
                f'{paket.addon_tambah_orang.nama} sebanyak {kelebihan} untuk {jumlah_orang} orang.'
            )})

    minimal = dp_minimal(paket, order.total_harga)
    if Decimal(str(jumlah_bayar)) < minimal:
        raise ValidationError({'error': f'DP minimal Rp{int(minimal):,}.'.replace(',', '.')})

    # Fotografer/asisten opsional: kosong = SPK masuk antrean global divisi dan
    # diklaim sendiri oleh fotografer (lihat klaim()).
    tahap_sesi = _tahap('tahap_sesi_id', 'Sesi Foto')
    fotografer = _petugas(data.get('fotografer_id'), 'Fotografer', tahap_sesi)
    asisten = None
    tahap_asisten = None
    if data.get('asisten_id') or str(data.get('butuh_asisten')).lower() in ('true', '1', 'ya'):
        tahap_asisten = _tahap('tahap_asisten_id', 'Asisten Foto')
        asisten = _petugas(data.get('asisten_id'), 'Asisten', tahap_asisten)

    jenis = data.get('jenis') if data.get('jenis') in dict(PesananFoto.JENIS_CHOICES) else 'walkin'
    daftar_sesi = data.get('sesi') or [{}]
    if not isinstance(daftar_sesi, list) or not 1 <= len(daftar_sesi) <= paket.jumlah_sesi:
        raise ValidationError({'error': f'Jumlah jadwal sesi harus 1 sampai {paket.jumlah_sesi}.'})

    nomor_kantong = str(data.get('nomor_kantong') or '').strip()[:30]
    if nomor_kantong:
        _cek_kantong(nomor_kantong)
    else:
        nomor_kantong = ambil_kantong_baru()
    pesanan = PesananFoto.objects.create(
        order=order, paket_item=paket_item, jenis=jenis, jumlah_orang=jumlah_orang,
        nomor_kantong=nomor_kantong,
        background=str(data.get('background') or '')[:100],
    )
    durasi_bawaan = paket.durasi_menit or pengaturan()['durasi_default_menit'] or 30
    jadwal = []
    for urutan, raw in enumerate(daftar_sesi, 1):
        raw = raw if isinstance(raw, dict) else {}
        mulai = parse_datetime(str(raw.get('mulai') or '')) if raw.get('mulai') else None
        if mulai is None:
            if jenis == 'booking_wa':
                raise ValidationError({'error': f'Jadwal sesi {urutan} wajib diisi untuk booking.'})
            mulai = timezone.now()
        if timezone.is_naive(mulai):
            mulai = timezone.make_aware(mulai)
        lokasi = raw.get('lokasi') if raw.get('lokasi') in ('studio', 'outdoor') else (
            'outdoor' if paket.lokasi == 'outdoor' else 'studio'
        )
        durasi = _int(raw.get('durasi_menit') or durasi_bawaan, 'Durasi sesi', 1)
        if not data.get('abaikan_bentrok'):
            _cek_bentrok(mulai, durasi, lokasi)
        jadwal.append(SesiFoto.objects.create(
            pesanan=pesanan, urutan=urutan, mulai=mulai, durasi_menit=durasi, lokasi=lokasi,
            alamat=str(raw.get('alamat') or '')[:255], fotografer=fotografer, asisten=asisten,
        ))

    pertama = timezone.localtime(jadwal[0].mulai)
    jobs = spk.terbitkan([paket_item], field='order_item', tahap=tahap_sesi, staff=fotografer,
                         deadline=pertama.date(), deadline_jam=pertama.time().replace(second=0, microsecond=0))
    if tahap_asisten:
        jobs += spk.terbitkan([paket_item], field='order_item', tahap=tahap_asisten, staff=asisten,
                              deadline=pertama.date(), deadline_jam=pertama.time().replace(second=0, microsecond=0),
                              tutup_job_hantu=False)
    if paket.jumlah_sesi > 1:
        _kalikan_insentif_sesi(paket_item, paket.jumlah_sesi)
    OrderActivityLog.objects.create(
        order=order, user=user, tindakan='PESANAN_FOTO',
        keterangan=f'Pesanan foto {paket.product.nama} ({jumlah_orang} orang, {len(jadwal)} jadwal sesi).',
    )
    return jobs, fotografer, tahap_sesi


def _kalikan_insentif_sesi(paket_item, jumlah_sesi):
    """Insentif fotografer/asisten dihitung per sesi."""
    from ..insentif_models import InsentifPekerjaan
    from . import insentif_pekerjaan

    for job in JobBoard.objects.filter(order_item=paket_item, tahap_id__in=_tahap_id_sesi()):
        for baris in InsentifPekerjaan.objects.filter(job=job, otomatis=True).select_related('jenis'):
            if baris.jenis_id:
                baris.nominal = baris.jenis.nominal_default * jumlah_sesi
                baris.save(update_fields=['nominal', 'diubah_pada'])
        insentif_pekerjaan.sinkron_total(job)


# ---------------------------------------------------------------- sesi (HP fotografer)
def _petugas_sesi(pesanan, user):
    return pesanan.sesi.filter(fotografer=user).exists() or pesanan.sesi.filter(asisten=user).exists()


def _jobs_sesi(pesanan):
    return JobBoard.objects.filter(order_item=pesanan.paket_item, tahap_id__in=_tahap_id_sesi())


@transaction.atomic
def mulai_sesi(sesi_id, user):
    sesi = SesiFoto.objects.select_for_update(of=('self',)).select_related('pesanan__order').get(pk=sesi_id)
    if not sesi.fotografer_id:
        raise ValidationError({'error': 'Sesi ini belum diambil fotografer. Ambil sesi dulu di Antrean Sesi.'})
    if user.pk not in (sesi.fotografer_id, sesi.asisten_id):
        raise PermissionDenied('Hanya fotografer/asisten sesi ini yang dapat memulai sesi.')
    if sesi.pesanan.status != 'sesi' or sesi.pesanan.order.status_global == 'batal':
        raise ValidationError({'error': 'Pesanan ini tidak sedang dalam tahap sesi foto.'})
    if sesi.status != 'terjadwal':
        raise ValidationError({'error': f'Sesi sudah {sesi.get_status_display().lower()}.'})
    if sesi.lokasi == 'outdoor':
        from .dinas_luar import dinas_sesi_berjalan
        if not dinas_sesi_berjalan(user, sesi):
            raise ValidationError({'error': "Sesi outdoor: tekan 'Mulai Dinas' di lokasi dulu (GPS + selfie)."})
    sesi.status = 'berlangsung'
    sesi.mulai_aktual = timezone.now()
    sesi.save(update_fields=['status', 'mulai_aktual'])
    _jobs_sesi(sesi.pesanan).filter(status_pekerjaan='antrean').update(
        status_pekerjaan='dikerjakan', waktu_mulai=sesi.mulai_aktual,
    )
    OrderActivityLog.objects.create(
        order=sesi.pesanan.order, user=user, tindakan='MULAI_SESI_FOTO',
        keterangan=f"Sesi foto {sesi.urutan} dimulai oleh {user.username}.",
    )
    return sesi


@transaction.atomic
def selesai_sesi(sesi_id, user):
    sesi = SesiFoto.objects.select_for_update(of=('self',)).select_related('pesanan__order', 'pesanan__paket_item__product__paket_foto').get(pk=sesi_id)
    if user.pk not in (sesi.fotografer_id, sesi.asisten_id):
        raise PermissionDenied('Hanya fotografer/asisten sesi ini yang dapat menyelesaikan sesi.')
    if sesi.status != 'berlangsung':
        raise ValidationError({'error': 'Sesi belum dimulai atau sudah selesai.'})
    sesi.status = 'selesai'
    sesi.selesai_aktual = timezone.now()
    sesi.save(update_fields=['status', 'selesai_aktual'])
    pesanan = sesi.pesanan
    order = pesanan.order
    jumlah_sesi = pesanan.paket_item.product.paket_foto.jumlah_sesi
    semua_selesai = (
        pesanan.sesi.filter(status='selesai').count() >= jumlah_sesi
        and not pesanan.sesi.exclude(status__in=['selesai', 'batal']).exists()
    )
    keterangan = f"Sesi foto {sesi.urutan} diselesaikan oleh {user.username}."
    if semua_selesai:
        _jobs_sesi(pesanan).filter(status_pekerjaan__in=['antrean', 'dikerjakan', 'kendala']).update(
            status_pekerjaan='selesai', waktu_selesai=sesi.selesai_aktual,
        )
        pesanan.status = 'menunggu_kasir'
        pesanan.save(update_fields=['status'])
        keterangan += ' Semua sesi selesai, menunggu konfirmasi kasir.'
    OrderActivityLog.objects.create(order=order, user=user, tindakan='SELESAI_SESI_FOTO', keterangan=keterangan)
    return sesi


@transaction.atomic
def usulkan(pesanan_id, user, data):
    pesanan = PesananFoto.objects.select_for_update(of=('self',)).select_related('paket_item__product', 'order').get(pk=pesanan_id)
    if user.role not in ROLE_KASIR and not _petugas_sesi(pesanan, user):
        raise PermissionDenied('Hanya fotografer/asisten pesanan ini atau kasir yang dapat menambah item.')
    if pesanan.status not in ('sesi', 'menunggu_kasir') or pesanan.order.status_global == 'batal':
        raise ValidationError({'error': 'Pesanan sudah dikonfirmasi kasir, tambahan tidak bisa diusulkan lagi.'})
    qty = _int(data.get('qty') or 1, 'Qty', 1)
    catatan = str(data.get('catatan') or '')[:255]

    if data.get('addon_id'):
        from .addon_sales import resolve_addons
        [(addon, _q)] = resolve_addons([{'id': data.get('addon_id'), 'qty': qty}], pesanan.paket_item.product)
        return UsulanTambahan.objects.create(
            pesanan=pesanan, addon=addon, nama=addon.nama, qty=qty, catatan=catatan, diusulkan_oleh=user,
        )
    product = Product.objects.filter(pk=data.get('product_id'), is_active=True).first() if data.get('product_id') else None
    if not product:
        raise ValidationError({'error': 'Pilih addon paket atau produk (pigura) yang akan ditambahkan.'})
    variant = None
    if data.get('variant_id'):
        variant = ProductVariant.objects.filter(pk=data['variant_id'], product=product).first()
        if not variant:
            raise ValidationError({'error': 'Varian produk tidak valid.'})
    elif product.variants.exists():
        raise ValidationError({'error': f"Pilih varian (ukuran/warna) untuk '{product.nama}'."})
    nama = product.nama + (f' - {variant.nama_varian}' if variant else '')
    return UsulanTambahan.objects.create(
        pesanan=pesanan, product=product, variant=variant, nama=nama[:255], qty=qty, catatan=catatan,
        diusulkan_oleh=user,
    )


@transaction.atomic
def hapus_usulan(usulan_id, user):
    usulan = UsulanTambahan.objects.select_for_update().get(pk=usulan_id)
    if usulan.status != 'usulan':
        raise ValidationError({'error': 'Usulan sudah diputuskan kasir.'})
    if usulan.diusulkan_oleh_id != user.pk and user.role not in ROLE_KASIR:
        raise PermissionDenied('Hanya pengusul atau kasir yang dapat menghapus usulan ini.')
    usulan.delete()


# ---------------------------------------------------------------- klaim global
PERAN_TAHAP = {'fotografer': ('tahap_sesi_id', 'Sesi Foto'), 'asisten': ('tahap_asisten_id', 'Asisten Foto')}


def _boleh_klaim(user, tahap):
    if user.role in ('spv', 'kordiv'):
        from ..permissions import get_subordinate_divisi_ids
        return tahap.divisi_id in get_subordinate_divisi_ids(user)
    return user.role == 'staff' and user.divisi_id == tahap.divisi_id


def sinkron_petugas(job):
    """PIC SPK Sesi/Asisten Foto = fotografer/asisten di semua jadwal sesi pesanan."""
    pesanan = pesanan_dari_job(job)
    if not pesanan or not job.tahap_id:
        return
    atur = pengaturan()
    if job.tahap_id == atur['tahap_sesi_id']:
        pesanan.sesi.update(fotografer=job.pic_staff)
    elif job.tahap_id == atur['tahap_asisten_id']:
        pesanan.sesi.update(asisten=job.pic_staff)


def antrean_sesi(user):
    """Sesi yang belum punya fotografer/asisten di divisi user: [(sesi, peran)]."""
    hasil = []
    for peran, (kunci, _label) in PERAN_TAHAP.items():
        tahap_id = pengaturan()[kunci]
        tahap = TahapProses.objects.filter(pk=tahap_id).first() if tahap_id else None
        if not tahap or not _boleh_klaim(user, tahap):
            continue
        item_ids = JobBoard.objects.filter(
            tahap=tahap, pic_staff__isnull=True, status_pekerjaan='antrean', order_item__pesanan_foto__status='sesi',
        ).exclude(order_item__order__status_global='batal').values('order_item_id')
        for sesi in SesiFoto.objects.select_related('pesanan__order', 'pesanan__paket_item', 'fotografer', 'asisten').filter(
            pesanan__paket_item_id__in=item_ids, urutan=1,
        ).order_by('mulai'):
            hasil.append((sesi, peran))
    return hasil


@transaction.atomic
def klaim(pesanan_id, user, peran):
    if peran not in PERAN_TAHAP:
        raise ValidationError({'error': 'Peran harus fotografer atau asisten.'})
    pesanan = PesananFoto.objects.select_for_update(of=('self',)).select_related('order').get(pk=pesanan_id)
    if pesanan.status != 'sesi' or pesanan.order.status_global == 'batal':
        raise ValidationError({'error': 'Pesanan ini sudah tidak dalam tahap sesi foto.'})
    kunci, label = PERAN_TAHAP[peran]
    tahap = _tahap(kunci, label)
    if not _boleh_klaim(user, tahap):
        raise PermissionDenied(f'Hanya anggota divisi {tahap.divisi.nama} yang dapat mengambil sesi ini.')
    job = JobBoard.objects.select_for_update().filter(
        order_item_id=pesanan.paket_item_id, tahap=tahap,
    ).exclude(status_pekerjaan__in=['batal', 'selesai']).first()
    if not job:
        raise ValidationError({'error': f'Pesanan ini tidak membutuhkan {peran}.'})
    if job.pic_staff_id:
        raise ValidationError({'error': f'Sesi ini sudah diambil oleh {job.pic_staff.username}.'})
    if peran == 'asisten' and pesanan.sesi.filter(fotografer=user).exists():
        raise ValidationError({'error': 'Anda sudah menjadi fotografer sesi ini.'})
    job.pic_staff = user
    job.save(update_fields=['pic_staff'])
    sinkron_petugas(job)
    OrderActivityLog.objects.create(
        order=pesanan.order, user=user, tindakan='CLAIM_JOB',
        keterangan=f"{user.username} mengambil sesi foto sebagai {peran} (PIC {label}).",
    )
    return pesanan


def setelah_klaim(job, user):
    """Klaim SPK Sesi/Asisten lewat papan kerja ikut mengisi petugas sesi."""
    if job.tahap_id and job.tahap_id in _tahap_id_sesi():
        sinkron_petugas(job)


# ---------------------------------------------------------------- konfirmasi kasir
def _harga_produk(product, variant):
    harga = variant.harga_jual_toko if variant is not None and variant.harga_jual_toko is not None else product.harga_jual_toko
    return int(Decimal(str(harga or 0)))


@transaction.atomic
def konfirmasi(pesanan_id, user, data):
    if user.role not in ROLE_KASIR:
        raise PermissionDenied('Hanya kasir yang dapat mengonfirmasi pesanan foto.')
    from .addon_sales import apply_addons
    from .order_stock import potong_stok_order_item

    pesanan = PesananFoto.objects.select_for_update(of=('self',)).select_related('order', 'paket_item__product').get(pk=pesanan_id)
    order = pesanan.order
    if pesanan.status != 'menunggu_kasir':
        raise ValidationError({'error': 'Pesanan ini belum selesai sesi atau sudah dikonfirmasi.'})
    if order.status_global == 'batal':
        raise ValidationError({'error': 'Pesanan sudah dibatalkan.'})

    keputusan = {}
    for raw in data.get('usulan') or []:
        try:
            keputusan[int(raw.get('id'))] = raw
        except (TypeError, ValueError, AttributeError):
            raise ValidationError({'error': 'Keputusan usulan tidak valid.'})
    tertunda = list(pesanan.usulan.select_for_update().filter(status='usulan'))
    belum = [u.nama for u in tertunda if u.pk not in keputusan]
    if belum:
        raise ValidationError({'error': f"Putuskan dulu usulan tambahan: {', '.join(belum)}."})

    pilihan = data.get('pilihan_file') or []
    if not isinstance(pilihan, list) or not any(str((p or {}).get('nomor_file') or '').strip() for p in pilihan):
        raise ValidationError({'error': 'Isi minimal satu file yang dipilih pelanggan.'})

    spk_data = data.get('spk') if isinstance(data.get('spk'), dict) else {}
    try:
        deadline = spk.resolve_deadline(spk_data.get('deadline'))
        deadline_jam = spk.resolve_deadline_jam(spk_data.get('deadline_jam'))
    except spk.SpkError as exc:
        raise ValidationError({'error': exc.pesan})
    if not deadline:
        raise ValidationError({'error': 'Deadline SPK wajib diisi.'})
    tahap_edit = _tahap('tahap_edit_id', 'Edit')
    tahap_cetak = _tahap('tahap_cetak_id', 'Cetak')
    # Paket tanpa file edit langsung ke Cetak (kasir boleh memilih sebaliknya).
    jumlah_edit = getattr(getattr(pesanan.paket_item.product, 'paket_foto', None), 'jumlah_edit', 1)
    tanpa_edit = str(data.get('tanpa_edit', jumlah_edit == 0)).strip().lower() in ('true', '1', 'ya')

    sekarang = timezone.now()
    paket_item = pesanan.paket_item
    for usulan in tertunda:
        raw = keputusan[usulan.pk]
        setuju = str(raw.get('setuju')).strip().lower() in ('true', '1', 'ya')
        usulan.diputus_oleh, usulan.diputus_pada = user, sekarang
        if not setuju:
            usulan.status = 'ditolak'
            usulan.alasan_tolak = str(raw.get('alasan') or '')[:255]
            usulan.save(update_fields=['status', 'alasan_tolak', 'diputus_oleh', 'diputus_pada'])
            continue
        if usulan.addon_id:
            total = apply_addons(
                addons=[(Addon.objects.get(pk=usulan.addon_id), Decimal(usulan.qty))], user=user,
                tanggal=timezone.localdate(), order_item=paket_item, order=order,
                deduct_stock=pos_settings.pos_mengurangi_stok(),
            )
            paket_item.harga_jual = (paket_item.harga_jual or 0) + int(total)
            paket_item._current_user = user
            paket_item.save(update_fields=['harga_jual'])
        else:
            item = OrderItem(
                order=order, jenis_produk=usulan.nama[:100], product=usulan.product, variant=usulan.variant,
                qty=usulan.qty, harga_jual=_harga_produk(usulan.product, usulan.variant) * usulan.qty,
                keterangan_detail=f'Tambahan saat sesi foto. {usulan.catatan}'.strip(),
            )
            item._current_user = user
            item.save()
            potong_stok_order_item(item, user)
            usulan.order_item = item
        usulan.status = 'disetujui'
        usulan.save(update_fields=['status', 'order_item', 'diputus_oleh', 'diputus_pada'])

    PilihanFile.objects.filter(pesanan=pesanan).delete()
    for urutan, raw in enumerate((p for p in pilihan if str((p or {}).get('nomor_file') or '').strip()), 1):
        PilihanFile.objects.create(
            pesanan=pesanan, urutan=urutan, nomor_file=str(raw.get('nomor_file')).strip()[:50],
            peruntukan=str(raw.get('peruntukan') or '')[:150], catatan=str(raw.get('catatan') or ''),
        )
    pesanan.catatan_file = str(data.get('catatan_file') or '')
    pesanan.status = 'dikonfirmasi'
    pesanan.dikonfirmasi_oleh, pesanan.dikonfirmasi_pada = user, sekarang
    pesanan.approval_status = 'tanpa_edit' if tanpa_edit else ''
    pesanan.save(update_fields=['catatan_file', 'status', 'dikonfirmasi_oleh', 'dikonfirmasi_pada', 'approval_status'])

    order.refresh_from_db()
    order._current_user = user
    order.status_global = 'proses'
    order.save()

    tahap_tujuan = tahap_cetak if tanpa_edit else tahap_edit
    jobs = spk.terbitkan([paket_item], field='order_item', tahap=tahap_tujuan, staff=None,
                         deadline=deadline, deadline_jam=deadline_jam)
    OrderActivityLog.objects.create(
        order=order, user=user, tindakan='KONFIRMASI_SESI_FOTO',
        keterangan=(
            f'Kasir {user.username} mengonfirmasi sesi foto: {len(pilihan)} file dipilih, '
            f'SPK {tahap_tujuan.nama} diterbitkan ke {tahap_tujuan.divisi.nama}.'
        ),
    )
    return pesanan, jobs


# ---------------------------------------------------------------- status untuk pelanggan
def status_pesanan_foto(order, panggilan='Kak'):
    """Status pesanan foto untuk resi online & tracking WA (2026-10-14).

    Sebelum sesi foto selesai dan dikonfirmasi kasir, pesanan foto belum masuk
    produksi -- jangan tampil "Dalam Proses Produksi". Mengembalikan
    (label, keterangan) atau None bila bukan pesanan foto / sudah tahap produksi
    (pemanggil memakai status pesanan biasa)."""
    if order.status_global in ('ready', 'selesai', 'batal'):
        return None
    pesanan = PesananFoto.objects.filter(order=order).first()
    if pesanan is None or pesanan.status in ('dikonfirmasi', 'batal'):
        return None
    if pesanan.status == 'menunggu_kasir':
        return ('Sesi Foto Selesai', f'Sesi foto {panggilan} sudah selesai. Foto segera masuk proses edit. 📸')
    sesi = list(pesanan.sesi.exclude(status='batal').order_by('urutan'))
    if any(s.status == 'berlangsung' for s in sesi):
        return ('Sesi Foto Berlangsung', f'Sesi foto {panggilan} sedang berlangsung. 📸')
    berikut = next((s for s in sesi if s.status == 'terjadwal'), None)
    if berikut is not None:
        jadwal = timezone.localtime(berikut.mulai).strftime('%d/%m/%Y %H:%M')
        return (f'Menunggu Sesi Foto ({jadwal})', f'Kami tunggu {panggilan} di sesi foto {jadwal}. 📸')
    return ('Menunggu Sesi Foto', f'Kami tunggu {panggilan} di sesi foto. 📸')


def deskripsi_job_sesi(job):
    """Deskripsi SPK Sesi/Asisten Foto untuk pelanggan (bukan 'dikerjakan tim produksi')."""
    if not job.tahap_id or job.tahap_id not in _tahap_id_sesi():
        return None
    return {
        'antrean': ('📸', 'Menunggu sesi foto'),
        'dikerjakan': ('📸', 'Sesi foto berlangsung'),
        'kendala': ('⚠️', 'Sesi foto terkendala — kami hubungi Kakak'),
        'selesai': ('✅', 'Sesi foto selesai'),
    }.get(job.status_pekerjaan)


# ---------------------------------------------------------------- kait papan kerja
def pesanan_dari_job(job):
    if not job.order_item_id:
        return None
    return PesananFoto.objects.filter(paket_item_id=job.order_item_id).first()


def cek_boleh_selesai(job):
    """SPK Sesi/Asisten Foto diselesaikan lewat menu Sesi Saya (bukan papan
    kerja) supaya pesanan kembali ke kasir, bukan langsung Siap Diambil."""
    if job.tahap_id and job.tahap_id in _tahap_id_sesi() and pesanan_dari_job(job):
        raise ValidationError({'error': "Selesaikan sesi foto lewat menu 'Sesi Saya' di HP."})
    if job.tahap_id and job.tahap_id == pengaturan()['tahap_edit_id'] and pesanan_dari_job(job):
        raise ValidationError({'error': "Kirim hasil edit lewat menu 'Edit Foto' (unggah pratinjau untuk disetujui pelanggan)."})


def setelah_job_selesai(job, user):
    """Edit selesai -> SPK Cetak otomatis ke divisi Operator (deadline ikut Edit).

    Sejak approval pelanggan (2026-10-11) SPK Edit pesanan foto ditutup lewat
    services/starfoto_approval.kirim_ke_pelanggan dan SPK Cetak baru terbit
    setelah pelanggan setuju; kait ini tinggal pengaman bila Edit tertutup
    lewat jalur lain."""
    if not job.tahap_id or job.tahap_id != pengaturan()['tahap_edit_id']:
        return
    pesanan = pesanan_dari_job(job)
    if not pesanan:
        return
    tahap_cetak = _tahap('tahap_cetak_id', 'Cetak')
    if JobBoard.objects.filter(order_item_id=job.order_item_id, tahap=tahap_cetak).exists():
        return
    spk.terbitkan([job.order_item], field='order_item', tahap=tahap_cetak, staff=None,
                  deadline=job.deadline, deadline_jam=job.deadline_jam)
    OrderActivityLog.objects.create(
        order=pesanan.order, user=user, tindakan='TERBITKAN_SPK',
        keterangan=f'Edit selesai, SPK Cetak otomatis diterbitkan ke {tahap_cetak.divisi.nama}.',
    )


# ---------------------------------------------------------------- daftar
def jadwal(dari, sampai):
    return (
        SesiFoto.objects.select_related('pesanan__order', 'pesanan__paket_item', 'fotografer', 'asisten')
        .filter(mulai__date__gte=dari, mulai__date__lte=sampai)
        .exclude(pesanan__order__status_global='batal')
        .order_by('mulai')
    )

