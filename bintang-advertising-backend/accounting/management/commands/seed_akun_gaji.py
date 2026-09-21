"""Buat HANYA akun Penggajian (Hutang gaji, Hutang BPJS, Beban BPJS perusahaan) dan isi
pemetaan akun gaji di AccountingSettings bila masih kosong. Idempotent.

Sengaja terpisah dari seed_coa: seed_coa membuat ulang SEMUA akun default yang belum
ada, termasuk akun yang sengaja dihapus di instalasi berjalan -- tidak aman dijalankan
di produksi hanya demi 3 akun ini."""

from django.core.management.base import BaseCommand, CommandError

from accounting.models import Account, AccountClassification, AccountingSettings

from .seed_coa import ACCOUNTS

KODE_AKUN = ("21100", "21200", "60600")
PEMETAAN = {
    "payroll_expense_account": "60100",
    "payroll_payable_account": "21100",
    "payroll_employer_contribution_expense_account": "60600",
}


class Command(BaseCommand):
    help = "Buat 3 akun Penggajian & isi pemetaan akun gaji (idempotent)."

    def handle(self, *args, **options):
        dibuat = 0
        for code, name, klas, tipe, is_contra, desc in (a for a in ACCOUNTS if a[0] in KODE_AKUN):
            klasifikasi = AccountClassification.objects.filter(name=klas).first()
            if not klasifikasi:
                raise CommandError(f"Klasifikasi '{klas}' belum ada. Jalankan Setup COA dulu.")
            _, baru = Account.objects.get_or_create(code=code, defaults={
                "name": name, "description": desc, "account_type": tipe,
                "classification": klasifikasi, "is_contra": is_contra,
            })
            dibuat += baru
            self.stdout.write(f"  {code} {name}: {'DIBUAT' if baru else 'sudah ada'}")

        row = AccountingSettings.objects.first()
        if not row:
            raise CommandError("Pengaturan Akuntansi belum diinisialisasi.")
        diisi = []
        for field, code in PEMETAAN.items():
            akun = Account.objects.filter(code=code, is_active=True).first()
            if akun and not getattr(row, f"{field}_id"):
                setattr(row, field, akun)
                diisi.append(field)
        if diisi:
            row.save(update_fields=diisi)
        self.stdout.write(self.style.SUCCESS(f"Selesai. Akun baru: {dibuat}. Pemetaan diisi: {diisi or 'tidak ada (sudah terisi)'}."))
