"""Akun & dimensi per unit bisnis (StarFoto / Star Advertising), 2026-10-11.

A. Akun pengganti per unit: kalau diisi, jurnal transaksi unit ini memakai akun
   tersebut; kosong = akun umum di Pengaturan Akuntansi (perilaku lama).
B. Dimensi: setiap jurnal transaksi unit ditandai Departemen unit itu supaya
   Laba Rugi bisa difilter per unit.
"""
from django.db import models

from .coa import Account
from .lookups import Department


def _akun(help_text):
    return models.ForeignKey(
        Account, on_delete=models.PROTECT, null=True, blank=True, related_name="+", help_text=help_text,
    )


class AkunUnitBisnis(models.Model):
    unit_bisnis = models.OneToOneField("api.UnitBisnis", on_delete=models.CASCADE, related_name="akun_akuntansi")
    department = models.OneToOneField(
        Department, on_delete=models.PROTECT, null=True, blank=True, related_name="unit_bisnis_akun",
        help_text="Departemen penanda jurnal unit ini (filter Laba Rugi per unit).",
    )
    order_sales_revenue_account = _akun("Pendapatan pesanan (Order) unit ini.")
    pos_sales_revenue_account = _akun("Pendapatan penjualan kasir (POS) unit ini.")
    pos_cogs_expense_account = _akun("HPP penjualan barang (POS & stok pesanan) unit ini.")
    order_hpp_expense_account = _akun("HPP bahan pesanan unit ini.")
    kas_tunai_account = _akun("Kas laci kasir unit ini (pembayaran tunai).")
    diubah_pada = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "accounting_akun_unit_bisnis"
        verbose_name = "Akun Unit Bisnis"
        verbose_name_plural = "Akun Unit Bisnis"

    def __str__(self):
        return f"Akun {self.unit_bisnis}"
