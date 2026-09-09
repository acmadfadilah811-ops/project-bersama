from calendar import monthrange
from datetime import date
from decimal import Decimal
from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from ..models import Account, AccountingPeriod, AccountingLifecycleLog, AccountingSettings, JournalEntry, JournalEntryLine
from .journal import create_journal_entry
from .ledger import get_account_balances


def get_computed_persediaan_value():
    """Nilai buku persediaan riil = total sisa lapisan stok (StockLayer) x
    harga beli tiap lapisan -- basis biaya yang SAMA dengan yang dipakai
    sistem HPP (api/stock_fifo.py), bukan qty_stok x harga_beli RATA-RATA
    SAAT INI (bisa drift dari histori harga beli tiap batch).

    Keterbatasan: StockLayer.sisa_qty itu state MUTABLE (bukan snapshot per
    tanggal) -- angka ini selalu "nilai stok SAAT DIHITUNG", bukan benar-benar
    "nilai stok pada period.end_date" kalau tutup buku dilakukan jauh setelah
    periode berakhir. Wajar untuk alur normal (tutup buku dilakukan tak lama
    setelah periode berakhir)."""
    from django.db.models import DecimalField, F, Sum
    from api.product_models import StockLayer

    agg = StockLayer.objects.filter(sisa_qty__gt=0).aggregate(
        total=Sum(F("sisa_qty") * F("harga_beli"), output_field=DecimalField(max_digits=20, decimal_places=2))
    )
    return agg["total"] or Decimal("0")


def _validate_stock_reconciliation(period):
    """Blokir tutup buku kalau saldo akun Persediaan di buku besar tidak
    cocok dengan nilai stok riil (lapisan FIFO) -- pola diadaptasi dari
    ERPNext Period Closing Voucher (validate_stock_accounts_balance),
    ditemukan lewat riset referensi 2026-09-09. Instruksi user eksplisit:
    BLOKIR (bukan cuma peringatan) supaya selisih Persediaan tidak bisa
    lolos ke depan tanpa diperbaiki -- pesan errornya harus jelas akun mana
    dan berapa selisihnya, bukan cuma "ditolak".

    Beda dari ERPNext (yang punya banyak akun bertipe Stock): kita cuma
    punya 1 akun Persediaan sistem-lebar (AccountingSettings.pos_inventory_account).
    Kalau belum dikonfigurasi, tidak ada yang bisa direkonsiliasi -- dilewati,
    bukan diblokir (bisnis yang belum pakai pelacakan inventori otomatis
    wajar tidak kena validasi ini)."""
    settings_row = AccountingSettings.objects.select_related("pos_inventory_account").first()
    inventory_account = settings_row.pos_inventory_account if settings_row else None
    if not inventory_account:
        return

    stock_value = get_computed_persediaan_value()
    gl_balance = get_account_balances([inventory_account], period.end_date).get(inventory_account.id) or Decimal("0")

    selisih = (gl_balance - stock_value).quantize(Decimal("0.01"))
    if selisih != 0:
        raise ValidationError(
            f"Tutup buku ditolak: saldo akun Persediaan ({inventory_account.code} — {inventory_account.name}) "
            f"di buku besar per {period.end_date:%d %b %Y} adalah Rp {gl_balance:,.2f}, TIDAK COCOK dengan "
            f"nilai stok riil (lapisan FIFO) Rp {stock_value:,.2f} -- selisih Rp {selisih:,.2f}. "
            f"Perbaiki dulu sebelum tutup buku: cek/lengkapi saldo awal akun {inventory_account.code} di "
            "Jurnal Umum, atau jalankan 'Sync Stok Produk' di Inventori kalau ada produk yang belum "
            "punya lapisan stok tercatat."
        )


def get_negative_account_balances(as_of_date):
    """
    Saldo abnormal negatif akun aktif pada tanggal akhir periode.
    Akun dengan ignore_minus_closing=True (ditandai manual per akun di Daftar
    Akun, mis. akun transit/kliring yang wajar sementara negatif) dikecualikan
    dari blokir tutup buku.
    """
    accounts = list(
        Account.objects.filter(is_active=True, ignore_minus_closing=False)
        .select_related("classification")
        .order_by("code")
    )
    balances = get_account_balances(accounts, as_of_date)
    return [
        {"code": account.code, "name": account.name, "balance": balances.get(account.id, 0)}
        for account in accounts
        if balances.get(account.id, 0) < 0
    ]


