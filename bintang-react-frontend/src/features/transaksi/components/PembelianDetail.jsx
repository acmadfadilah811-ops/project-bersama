import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Plus, ShoppingBag, RotateCcw, Trash2 } from 'lucide-react';
import TambahProdukModal from './TambahProdukModal';
import PembelianInfoCards from './PembelianInfoCards';
import PembelianItemsTable from './PembelianItemsTable';
import PembelianPembayaranModal from './PembelianPembayaranModal';
import apiClient from '../../../api/apiClient';

const fmtRp = (n) => `Rp ${Number(n || 0).toLocaleString('id-ID')}`;
const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }) : '-';

export default function PembelianDetail({ docId, onBack, onSaved }) {
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [isPayOpen, setIsPayOpen] = useState(false);

  const fetchDetail = useCallback(async () => {
    try {
      const res = await apiClient.get(`/purchases/${docId}/`);
      setDoc(res.data);
    } catch (err) {
      console.error(err);
      alert('Gagal memuat detail pembelian.');
    } finally {
      setLoading(false);
    }
  }, [docId]);

  useEffect(() => {
    fetchDetail();
  }, [docId, fetchDetail]);

  const handleAddProduct = async (payload) => {
    try {
      await apiClient.post(`/purchases/${docId}/add-item/`, payload);
      await fetchDetail();
    } catch (err) {
      alert(err.response?.data?.error || 'Gagal menambahkan produk.');
      throw err;
    }
  };

  const refreshAll = async () => {
    await fetchDetail();
    onSaved?.();
  };

  if (loading) {
    return <div className="p-8 text-center text-xs font-bold text-slate-400 animate-pulse">Memuat detail...</div>;
  }
  if (!doc) {
    return <div className="p-8 text-center text-xs font-bold text-rose-500">Data tidak ditemukan.</div>;
  }

  const isDraft = doc.status === 'draft';
  const isRetur = !!doc.is_retur;
  const totalHarga = Number(doc.total || 0);
  const sisa = Number(doc.sisa || 0);

  // --- aksi status penerimaan (PO non-retur) ---
  const handleMarkDiterima = async () => {
    if (!window.confirm('Tandai barang Diterima? Bila "lanjut tambah stok" aktif, stok akan bertambah dan data tidak dapat diubah lagi.')) return;
    try {
      await apiClient.post(`/purchases/${docId}/receive/`, {
        tanggal_diterima: doc.tanggal_diterima || new Date().toISOString().slice(0, 10),
        no_terima: doc.no_terima || '',
        lanjut_tambah_stok: doc.lanjut_tambah_stok,
      });
      await refreshAll();
    } catch (err) {
      alert(err.response?.data?.error || 'Gagal memproses penerimaan.');
    }
  };

  // --- aksi post retur ---
  const handlePostRetur = async () => {
    if (!window.confirm('Post retur sekarang? Stok akan berkurang dan data tidak dapat diubah lagi.')) return;
    try {
      await apiClient.post(`/purchases/${docId}/post-retur/`, { exchange_new: doc.exchange_new });
      await refreshAll();
    } catch (err) {
      alert(err.response?.data?.error || 'Gagal memposting retur.');
    }
  };

  const handleCancel = async () => {
    if (!window.confirm('Batalkan dokumen ini?')) return;
    try {
      await apiClient.post(`/purchases/${docId}/cancel/`);
      await refreshAll();
    } catch (err) {
      alert(err.response?.data?.error || 'Gagal membatalkan dokumen.');
    }
  };

  const handleDateChange = async (newDate) => {
    try {
      await apiClient.patch(`/purchases/${docId}/`, { tanggal: newDate });
      await refreshAll();
    } catch (err) {
      alert(err.response?.data?.error || 'Gagal mengubah tanggal.');
    }
  };

  // --- pembayaran ---
  const handleAddPayment = async ({ tanggal, nominal }) => {
    try {
      await apiClient.post(`/purchases/${docId}/add-payment/`, { tanggal, nominal });
      setIsPayOpen(false);
      await refreshAll();
    } catch (err) {
      alert(err.response?.data?.error || 'Gagal menyimpan pembayaran.');
    }
  };

  const handleRemovePayment = async (paymentId) => {
    if (!window.confirm('Hapus pembayaran ini?')) return;
    try {
      await apiClient.post(`/purchases/${docId}/remove-payment/`, { payment_id: paymentId });
      await refreshAll();
    } catch (err) {
      alert(err.response?.data?.error || 'Gagal menghapus pembayaran.');
    }
  };

  // --- banner ---
  const paymentBanner = {
    belum: ['❌ Belum bayar', 'bg-rose-600'],
    sebagian: ['◐ Bayar sebagian', 'bg-amber-500'],
    lunas: ['✔️ Sudah bayar', 'bg-emerald-600'],
  }[doc.payment_status] || ['❌ Belum bayar', 'bg-rose-600'];

  return (
    <div className="p-6 w-full mx-auto space-y-5 animate-fade-in text-slate-700">
      {/* Banner status: pembayaran (PO) atau info retur */}
      {isRetur ? (
        <div className="flex items-center px-5 py-3 rounded-xl text-white shadow-2xs bg-indigo-600">
          <div className="flex items-center gap-2 font-bold text-xs">
            <RotateCcw size={14} />
            <span>Retur Pembelian{doc.retur_ref_nomor ? ` — Ref: ${doc.retur_ref_nomor}` : ''}</span>
          </div>
        </div>
      ) : (
        <div className={`flex items-center justify-between px-5 py-3 rounded-xl text-white shadow-2xs transition-colors duration-300 ${paymentBanner[1]}`}>
          <div className="flex items-center gap-2 font-bold text-xs">
            <span>{paymentBanner[0]}</span>
          </div>
          <div className="text-[11px] font-semibold opacity-90">
            {fmtRp(doc.total_dibayar)} / {fmtRp(totalHarga)}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 bg-slate-100 hover:bg-slate-200 rounded-full cursor-pointer transition-colors text-slate-600"
          >
            <ArrowLeft size={16} />
          </button>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white ${isRetur ? 'bg-indigo-500' : 'bg-blue-500'}`}>
            {isRetur ? <RotateCcw size={15} /> : <ShoppingBag size={15} />}
          </div>
          <div>
            <span className="text-sm font-bold text-slate-800 font-mono block leading-none mb-1">{doc.nomor}</span>
            <span className="text-[10px] text-slate-400 block font-semibold">
              {isRetur ? 'Retur' : 'Pembelian'} Oleh {doc.dibuat_oleh_nama || 'Tidak diketahui'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Aksi utama sesuai jenis dokumen */}
          {!isRetur && isDraft && (
            <button
              type="button"
              onClick={handleMarkDiterima}
              className="text-xs font-bold bg-emerald-600 text-white rounded-lg px-3 py-2 hover:bg-emerald-700 cursor-pointer shadow-sm"
            >
              Tandai Diterima
            </button>
          )}
          {isRetur && isDraft && (
            <button
              type="button"
              onClick={handlePostRetur}
              className="text-xs font-bold bg-indigo-600 text-white rounded-lg px-3 py-2 hover:bg-indigo-700 cursor-pointer shadow-sm"
            >
              Post Sekarang
            </button>
          )}
          {isDraft && (
            <button
              type="button"
              onClick={handleCancel}
              className="text-xs font-bold bg-white text-rose-600 border border-rose-200 rounded-lg px-3 py-2 hover:bg-rose-50 cursor-pointer"
            >
              Batalkan
            </button>
          )}

          {/* Status penerimaan (tampilan) */}
          <span className={`text-xs font-semibold rounded-lg px-3 py-2 border ${
            doc.status === 'batal'
              ? 'bg-rose-50 text-rose-600 border-rose-100'
              : doc.receive_status === 'diterima'
                ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                : 'bg-orange-50 text-orange-600 border-orange-100'
          }`}>
            {doc.status === 'batal' ? 'Batal' : doc.receive_status === 'diterima' ? 'Diterima' : 'Tunda'}
          </span>

          {/* Date Picker */}
          <input
            type="date"
            disabled={!isDraft}
            value={doc.tanggal ? doc.tanggal.substring(0, 10) : ''}
            onChange={(e) => handleDateChange(e.target.value)}
            className={`text-xs font-mono font-bold text-slate-700 bg-white border border-slate-200 rounded-lg px-3 py-2 focus:outline-none ${
              isDraft ? 'cursor-pointer hover:bg-slate-50' : 'cursor-not-allowed text-slate-400 bg-slate-50'
            }`}
          />
        </div>
      </div>

      {/* Grid Info */}
      <PembelianInfoCards doc={doc} isDraft={isDraft} isRetur={isRetur} onSaved={fetchDetail} />

      {/* Produk Pesanan */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-4">
        <div className="border-b border-slate-100 pb-2 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-800">Produk {isRetur ? 'Diretur' : 'Pesanan'}</span>
            {doc.items && doc.items.length > 0 && (
              <span className="text-[10px] font-bold text-slate-400 font-mono">(Total: {fmtRp(totalHarga)})</span>
            )}
          </div>
          {isDraft && (
            <button
              onClick={() => setIsAddProductOpen(true)}
              className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-800 cursor-pointer"
            >
              <Plus size={14} /> Produk
            </button>
          )}
        </div>

        {doc.items && doc.items.length > 0 ? (
          <PembelianItemsTable docId={docId} items={doc.items} isDraft={isDraft} onRemoved={fetchDetail} />
        ) : (
          <div className="flex flex-col items-center justify-center py-10 space-y-3">
            <div className="w-20 h-20 rounded-full bg-slate-50 flex items-center justify-center text-2xl border border-slate-100 shadow-2xs">
              🐻‍❄️
            </div>
            <span className="text-xs font-bold text-slate-400">Tidak ada produk</span>
          </div>
        )}
      </div>

      {/* Pembayaran (hanya PO, bukan retur) */}
      {!isRetur && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-4">
          <div className="border-b border-slate-100 pb-2 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-800">Pembayaran</span>
              <span className="text-[10px] font-bold text-slate-400 font-mono">
                (Sisa: {fmtRp(sisa)})
              </span>
            </div>
            {doc.status !== 'batal' && sisa > 0 && (
              <button
                onClick={() => setIsPayOpen(true)}
                className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 hover:text-emerald-800 cursor-pointer"
              >
                <Plus size={14} /> Pembayaran
              </button>
            )}
          </div>

          {doc.payments && doc.payments.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 font-semibold">
                    <th className="py-2">Tanggal</th>
                    <th className="py-2 text-right">Nominal</th>
                    <th className="py-2 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {doc.payments.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/50">
                      <td className="py-2.5 font-semibold text-slate-700">{fmtDate(p.tanggal)}</td>
                      <td className="py-2.5 text-right font-mono font-bold text-slate-800">{fmtRp(p.nominal)}</td>
                      <td className="py-2.5 text-center">
                        {doc.status !== 'batal' && (
                          <button
                            type="button"
                            onClick={() => handleRemovePayment(p.id)}
                            className="p-1 text-rose-500 hover:bg-rose-50 rounded-full cursor-pointer transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-6 text-slate-400 text-xs font-semibold">Belum ada pembayaran</div>
          )}
        </div>
      )}

      {/* Log */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-4 text-xs">
        <div className="border-b border-slate-100 pb-2">
          <span className="font-bold text-slate-800">Log</span>
        </div>
        <div className="space-y-2 text-slate-600">
          <div>
            <span className="text-[10px] font-bold text-slate-400 block">Waktu Pembuatan</span>
            <span className="font-semibold text-slate-700">
              {doc.dibuat_oleh_email || doc.dibuat_oleh_nama || 'Tidak diketahui'}, {new Date(doc.created_at).toLocaleString('id-ID')}
            </span>
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 block">Terakhir Diperbarui</span>
            <span className="font-semibold text-slate-700">
              {doc.dibuat_oleh_email || doc.dibuat_oleh_nama || 'Tidak diketahui'}, {new Date(doc.updated_at).toLocaleString('id-ID')}
            </span>
          </div>
        </div>
      </div>

      <TambahProdukModal
        isOpen={isAddProductOpen}
        onClose={() => setIsAddProductOpen(false)}
        onAdd={handleAddProduct}
      />
      {isPayOpen && (
        <PembelianPembayaranModal
          sisa={sisa}
          onClose={() => setIsPayOpen(false)}
          onSave={handleAddPayment}
        />
      )}
    </div>
  );
}
