from rest_framework import serializers

from ..models import Account, AccountClassification


class AccountListSerializer(serializers.ModelSerializer):
    klasifikasi = serializers.CharField(source="classification.name", default=None, read_only=True)
    saldo = serializers.SerializerMethodField()

    class Meta:
        model = Account
        fields = ["id", "code", "name", "klasifikasi", "account_type", "saldo", "is_active", "is_contra", "ignore_minus_closing"]

    def get_saldo(self, obj):
        balances = self.context.get("balances", {})
        return balances.get(obj.id, 0)


class AccountClassificationSerializer(serializers.ModelSerializer):
    """Daftar klasifikasi COA — dipakai dropdown 'Sub Kategori' di wizard Pengaturan Awal (Tambah Akun)."""

    class Meta:
        model = AccountClassification
        fields = ["id", "name", "account_type", "code_range_start", "code_range_end"]


class AccountCreateSerializer(serializers.ModelSerializer):
    """'Tambah Akun' cepat dari wizard Pengaturan Awal — bikin 1 Account baru."""

    classification = serializers.PrimaryKeyRelatedField(
        queryset=AccountClassification.objects.all(), required=True,
    )

    class Meta:
        model = Account
        fields = ["id", "code", "name", "classification", "is_contra", "account_type", "ignore_minus_closing"]
        read_only_fields = ["id", "account_type"]

    def create(self, validated_data):
        # account_type selalu ikut classification-nya — tidak pernah dari client,
        # supaya tidak mungkin akun ke-set dengan account_type yang tidak sesuai
        # klasifikasinya (mis. classification "Kewajiban lain" tapi account_type asset).
        validated_data["account_type"] = validated_data["classification"].account_type
        instance = Account(**validated_data)
        instance.full_clean()
        instance.save()
        return instance

    def update(self, instance, validated_data):
        if "classification" in validated_data:
            validated_data["account_type"] = validated_data["classification"].account_type
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.full_clean()
        instance.save()
        return instance


class LedgerSummarySerializer(serializers.ModelSerializer):
    """Baris tabel Buku Besar — akun + pergerakan debit/kredit/saldo dalam periode terpilih."""

    klasifikasi = serializers.CharField(source="classification.name", default=None, read_only=True)
    debit = serializers.SerializerMethodField()
    kredit = serializers.SerializerMethodField()
    saldo = serializers.SerializerMethodField()

    class Meta:
        model = Account
        fields = ["id", "code", "name", "klasifikasi", "debit", "kredit", "saldo"]

    def _movement(self, obj):
        return self.context.get("movements", {}).get(obj.id, {"debit": 0, "kredit": 0, "saldo_akhir": 0})

    def get_debit(self, obj):
        return self._movement(obj)["debit"]

    def get_kredit(self, obj):
        return self._movement(obj)["kredit"]

    def get_saldo(self, obj):
        return self._movement(obj)["saldo_akhir"]


class LedgerLineSerializer(serializers.Serializer):
    """Satu baris di Rincian Mutasi Akun (kartu kendali) / Rincian Mutasi Saldo (Kas & Bank)."""

    date = serializers.DateField()
    entry_number = serializers.CharField()
    external_document_no = serializers.CharField()
    pelanggan_supplier = serializers.CharField()
    email = serializers.CharField()
    dilayani_oleh = serializers.CharField()
    description = serializers.CharField()
    processed_by_name = serializers.CharField()
    debit = serializers.DecimalField(max_digits=15, decimal_places=0)
    kredit = serializers.DecimalField(max_digits=15, decimal_places=0)
    running_balance = serializers.DecimalField(max_digits=15, decimal_places=0)
