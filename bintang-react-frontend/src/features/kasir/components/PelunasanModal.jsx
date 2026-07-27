import { useState } from 'react';
import { Loader2, Printer, Wallet, X } from 'lucide-react';
import apiClient from '../../../api/apiClient';
import NumericInput from '../../../components/NumericInput';
import OrderInvoicePrint from './OrderInvoicePrint';

/**
 * Penerimaan pelunasan untuk pesanan yang sudah siap diambil.
 *
 * Memakai POST /orders/{id}/bayar/ yang sudah ada — endpoint itu menambah
 * dp_dibayar, menghitung ulang sisa tagihan, dan mencatat ke buku besar.
 * Jadi tidak ada logika keuangan yang diduplikasi di sini.
 */
export default function PelunasanModal({ order, onClose, onSelesai }) {
  const sisaAwal = Math.max(0, Number(order?.sisa_tagihan || 0));

  const [jumlah, setJumlah] = useState(sisaAwal);
  const [metode, setMetode] = useState('tunai');
  const [memproses, setMemproses] = useState(false);
  const [error, setError] = useState('');
  const [orderLunas, setOrderLunas] = useState(null);

  if (!order) return null;

  const formatCurrency = (v) =>
    new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(v || 0);

  const jumlahNum = Number(jumlah || 0);
  const sisaSetelah = Math.max(0, sisaAwal - jumlahNum);
  const bisaProses = jumlahNum > 0 && !memproses;

  const proses = async () => {
    if (!bisaProses) return;
    setMemproses(true);
    setError('');
    try {
      const res = await apiClient.post(`/orders/${order.id}/bayar/`, {
        jumlah_bayar: Math.round(jumlahNum),
        metode_pembayaran: metode,
      });
      setOrderLunas(res.data);
      if (onSelesai) onSelesai(res.data);
    } catch (err) {
      console.error('Gagal memproses pelunasan:', err);
      setError(
        err.response?.data?.error ||
          err.response?.data?.detail ||
          'Pembayaran gagal diproses. Periksa koneksi lalu coba kembali.'
      );
    } finally {
      setMemproses(false);
    }
  };

  const inputCls =
    'w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500';

  return (
    <>
      {orderLunas && (
        <OrderInvoicePrint order={orderLunas} dibayarSekarang={jumlahNum} metode={metode} />
      )}

      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-5 print:hidden">
        <div className="absolute inset-0 bg-slate-900/45 backdrop-blur-sm" onClick={onClose} />

        <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Wallet size={18} className="text-emerald-600" />
              <h3 className="text-sm font-black text-slate-800">
                {orderLunas ? 'Pembayaran Diterima' : 'Terima Pelunasan'}
              </h3>
            </div>
            <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 cursor-pointer">
              <X size={18} />
            </button>
          </div>

          <div className="p-5">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 mb-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Pesanan</p>
                  <p className="text-xs font-black text-slate-800">{order.id}</p>
                  <p className="text-[11px] font-semibold text-slate-500 mt-0.5">
                    {order.nama} &middot; {order.nomor_wa}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Sisa Tagihan</p>
                  <p className="text-sm font-black text-rose-600">{formatCurrency(sisaAwal)}</p>
                </div>
              </div>
            </div>

            {orderLunas ? (
              <div className="text-center py-3">
                <p className="text-xs font-semibold text-slate-600">
                  Pembayaran {formatCurrency(jumlahNum)} tercatat.
                </p>
                <p className="text-sm font-black text-slate-800 mt-1">
                  {Number(orderLunas.sisa_tagihan || 0) > 0
                    ? `Sisa tagihan ${formatCurrency(orderLunas.sisa_tagihan)}`
                    : 'Pesanan ini telah lunas.'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-500 block mb-1">Jumlah Diterima</label>
                  <NumericInput value={jumlah} onChange={(val) => setJumlah(val)} className={inputCls} />
                  {jumlahNum > sisaAwal && (
                    <p className="text-[11px] font-semibold text-amber-600 mt-1">
                      Kembalian {formatCurrency(jumlahNum - sisaAwal)}. Yang tercatat sebagai pembayaran
                      tetap sebesar jumlah yang Anda masukkan.
                    </p>
                  )}
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-500 block mb-1">Metode Pembayaran</label>
                  <select value={metode} onChange={(e) => setMetode(e.target.value)} className={inputCls}>
                    <option value="tunai">Tunai</option>
                    <option value="transfer">Transfer</option>
                    <option value="debit">Debit</option>
                    <option value="qris">QRIS</option>
                  </select>
                </div>

                <div className="flex justify-between items-center pt-1 text-xs font-bold text-slate-600">
                  <span>Sisa setelah pembayaran</span>
                  <span className={sisaSetelah > 0 ? 'text-rose-600 font-black' : 'text-emerald-600 font-black'}>
                    {sisaSetelah > 0 ? formatCurrency(sisaSetelah) : 'LUNAS'}
                  </span>
                </div>
              </div>
            )}

            {error && (
              <div className="mt-3 p-2.5 rounded-xl bg-rose-50 text-rose-700 text-[11px] font-semibold">
                {error}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-100">
            {orderLunas ? (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
                >
                  Tutup
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-black text-xs rounded-xl flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer size={14} /> Cetak Faktur
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={proses}
                  disabled={!bisaProses}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black text-xs rounded-xl flex items-center gap-1.5 cursor-pointer"
                >
                  {memproses && <Loader2 size={14} className="animate-spin" />}
                  {memproses ? 'Memproses…' : 'Terima Pembayaran'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
