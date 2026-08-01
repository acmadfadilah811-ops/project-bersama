import { useState } from 'react';
import { X } from 'lucide-react';
import apiClient from '../../../api/apiClient';

/**
 * "Pengaturan Pembayaran" — memanggil POST /orders/{id}/bayar/, endpoint yang
 * sama dipakai modal "Bayar" di Penjualan.jsx (idempotent, atomic, sudah
 * memposting jurnal via T-202/order_posting.py). `referensi_pembayaran`
 * (migration 0089) dikirim & disimpan lewat endpoint yang sama.
 */
export default function PengaturanPembayaranModal({ orderId, sisaTagihan, onClose, onSaved }) {
  const [tanggal] = useState(new Date().toISOString().slice(0, 10));
  const [metode, setMetode] = useState('tunai');
  const [referensi, setReferensi] = useState('');
  const [jumlah, setJumlah] = useState(String(sisaTagihan || 0));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    const nominal = Number(jumlah);
    if (!nominal || nominal <= 0) {
      setError('Total pembayaran harus lebih besar dari 0.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await apiClient.post(`/orders/${orderId}/bayar/`, {
        jumlah_bayar: Math.round(nominal),
        metode_pembayaran: metode,
        referensi_pembayaran: referensi.trim(),
      });
      onSaved?.();
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.detail || 'Gagal menyimpan pembayaran.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="font-bold text-slate-800 text-lg">Pembayaran</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 rounded-full p-1 hover:bg-slate-50 cursor-pointer">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-500 block mb-1.5">Tanggal Pembayaran</label>
            <input
              type="date"
              value={tanggal}
              disabled
              title="Pembayaran selalu tercatat pada waktu aksi ini dijalankan"
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 text-slate-500 cursor-not-allowed"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500 block mb-1.5">Cara Pembayaran</label>
            <select
              value={metode}
              onChange={(e) => setMetode(e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white outline-none focus:border-blue-300 cursor-pointer"
            >
              <option value="tunai">Tunai</option>
              <option value="transfer">Bank Transfer</option>
              <option value="qris">QRIS / E-Wallet</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500 block mb-1.5">Referensi Pembayaran</label>
            <input
              type="text"
              value={referensi}
              onChange={(e) => setReferensi(e.target.value)}
              placeholder="Referensi pembayaran dari Paypal/Bank"
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white outline-none focus:border-blue-300"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1.5">Mata Uang</label>
              <select disabled className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 text-slate-500 bg-slate-50 cursor-not-allowed">
                <option>Rupiah</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1.5">Total Pembayaran</label>
              <input
                type="number"
                min="1"
                value={jumlah}
                onChange={(e) => setJumlah(e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white outline-none focus:border-blue-300 font-mono"
              />
            </div>
          </div>
          <p className="text-[11px] text-slate-400">Sisa tagihan saat ini: Rp {(sisaTagihan || 0).toLocaleString('id-ID')}</p>

          {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700">{error}</div>}
        </div>

        <div className="flex items-center justify-center gap-3 px-6 py-4 border-t border-slate-100">
          <button type="button" onClick={onClose} className="text-sm font-semibold text-slate-600 border border-slate-200 rounded-lg px-6 py-2 hover:bg-slate-50 cursor-pointer">
            Batal
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="text-sm font-semibold rounded-lg px-6 py-2 bg-emerald-500 text-white hover:bg-emerald-600 cursor-pointer shadow-sm disabled:opacity-60"
          >
            {saving ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </div>
    </div>
  );
}
