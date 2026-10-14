"""Hapus file pratinjau edit StarFoto yang tidak dibutuhkan lagi (2026-10-15).

Pratinjau hanya dibutuhkan selama pelanggan belum memutuskan. File dihapus untuk
pesanan yang sudah disetujui, batal, atau order-nya selesai/batal, serta
pratinjau putaran lama. Baris PratinjauEdit tetap (riwayat keputusan).

    python manage.py bersihkan_pratinjau_foto          # pratinjau saja (dry-run)
    python manage.py bersihkan_pratinjau_foto --jalan  # hapus sungguhan
"""
from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models import F, Q

from api.services.starfoto_approval import buang_berkas_pratinjau
from api.starfoto_models import PratinjauEdit


class Command(BaseCommand):
    help = 'Hapus file pratinjau edit StarFoto yang sudah tidak dibutuhkan.'

    def add_arguments(self, parser):
        parser.add_argument('--jalan', action='store_true', help='Hapus sungguhan (tanpa ini hanya menghitung).')

    def handle(self, *args, **opsi):
        qs = PratinjauEdit.objects.exclude(berkas='').filter(
            Q(pesanan__approval_status='disetujui')
            | Q(pesanan__status='batal')
            | Q(pesanan__order__status_global__in=['selesai', 'batal'])
            | Q(putaran__lt=F('pesanan__approval_putaran'))
        )
        jumlah = qs.count()
        if not opsi['jalan']:
            self.stdout.write(f'{jumlah} file pratinjau bisa dihapus (dry-run, pakai --jalan untuk menghapus).')
            return
        with transaction.atomic():
            terhapus = buang_berkas_pratinjau(qs)
        self.stdout.write(self.style.SUCCESS(f'{terhapus} file pratinjau dihapus dari server.'))
