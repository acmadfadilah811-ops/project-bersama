from datetime import date
from django.utils import timezone
from django.db import transaction
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView

from api.permissions import IsOwnerOrManager

from ..models import Account, AccountingSettings, AccountingLifecycleLog, POSPostingSettingsAuditLog
from ..serializers.settings import (
    AccountingSettingsSerializer,
    AccountingLifecycleLogSerializer,
    POSPostingSettingsAuditLogSerializer,
)


def _get_or_create_settings():
    """Menerapkan pola Singleton dan melakukan Auto-Seed baris pertama."""
    settings = AccountingSettings.objects.first()
    if not settings:
        # "34000 Saldo Awal" — kode resmi dari seed_coa.py (OPENING_BALANCE_ACCOUNT_CODE),
        # bukan tebakan. Fallback by-name tetap dipertahankan untuk jaga-jaga kalau
        # instalasi lain nanti pakai kode berbeda.
        opening_balance_equity_account = Account.objects.filter(code="34000").first()

        if not opening_balance_equity_account:
            opening_balance_equity_account = Account.objects.filter(
                classification__account_type="equity",
                name__icontains="saldo awal"
            ).first()

        settings = AccountingSettings.objects.create(
            accounting_start_date=date.today(),
            opening_balance_equity_account=opening_balance_equity_account,
        )
    return settings


def _update_settings(instance, data, partial, user):
    old_is_active = instance.is_active
    old_pos_auto_post_enabled = instance.pos_auto_post_enabled

    data_dict = data.copy() if hasattr(data, 'copy') else dict(data)
    delete_data = data_dict.pop('delete_data', False)

    serializer = AccountingSettingsSerializer(instance, data=data_dict, partial=partial)
    serializer.is_valid(raise_exception=True)
    updated_instance = serializer.save()

    if (
        "pos_auto_post_enabled" in data_dict
        and old_pos_auto_post_enabled != updated_instance.pos_auto_post_enabled
    ):
        POSPostingSettingsAuditLog.objects.create(
            action=(
                POSPostingSettingsAuditLog.Action.ENABLE
                if updated_instance.pos_auto_post_enabled
                else POSPostingSettingsAuditLog.Action.DISABLE
            ),
            actor=user,
            previous_value=old_pos_auto_post_enabled,
            new_value=updated_instance.pos_auto_post_enabled,
        )

    # Cek perubahan status untuk mencatat lifecycle log
    if old_is_active != updated_instance.is_active:
        action = (
            AccountingLifecycleLog.Action.START
            if updated_instance.is_active
            else AccountingLifecycleLog.Action.STOP
        )
        AccountingLifecycleLog.objects.create(action=action, actor=user)

        if not updated_instance.is_active:
            with transaction.atomic():
                updated_instance.initial_setup_completed_at = None
                updated_instance.save(update_fields=['initial_setup_completed_at'])
                if delete_data:
                    from ..models import JournalEntry, BankStatementLine, AccountingPeriod
                    JournalEntry.objects.all().delete()
                    BankStatementLine.objects.all().delete()
                    AccountingPeriod.objects.all().delete()

    return Response(AccountingSettingsSerializer(updated_instance).data)




class AccountingSettingsView(APIView):
    """
    GET /api/accounting/settings/
    PUT/PATCH /api/accounting/settings/

    Endpoint Singleton untuk pengaturan akuntansi.
    """

    permission_classes = [IsOwnerOrManager]

    def get(self, request):
        settings = _get_or_create_settings()
        serializer = AccountingSettingsSerializer(settings)
        return Response(serializer.data)

    def put(self, request):
        settings = _get_or_create_settings()
        return _update_settings(settings, request.data, partial=False, user=request.user)

    def patch(self, request):
        settings = _get_or_create_settings()
        return _update_settings(settings, request.data, partial=True, user=request.user)


class AccountingCompleteSetupView(APIView):
    """
    POST /api/accounting/settings/complete-setup/
    body: {"accounting_start_date": "YYYY-MM-DD", "default_payment_due_days": <int>}

    Wizard "Pengaturan Awal", step Ringkasan tombol "Mulai" — set is_active=True
    (mencatat AccountingLifecycleLog START lewat _update_settings seperti biasa)
    dan stempel initial_setup_completed_at SEKALI SAJA. Panggilan ulang (retry,
    klik dobel) aman: field lain tetap ter-update, tapi timestamp awal tidak
    pernah ditimpa ulang atau dianggap error.
    """

    permission_classes = [IsOwnerOrManager]

    def post(self, request):
        settings = _get_or_create_settings()
        already_done = settings.initial_setup_completed_at is not None

        response = _update_settings(
            settings, {**request.data, "is_active": True}, partial=True, user=request.user,
        )

        if not already_done:
            settings.initial_setup_completed_at = timezone.now()
            settings.save(update_fields=["initial_setup_completed_at"])
            response.data["initial_setup_completed_at"] = settings.initial_setup_completed_at

        return response


class AccountingLifecycleLogListView(generics.ListAPIView):
    """
    GET /api/accounting/lifecycle-logs/

    Membuka riwayat kapan sistem akuntansi dinyalakan atau dimatikan.
    """
    permission_classes = [IsOwnerOrManager]
    serializer_class = AccountingLifecycleLogSerializer
    queryset = AccountingLifecycleLog.objects.all().select_related("actor")


class POSPostingSettingsAuditLogListView(generics.ListAPIView):
    """Riwayat siapa yang mengaktifkan atau menonaktifkan auto-post POS."""
    permission_classes = [IsOwnerOrManager]
    serializer_class = POSPostingSettingsAuditLogSerializer
    queryset = POSPostingSettingsAuditLog.objects.all().select_related("actor")
