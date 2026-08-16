"""Menaruh respons AI pada pesan awal tanpa mengganti alur Evolution lama."""
from django.core.cache import cache
from rest_framework import status

from ..models import Contact
from ..wa_logic import simpan_ke_memori, tanya_ai_finishing
from .whatsapp import EvolutionWebhookView as LegacyEvolutionWebhookView


class EvolutionWebhookView(LegacyEvolutionWebhookView):
    """Mempertahankan rule/form/daftar harga lama setelah satu respons AI awal."""

    def _proses_pesan_masuk(self, sender_raw, message_text, media_url="", push_name=""):
        nomor = sender_raw.split("@")[0].replace("+", "").replace(" ", "").replace("-", "")
        if not nomor or not message_text:
            return super()._proses_pesan_masuk(sender_raw, message_text, media_url, push_name)

        first_reply_key = f"wa_ai_respons_awal_{nomor}"
        contact = Contact.objects.filter(nomor_wa=nomor).first()
        if not cache.get(first_reply_key) and not cache.get(f"wa_handover_{nomor}") and not (contact and contact.handover_to_staff):
            nama = (contact.nama if contact else "") or push_name
            simpan_ke_memori(nomor, "user", message_text, nama)
            jawaban = tanya_ai_finishing(nomor, nama)
            if jawaban:
                cache.set(first_reply_key, True, timeout=3600)
                simpan_ke_memori(nomor, "assistant", jawaban, nama)
                self._kirim_balas_async(nomor, jawaban)
                return jawaban, {"status": "processed", "route": "ai_initial"}, status.HTTP_200_OK

        return super()._proses_pesan_masuk(sender_raw, message_text, media_url, push_name)
