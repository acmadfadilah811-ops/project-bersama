import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Save } from 'lucide-react';
import apiClient from '../../../api/apiClient';

/**
 * Tab "Prompt AI" di Kasir > Pengaturan WA Bot -- edit
 * SystemConfig['system_prompt'] (persona/nada bicara/aturan bisnis),
 * dibaca wa_logic.get_system_prompt(). Instruksi cara pakai tools
 * (daftar_kategori_produk dkk) TIDAK di sini -- itu ditambahkan otomatis
 * oleh backend di belakang prompt ini, supaya tetap selaras dgn tools
 * yang benar-benar tersedia (lihat tab Tools).
 */
export default function WaBotPromptPanel() {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiClient.get('/wa-bot-config/prompt/');
        setPrompt(res.data.prompt || '');
      } catch {
        setMsg({ type: 'error', text: 'Gagal memuat prompt.' });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const simpan = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const res = await apiClient.patch('/wa-bot-config/prompt/', { prompt });
      setPrompt(res.data.prompt);
      setMsg({ type: 'success', text: 'Prompt AI tersimpan.' });
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.error || 'Gagal menyimpan prompt.' });
    } finally {
      setSaving(false);
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
        <h4 className="font-bold text-slate-800 text-base">Prompt AI</h4>
        <p className="text-xs text-slate-400">
          Persona, nada bicara, & aturan bisnis yang dipakai AI membalas pelanggan lewat WhatsApp.
          Instruksi teknis pemakaian tools (harga, status pesanan, dll) otomatis ditambahkan sistem
          di belakang prompt ini, tidak perlu ditulis manual.
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

      <textarea
        rows={18}
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Kamu adalah asisten virtual ..."
        className="w-full border border-slate-300 rounded-lg px-3.5 py-3 text-sm text-slate-800 font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all bg-white"
      />

      <div className="flex justify-end pt-4 border-t border-slate-100">
        <button
          type="button"
          onClick={simpan}
          disabled={saving}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-all disabled:opacity-60 cursor-pointer shadow-sm"
        >
          {saving ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Save size={15} />
          )}
          Simpan Prompt
        </button>
      </div>
    </div>
  );
}
