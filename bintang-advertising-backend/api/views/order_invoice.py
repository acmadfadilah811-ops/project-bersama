"""Endpoint sempit untuk pengiriman invoice pesanan dari antrean WhatsApp."""

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from ..models import Order
from ..permissions import IsOwnerManagerAdminOrKasir
from ..services.lacak_pesanan import kirim_id_lacak_whatsapp
from ..services.order_invoice_whatsapp import kirim_invoice_pesanan_whatsapp


class OrderInvoiceWhatsAppView(APIView):
    permission_classes = [IsOwnerManagerAdminOrKasir]

    def post(self, request, order_id):
        try:
            result = kirim_invoice_pesanan_whatsapp(order_id=order_id)
        except Order.DoesNotExist:
            return Response({'detail': 'Pesanan tidak ditemukan.'}, status=status.HTTP_404_NOT_FOUND)

        if result['ok']:
            return Response(result, status=status.HTTP_200_OK)
        if result['status'] == 'failed':
            return Response(result, status=status.HTTP_502_BAD_GATEWAY)
        return Response(result, status=status.HTTP_400_BAD_REQUEST)


class OrderIdLacakWhatsAppView(APIView):
    """Tombol "Kirim ID Pesanan WA": kirim ID lacak saja, tanpa faktur."""
    permission_classes = [IsOwnerManagerAdminOrKasir]

    def post(self, request, order_id):
        try:
            result = kirim_id_lacak_whatsapp(order_id, manual=True, user=request.user)
        except Order.DoesNotExist:
            return Response({'detail': 'Pesanan tidak ditemukan.'}, status=status.HTTP_404_NOT_FOUND)

        if result['ok']:
            return Response(result, status=status.HTTP_200_OK)
        if result['status'] == 'failed':
            return Response(result, status=status.HTTP_502_BAD_GATEWAY)
        return Response(result, status=status.HTTP_400_BAD_REQUEST)
