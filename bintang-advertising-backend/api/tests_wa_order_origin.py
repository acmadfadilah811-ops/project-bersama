from django.test import TestCase

from api.models import Order
from api.views.whatsapp import BaseWhatsAppWebhookView


class WhatsAppOrderOriginTest(TestCase):
    def test_order_dari_webhook_ditandai_sebagai_whatsapp(self):
        # _simpan_order_dari_form() dipecah jadi _parse_form_order() (parsing
        # murni) + _buat_order_dari_data() (persist) — Order sekarang baru
        # benar-benar dibuat setelah pelanggan konfirmasi 'sesuai' (gerbang
        # rekap, instruksi user 2026-08-15). Test ini cuma menguji origin
        # 'wa' tersimpan benar, jadi panggil dua tahap itu langsung.
        view = BaseWhatsAppWebhookView()
        parsed = view._parse_form_order(
            '62812345678',
            'Sari',
            'Nama Pemesan: Sari\nJenis Produk: Banner\nJumlah: 1\nUkuran: 2 x 1',
        )
        order_id, _ = view._buat_order_dari_data(parsed)

        self.assertEqual(Order.objects.get(pk=order_id).sumber, 'wa')
