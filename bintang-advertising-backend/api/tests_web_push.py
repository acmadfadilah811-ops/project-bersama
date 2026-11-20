"""Web Push notifikasi order (2026-10-21)."""
import datetime
from unittest.mock import patch

from django.utils import timezone

from .tests_starfoto import _Dasar
from .webpush_models import LanggananPush

SUB = {'endpoint': 'https://fcm.googleapis.com/fcm/send/abc123', 'keys': {'p256dh': 'BPk3x', 'auth': 'a1b2'}}


class LanggananPushTests(_Dasar):
    def test_kunci_publik_dibuat_dan_tetap(self):
        self.client.force_authenticate(self.foto)
        k1 = self.client.get('/api/push/kunci-publik/').json()['kunci']
        k2 = self.client.get('/api/push/kunci-publik/').json()['kunci']
        self.assertTrue(k1)
        self.assertEqual(k1, k2)

    def test_simpan_dan_hapus_langganan(self):
        self.client.force_authenticate(self.foto)
        self.assertEqual(self.client.post('/api/push/langganan/', SUB, format='json').status_code, 201)
        self.assertEqual(self.client.post('/api/push/langganan/', SUB, format='json').status_code, 201)
        self.assertEqual(LanggananPush.objects.filter(user=self.foto).count(), 1)
        self.client.delete('/api/push/langganan/', {'endpoint': SUB['endpoint']}, format='json')
        self.assertFalse(LanggananPush.objects.exists())

    def test_endpoint_tidak_valid_ditolak(self):
        self.client.force_authenticate(self.foto)
        res = self.client.post('/api/push/langganan/', {'endpoint': 'http://x', 'keys': {}}, format='json')
        self.assertEqual(res.status_code, 400)


class NotifSesiBaruTests(_Dasar):
    @patch('api.services.web_push.kirim_ke_user')
    def test_sesi_tanpa_fotografer_memberi_tahu_divisi(self, kirim):
        mulai = (timezone.now() + datetime.timedelta(hours=2)).isoformat()
        res = self._checkout(fotografer_id=None, asisten_id=None, sesi=[{'mulai': mulai, 'lokasi': 'studio'}])
        self.assertEqual(res.status_code, 201, res.content)
        penerima = {u.username for u in kirim.call_args_list[0].args[0]}
        self.assertIn(self.foto.username, penerima)
        self.assertNotIn(self.editor.username, penerima)
        self.assertEqual(kirim.call_args_list[0].args[1], 'Ada order sesi foto baru')

    @patch('api.services.web_push.kirim_ke_user')
    def test_fotografer_dipilih_diberi_tahu_langsung(self, kirim):
        self.assertEqual(self._checkout().status_code, 201)
        self.assertEqual(list(kirim.call_args_list[0].args[0]), [self.foto])
        self.assertEqual(kirim.call_args_list[0].args[1], 'Sesi foto baru untuk Anda')
