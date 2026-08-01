import { useState } from 'react';

export default function StokMasukSettingsPopover({ isOpen }) {
  const [stockAsOption, setStockAsOption] = useState('penambahan_modal'); // 'pembelian' | 'penambahan_modal'
  const [defaultPaymentAccount, setDefaultPaymentAccount] = useState('11101 Kas');

  if (!isOpen) return null;

  const accountsList = [
    '11101 Kas',
    '11102 Bank',
    '11103 Kas in register',
    '11104 Giro',
    '11200 Investasi jangka pendek dan surat berharga',
    '11400 Persediaan barang dagang',
    '11500 Peralatan',
    '11600 Akumulasi penyusutan peralatan',
    '11700 Beban dibayar dimuka',
    '11750 PPN Masukan',
    '12000 Aset Tetap',
    '13000 Aset tak berwujud',
    '14000 Akumulasi penyusutan aset tetap',
    '15000 Akumulasi penyusutan aset tak berwujud',
    '21000 Hutang dagang',
    '21002 Cash Example',
    '22000 Hutang bank',
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

  return (
    <div className="absolute right-0 top-10 z-[999] bg-white border border-slate-200 rounded-xl shadow-xl p-4 w-[360px] animate-fade-in space-y-4 text-xs font-semibold text-slate-700">
      
      {/* Top Title & Save Button */}
      <div className="flex items-center justify-between border-b border-slate-50 pb-2">
        <span className="font-bold text-slate-800">Penyesuaian Stok Masuk</span>
        <button type="button" disabled className="cursor-not-allowed rounded-lg bg-slate-100 px-3.5 py-1 text-[11px] font-bold text-slate-400">
          Simpan
        </button>
      </div>
      <p className="rounded-lg bg-amber-50 p-2 text-[11px] font-medium text-amber-700">Pengaturan belum terhubung ke backend dan tidak dapat disimpan.</p>

      {/* Stock Category Options */}
      <div className="space-y-2">
        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">
          Stok masuk dijadikan sebagai
        </span>
        <div className="grid grid-cols-2 gap-2">
          
          {/* Pembelian option */}
          <button
            type="button"
            onClick={() => setStockAsOption('pembelian')}
            className={`flex items-center gap-2 px-3 py-2 border rounded-lg transition-all font-bold cursor-pointer text-center justify-center ${
              stockAsOption === 'pembelian'
                ? 'border-[#0088E8] bg-[#E6F4FF] text-[#0088E8]'
                : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-600'
            }`}
          >
            <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center transition-all ${
              stockAsOption === 'pembelian' ? 'border-[#0088E8]' : 'border-slate-300'
            }`}>
              {stockAsOption === 'pembelian' && (
                <div className="w-1.5 h-1.5 rounded-full bg-[#0088E8]" />
              )}
            </div>
            <span>Pembelian</span>
          </button>

          {/* Penambahan Modal option */}
          <button
            type="button"
            onClick={() => setStockAsOption('penambahan_modal')}
            className={`flex items-center gap-2 px-3 py-2 border rounded-lg transition-all font-bold cursor-pointer text-center justify-center ${
              stockAsOption === 'penambahan_modal'
                ? 'border-[#0088E8] bg-[#E6F4FF] text-[#0088E8]'
                : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-600'
            }`}
          >
            <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center transition-all ${
              stockAsOption === 'penambahan_modal' ? 'border-[#0088E8]' : 'border-slate-300'
            }`}>
              {stockAsOption === 'penambahan_modal' && (
                <div className="w-1.5 h-1.5 rounded-full bg-[#0088E8]" />
              )}
            </div>
            <span>Penambahan Modal</span>
          </button>
        </div>
      </div>

      {/* Conditionally rendered default payment account dropdown */}
      {stockAsOption === 'pembelian' && (
        <div className="space-y-1.5 pt-1.5 border-t border-slate-50 animate-fade-in">
          <label className="text-slate-600 font-bold">Akun Pembayaran Default</label>
          <select
            value={defaultPaymentAccount}
            onChange={(e) => setDefaultPaymentAccount(e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white outline-none focus:border-[#0088E8] text-xs font-semibold cursor-pointer shadow-2xs"
          >
            {accountsList.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>
      )}

    </div>
  );
}