def _validate_sequential_closing(period):
    """Blokir tutup buku kalau ada periode LEBIH AWAL yang masih Terbuka --
    tutup buku harus berurutan dari bulan paling lama, tidak boleh ada bulan
    yang "dilompati" (kalau tidak, saldo carry-forward jadi tidak jelas
    dasarnya periode mana). Pola diadaptasi dari ERPNext Period Closing
    Voucher (validate_start_and_end_date) -- ditemukan lewat riset referensi
    2026-09-09, kita sebelumnya tidak punya validasi ini sama sekali.

    Hanya AccountingPeriod yang SUDAH ADA baris-nya yang dihitung -- bulan
    sebelum bisnis mulai beroperasi (tidak pernah ada aktivitas, tidak pernah
    auto-vivified) wajar tidak diblokir."""
    earlier_open = (
        AccountingPeriod.objects.filter(
            status=AccountingPeriod.Status.OPEN,
            start_date__lt=period.start_date,
        )
        .exclude(pk=period.pk)
        .order_by("start_date")
        .first()
    )
    if earlier_open:
        raise ValidationError(
            f"Periode {earlier_open.start_date:%B %Y} masih Terbuka dan lebih awal dari periode ini. "
            "Tutup buku harus berurutan dari bulan paling lama -- tutup periode itu dulu sebelum "
            f"periode {period.start_date:%B %Y}."
        )


def get_period_journal_lines(period):
    """Baris jurnal posted untuk detail satu periode tutup buku."""
    return (
        JournalEntryLine.objects.filter(
            journal_entry__status=JournalEntry.Status.POSTED,
            journal_entry__date__range=(period.start_date, period.end_date),
        )
        .select_related("journal_entry", "account")
        .order_by("journal_entry__date", "journal_entry__entry_number", "id")
    )


def _zero_out_line(account, balance):
    """(debit, kredit) untuk mengembalikan `balance` (sudah bertanda sesuai
    account.normal_balance, dari get_account_balances) ke nol, dan delta ke
    net laba/rugi (positif = menambah laba, negatif = mengurangi) -- benar
    juga untuk akun kontra karena normal_balance sudah memperhitungkan
    is_contra (lihat Account.normal_balance)."""
    if account.normal_balance == "debit":
        if balance > 0:
            return Decimal(0), balance, -balance
        return -balance, Decimal(0), -balance
    if balance > 0:
        return balance, Decimal(0), balance
    return Decimal(0), -balance, balance


