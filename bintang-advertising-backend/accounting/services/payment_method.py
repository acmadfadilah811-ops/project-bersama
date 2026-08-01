from django.core.exceptions import ValidationError
from django.db import transaction

from ..models import Account, PaymentMethod, PaymentMethodAuditLog


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
        previous_account = method.account
        method.account = new_account
        method.save(update_fields=["account"])
        PaymentMethodAuditLog.objects.create(
            payment_method=method,
            action=PaymentMethodAuditLog.Action.UPDATE,
            actor=actor,
            account_code=new_account.code,
            account_name=new_account.name,
            previous_account_code=previous_account.code,
            previous_account_name=previous_account.name,
        )
        updated.append(method)
    return updated


@transaction.atomic
def update_payment_method_mdr(*, payment_method_id, mdr_debit_account, mdr_kredit_account, mdr_percent, actor):
    """Simpan konfigurasi MDR per cara pembayaran beserta jejak auditnya."""
    try:
        method = PaymentMethod.objects.select_for_update().get(id=payment_method_id)
    except PaymentMethod.DoesNotExist as exc:
        raise ValidationError("Cara pembayaran tidak ditemukan.") from exc

    # Account objects sudah divalidasi serializer. Referensi eksplisit ini membuat
    # snapshot audit tetap stabil meskipun akun kemudian diubah namanya.
    debit_label = _account_label(mdr_debit_account)
    kredit_label = _account_label(mdr_kredit_account)
    method.mdr_debit_account = mdr_debit_account
    method.mdr_kredit_account = mdr_kredit_account
    method.mdr_percent = mdr_percent
    method.save(update_fields=["mdr_debit_account", "mdr_kredit_account", "mdr_percent"])

    PaymentMethodAuditLog.objects.create(
        payment_method=method,
        action=PaymentMethodAuditLog.Action.UPDATE,
        actor=actor,
        account_code=method.account.code,
        account_name=method.account.name,
        previous_account_code=method.account.code,
        previous_account_name=method.account.name,
        detail=(
            f"MDR diperbarui: Debit {debit_label}; Kredit {kredit_label}; "
            f"Rating {mdr_percent}%"
        ),
    )
    return method


def _account_label(account: Account | None) -> str:
    return f"{account.code} {account.name}" if account else "Kosong"
