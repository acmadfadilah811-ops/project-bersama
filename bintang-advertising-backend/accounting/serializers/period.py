from rest_framework import serializers
from ..models import AccountingPeriod


class AccountingPeriodSerializer(serializers.ModelSerializer):
    closed_by_username = serializers.ReadOnlyField(source="closed_by.username", default=None)
    # "Sep 2026" atau "Sep 2026 (26 Agu-25 Sep)" -- bulan AKHIR periode, supaya
    # layar tidak menamai periode 26 Agu-25 Sep sebagai "Agustus".
    nama = serializers.SerializerMethodField()

    def get_nama(self, obj):
        from ..services.period_rules import nama_periode

        return nama_periode(obj.start_date, obj.end_date)

    class Meta:
        model = AccountingPeriod
        fields = [
            "id",
            "nama",
            "fiscal_year",
            "start_date",
            "end_date",
            "status",
            "closed_at",
            "closed_by",
            "closed_by_username",
        ]


class PeriodJournalLineSerializer(serializers.Serializer):
    date = serializers.DateField(source="journal_entry.date")
    entry_number = serializers.CharField(source="journal_entry.entry_number")
    account_code = serializers.CharField(source="account.code")
    account_name = serializers.CharField(source="account.name")
    description = serializers.SerializerMethodField()
    debit = serializers.DecimalField(max_digits=15, decimal_places=0)
    kredit = serializers.DecimalField(max_digits=15, decimal_places=0)

    def get_description(self, instance):
        return instance.description or instance.journal_entry.description
