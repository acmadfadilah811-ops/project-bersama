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
