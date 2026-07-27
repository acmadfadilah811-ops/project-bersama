import { useState, useEffect, useCallback } from 'react';
import {
  Boxes,
  Save,
  CheckCircle,
  Info,
  RefreshCw,
  AlertTriangle,
  Ruler,
} from 'lucide-react';
import { useTransaksiCrumb } from '../../transaksi/components/TransaksiContext';
import apiClient from '../../../api/apiClient';

const MODES = [
  {
    id: 'average',
    label: 'Average',
    info: 'Sistem stok average (default) adalah metode pengelolaan stok yang menghitung rata-rata harga per unit barang yang tersedia di gudang.',
  },
  {
    id: 'fifo',
    label: 'FIFO',
    info: 'FIFO (First In, First Out): barang yang pertama masuk adalah yang pertama keluar. HPP dihitung dari lapisan biaya sesuai urutan masuknya stok.',
  },
  {
    id: 'fifo_expired',
    label: 'FIFO & Expired',
    info: 'FIFO & Expired: selain urutan masuk, sistem mendahulukan stok yang paling cepat kedaluwarsa (FEFO). Tanggal kedaluwarsa bisa diisi saat stok masuk & pembelian.',
  },
];

const UMUM = [
  { key: 'stock_transfer_pakai_harga_beli', label: 'Transfer antar toko menggunakan harga beli', desc: 'Nilai transfer memakai harga beli, bukan harga jual.' },
  { key: 'stock_tampilkan_harga_beli_rata2', label: 'Tampilkan harga beli rata-rata di produk', desc: 'Halaman produk menampilkan rata-rata biaya dari lapisan yang tersisa.' },
  { key: 'stock_harga_beli_terakhir', label: 'Harga beli terakhir sebagai harga beli', desc: 'Harga beli produk mengikuti penerimaan terakhir.' },
];

