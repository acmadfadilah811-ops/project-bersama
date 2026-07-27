from rest_framework import serializers

from ..models import Account, PaymentMethod, PaymentMethodAuditLog


class PaymentMethodSerializer(serializers.ModelSerializer):
    account_code = serializers.CharField(source="account.code", read_only=True)
    account_name = serializers.CharField(source="account.name", read_only=True)

    class Meta:
        model = PaymentMethod
        fields = [
            "id", "name", "payment_type", "account", "account_code", "account_name",
            "mdr_debit_account", "mdr_kredit_account", "mdr_percent", "is_locked", "is_active",
        ]
        read_only_fields = ["is_locked"]


class PaymentMethodBulkUpdateAccountSerializer(serializers.Serializer):
    """'Atur Akun' — terapkan 1 Akun Pembayaran baru ke beberapa Cara Pembayaran sekaligus.

    account dibatasi ke akun yang terdaftar di CashBankAccount (kurasi yang sama
    dengan dropdown "Atur Akun" di UI — 11101/11102/11103/11104/23000/23500),
    mereplikasi batasan dropdown itu di backend, bukan cuma dipercaya ke frontend.
    """

    payment_method_ids = serializers.ListField(child=serializers.IntegerField(), allow_empty=False)
    account = serializers.PrimaryKeyRelatedField(
        queryset=Account.objects.filter(cash_bank_account__is_active=True)
    )


class PaymentMethodAuditLogSerializer(serializers.ModelSerializer):
    actor_name = serializers.CharField(source="actor.username", default=None, read_only=True)
    actor_email = serializers.CharField(source="actor.email", default=None, read_only=True)

    class Meta:
        model = PaymentMethodAuditLog
        fields = ["id", "action", "actor_name", "actor_email", "account_code", "account_name", "created_at"]
