import { Routes, Route, Navigate } from 'react-router-dom';
import TransaksiTopbar from '../components/TransaksiTopbar';
import { TransaksiProvider } from '../components/TransaksiContext';
import Penjualan from './Penjualan';
import Pembelian from './Pembelian';
import PendapatanPengeluaran from './PendapatanPengeluaran';
import DigitalPayment from './DigitalPayment';

/**
 * Pembungkus area Transaksi & Pembayaran (full-screen, flush tanpa gap).
 * Topbar putih ringkas tetap di atas; konten 4 menu mengisi sisa layar.
 */
export default function TransaksiApp() {
  return (
    <TransaksiProvider>
      <div className="flex flex-col min-h-screen bg-white">
        <TransaksiTopbar />
        <div className="flex-1 flex flex-col">
          <Routes>
            <Route path="penjualan" element={<Penjualan />} />
            <Route path="pembelian" element={<Pembelian />} />
            <Route path="pendapatan-pengeluaran" element={<PendapatanPengeluaran />} />
            <Route path="digital-payment" element={<DigitalPayment />} />
            <Route path="*" element={<Navigate to="penjualan" replace />} />
          </Routes>
        </div>
      </div>
    </TransaksiProvider>
  );
}
