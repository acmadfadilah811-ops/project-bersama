from datetime import date


def resolve_date_range(request):
    """
    Ambil date_from/date_to dari query params (format YYYY-MM-DD). Default:
    hari ini untuk yang tidak diisi — sama seperti default filter di Olsera.
    Return (date, date).
    """
    today = date.today()

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
