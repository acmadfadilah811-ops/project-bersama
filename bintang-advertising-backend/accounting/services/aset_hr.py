"""Aset dari HR -> Aset Tetap akuntansi (2026-11-10).

HR (Horilla) memegang data fisik aset (nama, kategori, pemegang, kondisi, tanggal & harga
beli); ERP memegang data akuntansinya (akun, umur manfaat, residu, penyusutan). HR memilih
aset mana yang masuk akuntansi dan mengirimnya lewat /api/bridge/hr-aset/. Kiriman itu
hanya masuk ANTREAN (AsetHRMasuk) -- tidak ada jurnal. Finance melengkapi akun & umur
manfaat lalu memprosesnya; baru saat itu FixedAsset + jurnal perolehan dibuat lewat
create_fixed_asset (aturan saldo awal & akumulasi awal ikut berlaku).
"""
from datetime import date
from decimal import Decimal, InvalidOperation

from django.core.exceptions import ValidationError
from django.db import transaction

from ..models import AsetHRMasuk, FixedAsset, NotifikasiKeuangan
from .assets import create_fixed_asset
from .depreciation import get_book_value

# Status HR yang berarti aset tidak lagi dipakai/ada -> Finance perlu meninjau pelepasan aset.
STATUS_HR_BERMASALAH = {"Not-Available"}


class AsetHRError(Exception):
    pass


def _tanggal(nilai):
    try:
        return date.fromisoformat(str(nilai or "").strip())
    except ValueError:
        raise AsetHRError("Tanggal beli wajib diisi (format YYYY-MM-DD) sebelum aset masuk akuntansi.")


def _harga(nilai):
    try:
        harga = Decimal(str(nilai or "0")).quantize(Decimal("1"))
    except InvalidOperation:
        raise AsetHRError("Harga beli tidak valid.")
    if harga <= 0:
        raise AsetHRError("Harga beli wajib diisi (lebih dari 0) sebelum aset masuk akuntansi.")
    return harga


def _notifikasi(masuk, judul, pesan, akhiran):
    NotifikasiKeuangan.objects.get_or_create(
        kunci=f"aset-hr-{masuk.hr_asset_id}-{akhiran}"[:120],
        defaults={
            "jenis": NotifikasiKeuangan.Jenis.ASET_HR,
            "judul": judul[:200],
            "pesan": pesan[:2000],
            "tautan": "/accounting/daftar-aset",
            "data": {"hr_asset_id": masuk.hr_asset_id, "aset_hr_masuk_id": masuk.id},
        },
    )


@transaction.atomic
def terima_dari_hr(data):
    """Tambah/perbarui kiriman HR. Kiriman ulang aset yang sudah diproses hanya
    memperbarui data fisik (pemegang, status); perubahan harga/tanggal atau status
    bermasalah menandai `perlu_ditinjau` untuk Finance."""
    try:
        hr_id = int(data.get("hr_asset_id"))
    except (TypeError, ValueError):
        raise AsetHRError("hr_asset_id wajib berupa angka.")
    nama = str(data.get("nama") or "").strip()[:255]
    kode = str(data.get("kode") or "").strip()[:50]
    if not nama or not kode:
        raise AsetHRError("Kode dan nama aset wajib diisi.")
    isi = {
        "kode": kode,
        "nama": nama,
        "kategori": str(data.get("kategori") or "").strip()[:100],
        "tanggal_beli": _tanggal(data.get("tanggal_beli")),
        "harga": _harga(data.get("harga")),
        "jumlah": max(1, int(data.get("jumlah") or 1)),
        "pemegang": str(data.get("pemegang") or "").strip()[:150],
        "status_hr": str(data.get("status_hr") or "").strip()[:40],
        "keterangan": str(data.get("keterangan") or "")[:2000],
    }

    masuk = AsetHRMasuk.objects.select_for_update().filter(hr_asset_id=hr_id).first()
    if masuk is None:
        masuk = AsetHRMasuk.objects.create(hr_asset_id=hr_id, **isi)
        _notifikasi(masuk, f"Aset baru dari HR: {masuk.kode} - {masuk.nama}",
                    "Lengkapi akun dan umur manfaat di Akuntansi > Daftar Aset > Aset dari HR.", "masuk")
        return masuk

    if masuk.status == AsetHRMasuk.Status.DIPROSES:
        berubah_akuntansi = (masuk.harga, masuk.tanggal_beli, masuk.jumlah) != (isi["harga"], isi["tanggal_beli"], isi["jumlah"])
        bermasalah = isi["status_hr"] in STATUS_HR_BERMASALAH
        for kolom in ("kode", "nama", "kategori", "pemegang", "status_hr", "keterangan"):
            setattr(masuk, kolom, isi[kolom])
        if berubah_akuntansi or bermasalah:
            masuk.perlu_ditinjau = True
            alasan = "status di HR: tidak tersedia (hilang/rusak?)" if bermasalah else "harga/tanggal/jumlah di HR berubah"
            _notifikasi(masuk, f"Tinjau aset {masuk.kode} - {masuk.nama}",
                        f"Aset tetap ini masih aktif di akuntansi, tetapi {alasan}. "
                        "Bila aset sudah tidak ada, proses Pelepasan Aset.",
                        f"tinjau-{isi['status_hr']}-{isi['harga']}-{isi['tanggal_beli']}")
        masuk.save()
        return masuk

    for kolom, nilai in isi.items():
        setattr(masuk, kolom, nilai)
    if masuk.status in (AsetHRMasuk.Status.DITARIK, AsetHRMasuk.Status.DITOLAK):
        masuk.status = AsetHRMasuk.Status.MENUNGGU
        masuk.alasan_tolak = ""
        _notifikasi(masuk, f"Aset dari HR dikirim ulang: {masuk.kode} - {masuk.nama}",
                    "Lengkapi akun dan umur manfaat di Akuntansi > Daftar Aset > Aset dari HR.",
                    f"ulang-{masuk.diperbarui_pada:%Y%m%d%H%M%S}")
    masuk.save()
    return masuk


