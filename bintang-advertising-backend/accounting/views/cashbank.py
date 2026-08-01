from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import Q
from rest_framework import generics
from rest_framework.exceptions import ValidationError as DRFValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from api.permissions import IsOwnerOrManager

from ..models import PaymentMethod, PaymentMethodAuditLog
from ..serializers import (
    PaymentMethodAuditLogSerializer,
    PaymentMethodBulkUpdateAccountSerializer,
    PaymentMethodMdrUpdateSerializer,
    PaymentMethodSerializer,
)
from ..services.payment_method import bulk_update_payment_method_account, update_payment_method_mdr


class PaymentMethodListView(generics.ListAPIView):
    """GET /api/accounting/payment-methods/?search= — Cara Pembayaran, cari lewat Nama/Tipe."""

    serializer_class = PaymentMethodSerializer
    permission_classes = [IsOwnerOrManager]

    def get_queryset(self):
        qs = PaymentMethod.objects.select_related("account", "mdr_debit_account", "mdr_kredit_account")
        search = self.request.query_params.get("search")
        if search:
            qs = qs.filter(Q(name__icontains=search) | Q(payment_type__icontains=search))
        return qs.order_by("name")


class PaymentMethodBulkUpdateAccountView(APIView):
    """
    POST /api/accounting/payment-methods/bulk-update-account/
    body: {"payment_method_ids": [...], "account": <id>}

    "Atur Akun" — ubah Akun Pembayaran beberapa Cara Pembayaran sekaligus.
    Baris is_locked (CASH) ditolak dengan pesan jelas, bukan dilewati diam-diam.
    """

    permission_classes = [IsOwnerOrManager]

    def post(self, request):
        serializer = PaymentMethodBulkUpdateAccountSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            updated = bulk_update_payment_method_account(
                payment_method_ids=serializer.validated_data["payment_method_ids"],
                new_account=serializer.validated_data["account"],
                actor=request.user,
            )
        except DjangoValidationError as exc:
            raise DRFValidationError(getattr(exc, "messages", [str(exc)]))

        return Response(PaymentMethodSerializer(updated, many=True).data)


class PaymentMethodAuditLogView(generics.ListAPIView):
    """GET /api/accounting/payment-methods/<int:payment_method_id>/log/ — 'Detail Log' per cara pembayaran."""

    serializer_class = PaymentMethodAuditLogSerializer
    permission_classes = [IsOwnerOrManager]

    def get_queryset(self):
        return PaymentMethodAuditLog.objects.filter(
            payment_method_id=self.kwargs["payment_method_id"],
        ).select_related("actor")


class PaymentMethodMdrUpdateView(APIView):
    """PATCH /api/accounting/payment-methods/<id>/mdr/ â€” simpan Debit/Kredit/Rating MDR."""

    permission_classes = [IsOwnerOrManager]

    def patch(self, request, payment_method_id):
        serializer = PaymentMethodMdrUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            method = update_payment_method_mdr(
                payment_method_id=payment_method_id,
                actor=request.user,
                **serializer.validated_data,
            )
        except DjangoValidationError as exc:
            raise DRFValidationError(getattr(exc, "messages", [str(exc)]))
        return Response(PaymentMethodSerializer(method).data)
