"""Read-only audit untuk konfigurasi Django backend di VPS.

Tidak melakukan git pull, migration, restart service, backup, atau perubahan
apa pun di VPS. Kredensial diambil dari environment/SSH agent dan tidak pernah
dicetak ke output.

Contoh:
  $env:VPS_HOST = 'example.com'
  $env:VPS_USER = 'deploy'
  $env:VPS_PASSWORD = '...'
  python check_backend_vps.py --port 22

Host key checking sengaja fail-closed. Tambahkan fingerprint VPS ke
~/.ssh/known_hosts setelah diverifikasi secara independen.
"""

from __future__ import annotations

import argparse
import getpass
import os
import shlex
import sys
from dataclasses import dataclass

try:
    import paramiko
except ImportError as exc:  # pragma: no cover - environment dependent
    raise SystemExit("Paramiko belum terpasang. Install dengan: python -m pip install paramiko") from exc


@dataclass
class Config:
    host: str
    port: int
    username: str
    backend_dir: str
    key_filename: str | None
    password: str | None
    timeout: int
    accept_new_host_key: bool


def parse_args() -> Config:
    parser = argparse.ArgumentParser(description="Audit read-only Django backend di VPS")
    parser.add_argument("--host", default=os.getenv("VPS_HOST"), help="Hostname/IP VPS (atau VPS_HOST)")
    parser.add_argument("--port", type=int, default=int(os.getenv("VPS_PORT", "22")))
    parser.add_argument("--user", default=os.getenv("VPS_USER"), help="User SSH (atau VPS_USER)")
    parser.add_argument(
        "--backend-dir",
        default=os.getenv("VPS_BACKEND_DIR", "/root/bintang-advertising-backend"),
        help="Path checkout backend di VPS",
    )
    parser.add_argument("--key", default=os.getenv("VPS_SSH_KEY"), help="Private key SSH")
    parser.add_argument(
        "--password-env",
        default="VPS_PASSWORD",
        help="Nama environment variable password SSH (default: VPS_PASSWORD)",
    )
    parser.add_argument("--timeout", type=int, default=20)
    parser.add_argument(
        "--accept-new-host-key",
        action="store_true",
        help="Terima host key baru sekali; hanya untuk audit awal, verifikasi fingerprint sebelum production.",
    )
    args = parser.parse_args()

    if not args.host or not args.user:
        parser.error("--host/--user wajib diisi atau set VPS_HOST/VPS_USER")

    password = os.getenv(args.password_env)
    if not args.key and not password and sys.stdin.isatty():
        password = getpass.getpass(f"Password SSH untuk {args.user}@{args.host}: ")

    return Config(
        host=args.host,
        port=args.port,
        username=args.user,
        backend_dir=args.backend_dir.rstrip("/"),
        key_filename=args.key,
        password=password,
        timeout=args.timeout,
        accept_new_host_key=args.accept_new_host_key,
    )


def remote(client: paramiko.SSHClient, title: str, command: str, timeout: int) -> tuple[int, str, str]:
    print(f"\n{'=' * 18} {title} {'=' * 18}")
    try:
        _stdin, stdout, stderr = client.exec_command(command, timeout=timeout)
        exit_code = stdout.channel.recv_exit_status()
        output = stdout.read().decode("utf-8", errors="replace").strip()
        error = stderr.read().decode("utf-8", errors="replace").strip()
    except Exception as exc:  # pragma: no cover - network dependent
        print(f"[ERROR] {exc}")
        return 255, "", str(exc)

    if output:
        _safe_print(output)
    if error:
        _safe_print(f"[STDERR]\n{error}")
    print(f"[exit: {exit_code}]")
    return exit_code, output, error


def _safe_print(value: str) -> None:
    """Print remote output even when the local PowerShell encoding is legacy."""
    encoding = getattr(sys.stdout, "encoding", None) or "utf-8"
    sanitized = str(value).encode(encoding, errors="replace").decode(encoding, errors="replace")
    print(sanitized)


