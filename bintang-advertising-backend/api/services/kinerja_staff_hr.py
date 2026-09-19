"""Rekap kinerja staff per bulan utk dipakai HR (Horilla) sebagai bahan analisa
& patokan insentif penggajian (permintaan user 2026-09-19: HR jadi acuan
slip gaji, Bintang menyuplai data kerjanya).

Definisi "insentif bulan X" SAMA dgn Timecard (hr/views.py): jumlah kolom
JobBoard.insentif utk job berstatus 'selesai' yang waktu_selesai-nya jatuh di
bulan itu (zona waktu lokal). Job 'gagal' dihitung terpisah, TIDAK masuk
insentif. Kunci penghubung ke HR = CustomUser.hr_employee_id (= pk Employee
di Horilla).

Akun staff yang aktif bekerja di bulan itu tapi BELUM punya hr_employee_id
dikembalikan terpisah (`staff_tanpa_hr_employee_id`) -- supaya HR tahu ada
insentif yang belum bisa ditagihkan ke siapa pun, bukan hilang diam-diam."""
import calendar
from datetime import date, datetime, time, timedelta

from django.db.models import Avg, Count, DurationField, ExpressionWrapper, F, Q, Sum
from django.utils import timezone

from ..models import CustomUser, JobBoard


def batas_bulan(tahun, bulan):
    """(awal_inklusif, akhir_eksklusif) sbg datetime aware zona waktu lokal."""
    awal = timezone.make_aware(datetime.combine(date(tahun, bulan, 1), time.min))
    if bulan == 12:
        berikut = date(tahun + 1, 1, 1)
    else:
        berikut = date(tahun, bulan + 1, 1)
    return awal, timezone.make_aware(datetime.combine(berikut, time.min))


def _menit(durasi):
    if isinstance(durasi, timedelta):
        return round(durasi.total_seconds() / 60, 1)
    return None


def hitung_kinerja_bulanan(tahun, bulan):
    from hr.models import Absensi

    awal, akhir = batas_bulan(tahun, bulan)
    durasi = ExpressionWrapper(F('waktu_selesai') - F('waktu_mulai'), output_field=DurationField())

    baris_job = {
        r['pic_staff_id']: r
        for r in (
            JobBoard.objects
            .filter(
                pic_staff__isnull=False, waktu_selesai__gte=awal, waktu_selesai__lt=akhir,
                status_pekerjaan__in=['selesai', 'gagal'],
            )
            .values('pic_staff_id')
            .annotate(
                job_selesai=Count('id', filter=Q(status_pekerjaan='selesai')),
                job_gagal=Count('id', filter=Q(status_pekerjaan='gagal')),
                total_insentif=Sum('insentif', filter=Q(status_pekerjaan='selesai')),
                rata_durasi=Avg(durasi, filter=Q(status_pekerjaan='selesai', waktu_mulai__isnull=False)),
            )
        )
    }

    hari_terakhir = calendar.monthrange(tahun, bulan)[1]
    jam_kerja = {}
    hari_hadir = {}
    for a in Absensi.objects.filter(
        tanggal__gte=date(tahun, bulan, 1), tanggal__lte=date(tahun, bulan, hari_terakhir),
        staff__role='staff',
    ):
        jam_kerja[a.staff_id] = jam_kerja.get(a.staff_id, 0) + (a.durasi_kerja_jam or 0)
        if a.status == 'hadir':
            hari_hadir[a.staff_id] = hari_hadir.get(a.staff_id, 0) + 1

    aktif_ids = set(baris_job) | set(jam_kerja)
    staff_list = CustomUser.objects.filter(role='staff', pk__in=aktif_ids).select_related('divisi')

    tertaut, tanpa_hr = [], []
    for u in sorted(staff_list, key=lambda x: x.username):
        j = baris_job.get(u.pk, {})
        item = {
            'username': u.username,
            'nama': u.get_full_name() or u.username,
            'divisi': u.divisi.nama if u.divisi else None,
            'job_selesai': j.get('job_selesai', 0),
            'job_gagal': j.get('job_gagal', 0),
            'total_insentif': int(j.get('total_insentif') or 0),
            'rata_rata_durasi_menit': _menit(j.get('rata_durasi')),
            'total_jam_kerja_sesi_bintang': round(jam_kerja.get(u.pk, 0), 2),
            'hari_hadir_sesi_bintang': hari_hadir.get(u.pk, 0),
        }
        if u.hr_employee_id:
            item['hr_employee_id'] = u.hr_employee_id
            tertaut.append(item)
        else:
            tanpa_hr.append(item)

    return {
        'periode': f'{tahun:04d}-{bulan:02d}',
        'tahun': tahun,
        'bulan': bulan,
        'staff': tertaut,
        'staff_tanpa_hr_employee_id': tanpa_hr,
    }
