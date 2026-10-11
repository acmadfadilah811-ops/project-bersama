"""Pembatasan master produk/inventori per unit bisnis (2026-10-11).

Staff/kasir/SPV/Kordiv hanya melihat master milik unitnya + yang tidak
ditandai unit (berlaku umum); owner/manager/admin melihat semua. Aturan
tunggalnya ada di permissions.scoped_by_unit_bisnis.
"""
from .permissions import scoped_by_unit_bisnis


class UnitBisnisScopedMixin:
    def get_queryset(self):
        return scoped_by_unit_bisnis(super().get_queryset(), self.request.user)
