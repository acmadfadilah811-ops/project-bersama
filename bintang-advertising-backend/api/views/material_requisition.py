"""Permintaan Bahan (Material Requisition) -- view tipis: parse -> panggil
services/material_requisition.py -> response. Aturan & scoping ada di service."""

from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from api.permissions import CanUseMaterialRequisition
from api.requisition_serializers import MaterialRequisitionCreateSerializer, MaterialRequisitionSerializer
from api.services import material_requisition as svc


class MaterialRequisitionViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin,
                                 mixins.CreateModelMixin, viewsets.GenericViewSet):
    """GET/POST /api/material-requisitions/ dan aksi per dokumen:
    setujui, tolak, siapkan, terima, batalkan (POST), ringkasan (GET)."""

    permission_classes = [CanUseMaterialRequisition]
    serializer_class = MaterialRequisitionSerializer

    def get_queryset(self):
        qs = svc.queryset_untuk(self.request.user)
        status_param = self.request.query_params.get('status')
        if status_param:
            qs = qs.filter(status__in=[s for s in status_param.split(',') if s])
        return qs

    def get_serializer_class(self):
        if self.action == 'create':
            return MaterialRequisitionCreateSerializer
        return MaterialRequisitionSerializer

    def _respon(self, req, kode=status.HTTP_200_OK, **tambahan):
        # Muat ulang lewat queryset ter-scoping supaya prefetch & cakupan konsisten.
        req = svc.queryset_untuk(self.request.user).get(pk=req.pk)
        data = MaterialRequisitionSerializer(req, context={'request': self.request}).data
        return Response({**data, **tambahan} if tambahan else data, status=kode)

    @staticmethod
    def _jalankan(fn, *args, **kwargs):
        try:
            return fn(*args, **kwargs), None
        except svc.RequisitionForbidden as exc:
            return None, Response({'error': str(exc)}, status=status.HTTP_403_FORBIDDEN)
        except svc.RequisitionError as exc:
            return None, Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    def create(self, request, *args, **kwargs):
        ser = MaterialRequisitionCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        d = ser.validated_data
        req, err = self._jalankan(
            svc.buat_permintaan, request.user, keperluan=d.get('keperluan', ''),
            items=[dict(b) for b in d['items']], job_id=d.get('job'),
        )
        return err or self._respon(req, status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'])
    def ringkasan(self, request):
        return Response(svc.ringkasan(request.user))

    def _aksi(self, fn, *args):
        # get_object() memastikan dokumen ada dalam cakupan pengguna (404 bila di luar).
        req = self.get_object()
        hasil, err = self._jalankan(fn, req.pk, self.request.user, *args)
        return err, hasil

    @action(detail=True, methods=['post'])
    def setujui(self, request, pk=None):
        err, hasil = self._aksi(svc.setujui, request.data.get('qty_disetujui'))
        return err or self._respon(hasil)

    @action(detail=True, methods=['post'])
    def tolak(self, request, pk=None):
        err, hasil = self._aksi(svc.tolak, request.data.get('alasan'))
        return err or self._respon(hasil)

    @action(detail=True, methods=['post'])
    def siapkan(self, request, pk=None):
        err, hasil = self._aksi(svc.siapkan, request.data.get('qty_disiapkan'))
        if err:
            return err
        req, peringatan = hasil
        return self._respon(req, peringatan_stok=peringatan)

    @action(detail=True, methods=['post'])
    def terima(self, request, pk=None):
        err, hasil = self._aksi(svc.terima)
        return err or self._respon(hasil)

    @action(detail=True, methods=['post'])
    def batalkan(self, request, pk=None):
        err, hasil = self._aksi(svc.batalkan)
        return err or self._respon(hasil)
