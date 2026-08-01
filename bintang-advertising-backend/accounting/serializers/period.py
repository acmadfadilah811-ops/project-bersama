from rest_framework import serializers
from ..models import AccountingPeriod


class AccountingPeriodSerializer(serializers.ModelSerializer):
    closed_by_username = serializers.ReadOnlyField(source="closed_by.username", default=None)

    class Meta:
        model = AccountingPeriod
        fields = [
            "id",
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
