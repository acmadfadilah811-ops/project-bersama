from rest_framework import serializers


class SettlementBatchSerializer(serializers.Serializer):
    date = serializers.DateField()
    payment_method_id = serializers.IntegerField()
    payment_method_name = serializers.CharField()
    payment_type = serializers.CharField()
    total_amount = serializers.DecimalField(max_digits=15, decimal_places=2)
    transaction_count = serializers.IntegerField()
    pos_sale_count = serializers.IntegerField()
    order_count = serializers.IntegerField()


class SettlementBatchKeySerializer(serializers.Serializer):
    date = serializers.DateField()
    payment_method_id = serializers.IntegerField()


class SettlementConfirmSerializer(serializers.Serializer):
    batches = SettlementBatchKeySerializer(many=True)
    bank_account_id = serializers.IntegerField(
        help_text="ID akun kas/bank tujuan pencairan riil.",
    )

    def validate_batches(self, value):
        if not value:
            raise serializers.ValidationError("Minimal pilih 1 batch untuk di-confirm.")
        return value
