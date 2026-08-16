---
id: T-709
epik: "[[Production Readiness dan Integrasi Akuntansi]]"
status: review
agent: Codex
prioritas: tinggi
depends_on: [T-702]
created: 2026-08-07
---

# T-709 — Deploy VPS Bintang, Evolution API, dan Tunnel Sementara

## Scope

Deploy VPS baru secara terisolasi: backend Django, frontend React, PostgreSQL Bintang, Redis Bintang, Evolution API dengan PostgreSQL dan Redis sendiri, serta Cloudflare Quick Tunnel untuk akses sementara.

## Keputusan

- Opsi A: satu PostgreSQL/Redis untuk semua layanan. Lebih hemat resource, tetapi lifecycle dan data Evolution dapat mengganggu ERP.
- Opsi B (dipilih): database dan Redis dipisah per domain dalam satu Docker Compose network. Resource VPS memadai, rollback dan backup lebih aman.
- URL memakai Cloudflare Quick Tunnel tanpa kredensial Cloudflare. Ini sesuai akses sementara, tetapi URL tidak permanen.

## Batasan

- Tidak memigrasikan data dari VPS lama.
- Tidak membuka PostgreSQL, Redis, atau Evolution API langsung ke internet.
- Pairing WhatsApp memerlukan scan QR manual setelah instance Evolution berjalan.

## Hasil

- VPS `38.253.224.44` menjalankan Docker Compose dengan backend `67a0996` dan frontend `bb03ee3` dari branch `main` GitHub.
- PostgreSQL dan Redis Bintang sehat; migrasi Django dan `collectstatic` berhasil. Health publik mengembalikan `database: ok` dan `cache: ok`.
- Evolution API `2.3.7` memakai PostgreSQL/Redis terpisah. Instance `bintang_instance` dibuat dan webhook `MESSAGES_UPSERT` aktif menuju `http://backend:8080/api/webhook/evolution/` pada jaringan Docker.
- Cloudflare Quick Tunnel aktif ke frontend. Database, Redis, dan Evolution API tidak dipublikasikan; hanya frontend `127.0.0.1:80` dan administrasi Evolution `127.0.0.1:8080` terikat di host.

## Verifikasi

- `docker compose ps`: seluruh tujuh layanan runtime berstatus `running`.
- Akses publik frontend dan `/api/health/`: HTTP 200.
- Endpoint health membuktikan database dan cache `ok`.
- Status instance Evolution: `close` (menunggu QR pairing manual); pengiriman/penerimaan WhatsApp nyata belum dapat diuji sebelum perangkat dipasangkan.

## Bootstrap akun UAT

- Menjalankan skrip akun produksi yang ada untuk owner, manager, dan enam staff per divisi; kemudian membuat role admin dan kasir melalui `CustomUser.objects.create_user()`.
- Total sepuluh akun aktif. Owner adalah superuser/staff Django; admin aplikasi dan kasir tidak diberi hak superuser.
- Login satu akun dari tiap role (owner, manager, admin, kasir, staff) diverifikasi lewat `/api/auth/login/` dan seluruhnya HTTP 200. Password uji bersama tidak dicatat dalam repository maupun catatan task.

## Pengaturan keamanan UAT sementara

- `SECURITY_BYPASS_IP_VERIFICATION=True` diaktifkan hanya pada environment backend UAT. Dampaknya: OTP email SMTP untuk login dari IP baru dilewati agar pengujian tidak terhambat.
- Login tetap memakai password dan JWT, serta pembatasan percobaan login tetap aktif. OTP reset password tidak diubah.
- Setelah backend dimuat ulang, login `manager` melalui Cloudflare Quick Tunnel diverifikasi HTTP 200 tanpa OTP.
- Wajib kembalikan nilai menjadi `False` dan recreate backend sebelum produksi.
