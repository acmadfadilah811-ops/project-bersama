"""Catatan atas Laporan Keuangan (CALK) otomatis -- acuan SAK EP (2026-11-15).

Disusun dari data yang sama dengan Neraca / Laba Rugi / Perubahan Ekuitas, ditambah register
aset tetap dan piutang pesanan. Kebijakan akuntansi ditulis sesuai cara sistem ini benar-benar
mencatat (bukan template umum). Hal yang belum diterapkan diungkapkan apa adanya di bagian
terakhir, bukan disembunyikan.

Bukan pengganti review akuntan: CALK ini adalah draf yang disusun dari pembukuan sistem.
"""
from decimal import Decimal

from django.db.models import Q, Sum

from ..models import AccountingSettings, FixedAsset, JournalEntry, JournalEntryLine
from .ledger import get_balance_sheet, get_changes_in_equity, get_income_statement
from .opening_balance import saldo_akun_saldo_awal

NOL = Decimal("0")


def _nama_usaha():
    from api.models import SystemConfig

    nilai = SystemConfig.objects.filter(key="bisnis_nama_bisnis").values_list("value", flat=True).first()
    return (nilai or "").strip() or "Star Photo & Advertising"


def _baris(rows):
    """Rincian akun bernilai (akun nol tidak ditampilkan di catatan)."""
    return [{"kode": r["code"], "nama": r["name"], "nilai": r["amount"]} for r in rows if r["amount"]]


def _total(rows):
    return sum((r["amount"] for r in rows), NOL)


def _aset_tetap(date_from, date_to):
    """Mutasi aset tetap per aset: saldo awal, penambahan, pelepasan, akumulasi, nilai buku."""
    baris = []
    jumlah = {k: NOL for k in ("awal", "tambah", "lepas", "akhir", "akumulasi", "nilai_buku", "penyusutan_periode")}
    aset = FixedAsset.objects.filter(acquisition_date__lte=date_to).exclude(
        status=FixedAsset.Status.DISPOSED, disposal_date__lt=date_from,
    ).select_related("accumulated_depreciation_account", "depreciation_expense_account").order_by("asset_code")
    for a in aset:
        biaya = Decimal(a.acquisition_cost)
        awal = biaya if a.acquisition_date < date_from else NOL
        tambah = biaya if a.acquisition_date >= date_from else NOL
        dilepas = a.status == FixedAsset.Status.DISPOSED and a.disposal_date and a.disposal_date <= date_to
        lepas = biaya if dilepas else NOL
        akhir = awal + tambah - lepas
        jurnal = JournalEntryLine.objects.filter(
            journal_entry__status=JournalEntry.Status.POSTED,
            journal_entry__source_id=a.id,
            journal_entry__source_type__in=[
                JournalEntry.SourceType.ASSET_DEPRECIATION, JournalEntry.SourceType.ASSET_ACQUISITION,
            ],
            account_id=a.accumulated_depreciation_account_id,
        )
        akumulasi = NOL if dilepas else (
            jurnal.filter(journal_entry__date__lte=date_to).aggregate(v=Sum("kredit"))["v"] or NOL
        )
        penyusutan = JournalEntryLine.objects.filter(
            journal_entry__status=JournalEntry.Status.POSTED,
            journal_entry__source_type=JournalEntry.SourceType.ASSET_DEPRECIATION,
            journal_entry__source_id=a.id,
            journal_entry__date__range=(date_from, date_to),
            account_id=a.depreciation_expense_account_id,
        ).aggregate(v=Sum("debit"))["v"] or NOL
        nilai_buku = akhir - akumulasi
        baris.append({
            "kode": a.asset_code, "nama": a.name, "tanggal_perolehan": a.acquisition_date,
            "umur_bulan": a.useful_life_months, "saldo_awal": awal, "penambahan": tambah, "pelepasan": lepas,
            "saldo_akhir": akhir, "akumulasi": akumulasi, "nilai_buku": nilai_buku,
            "penyusutan_periode": penyusutan,
        })
        for k, v in (("awal", awal), ("tambah", tambah), ("lepas", lepas), ("akhir", akhir),
                     ("akumulasi", akumulasi), ("nilai_buku", nilai_buku), ("penyusutan_periode", penyusutan)):
            jumlah[k] += v
    return {"aset": baris, "jumlah": jumlah}


