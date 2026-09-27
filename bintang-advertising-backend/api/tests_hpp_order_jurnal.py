"""Jurnal HPP untuk penjualan lewat Order (2026-09-28).

Sebelumnya Order memotong lapisan FIFO tanpa jurnal HPP, sehingga saldo
Persediaan di buku besar lebih besar dari nilai stok riil dan Tutup Buku ditolak.
"""
import uuid
from decimal import Decimal
from io import StringIO

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.utils import timezone
from rest_framework.test import APITestCase

from accounting.models import Account, AccountClassification, AccountingSettings, AccountType, JournalEntry
from accounting.services.ledger import get_account_balances
from . import stock_fifo
from .models import Divisi, Order, TahapProses
from .product_models import Product, ProductStockMovement


class HppOrderJurnalTest(APITestCase):
    def setUp(self):
        User = get_user_model()
        self.owner = User.objects.create_user(username='owner_hpp_order', password='x', role='owner')
        self.staff = User.objects.create_user(username='staff_hpp_order', password='x', role='staff')
        self.divisi = Divisi.objects.create(nama='Produksi HPP Order')
        TahapProses.objects.create(nama='Cetak', divisi=self.divisi, urutan=1)
        aset = AccountClassification.objects.create(name='Aset HPP', account_type=AccountType.ASSET,
                                                    code_range_start=10000, code_range_end=19999)
        beban = AccountClassification.objects.create(name='Beban HPP', account_type=AccountType.EXPENSE,
                                                     code_range_start=50000, code_range_end=59999)
        self.persediaan = Account.objects.create(code='11400', name='Persediaan', classification=aset, account_type=AccountType.ASSET)
        self.hpp = Account.objects.create(code='51000', name='HPP', classification=beban, account_type=AccountType.EXPENSE)
        self.pengaturan = AccountingSettings.objects.create(
            accounting_start_date=timezone.localdate() - timezone.timedelta(days=30),
            is_active=True, initial_setup_completed_at=timezone.now(),
            pos_cogs_expense_account=self.hpp, pos_inventory_account=self.persediaan,
        )
        self.produk = Product.objects.create(nama='Mendoan HPP', harga_beli=1000, harga_jual_toko=2000,
                                             qty_stok=10, lacak_inventori=True)
        stock_fifo.create_layer(self.produk, None, 10, 1000, timezone.localdate())
        self.client.force_authenticate(self.owner)

    def _checkout(self, qty):
        res = self.client.post('/api/orders/checkout-pos/', {
            'idempotency_key': str(uuid.uuid4()), 'nama': 'Pelanggan HPP', 'nomor_wa': '081234567890',
            'items': [{'product_id': self.produk.id, 'qty': qty, 'harga_satuan': 2000}],
            'jumlah_bayar': 2000 * qty, 'metode_pembayaran': 'tunai', 'dilayani_oleh_id': self.staff.id,
            'jatuh_tempo': str(timezone.localdate()),
            'spk': {'divisi_id': self.divisi.id, 'deadline': str(timezone.localdate())},
        }, format='json')
        self.assertEqual(res.status_code, 201, res.content)
        return res.json()['id']

    def _saldo(self, akun):
        return get_account_balances([akun], timezone.localdate()).get(akun.id, Decimal('0'))

    def _jurnal_hpp(self):
        return JournalEntry.objects.filter(source_type=JournalEntry.SourceType.ORDER_STOCK_HPP)

    def test_penjualan_order_menjurnal_hpp_sekali(self):
        order_id = self._checkout(3)
        mv = ProductStockMovement.objects.get(order_id=order_id, tipe='penjualan')
        self.assertEqual(self._jurnal_hpp().count(), 1)
        self.assertEqual(self._saldo(self.hpp), Decimal('3000'))
        self.assertEqual(self._saldo(self.persediaan), Decimal('-3000'))
        mv.save()  # simpan ulang tidak membuat jurnal kedua (M4)
        self.assertEqual(self._jurnal_hpp().count(), 1)

    def test_batal_order_membalik_hpp(self):
        order_id = self._checkout(4)
        res = self.client.post(f'/api/orders/{order_id}/batalkan/', {'alasan': 'uji'}, format='json')
        self.assertEqual(res.status_code, 200, res.content)
        self.assertEqual(self._jurnal_hpp().count(), 2)
        self.assertEqual(self._saldo(self.hpp), Decimal('0'))
        self.assertEqual(self._saldo(self.persediaan), Decimal('0'))

    def test_batal_order_lama_tanpa_jurnal_hpp_tidak_membalik(self):
        order_id = self._checkout(2)
        self._jurnal_hpp().delete()  # simulasi order sebelum perbaikan
        self.client.post(f'/api/orders/{order_id}/batalkan/', {'alasan': 'uji'}, format='json')
        self.assertEqual(self._jurnal_hpp().count(), 0)

    def test_perintah_susulan_simulasi_lalu_terapkan(self):
        order_id = self._checkout(2)
        self._jurnal_hpp().delete()
        out = StringIO()
        call_command('backfill_hpp_order', stdout=out)
        self.assertIn('SIMULASI', out.getvalue())
        self.assertIn('HPP bersih 2000', out.getvalue())
        self.assertEqual(self._jurnal_hpp().count(), 0)
        call_command('backfill_hpp_order', '--terapkan', stdout=StringIO())
        self.assertEqual(self._jurnal_hpp().count(), 1)
        call_command('backfill_hpp_order', '--terapkan', stdout=StringIO())
        self.assertEqual(self._jurnal_hpp().count(), 1)
        self.assertTrue(Order.objects.filter(pk=order_id).exists())

    def test_akuntansi_belum_aktif_tidak_menjurnal(self):
        self.pengaturan.is_active = False
        self.pengaturan.save()
        self._checkout(1)
        self.assertEqual(self._jurnal_hpp().count(), 0)


