"""Guard test: cegah date.today()/datetime.today() "polos" balik lagi di kode akuntansi & api.

date.today() pakai jam OS server (UTC di VPS), bukan TIME_ZONE proyek
(Asia/Jakarta, WIB). Dini hari WIB (00:00-06:59), jam UTC masih di
tanggal kemarin -- default "Hari ini"/"Bulan berjalan" jadi diam-diam
salah selama jam segitu (bug ditemukan audit Invoice, 2026-09-08,
tersebar di 14+ titik lintas accounting/ dan api/, semua sudah
diperbaiki ke timezone.localdate()/timezone.now()).

Test ini scan source tree (bukan migrations/tests) untuk pola
`date.today()` / `datetime.today()` / `datetime.now()` naive, supaya
pemakaian baru yang lupa ketentuan ini ketahuan otomatis, bukan
menunggu ditemukan manual lagi seperti bug ini pertama kali ditemukan.
"""

import re
from pathlib import Path

from django.conf import settings
from django.test import SimpleTestCase

_BANNED_PATTERNS = [
    re.compile(r"\bdate\.today\(\)"),
    re.compile(r"\bdatetime\.today\(\)"),
    re.compile(r"\bdatetime\.now\(\)(?!\s*\(\s*tz)"),
]

_SCAN_DIRS = ["accounting", "api"]
_EXCLUDE_DIR_PARTS = {"migrations", "tests_", "__pycache__"}
_EXCLUDE_FILES = {
    # File ini sendiri (dokumentasi pola terlarang di docstring/pattern).
    Path(__file__).name,
}


def _iter_source_files():
    base = Path(settings.BASE_DIR)
    for scan_dir in _SCAN_DIRS:
        root = base / scan_dir
        if not root.exists():
            continue
        for path in root.rglob("*.py"):
            if path.name in _EXCLUDE_FILES:
                continue
            if path.name.startswith("tests_") or path.name.startswith("test_"):
                continue
            if any(part == "migrations" or part == "__pycache__" for part in path.parts):
                continue
            yield path


class NoNaiveTodayTests(SimpleTestCase):
    """Larang date.today()/datetime.today()/datetime.now() naive di accounting/ & api/.

    Gunakan django.utils.timezone.localdate() atau timezone.now() --
    keduanya sadar TIME_ZONE (Asia/Jakarta), sudah jadi konvensi baku di
    services/ akuntansi. Kalau test ini merah karena kasus yang memang
    sengaja tidak butuh timezone-aware (jarang), tambahkan nama file ke
    _EXCLUDE_FILES di sini beserta alasannya -- jangan hapus test-nya.
    """

    def test_no_naive_today_or_now_in_source(self):
        violations = []
        for path in _iter_source_files():
            try:
                text = path.read_text(encoding="utf-8")
            except UnicodeDecodeError:
                continue
            for lineno, line in enumerate(text.splitlines(), start=1):
                stripped = line.strip()
                if stripped.startswith("#"):
                    continue
                for pattern in _BANNED_PATTERNS:
                    if pattern.search(line):
                        violations.append(f"{path.relative_to(settings.BASE_DIR)}:{lineno}: {stripped}")

        self.assertEqual(
            [], violations,
            "Ditemukan date.today()/datetime.today()/datetime.now() naive (jam OS server/UTC, "
            "bukan WIB) -- pakai django.utils.timezone.localdate() atau timezone.now():\n"
            + "\n".join(violations),
        )
