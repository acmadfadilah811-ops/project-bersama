"""Kirim ulang rincian penjualan yang SUDAH ada di CRM supaya Peluang lama punya nama, deskripsi, dan
langkah berikutnya yang jelas (2026-11-02). Nilai dan tahap Peluang di CRM tidak berubah; hanya teks rincian.

    manage.py sinkron_rincian_peluang_crm --dry-run          # hanya hitung
    manage.py sinkron_rincian_peluang_crm                    # kirim ulang semua
    manage.py sinkron_rincian_peluang_crm --maks 5           # uji dulu 5 pertama

CRM membatasi 60 panggilan per menit, jadi ada jeda antar pengiriman (--jeda, default 1.2 detik).
"""
import time

from django.core.management.base import BaseCommand

from api.crm_order_models import OrderAsalCRM
from api.crm_push_models import OrderKeCRM
from api.models import Order
from api.pos_models import POSSale
from api.services.crm_bridge import sync_possale_ke_crm
from api.services.crm_order_kasir import kirim_order_ke_crm


class Command(BaseCommand):
    help = "Kirim ulang rincian order kasir & penjualan POS yang sudah di CRM (Peluang lama jadi jelas)."

    def add_arguments(self, parser):
        parser.add_argument('--dry-run', action='store_true', help='Hanya hitung, tidak mengirim.')
        parser.add_argument('--jeda', type=float, default=1.2, help='Detik antar pengiriman (batas CRM 60/menit).')
        parser.add_argument('--maks', type=int, default=0, help='Batasi jumlah pengiriman (0 = semua).')

    def _daftar(self):
        asal_crm = set(OrderAsalCRM.objects.values_list('order_id', flat=True))
        terkirim = set(OrderKeCRM.objects.filter(terkirim_pada__isnull=False).values_list('order_id', flat=True))
        order_ids = [
            pk for pk in Order.objects.filter(sumber='pos', pk__in=terkirim)
            .exclude(status_global='batal').exclude(nomor_wa='').order_by('waktu').values_list('pk', flat=True)
            if pk not in asal_crm
        ]
        sale_ids = list(
            POSSale.objects.filter(status='paid', synced_to_crm_at__isnull=False, pelanggan__isnull=False)
            .order_by('created_at').values_list('pk', flat=True)
        )
        return order_ids, sale_ids

    def handle(self, *args, **opts):
        order_ids, sale_ids = self._daftar()
        antrean = [('order', pk) for pk in order_ids] + [('possale', pk) for pk in sale_ids]
        if opts['maks'] > 0:
            antrean = antrean[:opts['maks']]
        self.stdout.write(f'{len(order_ids)} order kasir + {len(sale_ids)} penjualan POS terkirim sebelumnya; '
                          f'{len(antrean)} akan dikirim ulang.')
        if opts['dry_run']:
            return
        berhasil = 0
        for jenis, pk in antrean:
            ok = kirim_order_ke_crm(pk, paksa=True) if jenis == 'order' else sync_possale_ke_crm(pk, paksa=True)
            berhasil += 1 if ok else 0
            if not ok:
                self.stdout.write(f'  gagal: {jenis} {pk}')
            time.sleep(opts['jeda'])
        self.stdout.write(f'{berhasil} dari {len(antrean)} terkirim ulang.')
