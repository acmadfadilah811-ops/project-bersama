import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AlertCircle, CheckCircle, Info, X } from 'lucide-react';
import { AuthProvider } from './context/AuthContext';

import { DynamicIslandProvider } from './context/DynamicIslandContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './features/auth/pages/Login';
import Dashboard from './features/dashboard/pages/Dashboard';
import AdminDashboard from './features/dashboard/pages/AdminDashboard';
import StaffDashboard from './features/dashboard/pages/StaffDashboard';
import ExecutiveDashboard from './features/dashboard/pages/ExecutiveDashboard';
import AiBusinessAnalyst from './features/dashboard/pages/AiBusinessAnalyst';
import Orders from './features/orders/pages/Orders';
import SettingsApp from './features/settings/pages/SettingsApp';
import Profile from './features/settings/pages/Profile';
import Employees from './features/hr/pages/Employees';
import Payroll from './features/hr/pages/Payroll';
import Attendance from './features/hr/pages/Attendance';
import Announcements from './features/announcements/pages/Announcements';
import Divisi from './features/hr/pages/Divisi';
import Reports from './features/reports/pages/Reports';
import Komplain from './features/komplain/pages/Komplain';
import { useAuth } from './context/AuthContext';
import ProductionApp from './features/production/pages/ProductionApp';
import StaffCreateOrderPage from './features/production/pages/StaffCreateOrderPage';
import UploadDesain from './features/orders/pages/UploadDesain';
import ProductInventoryApp from './features/inventory/pages/ProductInventoryApp';
import CustomerSupplierApp from './features/customerSupplier/pages/CustomerSupplierApp';
import TransaksiApp from './features/transaksi/pages/TransaksiApp';
import LaporanApp from './features/laporan/pages/LaporanApp';
import MarketingApp from './features/marketing/pages/MarketingApp';
import KasirApp from './features/kasir/pages/KasirApp';
import AccountingInternalApp from './features/accounting/pages/AccountingInternalApp';

let globalAlertTrigger = null;

function HomeRedirect() {
  const { user } = useAuth();
  const role = user?.role?.toLowerCase();
  if (role === 'staff') return <Navigate to="/staff-dashboard" replace />;
  if (role === 'kasir') return <Navigate to="/kasir" replace />;
  return <Navigate to="/dashboard" replace />;
}

// WA Live dipindah ke Kasir — pertahankan query string (mis. ?number=...)
// dari tautan/bookmark lama, `<Navigate to="path">` polos tidak membawanya.
function WaLiveRedirect() {
  const location = useLocation();
  return <Navigate to={`/kasir/wa-live${location.search}`} replace />;
}

// Komponen routing dashboard berdasarkan role
function DashboardRouter() {
  const { user } = useAuth();
  const role = user?.role?.toLowerCase();
  if (role === 'kasir') return <Navigate to="/kasir/dashboard" replace />;
  if (role === 'admin') return <AdminDashboard />;
  return <Dashboard />;
}

