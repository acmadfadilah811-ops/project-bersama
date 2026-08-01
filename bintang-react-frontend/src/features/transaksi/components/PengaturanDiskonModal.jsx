import { useState, useEffect } from 'react';
import { X, Percent, DollarSign, Tag, Check, Loader2 } from 'lucide-react';
import apiClient from '../../../api/apiClient';

/**
 * Modal "Diskon" (Olsera Style) — mendukung 3 tipe diskon:
 * 1. % Diskon (Persen)
 * 2. $ Nominal (Potongan Rupiah)
 * 3. Kupon Diskon (Voucher / Promo Code)
 */
export default function PengaturanDiskonModal({ orderId, subtotal, currentPersen, onClose, onSaved }) {
  const [mode, setMode] = useState('persen'); // 'persen' | 'nominal' | 'kupon'
  const [persenInput, setPersenInput] = useState(String(currentPersen || 0));
  const [nominalInput, setNominalInput] = useState(
    subtotal > 0 ? String(Math.round((subtotal * (currentPersen || 0)) / 100)) : '0'
  );
  
  // Kupon state
  const [kuponKode, setKuponKode] = useState('');
  const [kuponApplied, setKuponApplied] = useState(null);
  const [availableCoupons, setAvailableCoupons] = useState([]);
  const [evaluatingKupon, setEvaluatingKupon] = useState(false);
  
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Load available coupons on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await apiClient.get('/discount-coupons/');
        const list = Array.isArray(res.data) ? res.data : (res.data?.results || []);
        setAvailableCoupons(list.filter((c) => c.is_active));
      } catch {
        setAvailableCoupons([]);
      }
    })();
  }, []);

  const handleEvaluateKupon = async (kodeToTest) => {
    const targetKode = (kodeToTest || kuponKode).trim();
    if (!targetKode) return setError('Masukkan kode kupon terlebih dahulu.');
    
    setEvaluatingKupon(true);
    setError('');
    try {
      const res = await apiClient.post('/discount-coupons/evaluate/', {
        kode: targetKode,
        subtotal: subtotal
      });
      if (res.data?.ok) {
        setKuponApplied(res.data);
        setKuponKode(targetKode);
        setError('');
      } else {
        setKuponApplied(null);
        setError(res.data?.alasan || 'Kupon tidak berlaku.');
      }
    } catch (err) {
      setKuponApplied(null);
      setError(err.response?.data?.alasan || err.response?.data?.error || 'Kupon tidak valid atau syarat belum terpenuhi.');
    } finally {
      setEvaluatingKupon(false);
    }
  };

  // Calculate effective discount percentage based on active mode
  let effectivePersen = 0;
  if (mode === 'persen') {
    effectivePersen = Math.min(100, Math.max(0, Number(persenInput) || 0));
  } else if (mode === 'nominal') {
    const nom = Number(nominalInput) || 0;
    effectivePersen = subtotal > 0 ? Math.min(100, Math.max(0, (nom / subtotal) * 100)) : 0;
  } else if (mode === 'kupon') {
    if (kuponApplied) {
      const discVal = Number(kuponApplied.nilai_diskon) || Number(kuponApplied.kupon?.jumlah_diskon) || 0;
      effectivePersen = subtotal > 0 ? Math.min(100, Math.max(0, (discVal / subtotal) * 100)) : 0;
    }
  }

  const potonganPreview = Math.round(subtotal * (effectivePersen / 100));

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      if (mode === 'kupon') {
        if (!kuponKode.trim()) {
          setError('Pilih atau masukkan kode kupon terlebih dahulu.');
          setSaving(false);
          return;
        }
        await apiClient.patch(`/orders/${orderId}/`, {
          diskon_persen: effectivePersen,
          kupon_kode: kuponKode.trim(),
          metode_diskon: 'kupon'
        });
      } else {
        await apiClient.patch(`/orders/${orderId}/`, {
          diskon_persen: effectivePersen,
          kupon_kode: null,
          metode_diskon: 'persen'
        });
      }
      onSaved?.();
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.detail || 'Gagal menyimpan diskon.');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    setSaving(true);
    setError('');
    try {
      await apiClient.patch(`/orders/${orderId}/`, {
        diskon_persen: 0,
        kupon_kode: null,
        metode_diskon: 'persen'
      });
      onSaved?.();
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.detail || 'Gagal menghapus diskon.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100">
        
        {/* Header - Title & Close */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="font-bold text-slate-800 text-lg">Diskon</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 rounded-full p-1.5 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Subtext */}
          <div>
            <h4 className="text-base font-semibold text-slate-800">Masukkan Diskon</h4>
            <p className="text-xs text-slate-400 mt-1">
              Pesanan hanya dapat menggunakan satu tipe diskon, persen, potongan atau kupon saja
            </p>
          </div>

          {/* Segmented Button Tabs (Olsera Style) */}
          <div className="grid grid-cols-3 gap-0 border border-slate-200 rounded-xl overflow-hidden text-xs font-bold p-1 bg-slate-50/50">
            <button
              type="button"
              onClick={() => { setMode('persen'); setError(''); }}
              className={`flex items-center justify-center gap-1.5 py-2.5 rounded-lg cursor-pointer transition-all ${
                mode === 'persen'
                  ? 'bg-blue-500 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <Percent size={14} /> % Diskon
            </button>
            <button
              type="button"
              onClick={() => { setMode('nominal'); setError(''); }}
              className={`flex items-center justify-center gap-1.5 py-2.5 rounded-lg cursor-pointer transition-all ${
                mode === 'nominal'
                  ? 'bg-blue-500 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <DollarSign size={14} /> Nominal
            </button>
            <button
              type="button"
              onClick={() => { setMode('kupon'); setError(''); }}
              className={`flex items-center justify-center gap-1.5 py-2.5 rounded-lg cursor-pointer transition-all ${
                mode === 'kupon'
                  ? 'bg-blue-500 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <Tag size={14} /> Kupon Diskon
            </button>
          </div>

          {/* Input Box per Mode */}
          {mode === 'persen' && (
            <div className="flex items-center border border-slate-300 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-blue-100 focus-within:border-blue-400">
              <input
                type="number"
                min="0"
                max="100"
                value={persenInput}
                onChange={(e) => setPersenInput(e.target.value)}
                placeholder="0"
                className="flex-1 px-4 py-2.5 text-sm font-semibold text-slate-800 outline-none placeholder:text-slate-300"
              />
              <span className="px-4 py-2.5 bg-slate-50 text-slate-500 text-xs font-bold border-l border-slate-200">
                %
              </span>
            </div>
          )}

          {mode === 'nominal' && (
            <div className="flex items-center border border-slate-300 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-blue-100 focus-within:border-blue-400">
              <input
                type="number"
                min="0"
                value={nominalInput}
                onChange={(e) => setNominalInput(e.target.value)}
                placeholder="0"
                className="flex-1 px-4 py-2.5 text-sm font-semibold text-slate-800 outline-none placeholder:text-slate-300 font-mono"
              />
              <span className="px-4 py-2.5 bg-slate-50 text-slate-500 text-xs font-bold border-l border-slate-200">
                IDR
              </span>
            </div>
          )}

          {mode === 'kupon' && (
            <div className="space-y-3">
              <div className="flex items-center border border-slate-300 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-blue-100 focus-within:border-blue-400">
                <input
                  type="text"
                  value={kuponKode}
                  onChange={(e) => setKuponKode(e.target.value.toUpperCase())}
                  placeholder="Masukkan Kode Kupon (mis. HEMAT10)"
                  className="flex-1 px-4 py-2.5 text-sm font-semibold text-slate-800 uppercase outline-none placeholder:text-slate-300 placeholder:normal-case font-mono"
                />
                <button
                  type="button"
                  disabled={evaluatingKupon}
                  onClick={() => handleEvaluateKupon()}
                  className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold border-l border-blue-600 transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1"
                >
                  {evaluatingKupon ? <Loader2 size={13} className="animate-spin" /> : 'Gunakan'}
                </button>
              </div>

              {/* Status Kupon Terpasang */}
              {kuponApplied && (
                <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-medium">
                  <div className="flex items-center gap-2">
                    <Check size={14} className="text-emerald-600" />
                    <span>
                      Kupon <strong>{kuponApplied.kupon?.kode || kuponKode}</strong> aktif! Potongan Rp{' '}
                      {Number(kuponApplied.nilai_diskon || 0).toLocaleString('id-ID')}
                    </span>
                  </div>
                </div>
              )}

              {/* Rekomendasi Kupon Aktif */}
              {availableCoupons.length > 0 && (
                <div>
                  <span className="text-[11px] font-bold text-slate-400 block mb-1.5">Kupon Tersedia:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {availableCoupons.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => handleEvaluateKupon(c.kode)}
                        className={`text-xs px-2.5 py-1 rounded-lg border font-mono transition-all cursor-pointer ${
                          kuponKode === c.kode
                            ? 'bg-blue-50 border-blue-300 text-blue-700 font-bold'
                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        🏷️ {c.kode} ({c.tipe_diskon === 'persen' ? `${c.jumlah_diskon}%` : `Rp ${Number(c.jumlah_diskon).toLocaleString('id-ID')}`})
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Ringkasan Potongan */}
          <div className="text-xs text-slate-500 pt-1">
            Subtotal Rp {subtotal.toLocaleString('id-ID')} → potongan{' '}
            <span className="font-bold text-slate-800">Rp {potonganPreview.toLocaleString('id-ID')}</span>{' '}
            <span className="text-slate-400">({effectivePersen.toFixed(2)}%)</span>
          </div>

          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-700 font-medium">
              {error}
            </div>
          )}
        </div>

        {/* Footer Actions - Olsera Style (Hapus merah, Simpan hijau) */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50">
          <button
            type="button"
            disabled={saving}
            onClick={handleRemove}
            className="text-xs font-bold text-rose-600 hover:text-rose-700 px-3 py-2 cursor-pointer disabled:opacity-40 transition-colors"
          >
            Hapus
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="text-xs font-bold rounded-lg px-6 py-2.5 bg-[#5CB85C] hover:bg-[#4cae4c] text-white shadow-xs cursor-pointer disabled:opacity-60 transition-colors"
          >
            {saving ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>

      </div>
    </div>
  );
}
