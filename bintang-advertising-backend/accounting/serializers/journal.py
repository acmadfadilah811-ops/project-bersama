from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from api.customer_models import Customer, Supplier

from ..models import Account, Department, JournalAuditLog, JournalEntry, JournalEntryLine, JournalTemplate
from ..services.journal import build_pair_lines, create_journal_entry


class JournalEntryLineWriteSerializer(serializers.Serializer):
    """Satu baris untuk Form Multi Jurnal (dan bentuk internal Form Jurnal Tunggal)."""

    account = serializers.PrimaryKeyRelatedField(queryset=Account.objects.all())
    debit = serializers.DecimalField(max_digits=15, decimal_places=0, required=False, default=0)
    kredit = serializers.DecimalField(max_digits=15, decimal_places=0, required=False, default=0)
    description = serializers.CharField(required=False, allow_blank=True, default="")
    external_document_no = serializers.CharField(required=False, allow_blank=True, default="")
    supplier = serializers.PrimaryKeyRelatedField(
        queryset=Supplier.objects.all(), required=False, allow_null=True, default=None,
    )
    customer = serializers.PrimaryKeyRelatedField(
        queryset=Customer.objects.all(), required=False, allow_null=True, default=None,
    )


class JournalEntryLineReadSerializer(serializers.ModelSerializer):
    account_code = serializers.CharField(source="account.code", read_only=True)
    account_name = serializers.CharField(source="account.name", read_only=True)

    class Meta:
        model = JournalEntryLine
        fields = [
            "id", "account", "account_code", "account_name", "debit", "kredit",
            "description", "external_document_no", "supplier", "customer",
        ]


class JournalEntryListSerializer(serializers.ModelSerializer):
    lines = JournalEntryLineReadSerializer(many=True, read_only=True)
    journal_template_name = serializers.CharField(source="journal_template.name", default=None, read_only=True)
    department_name = serializers.CharField(source="department.name", default=None, read_only=True)
    source_type_label = serializers.CharField(source="get_source_type_display", read_only=True)
    processed_by_name = serializers.SerializerMethodField()

    def get_processed_by_name(self, obj) -> str:
        """Nama akun yang memposting jurnal; fallback ke pembuat bila masih draft."""
        user = obj.posted_by or obj.created_by
        if not user:
            return "Sistem"
        return user.get_full_name() or user.username

    class Meta:
        model = JournalEntry
        fields = [
            "id", "entry_number", "date", "description", "status", "source_type", "source_type_label",
            "journal_template", "journal_template_name", "department", "department_name",
            "created_by", "processed_by_name", "lines",
        ]


class JournalAuditLogSerializer(serializers.ModelSerializer):
    """Log Jurnal — satu baris per aksi (Dibuat/Diposting/Dibatalkan/Dijurnal-balik/Dihapus)."""

    entry_number = serializers.CharField(source="journal_entry.entry_number", read_only=True)
    action_label = serializers.CharField(source="get_action_display", read_only=True)
    actor_name = serializers.SerializerMethodField()

    def get_actor_name(self, obj) -> str:
        if not obj.actor:
            return "Sistem"
        return obj.actor.get_full_name() or obj.actor.username

    class Meta:
        model = JournalAuditLog
        fields = ["id", "created_at", "entry_number", "action", "action_label", "actor_name", "note"]


