"""
Perbaikan satu kali untuk order yang tersangkut karena job "hantu" -- JobBoard
yang otomatis dibuat OrderItemSerializer.create()/update() di tahap pertama
global (by urutan) begitu item dibuat, tapi tak pernah tersentuh staf karena
SPK sungguhan diterbitkan ke tahap lain (mis. "Langsung Cetak / Produksi"
yang skip Desain/Edit). Bug di api/spk.py sudah diperbaiki supaya tidak
terjadi lagi ke depannya (job hantu langsung dibatalkan saat SPK baru
diterbitkan) -- command ini membereskan order yang SUDAH terlanjur
tersangkut sebelum perbaikan itu ada.

Idempotent & aman dijalankan ulang: hanya menyentuh job yang benar-benar
belum pernah diklaim/dimulai (status='antrean', pic_staff kosong,
waktu_mulai kosong) di tahap BEDA dari job order_item yang sama yang sudah
'selesai', dan hanya order yang statusnya bukan ready/selesai/batal.

Mendukung --dry-run dan --order <id> (bisa diulang) untuk membatasi ke order
tertentu saja.
"""
from django.core.management.base import BaseCommand
from django.db.models import Q
from django.utils import timezone

from api.models import JobBoard, Order, OrderActivityLog


class Command(BaseCommand):
    help = "Bereskan order yang tersangkut karena job hantu tak tersentuh (lihat api/spk.py)."

    def add_arguments(self, parser):
        parser.add_argument('--dry-run', action='store_true', help="Simulasi tanpa menyimpan perubahan.")
        parser.add_argument('--order', action='append', dest='order_ids', help="Batasi ke order id ini (bisa diulang).")

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        order_ids = options['order_ids']

        orders = Order.objects.exclude(status_global__in=['ready', 'selesai', 'batal'])
        if order_ids:
            orders = orders.filter(pk__in=order_ids)

        dibereskan = 0
        for order in orders.iterator():
            item_ids = list(order.items.values_list('id', flat=True))
            if not item_ids:
                continue

            jobs = list(JobBoard.objects.filter(order_item_id__in=item_ids))
            if not jobs:
                continue

            selesai_per_item = {}
            for j in jobs:
                if j.status_pekerjaan == 'selesai':
                    selesai_per_item.setdefault(j.order_item_id, []).append(j)

            hantu = [
                j for j in jobs
                if j.status_pekerjaan == 'antrean'
                and j.pic_staff_id is None
                and j.waktu_mulai is None
                and j.order_item_id in selesai_per_item
            ]
            if not hantu:
                continue

            aktif_asli = any(
                j.status_pekerjaan in ('antrean', 'dikerjakan', 'kendala') and j not in hantu
                for j in jobs
            )
            if aktif_asli:
                # Masih ada pekerjaan sungguhan yang belum tuntas -- bukan
                # kasus tersangkut, jangan disentuh.
                continue

            self.stdout.write(
                f"{order.id}: {len(hantu)} job hantu (id={[j.id for j in hantu]}), "
                f"status saat ini '{order.status_global}' -> 'ready'"
            )
            if dry_run:
                dibereskan += 1
                continue

            hantu_ids = [j.id for j in hantu]
            JobBoard.objects.filter(id__in=hantu_ids).update(
                status_pekerjaan='batal', waktu_selesai=timezone.now(),
            )
            order.status_global = 'ready'
            order.save(update_fields=['status_global'])
            OrderActivityLog.objects.create(
                order=order,
                user=None,
                tindakan="READY_ORDER",
                keterangan=(
                    "Perbaikan data: job hantu (tak pernah tersentuh staf) di tahap lain "
                    "dibatalkan otomatis, semua item sungguhan sudah selesai diproduksi. "
                    "Status pesanan diubah menjadi 'Siap Diambil'."
                ),
            )
            dibereskan += 1

        self.stdout.write(self.style.SUCCESS(f"Selesai. {dibereskan} order dibereskan."))
        if dry_run:
            self.stdout.write(self.style.WARNING("DRY RUN — tidak ada perubahan disimpan."))
