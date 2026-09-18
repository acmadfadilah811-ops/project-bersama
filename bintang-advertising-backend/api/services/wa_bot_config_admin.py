"""CRUD admin utk prompt & tools bot WA AI (dipakai halaman Kasir >
Pengaturan WA Bot, permintaan user 2026-09-18 -- pengganti rencana pakai
AI Agent ChatbotX, karena "otak" AI sudah native di sini lewat
wa_logic.proses_dengan_ai_agent()/get_system_prompt()).

Prompt: SystemConfig 'system_prompt' -- sudah dibaca get_system_prompt()
di wa_logic.py SEBELUM modul ini ada (fallback default kalau belum
diisi), jadi modul ini cuma menambah jalur baca/tulis lewat API,
TIDAK mengubah cara wa_logic.py membacanya.

Tools: TOOL_SCHEMAS (wa_ai_tools.py) TETAP sumber definisi nama/
parameter/deskripsi DEFAULT tiap tool (parameter tidak bisa diedit
lewat sini -- harus persis cocok dgn fungsi Python-nya). Yang bisa
diubah admin: aktif/nonaktif tiap tool & override teks deskripsi
(dilihat AI, bukan pelanggan). Override disimpan di SystemConfig
'wa_tools_config' sbg dict {nama_tool: {"aktif": bool, "deskripsi":
str|null}} -- entry yg tidak ada = pakai default (aktif, deskripsi
asli). get_active_tool_schemas() dipanggil wa_logic.py saat runtime
tiap giliran AI (ganti pemakaian TOOL_SCHEMAS mentah)."""
import copy
import json

from ..models import SystemConfig
from .wa_ai_tools import TOOL_SCHEMAS

_NAMA_TOOL_VALID = {t['function']['name'] for t in TOOL_SCHEMAS}


class WaBotConfigError(Exception):
    pass


def get_prompt():
    """Prompt yang BENAR-BENAR efektif dipakai bot sekarang -- kalau admin
    belum pernah menyimpan override, kembalikan template default yang
    sama persis dgn fallback wa_logic.get_system_prompt() (bukan string
    kosong), supaya halaman admin tidak kelihatan kosong padahal bot
    tetap jalan pakai template itu."""
    try:
        return SystemConfig.objects.get(key='system_prompt').value
    except SystemConfig.DoesNotExist:
        from ..wa_logic import default_system_prompt
        return default_system_prompt()


# ── Kredensial AI (api key/base url/model) -- SystemConfig dgn env var
# sbg fallback, sama pola dgn prompt. Lihat wa_logic.get_ai_config_value().
_AI_CFG_KEYS = {
    'api_key': ('ai_koboi_api_key', 'KOBOI_API_KEY', None),
    'base_url': ('ai_koboi_base_url', 'KOBOI_BASE_URL', 'https://api.koboillm.com/v1'),
    'model': ('ai_koboi_model', 'KOBOI_MODEL', 'gemini-2.5-pro'),
}


def _mask_api_key(nilai):
    if not nilai:
        return None
    if len(nilai) <= 8:
        return '•' * len(nilai)
    return f"{'•' * (len(nilai) - 4)}{nilai[-4:]}"


def get_ai_credentials():
    from ..wa_logic import get_ai_config_value
    api_key = get_ai_config_value(*_AI_CFG_KEYS['api_key'])
    base_url = get_ai_config_value(*_AI_CFG_KEYS['base_url'])
    model = get_ai_config_value(*_AI_CFG_KEYS['model'])
    api_key_dari_db = SystemConfig.objects.filter(key='ai_koboi_api_key').exclude(value='').exists()
    return {
        'api_key_terisi': bool(api_key),
        'api_key_masked': _mask_api_key(api_key),
        'api_key_sumber': 'database' if api_key_dari_db else ('env' if api_key else 'kosong'),
        'base_url': base_url,
        'model': model,
    }


def update_ai_credentials(api_key=None, base_url=None, model=None):
    """Cuma update field yang dikirim TIDAK KOSONG -- kirim api_key kosong/
    tidak dikirim = pertahankan key yang sudah tersimpan (form frontend
    tidak pernah menampilkan key asli, cuma versi masked, jadi tidak boleh
    menimpa dgn string kosong kalau admin cuma ganti base_url/model)."""
    if api_key:
        SystemConfig.objects.update_or_create(key='ai_koboi_api_key', defaults={'value': api_key.strip()})
    if base_url:
        SystemConfig.objects.update_or_create(key='ai_koboi_base_url', defaults={'value': base_url.strip()})
    if model:
        SystemConfig.objects.update_or_create(key='ai_koboi_model', defaults={'value': model.strip()})
    return get_ai_credentials()


