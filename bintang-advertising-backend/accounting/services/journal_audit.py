"""Deskripsi Log Jurnal untuk aksi Hapus — format teks "Debit/Kredit akun ... IDR
x" digabung tanda ' | ', persis pola yang dipakai Log Aksi Olsera supaya user
tetap bisa audit isi jurnal yang sudah dihapus/dibalik tanpa buka jurnal lain.
"""


def _format_line(line):
    is_debit = line.debit > 0
    label = "Debit" if is_debit else "Kredit"
    amount = line.debit if is_debit else line.kredit
    formatted_amount = f"{amount:,.0f}".replace(",", ".")
    description = line.description or ""
    return f"{label} {line.account.code} {line.account.name} {description} IDR {formatted_amount}".strip()


def build_deletion_note(entry, reason=""):
    """entry: JournalEntry dengan `lines` sudah di-prefetch (`select_related('account')`)."""
    parts = [_format_line(line) for line in entry.lines.all()]
    note = f"Hapus {entry.get_source_type_display()} - {entry.entry_number} " + " | ".join(parts)
    if reason:
        note += f" | Catatan: {reason}"
    return note
