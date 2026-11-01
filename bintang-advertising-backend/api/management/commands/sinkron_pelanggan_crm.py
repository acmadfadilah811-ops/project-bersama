"""Kirim pelanggan ERP ke CRM sebagai Contact (tanpa Opportunity).

Pelanggan BARU otomatis terkirim saat dibuat (lihat api/services/crm_pelanggan.py). Perintah ini untuk pelanggan
yang dibuat saat CRM sedang down atau sebelum fitur ini aktif. CRM idempoten (dedup per nomor WA), jadi aman
diulang. Tidak ada argumen untuk "semua pelanggan": 28 ribuan pelanggan impor Olsera sengaja tidak ikut kecuali
diminta lewat --sejak.

    manage.py sinkron_pelanggan_crm --sejak 2026-11-02 --dry-run   # hanya daftar
    manage.py sinkron_pelanggan_crm --sejak 2026-11-02             # kirim
    manage.py sinkron_pelanggan_crm --id 123 --id 124              # pelanggan tertentu
"""
import datetime

from django.core.management.base import BaseCommand, CommandError

from api.customer_models import Customer
from api.services.crm_pelanggan import kirim_pelanggan_ke_crm, nomor_untuk_crm


class Command(BaseCommand):
    help = "Kirim pelanggan ERP (dibuat sejak tanggal tertentu, atau id tertentu) ke CRM sebagai Contact."

    def add_arguments(self, parser):
        parser.add_argument('--sejak', help='Tanggal YYYY-MM-DD: pelanggan yang dibuat pada/sesudah tanggal ini.')
        parser.add_argument('--id', type=int, action='append', default=[], help='ID pelanggan (boleh berulang).')
        parser.add_argument('--dry-run', action='store_true', help='Hanya tampilkan, tidak mengirim.')

    def handle(self, *args, **opts):
        if not opts['sejak'] and not opts['id']:
            raise CommandError('Isi --sejak YYYY-MM-DD atau --id (tidak ada pilihan "semua pelanggan").')
        qs = Customer.objects.filter(is_active=True).order_by('id')
        if opts['id']:
            qs = qs.filter(pk__in=opts['id'])
        if opts['sejak']:
            try:
                tanggal = datetime.date.fromisoformat(opts['sejak'])
            except ValueError:
                raise CommandError('Format --sejak harus YYYY-MM-DD.')
            qs = qs.filter(created_at__date__gte=tanggal)
        layak = [(c, nomor_untuk_crm(c)) for c in qs]
        tanpa_nomor = [c for c, n in layak if not n]
        layak = [(c, n) for c, n in layak if n]
        self.stdout.write(f'{len(layak)} pelanggan punya nomor WA valid ({len(tanpa_nomor)} dilewati: tanpa nomor/nomor tidak valid).')
        berhasil = 0
        for c, nomor in layak:
            self.stdout.write(f'  [{c.pk}] {c.nama} -> {nomor}')
            if not opts['dry_run'] and kirim_pelanggan_ke_crm(c.pk):
                berhasil += 1
        if not opts['dry_run']:
            self.stdout.write(self.style.SUCCESS(f'{berhasil} dari {len(layak)} terkirim ke CRM.'))
