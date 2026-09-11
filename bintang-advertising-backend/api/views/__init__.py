from .whatsapp import (
    EvolutionWebhookView, WAWebhookView, WhatsAppStatusView,
    WhatsAppChatsView, WhatsAppMessagesView, WhatsAppSendMessageView,
    WhatsAppSendMediaView
)
# .evolution_ai.EvolutionWebhookView (T-721) SENGAJA tidak lagi dipakai di
# sini (2026-09-09, instruksi user): subclass itu membajak pesan PERTAMA
# tiap percakapan (per nomor, cache 1 jam) langsung ke AI mentah lewat
# tanya_ai_finishing(), melewati SEMUA sistem terstruktur -- greeting,
# klasifikasi_maksud_pesan (7 kategori), tahap Bahan/Finishing, dst. Itu
# kemungkinan besar penyebab utama jawaban tidak konsisten yang ditemukan
# di log produksi (kalimat "maaf" berbeda-beda utk pertanyaan serupa).
# Sekarang SEMUA pesan (termasuk pertama) lewat EvolutionWebhookView dasar
# di atas: Step 1 Greeting -> Step 1c klasifikasi 7 kategori -> handler.
# File evolution_ai.py TIDAK dihapus (masih dites di tests_wa_logic.py utk
# jaga histori/opsi rollback), cuma tidak lagi dipasang di routing.
from .orders import (
    OrderViewSet, AssignOrderView, OrderItemViewSet, ForwardJobView, PengembalianOrderViewSet
)
from .order_void_requests import OrderVoidRequestViewSet
from .pos_void_requests import POSVoidRequestViewSet
from .jobs import (
    JobBoardViewSet, JobMaterialDeductView, deduct_job_materials_if_needed,
    TahapProsesViewSet
)
from .inventory import (
    InventoryItemViewSet, InventoryRestockView, record_material_consumption_to_general_ledger,
    ProductPriceViewSet, BillOfMaterialsViewSet, BoMItemViewSet
)
from .contacts import (
    ContactViewSet, ContactStatsView, ProductionCustomerLiteView,
    KomplainViewSet, CustomerActivityViewSet
)
from .config import (
    SystemConfigViewSet, FAQViewSet, BusinessSettingsView
)
from .dashboard import (
    DashboardView
)
from .users import (
    CustomUserViewSet, CreateUserView,
    DivisiViewSet, UnitBisnisViewSet, ShiftTimingViewSet, StaffPerformanceReportView
)
from .pos import (
    POSAntrianDeviceViewSet, SaldoKasHarianViewSet, RingkasanShiftViewSet,
    POSPaymentMethodViewSet
)
from .public import (
    HealthCheckView, ClientLogView, PublicOrderDetailsView, PublicSubmitDesignView
)
from .order_invoice import OrderInvoiceWhatsAppView
from .machine import (
    MesinViewSet, PenggunaanMesinViewSet, MaintenanceMesinViewSet
)







