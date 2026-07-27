from rest_framework import serializers

from ..models import Account


class OpeningBalanceLineSerializer(serializers.Serializer):
    """Satu baris di popup 'Masukan Saldo Awal' — 1 akun + 1 nilai saldo (selalu positif)."""

    account = serializers.PrimaryKeyRelatedField(queryset=Account.objects.filter(is_active=True))
    amount = serializers.DecimalField(max_digits=15, decimal_places=0, min_value=0)


class OpeningBalanceSubmitSerializer(serializers.Serializer):
    """body POST /api/accounting/opening-balances/ — dari popup 'Masukan Saldo Awal'."""

    entries = OpeningBalanceLineSerializer(many=True, allow_empty=False)
