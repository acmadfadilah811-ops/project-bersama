"""Regresi: NIP staff otomatis tidak boleh nyangkut di akun non-staff.

Bug asli: CustomUser.role default-nya 'staff'. Kalau akun dibuat lewat
create_user()/create_superuser() TANPA role di kwargs lalu role diubah
sesudah create (bukan sekaligus di awal), save() pertama (di dalam
create_user) sempat menganggapnya staff dan auto-assign NIP "STF-YYYY-NNN".
Ditemukan saat bikin akun owner & kasir produksi - keduanya sempat kena.
"""
from datetime import date

from django.contrib.auth import get_user_model
from django.test import TestCase

User = get_user_model()


class CustomUserNipAutoAssignTests(TestCase):
    def test_staff_created_with_role_gets_nip(self):
        u = User.objects.create_user(username="staff_a", password="pw12345", role="staff")
        self.assertIsNotNone(u.nip)
        self.assertTrue(u.nip.startswith("STF-"))

    def test_non_staff_created_with_role_upfront_gets_no_nip(self):
        u = User.objects.create_user(username="kasir_a", password="pw12345", role="kasir")
        self.assertIsNone(u.nip)

    def test_role_changed_after_create_self_heals_nip(self):
        # Reproduksi bug asli: create tanpa role (default 'staff' aktif saat
        # save pertama), lalu role diubah & disave lagi.
        u = User.objects.create_user(username="owner_a", password="pw12345")
        self.assertTrue(u.nip.startswith("STF-"))  # bug lama: NIP staff nyangkut

        u.role = "owner"
        u.save()
        u.refresh_from_db()
        self.assertIsNone(u.nip)  # sekarang harus dibersihkan otomatis

    def test_sequential_staff_nip_unaffected_by_cleared_slot(self):
        stray = User.objects.create_user(username="manager_a", password="pw12345")
        stray.role = "manager"
        stray.save()  # NIP-nya dibersihkan, tidak boleh "menahan" slot STF-2026-001

        staff = User.objects.create_user(username="staff_b", password="pw12345", role="staff")
        year = date.today().year
        self.assertEqual(staff.nip, f"STF-{year}-001")

    def test_manually_set_nip_on_non_staff_not_touched_if_not_auto_pattern(self):
        u = User.objects.create_user(
            username="admin_a", password="pw12345", role="admin", nip="CUSTOM-ID-1",
        )
        u.save()
        u.refresh_from_db()
        self.assertEqual(u.nip, "CUSTOM-ID-1")