def post_closing_entries(*, period, actor=None):
    """
    Jurnal Penutup tradisional: nol-kan SEMUA akun Pendapatan & Beban yang
    masih bersaldo (kumulatif sampai period.end_date -- otomatis cuma
    aktivitas SEJAK penutupan terakhir, karena penutupan sebelumnya sudah
    menge-nol-kannya), pindahkan selisihnya (laba/rugi bersih) ke akun
    Closing (Laba Ditahan, AccountingSettings.closing_account).

    Idempoten per periode: kalau sudah ada JournalEntry PERIOD_CLOSE utk
    periode ini yang masih POSTED, dikembalikan langsung tanpa membuat lagi.
    Dipanggil close_accounting_period() SEBELUM periode ditandai CLOSED
    (create_journal_entry menolak posting ke periode yang sudah closed).
    """
    # "Aktif" = POSTED, bukan hasil pembalikan (reversed_entry kosong), DAN
    # belum punya pembalikan POSTED sendiri (reopen_accounting_period bisa
    # membalikkannya lewat _reverse_closing_entry -- tanpa pengecualian ini,
    # tutup buku ulang setelah reopen akan menganggap jurnal LAMA yang sudah
    # dibalik sebagai "masih berlaku" dan tidak membuat jurnal penutup baru).
    existing = JournalEntry.objects.filter(
        source_type=JournalEntry.SourceType.PERIOD_CLOSE,
        source_id=period.id,
        status=JournalEntry.Status.POSTED,
        reversed_entry__isnull=True,
    ).exclude(reversal_of__status=JournalEntry.Status.POSTED).first()
    if existing:
        return existing

    settings_row = AccountingSettings.objects.select_related("closing_account").first()
    closing_account = settings_row.closing_account if settings_row else None
    if not closing_account:
        raise ValidationError(
            "Akun Closing (Laba Ditahan) belum diatur di Pengaturan Akuntansi -- "
            "wajib diisi sebelum tutup buku bisa memposting jurnal penutup."
        )

    pl_accounts = list(
        Account.objects.filter(
            account_type__in=[Account.AccountType.REVENUE, Account.AccountType.EXPENSE],
            is_active=True,
        ).order_by("code")
    )
    balances = get_account_balances(pl_accounts, period.end_date)

    lines = []
    net_ke_closing = Decimal(0)
    for account in pl_accounts:
        balance = balances.get(account.id) or Decimal(0)
        if balance == 0:
            continue
        debit, kredit, delta = _zero_out_line(account, balance)
        lines.append({
            "account": account, "debit": debit, "kredit": kredit,
            "description": f"Tutup akun {account.name} periode {period.start_date:%b %Y}",
        })
        net_ke_closing += delta

    if not lines:
        # Tidak ada aktivitas P&L sama sekali sejak penutupan terakhir --
        # tidak perlu jurnal penutup (create_journal_entry menolak jurnal
        # kosong/tidak balance kalau dipaksa dibuat dengan 0 baris berarti).
        return None

    if net_ke_closing > 0:
        lines.append({
            "account": closing_account, "debit": Decimal(0), "kredit": net_ke_closing,
            "description": f"Laba bersih periode {period.start_date:%b %Y} ke Laba Ditahan",
        })
    elif net_ke_closing < 0:
        lines.append({
            "account": closing_account, "debit": -net_ke_closing, "kredit": Decimal(0),
            "description": f"Rugi bersih periode {period.start_date:%b %Y} dari Laba Ditahan",
        })

    return create_journal_entry(
        date=period.end_date,
        lines=lines,
        description=f"Jurnal Penutup — Tutup Buku {period.start_date:%B %Y}",
        source_type=JournalEntry.SourceType.PERIOD_CLOSE,
        source_id=period.id,
        created_by=actor,
    )


def _reverse_closing_entry(*, period, actor=None):
    """Balikkan jurnal penutup periode ini (dipanggil reopen_accounting_period).
    Idempoten: no-op kalau tidak ada jurnal penutup POSTED utk periode ini,
    atau reversalnya sudah ada."""
    original = JournalEntry.objects.filter(
        source_type=JournalEntry.SourceType.PERIOD_CLOSE,
        source_id=period.id,
        status=JournalEntry.Status.POSTED,
    ).first()
    if not original:
        return None
    if JournalEntry.objects.filter(reversed_entry=original, status=JournalEntry.Status.POSTED).exists():
        return None

    lines = [
        {
            "account": line.account,
            "debit": line.kredit,
            "kredit": line.debit,
            "description": f"Pembalikan jurnal penutup — {line.description}",
        }
        for line in original.lines.all()
    ]
    reversal = create_journal_entry(
        date=period.end_date,
        lines=lines,
        description=f"Pembalikan Jurnal Penutup {period.start_date:%B %Y} (Tutup Buku dibuka kembali)",
        source_type=JournalEntry.SourceType.PERIOD_CLOSE,
        # source_id=None (bukan period.id) -- constraint uniq_je_source_date
        # (source_type, source_id, date) akan bentrok dengan entry asli kalau
        # sama-sama period.id di tanggal period.end_date yang sama. Pola ini
        # sama dengan post_order_reversal_journal(). Entry asli tetap
        # terhubung lewat FK reversed_entry, bukan source_id.
        source_id=None,
        created_by=actor,
    )
    reversal.reversed_entry = original
    reversal.save(update_fields=["reversed_entry"])

    # Lepaskan source_id dari entry asli setelah dibalik: kalau tidak,
    # (source_type, source_id, date) = (PERIOD_CLOSE, period.id, period.end_date)
    # masih "dipakai" entry lama ini selamanya, sehingga tutup-buku-ulang
    # periode ini (post_closing_entries) tidak akan pernah bisa memposting
    # jurnal penutup baru dgn key yang sama -- bentrok uniq_je_source_date.
    # Entry lama TETAP POSTED & tetap muncul di ledger/detail periode (yang
    # menyaring lewat tanggal, bukan source_id) -- audit trail utuh, cuma
    # tidak lagi "diklaim" sebagai jurnal penutup aktif periode ini.
    original.source_id = None
    original.save(update_fields=["source_id"])
    return reversal


