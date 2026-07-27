import { X } from 'lucide-react';
import { useState } from 'react';
import { notify } from '../../../../utils/notify';

export default function KomisiPenjualanSettingsDrawer({ isOpen, onClose }) {
  const [debitAcc, setDebitAcc] = useState('');
  const [creditAcc, setCreditAcc] = useState('');

  if (!isOpen) return null;

  const debitAccounts = [
    '50000 Pembelian',
    '50100 Pembelian antar cabang',
    '50300 Biaya pengiriman',
    '51000 Harga pokok penjualan',
    '50400 Return pembelian',
    '50500 Potongan pembelian',
    '60100 Biaya gaji',
    '60200 Biaya air listrik telephone',
    '60300 Biaya perlengkapan',
    '60400 Biaya penyusutan',
    '60500 Biaya transfer'
  ];

  const creditAccounts = [
    '11101 Kas',
    '11102 Bank',
    '11103 Kas in register',
    '11104 Giro'
  ];

  const handleApply = () => {
    notify({
      type: 'success',
      title: 'Pengaturan Disimpan',
      message: 'Pemetaan akun default komisi penjualan berhasil disimpan.'
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-end z-[999] animate-fade-in text-xs font-semibold text-slate-700">
      
      {/* Drawer layout sliding in from right side */}
      <div className="bg-white border-l border-slate-200 w-[440px] h-full flex flex-col justify-between shadow-2xl overflow-hidden animate-slide-in">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-[#F8FAFC]">
          <h3 className="text-sm font-bold text-slate-800">Pengaturan POS Komisi Penjualan</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 p-5 overflow-y-auto space-y-6">
          
          <div className="space-y-4">
            {/* Collapsible header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="font-bold text-[#0088E8] text-xs">Pengaturan Akun Default</span>
              <span className="text-slate-400 text-[10px]">▼</span>
            </div>

            {/* Debit Account Dropdown */}
            <div className="space-y-1.5">
              <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                Commission Debit Account
              </label>
              <select
                value={debitAcc}
                onChange={(e) => setDebitAcc(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white outline-none focus:border-[#0088E8] text-xs font-semibold cursor-pointer shadow-3xs text-slate-650"
              >
                <option value="" disabled className="text-slate-400">Pilih</option>
                {debitAccounts.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>

            {/* Credit Account Dropdown */}
            <div className="space-y-1.5 pt-1">
              <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                Commission Credit Account
              </label>
              <select
                value={creditAcc}
                onChange={(e) => setCreditAcc(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white outline-none focus:border-[#0088E8] text-xs font-semibold cursor-pointer shadow-3xs text-slate-650"
              >
                <option value="" disabled className="text-slate-400">Pilih</option>
                {creditAccounts.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>

            {/* Apply Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleApply}
                className="w-full py-2.5 bg-[#0088E8] hover:bg-[#0077CC] text-white text-xs font-bold rounded-lg transition-colors cursor-pointer text-center block shadow-2xs"
              >
                Terapkan Default
              </button>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 rounded-lg text-xs font-bold cursor-pointer transition-colors shadow-2xs"
          >
            Tutup
          </button>
        </div>

      </div>
    </div>
  );
}