function App() {
  const [customAlert, setCustomAlert] = useState({
    open: false,
    message: '',
    type: 'info',
  });

  // Safe window.alert override with unmount cleanup
  useEffect(() => {
    const originalAlert = window.alert;

    globalAlertTrigger = (message) => {
      let type = 'info';
      const msgLower = String(message || '').toLowerCase();
      if (
        msgLower.includes('gagal') ||
        msgLower.includes('error') ||
        msgLower.includes('salah') ||
        msgLower.includes('tidak valid') ||
        msgLower.includes('kosong')
      ) {
        type = 'error';
      } else if (
        msgLower.includes('berhasil') ||
        msgLower.includes('sukses') ||
        msgLower.includes('selesai') ||
        msgLower.includes('terkirim') ||
        msgLower.includes('cocok')
      ) {
        type = 'success';
      }
      setCustomAlert({
        open: true,
        message: String(message || ''),
        type,
      });
    };

    window.alert = (message) => {
      if (globalAlertTrigger) {
        globalAlertTrigger(message);
      } else {
        originalAlert(message);
      }
    };

    return () => {
      window.alert = originalAlert; // Restore original alert on unmount
      globalAlertTrigger = null;
    };
  }, []);

  return (
    <AuthProvider>
      <DynamicIslandProvider>
        <BrowserRouter>
          <Routes>
            {/* Halaman publik */}
            <Route path="/login" element={<Login />} />
            <Route path="/public/upload-desain" element={<UploadDesain />} />
            <Route path="/public/upload-desain/:orderId" element={<UploadDesain />} />

            {/* Halaman yang butuh login */}
            <Route element={<ProtectedRoute />}>
              <Route element={<Layout />}>
                {/* Redirect root ke dashboard sesuai role */}
                <Route path="/" element={<HomeRedirect />} />

                {/* Dashboard */}
                <Route path="/dashboard" element={<DashboardRouter />} />
                <Route path="/staff-dashboard" element={<StaffDashboard />} />
                {/* Backend membatasi ke owner/manager; route ini hanya jalur masuknya. */}
                <Route path="/dashboard-eksekutif" element={<ExecutiveDashboard />} />
                <Route path="/dashboard-eksekutif/ai-analyst" element={<AiBusinessAnalyst />} />

                {/* Operasional */}
                <Route path="/orders" element={<Orders />} />
                <Route path="/orders/create" element={<Orders />} />
                <Route path="/jobs" element={<Navigate to="/produksi" replace />} />
                <Route path="/produksi/*" element={<ProductionApp />} />
                <Route path="/buat-order" element={<StaffCreateOrderPage />} />
                <Route path="/product-inventory/*" element={<ProductInventoryApp />} />
                <Route path="/customer-supplier/*" element={<CustomerSupplierApp />} />
                <Route path="/attendance" element={<Attendance />} />
                {/* Dipindah ke Kasir supaya role kasir (yang tadinya tidak
                    punya akses sama sekali) ikut bisa buka WA Live — redirect
                    dipertahankan untuk tautan/bookmark lama. */}
                <Route path="/whatsapp-chat" element={<WaLiveRedirect />} />
                <Route path="/komplain" element={<Komplain />} />

                {/* Marketing */}
                <Route path="/marketing/*" element={<MarketingApp />} />

                {/* Transaksi & Pembayaran (full-screen, topbar sendiri) */}
                <Route path="/transaksi/*" element={<TransaksiApp />} />

                {/* Laporan dan Pembukuan (full-screen, topbar sendiri) */}
                <Route path="/laporan/*" element={<LaporanApp />} />
                <Route path="/accounting-internal/*" element={<AccountingInternalApp />} />

                {/* Tim */}
                <Route path="/users" element={<Employees />} />
                <Route path="/employees" element={<Employees />} />
                <Route path="/payroll" element={<Payroll />} />
                <Route path="/divisi" element={<Divisi />} />

                {/* Laporan & Lainnya */}
                <Route path="/announcements" element={<Announcements />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/settings/*" element={<SettingsApp />} />

                {/* Kasir / POS Terminal */}
                <Route path="/kasir/*" element={<KasirApp />} />
              </Route>
            </Route>
          </Routes>
        </BrowserRouter>
      </DynamicIslandProvider>

      {/* Premium Enterprise Custom Alert Modal */}
      {customAlert.open && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-sm w-full p-6 relative flex flex-col items-center text-center transform scale-100 transition-all duration-300 shadow-indigo-500/10">
            {/* Close Button */}
            <button
              onClick={() => setCustomAlert((prev) => ({ ...prev, open: false }))}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 rounded-full p-1 hover:bg-slate-50 transition-all cursor-pointer"
            >
              <X size={16} />
            </button>

            {/* Icon */}
            <div
              className={`p-4 rounded-full mb-4 ${
                customAlert.type === 'success'
                  ? 'bg-emerald-50 text-emerald-500'
                  : customAlert.type === 'error'
                    ? 'bg-rose-50 text-rose-500'
                    : 'bg-indigo-50 text-indigo-500'
              }`}
            >
              {customAlert.type === 'success' && <CheckCircle size={32} />}
              {customAlert.type === 'error' && <AlertCircle size={32} />}
              {customAlert.type === 'info' && <Info size={32} />}
            </div>

            {/* Title */}
            <h3 className="text-base font-extrabold text-slate-900 mb-2">
              {customAlert.type === 'success'
                ? 'Berhasil'
                : customAlert.type === 'error'
                  ? 'Pemberitahuan Sistem'
                  : 'Informasi'}
            </h3>

            {/* Message */}
            <p className="text-slate-600 text-xs font-semibold leading-relaxed mb-5 max-h-40 overflow-y-auto px-1 w-full whitespace-pre-wrap">
              {customAlert.message}
            </p>

            {/* Action Button */}
            <button
              onClick={() => setCustomAlert((prev) => ({ ...prev, open: false }))}
              className={`w-full py-2.5 rounded-xl font-bold text-xs text-white shadow-md transition-all transform active:scale-95 cursor-pointer ${
                customAlert.type === 'success'
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 shadow-emerald-500/20'
                  : customAlert.type === 'error'
                    ? 'bg-gradient-to-r from-rose-500 to-red-500 hover:from-rose-600 hover:to-red-600 shadow-rose-500/20'
                    : 'bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-600 hover:to-blue-600 shadow-indigo-500/20'
              }`}
            >
              OK
            </button>
          </div>
        </div>
      )}
    </AuthProvider>
  );
}

export default App;