def main() -> int:
    cfg = parse_args()
    backend = shlex.quote(cfg.backend_dir)
    python = shlex.quote(f"{cfg.backend_dir}/.venv/bin/python")
    manage = f"{python} {shlex.quote(cfg.backend_dir + '/manage.py')}"

    client = paramiko.SSHClient()
    client.load_system_host_keys()
    # Default fail-closed. Audit awal boleh memakai --accept-new-host-key,
    # tetapi mode ini tidak boleh dipakai sebagai konfigurasi deploy produksi.
    if cfg.accept_new_host_key:
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    else:
        client.set_missing_host_key_policy(paramiko.RejectPolicy())

    print(f"Menghubungkan read-only ke {cfg.host}:{cfg.port} sebagai {cfg.username}...")
    try:
        client.connect(
            hostname=cfg.host,
            port=cfg.port,
            username=cfg.username,
            password=cfg.password,
            key_filename=cfg.key_filename,
            look_for_keys=True,
            allow_agent=True,
            timeout=cfg.timeout,
            banner_timeout=cfg.timeout,
            auth_timeout=cfg.timeout,
        )
    except Exception as exc:  # pragma: no cover - network dependent
        print(f"[ERROR] SSH gagal: {exc}")
        print("Pastikan fingerprint host sudah ada di known_hosts dan credential benar.")
        return 2

    print("[OK] SSH terhubung; semua pemeriksaan berikut bersifat read-only.")
    try:
        remote(client, "HOST & RESOURCE", "hostname; uptime; free -h; df -h /", cfg.timeout)
        remote(
            client,
            "BACKEND CHECKOUT",
            f"test -d {backend} && stat -c '%A %U:%G %n' {backend}; "
            f"git -C {backend} branch --show-current; "
            f"git -C {backend} rev-parse HEAD; "
            f"git -C {backend} status --short",
            cfg.timeout,
        )
        remote(
            client,
            "ENV KEY INVENTORY (NILAI DISEMBUNYIKAN)",
            f"for f in {backend}/.env*; do "
            "[ -f \"$f\" ] || continue; echo \"FILE=$(basename \"$f\")\"; "
            "awk -F= '/^[A-Za-z_][A-Za-z0-9_]*=/ {k=$1; gsub(/[[:space:]]/, \"\", k); print k\"=<configured>\"}' \"$f\"; "
            "stat -c 'PERMISSION=%a OWNER=%U:%G FILE=%n' \"$f\"; done",
            cfg.timeout,
        )
        django_code = (
            "from django.conf import settings; "
            "from django.db import connection; "
            "db=settings.DATABASES['default']; "
            "print('DEBUG='+str(settings.DEBUG)); "
            "print('DB_ENGINE='+str(db.get('ENGINE'))); "
            "print('DB_NAME='+str(db.get('NAME'))); "
            "print('DB_HOST='+str(db.get('HOST'))); "
            "print('DB_PORT='+str(db.get('PORT'))); "
            "print('DB_PASSWORD_CONFIGURED='+str(bool(db.get('PASSWORD')))); "
            "print('ALLOWED_HOSTS='+str(list(settings.ALLOWED_HOSTS))); "
            "print('CSRF_TRUSTED_ORIGINS='+str(list(getattr(settings, 'CSRF_TRUSTED_ORIGINS', [])))); "
            "connection.ensure_connection(); print('DB_CONNECTION=OK'); "
            "print('DB_VENDOR='+connection.vendor)"
        )
        remote(client, "DJANGO DATABASE & SECURITY CONFIG", f"cd {backend} && {manage} shell -c {shlex.quote(django_code)}", cfg.timeout)
        remote(client, "DJANGO MIGRATION CHECK", f"cd {backend} && {manage} migrate --check", cfg.timeout)
        remote(client, "DJANGO DEPLOY CHECK", f"cd {backend} && {manage} check --deploy", cfg.timeout)
        remote(
            client,
            "SERVICES & PORTS",
            "systemctl --failed --no-legend; "
            "systemctl list-units --type=service --all --no-legend | grep -Ei 'daphne|gunicorn|nginx|celery|postgres|mysql' || true; "
            "ss -lntp 2>/dev/null | grep -E ':(22|80|443|3306|5432|6379|800[0-9]|8080)\\b' || true; "
            "printf 'UFW='; (ufw status 2>/dev/null | head -n 5 || echo unavailable); "
            "printf 'NGINX_TEST='; nginx -t 2>&1 | tail -n 2; "
            "printf 'CERTBOT='; systemctl is-active certbot 2>/dev/null || true",
            cfg.timeout,
        )
        remote(
            client,
            "DOCKER DATABASE INVENTORY",
            "if command -v docker >/dev/null 2>&1; then "
            "docker ps --format 'table {{.Names}}\\t{{.Image}}\\t{{.Status}}\\t{{.Ports}}'; "
            "if docker ps --format '{{.Names}}' | grep -qx postgres_evolution; then "
            "docker exec postgres_evolution sh -lc 'pg_isready -U \"$POSTGRES_USER\"; psql -U \"$POSTGRES_USER\" -tAc \"select datname from pg_database where datistemplate = false order by datname;\"' 2>&1; "
            "fi; "
            "else echo 'Docker tidak terinstall'; fi",
            cfg.timeout,
        )
        remote(
            client,
            "HEALTH ENDPOINT LOCAL",
            "for url in http://127.0.0.1:8000/health/ http://127.0.0.1:8000/api/health/; do "
            "curl -ksS -o /dev/null -w '%{http_code} %{url_effective}\\n' --max-time 5 \"$url\" 2>/dev/null || echo \"000 $url UNAVAILABLE\"; done",
            cfg.timeout,
        )
    finally:
        client.close()
        print("\n[OK] Koneksi SSH ditutup.")

    print("\nAudit selesai. Periksa terutama DB_ENGINE/DB_NAME, DB_CONNECTION, migrate --check, DEBUG, dan port 5432.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
