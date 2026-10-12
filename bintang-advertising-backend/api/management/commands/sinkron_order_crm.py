"""Kirim (atau kirim ulang) order kasir ke CRM: untuk order yang dibuat sebelum
fitur ini aktif atau yang pengirimannya gagal karena CRM sedang down.

    manage.py sinkron_order_crm --dry-run   # hanya daftar
    manage.py sinkron_order_crm             # kirim semua yang tertunda
"""
from django.core.management.base import BaseCommand

from api.crm_order_models import OrderAsalCRM
from api.crm_push_models import OrderKeCRM
from api.models import Order
from api.services.crm_order_kasir import kirim_order_ke_crm


class Command(BaseCommand):
    help = "Kirim order kasir (sumber pos) yang belum/gagal terkirim ke CRM."

    def add_arguments(self, parser):
        parser.add_argument('--dry-run', action='store_true', help='Hanya tampilkan, tidak mengirim.')

    def handle(self, *args, **opts):
        asal_crm = set(OrderAsalCRM.objects.values_list('order_id', flat=True))
        catatan = {c.order_id: c for c in OrderKeCRM.objects.all()}
        tertunda = []
        for o in Order.objects.filter(sumber='pos').exclude(status_global='batal').exclude(nomor_wa='').order_by('waktu'):
            if o.pk in asal_crm:
                continue
            lunas = bool(o.total_harga) and not o.sisa_tagihan
            c = catatan.get(o.pk)
            if c is None or c.terkirim_pada is None or (lunas and c.lunas_terkirim_pada is None) or (
                not lunas and o.total_harga != c.total_terkirim
            ):
                tertunda.append(o)
        self.stdout.write(f'{len(tertunda)} order tertunda.')
        for o in tertunda:
            self.stdout.write(f'  {o.pk} {o.nama} total={o.total_harga} status={o.status_global}')
            if not opts['dry_run']:
                OrderKeCRM.objects.get_or_create(order_id=o.pk)
                kirim_order_ke_crm(o.pk)
        if not opts['dry_run']:
            terkirim = OrderKeCRM.objects.filter(order_id__in=[o.pk for o in tertunda], terkirim_pada__isnull=False).count()
            self.stdout.write(f'{terkirim} dari {len(tertunda)} berhasil terkirim.')
