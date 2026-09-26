"""Persetujuan pencairan gaji 5 tahap. Aturan & peran ada di
services/payroll_persetujuan.py (dicek server-side, bukan hanya disembunyikan di UI)."""

from datetime import date

from rest_framework import status
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from ..models import Account, PengajuanGaji
from ..services import payroll_persetujuan as svc


class BolehLihatPersetujuanGaji(BasePermission):
    message = "Hanya Owner, Manager, SPV Finance, dan Admin Finance."

    def has_permission(self, request, view):
        return svc._peran(request.user) in svc.PERAN_LIHAT


def _nama(u):
    return (u.get_full_name() or u.get_username()) if u else None


def _bentuk(p, user):
    peran = svc._peran(user)
    S = PengajuanGaji.Status
    posting = p.payroll_posting
    return {
        "id": p.id,
        "periode": f"{p.tahun:04d}-{p.bulan:02d}",
        "tahun": p.tahun, "bulan": p.bulan,
        "status": p.status, "status_label": p.get_status_display(),
        "ringkasan": p.ringkasan, "cek": p.cek,
        "jurnal_pengakuan": posting.journal_entry.entry_number if posting else None,
        "jurnal_pembayaran": (posting.payment_journal_entry.entry_number
                              if posting and posting.payment_journal_entry_id else None),
        "total_bersih": str(posting.total_net) if posting else p.ringkasan.get("total_net"),
        "bukti_transfer": p.bukti_transfer.url if p.bukti_transfer else None,
        "alasan_tolak": p.alasan_tolak, "sinkron_hr": p.sinkron_hr,
        "diverifikasi_oleh": _nama(p.diverifikasi_oleh), "diotorisasi_oleh": _nama(p.diotorisasi_oleh),
        "dibayar_oleh": _nama(p.dibayar_oleh), "ditolak_oleh": _nama(p.ditolak_oleh),
        "log": [{"aksi": l.get_aksi_display(), "oleh": _nama(l.oleh), "pada": l.pada.isoformat(),
                 "catatan": l.catatan} for l in p.log.all()],
        # Tombol yang boleh tampil untuk pengguna ini (server tetap memeriksa ulang).
        "aksi": {
            "verifikasi": p.status == S.MENUNGGU_VERIFIKASI and peran in svc.PERAN_VERIFIKASI,
            "otorisasi": (p.status == S.MENUNGGU_OTORISASI and peran in svc.PERAN_OTORISASI
                          and p.diverifikasi_oleh_id != user.pk),
            "bayar": (p.status == S.SIAP_DIBAYAR and peran in svc.PERAN_BAYAR
                      and p.diotorisasi_oleh_id != user.pk),
            "tolak": ((p.status == S.MENUNGGU_VERIFIKASI and peran in svc.PERAN_VERIFIKASI)
                      or (p.status == S.MENUNGGU_OTORISASI and peran in svc.PERAN_OTORISASI)),
        },
    }


class _Dasar(APIView):
    permission_classes = [IsAuthenticated, BolehLihatPersetujuanGaji]

    def handle_exception(self, exc):
        if isinstance(exc, PermissionError):
            return Response({"error": str(exc)}, status=status.HTTP_403_FORBIDDEN)
        if isinstance(exc, svc.pp.PayrollError):
            return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        if isinstance(exc, PengajuanGaji.DoesNotExist):
            return Response({"error": "Pengajuan tidak ditemukan."}, status=status.HTTP_404_NOT_FOUND)
        return super().handle_exception(exc)

    def _jawab(self, p):
        p.refresh_from_db()
        return Response(_bentuk(p, self.request.user))


class PengajuanGajiListView(_Dasar):
    """GET /api/accounting/payroll/pengajuan/?page= -- terbaru dulu, 10 per halaman."""

    def get(self, request):
        qs = PengajuanGaji.objects.select_related(
            "payroll_posting__journal_entry", "payroll_posting__payment_journal_entry",
            "diverifikasi_oleh", "diotorisasi_oleh", "dibayar_oleh", "ditolak_oleh",
        ).prefetch_related("log__oleh")
        pag = PageNumberPagination()
        pag.page_size = 10
        halaman = pag.paginate_queryset(qs, request, view=self)
        return pag.get_paginated_response([_bentuk(p, request.user) for p in halaman])


class PengajuanGajiVerifikasiView(_Dasar):
    def post(self, request, pk):
        return self._jawab(svc.verifikasi(pk, request.user))


class PengajuanGajiOtorisasiView(_Dasar):
    def post(self, request, pk):
        return self._jawab(svc.otorisasi(pk, request.user))


class PengajuanGajiTolakView(_Dasar):
    def post(self, request, pk):
        return self._jawab(svc.tolak(pk, request.user, request.data.get("alasan")))


class PengajuanGajiBayarView(_Dasar):
    """POST multipart: akun_kas, tanggal (YYYY-MM-DD, opsional), bukti (berkas)."""

    def post(self, request, pk):
        tanggal = request.data.get("tanggal") or None
        if tanggal:
            try:
                tanggal = date.fromisoformat(str(tanggal))
            except ValueError:
                raise svc.PersetujuanError("Format tanggal harus YYYY-MM-DD.")
        bukti = request.FILES.get("bukti")
        if bukti and bukti.size > 10 * 1024 * 1024:
            raise svc.PersetujuanError("Ukuran bukti transfer maksimal 10 MB.")
        if bukti and not bukti.name.lower().endswith((".pdf", ".jpg", ".jpeg", ".png")):
            raise svc.PersetujuanError("Bukti transfer harus PDF, JPG, atau PNG.")
        return self._jawab(svc.bayar(pk, request.user, request.data.get("akun_kas"), tanggal, bukti))


class PengajuanGajiAkunKasView(_Dasar):
    """GET /api/accounting/payroll/pengajuan/akun-kas/ -- akun Kas & Bank aktif untuk
    form pembayaran (Admin Finance tidak punya akses ke daftar akun penuh)."""

    def get(self, request):
        akun = Account.objects.filter(
            is_active=True, account_type=Account.AccountType.ASSET, classification__name="Kas & Bank",
        ).order_by("code")
        return Response([{"id": a.id, "code": a.code, "name": a.name} for a in akun])
