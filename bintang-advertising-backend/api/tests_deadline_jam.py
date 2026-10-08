"""Jam deadline SPK (2026-10-08): opsional, format HH:MM."""
from datetime import time

from django.test import TestCase

from . import spk


class ResolveDeadlineJamTests(TestCase):
    def test_kosong_berarti_tanpa_jam(self):
        self.assertIsNone(spk.resolve_deadline_jam(None))
        self.assertIsNone(spk.resolve_deadline_jam(''))

    def test_format_jam_valid(self):
        self.assertEqual(spk.resolve_deadline_jam('14:30'), time(14, 30))
        self.assertEqual(spk.resolve_deadline_jam('09:05:59'), time(9, 5))

    def test_format_salah_ditolak(self):
        for nilai in ('25:00', 'jam dua', 1430):
            with self.assertRaises(spk.SpkError):
                spk.resolve_deadline_jam(nilai)
