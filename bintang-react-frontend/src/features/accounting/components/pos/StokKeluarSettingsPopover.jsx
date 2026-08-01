import { useState } from 'react';

export default function StokKeluarSettingsPopover({ isOpen }) {
  const [debitAccount, setDebitAccount] = useState('11101 Kas');
  const [hppAccount, setHppAccount] = useState('');

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
    '13500 Aset tak berwujud',
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
        <span className="font-bold text-slate-800">Penyesuaian Stok Keluar</span>
        <button type="button" disabled className="cursor-not-allowed rounded-lg bg-slate-100 px-3.5 py-1 text-[11px] font-bold text-slate-400">
          Simpan
        </button>
      </div>
      <p className="rounded-lg bg-amber-50 p-2 text-[11px] font-medium text-amber-700">Pengaturan belum terhubung ke backend dan tidak dapat disimpan.</p>

      {/* Account Debit Transfer Toko Lain */}
      <div className="space-y-1.5">
        <label className="text-slate-550 font-bold">Akun debit transfer toko lain</label>
        <select
          value={debitAccount}
          onChange={(e) => setDebitAccount(e.target.value)}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white outline-none focus:border-[#0088E8] text-xs font-semibold cursor-pointer shadow-2xs"
        >
          {accountsList.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </div>

      {/* Account HPP untuk Stok Keluar */}
      <div className="space-y-1.5">
        <label className="text-slate-550 font-bold">Akun hpp untuk stock keluar</label>
        <select
          value={hppAccount}
          onChange={(e) => setHppAccount(e.target.value)}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white outline-none focus:border-[#0088E8] text-xs font-semibold cursor-pointer shadow-2xs text-slate-650"
        >
          <option value="" disabled className="text-slate-400">Pilih</option>
          {accountsList.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </div>

    </div>
  );
}