def _umur_piutang(date_to):
    """Umur piutang pesanan yang belum lunas per tanggal laporan (dari data pesanan)."""
    from api.models import Order

    kelompok = [("0-30 hari", 0, 30), ("31-60 hari", 31, 60), ("61-90 hari", 61, 90), ("> 90 hari", 91, None)]
    hasil = {nama: {"jumlah": 0, "nilai": NOL} for nama, _, _ in kelompok}
    qs = Order.objects.filter(sisa_tagihan__gt=0, waktu__date__lte=date_to).exclude(
        Q(status_global="batal") | Q(status_global="draft") | Q(status_global="quotation")
    ).values_list("waktu", "sisa_tagihan")
    for waktu, sisa in qs:
        umur = (date_to - waktu.date()).days
        for nama, bawah, atas in kelompok:
            if umur >= bawah and (atas is None or umur <= atas):
                hasil[nama]["jumlah"] += 1
                hasil[nama]["nilai"] += Decimal(sisa)
                break
    return [{"umur": nama, **hasil[nama]} for nama, _, _ in kelompok]


def susun_calk(date_from, date_to):
    neraca = get_balance_sheet(date_from, date_to)
    laba_rugi = get_income_statement(date_from, date_to)
    ekuitas = get_changes_in_equity(date_from, date_to)
    settings_row = AccountingSettings.objects.first()
    ppn_aktif = bool(settings_row and settings_row.is_ppn_active)
    mulai = settings_row.accounting_start_date if settings_row else None
    akun_saldo_awal, saldo_saldo_awal = saldo_akun_saldo_awal(date_to)
    aset_tetap = _aset_tetap(date_from, date_to)
    piutang_umur = _umur_piutang(date_to)

    kebijakan = [
        ("Dasar penyusunan",
         "Laporan keuangan disusun berdasarkan Standar Akuntansi Keuangan Entitas Privat (SAK EP) dengan basis akrual "
         "dan konsep biaya historis, kecuali laporan arus kas yang disusun dengan metode langsung. Mata uang penyajian "
         "Rupiah (Rp)."),
        ("Pengakuan pendapatan",
         "Penjualan kasir (POS) diakui saat transaksi lunas. Pesanan (order) diakui sebagai pendapatan saat pesanan "
         "selesai; pembayaran sebelum pesanan selesai dicatat sebagai Pendapatan Diterima di Muka / Uang Muka Pelanggan "
         "(liabilitas). Potongan dan retur penjualan mengurangi pendapatan."),
        ("Piutang usaha",
         "Piutang usaha dicatat sebesar tagihan pesanan yang belum dilunasi. Cadangan kerugian piutang belum dibentuk "
         "(lihat Catatan 'Hal yang belum diterapkan')."),
        ("Persediaan",
         "Persediaan dicatat dengan metode perpetual dan dinilai dengan metode masuk pertama keluar pertama (FIFO). "
         "Harga pokok penjualan dihitung dari lapisan biaya FIFO yang terpakai. Selisih stok opname dibukukan pada "
         "periode opname diposting."),
        ("Aset tetap",
         "Aset tetap dicatat sebesar biaya perolehan dikurangi akumulasi penyusutan (model biaya). Penyusutan dihitung "
         "dengan metode garis lurus sepanjang umur manfaat masing-masing aset, dimulai bulan perolehan, dan dibukukan "
         "tiap bulan. Aset yang diperoleh sebelum mulai pembukuan sistem dicatat sebagai saldo awal beserta akumulasi "
         "penyusutannya. Tanah tidak disusutkan. Penyusutan fiskal (UU PPh Pasal 11) dihitung terpisah untuk keperluan "
         "pajak dan tidak dijurnal."),
        ("Pajak penghasilan",
         "Beban pajak penghasilan disajikan terpisah setelah laba sebelum pajak (akun Beban Pajak Penghasilan). "
         "Pajak tangguhan atas beda temporer belum diakui (lihat Catatan 'Hal yang belum diterapkan')."),
        ("Pajak pertambahan nilai",
         "Perusahaan memungut dan mengkreditkan PPN." if ppn_aktif else
         "PPN tidak diaktifkan di sistem; harga jual dan pembelian dicatat tanpa pemisahan PPN."),
        ("Imbalan kerja",
         "Gaji dan tunjangan diakui sebagai beban pada periode jasa diberikan (posting gaji dari sistem HR). "
         "Liabilitas imbalan pascakerja (pesangon) belum dicadangkan (lihat Catatan 'Hal yang belum diterapkan')."),
    ]

    belum = []
    if saldo_saldo_awal:
        belum.append(
            f"Akun penyeimbang {akun_saldo_awal.code} {akun_saldo_awal.name} masih bersaldo Rp {saldo_saldo_awal:,.0f}. "
            "Akun ini seharusnya nol setelah migrasi saldo awal selesai dan dipindah ke Modal / Laba Ditahan."
        )
    belum += [
        "Cadangan kerugian penurunan nilai piutang belum dibentuk; piutang disajikan sebesar nilai tagihan.",
        "Liabilitas imbalan pascakerja (pesangon sesuai UU Cipta Kerja) belum dihitung dan dicadangkan.",
        "Pajak tangguhan atas beda temporer (mis. penyusutan buku vs fiskal) belum diakui.",
    ]
    tanpa_umur = FixedAsset.objects.filter(status=FixedAsset.Status.ACTIVE, useful_life_months__isnull=True).count()
    if tanpa_umur:
        belum.append(f"{tanpa_umur} aset tetap aktif belum diisi umur manfaatnya sehingga belum disusutkan.")

    return {
        "umum": {
            "nama_usaha": _nama_usaha(),
            "periode_mulai": date_from,
            "periode_akhir": date_to,
            "mulai_pembukuan": mulai,
            "standar": "SAK EP (Standar Akuntansi Keuangan Entitas Privat)",
            "mata_uang": "Rupiah (Rp)",
        },
        "kebijakan": [{"judul": j, "isi": i} for j, i in kebijakan],
        "rincian": [
            {"judul": "Aset lancar", "baris": _baris(neraca["aset_lancar"]), "total": neraca["subtotal_aset_lancar"]},
            {"judul": "Aset tidak lancar", "baris": _baris(neraca["aset_tidak_lancar"]), "total": neraca["subtotal_aset_tidak_lancar"]},
            {"judul": "Liabilitas", "baris": _baris(neraca["kewajiban"]), "total": neraca["subtotal_kewajiban"]},
            {"judul": "Ekuitas", "baris": _baris(neraca["modal"]), "total": neraca["subtotal_modal"]},
            {"judul": "Pendapatan", "baris": _baris(laba_rugi["pendapatan"]), "total": laba_rugi["subtotal_pendapatan"]},
            {"judul": "Harga pokok penjualan", "baris": _baris(laba_rugi["hpp"]), "total": laba_rugi["subtotal_hpp"]},
            {"judul": "Beban usaha", "baris": _baris(laba_rugi["biaya_operasional"]), "total": laba_rugi["total_biaya_operasional"]},
            {"judul": "Pendapatan lain-lain", "baris": _baris(laba_rugi["pendapatan_non_operasional"]),
             "total": laba_rugi["subtotal_pendapatan_non_operasional"]},
            {"judul": "Beban lain-lain", "baris": _baris(laba_rugi["biaya_non_operasional"]),
             "total": laba_rugi["subtotal_biaya_non_operasional"]},
            {"judul": "Beban pajak penghasilan", "baris": _baris(laba_rugi["pajak_penghasilan"]),
             "total": laba_rugi["total_pajak_penghasilan"]},
        ],
        "ringkasan": {
            "total_aset": neraca["total_aset"],
            "total_liabilitas_ekuitas": neraca["total_kewajiban_modal"],
            "laba_kotor": laba_rugi["total_laba_kotor"],
            "laba_usaha": laba_rugi["laba_usaha"],
            "laba_sebelum_pajak": laba_rugi["laba_sebelum_pajak"],
            "laba_setelah_pajak": laba_rugi["laba_setelah_pajak"],
            "ebitda": laba_rugi["ebitda"]["ebitda"],
        },
        "ekuitas": ekuitas,
        "aset_tetap": aset_tetap,
        "umur_piutang": piutang_umur,
        "belum_diterapkan": belum,
        "catatan": "Draf CALK disusun otomatis dari pembukuan sistem; perlu ditinjau akuntan sebelum diterbitkan.",
    }
