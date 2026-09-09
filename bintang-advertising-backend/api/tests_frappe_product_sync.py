"""Sinkronisasi Product -> Frappe Item (satu arah, fase 1, 2026-09-09).
Semua panggilan HTTP di-mock -- test ini tidak butuh Frappe sungguhan."""
from io import StringIO
from unittest import mock

from django.core.management import call_command
from django.test import TestCase

from api.product_models import Product
from api.integration_models import FrappeProductSync
from api.frappe_client import FrappeClient
from api.services.frappe_product_sync import sync_product_to_frappe, resolve_item_code


def _client(configured=True):
    client = FrappeClient()
    if configured:
        client.api_key = "testkey"
        client.api_secret = "testsecret"
        client.disabled = False
    else:
        client.api_key = ""
        client.api_secret = ""
    return client


class FrappeClientConfigTestCase(TestCase):
    def test_not_configured_when_key_missing(self):
        client = _client(configured=False)
        self.assertFalse(client.is_configured())

    def test_configured_when_key_and_secret_present(self):
        client = _client(configured=True)
        self.assertTrue(client.is_configured())

    def test_not_configured_when_disabled_flag_set(self):
        client = _client(configured=True)
        client.disabled = True
        self.assertFalse(client.is_configured())

    def test_upsert_raises_when_not_configured(self):
        client = _client(configured=False)
        with self.assertRaises(RuntimeError):
            client.upsert_item("SKU-X", {"item_name": "X"})


class SyncProductToFrappeTestCase(TestCase):
    def setUp(self):
        self.product = Product.objects.create(
            nama="Banner Flexi Test", sku="SKU-BANNER-1", price_type="flat",
            harga_jual_toko=50000, is_active=True,
        )

    def test_resolve_item_code_uses_sku(self):
        self.assertEqual(resolve_item_code(self.product), "SKU-BANNER-1")

    def test_resolve_item_code_fallback_when_no_sku(self):
        produk = Product.objects.create(nama="Tanpa SKU", price_type="flat", harga_jual_toko=1000)
        self.assertEqual(resolve_item_code(produk), f"BINTANG-{produk.id}")

    @mock.patch("api.frappe_client.requests.post")
    @mock.patch("api.frappe_client.requests.get")
    def test_sync_creates_new_item_when_not_exists(self, mock_get, mock_post):
        mock_get.return_value = mock.Mock(status_code=404)
        mock_post.return_value = mock.Mock(status_code=200, json=lambda: {"data": {"name": "SKU-BANNER-1"}})
        mock_post.return_value.raise_for_status = lambda: None

        row = sync_product_to_frappe(self.product, client=_client())

        self.assertTrue(mock_post.called)
        self.assertEqual(row.frappe_item_code, "SKU-BANNER-1")
        self.assertIsNotNone(row.last_synced_at)
        self.assertEqual(row.last_error, "")

        posted_json = mock_post.call_args.kwargs["json"]
        self.assertEqual(posted_json["item_code"], "SKU-BANNER-1")
        self.assertEqual(posted_json["item_name"], "Banner Flexi Test")
        # Fase 1 sengaja TANPA harga (lihat build_item_payload) -- standard_rate
        # otomatis memicu Frappe membuat "Item Price" yang butuh role lebih luas.
        self.assertNotIn("standard_rate", posted_json)

    @mock.patch("api.frappe_client.requests.put")
    @mock.patch("api.frappe_client.requests.get")
    def test_sync_updates_existing_item(self, mock_get, mock_put):
        mock_get.return_value = mock.Mock(
            status_code=200, json=lambda: {"data": {"name": "SKU-BANNER-1"}},
        )
        mock_get.return_value.raise_for_status = lambda: None
        mock_put.return_value = mock.Mock(status_code=200, json=lambda: {"data": {"name": "SKU-BANNER-1"}})
        mock_put.return_value.raise_for_status = lambda: None

        row = sync_product_to_frappe(self.product, client=_client())

        self.assertTrue(mock_put.called)
        self.assertEqual(row.last_error, "")

    @mock.patch("api.frappe_client.requests.get")
    def test_sync_records_error_without_raising(self, mock_get):
        mock_get.side_effect = ConnectionError("Frappe tidak bisa dihubungi")

        row = sync_product_to_frappe(self.product, client=_client())

        self.assertIn("tidak bisa dihubungi", row.last_error)
        self.assertIsNone(row.last_synced_at)

    @mock.patch("api.frappe_client.requests.post")
    @mock.patch("api.frappe_client.requests.get")
    def test_sync_idempotent_reuses_same_sync_row(self, mock_get, mock_post):
        mock_get.return_value = mock.Mock(status_code=404)
        mock_post.return_value = mock.Mock(status_code=200, json=lambda: {"data": {}})
        mock_post.return_value.raise_for_status = lambda: None

        row1 = sync_product_to_frappe(self.product, client=_client())
        row2 = sync_product_to_frappe(self.product, client=_client())

        self.assertEqual(row1.id, row2.id)
        self.assertEqual(FrappeProductSync.objects.filter(product=self.product).count(), 1)


class SyncProductsToFrappeCommandTestCase(TestCase):
    def setUp(self):
        self.product = Product.objects.create(
            nama="Stiker Chromo Test", sku="SKU-STIKER-1", price_type="flat", harga_jual_toko=2000,
        )

    def test_dry_run_does_not_call_frappe_or_create_sync_rows(self):
        call_command("sync_products_to_frappe", "--dry-run", stdout=StringIO())
        self.assertEqual(FrappeProductSync.objects.count(), 0)

    @mock.patch.dict("os.environ", {}, clear=False)
    def test_skips_when_not_configured(self):
        import os
        os.environ.pop("FRAPPE_API_KEY", None)
        os.environ.pop("FRAPPE_API_SECRET", None)
        out = StringIO()
        call_command("sync_products_to_frappe", stdout=out)
        self.assertIn("belum dikonfigurasi", out.getvalue())
        self.assertEqual(FrappeProductSync.objects.count(), 0)

    @mock.patch("api.frappe_client.requests.post")
    @mock.patch("api.frappe_client.requests.get")
    @mock.patch.dict("os.environ", {"FRAPPE_API_KEY": "k", "FRAPPE_API_SECRET": "s"})
    def test_syncs_product_never_synced_before(self, mock_get, mock_post):
        mock_get.return_value = mock.Mock(status_code=404)
        mock_post.return_value = mock.Mock(status_code=200, json=lambda: {"data": {}})
        mock_post.return_value.raise_for_status = lambda: None

        out = StringIO()
        call_command("sync_products_to_frappe", stdout=out)

        self.assertTrue(FrappeProductSync.objects.filter(product=self.product, last_error="").exists())
        self.assertIn("Berhasil: 1", out.getvalue())

    @mock.patch("api.frappe_client.requests.put")
    @mock.patch("api.frappe_client.requests.get")
    @mock.patch.dict("os.environ", {"FRAPPE_API_KEY": "k", "FRAPPE_API_SECRET": "s"})
    def test_already_synced_and_unchanged_is_not_reprocessed(self, mock_get, mock_put):
        FrappeProductSync.objects.create(
            product=self.product, frappe_item_code="SKU-STIKER-1",
        )
        from django.utils import timezone
        FrappeProductSync.objects.filter(product=self.product).update(last_synced_at=timezone.now())

        out = StringIO()
        call_command("sync_products_to_frappe", stdout=out)

        self.assertFalse(mock_put.called)
        self.assertIn("Kandidat sync: 0", out.getvalue())
