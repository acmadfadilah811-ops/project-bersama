"""Pemilihan akun & departemen jurnal per unit bisnis (2026-10-11).

Satu pintu untuk semua posting transaksi kasir/pesanan: akun pengganti unit
dipakai bila diisi, selain itu akun umum Pengaturan Akuntansi (perilaku lama
tidak berubah selama Akun Unit Bisnis belum diatur).
"""
from ..models.unit_bisnis import AkunUnitBisnis

FIELD_PENGGANTI = (
    "order_sales_revenue_account",
    "pos_sales_revenue_account",
    "pos_cogs_expense_account",
    "order_hpp_expense_account",
)


def konfigurasi(unit_bisnis_id):
    if not unit_bisnis_id:
        return None
    return AkunUnitBisnis.objects.select_related("department", *FIELD_PENGGANTI, "kas_tunai_account").filter(
        unit_bisnis_id=unit_bisnis_id,
    ).first()


def akun(settings_row, field, unit_bisnis_id):
    """Akun `field` untuk unit ini: pengganti unit, atau akun umum."""
    if field in FIELD_PENGGANTI:
        cfg = konfigurasi(unit_bisnis_id)
        pengganti = getattr(cfg, field, None) if cfg else None
        if pengganti is not None:
            return pengganti
    return getattr(settings_row, field)


def akun_kas(payment_method, unit_bisnis_id):
    """Akun debit penerimaan: kas laci unit untuk metode tunai, selain itu akun metode bayar."""
    if payment_method is not None and payment_method.is_cash:
        cfg = konfigurasi(unit_bisnis_id)
        if cfg and cfg.kas_tunai_account_id:
            return cfg.kas_tunai_account
    return payment_method.account if payment_method is not None else None


def department(unit_bisnis_id):
    cfg = konfigurasi(unit_bisnis_id)
    return cfg.department if cfg else None


def department_id_untuk_filter(unit_bisnis_id):
    """Untuk filter laporan: id departemen unit, atau None bila unit belum diatur."""
    dept = department(unit_bisnis_id)
    return dept.id if dept else None
