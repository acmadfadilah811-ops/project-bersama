import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Calendar, Loader2, Save } from 'lucide-react';
import apiClient from '../../../../api/apiClient';
import { notify, notifyApiError } from '../../../../utils/notify';
import { formatOrderReference } from '../../../transaksi/components/orderReference';

const fmtRp = (value) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`;
const fmtDate = (value) => value ? new Date(value).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }) : '-';

export default function ReturPenjualanDetail({ orderId, returnId, onBack, onSaved }) {
  const [order, setOrder] = useState(null);
  const [retur, setRetur] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiClient.get(`/orders/${orderId}/`);
      const data = response.data;
      const selected = data.daftar_pengembalian?.find((item) => item.id === returnId)
        || data.pengembalian_aktif;
      setOrder(data);
      setRetur(selected || null);
    } catch (error) {
      notifyApiError(error, 'Gagal memuat detail return penjualan.');
    } finally {
      setLoading(false);
    }
  }, [orderId, returnId]);

  useEffect(() => { fetchDetail(); }, [fetchDetail]);

  const handleSave = async (event) => {
    event.preventDefault();
    if (!retur) return;
    setSaving(true);
    try {
      await apiClient.patch(`/pengembalian/${retur.id}/`, {
        tanggal_pengembalian: retur.tanggal_pengembalian,
        status: retur.status,
        catatan: retur.catatan || '',
      });
      notify({ type: 'success', title: 'Return diperbarui', message: 'Detail return penjualan berhasil disimpan.' });
      await fetchDetail();
      onSaved?.();
    } catch (error) {
      notifyApiError(error, 'Gagal menyimpan detail return penjualan.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-xs font-bold text-slate-400"><Loader2 className="inline animate-spin" size={16} /> Memuat detail...</div>;
  if (!order || !retur) return <div className="p-8 text-center text-xs font-bold text-rose-500">Detail return tidak ditemukan.</div>;

  const isLocked = retur.status === 'Dikonfirmasi' || retur.status === 'Batal';

  return (
    <div className="space-y-4 animate-fade-in text-xs font-semibold text-slate-700">
      <div className="flex items-center gap-3">
        <button type="button" onClick={onBack} className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer"><ArrowLeft size={16} /></button>
        <div><h2 className="text-base font-bold text-slate-900">Detail Return Penjualan</h2><p className="text-[11px] text-slate-400">SR-{retur.id} · {formatOrderReference(order, 'pengembalian')}</p></div>
      </div>

      {isLocked && (
        <div className={`px-4 py-2.5 rounded-lg text-white font-bold text-[11px] ${retur.status === 'Dikonfirmasi' ? 'bg-emerald-600' : 'bg-rose-600'}`}>
          {retur.status === 'Dikonfirmasi' ? '✔️ Dikonfirmasi — data terkunci, tidak dapat diubah.' : '❌ Dibatalkan — data terkunci, tidak dapat diubah.'}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5 grid grid-cols-1 md:grid-cols-4 gap-4 shadow-2xs">
          <div><span className="text-[10px] text-slate-400 block">Pelanggan</span><strong>{order.nama || 'Pelanggan Umum'}</strong></div>
          <div><span className="text-[10px] text-slate-400 block">Tanggal Pesanan</span><strong>{fmtDate(order.waktu)}</strong></div>
          <div><span className="text-[10px] text-slate-400 block">Total Pesanan</span><strong>{fmtRp(order.total_harga)}</strong></div>
          <div><span className="text-[10px] text-slate-400 block">Nominal Refund</span><strong className="text-rose-600">{fmtRp(retur.nominal_refund)}</strong></div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 shadow-2xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="space-y-1"><span className="text-[10px] text-slate-400">Tanggal Pengembalian</span><span className="relative block"><Calendar size={14} className="absolute left-3 top-2.5 text-slate-400" /><input type="date" disabled={isLocked} value={retur.tanggal_pengembalian || ''} onChange={(e) => setRetur({ ...retur, tanggal_pengembalian: e.target.value })} className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg disabled:bg-slate-50 disabled:text-slate-400" /></span></label>
            <label className="space-y-1"><span className="text-[10px] text-slate-400">Status</span><select disabled={isLocked} value={retur.status} onChange={(e) => setRetur({ ...retur, status: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg disabled:bg-slate-50 disabled:text-slate-400"><option>Draft</option><option>Tunda</option><option>Dikonfirmasi</option><option>Batal</option></select></label>
          </div>
          <label className="space-y-1 block"><span className="text-[10px] text-slate-400">Catatan</span><textarea rows={3} disabled={isLocked} value={retur.catatan || ''} onChange={(e) => setRetur({ ...retur, catatan: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg resize-none disabled:bg-slate-50 disabled:text-slate-400" /></label>
          {!isLocked && (
            <div className="flex justify-end"><button type="submit" disabled={saving} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0088E8] text-white font-bold cursor-pointer disabled:opacity-50"><Save size={14} /> {saving ? 'Menyimpan...' : 'Simpan Perubahan'}</button></div>
          )}
        </div>
      </form>

      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs"><h3 className="font-bold text-slate-800 mb-3">Detail Produk Pesanan</h3><div className="overflow-x-auto"><table className="w-full text-left"><thead className="text-slate-400 border-b border-slate-100"><tr><th className="py-2">Produk</th><th className="py-2 text-right">Qty</th><th className="py-2 text-right">Harga</th><th className="py-2 text-right">Subtotal</th></tr></thead><tbody className="divide-y divide-slate-50">{(order.items || []).map((item) => <tr key={item.id}><td className="py-2">{item.product_nama || item.nama_produk || '-'}</td><td className="py-2 text-right">{item.qty}</td><td className="py-2 text-right">{fmtRp(item.harga_satuan || item.harga)}</td><td className="py-2 text-right font-bold">{fmtRp(item.subtotal || (Number(item.qty || 0) * Number(item.harga_satuan || item.harga || 0)))}</td></tr>)}</tbody></table></div></div>
    </div>
  );
}
