import { useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import KasirHeader from '../components/KasirHeader';
import KasirSidebar from '../components/KasirSidebar';
import { KasirProvider } from '../context/KasirContext';
import PosTerminal from './PosTerminal';
import PosHistory from './PosHistory';
import PosShift from './PosShift';
import PosRekapHarian from './PosRekapHarian';
import WaOrderQueue from '../components/WaOrderQueue';
import KasirDashboard from './KasirDashboard';
import ProductListPage from './ProductListPage';
import CreateOrderPage from './CreateOrderPage';
import PesananPage from './PesananPage';
import KasirPelangganSupplier from './KasirPelangganSupplier';
import PrinterSettings from '../../printing/pages/PrinterSettings';
import WhatsAppChat from '../../whatsapp/pages/WhatsAppChat';
import { X } from 'lucide-react';

export default function KasirApp() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showSidebarDrawer, setShowSidebarDrawer] = useState(false);
  const location = useLocation();

  // Mode Kasir POS = Full-screen total (100% full screen dengan PosHeaderBar & drawer sidebar setrip 3)
  const isTerminalMode = true;

  const handleToggleSidebar = () => setShowSidebarDrawer((prev) => !prev);

  return (
    <KasirProvider>
      <div className="flex h-full w-full overflow-hidden bg-[#F4F7FE] relative">
        {/* Sidebar Overlay Drawer saat tombol Setrip 3 diklik */}
        {showSidebarDrawer && (
          <div className="fixed inset-0 z-[9999] flex">
            {/* Backdrop Overlay */}
            <div
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
              onClick={() => setShowSidebarDrawer(false)}
            />

            {/* Sliding Sidebar Container */}
            <div className="relative z-10 w-72 bg-white h-full shadow-2xl flex flex-col animate-slide-in">
              <div className="p-3 bg-slate-900 text-white flex justify-between items-center">
                <span className="font-extrabold text-sm tracking-wide">Navigasi Kasir</span>
                <button
                  onClick={() => setShowSidebarDrawer(false)}
                  className="p-1 hover:bg-slate-800 rounded-full text-slate-300 hover:text-white cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                <KasirSidebar isCollapsed={false} setIsCollapsed={() => {}} />
              </div>
            </div>
          </div>
        )}

        {/* Content Area Kasir */}
        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
          <main className="flex-1 overflow-hidden bg-[#F4F7FE] relative">
            <Routes>
              <Route path="dashboard" element={<KasirDashboard onToggleSidebar={handleToggleSidebar} />} />
              <Route path="terminal" element={<PosTerminal onToggleSidebar={handleToggleSidebar} />} />
              <Route path="buat-order" element={<Navigate to="/kasir/terminal" replace />} />
              <Route path="produk" element={<ProductListPage onToggleSidebar={handleToggleSidebar} />} />
              <Route path="pesanan" element={<PesananPage onToggleSidebar={handleToggleSidebar} />} />
              <Route path="antrean-wa" element={<WaOrderQueue onToggleSidebar={handleToggleSidebar} />} />
              <Route path="wa-live" element={<WhatsAppChat onToggleSidebar={handleToggleSidebar} />} />
              <Route path="pelanggan-supplier" element={<KasirPelangganSupplier onToggleSidebar={handleToggleSidebar} />} />
              <Route path="riwayat" element={<PosHistory onToggleSidebar={handleToggleSidebar} />} />
              <Route path="rekap-harian" element={<Navigate to="/kasir/shift" replace />} />
              <Route path="shift" element={<PosShift onToggleSidebar={handleToggleSidebar} />} />
              <Route path="ringkasan-shift-v2" element={<PosRekapHarian onToggleSidebar={handleToggleSidebar} />} />
              <Route path="pengaturan-cetak" element={<PrinterSettings />} />
              <Route path="pengaturan-wa" element={<Navigate to="/kasir/dashboard" replace />} />
              <Route path="*" element={<Navigate to="dashboard" replace />} />
            </Routes>
          </main>
        </div>
      </div>
    </KasirProvider>
  );
}
