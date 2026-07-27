import { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import KasirHeader from '../components/KasirHeader';
import KasirSidebar from '../components/KasirSidebar';
import { KasirProvider } from '../context/KasirContext';
import PosTerminal from './PosTerminal';
import PosHistory from './PosHistory';
import PosShift from './PosShift';
import PosShiftSummary from './PosShiftSummary';
import PosRekapHarian from './PosRekapHarian';
import WaSettings from './WaSettings';
import WaOrderQueue from '../components/WaOrderQueue';
import KasirDashboard from './KasirDashboard';
import ProductListPage from './ProductListPage';
import CreateOrderPage from './CreateOrderPage';
import PesananPage from './PesananPage';

export default function KasirApp() {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <KasirProvider>
      <div className="flex h-full w-full overflow-hidden bg-[#F4F7FE]">
        {/* Single Dedicated Sidebar Kasir */}
        <KasirSidebar isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed} />

        {/* Header & Content Area Kasir */}
        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
          <KasirHeader />
          <main className="flex-1 overflow-auto bg-[#F4F7FE] relative">
            <Routes>
              <Route path="dashboard" element={<KasirDashboard />} />
              <Route path="terminal" element={<PosTerminal />} />
              <Route path="buat-order" element={<Navigate to="/kasir/terminal" replace />} />
              <Route path="produk" element={<ProductListPage />} />
              <Route path="pesanan" element={<PesananPage />} />
              <Route path="antrean-wa" element={<WaOrderQueue />} />
              <Route path="riwayat" element={<PosHistory />} />
              <Route path="rekap-harian" element={<PosRekapHarian />} />
              <Route path="shift" element={<PosShift />} />
              <Route path="ringkasan-shift-v2" element={<PosShiftSummary />} />
              <Route path="pengaturan-wa" element={<WaSettings />} />
              <Route path="*" element={<Navigate to="dashboard" replace />} />
            </Routes>
          </main>
        </div>
      </div>
    </KasirProvider>
  );
}