@transaction.atomic
def tarik_dari_hr(hr_asset_id):
    masuk = AsetHRMasuk.objects.select_for_update().filter(hr_asset_id=hr_asset_id).first()
    if masuk is None:
        return None
    if masuk.status == AsetHRMasuk.Status.DIPROSES:
        raise AsetHRError(
            "Aset ini sudah tercatat sebagai aset tetap di akuntansi. Untuk mengeluarkannya, "
            "Finance perlu memproses Pelepasan Aset."
        )
    if masuk.status == AsetHRMasuk.Status.MENUNGGU:
        masuk.status = AsetHRMasuk.Status.DITARIK
        masuk.save(update_fields=["status", "diperbarui_pada"])
    return masuk


def ringkasan_untuk_hr(masuk):
    """Status yang ditampilkan di HR untuk satu aset."""
    hasil = {
        "hr_asset_id": masuk.hr_asset_id,
        "status": masuk.status,
        "label": masuk.get_status_display(),
        "alasan_tolak": masuk.alasan_tolak,
        "kode_aset_akuntansi": None,
        "nilai_buku": None,
    }
    aset = masuk.fixed_asset
    if aset is not None:
        hasil["kode_aset_akuntansi"] = aset.asset_code
        hasil["nilai_buku"] = str(get_book_value(aset))
        if aset.status == FixedAsset.Status.DISPOSED:
            hasil["label"] = "Sudah dilepas di akuntansi"
    return hasil


@transaction.atomic
def proses(masuk, data, actor):
    """Jadikan kiriman HR aset tetap. `data` = field FixedAssetCreateSerializer yang sudah valid."""
    masuk = AsetHRMasuk.objects.select_for_update().get(pk=masuk.pk)
    if masuk.status != AsetHRMasuk.Status.MENUNGGU:
        raise ValidationError(f"Aset ini berstatus '{masuk.get_status_display()}', tidak bisa diproses.")
    aset = create_fixed_asset(data={**data, "hr_asset_id": masuk.hr_asset_id}, created_by=actor)
    masuk.status = AsetHRMasuk.Status.DIPROSES
    masuk.fixed_asset = aset
    masuk.perlu_ditinjau = False
    masuk.save(update_fields=["status", "fixed_asset", "perlu_ditinjau", "diperbarui_pada"])
    return aset


@transaction.atomic
def tolak(masuk, alasan):
    masuk = AsetHRMasuk.objects.select_for_update().get(pk=masuk.pk)
    if masuk.status != AsetHRMasuk.Status.MENUNGGU:
        raise ValidationError("Hanya aset yang menunggu yang bisa ditolak.")
    masuk.status = AsetHRMasuk.Status.DITOLAK
    masuk.alasan_tolak = (alasan or "").strip()[:500] or "Bukan aset tetap (dibebankan langsung)."
    masuk.save(update_fields=["status", "alasan_tolak", "diperbarui_pada"])
    return masuk


def usulan_isian(masuk):
    """Isian bawaan form proses: dari kiriman HR + akun/umur aset terakhir di kategori HR yang sama."""
    contoh = (
        FixedAsset.objects.filter(asal_hr__kategori=masuk.kategori)
        .exclude(asal_hr__kategori="")
        .order_by("-created_at").first()
    )
    return {
        "asset_code": masuk.kode,
        "name": masuk.nama,
        "acquisition_date": masuk.tanggal_beli,
        "acquisition_cost": masuk.harga * masuk.jumlah,
        "asset_account": contoh.asset_account_id if contoh else None,
        "depreciation_expense_account": contoh.depreciation_expense_account_id if contoh else None,
        "accumulated_depreciation_account": contoh.accumulated_depreciation_account_id if contoh else None,
        "useful_life_months": contoh.useful_life_months if contoh else None,
    }
