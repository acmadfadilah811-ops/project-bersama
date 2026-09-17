"""Jembatan Bintang -> CRM (api/services/crm_bridge.py).

Fokus: sync POSSale ke CRM cuma jalan untuk sale 'paid' + punya pelanggan
tertaut, dedup lewat synced_to_crm_at, dan kegagalan jaringan/API key
kosong TIDAK melempar exception (checkout tidak boleh terganggu).
"""
from decimal import Decimal
from unittest import mock

from django.test import TestCase

from .models import Contact
from .pos_models import POSSale
from .services.crm_bridge import sync_possale_ke_crm


class SyncPossaleKeCrmTest(TestCase):
    def setUp(self):
        self.kontak = Contact.objects.create(nomor_wa='6281234567890', nama='Budi Santoso')
        self.sale = POSSale.objects.create(
            nomor='POS-TEST-0001', pelanggan=self.kontak, total=Decimal('150000'), status='paid',
        )

    def test_dilewati_kalau_bukan_paid(self):
        self.sale.status = 'hold'
        self.sale.save(update_fields=['status'])
        with mock.patch('api.services.crm_bridge.requests.post') as mock_post:
            sync_possale_ke_crm(self.sale.id)
        mock_post.assert_not_called()

    def test_dilewati_kalau_tanpa_pelanggan(self):
        self.sale.pelanggan = None
        self.sale.save(update_fields=['pelanggan'])
        with mock.patch('api.services.crm_bridge.requests.post') as mock_post:
            sync_possale_ke_crm(self.sale.id)
        mock_post.assert_not_called()

    def test_dilewati_kalau_sudah_pernah_sync(self):
        from django.utils import timezone
        self.sale.synced_to_crm_at = timezone.now()
        self.sale.save(update_fields=['synced_to_crm_at'])
        with mock.patch('api.services.crm_bridge.requests.post') as mock_post:
            sync_possale_ke_crm(self.sale.id)
        mock_post.assert_not_called()

    @mock.patch.dict('os.environ', {}, clear=True)
    def test_dilewati_kalau_api_key_kosong(self):
        with mock.patch('api.services.crm_bridge.requests.post') as mock_post:
            sync_possale_ke_crm(self.sale.id)
        mock_post.assert_not_called()
        self.sale.refresh_from_db()
        self.assertIsNone(self.sale.synced_to_crm_at)

    @mock.patch.dict('os.environ', {'CRM_BRIDGE_API_KEY': 'kunci-uji'})
    @mock.patch('api.services.crm_bridge.requests.post')
    def test_sukses_sync_set_synced_to_crm_at_dan_kirim_payload_benar(self, mock_post):
        mock_post.return_value = mock.Mock(status_code=201, raise_for_status=lambda: None)

        sync_possale_ke_crm(self.sale.id)

        self.sale.refresh_from_db()
        self.assertIsNotNone(self.sale.synced_to_crm_at)

        kwargs = mock_post.call_args.kwargs
        self.assertEqual(kwargs['headers']['X-Api-Key'], 'kunci-uji')
        self.assertEqual(kwargs['json']['nomor_wa'], '6281234567890')
        self.assertEqual(kwargs['json']['sale']['id'], f'possale:{self.sale.id}')
        self.assertEqual(kwargs['json']['sale']['total'], 150000.0)

    @mock.patch.dict('os.environ', {'CRM_BRIDGE_API_KEY': 'kunci-uji'})
    @mock.patch('api.services.crm_bridge.requests.post', side_effect=RuntimeError('koneksi putus'))
    def test_gagal_jaringan_tidak_melempar_exception(self, mock_post):
        sync_possale_ke_crm(self.sale.id)  # tidak boleh raise
        self.sale.refresh_from_db()
        self.assertIsNone(self.sale.synced_to_crm_at)
