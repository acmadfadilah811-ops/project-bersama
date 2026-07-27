"""
Management command idempotent untuk memindahkan metadata order dari hack JSON
di Order.catatan_pelanggan `[METADATA: {...}]` ke kolom asli Bahasa Indonesia pada model Order (T-209).

Mendukung --dry-run untuk mensimulasikan hasil migrasi tanpa menyimpannya ke database.
"""
import json
import re
from datetime import datetime
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from api.models import Order

User = get_user_model()


class Command(BaseCommand):
    help = "Migrasikan JSON metadata dari Order.catatan_pelanggan ke kolom asli Order."

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run', action='store_true',
            help="Hanya tampilkan laporan simulasi migrasi tanpa menyimpan ke database.",
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']

        pattern = re.compile(r'\[METADATA:\s*({.*?})\]', re.DOTALL)
        orders = Order.objects.filter(catatan_pelanggan__icontains='[METADATA:').only('id', 'catatan_pelanggan', 'dilayani_oleh')

        total = orders.count()
        processed = 0
        ambiguous_users = []

        self.stdout.write(f"Mulai migrasi metadata untuk {total} pesanan...")

        for order in orders.iterator():
            match = pattern.search(order.catatan_pelanggan or '')
            if not match:
                continue

            raw_json = match.group(1)
            try:
                meta = json.loads(raw_json)
            except Exception as e:
                self.stdout.write(self.style.ERROR(f"Gagal parse JSON di Order {order.id}: {e}"))
                continue

            # Populate fields
            order.email_pelanggan = meta.get('customerEmail') or None
            order.alamat_pelanggan = meta.get('customerAddress') or None
            order.kurir_pengiriman = meta.get('shippingCourier') or None
            order.layanan_pengiriman = meta.get('shippingService') or None

            # Shipping Date
            s_date = meta.get('shippingDate')
            if s_date and s_date != '-':
                try:
                    order.tanggal_pengiriman = datetime.strptime(s_date, '%Y-%m-%d').date()
                except ValueError:
                    order.tanggal_pengiriman = None

            order.toko_dropship = meta.get('dropshipStore') or None
            order.pengirim_dropship = meta.get('dropshipSender') or None
            order.telepon_dropship = meta.get('dropshipPhone') or None

            # Due Date -> jatuh_tempo
            d_date = meta.get('dueDate')
            if d_date and d_date != '-':
                try:
                    order.jatuh_tempo = datetime.strptime(d_date, '%Y-%m-%d').date()
                except ValueError:
                    order.jatuh_tempo = None

            # Invoice Footer -> catatan_footer
            if meta.get('invoiceFooter'):
                order.catatan_footer = meta.get('invoiceFooter')

            # posStaff -> dilayani_oleh (FK CustomUser) jika belum ada dilayani_oleh
            pos_staff = meta.get('posStaff')
            if pos_staff and not order.dilayani_oleh:
                staff_matches = User.objects.filter(username__iexact=pos_staff) | User.objects.filter(first_name__iexact=pos_staff)
                staff_matches = staff_matches.distinct()
                if staff_matches.count() == 1:
                    order.dilayani_oleh = staff_matches.first()
                elif staff_matches.count() > 1:
                    ambiguous_users.append(f"Order {order.id}: '{pos_staff}' cocok dengan multiple user, butuh review manual.")

            # Bersihkan tag [METADATA: ...] dari catatan_pelanggan
            clean_note = pattern.sub('', order.catatan_pelanggan).strip()
            order.catatan_pelanggan = clean_note if clean_note else None

            if not dry_run:
                order.save(update_fields=[
                    'email_pelanggan', 'alamat_pelanggan', 'kurir_pengiriman', 'layanan_pengiriman',
                    'tanggal_pengiriman', 'toko_dropship', 'pengirim_dropship', 'telepon_dropship',
                    'jatuh_tempo', 'catatan_footer', 'dilayani_oleh', 'catatan_pelanggan'
                ])

            processed += 1

        self.stdout.write(self.style.SUCCESS(f"Selesai! Total diproses: {processed}/{total} pesanan."))
        if ambiguous_users:
            self.stdout.write(self.style.WARNING("Peringatan kecocokan staf ambigu:"))
            for item in ambiguous_users:
                self.stdout.write(self.style.WARNING(f"  - {item}"))

        if dry_run:
            self.stdout.write(self.style.WARNING("DRY RUN — Tidak ada perubahan yang disimpan ke database."))
