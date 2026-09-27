"""Order dari CRM tampil di Antrean Online & Offline beserta nama sales (2026-09-27)."""
from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from api.crm_order_models import OrderAsalCRM
from api.models import Order, UnitBisnis

User = get_user_model()


class AntreanOrderCrmTest(APITestCase):
    def setUp(self):
        unit, _ = UnitBisnis.objects.get_or_create(nama='Star Advertising Uji Antrean')
        self.kasir = User.objects.create_user(username='kasir-antrean-crm', password='x', role='kasir', unit_bisnis=unit)
        self.client.force_authenticate(self.kasir)
        self.order_crm = Order.objects.create(id='ORD-CRM-ANTREAN', nomor_wa='6281200000001', nama='Ahmad',
                                              status_global='draft', sumber='crm')
        OrderAsalCRM.objects.create(order=self.order_crm, kunci='uji-antrean-crm', sales_nama='Sari Sales')
        Order.objects.create(id='ORD-POS-ANTREAN', nomor_wa='6281200000002', nama='Budi',
                             status_global='draft', sumber='pos')

    def test_antrean_gabungan_memuat_order_crm_dengan_nama_sales(self):
        res = self.client.get('/api/orders/', {'sumber': 'wa,staff,crm', 'page_size': 50})
        self.assertEqual(res.status_code, 200, res.content)
        data = res.data['results'] if isinstance(res.data, dict) else res.data
        per_id = {o['id']: o for o in data}
        self.assertIn('ORD-CRM-ANTREAN', per_id)
        self.assertNotIn('ORD-POS-ANTREAN', per_id)
        self.assertEqual(per_id['ORD-CRM-ANTREAN']['crm_sales_nama'], 'Sari Sales')

    def test_order_bukan_crm_tanpa_nama_sales(self):
        res = self.client.get('/api/orders/ORD-POS-ANTREAN/')
        self.assertEqual(res.status_code, 200, res.content)
        self.assertIsNone(res.data['crm_sales_nama'])
