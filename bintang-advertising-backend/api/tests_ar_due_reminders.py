"""send_ar_due_reminders (management command) -- AccountingSettings.send_ar_due_email
/ reminder_days_before_due sebelumnya ada di Pengaturan Akuntansi tapi tidak
ada satu baris kode pun yang membacanya (ditemukan audit 2026-09-08).
"""
from datetime import timedelta
from decimal import Decimal
from io import StringIO

from django.contrib.auth import get_user_model
from django.core import mail
from django.core.management import call_command
from django.test import TestCase
from django.utils import timezone

from accounting.models import AccountingSettings
from api.models import Order, OrderActivityLog

User = get_user_model()


class ArDueRemindersTest(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            username='owner_ar_reminder', password='x', role='owner', email='owner@starphoto.test',
        )
        self.today = timezone.localdate()

    def _confirmed_order(self, order_id, jatuh_tempo, sisa_tagihan, status_global='review'):
        dp_dibayar = 50000
        order = Order.objects.create(
            id=order_id, nama='Pelanggan Reminder', nomor_wa='081234567890',
            dp_dibayar=dp_dibayar, jatuh_tempo=jatuh_tempo, status_global=status_global,
        )
        # Order.save() menghitung ulang total_harga dari item-item order
        # (kosong di test ini, jadi selalu jadi 0) SETIAP kali disimpan --
        # kwarg total_harga/sisa_tagihan langsung ke .create() diabaikan.
        # .update() lewat queryset melewati save() custom itu.
        Order.objects.filter(pk=order_id).update(
            total_harga=dp_dibayar + sisa_tagihan, sisa_tagihan=sisa_tagihan,
        )
        order.refresh_from_db()
        return order

    def test_nonaktif_tidak_mengirim_apa_pun(self):
        AccountingSettings.objects.create(accounting_start_date=self.today, send_ar_due_email=False)
        self._confirmed_order('ORD-R1', self.today, 100000)

        out = StringIO()
        call_command('send_ar_due_reminders', stdout=out)
        self.assertEqual(len(mail.outbox), 0)
        self.assertIn('nonaktif', out.getvalue())

    def test_aktif_mengirim_piutang_jatuh_tempo_dan_lewat_tempo(self):
        AccountingSettings.objects.create(
            accounting_start_date=self.today, send_ar_due_email=True, reminder_days_before_due=3,
        )
        due_soon = self._confirmed_order('ORD-R2', self.today + timedelta(days=2), 150000)
        overdue = self._confirmed_order('ORD-R3', self.today - timedelta(days=5), 75000)
        # Terlalu jauh (di luar jendela 3 hari) -- tidak boleh ikut.
        self._confirmed_order('ORD-R4', self.today + timedelta(days=10), 200000)
        # Sudah lunas -- tidak boleh ikut walau tanggalnya cocok.
        self._confirmed_order('ORD-R5', self.today, 0)

        call_command('send_ar_due_reminders')

        self.assertEqual(len(mail.outbox), 1)
        sent = mail.outbox[0]
        self.assertEqual(sent.to, ['owner@starphoto.test'])
        self.assertIn(due_soon.id, sent.body)
        self.assertIn(overdue.id, sent.body)
        self.assertNotIn('ORD-R4', sent.body)
        self.assertNotIn('ORD-R5', sent.body)

    def test_order_belum_dikonfirmasi_tidak_ikut(self):
        AccountingSettings.objects.create(
            accounting_start_date=self.today, send_ar_due_email=True, reminder_days_before_due=5,
        )
        # dp_dibayar=0 & tidak ada SPK -- order_confirmed_q() menolak.
        Order.objects.create(
            id='ORD-R6', nama='Belum Konfirmasi', nomor_wa='081234567891',
            dp_dibayar=0, jatuh_tempo=self.today,
        )
        Order.objects.filter(pk='ORD-R6').update(total_harga=100000, sisa_tagihan=100000)
        call_command('send_ar_due_reminders')
        self.assertEqual(len(mail.outbox), 0)

    def test_order_batal_tidak_ikut(self):
        AccountingSettings.objects.create(
            accounting_start_date=self.today, send_ar_due_email=True, reminder_days_before_due=5,
        )
        self._confirmed_order('ORD-R7', self.today, 100000, status_global='batal')
        call_command('send_ar_due_reminders')
        self.assertEqual(len(mail.outbox), 0)

    def test_tanpa_owner_beremail_tidak_mengirim(self):
        self.owner.email = ''
        self.owner.save(update_fields=['email'])
        AccountingSettings.objects.create(
            accounting_start_date=self.today, send_ar_due_email=True, reminder_days_before_due=5,
        )
        self._confirmed_order('ORD-R8', self.today, 100000)
        out = StringIO()
        call_command('send_ar_due_reminders', stdout=out)
        self.assertEqual(len(mail.outbox), 0)
        self.assertIn('tidak ada email dikirim', out.getvalue())
