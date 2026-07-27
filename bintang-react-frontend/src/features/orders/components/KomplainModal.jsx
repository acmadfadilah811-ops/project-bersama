import { useState, useEffect } from 'react';
import { X, AlertTriangle, MessageCircle, Save, CheckCircle2 } from 'lucide-react';
import apiClient from '../../../api/apiClient';

export default function KomplainModal({ isOpen, onClose, order, onSuccess, defaultFotoBukti = '' }) {
  const [formData, setFormData] = useState({
    jenis_komplain: '',
    deskripsi: '',
    foto_bukti: defaultFotoBukti,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (isOpen) {
      setFormData({
        jenis_komplain: '',
        deskripsi: '',
        foto_bukti: defaultFotoBukti || '',
      });
      setError('');
      setSuccess('');
    }
  }, [isOpen, defaultFotoBukti]);

  if (!isOpen || !order) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    if (!formData.jenis_komplain || !formData.deskripsi) {
      setError('Jenis komplain dan deskripsi wajib diisi.');
      return;
    }
    
    setLoading(true);
    try {
      await apiClient.post('/komplain/', {
        order: order.id,
        jenis_komplain: formData.jenis_komplain,
        deskripsi: formData.deskripsi,
        foto_bukti: formData.foto_bukti
      });
      setSuccess('Komplain berhasil dicatat!');
      setTimeout(() => {
        onSuccess();
      }, 1500);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || 'Gagal membuat komplain. Silakan coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-rose-50/50">
          <h2 className="font-black text-rose-700 flex items-center gap-2">
            <AlertTriangle size={20} className="text-rose-600" />
            Catat Komplain Pelanggan
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 bg-white rounded-full p-1 shadow-sm border border-slate-200">
            <X size={18} />
          </button>
        </div>
        
        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-semibold flex items-center gap-2 animate-[slideDown_0.2s_ease-out]">
              <AlertTriangle size={14} className="shrink-0 text-rose-500" />
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-xs font-semibold flex items-center gap-2 animate-[slideDown_0.2s_ease-out]">
              <CheckCircle2 size={14} className="shrink-0 text-emerald-500 animate-pulse" />
              <span>{success}</span>
            </div>
          )}

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col gap-2.5">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 bg-white rounded-lg shadow-sm border border-slate-200 text-xs font-black text-slate-800 font-mono">
                Order #{order.id}
              </span>
            </div>
            <div>
              <p className="font-bold text-slate-800 text-sm">{order.nama}</p>
              <p className="text-xs text-slate-500 font-mono mt-0.5">{order.nomor_wa}</p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Jenis Masalah *</label>
            <select 
              value={formData.jenis_komplain}
              onChange={e => setFormData({...formData, jenis_komplain: e.target.value})}
              required
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-rose-500 outline-none font-medium"
            >
              <option value="">-- Pilih Jenis Komplain --</option>
              <option value="salah_ukuran">Salah Ukuran</option>
              <option value="warna_pudar">Warna Pudar / Buram</option>
              <option value="salah_desain">Salah Desain / File</option>
              <option value="sobek_rusak">Sobek / Rusak Saat Produksi</option>
              <option value="pemasangan">Masalah Pemasangan</option>
              <option value="lainnya">Lainnya</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Deskripsi Detail *</label>
            <textarea
              required
              value={formData.deskripsi}
              onChange={e => setFormData({...formData, deskripsi: e.target.value})}
              placeholder="Jelaskan secara spesifik apa yang dikeluhkan oleh pelanggan..."
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-rose-500 outline-none min-h-[100px]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Link Bukti Foto/Video (Opsional)</label>
            <input
              type="url"
              value={formData.foto_bukti}
              onChange={e => setFormData({...formData, foto_bukti: e.target.value})}
              placeholder="https://gdrive..."
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-rose-500 outline-none"
            />
            <p className="text-[10px] text-slate-400 mt-1">Masukkan URL foto atau folder Google Drive yang berisi bukti kerusakan.</p>
          </div>

          <div className="pt-2 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors text-sm border border-slate-200"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors text-sm shadow-md shadow-rose-200 disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? 'Menyimpan...' : (
                <>
                  <Save size={16} /> Buat Komplain
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
