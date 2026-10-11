#!/bin/sh
# Deploy ERP Bintang tanpa jeda layanan (2026-10-11).
#
# Sebelumnya `docker compose up -d backend` me-restart semua replika backend
# sekaligus -> gateway mengembalikan 502 beberapa detik setiap deploy (temuan
# audit log produksi). Urutan sekarang:
#   1. build image backend-init, backend, frontend
#   2. migrasi (backend-init) -- gagal = deploy berhenti, backend lama tetap jalan
#   3. replika backend BARU dinyalakan berdampingan dengan yang lama
#   4. setelah semua replika baru sehat (healthcheck /api/health/), replika
#      lama dimatikan; gateway nginx membaca ulang DNS `backend` tiap 10 detik
#   5. frontend diperbarui
#
# Pemakaian (di VPS): cd /opt/bintang/project-bersama && git pull && sh deploy/deploy.sh
set -eu
cd "$(dirname "$0")"

N=$(grep -E '^BACKEND_REPLICAS=' .env 2>/dev/null | cut -d= -f2 || true)
N=${N:-2}
BATAS_DETIK=240

echo "[deploy] build image"
docker compose build backend-init backend frontend

echo "[deploy] migrasi database"
docker compose up --no-deps --exit-code-from backend-init backend-init

LAMA=$(docker compose ps -q backend)
echo "[deploy] menyalakan $N replika backend baru (lama: $(echo "$LAMA" | wc -w))"
docker compose up -d --no-deps --no-recreate --scale backend=$((N + $(echo "$LAMA" | wc -w))) backend

BARU=""
for id in $(docker compose ps -q backend); do
  case " $(echo $LAMA) " in *" $id "*) ;; *) BARU="$BARU $id" ;; esac
done

mulai=$(date +%s)
while :; do
  belum=0
  for id in $BARU; do
    status=$(docker inspect -f '{{.State.Health.Status}}' "$id" 2>/dev/null || echo hilang)
    [ "$status" = "healthy" ] || belum=$((belum + 1))
  done
  [ "$belum" -eq 0 ] && break
  if [ $(( $(date +%s) - mulai )) -gt "$BATAS_DETIK" ]; then
    echo "[deploy] GAGAL: replika baru tidak sehat dalam ${BATAS_DETIK}s -- dibatalkan, backend lama tetap melayani"
    docker rm -f $BARU >/dev/null
    exit 1
  fi
  sleep 5
done

echo "[deploy] replika baru sehat, menunggu gateway membaca DNS baru"
sleep 12
if [ -n "$LAMA" ]; then
  docker stop -t 30 $LAMA >/dev/null
  docker rm $LAMA >/dev/null
fi

echo "[deploy] frontend"
docker compose up -d --no-deps frontend

echo "[deploy] SELESAI"
