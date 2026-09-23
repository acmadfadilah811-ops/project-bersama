"""Pergerakan Stok Bahan Baku (InventoryItemViewSet.summary) -- pasangan
dari ProductStockMovementViewSet.summary tapi untuk InventoryItem/
RestockHistory. Sebelumnya halaman "Pergerakan Stok" cuma menampilkan
Product, bahan baku BoM yang terpotong otomatis sama sekali tidak
kelihatan di sana (keluhan user 2026-09-24)."""
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APITestCase

from .models import InventoryItem, RestockHistory

User = get_user_model()


class InventoryMovementSummaryTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username='owner_inv_summary', password='x', role='owner')
        self.client.force_authenticate(self.owner)
        self.item = InventoryItem.objects.create(
            id='INV-TEST-0001', nama='Tepung Beras', stok=800.0, satuan='gr', kategori='Bahan Baku',
        )
        self.today = timezone.localdate()

    def _buat_history(self, delta, stok_awal, stok_akhir, waktu):
        h = RestockHistory.objects.create(
            item=self.item, delta=delta, stok_awal=stok_awal, stok_akhir=stok_akhir,
            keterangan='Uji pergerakan bahan baku',
        )
        RestockHistory.objects.filter(pk=h.pk).update(waktu=waktu)
        return h

    def test_pemakaian_bom_hari_ini_tercatat_di_ringkasan(self):
        self._buat_history(-200.0, 1000.0, 800.0, timezone.now())
        res = self.client.get('/api/inventory/summary/', {
            'start_date': str(self.today), 'end_date': str(self.today),
        })
        self.assertEqual(res.status_code, 200, res.content)
        rows = res.data['results'] if isinstance(res.data, dict) else res.data
        row = next(r for r in rows if r['sku'] == 'INV-TEST-0001')
        self.assertEqual(row['initial'], 1000.0)
        self.assertEqual(row['out'], 200.0)
        self.assertEqual(row['in'], 0.0)
        self.assertEqual(row['sisa'], 800.0)

    def test_mutasi_di_luar_rentang_tanggal_tidak_ikut_dihitung(self):
        kemarin = timezone.now() - timedelta(days=1)
        self._buat_history(-200.0, 1000.0, 800.0, kemarin)
        res = self.client.get('/api/inventory/summary/', {
            'start_date': str(self.today), 'end_date': str(self.today),
        })
        rows = res.data['results'] if isinstance(res.data, dict) else res.data
        row = next(r for r in rows if r['sku'] == 'INV-TEST-0001')
        self.assertEqual(row['in'], 0.0)
        self.assertEqual(row['out'], 0.0)
        self.assertEqual(row['initial'], 800.0)
        self.assertEqual(row['sisa'], 800.0)

    def test_search_memfilter_nama_bahan(self):
        InventoryItem.objects.create(id='INV-TEST-0002', nama='Minyak Goreng', stok=50.0, satuan='ltr', kategori='Bahan Baku')
        res = self.client.get('/api/inventory/summary/', {'search': 'Tepung'})
        rows = res.data['results'] if isinstance(res.data, dict) else res.data
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]['product'], 'Tepung Beras')
