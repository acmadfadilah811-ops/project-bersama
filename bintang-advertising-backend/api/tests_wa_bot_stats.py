"""Tes statistik snapshot chat bot WA (api/services/wa_bot_stats.py +
api/views/wa_bot_stats.py) -- tab Statistik di Pengaturan WA Bot
(permintaan user 2026-09-18)."""
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.cache import cache
from rest_framework import status
from rest_framework.test import APITestCase

from api.models import Contact, Order
from api.services import wa_bot_stats as svc

User = get_user_model()


class WaBotStatsServiceTests(APITestCase):
    def setUp(self):
        cache.clear()

    def tearDown(self):
        cache.clear()

    def test_total_kontak_dan_handover_permanen(self):
        Contact.objects.create(nomor_wa='6281111', nama='A')
        Contact.objects.create(nomor_wa='6282222', nama='B', handover_to_staff=True)
        hasil = svc.get_snapshot_stats()
        self.assertEqual(hasil['total_kontak'], 2)
        self.assertEqual(hasil['handover_permanen'], 1)

    def test_handover_sementara_none_saat_backend_cache_tidak_mendukung(self):
        # Test suite ini jalan pakai LocMemCache (tidak ada REDIS_URL lokal)
        # -- cache.keys() tidak ada, harus fallback None dgn baik, bukan crash.
        self.assertFalse(hasattr(cache, 'keys'))
        hasil = svc.get_snapshot_stats()
        self.assertIsNone(hasil['handover_sementara'])

    def test_handover_sementara_dihitung_saat_backend_cache_mendukung(self):
        # Simulasikan backend django-redis (production) yg punya cache.keys().
        with patch('django.core.cache.cache.keys', return_value=['wa_handover_a', 'wa_handover_b'], create=True):
            hasil = svc.get_snapshot_stats()
        self.assertEqual(hasil['handover_sementara'], 2)

    def test_order_dari_bot_wa_dihitung(self):
        Order.objects.create(id='ORD-STATS-1', nomor_wa='6281111', nama='A', sumber='wa', total_harga=10000)
        Order.objects.create(id='ORD-STATS-2', nomor_wa='6282222', nama='B', sumber='pos', total_harga=10000)
        hasil = svc.get_snapshot_stats()
        self.assertEqual(hasil['order_dari_bot_wa'], 1)

    @patch('api.whatsapp_client.whatsapp_client._is_offline', return_value=True)
    def test_evolution_offline_counts_none(self, _mock):
        hasil = svc.get_snapshot_stats()
        self.assertIsNone(hasil['chat_tersimpan'])
        self.assertIsNone(hasil['pesan_tersimpan'])


class WaBotStatsViewTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username='owner_stats', password='secret', role='owner')
        self.kasir = User.objects.create_user(username='kasir_stats', password='secret', role='kasir')

    def test_kasir_forbidden(self):
        self.client.force_authenticate(self.kasir)
        response = self.client.get('/api/wa-bot-config/stats/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_owner_ok(self):
        self.client.force_authenticate(self.owner)
        response = self.client.get('/api/wa-bot-config/stats/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('total_kontak', response.data)
