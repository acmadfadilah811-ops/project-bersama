from datetime import date

from django.utils import timezone


def resolve_date_range(request):
    """
    Ambil date_from/date_to dari query params (format YYYY-MM-DD). Default:
    hari ini untuk yang tidak diisi — sama seperti default filter di Olsera.
    Return (date, date).

    timezone.localdate() (BUKAN date.today()) -- date.today() pakai jam OS
    server (UTC di VPS), sedangkan TIME_ZONE proyek ini 'Asia/Jakarta' (WIB,
    UTC+7). Dini hari WIB (00:00-06:59) jam UTC masih di TANGGAL KEMARIN --
    tanpa fix ini, "Hari ini" (default 7 halaman Akuntansi: Invoice, Jurnal
    Umum, Log Jurnal, Buku Besar, Laba Rugi, Aset, Transfer Modal, Settlement,
    Rekonsiliasi Bank) diam-diam menampilkan data KEMARIN selama jam segitu.
    Kasus sama persis dengan bug todayISO() yang sudah diperbaiki di
    PosHistory.jsx/Kanban Personal (2026-09-07), ditemukan lagi di sisi
    backend saat audit skalabilitas Invoice (2026-09-08).
    """
    today = timezone.localdate()

    date_from_str = request.query_params.get("date_from")
    try:
        date_from = date.fromisoformat(date_from_str) if date_from_str else today
    except ValueError:
        date_from = today

    date_to_str = request.query_params.get("date_to")
    try:
        date_to = date.fromisoformat(date_to_str) if date_to_str else today
    except ValueError:
        date_to = today

    return date_from, date_to
