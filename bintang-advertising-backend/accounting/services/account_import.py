import csv
import io

from ..models import Account, AccountClassification

REQUIRED_COLUMNS = {"account_name", "account_no"}

# Klasifikasi yang SELURUH akunnya kontra (saldo normal terbalik) — sinkron
# dengan CONTRA_SUB_CATEGORIES di frontend (kategoriAkunMap.js). Klasifikasi
# lain (mis. Ekuitas, Pendapatan) juga punya akun kontra (Prive, Retur/
# Potongan) tapi itu per-akun individual, bukan seluruh klasifikasi, jadi
# tidak bisa di-auto-detect lewat import — set manual lewat Ubah Akun.
CONTRA_CLASSIFICATIONS = {
    "Akumulasi penyusutan perlengkapan",
    "Akumulasi penyusutan aset tetap",
    "Akumulasi penyusutan aset tak berwujud",
}


def parse_csv_file(file_obj):
    """Baca file upload. Return (rows, error_detail) — error_detail None kalau sukses."""
    try:
        content = file_obj.read().decode("utf-8-sig")
    except UnicodeDecodeError:
        return [], "File tidak bisa dibaca sebagai teks (encoding tidak didukung, pakai UTF-8)."

    reader = csv.DictReader(io.StringIO(content))
    if not reader.fieldnames or not REQUIRED_COLUMNS.issubset(set(reader.fieldnames)):
        return [], f"Kolom CSV tidak sesuai template. Wajib ada: {', '.join(sorted(REQUIRED_COLUMNS))}."

    rows = [row for row in reader if any((v or "").strip() for v in row.values())]
    return rows, None


def build_preview(rows):
    """
    Validasi baris CSV (kolom account_name, account_no — persis template resmi
    Olsera, tidak ada kolom classification/is_contra). Klasifikasi di-derive
    otomatis dari rentang kode di AccountClassification (sumber yang sama
    dipakai Account.clean()); is_contra otomatis True kalau klasifikasi hasil
    derive termasuk CONTRA_CLASSIFICATIONS.
    """
    classifications = list(
        AccountClassification.objects.exclude(code_range_start__isnull=True, code_range_end__isnull=True)
    )
    existing_codes = set(Account.objects.values_list("code", flat=True))
    seen_in_file = set()

    preview = []
    for index, row in enumerate(rows, start=1):
        code = (row.get("account_no") or "").strip()
        name = (row.get("account_name") or "").strip()
        base = {"row_index": index, "code": code, "name": name, "classification": "", "is_contra": False}

        if not code or not name:
            preview.append({**base, "is_valid": False, "error": "Kolom account_name dan account_no tidak boleh kosong."})
            continue

        if code in existing_codes:
            preview.append({**base, "is_valid": False, "error": f"Kode akun '{code}' sudah terdaftar."})
            continue

        if code in seen_in_file:
            preview.append({**base, "is_valid": False, "error": f"Kode akun '{code}' duplikat di dalam file ini."})
            continue

        try:
            code_num = int(code)
        except ValueError:
            preview.append({**base, "is_valid": False, "error": f"Kode akun '{code}' harus berupa angka."})
            continue

        classification_obj = next(
            (c for c in classifications if c.code_range_start <= code_num <= c.code_range_end), None,
        )
        if not classification_obj:
            preview.append({
                **base,
                "is_valid": False,
                "error": f"Kode akun {code} di luar semua rentang klasifikasi yang dikenal (cek Download Panduan).",
            })
            continue

        seen_in_file.add(code)
        preview.append({
            "row_index": index,
            "code": code,
            "name": name,
            "classification_id": classification_obj.id,
            "classification": classification_obj.name,
            "is_contra": classification_obj.name in CONTRA_CLASSIFICATIONS,
            "is_valid": True,
            "error": None,
        })

    return preview


def commit_entries(valid_entries):
    """
    Simpan entries (is_valid=True) jadi Account baru. Sengaja TIDAK dibungkus 1
    transaction.atomic() bareng semua entry — 1 baris gagal (mis. kode bentrok)
    akan meracuni seluruh block dan diam-diam me-rollback baris lain yang sudah
    sukses dibuat. Tiap create() jalan sebagai transaksi sendiri (autocommit).
    """
    created_count = 0
    errors = []
    for entry in valid_entries:
        try:
            classification = AccountClassification.objects.get(id=entry["classification_id"])
            Account.objects.create(
                code=entry["code"],
                name=entry["name"],
                classification=classification,
                account_type=classification.account_type,
                is_contra=entry.get("is_contra", False),
            )
            created_count += 1
        except Exception as exc:
            errors.append(f"Gagal mengimpor akun {entry.get('code')}: {str(exc)}")

    return created_count, errors