class TutupBukuAkunLabaRugiTest(APITestCase):
    def test_saldo_kredit_akun_beban_tidak_menghalangi(self):
        from accounting.services.journal import create_journal_entry
        from accounting.services.period import get_negative_account_balances

        aset = AccountClassification.objects.create(name='Aset TB', account_type=AccountType.ASSET,
                                                    code_range_start=10000, code_range_end=19999)
        beban = AccountClassification.objects.create(name='Beban TB', account_type=AccountType.EXPENSE,
                                                     code_range_start=80000, code_range_end=89999)
        kas = Account.objects.create(code='11101', name='Kas', classification=aset, account_type=AccountType.ASSET)
        persediaan = Account.objects.create(code='11400', name='Persediaan', classification=aset, account_type=AccountType.ASSET)
        penyesuaian = Account.objects.create(code='81000', name='Penyesuaian Barang', classification=beban, account_type=AccountType.EXPENSE)
        AccountingSettings.objects.create(accounting_start_date=timezone.localdate() - timezone.timedelta(days=5),
                                          is_active=True, initial_setup_completed_at=timezone.now())
        hari = timezone.localdate()
        create_journal_entry(date=hari, lines=[
            {'account': persediaan, 'debit': Decimal('10000'), 'kredit': Decimal('0')},
            {'account': penyesuaian, 'debit': Decimal('0'), 'kredit': Decimal('10000')},
        ], description='surplus opname')
        self.assertEqual(get_negative_account_balances(hari), [])
        # Akun neraca tetap diperiksa.
        create_journal_entry(date=hari, lines=[
            {'account': persediaan, 'debit': Decimal('5000'), 'kredit': Decimal('0')},
            {'account': kas, 'debit': Decimal('0'), 'kredit': Decimal('5000')},
        ], description='kas minus')
        self.assertEqual([r['code'] for r in get_negative_account_balances(hari)], ['11101'])