def test_ai_connection(api_key=None, base_url=None, model=None):
    """Tes koneksi NYATA (bukan cuma cek field terisi) -- panggilan chat
    completion minimal, dgn nilai dari FORM (belum tentu sudah disimpan)
    kalau dikasih, fallback ke yang sudah tersimpan/env kalau tidak.
    Dipakai tombol "Tes Koneksi" sebelum admin klik Simpan, supaya kredensial
    salah ketahuan sebelum menimpa yang lama."""
    import time

    from openai import OpenAI

    from ..wa_logic import get_ai_config_value

    api_key = (api_key or '').strip() or get_ai_config_value(*_AI_CFG_KEYS['api_key'])
    base_url = (base_url or '').strip() or get_ai_config_value(*_AI_CFG_KEYS['base_url'])
    model = (model or '').strip() or get_ai_config_value(*_AI_CFG_KEYS['model'])

    if not api_key:
        return {'ok': False, 'detail': 'API key belum diisi.', 'latency_ms': None}

    if "koboillm" in (base_url or '').lower() and not api_key.startswith("sk-"):
        api_key = f"sk-{api_key}"

    mulai = time.monotonic()
    try:
        client = OpenAI(api_key=api_key, base_url=base_url, timeout=15.0)
        client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": "test"}],
            max_tokens=5,
            timeout=15.0,
        )
        latency_ms = round((time.monotonic() - mulai) * 1000)
        return {'ok': True, 'detail': f"Berhasil terhubung ke model '{model}'.", 'latency_ms': latency_ms}
    except Exception as e:
        latency_ms = round((time.monotonic() - mulai) * 1000)
        return {'ok': False, 'detail': str(e), 'latency_ms': latency_ms}


def update_prompt(value):
    value = (value or '').strip()
    if not value:
        raise WaBotConfigError('Prompt tidak boleh kosong.')
    SystemConfig.objects.update_or_create(key='system_prompt', defaults={'value': value})
    return value


def _load_tools_config():
    try:
        return json.loads(SystemConfig.objects.get(key='wa_tools_config').value)
    except SystemConfig.DoesNotExist:
        return {}


def get_semua_tools():
    """Daftar 9 tools (urutan sama dgn TOOL_SCHEMAS) + status aktif &
    deskripsi efektif (override kalau ada, default kalau tidak)."""
    override_map = _load_tools_config()
    hasil = []
    for t in TOOL_SCHEMAS:
        nama = t['function']['name']
        override = override_map.get(nama, {})
        hasil.append({
            'nama': nama,
            'deskripsi_default': t['function']['description'],
            'deskripsi': override.get('deskripsi') or t['function']['description'],
            'aktif': override.get('aktif', True),
            'parameter': t['function'].get('parameters', {}),
        })
    return hasil


def update_tool(nama, aktif, deskripsi):
    if nama not in _NAMA_TOOL_VALID:
        raise WaBotConfigError(f"Tool '{nama}' tidak dikenal.")
    override_map = _load_tools_config()
    deskripsi = (deskripsi or '').strip()
    default_desc = next(t['function']['description'] for t in TOOL_SCHEMAS if t['function']['name'] == nama)
    entry = {'aktif': bool(aktif)}
    # Simpan override deskripsi HANYA kalau beda dari default -- biar
    # config tetap ringkas & default tetap ikut ke-update otomatis kalau
    # TOOL_SCHEMAS diubah lewat kode nanti.
    if deskripsi and deskripsi != default_desc:
        entry['deskripsi'] = deskripsi
    override_map[nama] = entry
    SystemConfig.objects.update_or_create(
        key='wa_tools_config', defaults={'value': json.dumps(override_map, ensure_ascii=False)},
    )
    return next(t for t in get_semua_tools() if t['nama'] == nama)


def get_active_tool_schemas():
    """Dipanggil wa_logic.py saat runtime -- TOOL_SCHEMAS asli, tapi tool
    nonaktif dibuang & deskripsi override diterapkan. TIDAK menyentuh
    `parameters` (harus tetap persis cocok dgn fungsi Python)."""
    override_map = _load_tools_config()
    hasil = []
    for t in TOOL_SCHEMAS:
        nama = t['function']['name']
        override = override_map.get(nama, {})
        if override.get('aktif', True) is False:
            continue
        if override.get('deskripsi'):
            t = copy.deepcopy(t)
            t['function']['description'] = override['deskripsi']
        hasil.append(t)
    return hasil
