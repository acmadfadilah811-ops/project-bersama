"""Endpoint terbatas untuk sertifikat dan signature QZ Tray."""

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from ..permissions import IsOwnerManagerAdminOrKasir
from ..services.qz_signing import QZSigningConfigurationError, get_qz_certificate, sign_qz_request


class QZCertificateView(APIView):
    """GET sertifikat publik QZ; hanya role yang boleh memakai POS."""

    permission_classes = [IsOwnerManagerAdminOrKasir]

    def get(self, request):
        try:
            return Response({'certificate': get_qz_certificate()})
        except QZSigningConfigurationError as error:
            return Response({'detail': str(error)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)


class QZSignView(APIView):
    """POST signature QZ dari private key server, tidak pernah ke browser."""

    permission_classes = [IsOwnerManagerAdminOrKasir]

    def post(self, request):
        try:
            signature = sign_qz_request(request.data.get('request'))
            return Response({'signature': signature})
        except ValueError as error:
            return Response({'detail': str(error)}, status=status.HTTP_400_BAD_REQUEST)
        except QZSigningConfigurationError as error:
            return Response({'detail': str(error)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
