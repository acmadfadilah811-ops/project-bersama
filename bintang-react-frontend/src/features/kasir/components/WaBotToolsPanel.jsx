import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, ChevronDown, ChevronUp, Save } from 'lucide-react';
import apiClient from '../../../api/apiClient';

/**
 * Tab "Tools" di Kasir > Pengaturan WA Bot -- aktif/nonaktifkan & edit
 * deskripsi (dilihat AI, bukan pelanggan) tiap 1 dari 9 tools yang bisa
 * dipanggil AI (api/services/wa_ai_tools.py TOOL_SCHEMAS). Parameter tool
 * TIDAK bisa diedit di sini (harus persis cocok kode Python).
 */
export default function WaBotToolsPanel() {
  const [tools, setTools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [savingNama, setSavingNama] = useState(null);
  const [msg, setMsg] = useState(null);
  const [draftDeskripsi, setDraftDeskripsi] = useState({});

  const fetchTools = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/wa-bot-config/tools/');
      setTools(res.data.tools || []);
      const draft = {};
      (res.data.tools || []).forEach((t) => { draft[t.nama] = t.deskripsi; });
      setDraftDeskripsi(draft);
    } catch {
      setMsg({ type: 'error', text: 'Gagal memuat daftar tools.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTools(); }, []);

  const toggleAktif = async (tool) => {
    setSavingNama(tool.nama);
    setMsg(null);
    try {
      const res = await apiClient.patch(`/wa-bot-config/tools/${tool.nama}/`, {
        aktif: !tool.aktif,
        deskripsi: draftDeskripsi[tool.nama],
      });
      setTools((list) => list.map((t) => (t.nama === tool.nama ? res.data : t)));
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.error || 'Gagal mengubah status tool.' });
    } finally {
      setSavingNama(null);
    }
  };

  const simpanDeskripsi = async (tool) => {
    setSavingNama(tool.nama);
    setMsg(null);
    try {
      const res = await apiClient.patch(`/wa-bot-config/tools/${tool.nama}/`, {
        aktif: tool.aktif,
        deskripsi: draftDeskripsi[tool.nama],
      });
      setTools((list) => list.map((t) => (t.nama === tool.nama ? res.data : t)));
      setMsg({ type: 'success', text: `Deskripsi tool "${tool.nama}" tersimpan.` });
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.error || 'Gagal menyimpan deskripsi.' });
    } finally {
      setSavingNama(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h4 className="font-bold text-slate-800 text-base">Tools AI</h4>
        <p className="text-xs text-slate-400">
          Kemampuan yang bisa dipanggil AI utk mengakses data asli Bintang (harga, status pesanan,
          buat draft pesanan, dll). Nonaktifkan tool kalau tidak ingin AI memakainya sama sekali --
          hati-hati, tool yang dinonaktifkan membuat AI tidak bisa lagi menjawab hal terkait (mis.
          nonaktifkan "cek_status_pesanan" berarti AI tidak akan bisa cek status pesanan lagi).
        </p>
      </div>

      {msg && (
        <div
          className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium border animate-fade-in
          ${msg.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-rose-50 border-rose-200 text-rose-700'}`}
        >
          {msg.type === 'success' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />} {msg.text}
        </div>
      )}

      <div className="space-y-2">
        {tools.map((t) => {
          const isOpen = expanded === t.nama;
          const isSaving = savingNama === t.nama;
          return (
            <div key={t.nama} className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3 bg-white">
                <button
                  type="button"
                  onClick={() => toggleAktif(t)}
                  disabled={isSaving}
                  className={`relative w-10 h-5.5 rounded-full transition-colors shrink-0 cursor-pointer disabled:opacity-50
                    ${t.aktif ? 'bg-emerald-500' : 'bg-slate-300'}`}
                  title={t.aktif ? 'Aktif -- klik utk nonaktifkan' : 'Nonaktif -- klik utk aktifkan'}
                >
                  <span
                    className={`absolute top-0.5 w-4.5 h-4.5 bg-white rounded-full shadow transition-transform
                      ${t.aktif ? 'translate-x-[19px]' : 'translate-x-0.5'}`}
                  />
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-800 font-mono">{t.nama}</p>
                  <p className="text-[11px] text-slate-400 truncate">{t.deskripsi}</p>
                </div>
                <span
                  className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full shrink-0
                    ${t.aktif ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}
                >
                  {t.aktif ? 'Aktif' : 'Nonaktif'}
                </span>
                <button
                  type="button"
                  onClick={() => setExpanded(isOpen ? null : t.nama)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 cursor-pointer shrink-0"
                >
                  {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
              </div>

              {isOpen && (
                <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/60 space-y-2">
                  <label className="text-xs font-bold text-slate-500 block">
                    Deskripsi (dilihat AI, bukan pelanggan)
                  </label>
                  <textarea
                    rows={3}
                    value={draftDeskripsi[t.nama] ?? ''}
                    onChange={(e) => setDraftDeskripsi((d) => ({ ...d, [t.nama]: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 bg-white"
                  />
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setDraftDeskripsi((d) => ({ ...d, [t.nama]: t.deskripsi_default }))}
                      className="text-[11px] font-semibold text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      Kembalikan ke deskripsi bawaan
                    </button>
                    <button
                      type="button"
                      onClick={() => simpanDeskripsi(t)}
                      disabled={isSaving}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 disabled:opacity-50 cursor-pointer"
                    >
                      {isSaving ? (
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Save size={12} />
                      )}
                      Simpan Deskripsi
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
