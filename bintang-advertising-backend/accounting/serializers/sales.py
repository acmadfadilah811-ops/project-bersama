from rest_framework import serializers


class AccountingSalesRecordSerializer(serializers.Serializer):
    """Kontrak read-only untuk daftar penjualan pada modul Akuntansi.

    Satu baris dapat berasal dari POS atau Order. `id` sengaja diberi prefix
    source agar tidak bentrok ketika ID POS (integer) kebetulan sama dengan
    bagian numerik ID Order.
    """

    id = serializers.CharField()
    source = serializers.ChoiceField(choices=("pos", "order"))
    source_id = serializers.CharField()
    reference = serializers.CharField()
    date = serializers.DateTimeField(allow_null=True)
    customer = serializers.CharField(allow_blank=True, allow_null=True)
    category = serializers.ChoiceField(
        choices=("pos", "butuh_diproses", "selesai", "pengembalian", "dibatalkan")
    )
    category_label = serializers.CharField()
    transaction_status = serializers.CharField()
    status_global = serializers.CharField(allow_blank=True, allow_null=True)
    payment_status = serializers.ChoiceField(
        choices=("paid", "partial", "unpaid", "void", "not_applicable")
    )
    amount = serializers.DecimalField(max_digits=15, decimal_places=2)
    paid_amount = serializers.DecimalField(max_digits=15, decimal_places=2)
    outstanding_amount = serializers.DecimalField(max_digits=15, decimal_places=2)
    payment_method = serializers.CharField(allow_blank=True, allow_null=True)
    settlement_status = serializers.CharField(allow_blank=True, allow_null=True)
    journal_status = serializers.ChoiceField(
        choices=("posted", "draft", "void", "not_posted")
    )
    journal_entry_ids = serializers.ListField(child=serializers.IntegerField())


class POSSaleBatchActionSerializer(serializers.Serializer):
    sale_ids = serializers.ListField(child=serializers.IntegerField(), allow_empty=False)
