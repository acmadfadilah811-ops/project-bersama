"""Akun & departemen per unit bisnis (2026-10-11): transaksi kasir/pesanan unit
StarFoto memakai akun pengganti unit (pendapatan, HPP, kas tunai) dan ditandai
departemen unit; unit tanpa pengaturan tetap memakai akun umum."""
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APITestCase

from accounting.models import (
    Account, AccountClassification, AccountingSettings, AccountType, JournalEntry, PaymentMethod,
)
from accounting.models.unit_bisnis import AkunUnitBisnis
from accounting.services.order_posting import post_order_payment_journal, post_order_revenue_recognition_journal
from api.models import Contact, Order, OrderActivityLog, OrderItem, POSPaymentMethod, SaldoKasHarian, UnitBisnis
from api.pos_services import create_sale

User = get_user_model()


class AkunUnitBisnisTests(APITestCase):
    def setUp(self):
        self.foto, _ = UnitBisnis.objects.get_or_create(nama='StarFoto')
        self.adv, _ = UnitBisnis.objects.get_or_create(nama='Star Advertising')
        self.owner = User.objects.create_user(username='owner.akun', password='x', role='owner')
        self.kasir_foto = User.objects.create_user(username='kasir.foto', password='x', role='kasir', unit_bisnis=self.foto)
        self.kasir_adv = User.objects.create_user(username='kasir.adv', password='x', role='kasir', unit_bisnis=self.adv)
        for kasir in (self.kasir_foto, self.kasir_adv):
            SaldoKasHarian.objects.create(kasir=kasir, tanggal=timezone.localdate(), kas_awal=Decimal('0'),
                                          waktu_buka=timezone.now())
        Contact.objects.get_or_create(nomor_wa='081299900001', defaults={'nama': 'Pelanggan Uji'})

        aset = AccountClassification.objects.create(name='Aset', account_type=AccountType.ASSET,
                                                    code_range_start=10000, code_range_end=19999)
        kewajiban = AccountClassification.objects.create(name='Kewajiban', account_type=AccountType.LIABILITY,
                                                         code_range_start=20000, code_range_end=29999)
        pendapatan = AccountClassification.objects.create(name='Pendapatan', account_type=AccountType.REVENUE,
                                                          code_range_start=40000, code_range_end=49999)
        self.kas = Account.objects.create(code='11101', name='Kas Toko', classification=aset)
        self.kas_foto = Account.objects.create(code='11102', name='Kas StarFoto', classification=aset)
        self.piutang = Account.objects.create(code='11301', name='Piutang Usaha', classification=aset)
        self.uang_muka = Account.objects.create(code='21301', name='Uang Muka Pelanggan', classification=kewajiban)
        self.pend_pos = Account.objects.create(code='41101', name='Pendapatan POS', classification=pendapatan,
                                                 account_type=AccountType.REVENUE)
        self.pend_order = Account.objects.create(code='41201', name='Pendapatan Order', classification=pendapatan,
                                                 account_type=AccountType.REVENUE)
        self.pend_foto = Account.objects.create(code='41301', name='Pendapatan Jasa Foto', classification=pendapatan,
                                                 account_type=AccountType.REVENUE)
        AccountingSettings.objects.create(
            accounting_start_date=timezone.localdate() - timezone.timedelta(days=30), is_active=True,
            initial_setup_completed_at=timezone.now(), pos_sales_revenue_account=self.pend_pos,
            order_sales_revenue_account=self.pend_order, order_receivable_account=self.piutang,
            order_customer_deposit_account=self.uang_muka,
        )
        self.pm_cash = PaymentMethod.objects.create(name='Tunai', payment_type='Tunai', account=self.kas, is_cash=True)
        POSPaymentMethod.objects.create(nama='Cash', tipe='Tunai', accounting_payment_method=self.pm_cash)

        # Migrasi 0047 sudah membuat baris + departemen per unit (akun pengganti kosong).
        cfg = AkunUnitBisnis.objects.get(unit_bisnis=self.foto)
        cfg.pos_sales_revenue_account = cfg.order_sales_revenue_account = self.pend_foto
        cfg.kas_tunai_account = self.kas_foto
        cfg.save()
        self.dept_foto = cfg.department
        self.dept_adv = AkunUnitBisnis.objects.get(unit_bisnis=self.adv).department

    def _jual(self, kasir, nominal):
        sale = create_sale(user=kasir, data={
            'pelanggan': '081299900001', 'status': 'paid', 'metode_bayar': 'Cash', 'dibayar': nominal,
            'items': [{'nama': 'Cetak', 'harga': nominal, 'qty': 1}],
        })
        return JournalEntry.objects.get(source_type=JournalEntry.SourceType.POS_SALE, source_id=sale.id)

    def _akun(self, entry):
        return {(l.account_id, l.debit, l.kredit) for l in entry.lines.all()}

    def test_pos_starfoto_pakai_akun_unit_advertising_akun_umum(self):
        foto = self._jual(self.kasir_foto, 50000)
        self.assertEqual(self._akun(foto), {(self.kas_foto.id, Decimal('50000.00'), 0), (self.pend_foto.id, 0, Decimal('50000.00'))})
        self.assertEqual(foto.department, self.dept_foto)
        adv = self._jual(self.kasir_adv, 30000)
        self.assertEqual(self._akun(adv), {(self.kas.id, Decimal('30000.00'), 0), (self.pend_pos.id, 0, Decimal('30000.00'))})
        self.assertEqual(adv.department, self.dept_adv)
        self.assertEqual(self.dept_foto.name, 'StarFoto')

    def test_pesanan_starfoto_dp_dan_pengakuan_pendapatan(self):
        order = Order.objects.create(id='ORD-AKUN-FOTO', nama='Dinda', nomor_wa='0812', unit_bisnis=self.foto,
                                     metode_pembayaran='tunai')
        OrderItem.objects.create(order=order, jenis_produk='Family Classic', qty=1, harga_jual=290000)
        order.dp_dibayar = 150000
        order.save()
        dp = post_order_payment_journal(order, jumlah_bayar=Decimal('150000'), is_dp=True)
        self.assertEqual(self._akun(dp), {(self.kas_foto.id, Decimal('150000.00'), 0), (self.uang_muka.id, 0, Decimal('150000.00'))})
        self.assertEqual(dp.department, self.dept_foto)

        order.status_global = 'selesai'
        order.save()
        log = OrderActivityLog.objects.create(order=order, tindakan='COMPLETE', keterangan='selesai')
        pendapatan = post_order_revenue_recognition_journal(order, activity_log=log)
        kredit_pendapatan = [l for l in pendapatan.lines.all() if l.account_id == self.pend_foto.id]
        self.assertEqual(kredit_pendapatan[0].kredit, Decimal('290000.00'))
        self.assertEqual(sum(l.debit for l in pendapatan.lines.all()), sum(l.kredit for l in pendapatan.lines.all()))
        self.assertEqual(pendapatan.department, self.dept_foto)

    def test_laba_rugi_per_unit(self):
        self._jual(self.kasir_foto, 50000)
        self._jual(self.kasir_adv, 30000)
        self.client.force_authenticate(self.owner)
        url = '/api/accounting/reports/income-statement/'
        semua = self.client.get(url).json()
        self.assertEqual(Decimal(str(semua['subtotal_pendapatan'])), Decimal('80000'))
        foto = self.client.get(url, {'unit_bisnis': self.foto.id})
        self.assertEqual(foto.status_code, 200, foto.content)
        self.assertEqual(Decimal(str(foto.json()['subtotal_pendapatan'])), Decimal('50000'))
        adv = self.client.get(url, {'unit_bisnis': self.adv.id}).json()
        self.assertEqual(Decimal(str(adv['subtotal_pendapatan'])), Decimal('30000'))
        self.assertEqual(self.client.get(url, {'unit_bisnis': 'x'}).status_code, 400)

    def test_pengaturan_akun_unit(self):
        self.client.force_authenticate(self.kasir_foto)
        self.assertEqual(self.client.get('/api/accounting/akun-unit-bisnis/').status_code, 403)
        self.client.force_authenticate(self.owner)
        res = self.client.get('/api/accounting/akun-unit-bisnis/')
        self.assertEqual(res.status_code, 200)
        adv = next(r for r in res.json() if r['unit_bisnis'] == self.adv.id)
        self.assertEqual(adv['department_nama'], 'Star Advertising')
        res = self.client.patch(f'/api/accounting/akun-unit-bisnis/{self.adv.id}/',
                                {'pos_sales_revenue_account': self.pend_order.id}, format='json')
        self.assertEqual(res.status_code, 200, res.content)
        self.assertEqual(AkunUnitBisnis.objects.get(unit_bisnis=self.adv).pos_sales_revenue_account, self.pend_order)
