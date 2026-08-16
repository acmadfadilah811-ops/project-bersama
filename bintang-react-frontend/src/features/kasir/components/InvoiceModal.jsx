import { useState } from 'react';
import { FileText, MessageCircle, Printer, X } from 'lucide-react';
import apiClient from '../../../api/apiClient';
import OrderInvoicePrint from './OrderInvoicePrint';
import { requestBrowserPrint } from '../../printing/services/printService';

/**
 * Pratinjau & cetak faktur tanpa transaksi pembayaran.
 *
 * Dipisahkan dari PelunasanModal karena kebutuhannya berbeda: mencetak ulang
 * faktur pesanan yang sudah lunas, atau memberi rincian tagihan kepada
 * pelanggan sebelum ia membayar. Menyatukannya akan memaksa kasir melewati
 * form pembayaran hanya untuk mencetak.
 */
export default function InvoiceModal({ order, onClose }) {
  const [sendingInvoice, setSendingInvoice] = useState(false);

  if (!order) return null;

  const kirimInvoiceWa = async () => {
    if (sendingInvoice) return;
    setSendingInvoice(true);
    try {
      const { data } = await apiClient.post(`/orders/${order.id}/invoice-whatsapp/`);
      alert(`Faktur terkirim ke WhatsApp ${data.number}.`);
    } catch (err) {
      const detail = err?.response?.data?.reason;
      alert(detail === 'invalid_number'
        ? 'Faktur tidak dikirim karena nomor WhatsApp pelanggan tidak valid.'
        : 'Faktur gagal dikirim ke WhatsApp. Periksa koneksi gateway lalu coba lagi.');
    } finally {
      setSendingInvoice(false);
    }
  };

  const formatCurrency = (v) =>
    new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(v || 0);

  const items = order.items || [];
  const sisa = Math.max(0, Number(order.sisa_tagihan || 0));

  return (
    <>
      {/* dibayarSekarang = 0: ini cetak ulang, bukan pencatatan pembayaran baru */}
      <OrderInvoicePrint order={order} dibayarSekarang={0} metode={null} />

      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-5 print:hidden">
        <div className="absolute inset-0 bg-slate-900/45 backdrop-blur-sm" onClick={onClose} />

        <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
            <div className="flex items-center gap-2">
              <FileText size={18} className="text-indigo-600" />
              <h3 className="text-sm font-black text-slate-800">Faktur {order.id}</h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          <div className="p-5 overflow-y-auto">
            <div className="mb-4">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Ditagihkan kepada
              </p>
              <p className="text-sm font-black text-slate-800">{order.nama}</p>
              <p className="text-[11px] font-semibold text-slate-500">{order.nomor_wa}</p>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden mb-4">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-[10px] font-black uppercase text-slate-500 tracking-wider">
                    <th className="px-3 py-2">Item</th>
                    <th className="px-3 py-2 w-12 text-center">Qty</th>
                    <th className="px-3 py-2 w-28 text-right">Jumlah</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it) => (
                    <tr key={it.id} className="border-t border-slate-100 text-[11px]">
                      <td className="px-3 py-2 font-bold text-slate-700">{it.jenis_produk}</td>
                      <td className="px-3 py-2 text-center font-semibold text-slate-600">{it.qty}</td>
                      {/* harga_jual sudah total per baris (bukan harga satuan) — jangan dikali qty lagi */}
                      <td className="px-3 py-2 text-right font-black text-slate-800">
                        {formatCurrency(it.harga_jual)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1.5 text-[11px] font-semibold text-slate-600">
              <div className="flex justify-between">
                <span>Total</span>
                <span className="font-black text-slate-800">{formatCurrency(order.total_harga)}</span>
              </div>
              <div className="flex justify-between">
                <span>Sudah dibayar</span>
                <span className="font-bold">{formatCurrency(order.dp_dibayar)}</span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-1.5">
                <span className="font-black text-slate-800">
                  {sisa > 0 ? 'Sisa Tagihan' : 'Status'}
                </span>
                <span className={`font-black text-sm ${sisa > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {sisa > 0 ? formatCurrency(sisa) : 'LUNAS'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-100 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
            >
              Tutup
            </button>
            <button
              type="button"
              onClick={requestBrowserPrint}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-black text-xs rounded-xl flex items-center gap-1.5 cursor-pointer"
            >
              <Printer size={14} /> Cetak Faktur
            </button>
            <button
              type="button"
              onClick={kirimInvoiceWa}
              disabled={sendingInvoice}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black text-xs rounded-xl flex items-center gap-1.5 cursor-pointer"
            >
              <MessageCircle size={14} /> {sendingInvoice ? 'Mengirim...' : 'Kirim Faktur WA'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