function Toggle({ active, onChange, disabled = false }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 outline-none ${
        active ? 'bg-blue-600' : 'bg-slate-200'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ${
          active ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

export default function SistemStok() {
  const { setSubtitle } = useTransaksiCrumb();

  const [mode, setMode] = useState('average');
  const [uomAktif, setUomAktif] = useState(false);
  const [umum, setUmum] = useState({
    stock_transfer_pakai_harga_beli: false,
    stock_tampilkan_harga_beli_rata2: false,
    stock_harga_beli_terakhir: false,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [status, setStatus] = useState(null);

  useEffect(() => {
    setSubtitle('Sistem Stok');
  }, [setSubtitle]);

  const showToast = (msg, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/business-settings/');
      const d = res.data || {};
      setMode(d.stock_system || 'average');
      setUomAktif(!!d.uom_multi_enabled);
      setUmum({
        stock_transfer_pakai_harga_beli: !!d.stock_transfer_pakai_harga_beli,
        stock_tampilkan_harga_beli_rata2: !!d.stock_tampilkan_harga_beli_rata2,
        stock_harga_beli_terakhir: !!d.stock_harga_beli_terakhir,
      });
    } catch (err) {
      console.error('Gagal memuat pengaturan sistem stok:', err);
      showToast('Gagal memuat pengaturan.', false);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await apiClient.get('/stock-fifo/status/');
      setStatus(res.data);
    } catch (err) {
      console.error('Gagal memuat status FIFO:', err);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
    fetchStatus();
  }, [fetchSettings, fetchStatus]);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiClient.patch('/business-settings/', {
        stock_system: mode,
        uom_multi_enabled: uomAktif,
        ...umum,
      });
      showToast('Pengaturan Sistem Stok berhasil disimpan!');
      fetchStatus();
    } catch (err) {
      console.error('Gagal menyimpan pengaturan sistem stok:', err);
      showToast(err.response?.data?.error || 'Gagal menyimpan pengaturan.', false);
    } finally {
      setSaving(false);
    }
  };

  const handleSync = async () => {
    if (!window.confirm('Sinkronkan stok produk ke lapisan FIFO? Produk yang belum punya lapisan akan dibuatkan saldo awal.')) return;
    setSyncing(true);
    try {
      const res = await apiClient.post('/stock-fifo/sync/');
      const d = res.data || {};
      showToast(`Sync selesai — ${d.lapisan_dibuat} lapisan saldo awal dibuat.`);
      fetchStatus();
    } catch (err) {
      console.error('Gagal sync stok produk:', err);
      showToast(err.response?.data?.error || 'Gagal melakukan sync.', false);
    } finally {
      setSyncing(false);
    }
  };

  const modeAktif = MODES.find((m) => m.id === mode) || MODES[0];
  const fifoAktif = mode !== 'average';

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50 min-h-screen">
        <div className="flex items-center gap-2 text-slate-400 text-xs font-bold">
          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          Memuat pengaturan sistem stok...
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 bg-slate-50 min-h-screen p-6">
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2 border border-slate-800">
          {toast.ok ? (
            <CheckCircle size={16} className="text-emerald-400" />
          ) : (
            <AlertTriangle size={16} className="text-rose-400" />
          )}
          <span className="text-xs font-semibold">{toast.msg}</span>
        </div>
      )}

      <div className="max-w-4xl mx-auto w-full space-y-5">
        <form onSubmit={handleSave} className="space-y-5">
          {/* --- Kartu: Sistem Stok --- */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                  <Boxes size={18} />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-800 text-sm">Sistem Stok</h3>
                  <p className="text-[11px] text-slate-400">Metode penilaian persediaan & perhitungan HPP.</p>
                </div>
              </div>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 disabled:opacity-60 transition-all shadow-sm flex items-center gap-2 cursor-pointer"
              >
                {saving ? (
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Save size={14} />
                )}
                {saving ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>

            <div className="p-6 space-y-4">
              <span className="text-[11px] font-bold text-slate-500">Sistem Stok</span>
              <div className="grid grid-cols-1 sm:grid-cols-3 rounded-lg overflow-hidden border border-slate-200">
                {MODES.map((m) => {
                  const aktif = m.id === mode;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setMode(m.id)}
                      className={`px-4 py-3 text-sm font-bold transition-colors cursor-pointer border-r border-slate-200 last:border-r-0 ${
                        aktif ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {m.label}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-start gap-2 bg-slate-50 border border-slate-100 rounded-lg p-3">
                <Info size={15} className="shrink-0 text-blue-500 mt-0.5" />
                <span className="text-[11px] text-slate-600 leading-relaxed">{modeAktif.info}</span>
              </div>
            </div>
          </div>

          {/* --- Kartu: Satuan Produk --- */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center gap-2.5">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                <Ruler size={18} />
              </div>
              <h3 className="font-extrabold text-slate-800 text-sm">Satuan Produk</h3>
            </div>
            <div className="p-6 flex items-start justify-between gap-6">
              <div>
                <p className="text-xs font-bold text-slate-800">Aktifkan Multi Satuan/UOM</p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Produk dapat memiliki lebih dari satu Satuan/UOM dan terkonversi otomatis.
                </p>
                <p className="text-[10px] text-slate-400 mt-1.5">
                  Satuan diatur per produk di tab <b>Satuan</b>. Stok tetap disimpan dalam satuan
                  dasar; satuan lain dikonversi otomatis saat pembelian, stok masuk, dan penjualan POS.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Toggle active={uomAktif} onChange={() => setUomAktif(!uomAktif)} />
                <span className="text-[11px] font-semibold text-slate-600">
                  {uomAktif ? 'Ya' : 'Tidak'}
                </span>
              </div>
            </div>
          </div>

          {/* --- Kartu: Pengaturan Umum FIFO --- */}
          {fifoAktif && (
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-extrabold text-slate-800 text-sm">Pengaturan Umum FIFO</h3>
                <button
                  type="button"
                  onClick={handleSync}
                  disabled={syncing}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 disabled:opacity-60 transition-all flex items-center gap-2 cursor-pointer"
                >
                  <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
                  {syncing ? 'Menyinkronkan...' : 'Sync Stok Produk'}
                </button>
              </div>

              <div className="p-6 space-y-5 divide-y divide-slate-100">
                {UMUM.map((o) => (
                  <div key={o.key} className="flex items-start justify-between gap-6 pt-5 first:pt-0">
                    <div>
                      <p className="text-xs font-bold text-slate-800">{o.label}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{o.desc}</p>
                    </div>
                    <Toggle
                      active={umum[o.key]}
                      onChange={() => setUmum((p) => ({ ...p, [o.key]: !p[o.key] }))}
                    />
                  </div>
                ))}
              </div>

              {/* Status kesehatan lapisan */}
              {status && (
                <div className="px-6 pb-6">
                  <div className={`rounded-lg border p-3 text-[11px] ${
                    status.jumlah_tidak_cocok > 0
                      ? 'bg-amber-50 border-amber-200 text-amber-700'
                      : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                  }`}>
                    <div className="font-bold mb-1">
                      {status.jumlah_tidak_cocok > 0
                        ? `${status.jumlah_tidak_cocok} produk belum sinkron dengan lapisan FIFO`
                        : 'Semua stok sinkron dengan lapisan FIFO'}
                    </div>
                    <div className="opacity-80">
                      Total lapisan: {status.total_lapisan} · Lapisan terbuka: {status.lapisan_terbuka}
                      {status.tanpa_lapisan > 0 && ` · Belum punya lapisan: ${status.tanpa_lapisan}`}
                    </div>
                    {status.jumlah_tidak_cocok > 0 && (
                      <div className="mt-1.5">Tekan <b>Sync Stok Produk</b> untuk membuat saldo awal.</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
