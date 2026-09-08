"""Kirim email harian ke Owner berisi Piutang yang jatuh tempo dalam N hari
(atau sudah lewat jatuh tempo) -- AccountingSettings.send_ar_due_email /
reminder_days_before_due sebelumnya ada di Pengaturan Akuntansi tapi tidak
ada satu baris kode pun yang membacanya (ditemukan audit 2026-09-08).

Kriteria "piutang" SAMA PERSIS dengan Daftar Piutang (order_confirmed_q() +
sisa_tagihan > 0) supaya tidak jadi sumber kebenaran baru yang bisa drift.

Project ini belum punya task scheduler (Celery beat dkk) -- dijadwalkan
lewat cron di VPS, mis.:
    0 7 * * * cd /opt/bintang/project-bersama/deploy && docker compose exec -T backend python manage.py send_ar_due_reminders
"""
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.core.mail import send_mail
from django.utils import timezone

from accounting.models import AccountingSettings
from api.models import CustomUser, Order
from api.report_views import order_confirmed_q


class Command(BaseCommand):
    help = "Kirim email pengingat Piutang jatuh tempo ke Owner (AccountingSettings.send_ar_due_email)."

    def handle(self, *args, **options):
        settings_row = AccountingSettings.objects.first()
        if not settings_row or not settings_row.send_ar_due_email:
            self.stdout.write("send_ar_due_email nonaktif -- tidak ada email dikirim.")
            return

        today = timezone.localdate()
        batas = today + timedelta(days=settings_row.reminder_days_before_due or 0)

        orders = list(
            Order.objects.filter(order_confirmed_q())
            .filter(sisa_tagihan__gt=0, jatuh_tempo__isnull=False, jatuh_tempo__lte=batas)
            .exclude(status_global='batal')
            .order_by('jatuh_tempo')
            .distinct()
        )
        if not orders:
            self.stdout.write("Tidak ada piutang yang perlu diingatkan hari ini.")
            return

        penerima = list(
            CustomUser.objects.filter(role='owner', is_active=True)
            .exclude(email='')
            .values_list('email', flat=True)
        )
        if not penerima:
            self.stdout.write(self.style.WARNING(
                "Ada piutang jatuh tempo tapi tidak ada user Owner dengan email terisi -- tidak ada email dikirim."
            ))
            return

        baris = []
        for order in orders:
            label = "SUDAH LEWAT" if order.jatuh_tempo < today else f"jatuh tempo {order.jatuh_tempo:%d-%m-%Y}"
            baris.append(
                f"- {order.id} | {order.nama or order.nomor_wa} | "
                f"Sisa Rp {order.sisa_tagihan:,.0f} | {label}"
            )

        subject = f"Pengingat Piutang Jatuh Tempo ({len(orders)} order)"
        message = (
            f"Daftar piutang yang jatuh tempo dalam {settings_row.reminder_days_before_due} hari ke depan "
            f"atau sudah lewat jatuh tempo, per {today:%d-%m-%Y}:\n\n"
            + "\n".join(baris)
            + "\n\nCek detail lengkap di menu Akuntansi Internal > Piutang > Semua Piutang."
        )
        send_mail(subject, message, None, penerima, fail_silently=False)
        self.stdout.write(self.style.SUCCESS(
            f"Email pengingat {len(orders)} piutang terkirim ke {len(penerima)} penerima."
        ))
