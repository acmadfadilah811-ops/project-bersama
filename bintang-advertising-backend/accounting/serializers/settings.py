from rest_framework import serializers
from ..models import AccountingSettings, AccountingLifecycleLog, POSPostingSettingsAuditLog, Account

class AccountingSettingsSerializer(serializers.ModelSerializer):
    opening_balance_equity_account_code = serializers.CharField(
        source="opening_balance_equity_account.code", read_only=True
    )
    opening_balance_equity_account_name = serializers.CharField(
        source="opening_balance_equity_account.name", read_only=True
    )
    closing_account_code = serializers.CharField(
        source="closing_account.code", default=None, read_only=True
    )
    closing_account_name = serializers.CharField(
        source="closing_account.name", default=None, read_only=True
    )

    class Meta:
        model = AccountingSettings
        fields = [
            "id",
            "accounting_start_date",
            "default_payment_due_days",
            "reminder_days_before_due",
            "send_ar_due_email",
            "is_ppn_active",
            "ppn_rate_percent",
            "show_inventory_in_profit_loss",
            "calculate_coa_from_this_year",
            "opening_balance_equity_account",
            "opening_balance_equity_account_code",
            "opening_balance_equity_account_name",
            "closing_account",
            "closing_account_code",
            "closing_account_name",
            "pos_sales_revenue_account",
            "pos_ppn_output_account",
            "pos_cogs_expense_account",
            "pos_inventory_account",
            "pos_auto_post_enabled",
            "default_pos_payment_method",
            "pos_post_discount_line_enabled",
            "pos_marketplace_admin_fee_account",
            "pos_deposit_income_difference_account",
            "pos_deposit_expense_difference_account",
            "pos_purchase_tax_account",
            "pos_sales_total_minus_account",
            "pos_sales_delivery_account",
            "pos_sales_rounding_account",
            "pos_sales_unique_payment_account",
            "komisi_penjualan_debit_account",
            "komisi_penjualan_kredit_account",
            "purchase_inventory_account",
            "purchase_payable_account",
            "purchase_advance_account",
            "enable_product_account_group",
            "enable_transfer_between_stores_as_sale",
            "enable_ojek_online_fee",
            "enable_marketplace_sales",
            "enable_mdr_fee",
            "enable_sales_commission",
            "enable_multi_branch_closing",
            "is_active",
            "initial_setup_completed_at",
        ]
        read_only_fields = ["id", "initial_setup_completed_at"]


class AccountingLifecycleLogSerializer(serializers.ModelSerializer):
    actor_name = serializers.CharField(source="actor.get_full_name", default=None, read_only=True)
    actor_email = serializers.CharField(source="actor.email", default=None, read_only=True)

    class Meta:
        model = AccountingLifecycleLog
        fields = ["id", "action", "actor", "actor_name", "actor_email", "created_at"]
        read_only_fields = ["id", "created_at"]


class POSPostingSettingsAuditLogSerializer(serializers.ModelSerializer):
    actor_name = serializers.SerializerMethodField()
    actor_email = serializers.CharField(source="actor.email", default=None, read_only=True)

    def get_actor_name(self, obj):
        if not obj.actor:
            return None
        return obj.actor.get_full_name() or obj.actor.username

    class Meta:
        model = POSPostingSettingsAuditLog
        fields = ["id", "action", "previous_value", "new_value", "actor_name", "actor_email", "created_at"]
        read_only_fields = fields
