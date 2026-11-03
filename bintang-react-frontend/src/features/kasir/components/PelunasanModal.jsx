import { useState } from 'react';
import { MessageCircle, Printer, Wallet, X } from 'lucide-react';
import apiClient from '../../../api/apiClient';
import { useAuth } from '../../../context/AuthContext';
import OrderInvoicePrint from './OrderInvoicePrint';
import KirimIdPesananButton from './KirimIdPesananButton';
import PaymentProcessModal from './PaymentProcessModal';
import {
  getPrintErrorMessage,
  jenisDokumenOtomatis,
  printDokumen,
  requestBrowserPrint,
} from '../../printing/services/printService';
import { fakturDariOrder } from '../../printing/services/qzDokumenHtml';
import { notifyError } from '../../../utils/notify';
import { selisihPembulatan } from '../../../utils/pembulatan';
import useMetodePembayaran from '../hooks/useMetodePembayaran';

/**
 * Penerimaan pelunasan untuk pesanan yang masih ada sisa tagihan.
 *
 * Tampilannya kalkulator pembayaran yang sama dengan terminal kasir (PaymentProcessModal, mode
 * "pelunasan"): pilih metode, ketik nominal di numpad, kembalian dihitung otomatis. Bisa melunasi
 * seluruh sisa atau membayar sebagian. Setelah dibayar, layar ringkas "Pembayaran Diterima" dengan
 * cetak faktur dan kirim WhatsApp.
 *
 * Memakai POST /orders/{id}/bayar/ yang sudah ada — endpoint itu menambah dp_dibayar, menghitung
 * ulang sisa tagihan, dan mencatat ke buku besar. Jadi tidak ada logika keuangan yang diduplikasi di sini.
 */
