from django.contrib import admin

from .models import (
    Account,
    AccountClassification,
    AccountingLifecycleLog,
    AccountingPeriod,
    AccountingSettings,
    BankStatementLine,
    CashBankAccount,
    Department,
    JournalAuditLog,
    JournalEntry,
    JournalEntryLine,
    JournalTemplate,
    PaymentMethod,
    PaymentMethodAuditLog,
    ProductAccountGroup,
)


@admin.register(AccountingSettings)
class AccountingSettingsAdmin(admin.ModelAdmin):
    list_display = ["accounting_start_date", "is_active", "is_ppn_active"]


@admin.register(AccountingLifecycleLog)
class AccountingLifecycleLogAdmin(admin.ModelAdmin):
    list_display = ["created_at", "action", "actor"]
    list_filter = ["action"]


@admin.register(AccountClassification)
class AccountClassificationAdmin(admin.ModelAdmin):
    list_display = ["name", "account_type", "order"]
    list_filter = ["account_type"]


@admin.register(Account)
class AccountAdmin(admin.ModelAdmin):
    list_display = ["code", "name", "account_type", "classification", "is_contra", "is_active"]
    list_filter = ["account_type", "classification", "is_contra", "is_active"]
    search_fields = ["code", "name"]


@admin.register(ProductAccountGroup)
class ProductAccountGroupAdmin(admin.ModelAdmin):
    list_display = ["name", "revenue_account", "cogs_account", "inventory_account", "is_active"]


@admin.register(AccountingPeriod)
class AccountingPeriodAdmin(admin.ModelAdmin):
    list_display = ["start_date", "end_date", "fiscal_year", "status", "closed_at"]
    list_filter = ["status", "fiscal_year"]


@admin.register(JournalTemplate)
class JournalTemplateAdmin(admin.ModelAdmin):
    list_display = ["name", "default_debit_account", "default_kredit_account", "is_active"]


@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    list_display = ["name", "is_active"]


class JournalEntryLineInline(admin.TabularInline):
    model = JournalEntryLine
    extra = 2


@admin.register(JournalEntry)
class JournalEntryAdmin(admin.ModelAdmin):
    list_display = [
        "entry_number", "date", "source_type", "status", "journal_template",
        "department", "created_by",
    ]
    list_filter = ["status", "source_type", "department"]
    search_fields = ["entry_number", "description"]
    inlines = [JournalEntryLineInline]


@admin.register(JournalAuditLog)
class JournalAuditLogAdmin(admin.ModelAdmin):
    list_display = ["journal_entry", "action", "actor", "created_at"]
    list_filter = ["action"]


@admin.register(CashBankAccount)
class CashBankAccountAdmin(admin.ModelAdmin):
    list_display = ["name", "account", "kind", "bank_name", "is_active"]


@admin.register(PaymentMethod)
class PaymentMethodAdmin(admin.ModelAdmin):
    list_display = ["name", "payment_type", "account", "mdr_percent", "is_locked", "is_active"]
    list_filter = ["is_locked", "is_active"]
    search_fields = ["name", "payment_type"]


@admin.register(PaymentMethodAuditLog)
class PaymentMethodAuditLogAdmin(admin.ModelAdmin):
    list_display = ["payment_method", "action", "actor", "account_code", "account_name", "created_at"]
    list_filter = ["action"]


@admin.register(BankStatementLine)
class BankStatementLineAdmin(admin.ModelAdmin):
    list_display = ["date", "account", "description", "mutation_type", "mutation_amount", "bank_saldo", "status"]
    list_filter = ["account", "mutation_type", "status"]
    search_fields = ["description"]
