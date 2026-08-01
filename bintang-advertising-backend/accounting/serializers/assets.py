from rest_framework import serializers

from ..models import Account, Department, FixedAsset, JournalTemplate
from ..services.assets import _validate_accounts, create_fixed_asset


class FixedAssetReadSerializer(serializers.ModelSerializer):
    asset_account_code = serializers.CharField(source="asset_account.code", read_only=True)
    asset_account_name = serializers.CharField(source="asset_account.name", read_only=True)
    acquisition_journal_number = serializers.CharField(source="acquisition_journal.entry_number", read_only=True)

    class Meta:
        model = FixedAsset
        fields = [
            "id", "asset_code", "name", "acquisition_date", "acquisition_cost", "residual_value",
            "asset_account", "asset_account_code", "asset_account_name", "depreciation_expense_account",
            "accumulated_depreciation_account", "counter_account", "is_opening_balance", "external_document_no",
            "description", "department", "journal_template", "acquisition_journal",
            "acquisition_journal_number", "status", "last_depreciation_date", "created_at",
        ]
        read_only_fields = ["acquisition_journal", "created_at", "last_depreciation_date"]


class FixedAssetAccountConfigSerializer(serializers.Serializer):
    asset_account = serializers.PrimaryKeyRelatedField(queryset=Account.objects.all())
    depreciation_expense_account = serializers.PrimaryKeyRelatedField(queryset=Account.objects.all())
    accumulated_depreciation_account = serializers.PrimaryKeyRelatedField(queryset=Account.objects.all())
    counter_account = serializers.PrimaryKeyRelatedField(queryset=Account.objects.all(), required=False, allow_null=True)
    is_opening_balance = serializers.BooleanField(required=False, default=False)
    external_document_no = serializers.CharField(max_length=50, required=False, allow_blank=True, default="")
    description = serializers.CharField(required=False, allow_blank=True, default="")
    department = serializers.PrimaryKeyRelatedField(queryset=Department.objects.all(), required=False, allow_null=True)
    journal_template = serializers.PrimaryKeyRelatedField(queryset=JournalTemplate.objects.all(), required=False, allow_null=True)

    def validate(self, attrs):
        _validate_accounts(
            asset_account=attrs["asset_account"],
            depreciation_expense_account=attrs["depreciation_expense_account"],
            accumulated_depreciation_account=attrs["accumulated_depreciation_account"],
            counter_account=attrs.get("counter_account"),
            is_opening_balance=attrs.get("is_opening_balance", False),
        )
        return attrs


class FixedAssetCreateSerializer(FixedAssetAccountConfigSerializer):
    asset_code = serializers.CharField(max_length=50)
    name = serializers.CharField(max_length=200)
    acquisition_date = serializers.DateField()
    acquisition_cost = serializers.DecimalField(max_digits=15, decimal_places=0)
    residual_value = serializers.DecimalField(max_digits=15, decimal_places=0, required=False, default=0)

    def create(self, validated_data):
        return create_fixed_asset(data=validated_data, created_by=self.context["request"].user)


class FixedAssetUpdateSerializer(serializers.ModelSerializer):
    """Jurnal terposting tidak diedit; hanya metadata register yang bisa diubah."""

    class Meta:
        model = FixedAsset
        fields = ["name", "external_document_no", "description", "department", "status"]
