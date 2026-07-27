from django.core.exceptions import ValidationError
from django.db import transaction

from ..models import PaymentMethod, PaymentMethodAuditLog


@transaction.atomic
def bulk_update_payment_method_account(*, payment_method_ids, new_account, actor):
    """
    "Atur Akun" — ubah Akun Pembayaran untuk beberapa Cara Pembayaran sekaligus.
    Baris is_locked=True (mis. CASH) ditolak, tidak diam-diam dilewati, supaya
    kesalahan pilih baris kelihatan jelas ke user, bukan gagal senyap.
    """
    methods = list(PaymentMethod.objects.select_for_update().filter(id__in=payment_method_ids))
    if len(methods) != len(set(payment_method_ids)):
        raise ValidationError("Ada ID cara pembayaran yang tidak ditemukan.")

    locked = [m.name for m in methods if m.is_locked]
    if locked:
        raise ValidationError(
            f"Cara pembayaran berikut terkunci, tidak bisa diubah akunnya: {', '.join(locked)}."
        )

    updated = []
    for method in methods:
        method.account = new_account
        method.save(update_fields=["account"])
        PaymentMethodAuditLog.objects.create(
            payment_method=method,
            action=PaymentMethodAuditLog.Action.UPDATE,
            actor=actor,
            account_code=new_account.code,
            account_name=new_account.name,
        )
        updated.append(method)
    return updated
