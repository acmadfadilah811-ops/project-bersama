"""Posting Gaji: data slip final dari HR (Horilla) -> jurnal akuntansi Bintang.

Alur (lihat koordinasi/Desain Payroll ke Finance.md):
  pratinjau -> posting (pengakuan) -> [koreksi] -> bayar
- Bintang MENARIK data dari HR (endpoint baca-saja); angka selalu ditarik ulang
  saat posting, bukan dari browser (M6).
- Jurnal HANYA lewat create_journal_entry() (M2), atomik bersama catatan
  PayrollPosting (M5), pembalikan lewat reversed_entry (M7).
- Fail-closed: komponen yang belum dipetakan, slip yang belum final, atau
  jurnal yang tak seimbang menolak posting -- tidak ada jurnal setengah jadi.
"""

import calendar
import os
from datetime import date
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation

import requests
from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from ..models import (
    Account, AccountingSettings, JournalAuditLog, JournalEntry,
    PayrollComponentMapping, PayrollPosting,
)
from .journal import create_journal_entry
from .payroll_accounts import get_payroll_account_mappings

DUA_DESIMAL = Decimal("0.01")
JUDUL_PAJAK_BAWAAN = "Pajak (bawaan Horilla)"
TIMEOUT_HR = 20


class PayrollError(Exception):
    """Aturan Posting Gaji dilanggar / sumber data bermasalah -> HTTP 400."""


class PayrollSumberError(PayrollError):
    """HR tidak dapat dihubungi / responsnya tidak valid."""


def _d(nilai):
    try:
        return Decimal(str(nilai if nilai not in (None, "") else 0)).quantize(DUA_DESIMAL, ROUND_HALF_UP)
    except (InvalidOperation, ValueError):
        raise PayrollError(f"Angka dari HR tidak valid: {nilai!r}.")


def _pesan(exc):
    if isinstance(exc, ValidationError):
        return "; ".join(getattr(exc, "messages", [str(exc)]))
    return str(exc)


def akhir_bulan(tahun, bulan):
    return date(tahun, bulan, calendar.monthrange(tahun, bulan)[1])


# --------------------------------------------------------------------------- HR

def ambil_payroll_hr(tahun, bulan):
    """Tarik ringkasan slip final dari HR. Gagal apa pun -> PayrollSumberError."""
    from api.services.insights_bridge import DEFAULT_HR_INSIGHTS_URL

    kunci = os.getenv("INSIGHTS_BRIDGE_API_KEY")
    if not kunci:
        raise PayrollSumberError("Jembatan HR belum dikonfigurasi (INSIGHTS_BRIDGE_API_KEY kosong).")
    base = os.getenv("HR_INSIGHTS_URL", DEFAULT_HR_INSIGHTS_URL).rstrip("/")
    try:
        r = requests.get(
            f"{base}/payroll/", params={"tahun": tahun, "bulan": bulan},
            headers={"X-Api-Key": kunci, "X-Forwarded-Proto": "https"}, timeout=TIMEOUT_HR,
        )
        r.raise_for_status()
        data = r.json()
    except (requests.RequestException, ValueError) as exc:
        raise PayrollSumberError(f"Tidak bisa mengambil data gaji dari HR: {exc}")
    if not isinstance(data, dict) or "slip" not in data or "potongan" not in data:
        raise PayrollSumberError("Respons HR tidak sesuai format yang diharapkan.")
    return data


# ------------------------------------------------------------------ penyusunan