@transaction.atomic
def close_accounting_period(*, period_id=None, start_date=None, end_date=None, actor=None):
    """
    Kunci/tutup periode akuntansi dengan row locking & audit log.
    Idempotent: Jika periode sudah CLOSED, kembalikan periode tersebut tanpa error.
    Safety: Tolak jika ada JournalEntry berstatus DRAFT di rentang periode.
    """
    if period_id:
        period = AccountingPeriod.objects.select_for_update().filter(pk=period_id).first()
        if not period:
            raise ValidationError(f"Periode akuntansi #{period_id} tidak ditemukan.")
        start_date = period.start_date
        end_date = period.end_date
    else:
        if isinstance(start_date, str):
            start_date = date.fromisoformat(start_date)
        if isinstance(end_date, str):
            end_date = date.fromisoformat(end_date)

        if not start_date or not end_date:
            raise ValidationError("Parameter start_date dan end_date (atau period_id) wajib diisi.")

        if start_date > end_date:
            raise ValidationError("Tanggal mulai tidak boleh lebih besar dari tanggal akhir.")

        is_full_month = (
            start_date.day == 1
            and end_date == end_date.replace(day=monthrange(end_date.year, end_date.month)[1])
            and (start_date.year, start_date.month) == (end_date.year, end_date.month)
        )
        if not is_full_month:
            raise ValidationError("Tutup buku saat ini hanya mendukung satu bulan kalender penuh.")

        period, _ = AccountingPeriod.objects.select_for_update().get_or_create(
            start_date=start_date,
            end_date=end_date,
            defaults={"fiscal_year": start_date.year, "status": AccountingPeriod.Status.OPEN},
        )

    # 1. Idempotency Check: Jika sudah CLOSED, kembalikan langsung
    if period.status == AccountingPeriod.Status.CLOSED:
        return period

    # 1b. Urutan tutup buku harus berurutan dari bulan paling lama (lihat
    # _validate_sequential_closing) -- dicek SEBELUM draft/saldo negatif
    # supaya pesan errornya paling relevan (percuma cek saldo periode ini
    # kalau periode sebelumnya saja belum ditutup).
    _validate_sequential_closing(period)

    # 2. Hard block validation: Cek apakah ada draft entry di periode ini
    has_drafts = JournalEntry.objects.filter(
        date__range=(start_date, end_date),
        status=JournalEntry.Status.DRAFT,
    ).exists()
    if has_drafts:
        raise ValidationError("Masih ada jurnal bertipe DRAFT di periode ini. Harap finalisasi atau hapus draft sebelum tutup buku.")

    # 3. Hard block validation: saldo abnormal negatif (mis. Kas) harus
    # diperbaiki dulu agar periode yang dikunci tetap dapat direkonsiliasi.
    negative_balances = get_negative_account_balances(end_date)
    if negative_balances:
        preview = "; ".join(
            f"{item['code']} - {item['name']}: {item['balance']}"
            for item in negative_balances[:10]
        )
        raise ValidationError(
            "Tutup buku ditolak karena ada saldo akun negatif pada akhir periode: "
            f"{preview}. Perbaiki jurnal atau saldo akun terlebih dahulu."
        )

    # 3b. Hard block validation: saldo akun Persediaan di buku besar harus
    # cocok dengan nilai stok riil (lapisan FIFO) -- lihat
    # _validate_stock_reconciliation. Referensi: ERPNext Period Closing
    # Voucher (validate_stock_accounts_balance). Keputusan pengguna: blokir
    # (bukan sekadar peringatan) karena selisih yang lolos berisiko menumpuk.
    _validate_stock_reconciliation(period)

    # 4. Jurnal Penutup tradisional -- WAJIB sebelum status jadi CLOSED,
    # karena create_journal_entry() menolak posting ke periode yang statusnya
    # sudah CLOSED (lihat _get_or_create_period di journal.py).
    post_closing_entries(period=period, actor=actor)

    # 5. Update Period Status & Audit Trail
    period.status = AccountingPeriod.Status.CLOSED
    period.closed_at = timezone.now()
    period.closed_by = actor
    period.save(update_fields=["status", "closed_at", "closed_by"])

    actor_user = actor if hasattr(actor, "is_authenticated") and actor.is_authenticated else None
    AccountingLifecycleLog.objects.create(
        action=AccountingLifecycleLog.Action.STOP,
        actor=actor_user,
    )

    return period


