import { Routes, Route, Navigate } from 'react-router-dom';
import TransaksiTopbar from '../../transaksi/components/TransaksiTopbar';
import { TransaksiProvider } from '../../transaksi/components/TransaksiContext';
import Settings from './Settings';
import PointOfSale from './pos/PointOfSale';
import Notifikasi from './Notifikasi';
import SistemStok from './SistemStok';

/**
 * Pembungkus area "Pengaturan" (full-screen, topbar sendiri).
 * Memakai ulang topbar & breadcrumb provider dari area Transaksi.
 */
export default function SettingsApp() {
  return (
    <TransaksiProvider>
      <div className="flex flex-col min-h-screen bg-white">
        <TransaksiTopbar />
        <div className="flex-1 flex flex-col">
          <Routes>
            <Route path="toko" element={<Settings />} />
            <Route path="point-of-sale" element={<PointOfSale />} />
            <Route path="notifikasi" element={<Notifikasi />} />
            <Route path="sistem-stok" element={<SistemStok />} />
            <Route path="*" element={<Navigate to="point-of-sale" replace />} />
          </Routes>
        </div>
      </div>
    </TransaksiProvider>
  );
}
