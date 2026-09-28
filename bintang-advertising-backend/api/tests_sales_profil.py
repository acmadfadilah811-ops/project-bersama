"""Profil tim sales CRM di Bintang (tanpa login) & PIC pesanan CRM (2026-09-28)."""
import os
from unittest import mock

from django.core.cache import cache
from rest_framework.test import APITestCase

from .models import CustomUser, Order
from .product_models import Product

HR_KEY = 'kunci-hr-sales'
CRM_KEY = 'kunci-crm-sales'


@mock.patch.dict(os.environ, {'HR_BRIDGE_API_KEY': HR_KEY, 'CRM_BRIDGE_API_KEY': CRM_KEY})
class SalesProfilTest(APITestCase):
    def setUp(self):
        cache.clear()

    def tearDown(self):
        # Jangan menghabiskan kuota throttle jembatan untuk tes lain.
        cache.clear()

    def _profil(self, **lebih):
        data = {'hr_employee_id': 13, 'first_name': 'Tim', 'last_name': 'Sales', 'email': 'tim@sales.test',
                'job_position': 'Staff Sales', 'department': 'Sales Marketing & Creative', 'tanpa_login': True}
        data.update(lebih)
        return self.client.post('/api/bridge/hr-employee/', data, format='json',
                                HTTP_X_API_KEY=HR_KEY, HTTP_X_FORWARDED_PROTO='https')

    def test_profil_tanpa_login_tanpa_kredensial(self):
        res = self._profil()
        self.assertEqual(res.status_code, 201, res.content)
        self.assertNotIn('temp_password', res.json())
        user = CustomUser.objects.get(hr_employee_id=13)
        self.assertEqual(user.role, 'sales')
        self.assertFalse(user.has_usable_password())
        self.assertFalse(self.client.login(username=user.username, password=''))

    def test_simpan_ulang_tetap_profil_sales(self):
        self._profil()
        res = self._profil(job_position='SPV Sales')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(CustomUser.objects.get(hr_employee_id=13).role, 'sales')

    def test_pesanan_crm_pic_terisi_profil_sales(self):
        self._profil()
        produk = Product.objects.create(nama='Banner PIC', harga_jual_toko=25000)
        res = self.client.post('/api/bridge/crm/order/', {
            'kunci': 'opp-pic-1', 'crm_user_id': 4, 'crm_username': 'tim.salesmarketingcreative',
            'sales_nama': 'Tim Sales', 'sales_hr_employee_id': 13, 'crm_opportunity_id': 7,
            'pelanggan': {'nama': 'Budi', 'nomor_hp': '081234567890'},
            'items': [{'product_id': produk.id, 'qty': 1}],
        }, format='json', HTTP_X_API_KEY=CRM_KEY)
        self.assertEqual(res.status_code, 201, res.content)
        order = Order.objects.get(pk=res.json()['id'])
        self.assertEqual(order.dilayani_oleh.hr_employee_id, 13)

    def test_pesanan_crm_tanpa_profil_pic_kosong(self):
        produk = Product.objects.create(nama='Banner PIC 2', harga_jual_toko=25000)
        res = self.client.post('/api/bridge/crm/order/', {
            'kunci': 'opp-pic-2', 'crm_user_id': 4, 'sales_hr_employee_id': 999,
            'pelanggan': {'nama': 'Budi', 'nomor_hp': '081234567890'},
            'items': [{'product_id': produk.id, 'qty': 1}],
        }, format='json', HTTP_X_API_KEY=CRM_KEY)
        self.assertEqual(res.status_code, 201, res.content)
        self.assertIsNone(Order.objects.get(pk=res.json()['id']).dilayani_oleh_id)
