import { useState, useEffect, useCallback } from 'react';
import { ArrowLeftRight, FileText, CheckCircle, Loader2 } from 'lucide-react';
import apiClient from '../../../api/apiClient';
import PasanganJurnalModal from '../components/pos/PasanganJurnalModal';
import ProdukPesananCard from '../../transaksi/components/ProdukPesananCard';
import { notifyApiError } from '../../../utils/notify';

const fmtIDR = (num) => (Number(num) || 0).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtTanggal = (isoString) => {
  if (!isoString) return '-';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
};

/**
 * Detail Piutang — dulu 100% mock (txNo/client/amount hasil rekayasa dari ID
 * baris tabel, item "banner" hardcode, Cara Pembayaran selalu "CASH", tombol
 * "Pengaturan Pembayaran" tanpa onClick). Sekarang fetch Order nyata dan
 * reuse ProdukPesananCard/RingkasanPesananCard (komponen yang sama dipakai
 * Transaksi > Penjualan) supaya pelunasan di sini benar-benar memanggil
 * POST /orders/{id}/bayar/ — bukan cuma tampilan.
 */
export default function DetailPiutangSelesai({ selectedDetailItem, onBack }) {
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showPasangan, setShowPasangan] = useState(false);

  const fetchOrder = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get(`/orders/${selectedDetailItem.id}/`);
      setOrder(res.data);
    } catch (err) {
      notifyApiError(err, 'Gagal memuat detail piutang.');
    } finally {
      setLoading(false);
    }
  }, [selectedDetailItem.id]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center gap-3 text-slate-400 font-bold text-xs">
        <Loader2 size={26} className="animate-spin text-[#0088E8]" />
        <span>Memuat detail piutang...</span>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="py-20 text-center text-xs font-bold text-rose-500">
        Piutang tidak ditemukan atau gagal dimuat.
        <button type="button" onClick={onBack} className="block mx-auto mt-3 text-[#0088E8] hover:underline font-bold">
          ← Kembali
        </button>
      </div>
    );
  }

  const isLunas = Number(order.sisa_tagihan || 0) === 0;
  const payments = (order.activity_logs || []).filter((log) => log.tindakan === 'PAYMENT');
  const journalSourceIds = payments.map((log) => log.id);
  const items = order.items || [];
  const canEdit = !isLunas;

  return (
    <div className="space-y-4 animate-fade-in text-xs font-semibold text-slate-700">

      {/* Header Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between shadow-2xs">
        <div className="flex items-center gap-4">
          {isLunas ? (
            <div className="bg-[#E6F4EA] text-[#137333] px-4 py-2.5 rounded-lg flex items-center gap-2 select-none shadow-3xs border border-[#A8DAB5]">
              <CheckCircle size={18} className="text-[#137333] shrink-0" />
              <div className="text-left leading-tight">
                <span className="text-[9px] uppercase font-bold tracking-wider block opacity-80">Piutang</span>
                <span className="text-xs font-black block mt-0.5">Lunas</span>
              </div>
            </div>
          ) : (
            <div className="bg-[#FEF3C7] text-[#D97706] px-4 py-2.5 rounded-lg flex items-center gap-2.5 select-none shadow-3xs border border-[#FDE68A]">
              <FileText size={18} className="text-[#D97706] shrink-0" />
              <div className="text-left leading-tight">
                <span className="text-[9px] uppercase font-bold tracking-wider block opacity-80">Piutang</span>
                <span className="text-xs font-black block mt-0.5">Belum dibayar</span>
              </div>
            </div>
          )}
          <div>
            <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Piutang</div>
            <h3 className="text-sm font-bold text-slate-800">
              Penjualan ke {order.nama}
            </h3>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {journalSourceIds.length > 0 && (
            <button
              type="button"
              onClick={() => setShowPasangan(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-650 rounded-lg shadow-2xs font-extrabold text-[11px] cursor-pointer transition-colors"
            >
              <ArrowLeftRight size={13} /> Pasangan Jurnal
            </button>
          )}
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 px-3.5 py-1.5 border border-emerald-250 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg shadow-2xs font-extrabold text-[11px] cursor-pointer transition-colors"
          >
            ← Kembali
          </button>
        </div>
      </div>

      {/* Riwayat transaksi (nyata: penjualan + tiap pembayaran dari OrderActivityLog) */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-2xs p-5 space-y-4">
        <div className="border border-slate-150 rounded-lg bg-white">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-450 uppercase tracking-wider select-none">
                <th className="px-5 py-3 rounded-tl-lg">Tanggal</th>
                <th className="px-5 py-3">Order</th>
                <th className="px-5 py-3">Deskripsi</th>
                <th className="px-5 py-3 text-right rounded-tr-lg">Jumlah (IDR)</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-100">
                <td className="px-5 py-4 text-slate-600 font-medium">{fmtTanggal(order.waktu)}</td>
                <td className="px-5 py-4 font-mono font-bold text-slate-800">{order.id}</td>
                <td className="px-5 py-4 text-slate-650 font-bold">Penjualan ke {order.nama}</td>
                <td className="px-5 py-4 text-right font-mono font-bold text-slate-800">{fmtIDR(order.total_harga)}</td>
              </tr>
              {payments.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-6 text-center text-slate-400">Belum ada pembayaran tercatat.</td>
                </tr>
              ) : payments.map((log) => (
                <tr key={log.id} className="border-b border-slate-100">
                  <td className="px-5 py-4 text-slate-600 font-medium">{fmtTanggal(log.waktu)}</td>
                  <td className="px-5 py-4 font-mono font-bold text-slate-500">-</td>
                  <td className="px-5 py-4 text-slate-500 font-medium">{log.keterangan}</td>
                  <td className="px-5 py-4 text-right font-mono font-medium text-slate-500">-</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Produk Pesanan + Ringkasan + Pengaturan Diskon/Pembayaran — komponen
          nyata yang sama dipakai Transaksi > Penjualan, bukan tabel statis. */}
      <ProdukPesananCard
        orderId={order.id}
        order={order}
        items={items}
        canEdit={canEdit}
        onItemsChanged={fetchOrder}
      />

      {showPasangan && (
        <PasanganJurnalModal
          isOpen={showPasangan}
          onClose={() => setShowPasangan(false)}
          txNo={order.id}
          sourceIds={journalSourceIds}
        />
      )}
    </div>
  );
}