def close_all_open_periods(*, fiscal_year=None, actor=None):
    """
    Tutup semua periode Terbuka yang sudah berakhir (end_date < hari ini),
    satu per satu urut dari yang tertua. Bulan berjalan yang belum selesai
    tidak ikut. Tiap periode sudah atomic sendiri di close_accounting_period.

    Sejak validasi urutan (_validate_sequential_closing) ditambahkan: kalau
    1 periode gagal (mis. saldo negatif), SEMUA periode setelahnya juga akan
    gagal (diblokir "periode sebelumnya belum ditutup") -- ini disengaja,
    bukan bug, sesuai aturan akuntansi (tidak boleh tutup Maret kalau
    Februari belum beres). `failed` tetap melaporkan tiap periode dengan
    alasannya masing-masing supaya user tahu persis di mana rantainya putus.
    """
    today = timezone.localdate()
    qs = AccountingPeriod.objects.filter(status=AccountingPeriod.Status.OPEN, end_date__lt=today)
    if fiscal_year:
        qs = qs.filter(fiscal_year=fiscal_year)
    periods = list(qs.order_by("start_date"))

    closed = []
    failed = []
    for period in periods:
        try:
            closed.append(close_accounting_period(period_id=period.id, actor=actor))
        except ValidationError as err:
            failed.append({"period": period, "reason": err.message if hasattr(err, "message") else str(err)})
    return closed, failed


@transaction.atomic
def reopen_accounting_period(*, start_date=None, end_date=None, period_id=None, actor=None):
    """
    Buka kembali (reopen) periode akuntansi yang ditutup dengan row locking & audit log.
    """
    if period_id:
        period = AccountingPeriod.objects.select_for_update().filter(pk=period_id).first()
    else:
        if isinstance(start_date, str):
            start_date = date.fromisoformat(start_date)
        if isinstance(end_date, str):
            end_date = date.fromisoformat(end_date)
        period = AccountingPeriod.objects.select_for_update().filter(
            start_date=start_date, end_date=end_date
        ).first()

    if not period:
        raise ValidationError(f"Periode akuntansi tidak ditemukan.")

    if period.status == AccountingPeriod.Status.OPEN:
        return period

    period.status = AccountingPeriod.Status.OPEN
    period.closed_at = None
    period.closed_by = None
    period.save(update_fields=["status", "closed_at", "closed_by"])

    # Balikkan jurnal penutup (kalau ada) SETELAH status jadi OPEN --
    # create_journal_entry() menolak posting selama masih CLOSED. Tanpa ini,
    # akun P&L yang sudah di-nol-kan jurnal penutup tetap nol di layar
    # walau periode dibuka lagi untuk koreksi, membuat transaksi baru yang
    # diposting sesudahnya seolah satu-satunya aktivitas bulan itu.
    _reverse_closing_entry(period=period, actor=actor)

    actor_user = actor if hasattr(actor, "is_authenticated") and actor.is_authenticated else None
    AccountingLifecycleLog.objects.create(
        action=AccountingLifecycleLog.Action.START,
        actor=actor_user,
    )

    return period
