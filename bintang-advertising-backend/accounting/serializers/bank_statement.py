from rest_framework import serializers

from ..models import BankStatementLine, CashBankAccount, JournalEntryLine


class CashBankAccountSerializer(serializers.ModelSerializer):
    account_code = serializers.CharField(source="account.code", read_only=True)
    account_name = serializers.CharField(source="account.name", read_only=True)

    class Meta:
        model = CashBankAccount
        fields = ["id", "name", "account", "account_code", "account_name", "kind", "is_active"]


class BankStatementLineSerializer(serializers.ModelSerializer):
    account_code = serializers.CharField(source="account.code", read_only=True)
    account_name = serializers.CharField(source="account.name", read_only=True)

    class Meta:
        model = BankStatementLine
        fields = [
            "id", "date", "account", "account_code", "account_name", "description",
            "mutation_amount", "mutation_type", "bank_saldo", "status", "matched_journal_entry_line",
        ]


class UnmatchedJournalLineSerializer(serializers.ModelSerializer):
    date = serializers.DateField(source="journal_entry.date", read_only=True)
    entry_number = serializers.CharField(source="journal_entry.entry_number", read_only=True)

    class Meta:
        model = JournalEntryLine
        fields = ["id", "date", "entry_number", "description", "debit", "kredit"]


class BankReconciliationMatchSerializer(serializers.Serializer):
    """Konfirmasi 1 baris Bank Statement cocok dengan 1 baris Journal Entry."""

    bank_statement_line = serializers.PrimaryKeyRelatedField(queryset=BankStatementLine.objects.all())
    journal_entry_line = serializers.PrimaryKeyRelatedField(queryset=JournalEntryLine.objects.all())
