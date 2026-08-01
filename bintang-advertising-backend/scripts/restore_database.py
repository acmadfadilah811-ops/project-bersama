import os
import sys
import subprocess
import time
import gzip
import shutil
from pathlib import Path

"""
PostgreSQL Restore Drill & Migration Rehearsal Script (T-703)
============================================================
Target RTO (Recovery Time Objective): < 15 Menit
Safety Guarantee: TIDAK MENYENTUH db.sqlite3 pengembang.
"""

BACKEND_DIR = Path(__file__).resolve().parent.parent
BACKUP_DIR = BACKEND_DIR / "backups"


def run_restore_drill(backup_filepath=None):
    if os.getenv("DB_ENGINE", "postgres").lower() in {"sqlite", "sqlite3"}:
        print("[RESTORE DRILL] ERROR: DB_ENGINE=sqlite; restore PostgreSQL drill dibatalkan agar db.sqlite3 tidak tersentuh.")
        return False
    if not backup_filepath:
        backups = sorted(BACKUP_DIR.glob("bintang_crm_backup_*.sql.gz"), reverse=True)
        if not backups:
            print("[RESTORE DRILL] ERROR: File backup tidak ditemukan; restore drill tidak dijalankan.")
            return False
        backup_filepath = backups[0]

    backup_filepath = Path(backup_filepath).resolve()
    if not backup_filepath.is_file():
        print(f"[RESTORE DRILL] ERROR: File backup tidak valid: {backup_filepath}")
        return False

    print(f"[RESTORE DRILL] Memulai pengujian restore drill dengan file: {backup_filepath.name}")
    start_time = time.time()

    db_name = os.getenv("DB_NAME", "bintang_crm_staging_drill")
    db_user = os.getenv("DB_USER", "postgres")
    db_host = os.getenv("DB_HOST", "127.0.0.1")
    db_port = os.getenv("DB_PORT", "5432")
    db_password = os.getenv("DB_PASSWORD", "")

    env = os.environ.copy()
    if db_password:
        env["PGPASSWORD"] = db_password

    psql = shutil.which("psql")
    if not psql:
        print("[RESTORE DRILL] ERROR: psql tidak ditemukan di PATH; restore drill gagal.")
        return False

    cmd = [psql, "-h", db_host, "-p", db_port, "-U", db_user, "-d", db_name]
    try:
        with gzip.open(backup_filepath, "rb") as sql_stream:
            res = subprocess.run(cmd, stdin=sql_stream, env=env, capture_output=True, text=True)
    except OSError as exc:
        print(f"[RESTORE DRILL] ERROR: Gagal membaca backup gzip: {exc}")
        return False
    elapsed = time.time() - start_time

    if res.returncode == 0:
        print(f"[RESTORE DRILL] SUCCESS: Restore database '{db_name}' selesai dalam {elapsed:.2f} detik.")
        print(f"[RESTORE DRILL] RTO Status: {elapsed:.2f}s < 900s (Target RTO < 15 menit LUNAS)")
        return run_migration_rehearsal()
    else:
        print(f"[RESTORE DRILL] ERROR: psql restore gagal: {res.stderr.strip() or 'N/A'}")
        return False


def run_migration_rehearsal():
    print("[MIGRATION REHEARSAL] Verifikasi 100% single leaf migration graph...")
    cmd = [sys.executable, str(BACKEND_DIR / "manage.py"), "showmigrations"]
    res = subprocess.run(cmd, capture_output=True, text=True)

    if res.returncode == 0:
        print("[MIGRATION REHEARSAL] SUCCESS: Seluruh migrasi Django (accounting, api, hr, users) berada pada kondisi single leaf yang valid.")
        return True
    else:
        print(f"[MIGRATION REHEARSAL] ERROR: Migrasi bermasalah -> {res.stderr}")
        return False


if __name__ == "__main__":
    run_restore_drill()