def susun_jurnal(data, akun, pemetaan):
    """Fungsi murni: data HR + akun inti + {judul: PayrollComponentMapping}.

    Kembalikan {lines, masalah, peringatan, ringkasan}. `masalah` tidak kosong =
    posting harus ditolak. `lines`: [{account, debit, kredit, description}]."""
    masalah, peringatan = [], []
    slip = data.get("slip", [])
    dikecualikan = data.get("dikecualikan", {}) or {}
    belum_final = sum(int(v or 0) for v in dikecualikan.values())

    if belum_final:
        masalah.append(f"Masih ada {belum_final} slip yang belum final (draft/review) di periode ini.")
    if not slip:
        masalah.append("Tidak ada slip berstatus final di periode ini.")

    total_gross = sum((_d(s.get("gross_pay")) for s in slip), Decimal(0))
    total_deduction = sum((_d(s.get("deduction")) for s in slip), Decimal(0))
    total_net = sum((_d(s.get("net_pay")) for s in slip), Decimal(0))

    tidak_konsisten = [str(s.get("id")) for s in slip if abs(_d(s.get("selisih"))) > DUA_DESIMAL]
    if tidak_konsisten:
        masalah.append(
            "Slip dengan angka tidak konsisten (gross - potongan - potongan net != net): "
            + ", ".join(tidak_konsisten) + "."
        )

    baris = [dict(b) for b in data.get("potongan", [])]
    pajak = _d(data.get("federal_tax_total"))
    if pajak > 0:
        baris.append({"judul": JUDUL_PAJAK_BAWAAN, "total": str(pajak), "iuran_perusahaan_total": "0",
                      "kelompok": "dalam_total"})

    terdaftar_dalam_total = sum(
        (_d(b.get("total")) for b in baris if b.get("kelompok", "dalam_total") == "dalam_total"), Decimal(0))
    residu = total_deduction - terdaftar_dalam_total
    if residu < -DUA_DESIMAL:
        masalah.append("Total potongan slip lebih kecil dari jumlah komponen potongannya.")
    residu = max(residu, Decimal(0))

    kredit_akun = {}      # Account -> Decimal
    pengurang_terpetakan = Decimal(0)
    total_iuran = Decimal(0)
    tanpa_pemetaan = []
    for b in baris:
        judul = str(b.get("judul") or "").strip()
        jumlah = _d(b.get("total"))
        iuran = _d(b.get("iuran_perusahaan_total"))
        if jumlah == 0 and iuran == 0:
            continue
        m = pemetaan.get(judul)
        if not m:
            tanpa_pemetaan.append(judul or "(tanpa judul)")
            continue
        if m.jenis == PayrollComponentMapping.Jenis.PENGURANG_BEBAN:
            pengurang_terpetakan += jumlah
        else:
            if not m.akun_id or not m.akun.is_active:
                masalah.append(f"Pemetaan '{judul}' tidak punya akun aktif.")
            else:
                kredit_akun[m.akun] = kredit_akun.get(m.akun, Decimal(0)) + jumlah
        if iuran:
            if not m.akun_iuran_perusahaan_id or not m.akun_iuran_perusahaan.is_active:
                masalah.append(f"Iuran perusahaan '{judul}' belum punya akun hutang iuran yang aktif.")
            else:
                kredit_akun[m.akun_iuran_perusahaan] = kredit_akun.get(m.akun_iuran_perusahaan, Decimal(0)) + iuran
            total_iuran += iuran
    if tanpa_pemetaan:
        masalah.append("Komponen potongan belum dipetakan ke akun: " + ", ".join(sorted(set(tanpa_pemetaan))) + ".")
    if total_iuran > 0 and not akun["employer_expense"]:
        masalah.append("Ada iuran perusahaan tetapi akun Beban iuran perusahaan belum diisi di Pengaturan Akuntansi.")

    beban_gaji = total_gross - residu - pengurang_terpetakan
    if beban_gaji < 0:
        masalah.append("Biaya gaji hasil hitung negatif -- periksa data slip di HR.")

    lines = []
    if beban_gaji > 0:
        lines.append({"account": akun["expense"], "debit": beban_gaji, "kredit": Decimal(0),
                      "description": "Biaya gaji"})
    if total_iuran > 0 and akun["employer_expense"]:
        lines.append({"account": akun["employer_expense"], "debit": total_iuran, "kredit": Decimal(0),
                      "description": "Beban iuran perusahaan"})
    if total_net > 0:
        lines.append({"account": akun["payable"], "debit": Decimal(0), "kredit": total_net,
                      "description": "Hutang gaji"})
    for a, jml in kredit_akun.items():
        if jml > 0:
            lines.append({"account": a, "debit": Decimal(0), "kredit": jml, "description": a.name})

    debit = sum((l["debit"] for l in lines), Decimal(0))
    kredit = sum((l["kredit"] for l in lines), Decimal(0))
    if not masalah and debit != kredit:
        masalah.append(f"Jurnal tidak seimbang (debit {debit} != kredit {kredit}) -- periksa data slip di HR.")

    if residu > 0:
        peringatan.append(f"Potongan tanpa judul (mis. potong hari tak masuk) sebesar {residu} "
                          "diperlakukan sebagai pengurang biaya gaji.")

    return {
        "lines": lines, "masalah": masalah, "peringatan": peringatan,
        "ringkasan": {
            "jumlah_slip": len(slip), "total_gross": total_gross, "total_deduction": total_deduction,
            "total_net": total_net, "total_iuran_perusahaan": total_iuran,
            "total_debit": debit, "total_kredit": kredit,
        },
    }


