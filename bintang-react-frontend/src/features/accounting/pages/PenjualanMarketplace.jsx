import { useState } from 'react';
import { Filter, Settings, AlertTriangle, ChevronDown } from 'lucide-react';
import PosSettingsModal from '../components/pos/PosSettingsModal';

export default function PenjualanMarketplace() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [dateFrom, setDateFrom] = useState('2026-07-26');
  const [dateTo, setDateTo] = useState('2026-07-26');
  const [semuaStatus, setSemuaStatus] = useState(false);

  return (
    <div className="space-y-4 animate-fade-in text-xs font-semibold text-slate-700">
      
      {/* Dynamic/Static System Link Warning banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3.5 flex items-start gap-3 shadow-2xs">
        <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={16} />
        <div className="space-y-1">
          <p className="font-bold text-amber-900 text-xs">
            Sistem Belum Terhubung ke Marketplace
          </p>
          <p className="text-amber-700 text-[11px] font-medium leading-relaxed">
            Data transaksi e-commerce belum disinkronisasikan karena koneksi API belum terhubung. 
            Silakan lakukan integrasi toko/marketplace terlebih dahulu untuk menarik data riil.
          </p>
        </div>
      </div>

      {/* Header Title */}
      <h2 className="text-base font-bold text-slate-900">Penjualan Marketplace</h2>

      {/* Action Row */}
      <div className="flex flex-wrap gap-4 items-center justify-between">
        
        {/* Left Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-205 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg shadow-2xs transition-colors cursor-pointer"
          >
            <Filter size={12} className="text-slate-400" />
            <span>Filter</span>
          </button>

          <button
            type="button"
            className="px-3 py-1.5 border border-slate-205 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg shadow-2xs transition-colors cursor-pointer"
          >
            Hari ini 26 Jul 2026 - 26 Jul 2026
          </button>

          {/* Semua Status Button/Checkbox styled matching Screenshot 3 */}
          <button
            type="button"
            onClick={() => setSemuaStatus(!semuaStatus)}
            className="flex items-center gap-2 px-3 py-1.5 border border-slate-205 bg-white hover:bg-slate-50 text-slate-700 rounded-lg shadow-2xs transition-all cursor-pointer"
          >
            <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-all ${
              semuaStatus ? 'border-[#0088E8] bg-[#0088E8] text-white' : 'border-slate-300 bg-white'
            }`}>
              {semuaStatus && <span className="text-[9px] font-bold">✓</span>}
            </div>
            <span>Semua Status</span>
          </button>
        </div>

        {/* Right Action buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled
            className="px-4 py-1.5 font-bold rounded-lg text-[10px] bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed transition-all shadow-2xs"
          >
            Batal Post
          </button>

          <button
            type="button"
            disabled
            className="px-4 py-1.5 font-bold rounded-lg text-[10px] bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed transition-all shadow-2xs"
          >
            Post
          </button>

          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            className="p-1.5 border border-slate-202 text-slate-400 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors shadow-2xs"
          >
            <Settings size={14} />
          </button>
        </div>

      </div>

      {/* Table Area (No Data Layout) */}
      <div className="bg-white border border-slate-100 rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50/50 border-b border-slate-100 text-slate-400 font-bold">
              <tr>
                <th className="px-5 py-3.5 w-10 text-center">
                  <div className="w-3.5 h-3.5 rounded border border-slate-200 bg-white" />
                </th>
                <th className="px-5 py-3.5">Tanggal Jual</th>
                <th className="px-5 py-3.5">Transaksi</th>
                <th className="px-5 py-3.5">Pelanggan</th>
                <th className="px-5 py-3.5 text-right">Jumlah</th>
                <th className="px-5 py-3.5 text-center">Status</th>
                <th className="px-5 py-3.5 text-center">Post Pembayaran</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={7} className="px-5 py-12 text-center text-slate-400 font-bold">
                  No Data
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Pagination bar matching Screenshot 3 */}
        <div className="p-4 border-t border-slate-50 flex items-center justify-between text-[11px] font-bold text-slate-500 bg-slate-50/30">
          
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-1 px-2.5 py-1 border border-slate-200 bg-white hover:bg-slate-50 rounded-md transition-colors shadow-2xs">
              <span>15 item</span>
              <ChevronDown size={11} className="text-slate-400" />
            </button>
          </div>

          <div className="flex items-center gap-4">
            <span>Total 0</span>
            <div className="flex items-center gap-1.5">
              <button disabled className="w-6 h-6 flex items-center justify-center rounded border border-slate-200 bg-white text-slate-400 cursor-not-allowed">
                &lt;
              </button>
              <span className="w-6 h-6 flex items-center justify-center rounded bg-[#0088E8] text-white">
                1
              </span>
              <button disabled className="w-6 h-6 flex items-center justify-center rounded border border-slate-200 bg-white text-slate-400 cursor-not-allowed">
                &gt;
              </button>
            </div>
            
            <div className="flex items-center gap-1.5">
              <span>Go to</span>
              <input
                type="text"
                defaultValue="1"
                disabled
                className="w-8 py-0.5 text-center border border-slate-200 rounded bg-slate-50 text-slate-400 outline-none"
              />
            </div>
          </div>

        </div>
      </div>

      {/* POS Settings Drawer Modal */}
      <PosSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

    </div>
  );
}
