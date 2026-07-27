import { X } from 'lucide-react';

export default function PasanganJurnalModal({ isOpen, onClose, txNo, clientName, amount }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-[9999] animate-fade-in text-xs font-semibold text-slate-700">
      <div className="bg-white border border-slate-205 rounded-2xl shadow-2xl w-[940px] max-h-[90vh] overflow-y-auto relative animate-scale-up">
        
        {/* Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-150 bg-[#F8FAFC]">
          <h4 className="text-[13px] font-bold text-slate-800 font-mono">
            {txNo} - Penjualan
          </h4>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-650 rounded-lg shadow-2xs font-bold text-[11px] cursor-pointer transition-colors"
          >
            Tutup
          </button>
        </div>

        {/* Content Table */}
        <div className="p-6 space-y-4">
          <div className="border border-slate-150 rounded-lg overflow-hidden bg-white">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-450 uppercase tracking-wider select-none">
                  <th className="px-5 py-3">Tanggal</th>
                  <th className="px-5 py-3">Akun</th>
                  <th className="px-5 py-3">Nama Transaksi</th>
                  <th className="px-5 py-3">Deskripsi</th>
                  <th className="px-5 py-3 text-right">Nilai Debit</th>
                  <th className="px-5 py-3 text-right">Nilai Kredit</th>
                  <th className="px-5 py-3">Diproses Oleh</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-5 py-3.5 text-slate-600 font-medium">24-Jul-2026</td>
                  <td className="px-5 py-3.5 text-slate-750 font-bold">11300 Piutang dagang</td>
                  <td className="px-5 py-3.5 text-slate-600">Penjualan</td>
                  <td className="px-5 py-3.5 text-slate-500 font-medium">Penjualan ke {clientName}</td>
                  <td className="px-5 py-3.5 text-right font-mono font-bold text-slate-800">
                    IDR {amount.toLocaleString('id-ID')}
                  </td>
                  <td className="px-5 py-3.5 text-right font-mono text-slate-400">IDR 0</td>
                  <td className="px-5 py-3.5 text-slate-600 font-bold">Brandy</td>
                </tr>
                <tr className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-5 py-3.5 text-slate-600 font-medium">24-Jul-2026</td>
                  <td className="px-5 py-3.5 text-slate-750 font-bold">40000 Penjualan</td>
                  <td className="px-5 py-3.5 text-slate-600">Penjualan</td>
                  <td className="px-5 py-3.5 text-slate-500 font-medium">Penjualan ke {clientName}</td>
                  <td className="px-5 py-3.5 text-right font-mono text-slate-400">IDR 0</td>
                  <td className="px-5 py-3.5 text-right font-mono font-bold text-slate-800">
                    IDR {amount.toLocaleString('id-ID')}
                  </td>
                  <td className="px-5 py-3.5 text-slate-600 font-bold">Brandy</td>
                </tr>
                <tr className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-5 py-3.5 text-slate-600 font-medium">24-Jul-2026</td>
                  <td className="px-5 py-3.5 text-slate-750 font-bold">51000 Harga pokok penjualan</td>
                  <td className="px-5 py-3.5 text-slate-600">Penjualan</td>
                  <td className="px-5 py-3.5 text-slate-500 font-medium">Penjualan ke {clientName}</td>
                  <td className="px-5 py-3.5 text-right font-mono text-slate-400">IDR 0</td>
                  <td className="px-5 py-3.5 text-right font-mono text-slate-400">IDR 0</td>
                  <td className="px-5 py-3.5 text-slate-600 font-bold">Brandy</td>
                </tr>
                <tr className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-5 py-3.5 text-slate-600 font-medium">24-Jul-2026</td>
                  <td className="px-5 py-3.5 text-slate-750 font-bold">11400 Persediaan barang dagang</td>
                  <td className="px-5 py-3.5 text-slate-600">Penjualan</td>
                  <td className="px-5 py-3.5 text-slate-500 font-medium">Penjualan ke {clientName}</td>
                  <td className="px-5 py-3.5 text-right font-mono text-slate-400">IDR 0</td>
                  <td className="px-5 py-3.5 text-right font-mono text-slate-400">IDR 0</td>
                  <td className="px-5 py-3.5 text-slate-600 font-bold">Brandy</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Footer Info & Pagination */}
          <div className="p-4 border-t border-slate-50 flex items-center justify-between text-[11px] font-bold text-slate-500 bg-slate-50/30">
            <div>
              <span>Total 4</span>
            </div>
            <div className="flex items-center gap-4">
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

      </div>
    </div>
  );
}
