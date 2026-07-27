import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { notify } from '../../../../utils/notify';

export default function OpnameStokSettingsPopover({ isOpen, onClose }) {
  const [hppAccount, setHppAccount] = useState('51000 Harga pokok penjualan');

  if (!isOpen) return null;

  const accountsList = [
    '11101 Kas',
    '11102 Bank',
    '11103 Kas in register',
    '11104 Giro',
    '11200 Investasi jangka pendek dan surat berharga',
    '11300 Piutang dagang',
    '11400 Persediaan barang dagang',
    '11500 Peralatan',
    '11600 Akumulasi penyusutan peralatan',
    '11700 Beban dibayar dimuka',
    '11750 PPN Masukan',
    '12000 Aset Tetap',
    '13000 Aset tak berwujud',
    '14000 Akumulasi penyusutan aset tetap',
    '15000 Akumulasi penyusutan aset tak berwujud',
    '23000 Pendapatan di terima dimuka',
    '23500 PPN Keluaran',
    '31000 Modal',
    '32000 Prive',
    '33000 Laba rugi ditahan',
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

  const handleSave = (e) => {
    e.stopPropagation();
    notify({
      type: 'success',
      title: 'Pengaturan Disimpan',
      message: 'Konfigurasi penyesuaian opname stok berhasil disimpan.'
    });
    onClose();
  };

  const handleClear = () => {
    setHppAccount('');
  };

  return (
    <div className="absolute right-0 top-10 z-[999] bg-white border border-slate-150 rounded-xl shadow-2xl p-4.5 w-[360px] animate-fade-in space-y-4 text-xs font-semibold text-slate-700">
      
      {/* Top Title & Save Button */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <span className="font-bold text-slate-800 text-xs">Penyesuaian Opname Stok</span>
        <button
          type="button"
          onClick={handleSave}
          className="px-4 py-1.5 bg-[#0088E8] hover:bg-[#0077CC] text-white text-[10px] font-extrabold rounded-md transition-all cursor-pointer shadow-3xs"
        >
          Simpan
        </button>
      </div>

      {/* Account HPP Stock Opname */}
      <div className="space-y-2">
        <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
          Akun HPP Stock Opname
        </label>
        <div className="flex items-center gap-2">
          <select
            value={hppAccount}
            onChange={(e) => setHppAccount(e.target.value)}
            className="w-0 min-w-0 flex-1 px-3 py-2 border border-slate-200 rounded-lg bg-white outline-none focus:border-[#0088E8] text-xs font-semibold cursor-pointer shadow-3xs text-slate-700 transition-all"
          >
            <option value="" disabled className="text-slate-400">Pilih akun...</option>
            {accountsList.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
          
          {/* Trash Can Button */}
          <button
            type="button"
            onClick={handleClear}
            className="p-2 bg-rose-50/50 hover:bg-rose-100 text-rose-500 hover:text-rose-650 rounded-lg cursor-pointer transition-all border-0 shadow-3xs shrink-0 flex items-center justify-center"
            title="Hapus pilihan"
          >
            <Trash2 size={13} className="stroke-[2.5]" />
          </button>
        </div>
      </div>

    </div>
  );
}