def _pemetaan():
    return {m.judul: m for m in PayrollComponentMapping.objects.select_related("akun", "akun_iuran_perusahaan")}


def _akun_inti():
    try:
        return get_payroll_account_mappings()
    except ValidationError as exc:
        raise PayrollError(_pesan(exc))


def _bentuk_lines(lines):
    return [{"account": l["account"], "debit": l["debit"], "kredit": l["kredit"],
             "description": l["description"]} for l in lines]


# ------------------------------------------------------------------- pratinjau

def pratinjau(tahun, bulan):
    data = ambil_payroll_hr(tahun, bulan)
    akun = _akun_inti()
    hasil = susun_jurnal(data, akun, _pemetaan())
    aktif = PayrollPosting.objects.filter(tahun=tahun, bulan=bulan, status="aktif").first()
    if not aktif:
        status_posting = "belum"
    elif aktif.payload_hash == data.get("hash"):
        status_posting = "sudah"
    else:
        status_posting = "berbeda"
    return {
        "periode": f"{tahun:04d}-{bulan:02d}", "status_posting": status_posting,
        "posting_aktif": aktif, "hash_hr": data.get("hash"), "data_hr": data, **hasil,
    }


# --------------------------------------------------------------------- posting

def _kunci_global():
    """Mutex per-instalasi: satu proses Posting Gaji pada satu waktu."""
    if not AccountingSettings.objects.select_for_update().first():
        raise PayrollError("Pengaturan Akuntansi belum diinisialisasi.")


def _jurnal_pengakuan(tahun, bulan, deskripsi, lines, user):
    try:
        return create_journal_entry(
            date=akhir_bulan(tahun, bulan), lines=_bentuk_lines(lines), description=deskripsi,
            source_type=JournalEntry.SourceType.PAYROLL, source_id=None, created_by=user,
        )
    except ValidationError as exc:
        raise PayrollError(_pesan(exc))


def _buat_posting(tahun, bulan, versi, user):
    """Tarik data HR terbaru, susun & validasi, buat jurnal + catatan PayrollPosting.
    Wajib dipanggil di dalam transaksi atomik pemanggil."""
    data = ambil_payroll_hr(tahun, bulan)
    hasil = susun_jurnal(data, _akun_inti(), _pemetaan())
    if hasil["masalah"]:
        raise PayrollError(" ".join(hasil["masalah"]))
    r = hasil["ringkasan"]
    deskripsi = f"Gaji {tahun:04d}-{bulan:02d}" + (f" (koreksi v{versi})" if versi > 1 else "")
    entry = _jurnal_pengakuan(tahun, bulan, deskripsi, hasil["lines"], user)
    posting_baru = PayrollPosting.objects.create(
        tahun=tahun, bulan=bulan, versi=versi, payload_hash=data.get("hash", ""),
        payload=data, total_gross=r["total_gross"], total_net=r["total_net"],
        journal_entry=entry, posted_by=user,
    )
    # source_id jurnal = id PayrollPosting (unik per versi), disambungkan setelah barisnya ada.
    JournalEntry.objects.filter(pk=entry.pk).update(source_id=posting_baru.pk)
    entry.source_id = posting_baru.pk  # samakan objek di memori dengan yang tersimpan
    return posting_baru


@transaction.atomic
def posting(tahun, bulan, user):
    _kunci_global()
    if PayrollPosting.objects.filter(tahun=tahun, bulan=bulan, status="aktif").exists():
        raise PayrollError("Periode ini sudah diposting. Bila data HR berubah, gunakan Koreksi.")
    versi = (PayrollPosting.objects.filter(tahun=tahun, bulan=bulan).count()) + 1
    return _buat_posting(tahun, bulan, versi, user)


