from rest_framework import serializers

from ..models import Account, PayrollComponentMapping, PayrollPosting


class PayrollComponentMappingSerializer(serializers.ModelSerializer):
    akun_display = serializers.SerializerMethodField()
    akun_iuran_perusahaan_display = serializers.SerializerMethodField()

    class Meta:
        model = PayrollComponentMapping
        fields = [
            "id", "judul", "jenis", "akun", "akun_display",
            "akun_iuran_perusahaan", "akun_iuran_perusahaan_display",
        ]

    @staticmethod
    def _label(akun):
        return f"{akun.code} - {akun.name}" if akun else None

    def get_akun_display(self, obj):
        return self._label(obj.akun)

    def get_akun_iuran_perusahaan_display(self, obj):
        return self._label(obj.akun_iuran_perusahaan)

    def validate_judul(self, value):
        value = (value or "").strip()
        if not value:
            raise serializers.ValidationError("Judul komponen wajib diisi.")
        return value

    def validate(self, data):
        jenis = data.get("jenis", getattr(self.instance, "jenis", None))
        akun = data.get("akun", getattr(self.instance, "akun", None))
        iuran = data.get("akun_iuran_perusahaan", getattr(self.instance, "akun_iuran_perusahaan", None))
        wajib_tipe = {
            PayrollComponentMapping.Jenis.KEWAJIBAN: Account.AccountType.LIABILITY,
            PayrollComponentMapping.Jenis.PIUTANG: Account.AccountType.ASSET,
        }
        if jenis in wajib_tipe:
            if not akun:
                raise serializers.ValidationError({"akun": "Akun wajib diisi untuk jenis ini."})
            if akun.account_type != wajib_tipe[jenis]:
                raise serializers.ValidationError({"akun": "Tipe akun tidak sesuai dengan jenis komponen."})
        elif jenis == PayrollComponentMapping.Jenis.PENGURANG_BEBAN:
            data["akun"] = None  # pengurang biaya gaji tidak dikreditkan ke akun mana pun
        if iuran and iuran.account_type != Account.AccountType.LIABILITY:
            raise serializers.ValidationError({"akun_iuran_perusahaan": "Akun iuran perusahaan harus bertipe kewajiban."})
        return data


class PayrollPostingSerializer(serializers.ModelSerializer):
    journal_entry_number = serializers.CharField(source="journal_entry.entry_number", read_only=True)
    payment_journal_entry_number = serializers.CharField(
        source="payment_journal_entry.entry_number", read_only=True, default=None)
    posted_by_nama = serializers.SerializerMethodField()

    class Meta:
        model = PayrollPosting
        fields = [
            "id", "tahun", "bulan", "versi", "status", "total_gross", "total_net",
            "journal_entry", "journal_entry_number", "payment_journal_entry",
            "payment_journal_entry_number", "posted_by_nama", "posted_at", "dibayar_pada", "dibalik_pada",
        ]
        read_only_fields = fields

    def get_posted_by_nama(self, obj):
        u = obj.posted_by
        return (u.get_full_name() or u.username) if u else None


def bentuk_pratinjau(hasil):
    """Ubah keluaran services.payroll_posting.pratinjau() jadi JSON siap kirim."""
    posting = hasil["posting_aktif"]
    return {
        "periode": hasil["periode"],
        "status_posting": hasil["status_posting"],
        "posting_aktif": PayrollPostingSerializer(posting).data if posting else None,
        "masalah": hasil["masalah"],
        "peringatan": hasil["peringatan"],
        "ringkasan": {k: str(v) if not isinstance(v, int) else v for k, v in hasil["ringkasan"].items()},
        "lines": [
            {"kode": l["account"].code, "nama": l["account"].name, "keterangan": l["description"],
             "debit": str(l["debit"]), "kredit": str(l["kredit"])}
            for l in hasil["lines"]
        ],
        "komponen_hr": [
            {"judul": p.get("judul"), "kelompok": p.get("kelompok"), "total": p.get("total"),
             "iuran_perusahaan_total": p.get("iuran_perusahaan_total")}
            for p in hasil["data_hr"].get("potongan", [])
        ],
        "dikecualikan": hasil["data_hr"].get("dikecualikan", {}),
    }
