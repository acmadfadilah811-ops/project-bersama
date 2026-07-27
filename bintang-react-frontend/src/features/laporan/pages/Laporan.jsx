import { useEffect, useState } from 'react';
import { useTransaksiCrumb } from '../../transaksi/components/TransaksiContext';
import LaporanProduk from './produk/LaporanProduk';
import { PEMBELIAN_REPORTS } from './pembelian/reportListPembelian';
import { PENJUALAN_REPORTS } from './penjualan/reportListPenjualan';
import { PEMBAYARAN_REPORTS } from './pembayaran/reportListPembayaran';

const TABS = [
  { id: 'produk', label: 'Laporan Produk' },
  { id: 'pembelian', label: 'Laporan Pembelian' },
  { id: 'penjualan', label: 'Laporan Penjualan' },
  { id: 'shift', label: 'Laporan Penjualan Per Shift' },
  { id: 'pembayaran', label: 'Laporan Pembayaran' },
  { id: 'outlet', label: 'Laporan Multi Outlet' },
];

/** Placeholder untuk tab yang belum dibangun. */
function ComingSoon({ label }) {
  return (
    <div className="flex-1 flex items-center justify-center rounded-xl bg-slate-50/50 border border-slate-100 text-slate-400 text-sm">
      {label} akan segera tersedia.
    </div>
  );
}

export default function Laporan() {
  const { setSubtitle } = useTransaksiCrumb();
  const [activeTab, setActiveTab] = useState('produk');

  useEffect(() => {
    const tab = TABS.find((t) => t.id === activeTab);
    setSubtitle(tab ? tab.label : 'Laporan');
  }, [activeTab, setSubtitle]);

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-white">
      {/* Tab atas — lebar proporsional (tersebar merata penuh) */}
      <div className="flex border-b border-slate-200 shrink-0">
        {TABS.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 px-3 py-4 text-sm font-semibold text-center whitespace-nowrap transition-colors cursor-pointer border-b-2 ${
                isActive
                  ? 'text-blue-600 border-blue-600'
                  : 'text-slate-500 border-transparent hover:text-slate-700 hover:bg-slate-50/40'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Isi tab */}
      <div className="flex flex-col flex-1 min-h-0 p-4 bg-white">
        {activeTab === 'produk' ? (
          <LaporanProduk />
        ) : activeTab === 'pembelian' ? (
          <LaporanProduk reports={PEMBELIAN_REPORTS} />
        ) : activeTab === 'penjualan' ? (
          <LaporanProduk reports={PENJUALAN_REPORTS} />
        ) : activeTab === 'pembayaran' ? (
          <LaporanProduk reports={PEMBAYARAN_REPORTS} />
        ) : (
          <ComingSoon label={TABS.find((t) => t.id === activeTab)?.label} />
        )}
      </div>
    </div>
  );
}
