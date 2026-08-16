"""Regresi: toggle handover_to_staff (WA Live / Antrean WA) harus benar-benar
menyalakan/mematikan bot — bukan cuma flag DB, tapi juga cache `wa_handover_*`
yang di-set otomatis 15 menit tiap kali staff balas chat manual. Sebelum
diperbaiki, menonaktifkan lalu mengaktifkan lagi lewat toggle tidak membuat
bot aktif kembali selama cache lama belum kedaluwarsa."""
from django.core.cache import cache
from rest_framework.test import APITestCase

from api.models import Contact, CustomUser


class ContactHandoverToggleTests(APITestCase):
    def setUp(self):
        self.owner = CustomUser.objects.create_user(
            username='owner_handover', password='rahasia123', role='owner',
        )
        self.client.force_authenticate(self.owner)
        self.contact = Contact.objects.create(nomor_wa='6281234567890', nama='Budi')
        cache.clear()

    def tearDown(self):
        cache.clear()

    def test_nonaktifkan_bot_set_cache_handover(self):
        response = self.client.patch(
            f'/api/contacts/{self.contact.nomor_wa}/', {'handover_to_staff': True}, format='json',
        )
        self.assertEqual(response.status_code, 200, response.content)
        self.assertTrue(cache.get(f'wa_handover_{self.contact.nomor_wa}'))
        self.contact.refresh_from_db()
        self.assertTrue(self.contact.handover_to_staff)

    def test_aktifkan_lagi_setelah_nonaktif_menghapus_cache_lama(self):
        # Reproduksi bug: cache handover 15-menit sudah menyala (mis. staff
        # baru saja balas chat manual), lalu kontak dinonaktifkan-handover
        # (bot diaktifkan) lewat toggle biasa.
        cache.set(f'wa_handover_{self.contact.nomor_wa}', True, timeout=900)
        self.contact.handover_to_staff = True
        self.contact.save()

        response = self.client.patch(
            f'/api/contacts/{self.contact.nomor_wa}/', {'handover_to_staff': False}, format='json',
        )
        self.assertEqual(response.status_code, 200, response.content)

        # Sebelum perbaikan: cache lama tetap ada -> bot masih dianggap
        # nonaktif meski toggle sudah dimatikan. Sekarang harus bersih.
        self.assertIsNone(cache.get(f'wa_handover_{self.contact.nomor_wa}'))
        self.contact.refresh_from_db()
        self.assertFalse(self.contact.handover_to_staff)

    def test_update_tanpa_menyentuh_field_handover_tidak_mengubah_cache(self):
        cache.set(f'wa_handover_{self.contact.nomor_wa}', True, timeout=900)
        response = self.client.patch(
            f'/api/contacts/{self.contact.nomor_wa}/', {'nama': 'Budi Santoso'}, format='json',
        )
        self.assertEqual(response.status_code, 200, response.content)
        # Field handover_to_staff tidak dikirim di payload -> cache tidak boleh ikut disentuh.
        self.assertTrue(cache.get(f'wa_handover_{self.contact.nomor_wa}'))