def _balik(entry, user, catatan):
    existing = JournalEntry.objects.filter(reversed_entry=entry, status=JournalEntry.Status.POSTED).first()
    if existing:
        return existing
    deskripsi = f"Pembalikan {entry.entry_number}: {entry.description}"
    lines = [
        {"account": l.account, "debit": l.kredit, "kredit": l.debit, "description": deskripsi,
         "external_document_no": l.external_document_no}
        for l in entry.lines.all()
    ]
    try:
        rev = create_journal_entry(
            date=timezone.localdate(), lines=lines, description=deskripsi,
            source_type=entry.source_type, source_id=None, created_by=user,
        )
    except ValidationError as exc:
        raise PayrollError(_pesan(exc))
    rev.reversed_entry = entry
    rev.save(update_fields=["reversed_entry"])
    JournalAuditLog.objects.create(
        journal_entry=rev, action=JournalAuditLog.Action.REVERSED, actor=user, note=catatan)
    return rev


@transaction.atomic
def koreksi(tahun, bulan, user):
    """Balik posting aktif lalu posting ulang dari data HR terbaru -- atomik: bila
    posting baru ditolak, posting lama tetap aktif."""
    _kunci_global()
    lama = PayrollPosting.objects.select_for_update().filter(tahun=tahun, bulan=bulan, status="aktif").first()
    if not lama:
        raise PayrollError("Belum ada posting aktif untuk periode ini.")
    if lama.payment_journal_entry_id:
        raise PayrollError("Gaji periode ini sudah dibayar. Balik pembayaran terlebih dahulu sebelum koreksi.")
    _balik(lama.journal_entry, user, f"Koreksi Posting Gaji {tahun:04d}-{bulan:02d} v{lama.versi}")
    lama.status = PayrollPosting.Status.DIBALIK
    lama.dibalik_oleh, lama.dibalik_pada = user, timezone.now()
    lama.save(update_fields=["status", "dibalik_oleh", "dibalik_pada"])
    return _buat_posting(tahun, bulan, lama.versi + 1, user)


# ----------------------------------------------------------------- pembayaran

@transaction.atomic
def bayar(tahun, bulan, akun_kas_id, tanggal, user):
    """Bayar gaji periode ini: Dr Hutang gaji, Cr Kas/Bank. Nominal = total net yang
    SUDAH diakui (bukan data HR terbaru) supaya hutang gaji tepat nol."""
    _kunci_global()
    p = PayrollPosting.objects.select_for_update().filter(tahun=tahun, bulan=bulan, status="aktif").first()
    if not p:
        raise PayrollError("Gaji periode ini belum diposting.")
    if p.payment_journal_entry_id:
        raise PayrollError("Gaji periode ini sudah dibayar.")
    akun = _akun_inti()
    kas = Account.objects.filter(
        pk=akun_kas_id, is_active=True, account_type=Account.AccountType.ASSET,
        classification__name="Kas & Bank",
    ).first()
    if not kas:
        raise PayrollError("Akun pembayaran harus berupa akun Kas & Bank yang aktif.")
    if p.total_net <= 0:
        raise PayrollError("Total gaji bersih nol -- tidak ada yang dibayar.")
    ket = f"Pembayaran gaji {tahun:04d}-{bulan:02d}"
    try:
        entry = create_journal_entry(
            date=tanggal or timezone.localdate(),
            lines=[
                {"account": akun["payable"], "debit": p.total_net, "kredit": 0, "description": ket},
                {"account": kas, "debit": 0, "kredit": p.total_net, "description": ket},
            ],
            description=ket, source_type=JournalEntry.SourceType.PAYROLL_PAYMENT,
            source_id=p.pk, created_by=user,
        )
    except ValidationError as exc:
        raise PayrollError(_pesan(exc))
    p.payment_journal_entry = entry
    p.dibayar_oleh, p.dibayar_pada = user, timezone.now()
    p.save(update_fields=["payment_journal_entry", "dibayar_oleh", "dibayar_pada"])
    return p
