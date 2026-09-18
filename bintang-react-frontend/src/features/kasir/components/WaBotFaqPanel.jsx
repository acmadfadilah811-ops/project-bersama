import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, Pencil, Plus, Save, Trash2, X } from 'lucide-react';
import apiClient from '../../../api/apiClient';

/**
 * Tab "FAQ" di Kasir > Pengaturan WA Bot -- daftar tanya-jawab resmi
 * (api.models.FAQ, sudah ada dari sebelumnya, cuma belum ada UI) yang
 * dicek AI tool "cek_faq" sebelum menjawab dari pengetahuan umum.
 *
 * FAQ.pertanyaan adalah PRIMARY KEY (bukan id auto-increment, desain
 * lama) -- supaya tidak salah "mengganti nama" baris lewat PATCH,
 * "pertanyaan" sengaja dibuat read-only setelah dibuat (ganti pertanyaan
 * = hapus + buat baru), hanya "jawaban" yang bisa diedit di tempat.
 */
export default function WaBotFaqPanel() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [pertanyaanBaru, setPertanyaanBaru] = useState('');
  const [jawabanBaru, setJawabanBaru] = useState('');
  const [adding, setAdding] = useState(false);
  const [editingKey, setEditingKey] = useState(null);
  const [draftJawaban, setDraftJawaban] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingKey, setDeletingKey] = useState(null);

  const fetchList = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/faq/');
      setList(Array.isArray(res.data) ? res.data : res.data?.results || []);
    } catch {
      setMsg({ type: 'error', text: 'Gagal memuat FAQ.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchList(); }, []);

  const tambahFaq = async (e) => {
    e.preventDefault();
    if (!pertanyaanBaru.trim() || !jawabanBaru.trim()) return;
    setAdding(true);
    setMsg(null);
    try {
      await apiClient.post('/faq/', { pertanyaan: pertanyaanBaru.trim(), jawaban: jawabanBaru.trim() });
      setPertanyaanBaru('');
      setJawabanBaru('');
      setShowAdd(false);
      setMsg({ type: 'success', text: 'FAQ baru ditambahkan.' });
      fetchList();
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.pertanyaan?.[0] || err.response?.data?.error || 'Gagal menambah FAQ.' });
    } finally {
      setAdding(false);
    }
  };

  const mulaiEdit = (faq) => {
    setEditingKey(faq.pertanyaan);
    setDraftJawaban(faq.jawaban);
  };

  const simpanEdit = async (pertanyaan) => {
    setSaving(true);
    setMsg(null);
    try {
      await apiClient.patch(`/faq/${encodeURIComponent(pertanyaan)}/`, { jawaban: draftJawaban });
      setEditingKey(null);
      setMsg({ type: 'success', text: 'Jawaban FAQ tersimpan.' });
      fetchList();
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.error || 'Gagal menyimpan jawaban.' });
    } finally {
      setSaving(false);
    }
  };

  const hapusFaq = async (pertanyaan) => {
    if (!window.confirm(`Hapus FAQ "${pertanyaan}"?`)) return;
    setDeletingKey(pertanyaan);
    setMsg(null);
    try {
      await apiClient.delete(`/faq/${encodeURIComponent(pertanyaan)}/`);
      setMsg({ type: 'success', text: 'FAQ dihapus.' });
      fetchList();
    } catch {
      setMsg({ type: 'error', text: 'Gagal menghapus FAQ.' });
    } finally {
      setDeletingKey(null);
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
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="font-bold text-slate-800 text-base">FAQ</h4>
          <p className="text-xs text-slate-400">
            Tanya-jawab resmi (jam buka, lokasi, kebijakan, dll) yang dicek AI tool "cek_faq" sebelum
            menjawab dari pengetahuan umum.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAdd((v) => !v)}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 cursor-pointer shrink-0"
        >
          <Plus size={14} /> Tambah FAQ
        </button>
      </div>

      {msg && (
        <div
          className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium border animate-fade-in
          ${msg.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-rose-50 border-rose-200 text-rose-700'}`}
        >
          {msg.type === 'success' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />} {msg.text}
        </div>
      )}

      {showAdd && (
        <form onSubmit={tambahFaq} className="border border-indigo-200 bg-indigo-50/40 rounded-xl p-4 space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-600 block">Pertanyaan</label>
            <input
              type="text"
              value={pertanyaanBaru}
              onChange={(e) => setPertanyaanBaru(e.target.value)}
              placeholder="Apakah bisa COD?"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 bg-white"
              required
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-600 block">Jawaban</label>
            <textarea
              rows={3}
              value={jawabanBaru}
              onChange={(e) => setJawabanBaru(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 bg-white"
              required
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="px-3 py-2 rounded-lg border border-slate-300 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={adding}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 disabled:opacity-50 cursor-pointer"
            >
              {adding ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Tambah
            </button>
          </div>
        </form>
      )}

      {list.length === 0 && !showAdd && (
        <p className="text-sm text-slate-400 text-center py-8">Belum ada FAQ. Klik "Tambah FAQ" untuk mulai.</p>
      )}

      <div className="space-y-2">
        {list.map((faq) => {
          const isEditing = editingKey === faq.pertanyaan;
          return (
            <div key={faq.pertanyaan} className="border border-slate-200 rounded-xl p-4 space-y-2">
              <p className="text-sm font-bold text-slate-800">{faq.pertanyaan}</p>
              {isEditing ? (
                <div className="space-y-2">
                  <textarea
                    rows={3}
                    value={draftJawaban}
                    onChange={(e) => setDraftJawaban(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 bg-white"
                    autoFocus
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingKey(null)}
                      className="p-1.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => simpanEdit(faq.pertanyaan)}
                      disabled={saving}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 disabled:opacity-50 cursor-pointer"
                    >
                      {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Simpan
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm text-slate-600 flex-1">{faq.jawaban}</p>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => mulaiEdit(faq)}
                      className="p-1.5 text-slate-400 hover:text-indigo-600 cursor-pointer"
                      title="Edit jawaban"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => hapusFaq(faq.pertanyaan)}
                      disabled={deletingKey === faq.pertanyaan}
                      className="p-1.5 text-slate-400 hover:text-rose-600 cursor-pointer disabled:opacity-50"
                      title="Hapus"
                    >
                      {deletingKey === faq.pertanyaan ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
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
