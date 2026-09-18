import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Eye, EyeOff, Loader2, Save, Zap } from 'lucide-react';
import apiClient from '../../../api/apiClient';

const inputCls =
  'w-full border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all bg-white';

const SUMBER_LABEL = {
  database: 'Tersimpan di database (override manual)',
  env: 'Dari environment variable server (belum pernah diubah lewat sini)',
  kosong: 'Belum diisi sama sekali',
};

/**
 * Tab "Koneksi AI" di Pengaturan WA Bot -- api key/base URL/model
 * KoboiLLM (dibaca wa_logic.get_ai_config_value(), SystemConfig dgn env
 * var sbg fallback, sama pola dgn Prompt AI). API key TIDAK PERNAH
 * dikirim balik apa adanya oleh backend (cuma versi masked) -- field
 * kosong saat submit = pertahankan key lama, isi baru = timpa.
 */
export default function WaBotAiCredentialsPanel() {
  const [cred, setCred] = useState(null);
  const [loading, setLoading] = useState(true);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [baseUrl, setBaseUrl] = useState('');
  const [model, setModel] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [msg, setMsg] = useState(null);

  const fetchCred = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/wa-bot-config/ai-credentials/');
      setCred(res.data);
      setBaseUrl(res.data.base_url || '');
      setModel(res.data.model || '');
    } catch {
      setMsg({ type: 'error', text: 'Gagal memuat kredensial AI.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCred(); }, []);

  const simpan = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const res = await apiClient.patch('/wa-bot-config/ai-credentials/', {
        api_key: apiKeyInput || undefined,
        base_url: baseUrl,
        model,
      });
      setCred(res.data);
      setApiKeyInput('');
      setMsg({ type: 'success', text: 'Kredensial AI tersimpan.' });
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.error || 'Gagal menyimpan kredensial.' });
    } finally {
      setSaving(false);
    }
  };

  const tesKoneksi = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await apiClient.post('/wa-bot-config/ai-credentials/test/', {
        api_key: apiKeyInput || undefined,
        base_url: baseUrl,
        model,
      });
      setTestResult(res.data);
    } catch (err) {
      setTestResult({ ok: false, detail: err.response?.data?.error || 'Gagal menjalankan tes.' });
    } finally {
      setTesting(false);
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
        <h4 className="font-bold text-slate-800 text-base">Koneksi AI (KoboiLLM)</h4>
        <p className="text-xs text-slate-400">
          API key, base URL, dan model yang dipakai bot memproses & membalas pesan pelanggan.
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

      <div className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-slate-700">API Key</label>
          <div className="relative">
            <input
              type={showApiKey ? 'text' : 'password'}
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              placeholder={cred?.api_key_masked || 'Masukkan API key baru...'}
              className={`${inputCls} pr-10 font-mono`}
            />
            <button
              type="button"
              onClick={() => setShowApiKey((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <p className="text-[11px] text-slate-400">
            {cred?.api_key_terisi
              ? `Saat ini: ${cred.api_key_masked} — ${SUMBER_LABEL[cred.api_key_sumber]}. Kosongkan field untuk tetap pakai key ini.`
              : 'Belum ada API key tersimpan.'}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Base URL</label>
            <input
              type="text"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://api.koboillm.com/v1"
              className={`${inputCls} font-mono text-xs`}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Model</label>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="openai/gpt-5.4-mini"
              className={`${inputCls} font-mono text-xs`}
            />
          </div>
        </div>
      </div>

      {testResult && (
        <div
          className={`flex items-start gap-2 px-4 py-3 rounded-xl text-sm font-medium border animate-fade-in
          ${testResult.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-rose-50 border-rose-200 text-rose-700'}`}
        >
          {testResult.ok ? <CheckCircle2 size={15} className="mt-0.5 shrink-0" /> : <AlertCircle size={15} className="mt-0.5 shrink-0" />}
          <div>
            <p>{testResult.detail}</p>
            {testResult.latency_ms != null && (
              <p className="text-[11px] opacity-70 mt-0.5">Waktu respons: {testResult.latency_ms}ms</p>
            )}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between pt-4 border-t border-slate-100">
        <button
          type="button"
          onClick={tesKoneksi}
          disabled={testing}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-all disabled:opacity-60 cursor-pointer"
        >
          {testing ? <Loader2 size={15} className="animate-spin" /> : <Zap size={15} />}
          Tes Koneksi
        </button>
        <button
          type="button"
          onClick={simpan}
          disabled={saving}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-all disabled:opacity-60 cursor-pointer shadow-sm"
        >
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
          Simpan
        </button>
      </div>
    </div>
  );
}
