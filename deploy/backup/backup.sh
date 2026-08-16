#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR=/backups
STAMP=$(date +%Y%m%d_%H%M%S)
FILE="$BACKUP_DIR/bintang_db_${STAMP}.sql.gz"
RETAIN_DAYS=14

mkdir -p "$BACKUP_DIR"
echo "[$(date -Iseconds)] Mulai backup -> $FILE"

PGPASSWORD="$DB_PASSWORD" pg_dump -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" | gzip > "$FILE"

if [ ! -s "$FILE" ]; then
  echo "[$(date -Iseconds)] GAGAL: file backup kosong, dihapus." >&2
  rm -f "$FILE"
  exit 1
fi
echo "[$(date -Iseconds)] pg_dump OK ($(du -h "$FILE" | cut -f1))"

if [ -n "${RCLONE_REMOTE:-}" ]; then
  echo "[$(date -Iseconds)] Upload off-site ke $RCLONE_REMOTE ..."
  rclone copy "$FILE" "$RCLONE_REMOTE" --config /root/.config/rclone/rclone.conf
  echo "[$(date -Iseconds)] Upload off-site selesai."
else
  echo "[$(date -Iseconds)] PERINGATAN: RCLONE_REMOTE belum diisi — backup HANYA tersimpan lokal di VPS ini, tidak aman dari VPS down." >&2
fi

find "$BACKUP_DIR" -name 'bintang_db_*.sql.gz' -mtime "+${RETAIN_DAYS}" -delete
echo "[$(date -Iseconds)] Selesai."
