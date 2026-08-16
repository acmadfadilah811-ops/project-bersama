"""Pencatatan pembayaran Pembelian dari satu jalur yang atomik."""

from decimal import Decimal, InvalidOperation

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.utils import timezone
from django.utils.dateparse import parse_date

from accounting.models import Account
from accounting.services.purchase_posting import post_purchase_payment_journal

from ..product_models import Purchase, PurchasePayment


class PurchasePaymentError(Exception):
    """Kesalahan validasi bisnis Pembayaran yang aman disampaikan ke pengguna."""


def _parse_nominal(value):
    try:
        nominal = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError) as exc:
        raise PurchasePaymentError("Nominal pembayaran tidak valid.") from exc
    if nominal <= 0:
        raise PurchasePaymentError("Nominal pembayaran harus lebih besar dari 0.")
    if nominal != nominal.quantize(Decimal("1")):
        raise PurchasePaymentError("Nominal pembayaran harus berupa rupiah utuh.")
    return nominal


def create_purchase_payment(*, purchase_id, data, actor):
    """Simpan DP/pelunasan, jurnalnya, lalu hitung ulang status pembayaran."""
    nominal = _parse_nominal(data.get("nominal"))
    tanggal = parse_date(data.get("tanggal")) if data.get("tanggal") else timezone.localdate()
    if not tanggal:
        raise PurchasePaymentError("Format tanggal harus YYYY-MM-DD.")

    account_id = data.get("payment_account_id")
    if not account_id:
        raise PurchasePaymentError("Pilih akun Kas/Bank aktif untuk pembayaran.")

    with transaction.atomic():
        purchase = Purchase.objects.select_for_update().prefetch_related("items", "payments").filter(pk=purchase_id).first()
        if not purchase:
            raise PurchasePaymentError("Dokumen pembelian tidak ditemukan.")
        if purchase.is_retur:
            raise PurchasePaymentError("Dokumen retur tidak menerima pembayaran.")
        if purchase.status == "batal":
            raise PurchasePaymentError("Dokumen batal tidak bisa menerima pembayaran.")

        account = Account.objects.filter(
            pk=account_id,
            is_active=True,
            account_type=Account.AccountType.ASSET,
            classification__name="Kas & Bank",
        ).first()
        if not account:
            raise PurchasePaymentError("Akun pembayaran harus berupa akun Kas & Bank yang aktif.")

        sisa = purchase.total - purchase.total_dibayar
        if sisa <= 0:
            raise PurchasePaymentError("Pembelian ini sudah lunas.")
        if nominal > sisa:
            raise PurchasePaymentError("Nominal pembayaran melebihi sisa tagihan.")

        jenis = (
            PurchasePayment.Jenis.ADVANCE
            if purchase.receive_status != "diterima"
            else PurchasePayment.Jenis.SETTLEMENT
        )
        payment = PurchasePayment.objects.create(
            purchase=purchase,
            tanggal=tanggal,
            nominal=nominal,
            payment_account=account,
            jenis=jenis,
            payment_account_code_snapshot=account.code,
            payment_account_name_snapshot=account.name,
            metode=(data.get("payment_jurnal") or f"{account.code} {account.name}").strip(),
            catatan=(data.get("referensi_pembayaran") or data.get("catatan") or "").strip(),
            dibuat_oleh=actor,
        )
        try:
            post_purchase_payment_journal(payment, account, actor=actor)
        except DjangoValidationError as exc:
            raise PurchasePaymentError(getattr(exc, "messages", [str(exc)])[0]) from exc
        purchase.recompute_payment_status()
        return purchase
