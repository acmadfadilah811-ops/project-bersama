"""Notifikasi keuangan dari HR (2026-09-25)."""

import os
from unittest import mock

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from accounting.models import NotifikasiKeuangan

KUNCI = "kunci-rahasia-uji"
BRIDGE = "/api/bridge/notifikasi-keuangan/"
LIST = "/api/accounting/notifikasi/"
BACA = "/api/accounting/notifikasi/baca/"


@mock.patch.dict(os.environ, {"HR_BRIDGE_API_KEY": KUNCI})
class NotifikasiKeuanganTests(TestCase):
    def setUp(self):
        U = get_user_model()
        self.owner = U.objects.create_user(username="nk_owner", password="pw12345", role="owner")
        self.spv_fin = U.objects.create_user(username="nk_spvfin", password="pw12345", role="spv_finance")
        self.manager = U.objects.create_user(username="nk_mgr", password="pw12345", role="manager")
        self.kasir = U.objects.create_user(username="nk_kasir", password="pw12345", role="kasir")
        self.admin_fin = U.objects.create_user(username="nk_adminfin", password="pw12345", role="admin_finance")
        self.client = APIClient()

    def _kirim(self, kunci="payroll-2026-09", key=KUNCI, **lebih):
        data = {"kunci": kunci, "jenis": "payroll_final", "judul": "Gaji September 2026 siap diposting",
                "pesan": "12 slip", "tautan": "/accounting/payroll"}
        data.update(lebih)
        self.client.force_authenticate(None)
        return self.client.post(BRIDGE, data, format="json", HTTP_X_API_KEY=key, secure=True)

    def test_jembatan_wajib_kunci_api(self):
        self.assertEqual(self._kirim(key="salah").status_code, 401)
        self.assertEqual(NotifikasiKeuangan.objects.count(), 0)

    def test_jembatan_idempoten_per_kunci(self):
        self.assertEqual(self._kirim().status_code, 201)
        self.assertEqual(self._kirim().status_code, 200)
        self.assertEqual(NotifikasiKeuangan.objects.count(), 1)

    def test_jenis_tidak_dikenal_ditolak(self):
        self.assertEqual(self._kirim(jenis="lain").status_code, 400)

    def test_tiga_peran_melihat_peran_lain_tidak(self):
        self._kirim()
        for u in (self.owner, self.spv_fin, self.manager):
            self.client.force_authenticate(u)
            res = self.client.get(LIST, secure=True)
            self.assertEqual(res.status_code, 200, u.role)
            self.assertEqual(res.data["belum_dibaca"], 1)
        for u in (self.kasir, self.admin_fin):
            self.client.force_authenticate(u)
            self.assertEqual(self.client.get(LIST, secure=True).status_code, 403, u.role)

    def test_tandai_dibaca_per_pengguna(self):
        self._kirim()
        self._kirim(kunci="reimb-1", jenis="reimbursement", judul="Reimbursement disetujui")
        self.client.force_authenticate(self.spv_fin)
        self.client.post(BACA, {"semua": True}, format="json", secure=True)
        self.assertEqual(self.client.get(LIST, secure=True).data["belum_dibaca"], 0)
        self.client.force_authenticate(self.owner)
        self.assertEqual(self.client.get(LIST, secure=True).data["belum_dibaca"], 2)
        n = NotifikasiKeuangan.objects.get(kunci="reimb-1")
        self.client.post(BACA, {"ids": [n.id]}, format="json", secure=True)
        data = self.client.get(LIST, secure=True).data
        self.assertEqual(data["belum_dibaca"], 1)
        self.assertTrue(next(x for x in data["hasil"] if x["id"] == n.id)["dibaca"])
