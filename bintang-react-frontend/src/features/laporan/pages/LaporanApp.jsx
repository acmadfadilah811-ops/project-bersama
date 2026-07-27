import { Routes, Route, Navigate } from 'react-router-dom';
import TransaksiTopbar from '../../transaksi/components/TransaksiTopbar';
import { TransaksiProvider } from '../../transaksi/components/TransaksiContext';
import PencairanDana from './PencairanDana';
import Laporan from './Laporan';

/**
 * Pembungkus area "Laporan dan Pembukuan" (full-screen, topbar sendiri).
 * Memakai ulang topbar & breadcrumb provider dari area Transaksi.
 */
export default function LaporanApp() {
  return (
    <TransaksiProvider>
      <div className="flex flex-col min-h-screen bg-white">
        <TransaksiTopbar />
        <div className="flex-1 flex flex-col">
          <Routes>
            <Route path="pencairan-dana" element={<PencairanDana />} />
            <Route path="laporan" element={<Laporan />} />
            <Route path="*" element={<Navigate to="pencairan-dana" replace />} />
          </Routes>
        </div>
      </div>
    </TransaksiProvider>
  );
}
