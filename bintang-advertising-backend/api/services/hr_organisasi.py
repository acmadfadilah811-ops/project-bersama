"""Sinkron struktur organisasi HR -> Bintang (2026-09-30).

- Departemen HR      -> Divisi Bintang
- Peran Jabatan HR   -> Tahap Proses di divisi departemen jabatannya
- Jabatan HR         -> role akun (sudah otomatis lewat nama jabatan saat akun
                        dibuat, lihat views/hr_bridge.py -- tidak ada master role)

Aturan: tidak pernah menghapus (hapus di HR tidak menghapus divisi/tahap yang
mungkin sudah dipakai SPK); ganti nama mengikuti HR; data lama dengan nama sama
"diadopsi" (ditautkan ke ID HR) supaya tidak terduplikasi. Departemen yang tidak
bekerja di Bintang (Sales Marketing & Creative, HR & GA) dilewati.
"""
from django.db import transaction
from django.db.models import Max

from ..models import Divisi, TahapProses, UnitBisnis

DEPARTEMEN_TANPA_DIVISI = {'sales marketing & creative', 'hr & ga'}
# Sama dengan DEPARTEMEN_KE_UNIT_BISNIS di views/hr_bridge.py (akun karyawan).
DEPARTEMEN_KE_UNIT_BISNIS = {
    'fotografi': 'StarFoto',
    'digital printing': 'Star Advertising',
    'adv workshop': 'Star Advertising',
}


class KonflikNama(Exception):
    def __init__(self, pesan):
        super().__init__(pesan)
        self.pesan = pesan


def dilewati(departemen):
    return (departemen or '').strip().lower() in DEPARTEMEN_TANPA_DIVISI


@transaction.atomic
def sinkron_departemen(hr_id, nama, nama_lama=None, unit_bisnis=None):
    """Buat/ubah Divisi dari Departemen HR. Mengembalikan objek Divisi.

    `unit_bisnis` = nama unit yang dipilih di form Departemen HR. Kalau HR belum
    memilih, dipakai pemetaan bawaan berdasarkan nama departemen."""
    nama = (nama or '').strip()
    if not nama:
        raise KonflikNama('Nama departemen kosong.')
    divisi = Divisi.objects.filter(hr_department_id=hr_id).first()
    if divisi is None:
        for kandidat in filter(None, [nama_lama, nama]):
            divisi = Divisi.objects.filter(nama__iexact=kandidat, hr_department_id__isnull=True).first()
            if divisi:
                break
    dipilih_di_hr = bool((unit_bisnis or '').strip())
    unit_nama = (unit_bisnis or '').strip() or DEPARTEMEN_KE_UNIT_BISNIS.get(nama.lower())
    unit = UnitBisnis.objects.filter(nama=unit_nama).first() if unit_nama else None

    if divisi is None:
        if Divisi.objects.filter(nama__iexact=nama).exists():
            raise KonflikNama(f"Divisi '{nama}' sudah dipakai departemen lain di Bintang.")
        return Divisi.objects.create(nama=nama, unit_bisnis=unit, hr_department_id=hr_id)

    if divisi.nama.lower() != nama.lower() and Divisi.objects.filter(nama__iexact=nama).exclude(pk=divisi.pk).exists():
        raise KonflikNama(f"Nama divisi '{nama}' sudah dipakai divisi lain di Bintang.")
    divisi.nama = nama
    divisi.hr_department_id = hr_id
    # Pilihan di HR menjadi acuan; pemetaan bawaan hanya mengisi yang masih kosong.
    if unit and (dipilih_di_hr or not divisi.unit_bisnis_id):
        divisi.unit_bisnis = unit
    divisi.save()
    return divisi


def _nama_tahap_bebas(nama, jabatan, departemen, kecuali_pk=None):
    """TahapProses.nama unik global: kalau bentrok, tambahkan jabatan lalu departemen."""
    for kandidat in (nama, f'{nama} ({jabatan})' if jabatan else None, f'{nama} ({departemen})' if departemen else None):
        if not kandidat:
            continue
        qs = TahapProses.objects.filter(nama__iexact=kandidat)
        if kecuali_pk:
            qs = qs.exclude(pk=kecuali_pk)
        if not qs.exists():
            return kandidat
    raise KonflikNama(f"Nama tahap '{nama}' sudah dipakai di Bintang.")


@transaction.atomic
def sinkron_peran_jabatan(hr_id, nama, nama_lama, jabatan, departemen, departemen_hr_id, unit_bisnis=None):
    """Buat/ubah Tahap Proses dari Peran Jabatan HR. Mengembalikan TahapProses."""
    nama = (nama or '').strip()
    if not nama:
        raise KonflikNama('Nama peran jabatan kosong.')
    divisi = sinkron_departemen(departemen_hr_id, departemen, unit_bisnis=unit_bisnis)
    tahap = TahapProses.objects.filter(hr_job_role_id=hr_id).first()
    if tahap is None:
        for kandidat in filter(None, [nama_lama, nama]):
            tahap = TahapProses.objects.filter(nama__iexact=kandidat, divisi=divisi, hr_job_role_id__isnull=True).first()
            if tahap:
                break
    if tahap is None:
        urutan = (TahapProses.objects.filter(divisi=divisi).aggregate(m=Max('urutan'))['m'] or 0) + 1
        return TahapProses.objects.create(
            nama=_nama_tahap_bebas(nama, jabatan, departemen), divisi=divisi, urutan=urutan, hr_job_role_id=hr_id,
        )
    # Sudah ada: nama mengikuti HR (kecuali bentrok), pindah divisi bila jabatannya pindah departemen.
    if tahap.nama.lower() not in (nama.lower(), f'{nama} ({jabatan})'.lower(), f'{nama} ({departemen})'.lower()):
        tahap.nama = _nama_tahap_bebas(nama, jabatan, departemen, kecuali_pk=tahap.pk)
    tahap.divisi = divisi
    tahap.hr_job_role_id = hr_id
    tahap.save()
    return tahap


def divisi_untuk_departemen(nama_departemen):
    """Divisi Bintang untuk nama departemen HR (dipakai mengisi divisi staff baru)."""
    if not nama_departemen or dilewati(nama_departemen):
        return None
    return Divisi.objects.filter(nama__iexact=nama_departemen.strip()).first()
