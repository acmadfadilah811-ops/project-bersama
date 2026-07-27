import { useState, useEffect } from 'react';
import {
  Bell,
  MessageSquare,
  Mail,
  Smartphone,
  Save,
  CheckCircle,
  HelpCircle,
  ShoppingBag,
  AlertTriangle,
  FileText,
  UserCheck,
} from 'lucide-react';
import { useTransaksiCrumb } from '../../transaksi/components/TransaksiContext';

export default function Notifikasi() {
  const { setSubtitle } = useTransaksiCrumb();

  useEffect(() => {
    setSubtitle('Notifikasi');
  }, [setSubtitle]);

  // State untuk setelan notifikasi
  const [settings, setSettings] = useState({
    orderWa: true,
    orderPush: true,
    stockEmail: true,
    stockPush: true,
    reportEmail: false,
    paymentWa: true,
    complaintWa: false,
    complaintPush: true,
    attendanceEmail: false,
  });

  const [saving, setSaving] = useState(false);
  const [showToast, setShowToast] = useState(false);

  const handleToggle = (key) => {
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = (e) => {
    e.preventDefault();
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    }, 800);
  };

  return (
    <div className="flex flex-col flex-1 bg-slate-50 min-h-screen p-6">
      {/* Toast Notification */}
      {showToast && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2 border border-slate-800 animate-slide-up-fade">
          <CheckCircle size={16} className="text-emerald-400" />
          <span className="text-xs font-semibold">Pengaturan Notifikasi berhasil disimpan!</span>
        </div>
      )}

      <div className="max-w-4xl mx-auto w-full space-y-6">
        {/* Header Kartu */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-white">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                <Bell size={18} />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-800 text-sm">Pusat Notifikasi & WhatsApp Gateway</h3>
                <p className="text-[11px] text-slate-400">Atur kanal pengiriman notifikasi otomatis untuk setiap transaksi dan operasional.</p>
              </div>
            </div>

            <button
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 disabled:opacity-60 transition-all shadow-sm hover:shadow flex items-center gap-2 cursor-pointer"
            >
              {saving ? (
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Save size={14} />
              )}
              {saving ? 'Menyimpan...' : 'Simpan Setelan'}
            </button>
          </div>

          <div className="p-6 space-y-8">
            {/* Kategori 1: Transaksi Penjualan */}
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <ShoppingBag size={14} className="text-slate-400" /> Transaksi & Penjualan
              </h4>

              <div className="border border-slate-150 rounded-xl divide-y divide-slate-100 overflow-hidden bg-white">
                {/* Item 1 */}
                <div className="p-4 flex items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-slate-800">Kirim WhatsApp Pembeli Saat Pesanan Baru</p>
                    <p className="text-[10px] text-slate-400">Kirim struk digital & info SPK langsung ke WhatsApp pelanggan setelah order disimpan.</p>
                  </div>
                  <Toggle active={settings.orderWa} onChange={() => handleToggle('orderWa')} />
                </div>
                {/* Item 2 */}
                <div className="p-4 flex items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-slate-800">Notifikasi Push Aplikasi untuk Pesanan Baru</p>
                    <p className="text-[10px] text-slate-400">Tampilkan pop-up atau dynamic island notifikasi di layar admin/owner ketika ada order masuk.</p>
                  </div>
                  <Toggle active={settings.orderPush} onChange={() => handleToggle('orderPush')} />
                </div>
                {/* Item 3 */}
                <div className="p-4 flex items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-slate-800">WhatsApp Konfirmasi Pembayaran Sukses</p>
                    <p className="text-[10px] text-slate-400">Kirim konfirmasi pelunasan tagihan otomatis ke pelanggan.</p>
                  </div>
                  <Toggle active={settings.paymentWa} onChange={() => handleToggle('paymentWa')} />
                </div>
              </div>
            </div>

            {/* Kategori 2: Inventori & Stok */}
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <AlertTriangle size={14} className="text-slate-400" /> Inventori & Pengawasan Stok
              </h4>

              <div className="border border-slate-150 rounded-xl divide-y divide-slate-100 overflow-hidden bg-white">
                {/* Item 1 */}
                <div className="p-4 flex items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-slate-800">Email Peringatan Stok Menipis</p>
                    <p className="text-[10px] text-slate-400">Kirim laporan harian barang yang sudah mencapai batas minimal stok ke email Manager Keuangan.</p>
                  </div>
                  <Toggle active={settings.stockEmail} onChange={() => handleToggle('stockEmail')} />
                </div>
                {/* Item 2 */}
                <div className="p-4 flex items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-slate-800">Notifikasi Push untuk Bahan Habis</p>
                    <p className="text-[10px] text-slate-400">Pemberitahuan real-time saat produksi (SPK) terhambat akibat stok bahan baku kosong.</p>
                  </div>
                  <Toggle active={settings.stockPush} onChange={() => handleToggle('stockPush')} />
                </div>
              </div>
            </div>

            {/* Kategori 3: Pelanggan & Komplain */}
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <MessageSquare size={14} className="text-slate-400" /> Komplain & Layanan Pelanggan
              </h4>

              <div className="border border-slate-150 rounded-xl divide-y divide-slate-100 overflow-hidden bg-white">
                {/* Item 1 */}
                <div className="p-4 flex items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-slate-800">Kirim WhatsApp Tiket Komplain</p>
                    <p className="text-[10px] text-slate-400">Kirimkan link pelacakan komplain & permintaan maaf otomatis saat pelanggan mengajukan komplain.</p>
                  </div>
                  <Toggle active={settings.complaintWa} onChange={() => handleToggle('complaintWa')} />
                </div>
                {/* Item 2 */}
                <div className="p-4 flex items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-slate-800">Notifikasi Push Komplain Baru</p>
                    <p className="text-[10px] text-slate-400">Tampilkan notifikasi real-time ke tim CS ketika ada pengaduan garansi masuk.</p>
                  </div>
                  <Toggle active={settings.complaintPush} onChange={() => handleToggle('complaintPush')} />
                </div>
              </div>
            </div>

            {/* Kategori 4: Laporan & HR */}
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <FileText size={14} className="text-slate-400" /> Pembukuan & Laporan HR
              </h4>

              <div className="border border-slate-150 rounded-xl divide-y divide-slate-100 overflow-hidden bg-white">
                {/* Item 1 */}
                <div className="p-4 flex items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-slate-800">Kirim Laporan Omset Harian via Email</p>
                    <p className="text-[10px] text-slate-400">Kirim ringkasan penjualan, kas masuk, dan piutang jatuh tempo setiap pukul 21:00 WIB ke email Owner.</p>
                  </div>
                  <Toggle active={settings.reportEmail} onChange={() => handleToggle('reportEmail')} />
                </div>
                {/* Item 2 */}
                <div className="p-4 flex items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-slate-800">Laporan Absensi & Keterlambatan Mingguan</p>
                    <p className="text-[10px] text-slate-400">Rekap kehadiran staf mingguan terkirim ke HR Manager.</p>
                  </div>
                  <Toggle active={settings.attendanceEmail} onChange={() => handleToggle('attendanceEmail')} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Sub-komponen Toggle reusable (dengan micro-animation premium)
function Toggle({ active, onChange }) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out outline-none ${
        active ? 'bg-blue-600' : 'bg-slate-200'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
          active ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
}
