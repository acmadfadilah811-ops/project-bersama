import os
import sys
import subprocess
import datetime
import gzip
import shutil
from pathlib import Path

"""
Automated PostgreSQL Database Backup Script (T-703)
=====================================================
Target RPO (Recovery Point Objective): < 24 Jam (Cron Harian Jam 02:00 AM)
Retention Policy: 7 Hari (Pembersihan Otomatis)
Output Format: bintang_crm_backup_YYYYMMDD_HHMMSS.sql.gz
"""

BACKEND_DIR = Path(__file__).resolve().parent.parent
BACKUP_DIR = BACKEND_DIR / "backups"


def run_backup():
    BACKUP_DIR.mkdir(exist_ok=True)
    now = datetime.datetime.now()
    timestamp = now.strftime("%Y%m%d_%H%M%S")
    backup_file = BACKUP_DIR / f"bintang_crm_backup_{timestamp}.sql.gz"

    db_engine = os.getenv("DB_ENGINE", "postgres")
    if db_engine.lower() in {"sqlite", "sqlite3"}:
        print("[BACKUP] ERROR: DB_ENGINE=sqlite tidak didukung oleh backup PostgreSQL; tidak ada file SQLite yang disentuh.")
        return False
    db_name = os.getenv("DB_NAME", "bintang_crm_staging")
    db_user = os.getenv("DB_USER", "postgres")
    db_host = os.getenv("DB_HOST", "127.0.0.1")
    db_port = os.getenv("DB_PORT", "5432")
    db_password = os.getenv("DB_PASSWORD", "")

    print(f"[BACKUP] Memulai backup PostgreSQL '{db_name}' di {db_host}:{db_port}...")

    env = os.environ.copy()
    if db_password:
        env["PGPASSWORD"] = db_password

    pg_dump = shutil.which("pg_dump")
    if not pg_dump:
        print("[BACKUP] ERROR: pg_dump tidak ditemukan di PATH; backup tidak dianggap berhasil.")
        return False

    cmd = [pg_dump, "-h", db_host, "-p", db_port, "-U", db_user, "-d", db_name]
    try:
        with backup_file.open("wb") as raw_file:
            proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, env=env)
            with gzip.GzipFile(fileobj=raw_file, mode="wb") as compressed:
                assert proc.stdout is not None
                shutil.copyfileobj(proc.stdout, compressed)
            stderr = proc.communicate()[1].decode(errors="replace")
        if proc.returncode == 0 and backup_file.exists() and backup_file.stat().st_size > 0:
            size_mb = backup_file.stat().st_size / (1024 * 1024)
            print(f"[BACKUP] SUCCESS: File backup dibuat -> {backup_file} ({size_mb:.2f} MB)")
            cleanup_old_backups(days=7)
            return True
        else:
            print("[BACKUP] ERROR: pg_dump mengembalikan kode gagal; file parsial dihapus.")
            print(f"[BACKUP] Output stderr: {stderr.strip() or 'N/A'}")
            backup_file.unlink(missing_ok=True)
            return False
    except Exception as e:
        print(f"[BACKUP] ERROR: Gagal menjalankan backup -> {e}")
        return False


def cleanup_old_backups(days=7):
    cutoff = datetime.datetime.now() - datetime.timedelta(days=days)
    count = 0
    for f in BACKUP_DIR.glob("bintang_crm_backup_*.sql.gz"):
        file_mtime = datetime.datetime.fromtimestamp(f.stat().st_mtime)
        if file_mtime < cutoff:
            f.unlink()
            count += 1
            print(f"[BACKUP CLEANUP] Dihapus file lama: {f.name}")
    if count > 0:
        print(f"[BACKUP CLEANUP] Total {count} file backup lama (> {days} hari) berhasil dibersihkan.")


if __name__ == "__main__":
    run_backup()
