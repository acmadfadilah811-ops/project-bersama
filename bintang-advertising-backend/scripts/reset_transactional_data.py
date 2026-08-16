import sys
import os
import django

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.db import transaction
from django.apps import apps

# Model transaksi dan operasional yang akan di-reset (dihapus bersih)
TRANSACTIONAL_MODELS = [
    # Orders & POS Sales
    'Order', 'OrderItem', 'PengembalianOrder', 'OrderActivityLog',
    'POSSale', 'POSSaleItem', 'RingkasanShift', 'SaldoKasHarian',
    'CouponUsage', 'LoyaltyPointRedemption',

    # Production & Jobs
    'JobBoard', 'ProductionCost', 'StockProductionDocumentCost',

    # Purchases & Inventory Movements
    'Purchase', 'PurchaseItem', 'PurchasePayment', 'PurchaseAttachment', 'PurchaseActivityLog',
    'ProductStockMovement', 'StockInDocument', 'StockInDocumentItem',
    'StockOutDocument', 'StockOutDocumentItem', 'StockProductionDocument',
    'StockProductionDocumentItem', 'StockOpnameDocument', 'StockOpnameDocumentItem',
    'StockLayer', 'StockLayerConsumption', 'ProductActivityLog', 'RestockHistory',

    # Finance & Accounting Journals
    'CashTransaction', 'CashTransactionAttachment', 'TransaksiBukuBesar',
    'FixedAsset', 'JournalEntry', 'JournalEntryLine', 'JournalAuditLog', 'BankStatementLine',
    'AccountingLifecycleLog', 'POSPostingSettingsAuditLog',

    # Notes, Reviews & Logs
    'CustomerNote', 'CustomerNoteEntry', 'CustomerNoteDocument',
    'CustomerReview', 'KomplainOrder', 'KomplainLog', 'CustomerActivity',
    'SecurityAuditLog', 'Absensi', 'DailyAttendanceSession', 'UnlockRequest'
]

def reset_data():
    print("==================================================")
    print("MEMULAI RESET DATA TRANSAKSI & OPERASIONAL (SQLITE)")
    print("==================================================")
    
    total_deleted = 0
    with transaction.atomic():
        for model_name in TRANSACTIONAL_MODELS:
            try:
                model = apps.get_model('api', model_name)
            except LookupError:
                try:
                    model = apps.get_model('accounting', model_name)
                except LookupError:
                    try:
                        model = apps.get_model('hr', model_name)
                    except LookupError:
                        try:
                            model = apps.get_model('users', model_name)
                        except LookupError:
                            model = None

            if model:
                count = model.objects.count()
                if count > 0:
                    model.objects.all().delete()
                    print(f"[OK] Model [{model_name}]: {count} record berhasil dihapus.")
                    total_deleted += count
                else:
                    print(f"[-] Model [{model_name}]: sudah bersih (0 record).")

        # Reset stok produk ke 0 (stok awal bersih)
        try:
            Product = apps.get_model('api', 'Product')
            Product.objects.update(total_stok=0)
            print("[OK] Total stok semua produk berhasil di-reset ke 0.")
        except Exception as e:
            print(f"[WARN] Reset stok produk: {e}")

        # Reset saldo kas ke 0
        try:
            CashBankAccount = apps.get_model('accounting', 'CashBankAccount')
            CashBankAccount.objects.update(saldo_saat_ini=0)
            print("[OK] Saldo semua akun Kas & Bank berhasil di-reset ke 0.")
        except Exception as e:
            print(f"[WARN] Reset saldo kas: {e}")

    print("==================================================")
    print(f"[BERHASIL] Total {total_deleted} data transaksi di-reset.")
    print("[AMU] AKUN USER & PASSWORD: 100% AMAN DAN TIDAK DITENTUH.")
    print("==================================================")

if __name__ == '__main__':
    reset_data()
