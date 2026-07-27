import { X } from 'lucide-react';
import { useState } from 'react';

import { notify } from '../../../../utils/notify';

export default function TipeTransaksiModal({ isOpen, onClose }) {
  const [originalAccount, setOriginalAccount] = useState('');
  const [selectedAccount, setSelectedAccount] = useState('');

  if (!isOpen) return null;

  const isDirty = selectedAccount !== originalAccount;

  const handleCancel = () => {
    setSelectedAccount(originalAccount);
  };

  const handleSave = () => {
    setOriginalAccount(selectedAccount);
    notify({
      type: 'success',
      title: 'Tipe Transaksi Disimpan',
      message: 'Pemetaan tipe transaksi pendapatan berhasil disimpan.'
    });
  };

  const accountsList = [
    '40000 Penjualan',
    '41000 Penjualan antar cabang',
    '42000 Layanan biaya penjualan',
    '44000 Pengiriman penjualan',
    '46100 Potongan penjualan',
    '46200 Loyalitas penjualan',
    '46300 Return penjualan',
    '50000 Pembelian',
    '50100 Pembelian antar cabang',
    '50300 Biaya pengiriman',
    '50400 Return pembelian',
    '50500 Potongan pembelian',
    '51000 Harga pokok penjualan',
    '60100 Biaya gaji',
    '60200 Biaya air listrik telephone',
    '60300 Biaya perlengkapan',
    '60400 Biaya penyusutan',
    '60500 Biaya transfer',
    '70000 Pendapatan lain lain',
    '70001 Pembulatan',
    '70002 Code Uniq Penjualan',
    '70003 Layanan Penjualan',
    '70009 Bank Example',
    '80000 Pengeluaran lain lain',
    '81000 Penyesuaian Barang'
  ];

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-[9999] animate-fade-in text-xs font-semibold text-slate-700">
      <div className="bg-white rounded-xl border border-slate-205 shadow-2xl w-[720px] overflow-hidden animate-scale-up">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-[#F8FAFC]">
          <h3 className="text-xs font-bold text-slate-800">Tipe Transaksi Pendapatan</h3>
          
          {isDirty ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCancel}
                className="px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-md font-extrabold text-[10px] cursor-pointer transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md font-extrabold text-[10px] cursor-pointer transition-colors shadow-3xs"
              >
                Simpan
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-md font-bold transition-colors cursor-pointer"
            >
              Tutup
            </button>
          )}
        </div>

        {/* Table list */}
        <div className="p-4 overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="text-slate-400 font-bold border-b border-slate-100">
              <tr>
                <th className="py-2.5 w-[50%]">Nama</th>
                <th className="py-2.5 w-[50%]">Nama Akun</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-50">
                <td className="py-3 font-medium text-slate-700">Dhitch</td>
                <td className="py-3">
                  <select
                    value={selectedAccount}
                    onChange={(e) => setSelectedAccount(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-md bg-white outline-none focus:border-[#0088E8] font-medium text-slate-650 cursor-pointer shadow-3xs"
                  >
                    <option value="" disabled>Pilih</option>
                    {accountsList.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Footer info & pagination */}
        <div className="p-4 border-t border-slate-50 flex items-center justify-between text-[10px] font-bold text-slate-500 bg-slate-50/20">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">15 item</span>
            <span className="text-slate-300">▼</span>
          </div>

          <div className="flex items-center gap-4">
            <span>Total 1</span>
            <div className="flex items-center gap-1">
              <button disabled className="w-5 h-5 flex items-center justify-center rounded border border-slate-200 bg-white text-slate-400 cursor-not-allowed">
                &lt;
              </button>
              <span className="w-5 h-5 flex items-center justify-center rounded bg-[#0088E8] text-white">
                1
              </span>
              <button disabled className="w-5 h-5 flex items-center justify-center rounded border border-slate-200 bg-white text-slate-400 cursor-not-allowed">
                &gt;
              </button>
            </div>
            
            <div className="flex items-center gap-1">
              <span>Go to</span>
              <input
                type="text"
                defaultValue="1"
                disabled
                className="w-6 py-0.5 text-center border border-slate-200 rounded bg-slate-50 text-slate-400 outline-none"
              />
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
