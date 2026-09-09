import os
import logging
import requests

logger = logging.getLogger(__name__)


class FrappeClient:
    """
    Client REST API Frappe -- pola sama dengan EvolutionAPIClient
    (api/whatsapp_client.py): base_url/key/secret dari environment variable,
    dengan flag disable eksplisit supaya sync produk (fase 1, 2026-09-09)
    tidak pernah memblokir alur utama kalau server Frappe sedang down atau
    belum dikonfigurasi.
    """

    def __init__(self):
        self.base_url = os.getenv("FRAPPE_API_URL", "http://localhost:8085").rstrip("/")
        self.api_key = os.getenv("FRAPPE_API_KEY", "")
        self.api_secret = os.getenv("FRAPPE_API_SECRET", "")
        self.disabled = os.getenv("DISABLE_FRAPPE_SYNC", "false").lower() == "true"
        self.timeout = 15

    @property
    def headers(self):
        return {
            "Content-Type": "application/json",
            "Authorization": f"token {self.api_key}:{self.api_secret}",
        }

    def is_configured(self):
        return bool(self.api_key and self.api_secret) and not self.disabled

    def get_item(self, item_code):
        """Ambil Item Frappe kalau ada. None kalau belum ada (404).
        Melempar requests.RequestException untuk error lain (network/5xx/auth)."""
        res = requests.get(
            f"{self.base_url}/api/resource/Item/{item_code}",
            headers=self.headers, timeout=self.timeout,
        )
        if res.status_code == 404:
            return None
        res.raise_for_status()
        return res.json().get("data")

    def upsert_item(self, item_code, payload):
        """Buat Item baru kalau belum ada di Frappe, update kalau sudah ada.
        Mengembalikan data Item hasil Frappe (dict). Error dibiarkan naik
        (requests.RequestException/RuntimeError) supaya caller (management
        command) bisa mencatat kegagalan per produk, bukan diam-diam hilang."""
        if not self.is_configured():
            raise RuntimeError(
                "FrappeClient belum dikonfigurasi (FRAPPE_API_KEY/FRAPPE_API_SECRET "
                "kosong) atau DISABLE_FRAPPE_SYNC=true."
            )

        existing = self.get_item(item_code)
        if existing:
            res = requests.put(
                f"{self.base_url}/api/resource/Item/{item_code}",
                headers=self.headers, json=payload, timeout=self.timeout,
            )
        else:
            res = requests.post(
                f"{self.base_url}/api/resource/Item",
                headers=self.headers, json={**payload, "item_code": item_code}, timeout=self.timeout,
            )
        res.raise_for_status()
        return res.json().get("data")