class JournalEntryCreateSerializer(serializers.Serializer):
    """
    Satu endpoint untuk 3 mode input:
    - Multi Jurnal: kirim `lines` (bebas jumlah baris, asal balance).
    - Jurnal Tunggal / Advance Form: kirim `amount` + `debit_account` + `kredit_account`.
    - Jurnal Tunggal / Basic Form: kirim `amount` + `journal_template`
      (akun diambil dari default_debit_account/default_kredit_account template itu).
    """

    date = serializers.DateField()
    source_type = serializers.ChoiceField(
        choices=JournalEntry.SourceType.choices, required=False, default=JournalEntry.SourceType.MANUAL,
    )
    journal_template = serializers.PrimaryKeyRelatedField(
        queryset=JournalTemplate.objects.all(), required=False, allow_null=True, default=None,
    )
    department = serializers.PrimaryKeyRelatedField(
        queryset=Department.objects.all(), required=False, allow_null=True, default=None,
    )
    description = serializers.CharField(required=False, allow_blank=True, default="")
    external_document_no = serializers.CharField(required=False, allow_blank=True, default="")
    amount = serializers.DecimalField(
        max_digits=15, decimal_places=0, required=False, allow_null=True, default=None,
    )
    debit_account = serializers.PrimaryKeyRelatedField(
        queryset=Account.objects.all(), required=False, allow_null=True, default=None,
    )
    kredit_account = serializers.PrimaryKeyRelatedField(
        queryset=Account.objects.all(), required=False, allow_null=True, default=None,
    )
    lines = JournalEntryLineWriteSerializer(many=True, required=False)

    @staticmethod
    def _validate_cash_transfer_accounts(attrs):
        """Transfer Kas cuma boleh antar akun berklasifikasi 'Kas & Bank' — jaga integritas List Kas & Bank."""
        accounts = [attrs.get("debit_account"), attrs.get("kredit_account")]
        accounts += [line["account"] for line in (attrs.get("lines") or [])]
        for account in accounts:
            if account and (not account.classification or account.classification.name != "Kas & Bank"):
                raise serializers.ValidationError(
                    f"Transfer Kas cuma boleh antar akun klasifikasi 'Kas & Bank' — "
                    f"'{account.code} {account.name}' bukan akun Kas & Bank."
                )

    @staticmethod
    def _validate_capital_transfer_accounts(attrs):
        """Transfer Modal wajib melibatkan akun Kas & Bank DAN akun Ekuitas/Modal."""
        accounts = [attrs.get("debit_account"), attrs.get("kredit_account")]
        accounts += [line["account"] for line in (attrs.get("lines") or [])]
        accounts = [a for a in accounts if a is not None]

        has_cash_bank = any(a.classification and a.classification.name == "Kas & Bank" for a in accounts)
        has_equity = any(a.classification and a.classification.account_type == "equity" for a in accounts)

        if not (has_cash_bank and has_equity):
            raise serializers.ValidationError(
                "Transfer Modal harus melibatkan minimal 1 akun Kas & Bank dan 1 akun Ekuitas/Modal."
            )

    def validate(self, attrs):
        if attrs.get("source_type") == JournalEntry.SourceType.CASH_TRANSFER:
            self._validate_cash_transfer_accounts(attrs)
        elif attrs.get("source_type") == JournalEntry.SourceType.CAPITAL_TRANSFER:
            self._validate_capital_transfer_accounts(attrs)

        if attrs.get("lines"):
            return attrs
        if attrs.get("amount") and attrs.get("debit_account") and attrs.get("kredit_account"):
            return attrs
        if attrs.get("amount") and attrs.get("journal_template"):
            template = attrs["journal_template"]
            if template.default_debit_account and template.default_kredit_account:
                return attrs
            raise serializers.ValidationError(
                f"Nama Jurnal '{template.name}' belum punya akun default — isi Akun Debit/Kredit "
                "manual (Advance Form) atau pakai Form Multi Jurnal."
            )
        raise serializers.ValidationError(
            "Isi salah satu: 'lines' (Multi Jurnal), 'amount'+'debit_account'+'kredit_account' "
            "(Advance Form), atau 'amount'+'journal_template' (Basic Form)."
        )

    def create(self, validated_data):
        lines = validated_data.get("lines")
        if lines:
            lines = [dict(line) for line in lines]
        else:
            debit_account = validated_data.get("debit_account")
            kredit_account = validated_data.get("kredit_account")
            if not debit_account or not kredit_account:
                template = validated_data["journal_template"]
                debit_account = template.default_debit_account
                kredit_account = template.default_kredit_account
            lines = build_pair_lines(
                debit_account=debit_account,
                kredit_account=kredit_account,
                amount=validated_data["amount"],
                description=validated_data.get("description", ""),
                external_document_no=validated_data.get("external_document_no", ""),
            )

        try:
            return create_journal_entry(
                date=validated_data["date"],
                lines=lines,
                description=validated_data.get("description", ""),
                source_type=validated_data.get("source_type", JournalEntry.SourceType.MANUAL),
                journal_template=validated_data.get("journal_template"),
                department=validated_data.get("department"),
                created_by=self.context["request"].user,
            )
        except DjangoValidationError as exc:
            raise serializers.ValidationError(getattr(exc, "messages", [str(exc)]))
