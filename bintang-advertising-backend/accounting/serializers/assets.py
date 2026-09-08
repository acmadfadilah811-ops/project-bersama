from decimal import Decimal

from rest_framework import serializers

from ..models import Account, Department, FixedAsset, JournalTemplate
from ..services.assets import _validate_accounts, create_fixed_asset, dispose_fixed_asset
from ..services.depreciation import calculate_monthly_depreciation_amount, get_accumulated_depreciation, get_book_value


class FixedAssetReadSerializer(serializers.ModelSerializer):
    asset_account_code = serializers.CharField(source="asset_account.code", read_only=True)
    asset_account_name = serializers.CharField(source="asset_account.name", read_only=True)
    acquisition_journal_number = serializers.CharField(source="acquisition_journal.entry_number", read_only=True)
    disposal_journal_number = serializers.CharField(source="disposal_journal.entry_number", read_only=True)
    accumulated_depreciation = serializers.SerializerMethodField()
    book_value = serializers.SerializerMethodField()
    monthly_depreciation_amount = serializers.SerializerMethodField()

    class Meta:
        model = FixedAsset
        fields = [
            "id", "asset_code", "name", "acquisition_date", "acquisition_cost", "residual_value",
            "asset_account", "asset_account_code", "asset_account_name", "depreciation_expense_account",
            "accumulated_depreciation_account", "counter_account", "is_opening_balance", "external_document_no",
            "description", "department", "journal_template", "acquisition_journal",
            "acquisition_journal_number", "status", "useful_life_months", "last_depreciation_date",
            "accumulated_depreciation", "book_value", "monthly_depreciation_amount",
            "disposal_date", "disposal_proceeds", "disposal_journal", "disposal_journal_number", "created_at",
        ]
        read_only_fields = [
            "acquisition_journal", "created_at", "last_depreciation_date",
            "disposal_date", "disposal_proceeds", "disposal_journal",
        ]

    def get_accumulated_depreciation(self, obj):
        return get_accumulated_depreciation(obj)

    def get_book_value(self, obj):
        return get_book_value(obj)

    def get_monthly_depreciation_amount(self, obj):
        return calculate_monthly_depreciation_amount(obj)


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
    useful_life_months = serializers.IntegerField(required=False, allow_null=True, min_value=1)

    def create(self, validated_data):
        return create_fixed_asset(data=validated_data, created_by=self.context["request"].user)


class FixedAssetUpdateSerializer(serializers.ModelSerializer):
    """Jurnal terposting tidak diedit; hanya metadata register + umur manfaat
    yang bisa diubah (umur manfaat sengaja bisa diubah SETELAH aset dibuat --
    aset lama dari sebelum fitur penyusutan ada butuh cara mengisinya).

    `status` SENGAJA TIDAK ada di sini -- kalau bisa di-PATCH langsung ke
    'disposed', pengguna bisa menandai aset dilepas tanpa memposting jurnal
    pelepasan (hapus aset dari buku, akui untung/rugi) sama sekali, jadi
    buku jadi tidak konsisten (status bilang dilepas, tapi jurnal masih
    menganggap aset aktif bernilai penuh). Satu-satunya jalur resmi ke
    status DISPOSED adalah dispose_fixed_asset() lewat FixedAssetDisposeView."""

    class Meta:
        model = FixedAsset
        fields = ["name", "external_document_no", "description", "department", "useful_life_months"]

    def validate_useful_life_months(self, value):
        if value is not None and value < 1:
            raise serializers.ValidationError("Umur manfaat harus lebih dari 0 bulan, atau kosongkan.")
        return value


class FixedAssetDisposeSerializer(serializers.Serializer):
    disposal_date = serializers.DateField()
    proceeds = serializers.DecimalField(max_digits=15, decimal_places=0, required=False, default=Decimal(0))
    proceeds_account = serializers.PrimaryKeyRelatedField(queryset=Account.objects.all())
    gain_loss_account = serializers.PrimaryKeyRelatedField(queryset=Account.objects.all())

    def save(self, *, asset, actor):
        return dispose_fixed_asset(
            asset=asset,
            disposal_date=self.validated_data["disposal_date"],
            proceeds=self.validated_data.get("proceeds") or Decimal(0),
            proceeds_account=self.validated_data["proceeds_account"],
            gain_loss_account=self.validated_data["gain_loss_account"],
            actor=actor,
        )