export default function PelunasanModal({ order, onClose, onSelesai }) {
  const { businessSettings } = useAuth();
  const sisaAwal = Math.max(0, Number(order?.sisa_tagihan || 0));

  // Jumlah yang dikurangkan dari tagihan (diisi saat pembayaran diproses; dipakai layar hasil & faktur).
  const [jumlah, setJumlah] = useState(sisaAwal);
  // Metode pembayaran = master Finance (Pengaturan POS > Pembayaran); cadangan bila gagal dimuat.
  const metodeMaster = useMetodePembayaran(true);
  const adaMaster = Array.isArray(metodeMaster) && metodeMaster.length > 0;
  const namaDefault = adaMaster ? (metodeMaster.find((m) => m.tipe === 'Tunai') || metodeMaster[0]).nama : 'tunai';
  const [metodePilihan, setMetode] = useState('');
  const metode = metodePilihan || namaDefault;
  // Pesanan offline dari staff: kasir boleh tidak mengirim ID pesanan via WA (faktur manual).
  const [kirimWa, setKirimWa] = useState(true);
  const [memproses, setMemproses] = useState(false);
  const [error, setError] = useState('');
  const [orderLunas, setOrderLunas] = useState(null);
  const [sendingInvoice, setSendingInvoice] = useState(false);
  const [idempotencyKey] = useState(
    () => globalThis.crypto?.randomUUID?.() || `order-payment-${Date.now()}-${Math.random()}`
  );

  if (!order) return null;

  const formatCurrency = (v) =>
    new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(v || 0);

  // Pembayaran dibulatkan (Pengaturan POS > Pembulatan): tagihan berkurang sebesar jumlah, uang diterima = jumlah + pembulatan.
  const hitungPembulatanBayar = (nilai) => (businessSettings?.pos_pembulatan_aktif && Number(nilai) > 0
    ? selisihPembulatan(Number(nilai), Number(businessSettings.pos_pembulatan_kelipatan || 0), businessSettings.pos_pembulatan_arah || 'atas', Number(businessSettings.pos_pembulatan_breakpoint) || 50)
    : 0);
  const jumlahNum = Number(jumlah || 0);
  const pembulatan = hitungPembulatanBayar(jumlahNum);

  const prosesPembayaran = async ({ method, paymentType, payAmount }) => {
    if (memproses) return;
    // "Lunasi sisa" melunasi seluruh sisa tagihan; "Bayar sebagian" memakai nominal yang diketik.
    const jumlahBayar = paymentType === 'lunas' ? sisaAwal : Math.round(Number(payAmount) || 0);
    if (jumlahBayar <= 0 || jumlahBayar > sisaAwal) {
      setError('Jumlah pembayaran harus lebih dari 0 dan tidak melebihi sisa tagihan.');
      return;
    }
    setJumlah(jumlahBayar);
    setMetode(method);
    setMemproses(true);
    setError('');
    try {
      const res = await apiClient.post(`/orders/${order.id}/bayar/`, {
        jumlah_bayar: jumlahBayar,
        metode_pembayaran: method,
        idempotency_key: idempotencyKey,
        kirim_wa: kirimWa,
      });
      setOrderLunas(res.data);
      if (jenisDokumenOtomatis(businessSettings).includes('invoice')) {
        // Faktur pelunasan langsung ke printer faktur PC ini; gagal tidak menggagalkan pembayaran.
        printDokumen({ type: 'invoice', data: fakturDariOrder(res.data, method), businessSettings })
          .catch((err) => notifyError('Cetak faktur otomatis gagal', getPrintErrorMessage(err)));
      }
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

  // Printer faktur khusus diatur -> langsung cetak tanpa dialog; kalau belum, dialog browser seperti biasa.
  const cetakFaktur = async () => {
    try {
      if (await printDokumen({ type: 'invoice', data: fakturDariOrder(orderLunas, metode), businessSettings })) return;
    } catch (err) {
      notifyError('Cetak faktur gagal', getPrintErrorMessage(err));
      return;
    }
    requestBrowserPrint();
  };

  const kirimInvoiceWa = async () => {
    if (!orderLunas || sendingInvoice) return;
    setSendingInvoice(true);
    try {
      const { data } = await apiClient.post(`/orders/${orderLunas.id}/invoice-whatsapp/`);
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

  // Sebelum dibayar: kalkulator pembayaran seperti di terminal kasir.
  if (!orderLunas) {
    return (
      <PaymentProcessModal
        isOpen
        mode="pelunasan"
        onClose={onClose}
        totalAmount={sisaAwal}
        pembulatan={hitungPembulatanBayar(sisaAwal)}
        hitungPembulatanBayar={hitungPembulatanBayar}
        onConfirmPayment={prosesPembayaran}
        infoPesanan={{ id: order.id, nama: order.nama, nomorWa: order.nomor_wa }}
        kirimWaOpsi={order.sumber === 'staff' ? { nilai: kirimWa, onChange: setKirimWa } : null}
        memproses={memproses}
        errorMessage={error}
      />
    );
  }

  return (
    <>
      <OrderInvoicePrint order={orderLunas} dibayarSekarang={jumlahNum} pembulatanSekarang={pembulatan} metode={metode} settings={businessSettings} />

      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-5 print:hidden">
        <div className="absolute inset-0 bg-slate-900/45 backdrop-blur-sm" onClick={onClose} />

        <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Wallet size={18} className="text-emerald-600" />
              <h3 className="text-sm font-black text-slate-800">Pembayaran Diterima</h3>
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
                  <p className="text-sm font-black text-rose-600">{formatCurrency(Number(orderLunas.sisa_tagihan || 0))}</p>
                </div>
              </div>
            </div>

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
          </div>

          <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
            >
              Tutup
            </button>
            <button
              type="button"
              onClick={cetakFaktur}
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
            <KirimIdPesananButton orderId={orderLunas.id} className="px-4 py-2 text-xs rounded-xl" />
          </div>
        </div>
      </div>
    </>
  );
}
